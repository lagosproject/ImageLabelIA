use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageFormat};
use ort::session::Session;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

const INPUT_SIZE: usize = 224;
const CHANNEL_SIZE: usize = INPUT_SIZE * INPUT_SIZE;

// Global state for Tauri to share the ONNX session and the labels list
pub struct TaggerState {
    pub session: Mutex<Option<Session>>,
    pub labels: Mutex<Vec<String>>,
}

impl TaggerState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
            labels: Mutex::new(Vec::new()),
        }
    }
}

// Struct representing basic image file information returned to gallery
#[derive(Serialize, Deserialize, Clone)]
pub struct ImageFileInfo {
    pub path: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ExifData {
    pub make: Option<String>,
    pub model: Option<String>,
    pub exposure_time: Option<String>,
    pub aperture: Option<String>,
    pub iso: Option<String>,
    pub date_time: Option<String>,
    pub focal_length: Option<String>,
}

// Struct representing the detailed prediction and metadata response
#[derive(Serialize, Deserialize)]
pub struct ImageProcessResult {
    pub path: String,
    pub thumbnail: String,
    pub predicted_tags: Vec<String>,
    pub existing_tags: Vec<String>,
    pub dimensions: (u32, u32),
    pub file_size_bytes: u64,
    pub exif: ExifData,
}

// Lightweight metadata struct — no AI inference, returned immediately on image selection
#[derive(Serialize, Deserialize)]
pub struct ImageMetadata {
    pub path: String,
    pub existing_tags: Vec<String>,
    pub dimensions: Option<(u32, u32)>,
    pub file_size_bytes: u64,
    pub exif: ExifData,
}

// Resolves symlinks and `..` segments so every command works on a real, canonical path.
// Returns an error if the path does not exist on disk.
fn resolve_safe_path(path_str: &str) -> Result<PathBuf, String> {
    Path::new(path_str)
        .canonicalize()
        .map_err(|e| format!("Invalid path '{}': {}", path_str, e))
}

// Helper to lazily load the ONNX session and class labels if not loaded yet
fn load_model_if_needed(app_handle: &AppHandle, state: &TaggerState) -> Result<(), String> {
    let mut session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let mut labels_guard = state.labels.lock().map_err(|e| e.to_string())?;

    if session_guard.is_some() && !labels_guard.is_empty() {
        return Ok(());
    }

    // Tauri resource path resolution
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource directory: {}", e))?;

    let model_path = resource_dir.join("resources").join("convnext.onnx");
    let labels_path = resource_dir.join("resources").join("convnext_labels.json");

    if !model_path.exists() {
        return Err(format!(
            "Model file not found at: {}. Please run the download script.",
            model_path.display()
        ));
    }
    if !labels_path.exists() {
        return Err(format!(
            "Labels file not found at: {}. Please run the download script.",
            labels_path.display()
        ));
    }

    // Load class labels list
    let labels_content = fs::read_to_string(&labels_path)
        .map_err(|e| format!("Failed to read labels file: {}", e))?;
    let labels: Vec<String> = serde_json::from_str(&labels_content)
        .map_err(|e| format!("Failed to parse labels JSON: {}", e))?;

    // Load the ONNX Runtime session
    log::info!(
        "Loading ConvNeXt ONNX session from: {}...",
        model_path.display()
    );
    let session = Session::builder()
        .map_err(|e| e.to_string())?
        .commit_from_file(model_path)
        .map_err(|e| format!("Failed to initialize ONNX session: {}", e))?;

    *session_guard = Some(session);
    *labels_guard = labels;

    log::info!("ConvNeXt model and labels loaded successfully.");
    Ok(())
}

// Image preprocessing for ConvNeXt (Resize, Normalize, flat NCHW vector)
fn preprocess_image(path: &Path) -> Result<(Vec<f32>, DynamicImage), String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    let resized = img.resize_exact(
        INPUT_SIZE as u32,
        INPUT_SIZE as u32,
        image::imageops::FilterType::Triangle,
    );
    let rgb = resized.to_rgb8();

    let mut input = vec![0.0f32; 3 * CHANNEL_SIZE];

    // ImageNet mean and standard deviation
    let mean = [0.485, 0.456, 0.406];
    let std = [0.229, 0.224, 0.225];

