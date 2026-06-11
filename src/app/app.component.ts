import { Component, OnInit, ViewEncapsulation, HostListener } from '@angular/core';
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

  leftSidebarWidth = 260;
  rightSidebarWidth = 360;
  private isResizingLeft = false;
  private isResizingRight = false;

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
    const normalized = this.folderPath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.length > 1) {
      parts.pop();
      let parentPath = parts.join('/');
      // If it ends up as a drive letter on Windows (e.g. "C:"), append a trailing slash
      if (parentPath.match(/^[A-Za-z]:$/)) {
        parentPath += '/';
      }
      this.folderPath = parentPath;
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

  onLeftMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isResizingLeft = true;
  }

  onRightMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isResizingRight = true;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isResizingLeft) {
      const newWidth = event.clientX;
      if (newWidth >= 180 && newWidth <= 500) {
        this.leftSidebarWidth = newWidth;
      }
    } else if (this.isResizingRight) {
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth >= 250 && newWidth <= 600) {
        this.rightSidebarWidth = newWidth;
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isResizingLeft = false;
    this.isResizingRight = false;
  }

  get pathSegments(): { name: string; fullPath: string }[] {
    if (!this.folderPath) return [];
    const normalized = this.folderPath.replace(/\\/g, '/');
    const isWindowsAbsolute = /^[A-Za-z]:/.test(normalized);
    const parts = normalized.split('/').filter(p => p.length > 0);
    const segments: { name: string; fullPath: string }[] = [];
    let current = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === 0) {
        if (isWindowsAbsolute) {
          current = part + '/';
        } else {
          current = '/' + part;
        }
      } else {
        if (current && !current.endsWith('/')) {
          current += '/';
        }
        current += part;
      }
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
