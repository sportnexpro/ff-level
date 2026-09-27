import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Confirm } from '../../core/confirm';
import { esc, fmt } from '../../core/fmt';
import { every } from '../../core/poll';
import { Toasts } from '../../core/toast';
import { Avatar, Empty, StatusBadge } from '../../ui/common';

@Component({
  selector: 'app-admin-accounts',
  imports: [FormsModule, RouterLink, Avatar, Empty, StatusBadge],
  template: `
    <div class="grid animate-view-in gap-5">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-[220px] flex-1 sm:max-w-sm">
          <i class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-fg-3" aria-hidden="true"></i>
          <input class="input pl-10" [(ngModel)]="q" placeholder="Search nickname, ID or owner…" aria-label="Search accounts">
        </div>
        <span class="text-[13px] text-fg-3">{{ running() }} running · {{ (accounts() || []).length }} total</span>
        <a class="btn btn-secondary btn-sm ml-auto" routerLink="/panel/accounts"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add my account</a>
      </div>
      <div class="card overflow-hidden">
        @if (accounts() === null) {
          <div class="p-5"><div class="skeleton h-40"></div></div>
        } @else if (!list().length) {
          <app-empty icon="fa-gamepad" [title]="q ? 'No matching accounts' : 'No accounts yet'" text="Accounts your customers add will show up here." />
        } @else {
          <div class="overflow-x-auto">
            <table class="tbl">
              <thead><tr><th>Account</th><th>Owner</th><th>Login</th><th class="num">Level</th><th class="num">EXP gained</th><th class="num">Live</th><th class="num">Matches</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                @for (a of list(); track a.id) {
                  <tr>
                    <td><div class="flex min-w-[180px] items-center gap-3">
                      <app-avatar [name]="a.nickname || a.login" [size]="36" />
                      <div class="min-w-0"><div class="truncate font-semibold">{{ a.nickname || 'Logging in…' }}</div>
                        <div class="truncate font-mono text-[12px] text-fg-3">{{ a.game_id || '—' }}@if (a.region) { · {{ a.region }} }</div></div>
                    </div></td>
                    <td>{{ a.owner }}</td>
                    <td class="whitespace-nowrap"><span class="text-fg-3">{{ a.kind === 'guest' ? 'Guest' : 'Token' }}</span> <span class="font-mono text-[12.5px]">{{ a.login }}</span></td>
                    <td class="num font-semibold">{{ a.level ?? '—' }}</td>
                    <td class="num text-ok">+{{ num(a.gained_exp) }}</td>
                    <td class="num">@if (a.active_matches) { <b class="text-accent">{{ a.active_matches }}</b> } @else { <span class="text-fg-3">0</span> }</td>
                    <td class="num">{{ num(a.matches_played) }}</td>
                    <td><app-status-badge [status]="a.status" /></td>
                    <td class="text-right whitespace-nowrap">
                      <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="refresh(a)" aria-label="Refresh stats" title="Refresh stats"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
                      <button type="button" class="btn btn-danger btn-sm btn-icon" (click)="remove(a)" aria-label="Remove account" title="Remove"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>`,
})
export class AdminAccounts {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  readonly accounts = signal<any[] | null>(null);
  private query = signal('');
  get q() { return this.query(); }
  set q(v: string) { this.query.set(v); }
  readonly num = fmt.num;
  readonly running = computed(() => (this.accounts() || []).filter((a) => a.running).length);
  readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.accounts() || []).filter((a) => !q || `${a.nickname} ${a.game_id} ${a.login} ${a.owner}`.toLowerCase().includes(q));
  });

  private readonly load = async () => {
    try { this.accounts.set((await this.api.get('/api/admin/accounts')).accounts); } catch (e) { this.toasts.error(e); }
  };

  constructor() {
    every(5000, this.load);
  }

  async refresh(a: any) {
    try {
      await this.api.post('/api/panel/accounts/refresh', { id: a.id });
      this.toasts.info('Refreshing stats…');
    } catch (e) { this.toasts.error(e); }
  }

  async remove(a: any) {
    const ok = await this.confirm.ask({ title: 'Remove this account?', message: `The bot stops playing on <b>${esc(a.nickname || a.login)}</b> (owner: ${esc(a.owner)}) and the slot is freed.`, confirmText: 'Remove', danger: true });
    if (!ok) return;
    try {
      await this.api.post('/api/panel/accounts/delete', { id: a.id });
      this.toasts.success('Account removed');
      this.load();
    } catch (e) { this.toasts.error(e); }
  }
}