    for (x, y, pixel) in rgb.enumerate_pixels() {
        let r = (pixel[0] as f32 / 255.0 - mean[0]) / std[0];
        let g = (pixel[1] as f32 / 255.0 - mean[1]) / std[1];
        let b = (pixel[2] as f32 / 255.0 - mean[2]) / std[2];

        let idx = (y as usize) * INPUT_SIZE + (x as usize);
        input[idx] = r;
        input[CHANNEL_SIZE + idx] = g;
        input[2 * CHANNEL_SIZE + idx] = b;
    }

    Ok((input, img))
}

fn bytes_to_data_url(bytes: &[u8]) -> String {
    format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes))
}

fn get_thumbnail_jpeg_bytes(img: &DynamicImage) -> Option<Vec<u8>> {
    let thumbnail = img.thumbnail(256, 256);
    let mut buffer = Cursor::new(Vec::new());
    if thumbnail.write_to(&mut buffer, ImageFormat::Jpeg).is_ok() {
        Some(buffer.into_inner())
    } else {
        None
    }
}

// Used by get_image_data which already holds the decoded image in memory
fn get_thumbnail_base64(img: &DynamicImage) -> String {
    get_thumbnail_jpeg_bytes(img)
        .map(|b| bytes_to_data_url(&b))
        .unwrap_or_default()
}

