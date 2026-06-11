import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-folder-tree',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel-header">
      <h2>Folders</h2>
      <button class="collapse-trigger-btn" (click)="collapse.emit()" title="Collapse Panel">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
    </div>
    <div class="sidebar-content">
      <div class="folder-list">
        <div *ngIf="subfolders.length === 0" class="no-subfolders">No subfolders found</div>
        <button *ngFor="let sub of subfolders" class="folder-item" (click)="folderSelected.emit(sub)">
          <svg class="folder-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
          <span class="folder-name">{{ getFolderName(sub) }}</span>
        </button>
      </div>
    </div>
  `,
})
export class FolderTreeComponent {
  @Input() subfolders: string[] = [];
  @Output() readonly folderSelected = new EventEmitter<string>();
  @Output() readonly collapse = new EventEmitter<void>();

  getFolderName(fullPath: string): string {
    const normalized = fullPath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || fullPath;
  }
}
