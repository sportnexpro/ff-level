import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  /** Trusted HTML: escape any user data with esc() before passing it in. */
  message: string;
  confirmText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class Confirm {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    this.current()?.resolve(false);
    return new Promise((resolve) => this.current.set({ ...opts, resolve }));
  }

  finish(ok: boolean) {
    const req = this.current();
    this.current.set(null);
    req?.resolve(ok);
  }
}
