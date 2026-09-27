import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Session } from '../../core/session';
import { Toasts } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { ThemeToggle } from '../../ui/common';
import { AdminData } from './admin-data';

@Component({
  selector: 'app-admin-settings',
  imports: [Icon, FormsModule, ThemeToggle],
  template: `
    <div class="grid animate-view-in gap-6">
      <form class="grid gap-6" novalidate (ngSubmit)="save()">
        <div class="grid gap-6 lg:grid-cols-2">
          <div class="card">
            <div class="card-head"><h3 class="card-title"><app-icon name="palette" [size]="16" />Branding</h3></div>
            <div class="grid gap-4 p-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-1.5"><label class="label" for="st-name">Site name</label><input class="input" id="st-name" name="site_name" [(ngModel)]="s.site_name"></div>
                <div class="grid gap-1.5"><label class="label" for="st-cur">Currency symbol</label><input class="input" id="st-cur" name="currency" [(ngModel)]="s.currency" placeholder="৳"></div>
              </div>
              <div class="grid gap-1.5"><label class="label" for="st-tag">Tagline</label><input class="input" id="st-tag" name="tagline" [(ngModel)]="s.tagline">
                <span class="hint">Shown in the homepage footer.</span></div>
              <div class="grid gap-1.5"><label class="label" for="st-ann">Announcement bar</label><input class="input" id="st-ann" name="announcement" [(ngModel)]="s.announcement" placeholder="e.g. Eid offer: 20% off all plans!">
                <span class="hint">Shown at the top of every customer’s panel. Leave empty to hide.</span></div>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title"><app-icon name="headset" [size]="16" />Support & sign-ups</h3></div>
            <div class="grid gap-4 p-5">
              <div class="grid gap-1.5"><label class="label" for="st-tg">Telegram</label><input class="input" id="st-tg" name="contact_telegram" [(ngModel)]="s.contact_telegram" placeholder="@yourname or https://t.me/…"></div>
              <div class="grid gap-1.5"><label class="label" for="st-wa">WhatsApp</label><input class="input" id="st-wa" name="contact_whatsapp" [(ngModel)]="s.contact_whatsapp" placeholder="8801XXXXXXXXX"></div>
              <label class="switch"><input type="checkbox" name="allow_register" [(ngModel)]="s.allow_register">Allow customers to create accounts from the website</label>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head flex-wrap">
            <div><h3 class="card-title"><app-icon name="wallet" [size]="16" />Payment methods</h3>
              <div class="card-sub">Customers send money here and submit the Transaction ID for you to approve.</div></div>
            <button type="button" class="btn btn-secondary btn-sm" (click)="addMethod()"><app-icon name="plus" [size]="16" />Add method</button>
          </div>
          <div class="grid gap-4 p-5">
            @for (m of methods(); track m; let i = $index) {
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1.3fr_1fr_auto] sm:border-0 sm:p-0">
                <div class="grid gap-1.5"><label class="label" [for]="'pm-n' + i">Method</label><input class="input" [id]="'pm-n' + i" [name]="'pm-n' + i" [(ngModel)]="m.name" placeholder="bKash"></div>
                <div class="col-span-2 grid gap-1.5 sm:col-span-1"><label class="label" [for]="'pm-x' + i">Number</label><input class="input font-mono" [id]="'pm-x' + i" [name]="'pm-x' + i" [(ngModel)]="m.number" placeholder="01XXXXXXXXX"></div>
                <div class="grid gap-1.5"><label class="label" [for]="'pm-t' + i">Type</label><input class="input" [id]="'pm-t' + i" [name]="'pm-t' + i" [(ngModel)]="m.type" placeholder="Personal"></div>
                <button type="button" class="btn btn-ghost btn-icon row-start-1 col-start-2 sm:row-auto sm:col-auto" (click)="removeMethod(i)" aria-label="Remove method"><app-icon name="x" [size]="16" /></button>
              </div>
            } @empty {
              <p class="text-sm text-fg-3">No payment methods yet.</p>
            }
            <div class="grid gap-1.5"><label class="label" for="st-note">Payment instructions</label>
              <textarea class="textarea" id="st-note" name="payment_note" rows="3" [(ngModel)]="s.payment_note"></textarea></div>
          </div>
        </div>
        <div><button class="btn btn-primary btn-lg" type="submit" [class.is-loading]="saving()" [disabled]="saving()"><app-icon name="save" [size]="16" />Save settings</button></div>
      </form>

      <div class="card">
        <div class="card-head"><div>
          <h3 class="card-title"><app-icon name="chart" [size]="16" />Level EXP table</h3>
          <div class="card-sub">Levels 1–100 use the built-in Free Fire EXP table. Add a line here only to correct a level or add levels above 100.</div>
        </div></div>
        <form class="grid gap-4 p-5" novalidate (ngSubmit)="saveLevels()">
          <div class="grid gap-1.5"><label class="label" for="lv-table">One level per line: <span class="font-mono">level total_exp</span></label>
            <textarea class="textarea font-mono text-[13px]" id="lv-table" name="table" rows="8" [(ngModel)]="levels" placeholder="101 34000000"></textarea>
            <span class="hint">{{ levelHint() }}</span></div>
          <p class="form-error" role="alert">{{ levelError() }}</p>
          <div><button class="btn btn-secondary" type="submit" [class.is-loading]="savingLevels()" [disabled]="savingLevels()">Save level table</button></div>
        </form>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="card">
          <div class="card-head"><h3 class="card-title"><app-icon name="lock" [size]="16" />Your admin password</h3></div>
          <form class="grid gap-4 p-5" novalidate (ngSubmit)="changePassword()">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="grid gap-1.5"><label class="label" for="pw-cur">Current password</label><input class="input" id="pw-cur" name="current" type="password" [(ngModel)]="pwCurrent" autocomplete="current-password"></div>
              <div class="grid gap-1.5"><label class="label" for="pw-new">New password</label><input class="input" id="pw-new" name="new" type="password" [(ngModel)]="pwNew" autocomplete="new-password"></div>
            </div>
            <p class="form-error" role="alert">{{ pwError() }}</p>
            <div><button class="btn btn-secondary" type="submit" [class.is-loading]="savingPw()" [disabled]="savingPw()">Change password</button></div>
          </form>
        </div>
        <div class="card">
          <div class="card-head"><div>
            <h3 class="card-title"><app-icon name="sun" [size]="16" />Appearance</h3>
            <div class="card-sub">Your choice on this browser. Auto follows your device.</div>
          </div></div>
          <div class="p-5"><app-theme-toggle [full]="true" /></div>
        </div>
      </div>
    </div>`,
})
export class AdminSettings {
  private admin = inject(AdminData);
  private session = inject(Session);
  private api = inject(Api);
  private toasts = inject(Toasts);
  s: any = {};
  readonly methods = signal<any[]>([]);
  readonly saving = signal(false);
  levels = '';
  readonly levelHint = signal('');
  readonly levelError = signal('');
  readonly savingLevels = signal(false);
  pwCurrent = '';
  pwNew = '';
  readonly pwError = signal('');
  readonly savingPw = signal(false);

