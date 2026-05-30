import { Injectable } from '@angular/core';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type {
  ImageFileInfo,
  ImageProcessResult,
  FolderDepthReport,
} from '../models';

@Injectable({ providedIn: 'root' })
export class TaggerService {
  getSubfolders(folderPath: string): Promise<string[]> {
    return invoke<string[]>('get_subfolders', { folderPath });
  }

  getImagesInFolder(folderPath: string): Promise<ImageFileInfo[]> {
    return invoke<ImageFileInfo[]>('get_images_in_folder', { folderPath });
  }

  getImageData(imagePath: string): Promise<ImageProcessResult> {
    return invoke<ImageProcessResult>('get_image_data', { imagePath });
  }

  writeTags(imagePath: string, tags: string[]): Promise<void> {
    return invoke<void>('write_image_tags', { imagePath, tags });
  }

  selectFolder(): Promise<string | null> {
    return invoke<string | null>('select_folder');
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
      return convertFileSrc(path);
    } catch {
      return '';
    }
  }
}