// FNV-1a: stable across runs, no extra deps, good enough for a file cache key
fn stable_hash(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for byte in s.bytes() {
        h ^= byte as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

// Cache key encodes path + mtime so edits to the source image bust the cache automatically
fn thumb_cache_key(path: &Path) -> String {
    let mtime = fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!(
        "{:016x}",
        stable_hash(&format!("{}:{}", path.display(), mtime))
    )
}

// Check if a file extension is a supported image format
fn is_supported_image(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        matches!(
            ext.to_lowercase().as_str(),
            "jpg" | "jpeg" | "png" | "dng" | "tiff" | "tif"
        )
    } else {
        false
    }
}

// Tauri Command: Get subfolders of a given folder path (for the treeview)
#[tauri::command]
pub fn get_subfolders(folder_path: String) -> Result<Vec<String>, String> {
    let path = resolve_safe_path(&folder_path)?;
    if !path.is_dir() {
        return Err("Path is not a valid directory".to_string());
    }

    let mut subfolders = Vec::new();
    if let Ok(entries) = fs::read_dir(&path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        // Ignore hidden folders starting with dot
                        if !name.starts_with('.') {
                            subfolders.push(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    subfolders.sort();
    Ok(subfolders)
}

// Tauri Command: Generate a small 256×256 JPEG thumbnail for gallery display.
// Fast path: browser-native formats (JPEG/PNG) are served directly via the asset
// protocol in the frontend and never reach this command.
// This path handles DNG/TIFF/RAW with a persistent disk cache so each file is
// decoded at most once, and the blocking decode runs off the async executor.
#[tauri::command]
pub async fn get_thumbnail(app: AppHandle, image_path: String) -> Result<String, String> {
    let path = resolve_safe_path(&image_path)?;

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbs");
    let cache_file = cache_dir.join(format!("{}.jpg", thumb_cache_key(&path)));

    if cache_file.exists() {
        if let Ok(bytes) = fs::read(&cache_file) {
            return Ok(bytes_to_data_url(&bytes));
        }
    }

    let jpeg_bytes = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let img = image::open(&path).map_err(|e| format!("Cannot open image: {}", e))?;
        get_thumbnail_jpeg_bytes(&img).ok_or_else(|| "Failed to encode thumbnail".to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    // Best-effort write — a failed cache write is not fatal
    let _ = fs::create_dir_all(&cache_dir);
    let _ = fs::write(&cache_file, &jpeg_bytes);

    Ok(bytes_to_data_url(&jpeg_bytes))
}

// Tauri Command: Get image files inside a folder (for the gallery)
#[tauri::command]
pub fn get_images_in_folder(folder_path: String) -> Result<Vec<ImageFileInfo>, String> {
    let path = resolve_safe_path(&folder_path)?;
    if !path.is_dir() {
        return Err("Path is not a valid directory".to_string());
    }

    let mut images = Vec::new();
    if let Ok(entries) = fs::read_dir(&path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() && is_supported_image(&entry_path) {
                if let Some(name) = entry.file_name().to_str() {
                    images.push(ImageFileInfo {
                        path: entry_path.to_string_lossy().to_string(),
                        name: name.to_string(),
                    });
                }
            }
        }
    }
    // Sort images by name alphabetically
    images.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(images)
}

// Tauri Command: Run ConvNeXt inference and fetch metadata for a single image
#[tauri::command]
pub async fn get_image_data(
    app: AppHandle,
    state: tauri::State<'_, TaggerState>,
    image_path: String,
) -> Result<ImageProcessResult, String> {
    let safe_path = resolve_safe_path(&image_path)?;

    // 1. Ensure model is loaded
    load_model_if_needed(&app, &state)?;

    // 2. Preprocess image and get dimensions
    let (input, img) = preprocess_image(&safe_path)?;
    let dimensions = (img.width(), img.height());

    // 3. Generate base64 thumbnail
    let thumbnail = get_thumbnail_base64(&img);

    // 4. Read file size and EXIF metadata using rexiv2
    let file_size_bytes = fs::metadata(&safe_path).map(|m| m.len()).unwrap_or(0);

    let (existing_tags, exif) = match rexiv2::Metadata::new_from_path(&safe_path) {
        Ok(meta) => {
            let mut tags = Vec::new();
            if let Ok(iptc_tags) = meta.get_tag_multiple_strings("Iptc.Application2.Keywords") {
                tags.extend(iptc_tags);
            }
            if let Ok(xmp_tags) = meta.get_tag_multiple_strings("Xmp.dc.subject") {
                tags.extend(xmp_tags);
            }
            tags.sort();
            tags.dedup();

            let exif_data = ExifData {
                make: meta.get_tag_string("Exif.Image.Make").ok(),
                model: meta.get_tag_string("Exif.Image.Model").ok(),
                exposure_time: meta.get_tag_string("Exif.Photo.ExposureTime").ok(),
                aperture: meta.get_tag_string("Exif.Photo.FNumber").ok(),
                iso: meta.get_tag_string("Exif.Photo.ISOSpeedRatings").ok(),
                date_time: meta
                    .get_tag_string("Exif.Photo.DateTimeOriginal")
                    .ok()
                    .or_else(|| meta.get_tag_string("Exif.Image.DateTime").ok()),
                focal_length: meta.get_tag_string("Exif.Photo.FocalLength").ok(),
            };

            (tags, exif_data)
        }
        Err(_) => (Vec::new(), ExifData::default()),
    };

    // 5. Run ONNX Inference
    let mut session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard
        .as_mut()
        .ok_or("ONNX session not initialized")?;

    let shape = [1usize, 3, INPUT_SIZE, INPUT_SIZE];
    let input_tensor = ort::value::Tensor::from_array((shape, input))
        .map_err(|e| format!("Failed to create input tensor: {}", e))?;

    let session_inputs = ort::inputs!["pixel_values" => input_tensor];

    let outputs = session
        .run(session_inputs)
        .map_err(|e| format!("Inference failed: {}", e))?;

    let output_tensor = outputs["logits"]
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to extract output tensor: {}", e))?;

    // In ort v2, try_extract_tensor returns (Shape, &[T])
    let logits = output_tensor.1;

    // Sort logits descending to find top categories
    let mut indexed_logits: Vec<(usize, &f32)> = logits.iter().enumerate().collect();
    indexed_logits.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Get top 10 labels
    let labels_guard = state.labels.lock().map_err(|e| e.to_string())?;
    let mut predicted_tags = Vec::new();

    for i in 0..10 {
        if let Some(&(idx, _val)) = indexed_logits.get(i) {
            if let Some(label) = labels_guard.get(idx) {
                // Split comma-separated class labels from ImageNet-22k and take first name
                let clean_label = label
                    .split(',')
                    .next()
                    .unwrap_or(label.as_str())
                    .trim()
                    .to_string();
                predicted_tags.push(clean_label);
            }
        }
    }

    Ok(ImageProcessResult {
        path: image_path,
        thumbnail,
        predicted_tags,
        existing_tags,
        dimensions,
        file_size_bytes,
        exif,
    })
}

// Tauri Command: Read file metadata and EXIF without running AI inference (fast path)
#[tauri::command]
pub async fn get_image_metadata(image_path: String) -> Result<ImageMetadata, String> {
    let safe_path = resolve_safe_path(&image_path)?;

    let file_size_bytes = fs::metadata(&safe_path).map(|m| m.len()).unwrap_or(0);

    let dimensions = image::open(&safe_path)
        .map(|img| (img.width(), img.height()))
        .ok();

    let (existing_tags, exif) = match rexiv2::Metadata::new_from_path(&safe_path) {
        Ok(meta) => {
            let mut tags = Vec::new();
            if let Ok(iptc_tags) = meta.get_tag_multiple_strings("Iptc.Application2.Keywords") {
                tags.extend(iptc_tags);
            }
            if let Ok(xmp_tags) = meta.get_tag_multiple_strings("Xmp.dc.subject") {
                tags.extend(xmp_tags);
            }
            tags.sort();
            tags.dedup();

            let exif_data = ExifData {
                make: meta.get_tag_string("Exif.Image.Make").ok(),
                model: meta.get_tag_string("Exif.Image.Model").ok(),
                exposure_time: meta.get_tag_string("Exif.Photo.ExposureTime").ok(),
                aperture: meta.get_tag_string("Exif.Photo.FNumber").ok(),
                iso: meta.get_tag_string("Exif.Photo.ISOSpeedRatings").ok(),
                date_time: meta
                    .get_tag_string("Exif.Photo.DateTimeOriginal")
                    .ok()
                    .or_else(|| meta.get_tag_string("Exif.Image.DateTime").ok()),
                focal_length: meta.get_tag_string("Exif.Photo.FocalLength").ok(),
            };

            (tags, exif_data)
        }
        Err(_) => (Vec::new(), ExifData::default()),
    };

    Ok(ImageMetadata {
        path: image_path,
        existing_tags,
        dimensions,
        file_size_bytes,
        exif,
    })
}

// Tauri Command: Run only ConvNeXt inference, return predicted tag names
#[tauri::command]
pub async fn get_image_ai_tags(
    app: AppHandle,
    state: tauri::State<'_, TaggerState>,
    image_path: String,
) -> Result<Vec<String>, String> {
    let safe_path = resolve_safe_path(&image_path)?;

    load_model_if_needed(&app, &state)?;

    let (input, _img) = preprocess_image(&safe_path)?;

    let shape = [1usize, 3, INPUT_SIZE, INPUT_SIZE];
    let input_tensor = ort::value::Tensor::from_array((shape, input))
        .map_err(|e| format!("Failed to create input tensor: {}", e))?;

    let session_inputs = ort::inputs!["pixel_values" => input_tensor];

    let mut session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard
        .as_mut()
        .ok_or("ONNX session not initialized")?;

    let outputs = session
        .run(session_inputs)
        .map_err(|e| format!("Inference failed: {}", e))?;

    let output_tensor = outputs["logits"]
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Failed to extract output tensor: {}", e))?;

    let logits = output_tensor.1;

    let mut indexed_logits: Vec<(usize, &f32)> = logits.iter().enumerate().collect();
    indexed_logits.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));

    let labels_guard = state.labels.lock().map_err(|e| e.to_string())?;
    let mut predicted_tags = Vec::new();

    for i in 0..10 {
        if let Some(&(idx, _val)) = indexed_logits.get(i) {
            if let Some(label) = labels_guard.get(idx) {
                let clean_label = label
                    .split(',')
                    .next()
                    .unwrap_or(label.as_str())
                    .trim()
                    .to_string();
                predicted_tags.push(clean_label);
            }
        }
    }

    Ok(predicted_tags)
}

// Tauri Command: Select folder using a native directory picker
#[tauri::command]
pub fn select_folder() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Folder to Scan")
        .pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

fn last_folder_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("last_folder.txt"))
}

