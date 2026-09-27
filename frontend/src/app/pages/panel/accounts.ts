import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Api } from '../../core/api';
import { Confirm } from '../../core/confirm';
import { fmt } from '../../core/fmt';
import { Toasts } from '../../core/toast';
import { Avatar, Banner, Empty, LevelRing, Status, levelPct } from '../../ui/common';
import { PanelData } from './panel-data';

@Component({
  selector: 'app-account-card',
  imports: [Avatar, Banner, LevelRing, Status],
  template: `
    <article class="card flex h-full flex-col gap-4 p-4 transition-colors hover:border-violet/30" [class.opacity-75]="a().status === 'PAUSED'">
      @if (a().level && a().game_id) {
        <app-banner [a]="a()" />
        <div class="-mt-1 flex items-center justify-between gap-3 px-1">
          <app-status [a]="a()" />
          @if (a().region) { <span class="text-xs font-semibold text-fg-3">{{ a().region }} server</span> }
        </div>
      } @else {
        <header class="flex items-center gap-3 px-1 pt-1">
          <app-avatar [name]="a().nickname || a().login" [size]="46" />
          <div class="min-w-0 flex-1">
            <div class="truncate font-display text-base font-bold">{{ a().nickname || 'New account' }}</div>
            <div class="truncate font-mono text-xs text-fg-3">{{ idLine() }}@if (a().region) { · {{ a().region }} }</div>
          </div>
          <app-status [a]="a()" />
        </header>
      }

      <div class="flex items-center gap-4 rounded-xl border border-line bg-surface-2/60 p-3 dark:bg-white/[0.02]">
        <app-level-ring [a]="a()" />
        <div class="min-w-0">
          <div class="font-display text-[15px] leading-snug font-bold">{{ head().title }}</div>
          @if (note()) { <div class="mt-1 text-[12.5px] font-semibold text-warn">{{ note() }}</div> }
          @else if (head().meta) { <div class="mt-1 text-[12.5px] text-fg-3">{{ head().meta }}</div> }
        </div>
      </div>

      <dl class="grid grid-cols-3 px-1">
        @for (s of stats(); track s[0]; let first = $first) {
          <div class="min-w-0 border-line" [class]="first ? '' : 'border-l pl-3'">
            <dt class="text-xs text-fg-3">{{ s[0] }}</dt>
            <dd class="mt-1 truncate font-display text-[17px] font-bold tabular-nums" [class]="s[2]">{{ s[1] }}</dd>
          </div>
        }
      </dl>

      <footer class="mt-auto flex items-center justify-between gap-2 border-t border-line px-1 pt-3 text-[12.5px] text-fg-3">
        <span class="min-w-0 truncate">@if (a().running && a().running_seconds) { Running for {{ dur(a().running_seconds) }} · }Added {{ added() }}</span>
        <div class="flex flex-none gap-1">
          <button type="button" class="btn btn-ghost btn-sm btn-icon" [class.is-loading]="refreshing()" (click)="refresh.emit(); flash()" aria-label="Refresh stats" title="Refresh stats"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
          <button type="button" class="btn btn-ghost btn-sm btn-icon hover:bg-bad/10! hover:text-bad!" (click)="remove.emit()" aria-label="Remove account" title="Remove account"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
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
    if (!a.level) return { title: a.running ? 'Signing in to Free Fire' : 'Not running', meta: a.running ? 'Stats appear after the first login.' : '' };
    if (a.max_level) return { title: 'Max level reached', meta: `${fmt.num(a.current_exp)} total EXP` };
    if (a.exp_to_next) {
      const progress = levelPct(a) !== null
        ? `${fmt.num(a.current_exp - a.level_start_exp)} of ${fmt.num(a.level_next_exp - a.level_start_exp)} this level`
        : `${fmt.num(a.current_exp)} total EXP`;
      return { title: `${fmt.num(a.exp_to_next)} EXP to level ${a.next_level}`, meta: [progress, a.running && a.eta_seconds ? `about ${fmt.dur(a.eta_seconds)}` : ''].filter(Boolean).join(' · ') };
    }
    return { title: `Level ${a.level}`, meta: `${fmt.num(a.current_exp)} total EXP` };
  });
  readonly stats = computed(() => {
    const a = this.a();
    return [
      ['EXP gained', a.gained_exp ? `+${fmt.compact(a.gained_exp)}` : '0', a.gained_exp ? 'text-ok' : ''],
      ['Matches', fmt.num(a.matches_played), ''],
      ['Per hour', a.exp_per_hour ? `+${fmt.compact(a.exp_per_hour)}` : 'soon', a.exp_per_hour ? '' : 'font-sans! text-sm! font-medium! text-fg-3'],
    ];
  });

  flash() {
    this.refreshing.set(true);
    setTimeout(() => this.refreshing.set(false), 900);
  }
}

@Component({
  selector: 'app-panel-accounts',
  imports: [AccountCard, Empty],
  template: `
    <div class="grid animate-view-in gap-5">
      <div class="card flex flex-wrap items-center gap-x-6 gap-y-4 p-4 sm:px-5">
        @if (!p.loaded()) { <div class="skeleton h-7 flex-1"></div> } @else {
          <div class="grid min-w-[180px] flex-1 gap-2">
            <div class="flex justify-between text-[13px]"><span class="text-fg-3">Slots used</span><b>{{ p.slots().used }} / {{ p.slots().max }}</b></div>
            <div class="bar" [class.full]="p.slots().full"><span [style.width.%]="p.slots().pct"></span></div>
          </div>
          <span class="st st-online"><i aria-hidden="true"></i>{{ p.totals().running || 0 }} running</span>
          <span class="st" [class]="p.totals().in_match ? 'st-match' : 'st-off'"><i aria-hidden="true"></i>{{ p.totals().in_match || 0 }} live {{ p.totals().in_match === 1 ? 'match' : 'matches' }}</span>
          @if (!p.sub().unlimited) {
            <span class="text-[13.5px] text-fg-3">@if (p.sub().active) { Plan ends in <b class="text-fg">{{ remaining() }}</b> } @else { No active plan }</span>
          }
        }
        <button type="button" class="btn btn-primary btn-sm ml-auto" data-add (click)="p.addOpen.set(true)"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>
      </div>

      @if (!p.loaded()) {
        <div class="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3"><div class="card h-72 p-4"><div class="skeleton h-full"></div></div></div>
      } @else {
        <div class="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          @for (a of p.accounts(); track a.id; let i = $index) {
            <app-account-card [a]="a" [index]="i" [sub]="p.sub()" (refresh)="refresh(a)" (remove)="remove(a)" />
          } @empty {
            <div class="card sm:col-span-2 2xl:col-span-3">
              <app-empty icon="fa-gamepad" title="No accounts yet" text="Add a guest UID + password or an access token. Each account uses one slot of your plan.">
                <button type="button" class="btn btn-primary btn-sm" data-add (click)="p.addOpen.set(true)"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>
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
  readonly remaining = computed(() => fmt.remaining(this.p.remaining()));

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
