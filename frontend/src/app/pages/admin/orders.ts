import { Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api';
import { copyText, fmt } from '../../core/fmt';
import { every } from '../../core/poll';
import { Toasts } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Empty } from '../../ui/common';
import { AdminData, orderBadge } from './admin-data';

@Component({
  selector: 'app-admin-orders',
  imports: [Icon, Empty],
  template: `
    <div class="grid animate-view-in gap-5">
      <div class="seg self-start justify-self-start" role="group" aria-label="Filter orders">
        @for (f of filters; track f[0]) {
          <button type="button" [attr.aria-pressed]="status() === f[0]" (click)="setStatus(f[0])">{{ f[1] }}</button>
        }
      </div>
      <div class="card overflow-hidden">
        @if (orders() === null) {
          <div class="p-5"><div class="skeleton h-40"></div></div>
        } @else if (!orders()!.length) {
          <app-empty icon="inbox" [title]="status() === 'pending' ? 'No pending orders' : 'No orders here'" text="Orders customers submit from their panel appear here." />
        } @else {
          <div class="overflow-x-auto">
            <table class="tbl">
              <thead><tr><th>Order</th><th>User</th><th>Plan</th><th class="num">Amount</th><th>Payment</th><th>Submitted</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                @for (o of orders(); track o.id) {
                  <tr>
                    <td class="font-mono text-fg-3">#{{ o.id }}</td>
                    <td><b>{{ o.username || 'deleted' }}</b></td>
                    <td class="whitespace-nowrap">{{ o.plan_name }}<div class="text-[12.5px] text-fg-3">{{ duration(o.duration_hours) }} · {{ o.max_accounts }} acc</div></td>
                    <td class="num"><b>{{ money(o.amount, admin.currency()) }}</b></td>
                    <td class="whitespace-nowrap">
                      {{ o.method }} <span class="font-mono text-[12.5px] text-fg-3">{{ o.sender }}</span>
                      <div class="mt-1 flex items-center gap-1">
                        <code class="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] font-semibold dark:bg-white/5">{{ o.trx_id }}</code>
                        <button type="button" class="grid h-7 w-7 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg" (click)="copy(o.trx_id)" aria-label="Copy Trx ID"><app-icon name="copy" [size]="14" /></button>
                      </div>
                    </td>
                    <td class="whitespace-nowrap text-fg-3">{{ date(o.created_at) }}</td>
                    <td>
                      <span class="badge" [class]="badge(o.status)[0]"><span class="dot"></span>{{ badge(o.status)[1] }}</span>
                      @if (o.admin_note) { <div class="mt-1 text-xs text-fg-3">{{ o.admin_note }}</div> }
                    </td>
                    <td class="text-right whitespace-nowrap">
                      @if (o.status === 'pending') {
                        <div class="inline-flex gap-1.5">
                          <button type="button" class="btn btn-success btn-sm" (click)="admin.approve(o, load)"><app-icon name="check" [size]="16" />Approve</button>
                          <button type="button" class="btn btn-danger btn-sm btn-icon" (click)="admin.reject(o, load)" [attr.aria-label]="'Reject order #' + o.id"><app-icon name="x" [size]="16" /></button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>`,
})
export class AdminOrders {
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly filters = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];
  readonly status = signal('pending');
  readonly orders = signal<any[] | null>(null);
  readonly badge = orderBadge;
  readonly money = fmt.money;
  readonly duration = fmt.duration;
  readonly date = fmt.date;

  readonly load = async () => {
    try {
      const s = this.status();
      const orders = (await this.api.get(`/api/admin/orders${s ? `?status=${s}` : ''}`)).orders;
      if (s !== this.status()) return;
      this.orders.set(orders);
      if (s === 'pending') this.admin.pending.set(orders.length);
    } catch (e) { this.toasts.error(e); }
  };

  constructor() {
    every(10000, this.load);
  }

  setStatus(s: string) {
    this.status.set(s);
    this.orders.set(null);
    this.load();
  }

  async copy(text: string) {
    await copyText(text);
    this.toasts.success('Trx ID copied');
  }
}
