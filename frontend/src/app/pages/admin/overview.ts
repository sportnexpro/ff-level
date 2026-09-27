import { AfterViewChecked, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { fmt } from '../../core/fmt';
import { every } from '../../core/poll';
import { Toasts } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Avatar, Empty } from '../../ui/common';
import { AdminData } from './admin-data';

/** Terminal-style log view that sticks to the bottom while you're at the bottom. */
@Component({
  selector: 'app-console',
  template: `
    <div #box class="overflow-y-auto bg-[#07070f] px-4 py-3 font-mono text-[12.5px] leading-[1.7] text-[#c9c9dc]" [style.max-height]="maxHeight()" [style.min-height]="minHeight()" aria-live="off">
      @for (l of logs(); track $index) {
        <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <time class="text-[#6b6b88]">{{ l.time }}</time>
          <span class="break-words" [class]="tone(l.level)">{{ l.message }}</span>
        </div>
      } @empty {
        <div class="text-[#6b6b88]">Waiting for bot activity…</div>
      }
    </div>`,
  host: { class: 'block' },
})
export class Console implements AfterViewChecked {
  readonly logs = input<any[]>([]);
  readonly maxHeight = input('380px');
  readonly minHeight = input('0');
  private box = viewChild.required<ElementRef<HTMLElement>>('box');
  private stick = true;
  private count = -1;

  tone(level: string) {
    return ({ success: 'text-[#4ade80]', warning: 'text-[#fbbf24]', error: 'text-[#fb7185]' } as any)[level] || '';
  }

  ngAfterViewChecked() {
    const el = this.box().nativeElement;
    if (this.logs().length !== this.count) {
      if (this.stick) el.scrollTop = el.scrollHeight;
      this.count = this.logs().length;
    }
    this.stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
  }
}

@Component({
  selector: 'app-kpi',
  imports: [Icon],
  template: `
    <div class="card h-full p-5">
      <div class="flex items-start justify-between gap-3">
        <span class="text-[13px] font-semibold text-fg-3">{{ label() }}</span>
        <span class="grid h-9 w-9 place-items-center rounded-[10px] text-sm" [class]="toneCls()"><app-icon [name]="icon()" [size]="17" /></span>
      </div>
      <div class="mt-2 font-display text-[28px] leading-none font-bold tabular-nums">{{ value() }}@if (of() !== '') {<span class="text-base text-fg-3"> / {{ of() }}</span>}</div>
      <div class="mt-2 text-[12.5px] text-fg-3">{{ foot() }}</div>
    </div>`,
})
export class Kpi {
  readonly label = input('');
  readonly value = input<string | number>('');
  readonly of = input<string | number>('');
  readonly icon = input('chart');
  readonly tone = input('');
  readonly foot = input('');
  readonly toneCls = computed(() => ({ success: 'bg-ok/12 text-ok', warning: 'bg-warn/12 text-warn', info: 'bg-info/12 text-info' } as any)[this.tone()] || 'bg-brand/12 text-accent');
}

@Component({
  selector: 'app-admin-overview',
  imports: [Icon, RouterLink, Kpi, Console, Avatar, Empty],
  template: `
    <div class="grid animate-view-in gap-5 sm:gap-6">
      <div class="flex justify-end">
        <a class="btn btn-primary btn-sm" routerLink="/admin/keys"><app-icon name="key-round" [size]="16" />Generate keys</a>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @if (!d()) {
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) { <div class="card p-5"><div class="skeleton h-[84px]"></div></div> }
        } @else {
          @for (k of kpis(); track k.label) {
            <app-kpi [label]="k.label" [value]="k.value" [of]="k.of ?? ''" [icon]="k.icon" [tone]="k.tone" [foot]="k.foot" />
          }
        }
      </div>
      <div class="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div class="card overflow-hidden">
          <div class="card-head pb-4">
            <div><h3 class="card-title"><app-icon name="inbox" [size]="16" />Pending payments</h3>
              <div class="card-sub">Verify the Trx ID in your wallet app, then approve</div></div>
            <a class="btn btn-secondary btn-sm" routerLink="/admin/orders">All orders</a>
          </div>
          @for (o of d()?.pending || []; track o.id) {
            <div class="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
              <app-avatar [name]="o.username" [size]="36" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm"><b>{{ o.username }}</b> <span class="text-fg-3">· {{ o.plan_name }}</span></div>
                <div class="truncate text-[12.5px] text-fg-3">{{ o.method }} · <span class="font-mono">{{ o.trx_id }}</span> · {{ ago(o.created_at) }}</div>
              </div>
              <b class="mr-1 text-sm whitespace-nowrap">{{ money(o.amount, admin.currency()) }}</b>
              <button type="button" class="btn btn-success btn-sm btn-icon" (click)="admin.approve(o, load)" [attr.aria-label]="'Approve order #' + o.id" title="Approve"><app-icon name="check" [size]="16" /></button>
              <button type="button" class="btn btn-danger btn-sm btn-icon" (click)="admin.reject(o, load)" [attr.aria-label]="'Reject order #' + o.id" title="Reject"><app-icon name="x" [size]="16" /></button>
            </div>
          } @empty {
            <app-empty icon="inbox" title="All caught up" text="New payment submissions will appear here for review." />
          }
        </div>
        <div class="card overflow-hidden">
          <div class="card-head pb-4">
            <h3 class="card-title"><app-icon name="terminal" [size]="16" />Bot console</h3>
            <a class="btn btn-ghost btn-sm" routerLink="/admin/logs">Open</a>
          </div>
          <app-console [logs]="logs()" maxHeight="380px" minHeight="200px" />
        </div>
      </div>
    </div>`,
})
export class AdminOverview {
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly d = signal<any | null>(null);
  readonly logs = computed(() => (this.d()?.logs || []).slice(-40));
  readonly ago = fmt.ago;
  readonly money = fmt.money;

  readonly load = async () => {
    try {
      const d = await this.api.get('/api/admin/overview');
      this.d.set(d);
      this.admin.pending.set(d.stats.pending_orders);
    } catch (e) { this.toasts.error(e); }
  };

  readonly kpis = computed(() => {
    const d = this.d(), s = d.stats, t = d.totals, cur = this.admin.currency();
    return [
      { label: 'Revenue this month', value: fmt.money(s.revenue_month, cur), icon: 'wallet', tone: '', foot: `${fmt.money(s.revenue_total, cur)} all time` },
      { label: 'Active subscribers', value: s.active_users, of: s.users, icon: 'users', tone: 'success', foot: 'Users with time left' },
      { label: 'Pending orders', value: s.pending_orders, icon: 'hourglass', tone: s.pending_orders ? 'warning' : 'info', foot: s.pending_orders ? 'Waiting for your review' : 'Nothing to review' },
      { label: 'Running accounts', value: t.running, of: s.accounts, icon: 'server', tone: 'info', foot: `${t.in_match} in match now` },
      { label: 'EXP gained', value: `+${fmt.compact(t.gained_exp)}`, icon: 'trend', tone: 'success', foot: 'All accounts, this session' },
      { label: 'Matches played', value: fmt.num(t.matches), icon: 'crosshair', tone: '', foot: 'This session' },
      { label: 'Unused keys', value: s.unused_keys, icon: 'key-round', tone: 'warning', foot: 'Ready to sell' },
      { label: 'Bot uptime', value: fmt.uptime(d.uptime), icon: 'clock', tone: 'info', foot: 'Since last restart' },
    ] as { label: string; value: any; of?: any; icon: string; tone: string; foot: string }[];
  });

  constructor() {
    every(4000, this.load);
  }
}
