import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { TaggerService } from './tagger.service';
import type { ImageFileInfo, BatchMode, BatchReport } from '../models';

export interface BatchConfig {
  folderPath: string;
  mode: BatchMode;
  maxTags: number;
  targetDepth: number;
}

export interface ImageUpdateEvent {
  imagePath: string;
  mergedTags: string[];
}

@Injectable({ providedIn: 'root' })
export class BatchService {
  running = false;
  cancelRequested = false;
  totalCount = 0;
  processedCount = 0;
  progressPercent = 0;
  currentFileName = '';
  report: BatchReport | null = null;

  private readonly imageUpdatedSource = new Subject<ImageUpdateEvent>();
  readonly imageUpdated$ = this.imageUpdatedSource.asObservable();

  constructor(private tagger: TaggerService) {}

  cancel(): void {
    this.cancelRequested = true;
  }

  clearReport(): void {
    this.report = null;
  }

  getProgressGradient(): string {
    if (!this.running) return '';
    const p = this.progressPercent;
    return `linear-gradient(to right, #8b5cf6 0%, #6366f1 ${p}%, rgba(255, 255, 255, 0.08) ${p}%, rgba(255, 255, 255, 0.08) 100%)`;
  }

  /** Returns null on success, or an error string if the batch could not start. */
  async start(config: BatchConfig): Promise<string | null> {
    this.running = true;
    this.cancelRequested = false;
    this.processedCount = 0;
    this.progressPercent = 0;
    this.currentFileName = '';
    this.report = null;
    const startTime = Date.now();

    let imagesToProcess: ImageFileInfo[];
    try {
      imagesToProcess = await this.tagger.getRecursiveImages(config.folderPath, config.targetDepth);
    } catch (err: any) {
      this.running = false;
      return 'Failed to read folder contents: ' + err.toString();
    }

    if (imagesToProcess.length === 0) {
      this.running = false;
      return 'No images found in the selected folder depth.';
    }

    this.totalCount = imagesToProcess.length;
    let successCount = 0;
    let errorCount = 0;
    let totalTagsAdded = 0;
    let totalTagsRemoved = 0;
    const errorsList: { name: string; error: string }[] = [];

    for (const img of imagesToProcess) {
      if (this.cancelRequested) break;

      this.currentFileName = img.name;
      this.progressPercent = Math.round((this.processedCount / this.totalCount) * 100);

      try {
        const data = await this.tagger.getImageData(img.path);

        if (config.mode === 'skip-tagged' && data.existing_tags.length > 0) {
          this.processedCount++;
          this.progressPercent = Math.round((this.processedCount / this.totalCount) * 100);
          continue;
        }

        const tagsToAutoAdd = data.predicted_tags.slice(0, config.maxTags);

        let mergedTags: string[];
        if (config.mode === 'overwrite') {
          mergedTags = Array.from(new Set(tagsToAutoAdd.map(t => t.trim())));
        } else {
          mergedTags = Array.from(
            new Set([...data.existing_tags, ...tagsToAutoAdd].map(t => t.trim()))
          );
        }

        const added = Math.max(0, mergedTags.length - data.existing_tags.length);
        const removed = Math.max(0, data.existing_tags.length - mergedTags.length);

        await this.tagger.writeTags(img.path, mergedTags);

        successCount++;
        totalTagsAdded += added;
        totalTagsRemoved += removed;

        this.imageUpdatedSource.next({ imagePath: img.path, mergedTags });

      } catch (err: any) {
        errorCount++;
        errorsList.push({ name: img.name, error: err.toString() });
      }

      this.processedCount++;
      this.progressPercent = Math.round((this.processedCount / this.totalCount) * 100);
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    this.running = false;

    this.report = {
      status: this.cancelRequested ? 'Cancelled' : 'Completed',
      total: this.totalCount,
      processed: this.processedCount,
      successes: successCount,
      failures: errorCount,
      tagsAdded: totalTagsAdded,
      tagsRemoved: totalTagsRemoved,
      duration: durationSeconds,
      errors: errorsList,
    };

    return null;
  }
}
