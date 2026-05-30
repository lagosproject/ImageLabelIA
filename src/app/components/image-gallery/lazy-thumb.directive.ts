import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { TaggerService } from '../../services/tagger.service';

@Directive({
  selector: '[appLazyThumb]',
  standalone: true,
})
export class LazyThumbDirective implements OnChanges, OnDestroy {
  @Input('appLazyThumb') imagePath = '';

  private observer!: IntersectionObserver;

  constructor(
    private readonly el: ElementRef<HTMLImageElement>,
    private readonly tagger: TaggerService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imagePath']) {
      this.reset();
      this.observe();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private reset(): void {
    this.observer?.disconnect();
    const img = this.el.nativeElement;
    img.src = '';
    img.classList.add('thumb-loading');
  }

  private observe(): void {
    if (!this.imagePath) return;
    this.observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          this.observer.disconnect();
          void this.load();
        }
      },
      { rootMargin: '300px' }, // start loading 300px before the card enters view
    );
    this.observer.observe(this.el.nativeElement);
  }

  // JPEG/PNG/WebP can be decoded natively by the browser via the asset protocol —
  // no IPC round-trip or Rust decode needed.
  private static readonly NATIVE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);

  private isNativeFormat(): boolean {
    const ext = this.imagePath.split('.').pop()?.toLowerCase() ?? '';
    return LazyThumbDirective.NATIVE_EXTENSIONS.has(ext);
  }

  private async load(): Promise<void> {
    try {
      const src = this.isNativeFormat()
        ? this.tagger.toAssetUrl(this.imagePath)
        : await this.tagger.getThumbnail(this.imagePath);
      const img = this.el.nativeElement;
      img.src = src;
      img.classList.remove('thumb-loading');
    } catch {
      this.el.nativeElement.classList.add('thumb-error');
      this.el.nativeElement.classList.remove('thumb-loading');
    }
  }
}
