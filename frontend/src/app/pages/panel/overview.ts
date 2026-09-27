import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { fmt } from '../../core/fmt';
import { Avatar, Empty, Status, levelPct } from '../../ui/common';
import { SubBadge } from './layout';
import { PanelData } from './panel-data';

/** Activity feed (EXP gains, finished matches). */
@Component({
  selector: 'app-feed',
  imports: [Empty],
  template: `
    @if (!items().length) {
      <app-empty icon="fa-wave-square" title="No activity yet" [text]="emptyText()" />
    } @else {
      <ol class="grid">
        @for (l of items(); track $index) {
          <li class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-line px-5 py-3 text-[13.5px] last:border-b-0">
            <span class="mt-px grid h-6 w-6 place-items-center rounded-lg text-[11px]"
              [class]="tone(l.level)"><i class="fa-solid {{ icon(l.level) }}" aria-hidden="true"></i></span>
            <span class="min-w-0 break-words text-fg-2">{{ l.message }}</span>
            <time class="font-mono text-[11.5px] whitespace-nowrap text-fg-3">{{ l.time }}</time>
          </li>
        }
      </ol>
    }`,
})
export class Feed {
  readonly logs = input<any[]>([]);
  readonly limit = input(12);
  readonly emptyText = input('Activity from your accounts will show up here.');
  readonly items = computed(() => this.logs().slice(-this.limit()).reverse());
  icon(level: string) { return ({ success: 'fa-arrow-trend-up', warning: 'fa-triangle-exclamation', error: 'fa-xmark' } as any)[level] || 'fa-bolt'; }
  tone(level: string) {
    return ({ success: 'bg-ok/12 text-ok', warning: 'bg-warn/12 text-warn', error: 'bg-bad/12 text-bad' } as any)[level] || 'bg-info/12 text-info';
  }
}

/** One account on the dashboard: who, where it is in the level, and what it earned. */
@Component({
  selector: 'app-account-row',
  imports: [Avatar, Status],
  template: `
    <div class="@container">
      <div class="grid items-center gap-4 px-5 py-4 @3xl:grid-cols-[minmax(200px,260px)_minmax(0,1fr)] @6xl:grid-cols-[minmax(200px,260px)_minmax(0,1fr)_minmax(0,300px)] @6xl:gap-7">
        <div class="flex min-w-0 items-center gap-3">
          <app-avatar [name]="a().nickname || a().login" [size]="44" />
          <div class="min-w-0">
            <div class="truncate font-display text-[15.5px] font-bold">{{ a().nickname || 'New account' }}</div>
            <div class="truncate font-mono text-[12px] text-fg-3">{{ a().game_id || a().login }}@if (a().region) { · {{ a().region }} }</div>
          </div>
        </div>
        <div class="grid min-w-0 gap-2.5">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <app-status [a]="a()" />
            @if (a().running && a().running_seconds) { <span class="text-[12.5px] text-fg-3">Running for {{ dur(a().running_seconds) }}</span> }
          </div>
          <div class="grid gap-1.5">
            <div class="flex items-baseline justify-between gap-3">
              @if (!a().level) {
                <span class="text-[13.5px] text-fg-2">{{ a().running ? 'Signing in…' : 'Not running' }}</span>
              } @else {
                <span class="text-[13.5px] text-fg-2">Level <b class="ml-0.5 font-display text-[17px] text-fg">{{ a().level }}</b></span>
                @if (a().max_level) { <span class="text-[13px] font-semibold text-fg-3">Max</span> }
                @else if (pct() !== null) { <span class="text-[13px] font-semibold text-fg-3"><b class="grad-text font-display text-[20px] tabular-nums">{{ floor(pct()!) }}</b>%</span> }
              }
            </div>
            <div class="bar bar-lg" role="progressbar" [attr.aria-valuenow]="round(bar())" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to the next level">
              <span [style.width.%]="bar()"></span>
            </div>
            <div class="flex justify-between gap-3 text-[12.5px] text-fg-3"><span>{{ foot()[0] }}</span><span>{{ foot()[1] }}</span></div>
          </div>
        </div>
        <dl class="grid grid-cols-3 border-line @3xl:col-span-2 @3xl:border-t @3xl:pt-3 @6xl:col-span-1 @6xl:border-t-0 @6xl:pt-0">
          @for (s of stats(); track s[0]; let first = $first) {
            <div class="min-w-0 border-line" [class]="first ? '@6xl:border-l @6xl:pl-4' : 'border-l pl-4'">
              <dt class="text-xs whitespace-nowrap text-fg-3">{{ s[0] }}</dt>
              <dd class="mt-1 truncate font-display text-lg font-bold tabular-nums" [class]="s[2]">{{ s[1] }}</dd>
            </div>
          }
        </dl>
      </div>
    </div>`,
})
export class AccountRow {
  readonly a = input.required<any>();
  readonly dur = fmt.dur;
  readonly floor = Math.floor;
  readonly round = Math.round;
  readonly pct = computed(() => levelPct(this.a()));
  readonly bar = computed(() => (!this.a().level ? 0 : this.pct() || 0));
  readonly foot = computed(() => {
    const a = this.a();
    if (!a.level) return ['Stats appear after the first login', ''];
    if (a.max_level) return [`${fmt.num(a.current_exp)} total EXP`, ''];
    return [
      a.exp_to_next ? `${fmt.num(a.exp_to_next)} EXP to level ${a.next_level}` : `${fmt.num(a.current_exp)} total EXP`,
      !a.running ? 'Paused' : a.eta_seconds ? `about ${fmt.dur(a.eta_seconds)} left` : '',
    ];
  });
  readonly stats = computed(() => {
    const a = this.a();
    return [
      ['EXP gained', a.gained_exp ? `+${fmt.compact(a.gained_exp)}` : '0', a.gained_exp ? 'text-ok' : ''],
      ['Matches', fmt.num(a.matches_played), ''],
      ['Per hour', a.exp_per_hour ? `+${fmt.compact(a.exp_per_hour)}` : 'soon', a.exp_per_hour ? '' : 'font-sans! text-sm! font-medium! text-fg-3'],
    ];
  });
}

