import { Injectable } from '@angular/core';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type {
  ImageFileInfo,
  ImageProcessResult,
  ImageMetadata,
  FolderDepthReport,
} from '../models';

@Injectable({ providedIn: 'root' })
export class TaggerService {
  // Session-scoped thumbnail cache: avoids re-decoding the same image on folder re-entry
  private readonly thumbCache = new Map<string, string>();

  // Semaphore: limits concurrent Rust decode threads to avoid frame drops
  private thumbActive = 0;
  private readonly thumbMaxConcurrent = 4;
  private readonly thumbQueue: Array<() => void> = [];

  private acquireThumbSlot(): Promise<void> {
    if (this.thumbActive < this.thumbMaxConcurrent) {
      this.thumbActive++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.thumbQueue.push(() => { this.thumbActive++; resolve(); }));
  }

  private releaseThumbSlot(): void {
    this.thumbActive--;
    this.thumbQueue.shift()?.();
  }

  async getThumbnail(imagePath: string): Promise<string> {
    const cached = this.thumbCache.get(imagePath);
    if (cached) return cached;
    await this.acquireThumbSlot();
    try {
      // Re-check after acquiring slot — another request may have cached it
      const hit = this.thumbCache.get(imagePath);
      if (hit) return hit;
      const thumb = await invoke<string>('get_thumbnail', { imagePath });
      this.thumbCache.set(imagePath, thumb);
      return thumb;
    } finally {
      this.releaseThumbSlot();
    }
  }

  getSubfolders(folderPath: string): Promise<string[]> {
    return invoke<string[]>('get_subfolders', { folderPath });
  }

  getImagesInFolder(folderPath: string): Promise<ImageFileInfo[]> {
    return invoke<ImageFileInfo[]>('get_images_in_folder', { folderPath });
  }

  getImageData(imagePath: string): Promise<ImageProcessResult> {
    return invoke<ImageProcessResult>('get_image_data', { imagePath });
  }

  getImageMetadata(imagePath: string): Promise<ImageMetadata> {
    return invoke<ImageMetadata>('get_image_metadata', { imagePath });
  }

  getImageAiTags(imagePath: string): Promise<string[]> {
    return invoke<string[]>('get_image_ai_tags', { imagePath });
  }

  writeTags(imagePath: string, tags: string[]): Promise<void> {
    return invoke<void>('write_image_tags', { imagePath, tags });
  }

  selectFolder(): Promise<string | null> {
    return invoke<string | null>('select_folder');
  }

  getInitialFolder(): Promise<string> {
    return invoke<string>('get_initial_folder');
  }

  saveLastFolder(folderPath: string): Promise<void> {
    return invoke<void>('save_last_folder', { folderPath });
  }

  getFolderDepthAnalysis(folderPath: string): Promise<FolderDepthReport> {
    return invoke<FolderDepthReport>('get_folder_depth_analysis', { folderPath });
  }

  getRecursiveImages(folderPath: string, targetDepth: number): Promise<ImageFileInfo[]> {
    return invoke<ImageFileInfo[]>('get_recursive_images', { folderPath, targetDepth });
  }

  toAssetUrl(path: string): string {
    if (!path) return '';
    try {
      const isWindows = path.includes(':') || !path.startsWith('/');
      const nativePath = isWindows ? path.replace(/\//g, '\\') : path;
      return convertFileSrc(nativePath);
    } catch {
      return '';
    }
  }
}
