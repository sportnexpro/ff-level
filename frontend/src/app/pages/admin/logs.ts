import { Component, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api';
import { every } from '../../core/poll';
import { Console } from './overview';

@Component({
  selector: 'app-admin-logs',
  imports: [Console],
  template: `
    <div class="grid animate-view-in gap-5">
      <div class="seg justify-self-start" role="group" aria-label="Filter logs">
        @for (f of filters; track f[0]) { <button type="button" [attr.aria-pressed]="level() === f[0]" (click)="level.set(f[0])">{{ f[1] }}</button> }
      </div>
      <div class="card overflow-hidden">
        <div class="card-head">
          <h3 class="card-title"><i class="fa-solid fa-terminal" aria-hidden="true"></i>Live console</h3>
          <span class="badge badge-ok"><span class="dot pulse"></span>Live</span>
        </div>
        <app-console [logs]="shown()" maxHeight="calc(100vh - 290px)" minHeight="320px" />
      </div>
    </div>`,
})
export class AdminLogs {
  private api = inject(Api);
  readonly logs = signal<any[]>([]);
  readonly level = signal('all');
  readonly filters = [['all', 'All'], ['success', 'Success'], ['warning', 'Warnings'], ['error', 'Errors']];
  readonly shown = computed(() => this.logs().filter((l) => this.level() === 'all' || l.level === this.level()));

  constructor() {
    every(3000, async () => {
      try { this.logs.set((await this.api.get('/api/admin/overview')).logs); } catch { /* keep the last logs */ }
    });
  }
}
