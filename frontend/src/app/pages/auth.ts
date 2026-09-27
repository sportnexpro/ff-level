import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Session } from '../core/session';
import { Brand, ThemeToggle } from '../ui/common';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-auth',
  imports: [RouterLink, FormsModule, Brand, ThemeToggle],
  template: `
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <span class="absolute top-[-180px] left-1/2 h-[380px] w-[560px] -translate-x-[75%] rounded-full bg-[#ff3366] opacity-20 blur-[90px] dark:opacity-30"></span>
      <span class="absolute top-[-120px] left-1/2 h-[380px] w-[520px] -translate-x-[5%] rounded-full bg-[#7c3aed] opacity-15 blur-[90px] dark:opacity-25"></span>
    </div>

    <div class="flex min-h-screen flex-col px-4">
      <header class="mx-auto flex w-full max-w-[1140px] items-center justify-between py-5">
        <a routerLink="/" class="rounded-lg"><app-brand [name]="site()" /></a>
        <app-theme-toggle />
      </header>

      <main class="grid flex-1 place-items-center py-8">
        <div class="w-full max-w-[440px] animate-view-in">
          <div class="grad-border rounded-[22px] p-6 shadow-[0_40px_90px_-40px_rgba(255,51,102,.45)] sm:p-8">
            <div class="text-center">
              <h1 class="text-[26px] leading-tight">{{ copy()[0] }}</h1>
              <p class="mt-1.5 text-sm text-fg-3">{{ copy()[1] }}</p>
            </div>

            @if (allowRegister()) {
              <div class="seg mt-6 w-full" role="group" aria-label="Sign in or create account">
                <button type="button" class="flex-1" [attr.aria-pressed]="mode() === 'login'" (click)="setMode('login')">Sign in</button>
                <button type="button" class="flex-1" [attr.aria-pressed]="mode() === 'register'" (click)="setMode('register')">Create account</button>
              </div>
            }

            <form class="mt-6 grid gap-4" novalidate (ngSubmit)="submit()">
              <div class="grid gap-1.5">
                <label class="label" for="a-user">Username</label>
                <div class="relative">
                  <i class="fa-solid fa-user pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-fg-3" aria-hidden="true"></i>
                  <input class="input pl-10" id="a-user" name="username" [(ngModel)]="username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="your_username" required autofocus>
                </div>
              </div>
              <div class="grid gap-1.5">
                <label class="label" for="a-pass">Password</label>
                <div class="relative">
                  <i class="fa-solid fa-lock pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-fg-3" aria-hidden="true"></i>
                  <input class="input pr-12 pl-10" id="a-pass" name="password" [type]="show() ? 'text' : 'password'" [(ngModel)]="password"
                    [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" placeholder="••••••••" required>
                  <button type="button" class="absolute top-1/2 right-1.5 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg"
                    (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
                    <i class="fa-regular" [class.fa-eye]="!show()" [class.fa-eye-slash]="show()" aria-hidden="true"></i>
                  </button>
                </div>
                @if (mode() === 'register') { <span class="hint">At least 6 characters.</span> }
              </div>
              <p class="form-error" role="alert">{{ error() }}</p>
              <button class="btn btn-primary btn-lg w-full" type="submit" id="auth-submit" [class.is-loading]="busy()" [disabled]="busy()">{{ copy()[2] }}</button>
            </form>

            @if (!allowRegister()) {
              <p class="mt-5 text-center text-[13.5px] text-fg-3">New accounts are created by the seller. Contact support to get access.</p>
            }
          </div>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-[13px] text-fg-3">
            <a routerLink="/" class="hover:text-fg"><i class="fa-solid fa-arrow-left mr-1.5" aria-hidden="true"></i>Back to home</a>
            <span><i class="fa-solid fa-shield-halved mr-1.5 text-ok" aria-hidden="true"></i>Private — only you see your accounts</span>
          </div>
        </div>
      </main>
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
    ? ['Welcome back', 'Sign in to your dashboard', 'Sign in']
    : ['Create your account', 'Takes 10 seconds — pick a plan right after', 'Create account']);
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
