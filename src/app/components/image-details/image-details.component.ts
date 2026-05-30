import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TaggerService } from '../../services/tagger.service';
import { BatchService } from '../../services/batch.service';
import type { ImageFileInfo, ImageMetadata } from '../../models';

@Component({
  selector: 'app-image-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-details.component.html',
  styles: [':host { display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 0; }'],
})
export class ImageDetailsComponent implements OnInit, OnDestroy {
  private _selectedImage: ImageFileInfo | null = null;

  @Input()
  set selectedImage(img: ImageFileInfo | null) {
    if (img?.path === this._selectedImage?.path) return;
    this._selectedImage = img;
    void this.loadImageData(img);
  }
  get selectedImage(): ImageFileInfo | null {
    return this._selectedImage;
  }

  @Output() readonly collapse = new EventEmitter<void>();

  imageMetadata: ImageMetadata | null = null;
  loadingMetadata = false;
  loadingAiTags = false;
  imageLoadError = '';
  predictedTags: string[] = [];
  predictedTagsChecked: Record<string, boolean> = {};
  customTags: string[] = [];
  customTagInput = '';
  savingMetadata = false;
  saveSuccess = false;
  saveError = '';
  metadataCollapsed = false;
  existingTagsCollapsed = false;
  predictedTagsCollapsed = false;
  customTagsCollapsed = false;

  private batchSub!: Subscription;

  constructor(
    readonly tagger: TaggerService,
    private readonly batch: BatchService,
  ) {}

  ngOnInit(): void {
    this.batchSub = this.batch.imageUpdated$.subscribe(({ imagePath, mergedTags }) => {
      if (this._selectedImage?.path === imagePath && this.imageMetadata) {
        this.imageMetadata = { ...this.imageMetadata, existing_tags: mergedTags };
        this.customTags = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.batchSub?.unsubscribe();
  }

  private async loadImageData(img: ImageFileInfo | null): Promise<void> {
    if (!img) {
      this.imageMetadata = null;
      this.predictedTags = [];
      return;
    }

    this.imageMetadata = null;
    this.predictedTags = [];
    this.predictedTagsChecked = {};
    this.loadingMetadata = true;
    this.loadingAiTags = true;
    this.imageLoadError = '';
    this.customTags = [];
    this.customTagInput = '';
    this.saveSuccess = false;
    this.saveError = '';

    // Step 1: fast path — load file metadata and EXIF only
    try {
      const meta = await this.tagger.getImageMetadata(img.path);
      this.imageMetadata = meta;
    } catch (err: any) {
      this.imageLoadError = err.toString();
      this.loadingMetadata = false;
      this.loadingAiTags = false;
      return;
    } finally {
      this.loadingMetadata = false;
    }

    // Step 2: slow path — AI inference; spinner shown only in AI section
    const pathAtStart = img.path;
    try {
      const tags = await this.tagger.getImageAiTags(img.path);
      // Guard against stale response if user switched image while inferring
      if (this._selectedImage?.path === pathAtStart) {
        this.predictedTags = tags;
        this.predictedTagsChecked = {};
        for (const tag of tags) {
          this.predictedTagsChecked[tag] = true;
        }
      }
    } catch (err: any) {
      if (this._selectedImage?.path === pathAtStart) {
        this.imageLoadError = err.toString();
      }
    } finally {
      if (this._selectedImage?.path === pathAtStart) {
        this.loadingAiTags = false;
      }
    }
  }

  addCustomTags(): void {
    if (!this.customTagInput.trim()) return;
    const newTags = this.customTagInput
      .split(/[,;\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    for (const tag of newTags) {
      if (!this.customTags.includes(tag) && !this.imageMetadata?.existing_tags.includes(tag)) {
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
    if (!this._selectedImage || !this.imageMetadata) return;
    this.savingMetadata = true;
    this.saveError = '';
    this.saveSuccess = false;

    const activePredicted = Object.keys(this.predictedTagsChecked).filter(
      tag => this.predictedTagsChecked[tag],
    );
    const allTags = [
      ...this.imageMetadata.existing_tags,
      ...activePredicted,
      ...this.customTags,
    ];
    const uniqueTags = Array.from(new Set(allTags.map(t => t.trim())));

    try {
      await this.tagger.writeTags(this._selectedImage.path, uniqueTags);
      this.saveSuccess = true;
      const updatedMeta = await this.tagger.getImageMetadata(this._selectedImage.path);
      this.imageMetadata = updatedMeta;
      this.customTags = [];
    } catch (err: any) {
      this.saveError = err.toString();
    } finally {
      this.savingMetadata = false;
    }
  }

  formatBytes(bytes: number, decimals = 1): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + sizes[i];
  }

  getImageUrl(path: string): string {
    return this.tagger.toAssetUrl(path);
  }
}
