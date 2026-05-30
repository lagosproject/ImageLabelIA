import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaggerService } from './services/tagger.service';
import { BatchService } from './services/batch.service';
import type { BatchConfig } from './services/batch.service';
import type { ImageFileInfo } from './models';
import { FolderTreeComponent } from './components/folder-tree/folder-tree.component';
import { ImageGalleryComponent } from './components/image-gallery/image-gallery.component';
import { ImageDetailsComponent } from './components/image-details/image-details.component';
import { BatchConfigModalComponent } from './components/batch-config-modal/batch-config-modal.component';
import type { BatchRunConfig } from './components/batch-config-modal/batch-config-modal.component';
import { BatchReportModalComponent } from './components/batch-report-modal/batch-report-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FolderTreeComponent,
    ImageGalleryComponent,
    ImageDetailsComponent,
    BatchConfigModalComponent,
    BatchReportModalComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  constructor(readonly tagger: TaggerService, readonly batch: BatchService) {}

  folderPath = '';
  subfolders: string[] = [];
  images: ImageFileInfo[] = [];
  scanning = false;
  scanError = '';
  selectedImage: ImageFileInfo | null = null;
  batchError = '';
  showConfigModal = false;
  leftSidebarCollapsed = false;
  rightSidebarCollapsed = false;

  async ngOnInit(): Promise<void> {
    try {
      const initial = await this.tagger.getInitialFolder();
      if (initial) {
        this.folderPath = initial;
        await this.scanFolder();
      }
    } catch {
      // silently ignore — user can still browse manually
    }
  }

  async scanFolder(): Promise<void> {
    if (!this.folderPath.trim()) return;
    this.scanning = true;
    this.scanError = '';
    this.images = [];
    this.subfolders = [];
    this.selectedImage = null;

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
    void this.tagger.saveLastFolder(path).catch(() => {});
    void this.scanFolder();
  }

  navigateToParent(): void {
    if (!this.folderPath) return;
    const parts = this.folderPath.split('/');
    if (parts.length > 2) {
      parts.pop();
      this.folderPath = parts.join('/');
      void this.tagger.saveLastFolder(this.folderPath).catch(() => {});
      void this.scanFolder();
    }
  }

  selectImage(img: ImageFileInfo): void {
    this.selectedImage = img;
  }

  async browseFolder(): Promise<void> {
    try {
      const selected = await this.tagger.selectFolder();
      if (selected) {
        this.folderPath = selected;
        void this.tagger.saveLastFolder(selected).catch(() => {});
        void this.scanFolder();
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

  async onBatchTagClick(): Promise<void> {
    if (this.batch.running) {
      this.batch.cancel();
      return;
    }
    await this.startBatchTagging({ mode: 'append', maxTags: 5, targetDepth: 0 });
  }

  async startBatchTagging(config: BatchRunConfig): Promise<void> {
    this.showConfigModal = false;
    this.batchError = '';
    const batchConfig: BatchConfig = { folderPath: this.folderPath, ...config };
    const error = await this.batch.start(batchConfig);
    if (error) {
      this.batchError = error;
    }
  }

  closeReport(): void {
    this.batch.clearReport();
    void this.scanFolder();
  }
}
