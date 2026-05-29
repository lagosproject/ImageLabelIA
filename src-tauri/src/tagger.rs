use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use ort::session::Session;
use image::{DynamicImage, ImageFormat};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Serialize, Deserialize};

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

#[derive(Serialize, Deserialize, Clone)]
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
    println!("Loading ConvNeXt ONNX session from: {}...", model_path.display());
    let session = Session::builder()
        .map_err(|e| e.to_string())?
        .commit_from_file(model_path)
        .map_err(|e| format!("Failed to initialize ONNX session: {}", e))?;

    *session_guard = Some(session);
    *labels_guard = labels;

    println!("ConvNeXt model and labels loaded successfully!");
    Ok(())
}

// Image preprocessing for ConvNeXt (Resize, Normalize, flat NCHW vector)
fn preprocess_image(path: &str) -> Result<(Vec<f32>, DynamicImage), String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    let resized = img.resize_exact(224, 224, image::imageops::FilterType::Triangle);
    let rgb = resized.to_rgb8();

    let mut input = vec![0.0f32; 3 * 224 * 224];

    // ImageNet mean and standard deviation
    let mean = [0.485, 0.456, 0.406];
    let std = [0.229, 0.224, 0.225];

    for (x, y, pixel) in rgb.enumerate_pixels() {
        let r = (pixel[0] as f32 / 255.0 - mean[0]) / std[0];
        let g = (pixel[1] as f32 / 255.0 - mean[1]) / std[1];
        let b = (pixel[2] as f32 / 255.0 - mean[2]) / std[2];

        let idx = (y as usize) * 224 + (x as usize);
        input[idx] = r;
        input[50176 + idx] = g;
        input[100352 + idx] = b;
    }

    Ok((input, img))
}

// Generate base64 thumbnail of the image for local preview
fn get_thumbnail_base64(img: &DynamicImage) -> String {
    let thumbnail = img.thumbnail(256, 256);
    let mut buffer = Cursor::new(Vec::new());
    if thumbnail.write_to(&mut buffer, ImageFormat::Jpeg).is_ok() {
        let base64_str = STANDARD.encode(buffer.into_inner());
        format!("data:image/jpeg;base64,{}", base64_str)
    } else {
        "".to_string()
    }
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
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    let mut subfolders = Vec::new();
    if let Ok(entries) = fs::read_dir(path) {
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

// Tauri Command: Get image files inside a folder (for the gallery)
#[tauri::command]
pub fn get_images_in_folder(folder_path: String) -> Result<Vec<ImageFileInfo>, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    let mut images = Vec::new();
    if let Ok(entries) = fs::read_dir(path) {
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
    // 1. Ensure model is loaded
    load_model_if_needed(&app, &state)?;

    // 2. Preprocess image and get dimensions
    let (input, img) = preprocess_image(&image_path)?;
    let dimensions = (img.width(), img.height());

    // 3. Generate base64 thumbnail
    let thumbnail = get_thumbnail_base64(&img);

    // 4. Read file size and EXIF metadata using rexiv2
    let file_size_bytes = fs::metadata(&image_path).map(|m| m.len()).unwrap_or(0);
    
    let (existing_tags, exif) = match rexiv2::Metadata::new_from_path(&image_path) {
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
                date_time: meta.get_tag_string("Exif.Photo.DateTimeOriginal")
                    .ok()
                    .or_else(|| meta.get_tag_string("Exif.Image.DateTime").ok()),
                focal_length: meta.get_tag_string("Exif.Photo.FocalLength").ok(),
            };

            (tags, exif_data)
        }
        Err(_) => {
            let exif_data = ExifData {
                make: None,
                model: None,
                exposure_time: None,
                aperture: None,
                iso: None,
                date_time: None,
                focal_length: None,
            };
            (Vec::new(), exif_data)
        }
    };

    // 5. Run ONNX Inference
    let mut session_guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = session_guard.as_mut().ok_or("ONNX session not initialized")?;

    let shape = [1usize, 3, 224, 224];
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
                let clean_label = label.split(',').next().unwrap_or(label.as_str()).trim().to_string();
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

// Tauri Command: Select folder using a native directory picker
#[tauri::command]
pub fn select_folder() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Folder to Scan")
        .pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}


// Tauri Command: Write metadata tags to image file (IPTC / XMP keywords)
#[tauri::command]
pub fn write_image_tags(image_path: String, tags: Vec<String>) -> Result<(), String> {
    let meta = rexiv2::Metadata::new_from_path(&image_path)
        .map_err(|e| format!("Failed to open image metadata: {}", e))?;

    let tag_refs: Vec<&str> = tags.iter().map(|s| s.as_str()).collect();

    // Write to IPTC keywords
    let _ = meta.set_tag_multiple_strings("Iptc.Application2.Keywords", &tag_refs);

    // Write to XMP Subject
    let _ = meta.set_tag_multiple_strings("Xmp.dc.subject", &tag_refs);

    meta.save_to_file(&image_path)
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

fn traverse_folder(
    current_path: &Path,
    current_depth: usize,
    max_depth: &mut usize,
    level_folders: &mut std::collections::HashMap<usize, usize>,
    level_images: &mut std::collections::HashMap<usize, usize>,
) {
    if current_depth > *max_depth {
        *max_depth = current_depth;
    }

    if let Ok(entries) = fs::read_dir(current_path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    if !name.starts_with('.') {
                        let next_depth = current_depth + 1;
                        *level_folders.entry(next_depth).or_insert(0) += 1;
                        traverse_folder(&entry_path, next_depth, max_depth, level_folders, level_images);
                    }
                }
            } else if entry_path.is_file() && is_supported_image(&entry_path) {
                *level_images.entry(current_depth).or_insert(0) += 1;
            }
        }
    }
}

// Tauri Command: Performs structural scan of the directory to analyze subfolders and image densities per nesting depth
#[tauri::command]
pub fn get_folder_depth_analysis(folder_path: String) -> Result<FolderDepthReport, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    let mut max_depth = 0;
    let mut level_folders = std::collections::HashMap::new();
    let mut level_images = std::collections::HashMap::new();

    // Initialize root count
    level_images.insert(0, 0);

    traverse_folder(path, 0, &mut max_depth, &mut level_folders, &mut level_images);

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

fn collect_images_recursive(
    current_path: &Path,
    current_depth: usize,
    target_depth: usize,
    images: &mut Vec<ImageFileInfo>,
) {
    if let Ok(entries) = fs::read_dir(current_path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() && is_supported_image(&entry_path) {
                if let Some(name) = entry.file_name().to_str() {
                    images.push(ImageFileInfo {
                        path: entry_path.to_string_lossy().to_string(),
                        name: name.to_string(),
                    });
                }
            } else if entry_path.is_dir() && current_depth < target_depth {
                if let Some(name) = entry.file_name().to_str() {
                    if !name.starts_with('.') {
                        collect_images_recursive(&entry_path, current_depth + 1, target_depth, images);
                    }
                }
            }
        }
    }
}

// Tauri Command: Gathers all supported image file paths from the active folder matching the specified depth restriction
#[tauri::command]
pub fn get_recursive_images(folder_path: String, target_depth: usize) -> Result<Vec<ImageFileInfo>, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    let mut images = Vec::new();
    collect_images_recursive(path, 0, target_depth, &mut images);
    images.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(images)
}
