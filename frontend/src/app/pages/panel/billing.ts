import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../../core/api';
import { contactUrls, copyText, fmt } from '../../core/fmt';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Empty } from '../../ui/common';
import { Modal } from '../../ui/modal';
import { PanelData } from './panel-data';

/** A pricing card, used on the landing page and in billing. */
@Component({
  selector: 'app-price-card',
  template: `
    <article class="relative flex h-full flex-col gap-5 rounded-[20px] p-6 sm:p-7"
      [class]="plan().is_popular ? 'grad-border shadow-[0_30px_70px_-34px_rgba(255,51,102,.55)]' : 'card'">
      @if (plan().is_popular) {
        <span class="absolute -top-3 left-6 rounded-full px-3 py-1 text-[11.5px] font-bold text-white shadow-lg"
          style="background: linear-gradient(135deg,#ff3366,#c026d3 55%,#8b5cf6)">Most popular</span>
      }
      <div>
        <div class="flex items-center gap-2 font-display text-lg font-bold">{{ plan().name }}
          @if (current()) { <span class="badge badge-ok">Current</span> }</div>
        <div class="mt-3 flex items-baseline gap-1.5">
          <b class="font-display text-[40px] leading-none font-bold tracking-tight">{{ money(plan().price, currency()) }}</b>
          <span class="text-sm text-fg-3">/ {{ duration(plan().duration_hours) }}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <span class="badge badge-accent"><i class="fa-solid fa-gamepad text-[10px]" aria-hidden="true"></i>{{ plural(plan().max_accounts, 'account') }}</span>
        <span class="badge"><i class="fa-regular fa-clock text-[10px]" aria-hidden="true"></i>{{ duration(plan().duration_hours) }}</span>
      </div>
      <ul class="grid gap-2.5 text-[14px] text-fg-2">
        @for (f of features(); track $index) {
          <li class="flex gap-2.5"><i class="fa-solid fa-check mt-1 text-[12px] text-ok" aria-hidden="true"></i><span>{{ f }}</span></li>
        }
      </ul>
      <div class="mt-auto pt-1"><ng-content /></div>
    </article>`,
  host: { class: 'block h-full' },
})
export class PriceCard {
  readonly plan = input.required<any>();
  readonly currency = input('৳');
  readonly current = input(false);
  readonly money = fmt.money;
  readonly duration = fmt.duration;
  readonly plural = fmt.plural;
  readonly features = computed(() => String(this.plan().features || '').split('\n').filter(Boolean));
}

@Component({
  selector: 'app-buy-dialog',
  imports: [Modal, FormsModule],
  template: `
    <app-modal [title]="'Buy ' + plan().name" [sub]="plural(plan().max_accounts, 'account') + ' · ' + duration(plan().duration_hours)" (closed)="closed.emit()">
      <div class="flex items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand/[0.06] px-4 py-3.5">
        <span class="text-sm font-semibold text-fg-2">Amount to send</span>
        <b class="font-display text-2xl">{{ money(plan().price, session.currency()) }}</b>
      </div>
      <div class="grid gap-2.5">
        <div class="label">1. Send the payment to</div>
        @for (m of methods(); track $index) {
          <div class="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3 dark:bg-white/[0.02]">
            <span class="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-surface-3 font-display text-sm font-bold">{{ m.name.slice(0, 2).toUpperCase() }}</span>
            <div class="min-w-0 flex-1 leading-tight">
              <b class="text-sm">{{ m.name }}</b>@if (m.type) { <span class="text-xs text-fg-3"> · {{ m.type }}</span> }
              <div class="font-mono text-[13px] text-fg-2">{{ m.number }}</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" (click)="copy(m.number)"><i class="fa-regular fa-copy" aria-hidden="true"></i>Copy</button>
          </div>
        } @empty {
          <div class="flex gap-3 rounded-xl border border-warn/30 bg-warn/10 p-3.5 text-sm text-warn">
            <i class="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true"></i><span>No payment method is set up yet. Please contact the seller.</span>
          </div>
        }
        @if (session.settings().payment_note) { <p class="text-[13px] text-fg-3">{{ session.settings().payment_note }}</p> }
      </div>
      <form id="order-form" class="grid gap-4" novalidate (ngSubmit)="submit()">
        <div class="label">2. Enter your payment details</div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-1.5"><label class="label" for="o-method">Method</label>
            <select class="select" id="o-method" name="method" [(ngModel)]="method">
              @for (m of methods(); track $index) { <option [value]="m.name">{{ m.name }}</option> } @empty { <option value="Other">Other</option> }
            </select></div>
          <div class="grid gap-1.5"><label class="label" for="o-sender">Sender number</label>
            <input class="input font-mono" id="o-sender" name="sender" [(ngModel)]="sender" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX"></div>
        </div>
        <div class="grid gap-1.5"><label class="label" for="o-trx">Transaction ID</label>
          <input class="input font-mono uppercase" id="o-trx" name="trx_id" [(ngModel)]="trx" autocomplete="off" placeholder="BKA7X9Q2M1"></div>
        <p class="form-error" role="alert">{{ error() }}</p>
      </form>
      <div foot class="contents">
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="order-form" class="btn btn-primary" [class.is-loading]="busy()" [disabled]="busy()">Submit order</button>
      </div>
    </app-modal>`,
})
export class BuyDialog {
  readonly plan = input.required<any>();
  readonly closed = output<void>();
  readonly done = output<void>();
  readonly session = inject(Session);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly methods = computed<any[]>(() => this.session.settings().payment_methods || []);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly money = fmt.money;
  readonly duration = fmt.duration;
  readonly plural = fmt.plural;
  method = this.methods()[0]?.name || 'Other';
  sender = '';
  trx = '';

