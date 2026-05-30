import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TaggerService } from './services/tagger.service';
import { BatchService } from './services/batch.service';
import type {
  ImageFileInfo,
  ImageProcessResult,
  FolderDepthReport,
  BatchMode,
} from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('pathInput') pathInputRef!: ElementRef<HTMLInputElement>;

  constructor(
    readonly tagger: TaggerService,
    readonly batch: BatchService,
  ) {}

  // Folder state
  folderPath = '';
  subfolders: string[] = [];
  images: ImageFileInfo[] = [];
  scanning = false;
  scanError = '';

  // Selected image state
  selectedImage: ImageFileInfo | null = null;
  selectedImageData: ImageProcessResult | null = null;
  loadingImageDetails = false;
  imageLoadError = '';

  // Tagging state
  predictedTagsChecked: Record<string, boolean> = {};
  customTags: string[] = [];
  customTagInput = '';
  savingMetadata = false;
  saveSuccess = false;
  saveError = '';

  // Batch error (surfaced inline instead of alert())
  batchError = '';

  // Auto-tagging configuration
  showConfigModal = false;
  configMaxTags = 5;
  configMode: BatchMode = 'append';
  configTargetDepth = 0;
  depthReport: FolderDepthReport | null = null;
  depthReportLoading = false;

  // UI layout state
  leftSidebarCollapsed = false;
  rightSidebarCollapsed = false;
  searchQuery = '';
  gridScale = 2;
  isEditingPath = false;
  metadataCollapsed = false;
  existingTagsCollapsed = false;
  predictedTagsCollapsed = false;
  customTagsCollapsed = false;

  private batchImageSub!: Subscription;

  ngOnInit(): void {
    this.batchImageSub = this.batch.imageUpdated$.subscribe(({ imagePath, mergedTags }) => {
      if (this.selectedImage?.path === imagePath && this.selectedImageData) {
        this.selectedImageData = { ...this.selectedImageData, existing_tags: mergedTags };
        this.customTags = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.batchImageSub?.unsubscribe();
  }

  async scanFolder(): Promise<void> {
    if (!this.folderPath.trim()) return;
    this.scanning = true;
    this.scanError = '';
    this.images = [];
    this.subfolders = [];
    this.selectedImage = null;
    this.selectedImageData = null;

    try {
      const [subdirs, imgFiles] = await Promise.all([
        this.tagger.getSubfolders(this.folderPath),
        this.tagger.getImagesInFolder(this.folderPath),
      ]);
      this.subfolders = subdirs;
      this.images = imgFiles;
    } catch (err: any) {
      this.scanError = err.toString();
    } finally {
      this.scanning = false;
    }
  }

  navigateToFolder(path: string): void {
    this.folderPath = path;
    this.scanFolder();
  }

  navigateToParent(): void {
    if (!this.folderPath) return;
    const parts = this.folderPath.split('/');
    if (parts.length > 2) {
      parts.pop();
      this.folderPath = parts.join('/');
      this.scanFolder();
    }
  }

  async selectImage(img: ImageFileInfo): Promise<void> {
    this.selectedImage = img;
    this.selectedImageData = null;
    this.loadingImageDetails = true;
    this.imageLoadError = '';
    this.customTags = [];
    this.customTagInput = '';
    this.saveSuccess = false;
    this.saveError = '';

    try {
      const data = await this.tagger.getImageData(img.path);
      this.selectedImageData = data;
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

  addCustomTags(): void {
    if (!this.customTagInput.trim()) return;
    // Split by comma, semicolon, or newline (spaces are preserved — tags can be multi-word)
    const newTags = this.customTagInput
      .split(/[,;\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    for (const tag of newTags) {
      if (
        !this.customTags.includes(tag) &&
        !this.selectedImageData?.existing_tags.includes(tag)
      ) {
        this.customTags.push(tag);
      }
    }
    this.customTagInput = '';
  }

  removeCustomTag(tag: string): void {
    this.customTags = this.customTags.filter(t => t !== tag);
  }

  togglePredictedTag(tag: string): void {
    this.predictedTagsChecked[tag] = !this.predictedTagsChecked[tag];
  }

  async saveTags(): Promise<void> {
    if (!this.selectedImage || !this.selectedImageData) return;
    this.savingMetadata = true;
    this.saveError = '';
    this.saveSuccess = false;

    const activePredicted = Object.keys(this.predictedTagsChecked).filter(
      tag => this.predictedTagsChecked[tag],
    );
    const allTags = [
      ...this.selectedImageData.existing_tags,
      ...activePredicted,
      ...this.customTags,
    ];
    const uniqueTags = Array.from(new Set(allTags.map(t => t.trim())));

    try {
      await this.tagger.writeTags(this.selectedImage.path, uniqueTags);
      this.saveSuccess = true;
      const updatedData = await this.tagger.getImageData(this.selectedImage.path);
      this.selectedImageData = updatedData;
      this.customTags = [];
    } catch (err: any) {
      this.saveError = err.toString();
    } finally {
      this.savingMetadata = false;
    }
  }

  getFolderName(fullPath: string): string {
    const parts = fullPath.split('/');
    return parts[parts.length - 1] || fullPath;
  }

  getImageUrl(path: string): string {
    return this.tagger.toAssetUrl(path);
  }

  async browseFolder(): Promise<void> {
    try {
      const selected = await this.tagger.selectFolder();
      if (selected) {
        this.folderPath = selected;
        this.scanFolder();
      }
    } catch (err: any) {
      this.scanError = 'Failed to open folder selector: ' + err.toString();
    }
  }

  toggleLeftSidebar(): void {
    this.leftSidebarCollapsed = !this.leftSidebarCollapsed;
  }

  toggleRightSidebar(): void {
    this.rightSidebarCollapsed = !this.rightSidebarCollapsed;
  }

  get filteredImages(): ImageFileInfo[] {
    if (!this.searchQuery.trim()) return this.images;
    const query = this.searchQuery.toLowerCase().trim();
    return this.images.filter(img => img.name.toLowerCase().includes(query));
  }

  trackByImagePath(_index: number, img: ImageFileInfo): string {
    return img.path;
  }

  formatBytes(bytes: number, decimals = 1): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + sizes[i];
  }

  get pathSegments(): { name: string; fullPath: string }[] {
    if (!this.folderPath) return [];
    const parts = this.folderPath.split(/[/\\]/).filter(p => p.length > 0);
    const segments: { name: string; fullPath: string }[] = [];
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      segments.push({ name: part, fullPath: current });
    }
    return segments;
  }

  toggleEditPath(): void {
    this.isEditingPath = !this.isEditingPath;
    if (this.isEditingPath) {
      setTimeout(() => {
        this.pathInputRef?.nativeElement.focus();
        this.pathInputRef?.nativeElement.select();
      }, 50);
    }
  }

  async onBatchTagClick(): Promise<void> {
    if (this.batch.running) {
      this.batch.cancel();
      return;
    }
    await this.startBatchTagging();
  }

  async startBatchTagging(): Promise<void> {
    this.batchError = '';
    const error = await this.batch.start({
      folderPath: this.folderPath,
      mode: this.configMode,
      maxTags: this.configMaxTags,
      targetDepth: this.configTargetDepth,
    });
    if (error) {
      this.batchError = error;
    }
  }

  closeReport(): void {
    this.batch.clearReport();
    this.scanFolder();
  }

  openConfigModal(): void {
    this.showConfigModal = true;
    this.depthReport = null;
    this.depthReportLoading = false;
  }

  closeConfigModal(): void {
    this.showConfigModal = false;
    this.depthReport = null;
  }

  async analyzeFolderDepth(): Promise<void> {
    this.depthReportLoading = true;
    this.depthReport = null;
    try {
      this.depthReport = await this.tagger.getFolderDepthAnalysis(this.folderPath);
    } catch (err: any) {
      this.scanError = 'Failed to analyze directory depth: ' + err.toString();
    } finally {
      this.depthReportLoading = false;
    }
  }

  async runBatchWithConfig(): Promise<void> {
    this.showConfigModal = false;
    await this.startBatchTagging();
  }
}
