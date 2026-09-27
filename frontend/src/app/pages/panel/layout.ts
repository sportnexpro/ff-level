import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { fmt } from '../../core/fmt';
import { every } from '../../core/poll';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Modal } from '../../ui/modal';
import { NavItem, Shell } from '../../ui/shell';
import { PanelData } from './panel-data';

/** Active / Expired / Owner / Suspended pill for a subscription. */
@Component({
  selector: 'app-sub-badge',
  imports: [Icon],
  template: `
    @if (s().banned) { <span class="badge badge-bad"><span class="dot"></span>Suspended</span> }
    @else if (s().unlimited) { <span class="badge badge-accent"><app-icon name="crown" [size]="12" />Owner</span> }
    @else if (s().active) { <span class="badge badge-ok"><span class="dot"></span>Active</span> }
    @else { <span class="badge badge-bad"><span class="dot"></span>Expired</span> }`,
})
export class SubBadge {
  readonly s = input.required<any>();
}

@Component({
  selector: 'app-add-account',
  imports: [Modal, FormsModule, RouterLink, Icon],
  template: `
    @if (!p.sub().active || p.slots().full) {
      <app-modal [title]="!p.sub().active ? 'No active plan' : 'All slots in use'" (closed)="closed()">
        <div class="grid justify-items-center gap-3 py-3 text-center">
          <span class="grid h-14 w-14 place-items-center rounded-2xl bg-ember/10 text-accent">
            <app-icon [name]="!p.sub().active ? 'lock' : 'layers'" [size]="24" />
          </span>
          <p class="max-w-sm text-[14.5px] text-fg-2">
            @if (!p.sub().active) { Buy a plan or redeem a license key to start adding accounts. }
            @else { Your plan allows {{ plural(p.sub().max_accounts, 'account') }}. Upgrade for more slots, or remove an account first. }
          </p>
        </div>
        <div foot class="contents">
          <button type="button" class="btn btn-secondary" (click)="closed()">Close</button>
          <a class="btn btn-brand" routerLink="/panel/billing" (click)="closed()">See plans</a>
        </div>
      </app-modal>
    } @else {
      <app-modal title="Add a Free Fire account" sub="The bot signs in and starts playing right away." (closed)="closed()">
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
          <span class="mr-auto text-[13px] text-fg-3">{{ p.slots().used }} of {{ p.slots().max }} slots used</span>
          <button type="button" class="btn btn-secondary" (click)="closed()">Cancel</button>
          <button type="submit" form="add-form" class="btn btn-primary" [class.is-loading]="busy()" [disabled]="busy()"><span>Add account</span></button>
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
      this.toasts.success('Account added — the bot is signing in');
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
  imports: [Shell, AddAccount, RouterLink, Icon],
  providers: [PanelData],
  template: `
    <app-shell [nav]="nav()" base="/panel" [showAnnouncement]="true" [legacy]="legacy">
      @if (p.loaded() && !p.sub().unlimited) {
        <a topbar routerLink="/panel/billing" class="mr-1 hidden items-center gap-2 rounded-full border border-line-2 bg-surface py-1 pr-3 pl-1.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)] transition hover:border-fg-3/40 sm:flex"
          [title]="p.sub().active ? 'Time left on your plan' : 'Get a plan'">
          <span class="grid h-6 w-6 place-items-center rounded-full" [class]="p.sub().active ? 'bg-ember/12 text-accent' : 'bg-bad/12 text-bad'"><app-icon name="timer" [size]="14" /></span>
          @if (p.sub().active) { <span class="text-fg-3">{{ p.sub().plan_name || 'Plan' }}</span><span class="num">{{ left() }}</span> }
          @else { <span class="text-bad">No active plan</span> }
        </a>
      }
    </app-shell>
    @if (p.addOpen()) { <app-add-account /> }`,
})
export class PanelLayout {
  readonly p = inject(PanelData);
  private session = inject(Session);
  readonly legacy = { overview: '', plans: 'billing' };
  readonly left = computed(() => fmt.remaining(this.p.remaining()));

  readonly nav = computed<NavItem[]>(() => {
    const items: NavItem[] = [
      { id: 'overview', path: '', label: 'Dashboard', icon: 'dashboard' },
      { id: 'accounts', label: 'Accounts', icon: 'gamepad' },
      { id: 'plans', path: 'billing', label: 'Billing', icon: 'card' },
      { id: 'profile', label: 'Profile', icon: 'user' },
    ];
    if (this.session.user()?.role === 'admin') items.push({ id: 'admin', label: 'Admin panel', icon: 'shield', href: '/admin', menu: true });
    return items;
  });

  constructor() {
    this.session.loadInfo();
    every(4000, () => this.p.refresh());
  }
}