  async copy(text: string) {
    await copyText(text);
    this.toasts.success('Number copied');
  }

  async submit() {
    const sender = this.sender.trim(), trx = this.trx.trim().toUpperCase();
    if (sender.length < 4 || trx.length < 4) return this.error.set('Enter the sender number and Transaction ID from your payment.');
    this.error.set('');
    this.busy.set(true);
    try {
      await this.api.post('/api/panel/orders/create', { plan_id: this.plan().id, method: this.method, sender, trx_id: trx });
      this.toasts.success('Order submitted! Your plan activates once the payment is verified.');
      this.done.emit();
      this.closed.emit();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-panel-billing',
  imports: [PriceCard, BuyDialog, Empty, FormsModule],
  template: `
    <div class="grid animate-view-in gap-6">
      @if (p.sub().active && !p.sub().unlimited) {
        <div class="card flex flex-wrap items-center gap-3 p-4 text-sm text-fg-2 sm:px-5">
          <i class="fa-solid fa-circle-info text-info" aria-hidden="true"></i>
          <span>You're on <b class="text-fg">{{ p.sub().plan_name || 'a plan' }}</b> · {{ remaining() }} left. Renewing adds time on top.</span>
        </div>
      }

      <div id="pricing" class="grid gap-5 pt-2 sm:grid-cols-2 xl:grid-cols-3">
        @for (plan of session.plans(); track plan.id) {
          <app-price-card [plan]="plan" [currency]="session.currency()" [current]="isCurrent(plan)">
            <button type="button" class="btn btn-lg w-full" [class]="plan.is_popular ? 'btn-primary' : 'btn-secondary'" [attr.data-buy]="plan.id" (click)="buying.set(plan)">
              {{ isCurrent(plan) ? 'Renew' : 'Buy now' }}</button>
          </app-price-card>
        } @empty {
          <div class="card sm:col-span-2 xl:col-span-3"><app-empty icon="fa-crown" title="No plans available" text="The seller hasn’t published any plans yet." /></div>
        }
      </div>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div class="card content-start">
          <div class="card-head"><div>
            <h3 class="card-title"><i class="fa-solid fa-key" aria-hidden="true"></i>Have a license key?</h3>
            <div class="card-sub">Redeem it to activate your plan instantly.</div>
          </div></div>
          <form class="grid gap-3 p-5" novalidate (ngSubmit)="redeem()">
            <label class="sr-only" for="r-code">License key</label>
            <div class="relative">
              <i class="fa-solid fa-key pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-fg-3" aria-hidden="true"></i>
              <input class="input pl-10 font-mono uppercase" id="r-code" name="code" [(ngModel)]="code" placeholder="LVL-XXXX-XXXX-XXXX" autocomplete="off">
            </div>
            <button class="btn btn-primary" type="submit" [class.is-loading]="redeeming()" [disabled]="redeeming()">Redeem key</button>
            <p class="form-error" role="alert">{{ redeemError() }}</p>
          </form>
        </div>

        <div class="card min-w-0 overflow-hidden" id="orders-card" #ordersCard>
          <div class="card-head flex-wrap">
            <h3 class="card-title"><i class="fa-solid fa-receipt" aria-hidden="true"></i>Order history</h3>
            <div class="flex gap-2">
              @if (contact().telegram) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().telegram"><i class="fa-brands fa-telegram" aria-hidden="true"></i>Telegram</a> }
              @if (contact().whatsapp) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().whatsapp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i>WhatsApp</a> }
            </div>
          </div>
          @if (orders() === null) {
            <div class="p-5"><div class="skeleton h-16"></div></div>
          } @else if (!orders()!.length) {
            <p class="p-5 text-sm text-fg-3">No orders yet. Orders you place will show up here.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="tbl">
                <thead><tr><th>Plan</th><th class="num">Amount</th><th>Payment</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  @for (o of orders(); track o.id) {
                    <tr>
                      <td><b>{{ o.plan_name }}</b><div class="text-[12.5px] text-fg-3">{{ duration(o.duration_hours) }} · {{ o.max_accounts }} acc</div></td>
                      <td class="num"><b>{{ money(o.amount, session.currency()) }}</b></td>
                      <td>{{ o.method }}<div class="font-mono text-[12.5px] text-fg-3">{{ o.trx_id }}</div></td>
                      <td class="whitespace-nowrap text-fg-3">{{ date(o.created_at) }}</td>
                      <td>
                        <span class="badge" [class]="badge(o.status)[0]">{{ badge(o.status)[1] }}</span>
                        @if (o.admin_note) { <div class="mt-1 text-[12.5px] text-fg-3">{{ o.admin_note }}</div> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
    @if (buying(); as plan) { <app-buy-dialog [plan]="plan" (closed)="buying.set(null)" (done)="orderPlaced()" /> }`,
})
export class PanelBilling {
  readonly p = inject(PanelData);
  readonly session = inject(Session);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ordersCard = viewChild<ElementRef<HTMLElement>>('ordersCard');

