import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { contactUrls, fmt } from '../../core/fmt';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Avatar, ThemeToggle } from '../../ui/common';
import { Icon } from '../../ui/icon';
import { SubBadge } from './layout';
import { PanelData } from './panel-data';

@Component({
  selector: 'app-panel-profile',
  imports: [Avatar, SubBadge, RouterLink, FormsModule, ThemeToggle, Icon],
  template: `
    <div class="grid animate-view-in gap-5">
      <section class="card relative overflow-hidden">
        <div class="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80" aria-hidden="true"
          style="background: radial-gradient(60% 140% at 15% 0%, rgba(255,178,36,.28), transparent 70%), radial-gradient(60% 140% at 85% 0%, rgba(255,61,46,.22), transparent 70%)"></div>
        <div class="relative flex flex-wrap items-center gap-5 p-5 sm:p-7">
          <div class="rounded-[26px] bg-surface p-1 shadow-lg ring-1 ring-line"><app-avatar [name]="user()?.username" [size]="80" /></div>
          <div class="min-w-0 flex-1">
            <h2 class="flex flex-wrap items-center gap-2.5 text-2xl">{{ user()?.username }} <app-sub-badge [s]="p.sub()" /></h2>
            <p class="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-fg-3">
              <span class="inline-flex items-center gap-1.5"><app-icon name="calendar" [size]="14" />Joined {{ day(user()?.created_at) }}</span>
              <span class="inline-flex items-center gap-1.5"><app-icon name="crown" [size]="14" />{{ p.sub().plan_name || 'No plan' }}</span>
            </p>
          </div>
          <a class="btn btn-secondary btn-sm" routerLink="/panel/billing"><app-icon name="card" [size]="15" /><span>Manage plan</span></a>
        </div>
        <div class="relative grid grid-cols-2 border-t border-line sm:grid-cols-4">
          @for (s of stats(); track s[0]; let i = $index) {
            <div class="border-line px-5 py-4 sm:px-7" [class]="(i % 2 ? 'border-l ' : '') + (i > 1 ? 'border-t sm:border-t-0 ' : '') + (i === 2 ? 'sm:border-l' : '')">
              <small class="text-[12px] text-fg-3">{{ s[0] }}</small>
              @if (!p.loaded()) { <div class="skeleton mt-2 h-7 w-16"></div> }
              @else { <b class="num mt-1 block text-[22px] font-semibold tracking-[-0.03em]" [class]="s[2]">{{ s[1] }}</b> }
            </div>
          }
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="card overflow-hidden">
          <div class="card-head pb-3"><h3 class="card-title">Account details</h3></div>
          <dl class="border-t border-line">
            @for (d of details(); track d[1]) {
              <div class="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
                <app-icon [name]="d[0]" [size]="16" class="text-fg-3" />
                <dt class="flex-1 text-sm text-fg-3">{{ d[1] }}</dt>
                <dd class="num text-right text-sm font-medium">{{ d[2] }}</dd>
              </div>
            }
          </dl>
        </section>

        <div class="grid content-start gap-5">
          <section class="card">
            <div class="card-head"><div><h3 class="card-title">Password</h3><p class="card-sub">Other devices are signed out when you change it.</p></div></div>
            <form class="grid gap-4 p-5 pt-4" novalidate (ngSubmit)="changePassword()">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-1.5"><label class="label" for="pw-cur">Current password</label>
                  <input class="input" id="pw-cur" name="current" type="password" [(ngModel)]="current" autocomplete="current-password"></div>
                <div class="grid gap-1.5"><label class="label" for="pw-new">New password</label>
                  <input class="input" id="pw-new" name="new" type="password" [(ngModel)]="next" autocomplete="new-password" placeholder="6+ characters"></div>
              </div>
              <p class="form-error" role="alert">{{ error() }}</p>
              <div class="flex flex-wrap gap-2.5">
                <button class="btn btn-primary" type="submit" [class.is-loading]="busy()" [disabled]="busy()"><span>Update password</span></button>
                <a class="btn btn-ghost" href="/logout"><app-icon name="logout" [size]="16" /><span>Sign out</span></a>
              </div>
            </form>
          </section>
          <section class="card">
            <div class="card-head"><div><h3 class="card-title">Appearance</h3><p class="card-sub">Auto follows your device setting.</p></div></div>
            <div class="p-5 pt-4"><app-theme-toggle [full]="true" /></div>
          </section>
        </div>
      </div>

      @if (contact().telegram || contact().whatsapp) {
        <section class="card flex flex-wrap items-center gap-4 p-5">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-ember/10 text-accent"><app-icon name="headset" [size]="19" /></span>
          <div class="min-w-0 flex-1"><b class="block font-semibold">Need help?</b><span class="text-[13.5px] text-fg-3">Message support and we'll get back to you.</span></div>
          <div class="flex gap-2">
            @if (contact().telegram) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().telegram"><app-icon name="telegram" [size]="14" /><span>Telegram</span></a> }
            @if (contact().whatsapp) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().whatsapp"><app-icon name="whatsapp" [size]="14" /><span>WhatsApp</span></a> }
          </div>
        </section>
      }
    </div>`,
})
export class PanelProfile {
  readonly p = inject(PanelData);
  private session = inject(Session);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly user = this.p.user;
  readonly day = fmt.day;
  readonly contact = computed(() => contactUrls(this.session.settings()));
  readonly error = signal('');
  readonly busy = signal(false);
  current = '';
  next = '';

  readonly stats = computed(() => {
    const s = this.p.sub(), t = this.p.totals();
    return [
      ['Accounts', `${s.used || 0} / ${s.unlimited ? '∞' : s.max_accounts || 0}`, ''],
      ['EXP gained', `+${fmt.compact(t.gained_exp)}`, 'text-ok'],
      ['Matches', fmt.num(t.matches), ''],
      ['Time left', s.unlimited ? 'Lifetime' : fmt.remaining(this.p.remaining()), !s.unlimited && !s.active ? 'text-bad' : ''],
    ];
  });

  readonly details = computed(() => {
    const s = this.p.sub(), u = this.user();
    return [
      ['user', 'Username', u?.username],
      ['crown', 'Plan', s.plan_name || '—'],
      ['clock', 'Access until', s.unlimited ? 'Lifetime' : fmt.date(s.expires_at)],
      ['layers', 'Account slots', `${s.used || 0} / ${s.unlimited ? '∞' : s.max_accounts || 0}`],
      ['calendar', 'Member since', fmt.day(u?.created_at)],
    ];
  });

  async changePassword() {
    this.error.set('');
    if (this.next.length < 6) return this.error.set('New password must be at least 6 characters.');
    this.busy.set(true);
    try {
      await this.api.post('/api/panel/password', { current: this.current, new: this.next });
      this.current = this.next = '';
      this.toasts.success('Password updated');
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}
