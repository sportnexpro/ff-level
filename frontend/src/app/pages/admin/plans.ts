import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Confirm } from '../../core/confirm';
import { esc } from '../../core/fmt';
import { Toasts } from '../../core/toast';
import { Empty } from '../../ui/common';
import { Modal } from '../../ui/modal';
import { PriceCard } from '../panel/billing';
import { AdminData, Duration, fromDuration, toDuration } from './admin-data';

@Component({
  selector: 'app-plan-dialog',
  imports: [Modal, FormsModule],
  template: `
    <app-modal [title]="plan() ? 'Edit ' + plan().name : 'New plan'" sub="Customers see this on the website and in their panel." (closed)="closed.emit()">
      <form id="pl-form" class="grid gap-4" novalidate (ngSubmit)="submit()">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-1.5"><label class="label" for="pl-name">Plan name</label>
            <input class="input" id="pl-name" name="name" [(ngModel)]="f.name" placeholder="e.g. Pro"></div>
          <div class="grid gap-1.5"><label class="label" for="pl-price">Price ({{ admin.currency() }})</label>
            <input class="input" id="pl-price" name="price" type="number" min="0" step="1" [(ngModel)]="f.price" placeholder="450"></div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-1.5"><label class="label" for="pl-dur">Access duration</label>
            <div class="grid grid-cols-[1fr_110px] gap-2">
              <input class="input" id="pl-dur" name="dur" type="number" min="1" [(ngModel)]="dur.value">
              <select class="select" name="unit" [(ngModel)]="dur.unit" aria-label="Duration unit"><option [ngValue]="24">Days</option><option [ngValue]="1">Hours</option></select>
            </div></div>
          <div class="grid gap-1.5"><label class="label" for="pl-slots">Max accounts</label>
            <input class="input" id="pl-slots" name="max_accounts" type="number" min="1" [(ngModel)]="f.max_accounts">
            <span class="hint">Free Fire accounts that can level up at once.</span></div>
        </div>
        <div class="grid gap-1.5"><label class="label" for="pl-feat">Features <span class="font-normal text-fg-3">(one per line)</span></label>
          <textarea class="textarea" id="pl-feat" name="features" rows="4" [(ngModel)]="f.features"></textarea></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-1.5"><label class="label" for="pl-sort">Display order</label>
            <input class="input" id="pl-sort" name="sort_order" type="number" [(ngModel)]="f.sort_order"></div>
          <div class="grid content-end gap-3">
            <label class="switch"><input type="checkbox" name="is_popular" [(ngModel)]="f.is_popular">Highlight as “Most popular”</label>
            <label class="switch"><input type="checkbox" name="is_active" [(ngModel)]="f.is_active">Visible to customers</label>
          </div>
        </div>
        <p class="form-error" role="alert">{{ error() }}</p>
      </form>
      <div foot class="contents">
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="pl-form" class="btn btn-primary" [class.is-loading]="busy()" [disabled]="busy()">{{ plan() ? 'Save plan' : 'Create plan' }}</button>
      </div>
    </app-modal>`,
})
export class PlanDialog {
  readonly plan = input<any>(null);
  readonly closed = output<void>();
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly error = signal('');
  readonly busy = signal(false);
  f: any = {};
  dur: Duration = { value: 30, unit: 24 };

  ngOnInit() {
    const p = this.plan() || { name: '', price: null, duration_hours: 720, max_accounts: 1, features: '', is_popular: 0, is_active: 1, sort_order: this.admin.plans().length + 1 };
    this.f = { ...p, is_popular: !!p.is_popular, is_active: !!p.is_active };
    this.dur = toDuration(p.duration_hours);
  }

  async submit() {
    const f = this.f;
    const payload = { id: this.plan()?.id, name: String(f.name || '').trim(), price: +f.price, duration_hours: fromDuration(this.dur), max_accounts: +f.max_accounts, features: f.features || '', sort_order: +f.sort_order, is_popular: f.is_popular, is_active: f.is_active };
    this.busy.set(true);
    try {
      await this.api.post('/api/admin/plans/save', payload);
      this.toasts.success(this.plan() ? 'Plan saved' : 'Plan created');
      await this.admin.reloadPlans();
      this.closed.emit();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-admin-plans',
  imports: [PriceCard, PlanDialog, Empty],
  template: `
    <div class="grid animate-view-in gap-6">
      <div class="flex justify-end">
        <button type="button" class="btn btn-primary btn-sm" id="new-plan" (click)="editing.set('new')"><i class="fa-solid fa-plus" aria-hidden="true"></i>New plan</button>
      </div>
      <div class="grid gap-5 pt-2 sm:grid-cols-2 xl:grid-cols-3">
        @for (p of admin.plans(); track p.id) {
          <div class="relative" [class.opacity-60]="!p.is_active">
            <span class="absolute top-5 right-5 z-10 badge" [class.badge-ok]="p.is_active">{{ p.is_active ? 'Visible' : 'Hidden' }}</span>
            <app-price-card [plan]="p" [currency]="admin.currency()">
              <div class="flex gap-2">
                <button type="button" class="btn btn-secondary flex-1" [attr.data-edit]="p.id" (click)="editing.set(p)"><i class="fa-solid fa-pen" aria-hidden="true"></i>Edit</button>
                <button type="button" class="btn btn-danger btn-icon" (click)="remove(p)" [attr.aria-label]="'Delete ' + p.name"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
              </div>
            </app-price-card>
          </div>
        } @empty {
          <div class="card sm:col-span-2 xl:col-span-3"><app-empty icon="fa-crown" title="No plans yet" text="Create your first plan: set its price, how long access lasts and how many accounts it allows." /></div>
        }
      </div>
    </div>
    @if (editing(); as e) { <app-plan-dialog [plan]="e === 'new' ? null : e" (closed)="editing.set(null)" /> }`,
})
export class AdminPlans {
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  readonly editing = signal<any>(null);

  constructor() {
    this.admin.reloadPlans().catch((e) => this.toasts.error(e));
  }

  async remove(p: any) {
    const ok = await this.confirm.ask({ title: `Delete ${esc(p.name)}?`, message: 'Existing customers keep their current access. Tip: you can hide a plan instead of deleting it.', confirmText: 'Delete plan', danger: true });
    if (!ok) return;
    try {
      await this.api.post('/api/admin/plans/delete', { id: p.id });
      this.toasts.info('Plan deleted');
      await this.admin.reloadPlans();
    } catch (e) { this.toasts.error(e); }
  }
}