  readonly buying = signal<any | null>(null);
  readonly orders = signal<any[] | null>(null);
  readonly redeeming = signal(false);
  readonly redeemError = signal('');
  readonly contact = computed(() => contactUrls(this.session.settings()));
  readonly remaining = computed(() => fmt.remaining(this.p.remaining()));
  readonly money = fmt.money;
  readonly duration = fmt.duration;
  readonly date = fmt.date;
  code = '';

  constructor() {
    this.loadOrders().then(() => {
      if (this.route.snapshot.data['focus'] === 'orders') setTimeout(() => this.ordersCard()?.nativeElement.scrollIntoView({ block: 'start' }));
    });
  }

  isCurrent(plan: any) {
    const s = this.p.sub();
    return !!(s.active && !s.unlimited && s.plan_name === plan.name);
  }

  badge(status: string): [string, string] {
    return ({ pending: ['badge-warn', 'Pending'], approved: ['badge-ok', 'Approved'], rejected: ['badge-bad', 'Rejected'] } as any)[status] || ['', status];
  }

  async loadOrders() {
    try {
      this.orders.set((await this.api.get('/api/panel/orders')).orders);
    } catch (e) { this.toasts.error(e); }
  }

  async orderPlaced() {
    await this.loadOrders();
    this.ordersCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async redeem() {
    const code = this.code.trim().toUpperCase();
    this.redeemError.set('');
    if (!code) return this.redeemError.set('Enter your license key.');
    this.redeeming.set(true);
    try {
      const r = await this.api.post('/api/panel/redeem', { code });
      this.code = '';
      this.toasts.success(`Activated ${r.plan_name}: ${fmt.duration(r.duration_hours)}, ${r.max_accounts} account(s)`);
      await this.p.refresh();
      this.router.navigateByUrl('/panel');
    } catch (e: any) {
      this.redeemError.set(e.message);
    } finally {
      this.redeeming.set(false);
    }
  }
}
