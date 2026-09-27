import { Component, inject } from '@angular/core';
import { Confirm } from '../core/confirm';
import { Toasts } from '../core/toast';
import { Icon } from './icon';
import { Modal } from './modal';

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  template: `
    <div class="pointer-events-none fixed inset-x-3 bottom-[max(16px,env(safe-area-inset-bottom))] z-[100] grid justify-items-center gap-2 max-md:bottom-24"
      role="status" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-fg py-3 pr-3 pl-4 text-sm font-medium text-bg shadow-[0_20px_50px_-15px_rgba(0,0,0,.5)] transition duration-200"
          [class.opacity-0]="t.leaving" [class.translate-y-2]="t.leaving" style="animation: modal-in 260ms cubic-bezier(.16,1,.3,1)">
          <span class="grid h-6 w-6 flex-none place-items-center rounded-full"
            [class]="t.type === 'error' ? 'bg-bad text-white' : t.type === 'info' ? 'bg-info text-white' : 'bg-ok text-white'">
            <app-icon [name]="t.type === 'error' ? 'x' : t.type === 'info' ? 'info' : 'check'" [size]="14" [stroke]="2.6" />
          </span>
          <span class="min-w-0 flex-1">{{ t.message }}</span>
          <button type="button" class="grid h-7 w-7 place-items-center rounded-lg opacity-60 hover:opacity-100" (click)="toasts.dismiss(t.id)" aria-label="Dismiss"><app-icon name="x" [size]="15" /></button>
        </div>
      }
    </div>`,
})
export class ToastHost {
  readonly toasts = inject(Toasts);
}

@Component({
  selector: 'app-confirm-host',
  imports: [Modal],
  template: `
    @if (confirm.current(); as c) {
      <app-modal [title]="c.title" (closed)="confirm.finish(false)">
        <p class="text-[14.5px] leading-relaxed text-fg-2" [innerHTML]="c.message"></p>
        <div foot class="contents">
          <button type="button" class="btn btn-secondary" (click)="confirm.finish(false)">Cancel</button>
          <button type="button" class="btn" data-autofocus [class.btn-danger]="c.danger" [class.btn-primary]="!c.danger" (click)="confirm.finish(true)">{{ c.confirmText || 'Confirm' }}</button>
        </div>
      </app-modal>
    }`,
})
export class ConfirmHost {
  readonly confirm = inject(Confirm);
}
