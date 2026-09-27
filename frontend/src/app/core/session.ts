import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';

/** Public site info (branding + plans) and the signed-in user, loaded once and shared. */
@Injectable({ providedIn: 'root' })
export class Session {
  private api = inject(Api);
  readonly settings = signal<any>({ site_name: 'FF Level', currency: '৳', allow_register: true, payment_methods: [] });
  readonly plans = signal<any[]>([]);
  readonly user = signal<any | null>(null);
  readonly infoLoaded = signal(false);

  private infoPromise?: Promise<void>;
  private mePromise?: Promise<any | null>;

  loadInfo(): Promise<void> {
    this.infoPromise ??= this.api.get('/api/public/info').then((r) => {
      this.settings.set(r.settings);
      this.plans.set(r.plans);
      this.infoLoaded.set(true);
      document.title = document.title.replace(/FF Level/, r.settings.site_name || 'FF Level');
    }).catch(() => { this.infoPromise = undefined; });
    return this.infoPromise;
  }

  /** Resolves to the user, or null when signed out. */
  loadMe(): Promise<any | null> {
    this.mePromise ??= this.api.get('/api/me', { quiet401: true })
      .then((r) => { this.user.set(r.user); return r.user; })
      .catch(() => { this.mePromise = undefined; return null; });
    return this.mePromise;
  }

  currency() { return this.settings().currency || '৳'; }
}
