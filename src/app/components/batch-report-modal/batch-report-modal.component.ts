import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import type { BatchReport } from '../../models';

@Component({
  selector: 'app-batch-report-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="report as r">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ i18n.t('modal.report_title') }}</h2>
          <button class="modal-close-btn" (click)="dismiss.emit()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="status-summary" [class.cancelled]="r.status === 'Cancelled'">
            <div class="status-icon">
              <svg *ngIf="r.status === 'Completed'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              <svg *ngIf="r.status === 'Cancelled'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
            </div>
            <div class="status-text">
              <h3>{{ i18n.t('modal.report_status') }}: {{ r.status }}</h3>
              <p>{{ i18n.t('modal.report_processed') }}: {{ r.processed }} / {{ r.total }} ({{ r.duration }}s)</p>
            </div>
          </div>

          <div class="report-grid">
            <div class="report-stat-card">
              <span class="stat-label">{{ i18n.t('modal.report_success') }}</span>
              <span class="stat-val success">{{ r.successes }}</span>
            </div>
            <div class="report-stat-card">
              <span class="stat-label">{{ i18n.t('modal.report_failures') }}</span>
              <span class="stat-val failure">{{ r.failures }}</span>
            </div>
            <div class="report-stat-card">
              <span class="stat-label">{{ i18n.t('modal.report_added') }}</span>
              <span class="stat-val accent">{{ r.tagsAdded }}</span>
            </div>
            <div class="report-stat-card" *ngIf="r.tagsRemoved > 0">
              <span class="stat-label">{{ i18n.t('modal.report_removed') }}</span>
              <span class="stat-val failure">{{ r.tagsRemoved }}</span>
            </div>
          </div>

          <div class="report-errors-section" *ngIf="r.errors.length > 0">
            <h4>{{ i18n.t('modal.report_errors') }} ({{ r.errors.length }})</h4>
            <div class="errors-list-container">
              <div class="error-item" *ngFor="let item of r.errors">
                <span class="error-filename">{{ item.name }}</span>
                <span class="error-message">{{ item.error }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="dismiss-btn" (click)="dismiss.emit()">{{ i18n.t('modal.report_done') }}</button>
        </div>
      </div>
    </div>
  `,
})
export class BatchReportModalComponent {
  readonly i18n = inject(I18nService);
  @Input() report: BatchReport | null = null;
  @Output() readonly dismiss = new EventEmitter<void>();
}