// Tauri Command: Returns the folder to open on startup — last used folder if it still exists,
// otherwise the user's home directory.
#[tauri::command]
pub fn get_initial_folder(app: AppHandle) -> String {
    if let Some(file) = last_folder_file(&app) {
        if let Ok(saved) = fs::read_to_string(&file) {
            let saved = saved.trim().to_string();
            if !saved.is_empty() && Path::new(&saved).is_dir() {
                return saved;
            }
        }
    }
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

// Tauri Command: Persists the last opened folder path so it can be restored on next launch.
#[tauri::command]
pub fn save_last_folder(app: AppHandle, folder_path: String) -> Result<(), String> {
    let file = last_folder_file(&app).ok_or("Cannot resolve app data directory")?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file, &folder_path).map_err(|e| e.to_string())
}

// Tauri Command: Write metadata tags to image file (IPTC / XMP keywords)
#[tauri::command]
pub fn write_image_tags(image_path: String, tags: Vec<String>) -> Result<(), String> {
    let safe_path = resolve_safe_path(&image_path)?;

    for tag in &tags {
        if tag.len() > 256 {
            return Err(format!(
                "Tag '{}...' exceeds the maximum allowed length of 256 characters.",
                &tag[..32.min(tag.len())]
            ));
        }
    }

    let meta = rexiv2::Metadata::new_from_path(&safe_path)
        .map_err(|e| format!("Failed to open image metadata: {}", e))?;

    let tag_refs: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();

    // IPTC is best-effort — not supported by all formats (e.g. PNG)
    let _ = meta.set_tag_multiple_strings("Iptc.Application2.Keywords", &tag_refs);

    // XMP is the universal fallback — propagate failure so the frontend knows
    meta.set_tag_multiple_strings("Xmp.dc.subject", &tag_refs)
        .map_err(|e| format!("Failed to write XMP tags: {}", e))?;

    meta.save_to_file(&safe_path)
        .map_err(|e| format!("Failed to save image metadata: {}", e))?;

    Ok(())
}