  constructor() {
    // Fill the form once the settings arrive (they may still be loading).
    let filled = false;
    effect(() => {
      const st = this.admin.settings();
      if (filled || !Object.keys(st).length) return;
      filled = true;
      untracked(() => this.fill(st));
    });
    this.api.get('/api/admin/levels').then((r) => this.paintLevels(r.levels)).catch(() => {});
  }

  private fill(st: any) {
    this.s = { ...st };
    this.methods.set((st.payment_methods || []).map((m: any) => ({ ...m })));
  }

  addMethod() { this.methods.update((l) => [...l, { name: '', number: '', type: '' }]); }
  removeMethod(i: number) { this.methods.update((l) => l.filter((_, j) => j !== i)); }

  async save() {
    const payload = { ...this.s, payment_methods: this.methods().map((m) => ({ name: (m.name || '').trim(), number: (m.number || '').trim(), type: (m.type || '').trim() })).filter((m) => m.name) };
    this.saving.set(true);
    try {
      const r = await this.api.post('/api/admin/settings', payload);
      this.admin.settings.set(r.settings);
      this.session.settings.set({ ...this.session.settings(), ...r.settings });
      this.fill(r.settings);
      this.toasts.success('Settings saved');
    } catch (e) { this.toasts.error(e); } finally { this.saving.set(false); }
  }

  private paintLevels(levels: any[]) {
    this.levels = levels.map((l) => `${l.level} ${Math.round(l.override ?? l.hi)}`).join('\n');
    this.levelHint.set(levels.length ? `${levels.length} custom level value(s) set.` : 'No custom values — the built-in table is used for every level.');
  }

  async saveLevels() {
    this.savingLevels.set(true);
    try {
      this.paintLevels((await this.api.post('/api/admin/levels', { table: this.levels })).levels);
      this.levelError.set('');
      this.toasts.success('Level table saved');
    } catch (e: any) { this.levelError.set(e.message); } finally { this.savingLevels.set(false); }
  }

  async changePassword() {
    this.savingPw.set(true);
    try {
      await this.api.post('/api/panel/password', { current: this.pwCurrent, new: this.pwNew });
      this.pwCurrent = this.pwNew = '';
      this.pwError.set('');
      this.toasts.success('Password changed');
    } catch (e: any) { this.pwError.set(e.message); } finally { this.savingPw.set(false); }
  }
}
