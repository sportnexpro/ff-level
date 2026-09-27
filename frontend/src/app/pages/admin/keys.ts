import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Confirm } from '../../core/confirm';
import { copyText, esc, fmt } from '../../core/fmt';
import { Toasts } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Empty } from '../../ui/common';
import { AdminData, Duration, fromDuration } from './admin-data';

@Component({
  selector: 'app-admin-keys',
  imports: [Icon, FormsModule, Empty],
  template: `
    <div class="grid animate-view-in gap-6">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div class="card">
          <div class="card-head"><div>
            <h3 class="card-title"><app-icon name="key-round" [size]="16" />Generate license keys</h3>
            <div class="card-sub">Sell keys anywhere — customers redeem them in their panel.</div>
          </div></div>
          <div class="grid gap-5 p-5">
            <form class="grid gap-4" novalidate (ngSubmit)="generate()">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-1.5"><label class="label" for="k-plan">Key gives</label>
                  <select class="select" id="k-plan" name="plan" [(ngModel)]="plan">
                    @for (p of admin.plans(); track p.id) { <option [value]="'' + p.id">{{ admin.planLabel(p) }}</option> }
                    <option value="custom">Custom…</option>
                  </select></div>
                <div class="grid gap-1.5"><label class="label" for="k-count">How many keys</label>
                  <input class="input" id="k-count" name="count" type="number" min="1" max="200" [(ngModel)]="count"></div>
              </div>
              @if (plan === 'custom') {
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="grid gap-1.5"><label class="label" for="k-dur">Access duration</label>
                    <div class="grid grid-cols-[1fr_110px] gap-2">
                      <input class="input" id="k-dur" name="dur" type="number" min="1" [(ngModel)]="dur.value">
                      <select class="select" name="unit" [(ngModel)]="dur.unit" aria-label="Duration unit"><option [ngValue]="24">Days</option><option [ngValue]="1">Hours</option></select>
                    </div></div>
                  <div class="grid gap-1.5"><label class="label" for="k-slots">Max accounts</label>
                    <input class="input" id="k-slots" name="max_accounts" type="number" min="1" [(ngModel)]="slots"></div>
                </div>
                <div class="grid gap-1.5"><label class="label" for="k-label">Plan label</label>
                  <input class="input" id="k-label" name="plan_name" [(ngModel)]="planName" placeholder="Custom"></div>
              }
              <div class="grid gap-1.5"><label class="label" for="k-note">Note <span class="font-normal text-fg-3">(optional)</span></label>
                <input class="input" id="k-note" name="note" [(ngModel)]="note" placeholder="e.g. Reseller batch — Rahim"></div>
              <p class="form-error" role="alert">{{ error() }}</p>
              <div><button class="btn btn-primary" type="submit" [class.is-loading]="busy()" [disabled]="busy()"><app-icon name="wand" [size]="16" />Generate keys</button></div>
            </form>
            @if (fresh().length) {
              <div class="grid gap-2.5 rounded-xl border border-ok/25 bg-ok/[0.06] p-4">
                <div class="flex items-center justify-between gap-3">
                  <span class="label">{{ fresh().length }} new key(s)</span>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="copyAll(fresh(), 'Keys copied')"><app-icon name="copy" [size]="16" />Copy all</button>
                </div>
                <textarea class="textarea font-mono text-[13px]" rows="5" readonly aria-label="Generated keys">{{ fresh().join('\n') }}</textarea>
              </div>
            }
          </div>
        </div>

        <div class="card grid content-start gap-4 p-5">
          <div class="eyebrow">Inventory</div>
          @for (row of inventory(); track row[0]) {
            <div class="flex items-center gap-3">
              <span class="grid h-9 w-9 place-items-center rounded-[10px] text-sm" [class]="row[3]"><app-icon [name]="'' + row[2]" [size]="17" /></span>
              <span class="flex-1 text-sm text-fg-2">{{ row[0] }}</span>
              <b class="font-display text-xl">{{ row[1] }}</b>
            </div>
          }
          <div class="flex gap-3 rounded-xl border border-line bg-surface-2/60 p-3.5 text-[13px] text-fg-2 dark:bg-white/[0.02]">
            <app-icon name="info" [size]="16" class="mt-0.5 text-info" />
            <span>Redeeming a key adds its time on top of the customer’s remaining time and sets their account limit.</span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="seg" role="group" aria-label="Filter keys">
          @for (f of filters; track f[0]) { <button type="button" [attr.aria-pressed]="filter() === f[0]" (click)="filter.set(f[0])">{{ f[1] }}</button> }
        </div>
        <button type="button" class="btn btn-secondary btn-sm ml-auto" (click)="copyUnused()"><app-icon name="copy" [size]="16" />Copy unused</button>
      </div>
      <div class="card overflow-hidden">
        @if (keys() === null) {
          <div class="p-5"><div class="skeleton h-40"></div></div>
        } @else if (!list().length) {
          <app-empty icon="key-round" title="No keys here" text="Generate keys above and sell them to your customers." />
        } @else {
          <div class="overflow-x-auto">
            <table class="tbl">
              <thead><tr><th>Key</th><th>Gives</th><th>Note</th><th>Created</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                @for (k of list(); track k.code) {
                  <tr>
                    <td class="whitespace-nowrap">
                      <code class="rounded-md bg-surface-2 px-2 py-1 font-mono text-[13px] font-semibold dark:bg-white/5">{{ k.code }}</code>
                      <button type="button" class="ml-1 inline-grid h-7 w-7 place-items-center rounded-md align-middle text-fg-3 hover:bg-surface-2 hover:text-fg" (click)="copyAll([k.code], 'Key copied')" aria-label="Copy key"><app-icon name="copy" [size]="14" /></button>
                    </td>
                    <td class="whitespace-nowrap">{{ k.plan_name }}<div class="text-[12.5px] text-fg-3">{{ duration(k.duration_hours) }} · {{ k.max_accounts }} acc</div></td>
                    <td class="text-fg-3">{{ k.note || '—' }}</td>
                    <td class="whitespace-nowrap text-fg-3">{{ day(k.created_at) }}</td>
                    <td class="whitespace-nowrap">
                      @if (k.redeemed_at) {
                        <span class="badge badge-ok">Used</span><div class="mt-1 text-xs text-fg-3">{{ k.redeemed_username || 'deleted user' }} · {{ day(k.redeemed_at) }}</div>
                      } @else { <span class="badge badge-warn">Unused</span> }
                    </td>
                    <td class="text-right"><button type="button" class="btn btn-ghost btn-sm btn-icon hover:bg-bad/10! hover:text-bad!" (click)="remove(k)" aria-label="Delete key"><app-icon name="trash" [size]="16" /></button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>`,
})
export class AdminKeys {
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  readonly keys = signal<any[] | null>(null);
  readonly fresh = signal<string[]>([]);
  readonly filter = signal('unused');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly filters = [['unused', 'Unused'], ['used', 'Redeemed'], ['all', 'All']];
  readonly duration = fmt.duration;
  readonly day = fmt.day;
  plan = String(this.admin.plans()[0]?.id ?? 'custom');
  count = 5;
  dur: Duration = { value: 30, unit: 24 };
  slots = 1;
  planName = '';
  note = '';

