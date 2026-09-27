import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';

export interface Slots { used: number; max: number | '∞'; pct: number; free: string; full: boolean; }

/** Live data for the user panel: one /api/panel/overview poll shared by every page. */
@Injectable()
export class PanelData {
  private api = inject(Api);
  private session = inject(Session);
  private toasts = inject(Toasts);

  readonly data = signal<any | null>(null);
  readonly loaded = computed(() => !!this.data());
  /** Ticks every second, for countdowns. */
  readonly now = signal(Date.now() / 1000);
  private offset = 0;
  readonly addOpen = signal(false);
  /** Total EXP gained, sampled on every refresh while the panel is open (for the live chart). */
  readonly history = signal<number[]>([]);

  readonly user = computed(() => this.data()?.user || this.session.user());
  readonly sub = computed(() => this.user()?.subscription || {});
  readonly accounts = computed<any[]>(() => this.data()?.accounts || []);
  readonly totals = computed(() => this.data()?.totals || {});
  readonly logs = computed<any[]>(() => this.data()?.logs || []);
  readonly remaining = computed(() => Math.max(0, (this.sub().expires_at || 0) - (this.now() + this.offset)));

  readonly slots = computed<Slots>(() => {
    const s = this.sub();
    const used = s.used || 0;
    if (s.unlimited) return { used, max: '∞', pct: 0, free: 'Unlimited', full: false };
    const max = s.max_accounts || 0;
    return { used, max, pct: max ? Math.min(100, (used / max) * 100) : 0, free: `${Math.max(0, max - used)} free`, full: used >= max };
  });

  constructor() {
    const id = setInterval(() => this.now.set(Date.now() / 1000), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  async refresh() {
    try {
      const d = await this.api.get('/api/panel/overview');
      this.offset = d.now - Date.now() / 1000;
      this.data.set(d);
      this.history.update((h) => [...h, Number(d.totals?.gained_exp) || 0].slice(-60));
      this.session.user.set(d.user);
      return d;
    } catch (e) {
      this.toasts.error(e);
      return null;
    }
  }
}