#[derive(serde::Serialize, Clone)]
pub struct DepthLevelInfo {
    pub level: usize,
    pub folder_count: usize,
    pub image_count: usize,
}

#[derive(serde::Serialize, Clone)]
pub struct FolderDepthReport {
    pub total_folders: usize,
    pub total_images: usize,
    pub max_depth: usize,
    pub levels: Vec<DepthLevelInfo>,
}

// Tauri Command: Performs structural scan of the directory to analyze subfolders and image densities per nesting depth
#[tauri::command]
pub fn get_folder_depth_analysis(folder_path: String) -> Result<FolderDepthReport, String> {
    let path = resolve_safe_path(&folder_path)?;
    if !path.is_dir() {
        return Err("Path is not a valid directory".to_string());
    }

    let mut max_depth = 0usize;
    let mut level_folders: std::collections::HashMap<usize, usize> =
        std::collections::HashMap::new();
    let mut level_images: std::collections::HashMap<usize, usize> =
        std::collections::HashMap::new();
    level_images.insert(0, 0);

    let walker = WalkDir::new(&path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            // Prune hidden directories entirely (consistent with original behaviour)
            e.depth() == 0 || !e.file_name().to_str().is_some_and(|n| n.starts_with('.'))
        });

    for entry in walker.filter_map(|e| e.ok()) {
        let depth = entry.depth();
        if depth == 0 {
            continue; // root dir itself — not counted
        }
        if entry.file_type().is_dir() {
            *level_folders.entry(depth).or_insert(0) += 1;
            if depth > max_depth {
                max_depth = depth;
            }
        } else if entry.file_type().is_file() && is_supported_image(entry.path()) {
            // A file at walkdir depth D lives inside the folder at depth D-1
            *level_images.entry(depth - 1).or_insert(0) += 1;
        }
    }

    let mut total_folders = 0;
    let mut total_images = 0;
    let mut levels = Vec::new();

    for lvl in 0..=max_depth {
        let f_count = *level_folders.get(&lvl).unwrap_or(&0);
        let img_count = *level_images.get(&lvl).unwrap_or(&0);

        total_folders += f_count;
        total_images += img_count;

        if lvl == 0 || f_count > 0 || img_count > 0 {
            levels.push(DepthLevelInfo {
                level: lvl,
                folder_count: f_count,
                image_count: img_count,
            });
        }
    }

    Ok(FolderDepthReport {
        total_folders,
        total_images,
        max_depth,
        levels,
    })
}

// Tauri Command: Gathers all supported image file paths from the active folder matching the specified depth restriction
#[tauri::command]
pub fn get_recursive_images(
    folder_path: String,
    target_depth: usize,
) -> Result<Vec<ImageFileInfo>, String> {
    let path = resolve_safe_path(&folder_path)?;
    if !path.is_dir() {
        return Err("Path is not a valid directory".to_string());
    }

    // target_depth 0 = root only; walkdir depth 0 = the root dir itself,
    // so files live at walkdir depth 1+. max_depth = target_depth + 1.
    let mut images: Vec<ImageFileInfo> = WalkDir::new(&path)
        .max_depth(target_depth + 1)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            e.depth() == 0 || !e.file_name().to_str().is_some_and(|n| n.starts_with('.'))
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && is_supported_image(e.path()))
        .filter_map(|e| {
            e.file_name().to_str().map(|name| ImageFileInfo {
                path: e.path().to_string_lossy().to_string(),
                name: name.to_string(),
            })
        })
        .collect();

    images.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(images)
}
