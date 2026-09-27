import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Modal } from '../../ui/modal';
import { NavItem, Shell } from '../../ui/shell';
import { AdminData } from './admin-data';

@Component({
  selector: 'app-reject-dialog',
  imports: [Modal, FormsModule],
  template: `
    @if (admin.rejecting(); as r) {
      <app-modal [title]="'Reject order #' + r.order.id + '?'" [sub]="r.order.username + ' · ' + r.order.plan_name + ' · Trx ' + r.order.trx_id" (closed)="admin.rejecting.set(null)">
        <div class="grid gap-1.5"><label class="label" for="rj-note">Reason (shown to the user)</label>
          <input class="input" id="rj-note" name="note" [(ngModel)]="note" placeholder="e.g. Transaction ID not found"></div>
        <div foot class="contents">
          <button type="button" class="btn btn-secondary" (click)="admin.rejecting.set(null)">Cancel</button>
          <button type="button" class="btn btn-danger" [class.is-loading]="busy()" [disabled]="busy()" (click)="submit(r)">Reject order</button>
        </div>
      </app-modal>
    }`,
})
export class RejectDialog {
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly busy = signal(false);
  note = '';

  async submit(r: { order: any; done: () => void }) {
    this.busy.set(true);
    try {
      await this.api.post('/api/admin/orders/review', { id: r.order.id, action: 'reject', note: this.note.trim() });
      this.toasts.info(`Order #${r.order.id} rejected`);
      this.note = '';
      this.admin.rejecting.set(null);
      r.done();
    } catch (e) { this.toasts.error(e); } finally { this.busy.set(false); }
  }
}

@Component({
  selector: 'app-admin-layout',
  imports: [Shell, RejectDialog],
  providers: [AdminData],
  template: `
    <app-shell [nav]="nav" portal="Admin" base="/admin" [counts]="{ orders: admin.pending() }" />
    <app-reject-dialog />`,
})
export class AdminLayout {
  readonly admin = inject(AdminData);
  readonly nav: NavItem[] = [
    { id: 'overview', path: '', label: 'Overview', icon: 'chart' },
    { id: 'orders', label: 'Orders', icon: 'inbox' },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'plans', label: 'Plans', icon: 'crown' },
    { id: 'keys', label: 'Keys', icon: 'key-round' },
    { id: 'accounts', label: 'Accounts', icon: 'gamepad' },
    { id: 'logs', label: 'Console', icon: 'terminal' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
    { id: 'panel', label: 'My user panel', icon: 'external', href: '/panel', menu: true },
  ];

  constructor() {
    inject(Session).loadInfo();
    this.admin.load();
  }
}
