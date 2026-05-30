export interface ImageFileInfo {
  path: string;
  name: string;
}

export interface ExifData {
  make?: string;
  model?: string;
  exposure_time?: string;
  aperture?: string;
  iso?: string;
  date_time?: string;
  focal_length?: string;
}

export interface ImageProcessResult {
  path: string;
  thumbnail: string;
  predicted_tags: string[];
  existing_tags: string[];
  dimensions: [number, number];
  file_size_bytes: number;
  exif: ExifData;
}

export interface ImageMetadata {
  path: string;
  existing_tags: string[];
  dimensions?: [number, number];
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

export type BatchMode = 'append' | 'skip-tagged' | 'overwrite';

export interface BatchReport {
  status: 'Completed' | 'Cancelled';
  total: number;
  processed: number;
  successes: number;
  failures: number;
  tagsAdded: number;
  tagsRemoved: number;
  duration: string;
  errors: { name: string; error: string }[];
}
