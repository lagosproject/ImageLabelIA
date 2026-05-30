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

  private async load(): Promise<void> {
    try {
      const thumb = await this.tagger.getThumbnail(this.imagePath);
      const img = this.el.nativeElement;
      img.src = thumb;
      img.classList.remove('thumb-loading');
    } catch {
      this.el.nativeElement.classList.add('thumb-error');
      this.el.nativeElement.classList.remove('thumb-loading');
    }
  }
}
