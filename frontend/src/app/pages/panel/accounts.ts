import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Api } from '../../core/api';
import { Confirm } from '../../core/confirm';
import { fmt } from '../../core/fmt';
import { Toasts } from '../../core/toast';
import { Avatar, Banner, Empty, LevelRing, Status, levelPct } from '../../ui/common';
import { Icon } from '../../ui/icon';
import { PanelData } from './panel-data';

@Component({
  selector: 'app-account-card',
  imports: [Avatar, Banner, LevelRing, Status, Icon],
  template: `
    <article class="card group flex h-full flex-col overflow-hidden transition duration-300 hover:border-line-2" [class.opacity-70]="a().status === 'PAUSED'">
      <div class="p-3 pb-0">
        @if (a().level && a().game_id) {
          <app-banner [a]="a()" />
        } @else {
          <div class="flex items-center gap-3 rounded-xl bg-surface-2 p-4 dark:bg-white/[0.03]">
            <app-avatar [name]="a().nickname || a().login" [size]="44" />
            <div class="min-w-0">
              <div class="truncate text-[15px] font-semibold">{{ a().nickname || 'New account' }}</div>
              <div class="truncate font-mono text-xs text-fg-3">{{ idLine() }}</div>
            </div>
          </div>
        }
      </div>

      <div class="flex items-center justify-between gap-3 px-5 pt-4">
        <app-status [a]="a()" />
        @if (a().region) { <span class="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-fg-3 dark:bg-white/[0.05]">{{ a().region }}</span> }
      </div>

      <div class="flex items-center gap-4 px-5 pt-4">
        <app-level-ring [a]="a()" [size]="72" />
        <div class="min-w-0">
          <div class="text-[15px] leading-snug font-semibold">{{ head().title }}</div>
          @if (note()) { <div class="mt-1 text-[12.5px] font-medium text-warn">{{ note() }}</div> }
          @else if (head().meta) { <div class="mt-1 text-[12.5px] text-fg-3">{{ head().meta }}</div> }
        </div>
      </div>

      <dl class="mx-5 mt-5 grid grid-cols-3 rounded-xl border border-line">
        @for (s of stats(); track s[0]; let first = $first) {
          <div class="min-w-0 px-3 py-2.5" [class.border-l]="!first" [class.border-line]="!first">
            <dt class="text-[11.5px] text-fg-3">{{ s[0] }}</dt>
            <dd class="num mt-0.5 truncate text-[15px] font-semibold" [class]="s[2]">{{ s[1] }}</dd>
          </div>
        }
      </dl>

      <footer class="mt-auto flex items-center justify-between gap-2 px-5 pt-4 pb-4 text-[12.5px] text-fg-3">
        <span class="min-w-0 truncate">@if (a().running && a().running_seconds) { Running {{ dur(a().running_seconds) }} · }Added {{ added() }}</span>
        <div class="flex flex-none gap-0.5">
          <button type="button" class="btn btn-ghost btn-sm btn-icon" [class.is-loading]="refreshing()" (click)="refresh.emit(); flash()" aria-label="Refresh stats" title="Refresh stats"><app-icon name="refresh" [size]="15" /></button>
          <button type="button" class="btn btn-ghost btn-sm btn-icon hover:bg-bad/10! hover:text-bad!" (click)="remove.emit()" aria-label="Remove account" title="Remove account"><app-icon name="trash" [size]="15" /></button>
        </div>
      </footer>
    </article>`,
})
export class AccountCard {
  readonly a = input.required<any>();
  readonly index = input(0);
  readonly sub = input<any>({});
  readonly refresh = output<void>();
  readonly remove = output<void>();
  readonly refreshing = signal(false);
  readonly dur = fmt.dur;

