import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../../core/api';
import { contactUrls, copyText, fmt } from '../../core/fmt';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Empty } from '../../ui/common';
import { Icon } from '../../ui/icon';
import { Modal } from '../../ui/modal';
import { PanelData } from './panel-data';

/** A pricing card, used on the landing page, in billing and in the admin plan list. */
@Component({
  selector: 'app-price-card',
  imports: [Icon],
  template: `
    <article class="relative flex h-full flex-col rounded-3xl p-6 transition duration-300 sm:p-7"
      [class]="plan().is_popular ? 'ember-border shadow-[0_30px_80px_-40px_rgba(255,106,26,.55)]' : 'card'">
      @if (plan().is_popular) {
        <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
          <div class="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-ember/20 blur-3xl"></div>
        </div>
      }
      <div class="relative flex items-center justify-between gap-2">
        <span class="text-[15px] font-semibold">{{ plan().name }}</span>
        @if (current()) { <span class="badge badge-ok">Your plan</span> }
        @else if (plan().is_popular) { <span class="badge badge-accent"><app-icon name="flame" [size]="12" />Most popular</span> }
      </div>
      <div class="relative mt-5 flex items-baseline gap-1.5">
        <b class="num text-[44px] leading-none font-semibold tracking-[-0.04em]">{{ money(plan().price, currency()) }}</b>
        <span class="text-sm text-fg-3">/ {{ duration(plan().duration_hours) }}</span>
      </div>
      <p class="relative mt-2 text-[13.5px] text-fg-3">{{ plural(plan().max_accounts, 'account') }} leveling at the same time</p>
      <div class="relative my-6 h-px bg-line"></div>
      <ul class="relative grid gap-3 text-[14px] text-fg-2">
        @for (f of features(); track $index) {
          <li class="flex gap-3"><span class="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-ok/12 text-ok"><app-icon name="check" [size]="11" [stroke]="3" /></span><span>{{ f }}</span></li>
        }
      </ul>
      <div class="relative mt-auto pt-7"><ng-content /></div>
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
  imports: [Modal, FormsModule, Icon],
  template: `
    <app-modal [title]="'Get ' + plan().name" [sub]="plural(plan().max_accounts, 'account') + ' · ' + duration(plan().duration_hours)" (closed)="closed.emit()">
      <div class="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-4 dark:bg-white/[0.04]">
        <span class="text-sm text-fg-2">Amount to send</span>
        <b class="num text-[26px] leading-none font-semibold tracking-[-0.03em]">{{ money(plan().price, session.currency()) }}</b>
      </div>
      <ol class="grid gap-5">
        <li class="grid gap-2.5">
          <div class="flex items-center gap-2.5 text-sm font-semibold"><span class="grid h-6 w-6 place-items-center rounded-full bg-fg text-[12px] text-bg">1</span>Send the payment to</div>
          @for (m of methods(); track $index) {
            <div class="flex items-center gap-3 rounded-2xl border border-line p-3">
              <span class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-ember/10 text-[13px] font-semibold text-accent">{{ m.name.slice(0, 2).toUpperCase() }}</span>
              <div class="min-w-0 flex-1 leading-tight">
                <b class="text-sm font-semibold">{{ m.name }}</b>@if (m.type) { <span class="text-xs text-fg-3"> · {{ m.type }}</span> }
                <div class="mt-0.5 font-mono text-[13px] text-fg-2">{{ m.number }}</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" (click)="copy(m.number)"><app-icon name="copy" [size]="14" /><span>Copy</span></button>
            </div>
          } @empty {
            <div class="flex gap-3 rounded-2xl border border-warn/25 bg-warn/10 p-3.5 text-sm text-warn">
              <app-icon name="warning" [size]="17" /><span>No payment method is set up yet. Please contact the seller.</span>
            </div>
          }
          @if (session.settings().payment_note) { <p class="text-[13px] text-fg-3">{{ session.settings().payment_note }}</p> }
        </li>
        <li class="grid gap-3">
          <div class="flex items-center gap-2.5 text-sm font-semibold"><span class="grid h-6 w-6 place-items-center rounded-full bg-fg text-[12px] text-bg">2</span>Tell us about the payment</div>
          <form id="order-form" class="grid gap-4" novalidate (ngSubmit)="submit()">
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
        </li>
      </ol>
      <div foot class="contents">
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="order-form" class="btn btn-primary" [class.is-loading]="busy()" [disabled]="busy()"><span>Submit order</span></button>
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
      this.toasts.success('Order submitted — your plan activates once the payment is verified');
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
  imports: [PriceCard, BuyDialog, Empty, FormsModule, Icon],
  template: `
    <div class="grid animate-view-in gap-8">
      @if (p.sub().active && !p.sub().unlimited) {
        <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-[13.5px] text-fg-2 dark:bg-white/[0.02]">
          <app-icon name="info" [size]="17" class="text-info" />
          <span>You're on <b class="font-semibold text-fg">{{ p.sub().plan_name || 'a plan' }}</b> with <b class="num font-semibold text-fg">{{ remaining() }}</b> left. Renewing adds time on top.</span>
        </div>
      }

      <div id="pricing" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        @for (plan of session.plans(); track plan.id) {
          <app-price-card [plan]="plan" [currency]="session.currency()" [current]="isCurrent(plan)">
            <button type="button" class="btn btn-lg w-full" [class]="plan.is_popular ? 'btn-brand' : 'btn-secondary'" [attr.data-buy]="plan.id" (click)="buying.set(plan)">
              {{ isCurrent(plan) ? 'Renew ' + plan.name : 'Get ' + plan.name }}</button>
          </app-price-card>
        } @empty {
          <div class="card sm:col-span-2 lg:col-span-3"><app-empty icon="crown" title="No plans available" text="The seller hasn’t published any plans yet." /></div>
        }
      </div>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section class="card content-start p-5 sm:p-6">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-ember/10 text-accent"><app-icon name="key-round" [size]="19" /></span>
          <h3 class="mt-4 text-[17px]">Have a license key?</h3>
          <p class="mt-1 text-[13.5px] text-fg-3">Redeem it to activate your plan instantly.</p>
          <form class="mt-5 grid gap-3" novalidate (ngSubmit)="redeem()">
            <label class="sr-only" for="r-code">License key</label>
            <input class="input font-mono uppercase" id="r-code" name="code" [(ngModel)]="code" placeholder="LVL-XXXX-XXXX-XXXX" autocomplete="off">
            <button class="btn btn-primary" type="submit" [class.is-loading]="redeeming()" [disabled]="redeeming()"><span>Redeem key</span></button>
            <p class="form-error" role="alert">{{ redeemError() }}</p>
          </form>
        </section>

        <section class="card min-w-0 overflow-hidden" id="orders-card" #ordersCard>
          <div class="card-head flex-wrap pb-4">
            <div><h3 class="card-title">Orders</h3><p class="card-sub">Payments you submitted and their status</p></div>
            <div class="flex gap-2">
              @if (contact().telegram) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().telegram"><app-icon name="telegram" [size]="14" /><span>Telegram</span></a> }
              @if (contact().whatsapp) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().whatsapp"><app-icon name="whatsapp" [size]="14" /><span>WhatsApp</span></a> }
            </div>
          </div>
          @if (orders() === null) {
            <div class="p-5"><div class="skeleton h-16"></div></div>
          } @else if (!orders()!.length) {
            <app-empty icon="receipt" title="No orders yet" text="Orders you place will show up here." />
          } @else {
            <div class="overflow-x-auto border-t border-line">
              <table class="tbl">
                <thead><tr><th>Plan</th><th class="num">Amount</th><th>Payment</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  @for (o of orders(); track o.id) {
                    <tr>
                      <td><b class="font-semibold">{{ o.plan_name }}</b><div class="text-[12.5px] text-fg-3">{{ duration(o.duration_hours) }} · {{ o.max_accounts }} acc</div></td>
                      <td class="num font-semibold">{{ money(o.amount, session.currency()) }}</td>
                      <td>{{ o.method }}<div class="font-mono text-[12px] text-fg-3">{{ o.trx_id }}</div></td>
                      <td class="whitespace-nowrap text-fg-3">{{ date(o.created_at) }}</td>
                      <td>
                        <span class="badge" [class]="badge(o.status)[0]"><span class="dot"></span>{{ badge(o.status)[1] }}</span>
                        @if (o.admin_note) { <div class="mt-1 text-[12px] text-fg-3">{{ o.admin_note }}</div> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
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
