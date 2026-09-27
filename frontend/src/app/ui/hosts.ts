import { Component, inject } from '@angular/core';
import { Confirm } from '../core/confirm';
import { Toasts } from '../core/toast';
import { Modal } from './modal';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="pointer-events-none fixed right-4 bottom-4 left-4 z-[100] grid justify-items-center gap-2 sm:left-auto sm:justify-items-end" role="status" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line-2 bg-surface px-4 py-3 text-sm font-medium shadow-[0_20px_50px_-20px_rgba(0,0,0,.5)] transition duration-200"
          [class.opacity-0]="t.leaving" [class.translate-y-1]="t.leaving" style="animation: modal-in 200ms cubic-bezier(.2,.8,.2,1)">
          <i class="fa-solid mt-0.5" aria-hidden="true"
            [class.fa-circle-check]="t.type === 'success'" [class.text-ok]="t.type === 'success'"
            [class.fa-circle-exclamation]="t.type === 'error'" [class.text-bad]="t.type === 'error'"
            [class.fa-circle-info]="t.type === 'info'" [class.text-info]="t.type === 'info'"></i>
          <span class="min-w-0 flex-1">{{ t.message }}</span>
          <button type="button" class="-mr-1 text-fg-3 hover:text-fg" (click)="toasts.dismiss(t.id)" aria-label="Dismiss"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
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
