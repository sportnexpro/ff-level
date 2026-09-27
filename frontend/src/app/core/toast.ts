import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastItem { id: number; type: ToastType; message: string; leaving: boolean; }

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<ToastItem[]>([]);
  private seq = 0;
  private recent = new Map<string, number>();

  show(message: string, type: ToastType = 'success') {
    // Pages poll every few seconds: show the same error at most once every 20s.
    const key = `${type}:${message}`;
    if (type === 'error' && Date.now() - (this.recent.get(key) || 0) < 20000) return;
    this.recent.set(key, Date.now());
    const id = ++this.seq;
    this.items.update((list) => [...list.slice(-3), { id, type, message, leaving: false }]);
    setTimeout(() => {
      this.items.update((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => this.dismiss(id), 200);
    }, type === 'error' ? 5200 : 3400);
  }

  success(message: string) { this.show(message, 'success'); }
  info(message: string) { this.show(message, 'info'); }
  error(e: unknown) { this.show(e instanceof Error ? e.message : String(e), 'error'); }

  dismiss(id: number) {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
