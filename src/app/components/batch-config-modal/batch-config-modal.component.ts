import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaggerService } from '../../services/tagger.service';
import type { BatchMode, FolderDepthReport } from '../../models';

export interface BatchRunConfig {
  mode: BatchMode;
  maxTags: number;
  targetDepth: number;
}

@Component({
  selector: 'app-batch-config-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batch-config-modal.component.html',
})
export class BatchConfigModalComponent {
  @Input() visible = false;
  @Input() folderPath = '';
  @Output() readonly run = new EventEmitter<BatchRunConfig>();
  @Output() readonly close = new EventEmitter<void>();

  configMaxTags = 5;
  configMode: BatchMode = 'append';
  configTargetDepth = 0;
  depthReport: FolderDepthReport | null = null;
  depthReportLoading = false;

  constructor(private readonly tagger: TaggerService) {}

  async analyzeFolderDepth(): Promise<void> {
    this.depthReportLoading = true;
    this.depthReport = null;
    try {
      this.depthReport = await this.tagger.getFolderDepthAnalysis(this.folderPath);
    } catch {
      // depth analysis is optional; errors are non-fatal
    } finally {
      this.depthReportLoading = false;
    }
  }

  onClose(): void {
    this.depthReport = null;
    this.close.emit();
  }

  onRun(): void {
    this.run.emit({
      mode: this.configMode,
      maxTags: this.configMaxTags,
      targetDepth: this.configTargetDepth,
    });
  }
}
