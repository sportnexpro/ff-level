import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Session } from '../core/session';
import { Brand, ThemeToggle } from '../ui/common';
import { Icon } from '../ui/icon';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-auth',
  imports: [RouterLink, FormsModule, Brand, ThemeToggle, Icon],
  template: `
    <div class="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <!-- brand side (desktop) -->
      <aside class="relative hidden overflow-hidden bg-[#0b0b0d] p-10 text-white lg:flex lg:flex-col">
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
          <div class="absolute -top-40 -left-20 h-[500px] w-[500px] rounded-full bg-ember/35 blur-[120px]"></div>
          <div class="absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[#ff3d2e]/25 blur-[120px]"></div>
          <div class="absolute inset-0 opacity-50 [background-size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_30%_40%,#000,transparent)]"
            style="background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)"></div>
        </div>
        <a routerLink="/" class="relative inline-flex items-center gap-2.5 self-start rounded-lg">
          <span class="brand-mark"><app-icon name="flame" [size]="17" [stroke]="2.4" /></span>
          <span class="text-[16.5px] font-semibold tracking-[-0.02em]">{{ site() }}</span>
        </a>
        <div class="relative mt-auto max-w-[460px]">
          <h2 class="text-[44px] leading-[1.02] tracking-[-0.045em]">Level up while<br><span class="ember-text">you sleep.</span></h2>
          <p class="mt-5 text-[16px] leading-relaxed text-white/60">Real matches, played around the clock in the cloud — with every level and every point of EXP on your own private dashboard.</p>
          <ul class="mt-8 grid gap-3.5 text-[14.5px] text-white/80">
            @for (f of perks; track f) {
              <li class="flex items-center gap-3"><span class="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-ember-2"><app-icon name="check" [size]="13" [stroke]="3" /></span>{{ f }}</li>
            }
          </ul>
        </div>
        <p class="relative mt-16 text-[12.5px] text-white/40">Not affiliated with Garena or Free Fire.</p>
      </aside>

      <!-- form side -->
      <div class="flex min-h-screen flex-col px-5 sm:px-8">
        <header class="flex items-center justify-between py-5">
          <a routerLink="/" class="rounded-lg lg:invisible"><app-brand [name]="site()" /></a>
          <div class="flex items-center gap-1">
            <a routerLink="/" class="btn btn-ghost btn-sm hidden sm:inline-flex"><app-icon name="arrow-left" [size]="15" /><span>Home</span></a>
            <app-theme-toggle />
          </div>
        </header>

        <main class="grid flex-1 place-items-center pb-16">
          <div class="w-full max-w-[400px] animate-view-in">
            <h1 class="text-[30px] leading-tight tracking-[-0.035em]">{{ copy()[0] }}</h1>
            <p class="mt-2 text-[15px] text-fg-3">{{ copy()[1] }}</p>

            @if (allowRegister()) {
              <div class="seg mt-8 w-full" role="group" aria-label="Sign in or create account">
                <button type="button" class="flex-1" [attr.aria-pressed]="mode() === 'login'" (click)="setMode('login')">Sign in</button>
                <button type="button" class="flex-1" [attr.aria-pressed]="mode() === 'register'" (click)="setMode('register')">Create account</button>
              </div>
            }

            <form class="mt-6 grid gap-4" novalidate (ngSubmit)="submit()">
              <div class="grid gap-1.5">
                <label class="label" for="a-user">Username</label>
                <input class="input h-12" id="a-user" name="username" [(ngModel)]="username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="your_username" required autofocus>
              </div>
              <div class="grid gap-1.5">
                <label class="label" for="a-pass">Password</label>
                <div class="relative">
                  <input class="input h-12 pr-12" id="a-pass" name="password" [type]="show() ? 'text' : 'password'" [(ngModel)]="password"
                    [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" placeholder="••••••••" required>
                  <button type="button" class="absolute top-1/2 right-1.5 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg"
                    (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
                    <app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="17" />
                  </button>
                </div>
                @if (mode() === 'register') { <span class="hint">At least 6 characters.</span> }
              </div>
              <p class="form-error" role="alert">{{ error() }}</p>
              <button class="btn btn-primary btn-lg mt-1 w-full" type="submit" id="auth-submit" [class.is-loading]="busy()" [disabled]="busy()">
                <span>{{ copy()[2] }}</span><app-icon name="arrow-right" [size]="17" /></button>
            </form>

            @if (!allowRegister()) {
              <p class="mt-6 text-[13.5px] text-fg-3">New accounts are created by the seller. Contact support to get access.</p>
            }
            <p class="mt-8 flex items-center gap-2 text-[13px] text-fg-3"><app-icon name="shield-check" [size]="16" class="text-ok" />Private — only you can see your accounts.</p>
          </div>
        </main>
      </div>
    </div>`,
})
export class Auth {
  private api = inject(Api);
  readonly session = inject(Session);
  readonly mode = signal<Mode>(inject(ActivatedRoute).snapshot.data['mode'] === 'register' ? 'register' : 'login');
  readonly show = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly site = computed(() => this.session.settings().site_name || 'FF Level');
  readonly allowRegister = computed(() => this.session.settings().allow_register !== false);
  readonly copy = computed(() => this.mode() === 'login'
    ? ['Welcome back', 'Sign in to your dashboard.', 'Sign in']
    : ['Create your account', 'Takes 10 seconds — pick a plan right after.', 'Create account']);
  readonly perks = ['Runs 24/7 — no phone or PC needed', 'Live level progress and EXP per hour', 'Several accounts at once', 'Pay with bKash, Nagad or a license key'];
  username = '';
  password = '';

  constructor() {
    this.session.loadInfo();
    effect(() => {
      document.title = `${this.mode() === 'login' ? 'Sign in' : 'Create account'} · ${this.site()}`;
      if (!this.allowRegister() && this.mode() === 'register') this.setMode('login');
    });
  }

  setMode(m: Mode) {
    this.mode.set(m);
    this.error.set('');
    history.replaceState(history.state, '', m === 'login' ? '/login' : '/register');
  }

  async submit() {
    const username = this.username.trim();
    const password = this.password;
    this.error.set('');
    if (!username || !password) return this.error.set('Enter your username and password.');
    if (this.mode() === 'register' && !/^[A-Za-z0-9_.]{3,24}$/.test(username)) return this.error.set('Username: 3–24 characters, letters, numbers, _ or .');
    if (this.mode() === 'register' && password.length < 6) return this.error.set('Password must be at least 6 characters.');
    this.busy.set(true);
    try {
      const r = await this.api.post(`/api/auth/${this.mode()}`, { username, password });
      // Full load so the new session cookie is picked up everywhere.
      location.href = this.mode() === 'register' ? '/panel/billing' : r.redirect;
    } catch (e: any) {
      this.error.set(e.message);
      this.busy.set(false);
    }
  }
}
