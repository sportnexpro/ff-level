import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { fmt } from '../../core/fmt';
import { every } from '../../core/poll';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Modal } from '../../ui/modal';
import { NavItem, Shell } from '../../ui/shell';
import { PanelData } from './panel-data';

/** Active / Expired / Owner / Suspended pill for a subscription. */
@Component({
  selector: 'app-sub-badge',
  template: `
    @if (s().banned) { <span class="badge badge-bad"><span class="dot"></span>Suspended</span> }
    @else if (s().unlimited) { <span class="badge badge-accent"><i class="fa-solid fa-crown text-[10px]" aria-hidden="true"></i>Owner</span> }
    @else if (s().active) { <span class="badge badge-ok"><span class="dot"></span>Active</span> }
    @else { <span class="badge badge-bad"><span class="dot"></span>Expired</span> }`,
})
export class SubBadge {
  readonly s = input.required<any>();
}

@Component({
  selector: 'app-add-account',
  imports: [Modal, FormsModule, RouterLink],
  template: `
    @if (!p.sub().active || p.slots().full) {
      <app-modal [title]="!p.sub().active ? 'No active plan' : 'All slots in use'" (closed)="closed()">
        <div class="grid justify-items-center gap-3 py-2 text-center">
          <span class="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-xl text-accent">
            <i class="fa-solid" [class.fa-lock]="!p.sub().active" [class.fa-layer-group]="p.sub().active" aria-hidden="true"></i>
          </span>
          <p class="max-w-sm text-[14.5px] text-fg-2">
            @if (!p.sub().active) { Buy a plan or redeem a license key to start adding accounts. }
            @else { Your plan allows {{ plural(p.sub().max_accounts, 'account') }}. Upgrade for more slots, or remove an account first. }
          </p>
        </div>
        <div foot class="contents">
          <button type="button" class="btn btn-secondary" (click)="closed()">Close</button>
          <a class="btn btn-primary" routerLink="/panel/billing" (click)="closed()">See plans</a>
        </div>
      </app-modal>
    } @else {
      <app-modal title="Add account" sub="The bot logs in and starts playing right away." (closed)="closed()">
        <form id="add-form" class="grid gap-4" novalidate (ngSubmit)="submit()">
          <div class="seg w-full" role="group" aria-label="Login type">
            <button type="button" class="flex-1" [attr.aria-pressed]="kind() === 'guest'" (click)="kind.set('guest')">Guest UID</button>
            <button type="button" class="flex-1" [attr.aria-pressed]="kind() === 'token'" (click)="kind.set('token')">Access token</button>
          </div>
          @if (kind() === 'guest') {
            <div class="grid gap-1.5"><label class="label" for="f-uid">Guest UID</label>
              <input class="input font-mono" id="f-uid" name="uid" [(ngModel)]="uid" inputmode="numeric" autocomplete="off" placeholder="4012345678"></div>
            <div class="grid gap-1.5"><label class="label" for="f-pw">Password</label>
              <input class="input" id="f-pw" name="password" type="password" [(ngModel)]="password" autocomplete="new-password" placeholder="Guest account password"></div>
          } @else {
            <div class="grid gap-1.5"><label class="label" for="f-token">Access token</label>
              <textarea class="textarea font-mono text-[13px]" id="f-token" name="token" rows="3" [(ngModel)]="token" placeholder="Paste the access token"></textarea></div>
          }
          <p class="form-error" role="alert">{{ error() }}</p>
        </form>
        <div foot class="contents">
          <span class="mr-auto text-[13px] text-fg-3">{{ p.slots().used }} / {{ p.slots().max }} slots used</span>
          <button type="button" class="btn btn-secondary" (click)="closed()">Cancel</button>
          <button type="submit" form="add-form" class="btn btn-primary" [class.is-loading]="busy()" [disabled]="busy()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>
        </div>
      </app-modal>
    }`,
})
export class AddAccount {
  readonly p = inject(PanelData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly kind = signal<'guest' | 'token'>('guest');
  readonly error = signal('');
  readonly busy = signal(false);
  uid = '';
  password = '';
  token = '';
  readonly plural = fmt.plural;

  closed() { this.p.addOpen.set(false); }

  async submit() {
    this.error.set('');
    const uid = this.uid.trim(), token = this.token.trim();
    if (this.kind() === 'guest' && (!/^\d+$/.test(uid) || !this.password)) return this.error.set('Enter the numeric guest UID and its password.');
    if (this.kind() === 'token' && token.length < 20) return this.error.set('Paste a valid access token.');
    const payload = this.kind() === 'guest' ? { kind: 'guest', uid, password: this.password.trim() } : { kind: 'token', token };
    this.busy.set(true);
    try {
      await this.api.post('/api/panel/accounts/add', payload);
      this.closed();
      this.toasts.success('Account added — the bot is logging in');
      this.p.refresh();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-panel-layout',
  imports: [Shell, SubBadge, AddAccount, RouterLink],
  providers: [PanelData],
  template: `
    <app-shell [nav]="nav()" portal="Dashboard" base="/panel" [showAnnouncement]="true" [legacy]="legacy">
      <div sidebar class="mt-4 mb-2 grid gap-2 rounded-2xl border border-line-2 p-4"
        style="background: radial-gradient(120% 120% at 100% 0%, rgba(168,85,247,.16), transparent 60%), radial-gradient(120% 120% at 0% 100%, rgba(255,51,102,.12), transparent 60%), var(--c-surface-2)">
        <div class="flex items-center justify-between gap-2">
          <span class="eyebrow text-[11px]!">Your plan</span>
          <app-sub-badge [s]="p.sub()" />
        </div>
        <div class="font-display text-xl leading-tight font-bold">{{ p.sub().plan_name || 'Free' }}</div>
        <div class="-mt-1 text-[12.5px] text-fg-2">{{ timeLine() }}</div>
        <div class="bar" [class.full]="p.slots().full"><span [style.width.%]="p.sub().unlimited ? 100 : p.slots().pct"></span></div>
        <div class="text-xs text-fg-3">{{ p.slots().used }} of {{ p.slots().max }} account slots used</div>
        @if (!p.sub().unlimited) {
          <a class="btn btn-primary btn-sm mt-1 w-full" routerLink="/panel/billing">{{ p.sub().active ? 'Upgrade plan' : 'Get a plan' }}</a>
        }
      </div>
    </app-shell>
    @if (p.addOpen()) { <app-add-account /> }`,
})
export class PanelLayout {
  readonly p = inject(PanelData);
  private session = inject(Session);
  readonly legacy = { overview: '', plans: 'billing' };

  readonly nav = computed<NavItem[]>(() => {
    const items: NavItem[] = [
      { id: 'overview', path: '', label: 'Dashboard', icon: 'fa-house' },
      { id: 'accounts', label: 'Accounts', icon: 'fa-gamepad' },
      { id: 'plans', path: 'billing', label: 'Billing', icon: 'fa-credit-card' },
      { id: 'profile', label: 'Profile', icon: 'fa-user' },
    ];
    if (this.session.user()?.role === 'admin') items.push({ id: 'admin', label: 'Admin panel', icon: 'fa-shield-halved', href: '/admin' });
    return items;
  });

  readonly timeLine = computed(() => {
    const s = this.p.sub();
    if (s.unlimited) return 'Lifetime access';
    return s.active ? `${fmt.remaining(this.p.remaining())} left` : 'No active plan';
  });

  constructor() {
    this.session.loadInfo();
    every(4000, () => this.p.refresh());
  }
}
