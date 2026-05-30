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
import type { ImageFileInfo, ImageProcessResult } from '../../models';

@Component({
  selector: 'app-image-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-details.component.html',
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

  selectedImageData: ImageProcessResult | null = null;
  loadingImageDetails = false;
  imageLoadError = '';
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
      if (this._selectedImage?.path === imagePath && this.selectedImageData) {
        this.selectedImageData = { ...this.selectedImageData, existing_tags: mergedTags };
        this.customTags = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.batchSub?.unsubscribe();
  }

  private async loadImageData(img: ImageFileInfo | null): Promise<void> {
    if (!img) {
      this.selectedImageData = null;
      return;
    }
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
    const newTags = this.customTagInput
      .split(/[,;\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    for (const tag of newTags) {
      if (!this.customTags.includes(tag) && !this.selectedImageData?.existing_tags.includes(tag)) {
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
    if (!this._selectedImage || !this.selectedImageData) return;
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
      await this.tagger.writeTags(this._selectedImage.path, uniqueTags);
      this.saveSuccess = true;
      const updatedData = await this.tagger.getImageData(this._selectedImage.path);
      this.selectedImageData = updatedData;
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
