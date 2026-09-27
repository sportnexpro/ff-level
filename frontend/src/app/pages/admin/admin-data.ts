import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../../core/api';
import { Confirm } from '../../core/confirm';
import { esc, fmt } from '../../core/fmt';
import { Toasts } from '../../core/toast';

/** State shared by the admin pages: settings, plans and the pending-orders badge. */
@Injectable()
export class AdminData {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  readonly settings = signal<any>({});
  readonly plans = signal<any[]>([]);
  readonly pending = signal(0);
  /** Order being rejected (shows the reason dialog). */
  readonly rejecting = signal<{ order: any; done: () => void } | null>(null);

  currency() { return this.settings().currency || '৳'; }

  async load() {
    try {
      const [st, pl] = await Promise.all([this.api.get('/api/admin/settings'), this.api.get('/api/admin/plans')]);
      this.settings.set(st.settings);
      this.plans.set(pl.plans);
    } catch (e) { this.toasts.error(e); }
    this.api.get('/api/admin/orders?status=pending').then((r) => this.pending.set(r.orders.length)).catch(() => {});
  }

  async reloadPlans() {
    this.plans.set((await this.api.get('/api/admin/plans')).plans);
  }

  planLabel(p: any) {
    return `${p.name} — ${fmt.duration(p.duration_hours)}, ${p.max_accounts} acc`;
  }

  async approve(o: any, done: () => void) {
    const ok = await this.confirm.ask({
      title: `Approve order #${o.id}?`,
      message: `<b>${esc(o.username)}</b> gets <b>${esc(o.plan_name)}</b> — ${fmt.duration(o.duration_hours)} and ${o.max_accounts} account slot(s). Make sure you received <b>${esc(fmt.money(o.amount, this.currency()))}</b> with Trx ID <code>${esc(o.trx_id)}</code>.`,
      confirmText: 'Approve & activate',
    });
    if (!ok) return;
    try {
      await this.api.post('/api/admin/orders/review', { id: o.id, action: 'approve' });
      this.toasts.success(`Order #${o.id} approved — access activated`);
      done();
    } catch (e) { this.toasts.error(e); }
  }

  reject(o: any, done: () => void) {
    this.rejecting.set({ order: o, done });
  }
}

/** Duration picker value: a number plus a unit (24 = days, 1 = hours). */
export interface Duration { value: number; unit: number; }
export const toDuration = (hours: number): Duration => (hours % 24 === 0 ? { value: hours / 24, unit: 24 } : { value: hours, unit: 1 });
export const fromDuration = (d: Duration) => Math.round(Number(d.value || 0) * Number(d.unit || 24));

export const orderBadge = (status: string): [string, string] =>
  (({ pending: ['badge-warn', 'Pending'], approved: ['badge-ok', 'Approved'], rejected: ['badge-bad', 'Rejected'] } as any)[status] || ['', status]);
