import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { ImageFileInfo } from '../../models';
import { TaggerService } from '../../services/tagger.service';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-gallery.component.html',
})
export class ImageGalleryComponent {
  @Input() images: ImageFileInfo[] = [];
  @Input() selectedImage: ImageFileInfo | null = null;
  @Input() scanning = false;
  @Input() scanError = '';
  @Input() leftSidebarCollapsed = false;
  @Input() rightSidebarCollapsed = false;
  @Output() readonly imageSelected = new EventEmitter<ImageFileInfo>();
  @Output() readonly expandLeft = new EventEmitter<void>();
  @Output() readonly expandRight = new EventEmitter<void>();

  searchQuery = '';
  gridScale = 2;

  constructor(private readonly tagger: TaggerService) {}

  get filteredImages(): ImageFileInfo[] {
    if (!this.searchQuery.trim()) return this.images;
    const query = this.searchQuery.toLowerCase().trim();
    return this.images.filter(img => img.name.toLowerCase().includes(query));
  }

  trackByImagePath(_index: number, img: ImageFileInfo): string {
    return img.path;
  }

  getImageUrl(path: string): string {
    return this.tagger.toAssetUrl(path);
  }
}
