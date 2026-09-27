import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';

let seq = 0;

/**
 * Native <dialog> that opens as soon as it is rendered. Show it with @if and
 * drop it on (closed):  @if (open()) { <app-modal (closed)="open.set(false)"> … <div foot>…</div> </app-modal> }
 */
@Component({
  selector: 'app-modal',
  template: `
    <dialog #dlg class="modal" [class.wide]="wide()" [attr.aria-labelledby]="tid" (close)="closed.emit()" (click)="onClick($event)">
      <header class="flex items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4 sm:px-6">
        <div class="min-w-0">
          <h3 [id]="tid" class="text-lg leading-tight">{{ heading() }}</h3>
          @if (sub()) { <p class="mt-1 text-[13.5px] text-fg-3">{{ sub() }}</p> }
        </div>
        <button class="btn btn-ghost btn-icon btn-sm -mt-1 -mr-2" type="button" (click)="close()" aria-label="Close">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>
      <div class="grid min-h-0 gap-5 overflow-y-auto px-5 py-5 sm:px-6"><ng-content /></div>
      <footer class="flex flex-wrap items-center justify-end gap-2.5 border-t border-line bg-surface-2/60 px-5 py-4 sm:px-6">
        <ng-content select="[foot]" />
      </footer>
    </dialog>`,
})
export class Modal implements AfterViewInit {
  readonly heading = input('', { alias: 'title' });
  readonly sub = input('');
  readonly wide = input(false);
  readonly closed = output<void>();
  readonly tid = `dlg-${++seq}`;
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  ngAfterViewInit() {
    const d = this.dlg().nativeElement;
    d.showModal();
    const first = d.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]):not([readonly]), select, textarea:not([readonly])');
    (first || d.querySelector<HTMLElement>('[data-autofocus]'))?.focus();
  }

  close() {
    this.dlg().nativeElement.close();
  }

  onClick(e: MouseEvent) {
    if (e.target === this.dlg().nativeElement) this.close();
  }
}
