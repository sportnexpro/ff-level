import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Confirm } from '../../core/confirm';
import { copyText, esc, fmt } from '../../core/fmt';
import { every } from '../../core/poll';
import { Toasts } from '../../core/toast';
import { Avatar, Empty } from '../../ui/common';
import { Modal } from '../../ui/modal';
import { AdminData, Duration, fromDuration } from './admin-data';

const toLocalInput = (ts: number | null) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).getTime() / 1000 : null);

/** Access pill for a user row. */
@Component({
  selector: 'app-access-badge',
  template: `
    @if (u().role === 'admin') { <span class="badge badge-accent"><i class="fa-solid fa-crown text-[10px]" aria-hidden="true"></i>Owner</span> }
    @else if (u().is_banned) { <span class="badge badge-bad"><span class="dot"></span>Suspended</span> }
    @else if (u().active) { <span class="badge badge-ok"><span class="dot"></span>{{ remaining(u().remaining) }} left</span> }
    @else if (u().expires_at) { <span class="badge badge-bad"><span class="dot"></span>Expired</span> }
    @else { <span class="badge"><span class="dot"></span>No plan</span> }`,
})
export class AccessBadge {
  readonly u = input.required<any>();
  readonly remaining = fmt.remaining;
}

@Component({
  selector: 'app-add-user',
  imports: [Modal, FormsModule],
  template: `
    <app-modal title="Add user" sub="Create a customer login and optionally give access right away." (closed)="closed.emit()">
      <form id="nu-form" class="grid gap-4" novalidate (ngSubmit)="submit()">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-1.5"><label class="label" for="nu-name">Username</label>
            <input class="input" id="nu-name" name="username" [(ngModel)]="username" autocomplete="off" placeholder="customer123"></div>
          <div class="grid gap-1.5"><label class="label" for="nu-pass">Password</label>
            <div class="relative">
              <input class="input pr-12 font-mono" id="nu-pass" name="password" [(ngModel)]="password" autocomplete="off">
              <button type="button" class="absolute top-1/2 right-1.5 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg" (click)="gen()" aria-label="Generate password" title="Generate"><i class="fa-solid fa-dice" aria-hidden="true"></i></button>
            </div></div>
        </div>
        <div class="grid gap-1.5"><label class="label" for="nu-plan">Access</label>
          <select class="select" id="nu-plan" name="plan" [(ngModel)]="plan">
            <option value="">No access yet</option>
            @for (p of admin.plans(); track p.id) { <option [value]="'' + p.id">{{ admin.planLabel(p) }}</option> }
            <option value="custom">Custom…</option>
          </select></div>
        @if (plan === 'custom') {
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-1.5"><label class="label" for="nu-dur">Access duration</label>
              <div class="grid grid-cols-[1fr_110px] gap-2">
                <input class="input" id="nu-dur" name="dur" type="number" min="1" [(ngModel)]="dur.value">
                <select class="select" name="unit" [(ngModel)]="dur.unit" aria-label="Duration unit"><option [ngValue]="24">Days</option><option [ngValue]="1">Hours</option></select>
              </div></div>
            <div class="grid gap-1.5"><label class="label" for="nu-slots">Max accounts</label>
              <input class="input" id="nu-slots" name="max_accounts" type="number" min="1" [(ngModel)]="slots"></div>
          </div>
        }
        <div class="grid gap-1.5"><label class="label" for="nu-note">Note <span class="font-normal text-fg-3">(only you see this)</span></label>
          <input class="input" id="nu-note" name="note" [(ngModel)]="note" placeholder="e.g. paid via bKash, Facebook: John"></div>
        <p class="form-error" role="alert">{{ error() }}</p>
      </form>
      <div foot class="contents">
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="submit" form="nu-form" class="btn btn-primary" [class.is-loading]="busy()" [disabled]="busy()"><i class="fa-solid fa-user-plus" aria-hidden="true"></i>Create user</button>
      </div>
    </app-modal>`,
})
export class AddUser {
  readonly closed = output<void>();
  readonly done = output<void>();
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly error = signal('');
  readonly busy = signal(false);
  username = '';
  password = '';
  plan = '';
  dur: Duration = { value: 30, unit: 24 };
  slots = 1;
  note = '';

  constructor() { this.gen(); }

  gen() {
    this.password = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  }