  readonly idLine = computed(() => this.a().game_id || (this.a().kind === 'guest' ? `UID ${this.a().login}` : 'Token login'));
  readonly added = computed(() => new Date(this.a().created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  readonly note = computed(() => {
    const a = this.a(), s = this.sub();
    if (a.status !== 'PAUSED') return '';
    if (!s.active) return 'Paused until you renew your plan';
    if (!s.unlimited && this.index() >= (s.max_accounts || 0)) return 'Paused: over your plan’s account limit';
    return 'Paused';
  });
  readonly head = computed(() => {
    const a = this.a();
    if (!a.level) return { title: a.running ? 'Signing in to Free Fire…' : 'Not running', meta: a.running ? 'Stats appear after the first login.' : '' };
    if (a.max_level) return { title: 'Max level reached', meta: `${fmt.num(a.current_exp)} total EXP` };
    if (a.exp_to_next) {
      const progress = levelPct(a) !== null
        ? `${fmt.num(a.current_exp - a.level_start_exp)} / ${fmt.num(a.level_next_exp - a.level_start_exp)} this level`
        : `${fmt.num(a.current_exp)} total EXP`;
      return { title: `${fmt.num(a.exp_to_next)} EXP to level ${a.next_level}`, meta: [progress, a.running && a.eta_seconds ? `~${fmt.dur(a.eta_seconds)}` : ''].filter(Boolean).join(' · ') };
    }
    return { title: `Level ${a.level}`, meta: `${fmt.num(a.current_exp)} total EXP` };
  });
  readonly stats = computed(() => {
    const a = this.a();
    return [
      ['Gained', a.gained_exp ? `+${fmt.compact(a.gained_exp)}` : '0', a.gained_exp ? 'text-ok' : ''],
      ['Per hour', a.exp_per_hour ? fmt.compact(a.exp_per_hour) : '—', a.exp_per_hour ? '' : 'text-fg-3'],
      ['Matches', fmt.num(a.matches_played), ''],
    ];
  });

  flash() {
    this.refreshing.set(true);
    setTimeout(() => this.refreshing.set(false), 900);
  }
}

@Component({
  selector: 'app-panel-accounts',
  imports: [AccountCard, Empty, Icon],
  template: `
    <div class="grid animate-view-in gap-5">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        @if (p.loaded()) {
          <div class="flex min-w-[200px] flex-1 items-center gap-3 sm:max-w-xs">
            <div class="bar flex-1" [class.full]="p.slots().full"><span [style.width.%]="p.sub().unlimited ? 100 : p.slots().pct"></span></div>
            <span class="num text-[13px] font-medium whitespace-nowrap">{{ p.slots().used }} / {{ p.slots().max }} slots</span>
          </div>
          <span class="st st-online"><i aria-hidden="true"></i>{{ p.totals().running || 0 }} running</span>
          <span class="st" [class]="p.totals().in_match ? 'st-match' : 'st-off'"><i aria-hidden="true"></i>{{ p.totals().in_match || 0 }} live {{ p.totals().in_match === 1 ? 'match' : 'matches' }}</span>
        } @else { <div class="skeleton h-6 w-72"></div> }
        <button type="button" class="btn btn-primary btn-sm ml-auto" data-add (click)="p.addOpen.set(true)"><app-icon name="plus" [size]="15" /><span>Add account</span></button>
      </div>

      @if (!p.loaded()) {
        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"><div class="card h-80 p-4"><div class="skeleton h-full"></div></div></div>
      } @else {
        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          @for (a of p.accounts(); track a.id; let i = $index) {
            <app-account-card [a]="a" [index]="i" [sub]="p.sub()" (refresh)="refresh(a)" (remove)="remove(a)" />
          }
          @if (canAdd()) {
            <button type="button" class="group grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-line-2 text-fg-3 transition hover:border-ember/50 hover:bg-ember/[0.03] hover:text-fg" data-add (click)="p.addOpen.set(true)">
              <span class="grid justify-items-center gap-3">
                <span class="grid h-12 w-12 place-items-center rounded-2xl border border-line-2 bg-surface transition group-hover:border-ember/40 group-hover:text-accent"><app-icon name="plus" [size]="22" /></span>
                <span class="text-sm font-medium">Add an account</span>
                <span class="text-[12.5px]">{{ p.slots().free }}</span>
              </span>
            </button>
          }
          @if (!p.accounts().length && !canAdd()) {
            <div class="card sm:col-span-2 xl:col-span-3">
              <app-empty icon="gamepad" title="No accounts yet" text="Buy a plan or redeem a key, then add a guest UID + password or an access token.">
                <button type="button" class="btn btn-brand btn-sm" data-add (click)="p.addOpen.set(true)"><app-icon name="plus" [size]="15" /><span>Add account</span></button>
              </app-empty>
            </div>
          }
        </div>
      }
    </div>`,
})
export class PanelAccounts {
  readonly p = inject(PanelData);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  readonly canAdd = computed(() => this.p.sub().active && !this.p.slots().full);

  async refresh(a: any) {
    try {
      await this.api.post('/api/panel/accounts/refresh', { id: a.id });
      this.toasts.info('Refreshing stats…');
    } catch (e) { this.toasts.error(e); }
  }

  async remove(a: any) {
    const ok = await this.confirm.ask({ title: 'Remove this account?', message: 'The bot stops playing on it and the slot becomes free.', confirmText: 'Remove', danger: true });
    if (!ok) return;
    try {
      await this.api.post('/api/panel/accounts/delete', { id: a.id });
      this.toasts.success('Account removed');
      this.p.refresh();
    } catch (e) { this.toasts.error(e); }
  }
}
