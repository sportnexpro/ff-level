import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'ff-theme';

/** Light / dark / follow-the-system theme, stored per browser. */
@Injectable({ providedIn: 'root' })
export class Theme {
  readonly mode = signal<ThemeMode>(this.read());
  private readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()));

  constructor() {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      const dark = this.dark();
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#09090b' : '#fafafa');
    });
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    try { localStorage.setItem(KEY, mode); } catch { /* private mode */ }
  }

  toggle() {
    this.set(this.dark() ? 'light' : 'dark');
  }

  private read(): ThemeMode {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch { /* private mode */ }
    return 'system';
  }
}
