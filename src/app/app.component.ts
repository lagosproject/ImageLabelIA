import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

interface ImageFileInfo {
  path: string;
  name: string;
}

interface ExifData {
  make?: string;
  model?: string;
  exposure_time?: string;
  aperture?: string;
  iso?: string;
  date_time?: string;
  focal_length?: string;
}

interface ImageProcessResult {
  path: string;
  thumbnail: string;
  predicted_tags: string[];
  existing_tags: string[];
  dimensions: [number, number];
  file_size_bytes: number;
  exif: ExifData;
}

export interface DepthLevelInfo {
  level: number;
  folder_count: number;
  image_count: number;
}

export interface FolderDepthReport {
  total_folders: number;
  total_images: number;
  max_depth: number;
  levels: DepthLevelInfo[];
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {
  // Folder state
  folderPath: string = "";
  subfolders: string[] = [];
  images: ImageFileInfo[] = [];
  scanning: boolean = false;
  scanError: string = "";

  // Selected image state
  selectedImage: ImageFileInfo | null = null;
  selectedImageData: ImageProcessResult | null = null;
  loadingImageDetails: boolean = false;
  imageLoadError: string = "";

  // Tagging state
  predictedTagsChecked: { [key: string]: boolean } = {};
  customTags: string[] = [];
  customTagInput: string = "";
  savingMetadata: boolean = false;
  saveSuccess: boolean = false;
  saveError: string = "";

  // Batch tagging state
  batchRunning: boolean = false;
  batchCancelRequested: boolean = false;
  batchTotalCount: number = 0;
  batchProcessedCount: number = 0;
  batchProgressPercent: number = 0;
  batchCurrentFileName: string = "";
  batchStartTime: number = 0;
  batchReport: any = null;

  // Auto-tagging custom configuration
  showConfigModal: boolean = false;
  configMaxTags: number = 5;
  configMode: string = "append"; // append | skip-tagged | overwrite
  configTargetDepth: number = 0; // 0 = current level only, 1 = up to depth 1, 999 = recursive all
  depthReport: FolderDepthReport | null = null;
  depthReportLoading: boolean = false;

  // UI / Layout states
  leftSidebarCollapsed: boolean = false;
  rightSidebarCollapsed: boolean = false;
  searchQuery: string = "";
  gridScale: number = 2; // scale from 1 (small) to 4 (large)
  isEditingPath: boolean = false;
  metadataCollapsed: boolean = false;
  existingTagsCollapsed: boolean = false;
  predictedTagsCollapsed: boolean = false;
  customTagsCollapsed: boolean = false;


  ngOnInit() {
    // Attempt to pre-fill a reasonable default workspace path
    this.folderPath = "/home/vant/Documentos/ImageLabelIA/images";
    this.scanFolder();
  }

  // Scan folder for subfolders and images
  async scanFolder() {
    if (!this.folderPath.trim()) return;
    this.scanning = true;
    this.scanError = "";
    this.images = [];
    this.subfolders = [];
    this.selectedImage = null;
    this.selectedImageData = null;

    try {
      // Run both Tauri commands in parallel
      const [subdirs, imgFiles] = await Promise.all([
        invoke<string[]>("get_subfolders", { folderPath: this.folderPath }),
        invoke<ImageFileInfo[]>("get_images_in_folder", { folderPath: this.folderPath }),
      ]);
      
      this.subfolders = subdirs;
      this.images = imgFiles;
    } catch (err: any) {
      this.scanError = err.toString();
    } finally {
      this.scanning = false;
    }
  }

  // Navigate to a subfolder
  navigateToFolder(path: string) {
    this.folderPath = path;
    this.scanFolder();
  }

  // Navigate to parent folder
  navigateToParent() {
    if (!this.folderPath) return;
    // Simple path split to get parent
    const parts = this.folderPath.split("/");
    if (parts.length > 2) {
      parts.pop();
      this.folderPath = parts.join("/");
      this.scanFolder();
    }
  }

  // Select an image to preview and tag
  async selectImage(img: ImageFileInfo) {
    this.selectedImage = img;
    this.selectedImageData = null;
    this.loadingImageDetails = true;
    this.imageLoadError = "";
    this.customTags = [];
    this.customTagInput = "";
    this.saveSuccess = false;
    this.saveError = "";

    try {
      const data = await invoke<ImageProcessResult>("get_image_data", { imagePath: img.path });
      this.selectedImageData = data;
      
      // Initialize checkboxes to true for predicted tags
      this.predictedTagsChecked = {};
      for (const tag of data.predicted_tags) {
        this.predictedTagsChecked[tag] = true;
      }
    } catch (err: any) {
      this.imageLoadError = err.toString();
    } finally {
      this.loadingImageDetails = false;
    }
  }

  // Add custom tags
  addCustomTags() {
    if (!this.customTagInput.trim()) return;
    
    // Split by comma or spaces
    const newTags = this.customTagInput
      .split(/[,;\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    for (const tag of newTags) {
      // Avoid duplicates
      if (
        !this.customTags.includes(tag) && 
        !this.selectedImageData?.existing_tags.includes(tag)
      ) {
        this.customTags.push(tag);
      }
    }
    this.customTagInput = "";
  }

  // Remove a custom tag from list
  removeCustomTag(tag: string) {
    this.customTags = this.customTags.filter(t => t !== tag);
  }

  // Toggle predicted tag checkbox
  togglePredictedTag(tag: string) {
    this.predictedTagsChecked[tag] = !this.predictedTagsChecked[tag];
  }

  // Save tags back to image file metadata
  async saveTags() {
    if (!this.selectedImage || !this.selectedImageData) return;
    
    this.savingMetadata = true;
    this.saveError = "";
    this.saveSuccess = false;

    // Collect all checked predicted tags
    const activePredicted = Object.keys(this.predictedTagsChecked).filter(
      tag => this.predictedTagsChecked[tag]
    );

    // Merge existing + active predicted + custom tags
    const allTags = [
      ...this.selectedImageData.existing_tags,
      ...activePredicted,
      ...this.customTags
    ];

    // Remove duplicates and keep lowercase/clean
    const uniqueTags = Array.from(new Set(allTags.map(t => t.trim())));

    try {
      await invoke("write_image_tags", {
        imagePath: this.selectedImage.path,
        tags: uniqueTags
      });

      this.saveSuccess = true;
      
      // Refresh the image data to display updated existing tags
      if (this.selectedImage) {
        const updatedData = await invoke<ImageProcessResult>("get_image_data", { 
          imagePath: this.selectedImage.path 
        });
        this.selectedImageData = updatedData;
        this.customTags = []; // Reset custom tags as they are now in existing_tags
      }
    } catch (err: any) {
      this.saveError = err.toString();
    } finally {
      this.savingMetadata = false;
    }
  }

  // Helper to get folder name from full path
  getFolderName(fullPath: string): string {
    const parts = fullPath.split("/");
    return parts[parts.length - 1] || fullPath;
  }

  // Convert a local file path to a URL that Tauri's asset protocol can load
  getImageUrl(path: string): string {
    if (!path) return "";
    try {
      return convertFileSrc(path);
    } catch (e) {
      console.error("Error converting file source:", e);
      return "";
    }
  }

  // Open native directory selection dialog via Tauri backend command
  async browseFolder() {
    try {
      const selected = await invoke<string | null>("select_folder");
      if (selected) {
        this.folderPath = selected;
        this.scanFolder();
      }
    } catch (err: any) {
      console.error("Error browsing folder:", err);
      this.scanError = "Failed to open folder selector: " + err.toString();
    }
  }

  // Toggle collapsing state of panels
  toggleLeftSidebar() {
    this.leftSidebarCollapsed = !this.leftSidebarCollapsed;
  }

  toggleRightSidebar() {
    this.rightSidebarCollapsed = !this.rightSidebarCollapsed;
  }

  // Filter gallery images by filename search query
  get filteredImages(): ImageFileInfo[] {
    if (!this.searchQuery.trim()) {
      return this.images;
    }
    const query = this.searchQuery.toLowerCase().trim();
    return this.images.filter(img => img.name.toLowerCase().includes(query));
  }

  // Format file size in bytes to human-readable string
  formatBytes(bytes: number, decimals = 1): string {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  // Get directory breadcrumb segments for the button path navigation
  get pathSegments(): { name: string; fullPath: string }[] {
    if (!this.folderPath) return [];
    
    const parts = this.folderPath.split(/[/\\]/).filter(p => p.length > 0);
    const segments: { name: string; fullPath: string }[] = [];
    
    let currentAccumulator = "";
    for (const part of parts) {
      currentAccumulator += "/" + part;
      segments.push({
        name: part,
        fullPath: currentAccumulator
      });
    }
    return segments;
  }

  // Toggle breadcrumbs vs text input view for path
  toggleEditPath() {
    this.isEditingPath = !this.isEditingPath;
    if (this.isEditingPath) {
      setTimeout(() => {
        const inputEl = document.querySelector(".input-wrapper input") as HTMLInputElement;
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
      }, 50);
    }
  }

  // Handle clicking the Auto-Tag button
  async onBatchTagClick() {
    if (this.batchRunning) {
      this.batchCancelRequested = true;
      return;
    }
    await this.startBatchTagging();
  }

  // Generate dynamic background gradient for the progress bar button
  getBatchProgressGradient(): string {
    if (!this.batchRunning) {
      return "";
    }
    const percent = this.batchProgressPercent;
    return `linear-gradient(to right, #8b5cf6 0%, #6366f1 ${percent}%, rgba(255, 255, 255, 0.08) ${percent}%, rgba(255, 255, 255, 0.08) 100%)`;
  }

  // Run batch auto-tagging
  async startBatchTagging() {
    this.batchRunning = true;
    this.batchCancelRequested = false;
    this.batchProcessedCount = 0;
    this.batchProgressPercent = 0;
    this.batchCurrentFileName = "";
    this.batchStartTime = Date.now();
    this.batchReport = null;

    let imagesToProcess: ImageFileInfo[] = [];
    try {
      imagesToProcess = await invoke<ImageFileInfo[]>("get_recursive_images", {
        folderPath: this.folderPath,
        targetDepth: this.configTargetDepth
      });
    } catch (err: any) {
      this.batchRunning = false;
      alert("Failed to read folder contents: " + err.toString());
      return;
    }

    if (imagesToProcess.length === 0) {
      this.batchRunning = false;
      alert("No images found in the selected folder depth.");
      return;
    }

    this.batchTotalCount = imagesToProcess.length;
    let successCount = 0;
    let errorCount = 0;
    let totalTagsAdded = 0;
    const errorsList: { name: string; error: string }[] = [];

    for (const img of imagesToProcess) {
      if (this.batchCancelRequested) {
        break;
      }

      this.batchCurrentFileName = img.name;
      this.batchProgressPercent = Math.round((this.batchProcessedCount / this.batchTotalCount) * 100);

      try {
        // 1. Get image predictions and existing keywords
        const data = await invoke<ImageProcessResult>("get_image_data", { imagePath: img.path });
        
        // Respect Strategy: "skip-tagged"
        if (this.configMode === 'skip-tagged' && data.existing_tags.length > 0) {
          this.batchProcessedCount++;
          this.batchProgressPercent = Math.round((this.batchProcessedCount / this.batchTotalCount) * 100);
          continue;
        }

        // 2. Select top predicted tags based on configMaxTags setting
        const tagsToAutoAdd = data.predicted_tags.slice(0, this.configMaxTags);
        
        // Merge based on configMode strategy
        let mergedTags: string[] = [];
        if (this.configMode === 'overwrite') {
          mergedTags = Array.from(new Set(tagsToAutoAdd.map(t => t.trim())));
        } else {
          mergedTags = Array.from(new Set([
            ...data.existing_tags,
            ...tagsToAutoAdd
          ].map(t => t.trim())));
        }

        const newTagsAdded = mergedTags.length - (this.configMode === 'overwrite' ? 0 : data.existing_tags.length);

        // 3. Write merged tags back to the file
        await invoke("write_image_tags", {
          imagePath: img.path,
          tags: mergedTags
        });

        successCount++;
        totalTagsAdded += newTagsAdded;

        // Visual feedback: if this image is currently selected, refresh its details view
        if (this.selectedImage && this.selectedImage.path === img.path) {
          this.selectedImageData = {
            ...data,
            existing_tags: mergedTags
          };
          this.customTags = [];
        }

      } catch (err: any) {
        errorCount++;
        errorsList.push({ name: img.name, error: err.toString() });
      }

      this.batchProcessedCount++;
      this.batchProgressPercent = Math.round((this.batchProcessedCount / this.batchTotalCount) * 100);
    }

    const durationSeconds = ((Date.now() - this.batchStartTime) / 1000).toFixed(1);
    this.batchRunning = false;
    
    // Set report results to display modal
    this.batchReport = {
      status: this.batchCancelRequested ? "Cancelled" : "Completed",
      total: this.batchTotalCount,
      processed: this.batchProcessedCount,
      successes: successCount,
      failures: errorCount,
      tagsAdded: totalTagsAdded,
      duration: durationSeconds,
      errors: errorsList
    };
  }

  // Close report modal
  closeReport() {
    this.batchReport = null;
    // Scan folder again to refresh any tag/metadata badges in the gallery cards if they exist
    this.scanFolder();
  }

  // Config Modal actions
  openConfigModal() {
    this.showConfigModal = true;
    this.depthReport = null;
    this.depthReportLoading = false;
  }

  closeConfigModal() {
    this.showConfigModal = false;
    this.depthReport = null;
  }

  async analyzeFolderDepth() {
    this.depthReportLoading = true;
    this.depthReport = null;
    try {
      this.depthReport = await invoke<FolderDepthReport>("get_folder_depth_analysis", {
        folderPath: this.folderPath
      });
    } catch (err: any) {
      console.error("Folder depth analysis failed:", err);
      alert("Failed to analyze directory depth: " + err.toString());
    } finally {
      this.depthReportLoading = false;
    }
  }

  async runBatchWithConfig() {
    this.showConfigModal = false;
    await this.startBatchTagging();
  }
}