  readonly list = computed(() => {
    const f = this.filter();
    return (this.keys() || []).filter((k) => f === 'all' || (f === 'used' ? k.redeemed_at : !k.redeemed_at));
  });
  readonly inventory = computed(() => {
    const all = this.keys() || [];
    const unused = all.filter((k) => !k.redeemed_at).length;
    return [
      ['Unused keys', unused, 'key-round', 'bg-warn/12 text-warn'],
      ['Redeemed', all.length - unused, 'circle-check', 'bg-ok/12 text-ok'],
      ['Total generated', all.length, 'layers', 'bg-info/12 text-info'],
    ];
  });

  constructor() {
    this.load();
    // Plans may still be loading when this page opens first.
    if (!this.admin.plans().length) this.admin.reloadPlans().then(() => { if (this.plan === 'custom') this.plan = String(this.admin.plans()[0]?.id ?? 'custom'); }).catch(() => {});
  }

  async load() {
    try { this.keys.set((await this.api.get('/api/admin/keys')).keys); } catch (e) { this.toasts.error(e); }
  }

  async generate() {
    const payload: any = { count: +this.count, note: this.note.trim() };
    if (this.plan === 'custom') Object.assign(payload, { duration_hours: fromDuration(this.dur), max_accounts: +this.slots, plan_name: this.planName.trim() || 'Custom' });
    else payload.plan_id = +this.plan;
    this.busy.set(true);
    try {
      const r = await this.api.post('/api/admin/keys/generate', payload);
      this.error.set('');
      this.fresh.set(r.codes);
      this.toasts.success(`${r.codes.length} key(s) generated`);
      this.load();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }

  async copyAll(codes: string[], label: string) {
    await copyText(codes.join('\n'));
    this.toasts.success(label);
  }

  copyUnused() {
    const codes = (this.keys() || []).filter((k) => !k.redeemed_at).map((k) => k.code);
    if (!codes.length) return this.toasts.info('No unused keys');
    return this.copyAll(codes, `${codes.length} unused key(s) copied`);
  }

  async remove(k: any) {
    const ok = await this.confirm.ask({ title: 'Delete this key?', message: `<code>${esc(k.code)}</code> will stop working. Access already granted by it is not affected.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await this.api.post('/api/admin/keys/delete', { code: k.code });
      this.toasts.info('Key deleted');
      this.load();
    } catch (e) { this.toasts.error(e); }
  }
}
