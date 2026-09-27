import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { contactUrls, fmt } from '../../core/fmt';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Avatar, ThemeToggle } from '../../ui/common';
import { SubBadge } from './layout';
import { PanelData } from './panel-data';

@Component({
  selector: 'app-panel-profile',
  imports: [Avatar, SubBadge, RouterLink, FormsModule, ThemeToggle],
  template: `
    <div class="grid animate-view-in gap-6">
      <div class="card overflow-hidden">
        <div class="relative h-32 sm:h-40" aria-hidden="true"
          style="background: radial-gradient(60% 120% at 85% 0%, rgba(168,85,247,.9), transparent 70%), linear-gradient(120deg, #e11d48 0%, #ff3366 40%, #a855f7 100%)">
          <div class="absolute inset-0 opacity-25" style="background-image: linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px); background-size: 32px 32px; mask-image: linear-gradient(180deg, #000, transparent)"></div>
        </div>
        <div class="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <div class="-mt-12 rounded-[22px] bg-surface p-1.5 shadow-lg"><app-avatar [name]="user()?.username" [size]="88" /></div>
          <div class="min-w-0 flex-1 pb-1">
            <h2 class="flex flex-wrap items-center gap-2.5 text-2xl">{{ user()?.username }} <app-sub-badge [s]="p.sub()" /></h2>
            <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-fg-3">
              <span><i class="fa-regular fa-calendar mr-1.5" aria-hidden="true"></i>Joined {{ day(user()?.created_at) }}</span>
              <span><i class="fa-solid fa-crown mr-1.5" aria-hidden="true"></i>{{ p.sub().plan_name || 'No plan' }}</span>
            </p>
          </div>
          <a class="btn btn-secondary btn-sm mb-1" routerLink="/panel/billing"><i class="fa-solid fa-crown" aria-hidden="true"></i>Manage plan</a>
        </div>
        <div class="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          @for (s of stats(); track s[0]; let i = $index) {
            <div class="border-line px-5 py-4 sm:px-7" [class]="(i % 2 ? 'border-l ' : '') + (i > 1 ? 'border-t sm:border-t-0 ' : '') + (i === 2 ? 'sm:border-l' : '')">
              <small class="text-xs font-semibold text-fg-3">{{ s[0] }}</small>
              @if (!p.loaded()) { <div class="skeleton mt-2 h-7 w-16"></div> }
              @else { <b class="mt-1 block font-display text-2xl" [class]="s[2]">{{ s[1] }}</b> }
            </div>
          }
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="card">
          <div class="card-head"><h3 class="card-title"><i class="fa-solid fa-id-card" aria-hidden="true"></i>Account details</h3></div>
          <dl class="grid">
            @for (d of details(); track d[1]) {
              <div class="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
                <span class="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-[13px] text-fg-3 dark:bg-white/5"><i class="fa-solid {{ d[0] }}" aria-hidden="true"></i></span>
                <dt class="flex-1 text-sm text-fg-3">{{ d[1] }}</dt>
                <dd class="text-right text-sm font-semibold">{{ d[2] }}</dd>
              </div>
            }
          </dl>
        </div>

        <div class="grid content-start gap-6">
          <div class="card">
            <div class="card-head"><h3 class="card-title"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i>Security</h3></div>
            <form class="grid gap-4 p-5" novalidate (ngSubmit)="changePassword()">
              <div class="grid gap-1.5"><label class="label" for="pw-cur">Current password</label>
                <input class="input" id="pw-cur" name="current" type="password" [(ngModel)]="current" autocomplete="current-password"></div>
              <div class="grid gap-1.5"><label class="label" for="pw-new">New password</label>
                <input class="input" id="pw-new" name="new" type="password" [(ngModel)]="next" autocomplete="new-password">
                <span class="hint">At least 6 characters. Other devices will be signed out.</span></div>
              <p class="form-error" role="alert">{{ error() }}</p>
              <div class="flex flex-wrap gap-2.5">
                <button class="btn btn-primary" type="submit" [class.is-loading]="busy()" [disabled]="busy()">Update password</button>
                <a class="btn btn-ghost" href="/logout"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>Sign out</a>
              </div>
            </form>
          </div>
          <div class="card">
            <div class="card-head"><div>
              <h3 class="card-title"><i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i>Appearance</h3>
              <div class="card-sub">Auto follows your device setting.</div>
            </div></div>
            <div class="p-5"><app-theme-toggle [full]="true" /></div>
          </div>
        </div>
      </div>

      @if (contact().telegram || contact().whatsapp) {
        <div class="card flex flex-wrap items-center gap-4 p-5">
          <div class="min-w-0 flex-1"><b class="block">Need help?</b><span class="text-[13.5px] text-fg-3">Message support and we will get back to you.</span></div>
          <div class="flex gap-2">
            @if (contact().telegram) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().telegram"><i class="fa-brands fa-telegram" aria-hidden="true"></i>Telegram</a> }
            @if (contact().whatsapp) { <a class="btn btn-secondary btn-sm" target="_blank" rel="noopener" [href]="contact().whatsapp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i>WhatsApp</a> }
          </div>
        </div>
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
      ['fa-user', 'Username', u?.username],
      ['fa-crown', 'Plan', s.plan_name || '—'],
      ['fa-clock', 'Access until', s.unlimited ? 'Lifetime' : fmt.date(s.expires_at)],
      ['fa-layer-group', 'Account slots', `${s.used || 0} / ${s.unlimited ? '∞' : s.max_accounts || 0}`],
      ['fa-calendar', 'Member since', fmt.day(u?.created_at)],
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