  async submit() {
    const payload: any = { username: this.username.trim(), password: this.password.trim(), note: this.note.trim() };
    if (this.plan === 'custom') { payload.duration_hours = fromDuration(this.dur); payload.max_accounts = +this.slots; }
    else if (this.plan) payload.plan_id = +this.plan;
    this.busy.set(true);
    try {
      await this.api.post('/api/admin/users/create', payload);
      await copyText(`Username: ${payload.username}\nPassword: ${payload.password}\nLogin: ${location.origin}/login`);
      this.toasts.success(`User ${payload.username} created — login details copied`);
      this.done.emit();
      this.closed.emit();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-manage-user',
  imports: [Modal, FormsModule],
  template: `
    <app-modal [title]="u().username" [sub]="'Joined ' + day(u().created_at) + ' · last login ' + ago(u().last_login) + ' · ' + u().used + ' account(s) added'" [wide]="true" (closed)="closed.emit()">
      @if (isAdmin()) {
        <div class="flex gap-3 rounded-xl border border-brand/25 bg-brand/[0.06] p-3.5 text-sm text-fg-2">
          <i class="fa-solid fa-crown mt-0.5 text-accent" aria-hidden="true"></i><span>Owner accounts always have unlimited access. You can only change the password here.</span>
        </div>
      } @else {
        <div class="grid gap-2.5">
          <div class="label">Quick extend <span class="font-medium text-fg-3">— currently {{ u().active ? remaining(u().remaining) + ' left' : 'no active access' }}</span></div>
          <div class="flex flex-wrap gap-2">
            @for (x of extend; track x[0]) {
              <button type="button" class="btn btn-secondary btn-sm" [class.is-loading]="busyKey() === 'ext' + x[0]" (click)="extendBy(+x[0], '' + x[1])">{{ x[1] }}</button>
            }
          </div>
        </div>
        <div class="grid gap-2.5">
          <div class="label">Give a plan <span class="font-medium text-fg-3">— adds the plan’s time and sets its account limit</span></div>
          <div class="flex gap-2">
            <select class="select" name="grant" [(ngModel)]="grantPlan" aria-label="Plan">
              @for (p of admin.plans(); track p.id) { <option [value]="'' + p.id">{{ admin.planLabel(p) }}</option> }
            </select>
            <button type="button" class="btn btn-secondary" [class.is-loading]="busyKey() === 'grant'" (click)="grant()">Apply</button>
          </div>
        </div>
      }
      <form id="mu-form" class="grid gap-4 border-t border-line pt-5" novalidate (ngSubmit)="save()">
        @if (!isAdmin()) {
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-1.5"><label class="label" for="mu-slots">Max accounts</label>
              <input class="input" id="mu-slots" name="max_accounts" type="number" min="0" [(ngModel)]="form.max_accounts">
              <span class="hint">How many Free Fire accounts this user can run.</span></div>
            <div class="grid gap-1.5"><label class="label" for="mu-exp">Access expires</label>
              <input class="input" id="mu-exp" name="expires_at" type="datetime-local" [(ngModel)]="form.expires_at">
              <span class="hint">Leave empty for no access.</span></div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-1.5"><label class="label" for="mu-planname">Plan label</label>
              <input class="input" id="mu-planname" name="plan_name" [(ngModel)]="form.plan_name" placeholder="e.g. Pro"></div>
            <div class="grid gap-1.5"><label class="label" for="mu-note">Note</label>
              <input class="input" id="mu-note" name="note" [(ngModel)]="form.note"></div>
          </div>
        }
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-1.5"><label class="label" for="mu-pass">New password</label>
            <input class="input" id="mu-pass" name="password" [(ngModel)]="form.password" autocomplete="new-password" placeholder="Leave empty to keep"></div>
          @if (!isAdmin()) {
            <div class="grid content-end gap-1.5">
              <label class="switch"><input type="checkbox" name="is_banned" [(ngModel)]="form.is_banned">Suspend this user</label>
              <span class="hint">Suspended users can’t sign in and their accounts stop.</span>
            </div>
          }
        </div>
        <p class="form-error" role="alert">{{ error() }}</p>
      </form>
      @if (!isAdmin()) {
        <div class="flex flex-wrap gap-2 border-t border-line pt-5">
          <button type="button" class="btn btn-secondary btn-sm" (click)="revoke()"><i class="fa-solid fa-ban" aria-hidden="true"></i>Revoke access now</button>
          <button type="button" class="btn btn-danger btn-sm" (click)="remove()"><i class="fa-solid fa-trash-can" aria-hidden="true"></i>Delete user</button>
        </div>
      }
      <div foot class="contents">
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Close</button>
        <button type="submit" form="mu-form" class="btn btn-primary" [class.is-loading]="busyKey() === 'save'" [disabled]="!!busyKey()">Save changes</button>
      </div>
    </app-modal>`,
})
export class ManageUser {
  readonly u = input.required<any>();
  readonly closed = output<void>();
  /** Asks the page to reload users; resolves with the fresh list. */
  readonly reload = input.required<() => Promise<any[]>>();
  readonly admin = inject(AdminData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  readonly isAdmin = computed(() => this.u().role === 'admin');
  readonly error = signal('');
  readonly busyKey = signal('');
  readonly extend = [[1, '+1 hour'], [24, '+1 day'], [72, '+3 days'], [168, '+7 days'], [720, '+30 days']];
  readonly day = fmt.day;
  readonly ago = fmt.ago;
  readonly remaining = fmt.remaining;
  grantPlan = '';
  form: any = {};

  ngOnInit() {
    this.grantPlan = String(this.admin.plans()[0]?.id ?? '');
    this.fill(this.u());
  }

  private fill(u: any) {
    this.form = { ...this.form, max_accounts: u.max_accounts, expires_at: toLocalInput(u.expires_at), plan_name: u.plan_name || '', note: u.note || '', is_banned: !!u.is_banned, password: this.form.password || '' };
  }

  private async sync() {
    const users = await this.reload()();
    const fresh = users.find((x) => x.id === this.u().id);
    if (fresh) this.fill(fresh);
  }

  private async run(key: string, fn: () => Promise<void>) {
    this.busyKey.set(key);
    try { await fn(); } catch (e) { this.toasts.error(e); } finally { this.busyKey.set(''); }
  }

  extendBy(hours: number, label: string) {
    return this.run(`ext${hours}`, async () => {
      await this.api.post('/api/admin/users/update', { id: this.u().id, extend_hours: hours });
      this.toasts.success(`${label} added to ${this.u().username}`);
      await this.sync();
    });
  }

  grant() {
    return this.run('grant', async () => {
      await this.api.post('/api/admin/users/grant', { id: this.u().id, plan_id: +this.grantPlan });
      this.toasts.success('Plan applied');
      await this.sync();
    });
  }

  async revoke() {
    const ok = await this.confirm.ask({ title: 'Revoke access?', message: `${esc(this.u().username)}’s access ends now and all their accounts stop. Their accounts stay saved.`, confirmText: 'Revoke', danger: true });
    if (!ok) return;
    await this.run('revoke', async () => {
      await this.api.post('/api/admin/users/update', { id: this.u().id, expires_at: Date.now() / 1000 - 1 });
      this.toasts.info('Access revoked');
      await this.sync();
    });
  }

  async remove() {
    const ok = await this.confirm.ask({ title: `Delete ${esc(this.u().username)}?`, message: 'This permanently deletes the user, their accounts and order history. This can’t be undone.', confirmText: 'Delete permanently', danger: true });
    if (!ok) return;
    await this.run('delete', async () => {
      await this.api.post('/api/admin/users/delete', { id: this.u().id });
      this.toasts.info('User deleted');
      await this.reload()();
      this.closed.emit();
    });
  }

  async save() {
    const f = this.form;
    const payload: any = { id: this.u().id };
    if (!this.isAdmin()) Object.assign(payload, { max_accounts: +f.max_accounts, expires_at: fromLocalInput(f.expires_at), plan_name: f.plan_name.trim(), note: f.note.trim(), is_banned: !!f.is_banned });
    if (f.password?.trim()) payload.password = f.password.trim();
    this.busyKey.set('save');
    try {
      await this.api.post('/api/admin/users/update', payload);
      this.toasts.success('User updated');
      await this.reload()();
      this.closed.emit();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.busyKey.set('');
    }
  }
}

@Component({
  selector: 'app-admin-users',
  imports: [Avatar, Empty, AccessBadge, AddUser, ManageUser, FormsModule],
  template: `
    <div class="grid animate-view-in gap-5">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-[220px] flex-1 sm:max-w-sm">
          <i class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-fg-3" aria-hidden="true"></i>
          <input class="input pl-10" id="u-search" [(ngModel)]="q" placeholder="Search users…" aria-label="Search users">
        </div>
        <div class="seg overflow-x-auto" role="group" aria-label="Filter users">
          @for (f of filters; track f[0]) { <button type="button" [attr.aria-pressed]="filter() === f[0]" (click)="filter.set(f[0])">{{ f[1] }}</button> }
        </div>
        <button type="button" class="btn btn-primary btn-sm ml-auto" id="add-user" (click)="adding.set(true)"><i class="fa-solid fa-user-plus" aria-hidden="true"></i>Add user</button>
      </div>

      <div class="card overflow-hidden">
        @if (users() === null) {
          <div class="p-5"><div class="skeleton h-40"></div></div>
        } @else if (!list().length) {
          <app-empty icon="fa-users" [title]="q || filter() !== 'all' ? 'No matching users' : 'No users yet'" text="Create a user or let customers register from the website." />
        } @else {
          <div class="overflow-x-auto">
            <table class="tbl">
              <thead><tr><th>User</th><th>Plan</th><th>Accounts</th><th>Access</th><th>Last login</th><th><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                @for (u of list(); track u.id) {
                  <tr>
                    <td><div class="flex min-w-[180px] items-center gap-3">
                      <app-avatar [name]="u.username" [size]="36" />
                      <div class="min-w-0"><div class="truncate font-semibold">{{ u.username }}</div><div class="truncate text-[12.5px] text-fg-3">{{ u.note || 'Joined ' + day(u.created_at) }}</div></div>
                    </div></td>
                    <td>{{ u.role === 'admin' ? 'Owner' : (u.plan_name || '—') }}</td>
                    <td class="min-w-[130px]">
                      <div class="mb-1.5 flex justify-between text-[13px]"><b>{{ u.used }}</b><span class="text-fg-3">/ {{ u.role === 'admin' ? '∞' : u.max_accounts }}</span></div>
                      @if (u.role !== 'admin') { <div class="bar h-[5px]!" [class.full]="pct(u) >= 100"><span [style.width.%]="pct(u)"></span></div> }
                    </td>
                    <td class="whitespace-nowrap"><app-access-badge [u]="u" />
                      @if (u.expires_at && u.role !== 'admin') { <div class="mt-1 text-xs text-fg-3">{{ date(u.expires_at) }}</div> }</td>
                    <td class="whitespace-nowrap text-fg-3">{{ ago(u.last_login) }}</td>
                    <td class="text-right"><button type="button" class="btn btn-secondary btn-sm" [attr.data-manage]="u.id" (click)="managing.set(u)"><i class="fa-solid fa-sliders" aria-hidden="true"></i>Manage</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
    @if (adding()) { <app-add-user (closed)="adding.set(false)" (done)="load()" /> }
    @if (managing(); as u) { <app-manage-user [u]="u" [reload]="load" (closed)="managing.set(null)" /> }`,
})
export class AdminUsers {
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly users = signal<any[] | null>(null);
  readonly filter = signal('all');
  readonly adding = signal(false);
  readonly managing = signal<any | null>(null);
  readonly filters = [['all', 'All'], ['active', 'Active'], ['expired', 'Expired'], ['banned', 'Suspended']];
  private query = signal('');
  get q() { return this.query(); }
  set q(v: string) { this.query.set(v); }
  readonly day = fmt.day;
  readonly date = fmt.date;
  readonly ago = fmt.ago;

  readonly list = computed(() => {
    const q = this.query().trim().toLowerCase(), f = this.filter();
    return (this.users() || []).filter((u) => {
      if (q && !`${u.username} ${u.note} ${u.plan_name || ''}`.toLowerCase().includes(q)) return false;
      if (f === 'active') return u.active && u.role !== 'admin';
      if (f === 'expired') return !u.active && !u.is_banned;
      if (f === 'banned') return !!u.is_banned;
      return true;
    });
  });

  readonly load = async (): Promise<any[]> => {
    try {
      const users = (await this.api.get('/api/admin/users')).users;
      this.users.set(users);
      return users;
    } catch (e) {
      this.toasts.error(e);
      return this.users() || [];
    }
  };

  constructor() {
    every(15000, this.load);
  }

  pct(u: any) {
    return u.max_accounts ? Math.min(100, (u.used / u.max_accounts) * 100) : 0;
  }
}