@Component({
  selector: 'app-panel-overview',
  imports: [RouterLink, SubBadge, AccountRow, Feed, Empty],
  template: `
    <div class="grid animate-view-in gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
      <div class="grid min-w-0 content-start gap-5 xl:gap-6">
        <!-- plan -->
        <div class="card relative overflow-hidden p-6"
          style="background-image: radial-gradient(90% 140% at 100% 0%, rgba(255,51,102,.13), transparent 55%), radial-gradient(70% 120% at 0% 100%, rgba(139,92,246,.11), transparent 60%)">
          @if (!p.loaded()) { <div class="skeleton h-[92px]"></div> } @else {
            <div class="flex flex-wrap items-end justify-between gap-6">
              <div class="min-w-0">
                <div class="eyebrow">Current plan</div>
                <div class="mt-2 flex flex-wrap items-center gap-3">
                  <span class="font-display text-[28px] leading-none font-bold">{{ s().plan_name || 'No plan' }}</span>
                  <app-sub-badge [s]="s()" />
                </div>
                <p class="mt-2.5 text-sm text-fg-2">{{ planLine() }}</p>
              </div>
              <div class="grid justify-items-start gap-2 sm:justify-items-end">
                <div class="eyebrow">Time left</div>
                <div class="font-display text-[28px] leading-none font-bold tabular-nums"
                  [class.text-bad]="!s().unlimited && !p.remaining()" [class.grad-text]="s().unlimited || p.remaining()" role="timer">
                  {{ s().unlimited ? 'Lifetime' : clock(p.remaining()) }}</div>
                <a class="btn btn-primary btn-sm mt-1" routerLink="/panel/billing">{{ s().active ? 'Renew' : 'Get a plan' }}</a>
              </div>
            </div>
          }
        </div>

        <!-- stats -->
        <div class="@container"><div class="grid grid-cols-2 gap-3 sm:gap-4 @xl:grid-cols-3 @[44rem]:grid-cols-5">
          @for (st of stats(); track st.label; let last = $last) {
            <div class="card relative overflow-hidden p-4 sm:p-5" [class]="last ? 'col-span-2 @xl:col-span-1' : ''">
              <div class="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold whitespace-nowrap text-fg-3">
                <span class="grid h-6 w-6 flex-none place-items-center rounded-md bg-surface-2 text-[11px] text-fg-2 dark:bg-white/5"><i class="fa-solid {{ st.icon }}" aria-hidden="true"></i></span><span class="truncate">{{ st.label }}</span>
              </div>
              @if (!p.loaded()) { <div class="skeleton mt-3 h-7 w-20"></div> }
              @else { <div class="mt-2.5 truncate font-display text-[24px] leading-none font-bold tabular-nums" [class]="st.cls">{{ st.value }}</div> }
            </div>
          }
        </div></div>

        <!-- accounts -->
        <div class="card overflow-hidden">
          <div class="card-head">
            <h3 class="card-title"><i class="fa-solid fa-gamepad" aria-hidden="true"></i>Your accounts</h3>
            <a class="btn btn-ghost btn-sm" routerLink="/panel/accounts">Manage <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i></a>
          </div>
          @if (!p.loaded()) {
            <div class="grid gap-3 p-5"><div class="skeleton h-16"></div><div class="skeleton h-16"></div></div>
          } @else {
            @for (a of p.accounts(); track a.id) {
              <div class="border-b border-line last:border-b-0 hover:bg-violet/[0.03]"><app-account-row [a]="a" /></div>
            } @empty {
              <app-empty icon="fa-gamepad" title="No accounts yet" text="Add your first Free Fire account and the bot starts leveling it up right away.">
                <button type="button" class="btn btn-primary btn-sm" data-add (click)="p.addOpen.set(true)"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>
              </app-empty>
            }
          }
        </div>
      </div>

      <aside class="grid min-w-0 content-start gap-5 xl:gap-6">
        <div class="card grid gap-3 p-5">
          <div class="eyebrow">Account slots</div>
          @if (!p.loaded()) { <div class="skeleton h-16"></div> } @else {
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-display text-[30px] leading-none font-bold">{{ p.slots().used }}<span class="text-lg text-fg-3"> / {{ p.slots().max }}</span></span>
              <span class="text-[13.5px] text-fg-3">{{ p.slots().free }}</span>
            </div>
            <div class="bar bar-lg" [class.full]="p.slots().full" role="progressbar" [attr.aria-valuenow]="round(p.slots().pct)" aria-valuemin="0" aria-valuemax="100" aria-label="Account slots used">
              <span [style.width.%]="p.slots().pct"></span>
            </div>
            <div><button type="button" class="btn btn-secondary btn-sm" data-add (click)="p.addOpen.set(true)"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button></div>
          }
        </div>
        <div class="card overflow-hidden">
          <div class="card-head">
            <h3 class="card-title"><i class="fa-solid fa-wave-square" aria-hidden="true"></i>Recent activity</h3>
            <span class="badge badge-ok"><span class="dot pulse"></span>Live</span>
          </div>
          <div class="max-h-[520px] overflow-y-auto">
            <app-feed [logs]="p.logs()" emptyText="EXP gains and finished matches from your accounts show up here." />
          </div>
        </div>
      </aside>
    </div>`,
})
export class PanelOverview {
  readonly p = inject(PanelData);
  readonly clock = fmt.clock;
  readonly round = Math.round;
  readonly s = this.p.sub;

  readonly planLine = computed(() => {
    const s = this.s();
    if (s.unlimited) return 'Unlimited accounts, lifetime access';
    if (s.active) return `Expires ${fmt.date(s.expires_at)}`;
    if (s.expires_at) return `Expired ${fmt.date(s.expires_at)} — accounts paused`;
    return 'Buy a plan or redeem a key to get started';
  });

  readonly stats = computed(() => {
    const t = this.p.totals();
    return [
      { label: 'EXP gained', value: `+${fmt.compact(t.gained_exp)}`, icon: 'fa-arrow-trend-up', cls: 'text-ok' },
      { label: 'EXP per hour', value: t.exp_per_hour ? `+${fmt.compact(t.exp_per_hour)}` : '—', icon: 'fa-gauge-high', cls: 'text-data' },
      { label: 'Live matches', value: fmt.num(t.in_match), icon: 'fa-tower-broadcast', cls: t.in_match ? 'text-accent' : '' },
      { label: 'Matches played', value: fmt.num(t.matches), icon: 'fa-crosshairs', cls: '' },
      { label: 'Highest level', value: t.top_level || '—', icon: 'fa-trophy', cls: '' },
    ];
  });
}
