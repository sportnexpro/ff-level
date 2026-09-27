import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { fmt } from '../../core/fmt';
import { Avatar, CountUp, Empty, Sparkline, Status, levelPct } from '../../ui/common';
import { Icon } from '../../ui/icon';
import { SubBadge } from './layout';
import { PanelData } from './panel-data';

/** Activity timeline (EXP gains, finished matches). */
@Component({
  selector: 'app-feed',
  imports: [Empty, Icon],
  template: `
    @if (!items().length) {
      <app-empty icon="activity" title="No activity yet" [text]="emptyText()" />
    } @else {
      <ol class="relative grid gap-0.5 px-5 pb-4">
        <span class="absolute top-4 bottom-6 left-[31px] w-px bg-line" aria-hidden="true"></span>
        @for (l of items(); track $index) {
          <li class="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 py-2.5">
            <span class="relative z-[1] mt-0.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-surface" [class]="tone(l.level)">
              <app-icon [name]="icon(l.level)" [size]="12" [stroke]="2.4" />
            </span>
            <div class="min-w-0">
              <p class="text-[13.5px] leading-snug break-words text-fg-2">{{ l.message }}</p>
              <time class="mt-0.5 block font-mono text-[11.5px] text-fg-3">{{ l.time }}</time>
            </div>
          </li>
        }
      </ol>
    }`,
})
export class Feed {
  readonly logs = input<any[]>([]);
  readonly limit = input(10);
  readonly emptyText = input('Activity from your accounts will show up here.');
  readonly items = computed(() => this.logs().slice(-this.limit()).reverse());
  icon(level: string) { return ({ success: 'trend', warning: 'warning', error: 'x' } as any)[level] || 'zap'; }
  tone(level: string) {
    return ({ success: 'bg-ok/15 text-ok', warning: 'bg-warn/15 text-warn', error: 'bg-bad/15 text-bad' } as any)[level] || 'bg-ember/15 text-accent';
  }
}

/** One account on the dashboard: who it is, where it is in the level, what it earns. */
@Component({
  selector: 'app-account-row',
  imports: [Avatar, Status],
  template: `
    <div class="@container">
      <div class="grid items-center gap-x-6 gap-y-3 px-5 py-4 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto]">
        <div class="flex min-w-0 items-center gap-3">
          <app-avatar [name]="a().nickname || a().login" [size]="42" />
          <div class="min-w-0">
            <div class="truncate text-[15px] font-semibold">{{ a().nickname || 'New account' }}</div>
            <div class="mt-0.5 flex min-w-0 items-center gap-2">
              <app-status [a]="a()" />
            </div>
          </div>
        </div>
        <div class="grid min-w-0 gap-2">
          <div class="flex items-baseline justify-between gap-3 text-[13px]">
            @if (!a().level) {
              <span class="text-fg-3">{{ a().running ? 'Signing in…' : 'Not running' }}</span>
            } @else {
              <span class="text-fg-3">Level <b class="num text-[15px] font-semibold text-fg">{{ a().level }}</b>
                @if (!a().max_level && a().next_level) { <span class="text-fg-3"> → {{ a().next_level }}</span> }</span>
              <span class="num font-medium" [class.text-accent]="!a().max_level">{{ a().max_level ? 'Max level' : pct() !== null ? floor(pct()!) + '%' : '' }}</span>
            }
          </div>
          <div class="bar" role="progressbar" [attr.aria-valuenow]="round(bar())" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to the next level">
            <span [style.width.%]="bar()"></span>
          </div>
          <div class="flex justify-between gap-3 text-[12px] text-fg-3"><span class="truncate">{{ foot()[0] }}</span><span class="whitespace-nowrap">{{ foot()[1] }}</span></div>
        </div>
        <dl class="grid grid-cols-3 gap-4 @2xl:flex @2xl:gap-6">
          @for (s of stats(); track s[0]) {
            <div class="min-w-0 @2xl:w-[76px] @2xl:text-right">
              <dt class="text-[12px] whitespace-nowrap text-fg-3">{{ s[0] }}</dt>
              <dd class="num mt-0.5 truncate text-[15px] font-semibold" [class]="s[2]">{{ s[1] }}</dd>
            </div>
          }
        </dl>
      </div>
    </div>`,
})
export class AccountRow {
  readonly a = input.required<any>();
  readonly floor = Math.floor;
  readonly round = Math.round;
  readonly pct = computed(() => levelPct(this.a()));
  readonly bar = computed(() => (!this.a().level ? 0 : this.pct() || 0));
  readonly foot = computed(() => {
    const a = this.a();
    if (!a.level) return ['Stats appear after the first login', ''];
    if (a.max_level) return [`${fmt.num(a.current_exp)} total EXP`, ''];
    return [
      a.exp_to_next ? `${fmt.num(a.exp_to_next)} EXP to go` : `${fmt.num(a.current_exp)} total EXP`,
      !a.running ? 'Paused' : a.eta_seconds ? `~${fmt.dur(a.eta_seconds)} left` : '',
    ];
  });
  readonly stats = computed(() => {
    const a = this.a();
    return [
      ['Gained', a.gained_exp ? `+${fmt.compact(a.gained_exp)}` : '0', a.gained_exp ? 'text-ok' : ''],
      ['Per hour', a.exp_per_hour ? fmt.compact(a.exp_per_hour) : '—', a.exp_per_hour ? '' : 'text-fg-3'],
      ['Matches', fmt.num(a.matches_played), ''],
    ];
  });
}

@Component({
  selector: 'app-panel-overview',
  imports: [RouterLink, SubBadge, AccountRow, Feed, Empty, CountUp, Sparkline, Icon],
  template: `
    <div class="grid animate-view-in gap-4 sm:gap-5">
      <!-- hero: live EXP + plan -->
      <div class="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section class="card relative overflow-hidden">
          <div class="flex items-start justify-between gap-4 p-5 pb-0 sm:p-6 sm:pb-0">
            <div>
              <div class="eyebrow flex items-center gap-2">EXP gained this session
                <span class="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok"><span class="st st-online"><i class="pulse h-1.5! w-1.5!"></i></span>Live</span>
              </div>
              @if (!p.loaded()) { <div class="skeleton mt-3 h-12 w-56"></div> }
              @else { <div class="mt-2 text-[44px] leading-none font-semibold tracking-[-0.04em] sm:text-[56px]"><app-count class="ember-text" [value]="t().gained_exp" format="plus" /></div> }
              <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-fg-3">
                <span><b class="num font-semibold text-fg">{{ t().exp_per_hour ? compact(t().exp_per_hour) : '—' }}</b> EXP / hour</span>
                <span><b class="num font-semibold text-fg">{{ t().in_match || 0 }}</b> live {{ t().in_match === 1 ? 'match' : 'matches' }}</span>
                <span><b class="num font-semibold text-fg">{{ t().running || 0 }}</b> running</span>
              </p>
            </div>
          </div>
          <div class="relative mt-4 h-28 sm:h-32">
            @if (p.history().length > 1) { <app-sparkline [data]="p.history()" class="h-full" /> }
            @else { <div class="absolute inset-x-6 bottom-6 h-px bg-line"></div><p class="absolute inset-x-0 bottom-9 text-center text-xs text-fg-3">The chart fills in live while this page is open</p> }
          </div>
        </section>

        <section class="card relative flex flex-col overflow-hidden p-5 sm:p-6">
          <div class="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-ember/20 blur-3xl" aria-hidden="true"></div>
          @if (!p.loaded()) { <div class="skeleton h-40"></div> } @else {
            <div class="relative flex items-center justify-between gap-3">
              <span class="eyebrow">Your plan</span><app-sub-badge [s]="s()" />
            </div>
            <div class="relative mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em]">{{ s().plan_name || 'No plan' }}</div>
            <div class="relative mt-4">
              <div class="eyebrow">Time left</div>
              <div class="num mt-1 font-mono text-[22px] font-medium tracking-[-0.02em]" [class.text-bad]="!s().unlimited && !p.remaining()" role="timer">
                {{ s().unlimited ? 'Lifetime' : clock(p.remaining()) }}</div>
              <p class="mt-1 text-[12.5px] text-fg-3">{{ planLine() }}</p>
            </div>
            <div class="relative mt-5 grid gap-2">
              <div class="flex justify-between text-[13px]"><span class="text-fg-3">Account slots</span><span class="num font-medium">{{ p.slots().used }} / {{ p.slots().max }}</span></div>
              <div class="bar" [class.full]="p.slots().full" role="progressbar" [attr.aria-valuenow]="round(p.slots().pct)" aria-valuemin="0" aria-valuemax="100" aria-label="Account slots used"><span [style.width.%]="s().unlimited ? 100 : p.slots().pct"></span></div>
            </div>
            <div class="relative mt-auto flex gap-2 pt-5">
              <a class="btn btn-brand btn-sm flex-1" routerLink="/panel/billing">{{ s().active ? 'Renew plan' : 'Get a plan' }}</a>
              <button type="button" class="btn btn-secondary btn-sm flex-1" data-add (click)="p.addOpen.set(true)"><app-icon name="plus" [size]="15" /><span>Add account</span></button>
            </div>
          }
        </section>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        @for (k of kpis(); track k.label) {
          <div class="card p-4 sm:p-5">
            <div class="flex items-center justify-between gap-2">
              <span class="eyebrow truncate">{{ k.label }}</span>
              <span class="grid h-7 w-7 flex-none place-items-center rounded-lg bg-surface-2 text-fg-3 dark:bg-white/[0.05]"><app-icon [name]="k.icon" [size]="15" /></span>
            </div>
            @if (!p.loaded()) { <div class="skeleton mt-3 h-8 w-16"></div> }
            @else { <div class="mt-2 text-[28px] leading-none font-semibold tracking-[-0.03em]" [class]="k.cls"><app-count [value]="k.value" /></div> }
          </div>
        }
      </div>

      <!-- accounts + activity -->
      <div class="grid items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section class="card min-w-0 overflow-hidden">
          <div class="card-head pb-3">
            <div><h3 class="card-title">Accounts</h3><p class="card-sub">Level progress and earnings, live</p></div>
            <a class="btn btn-ghost btn-sm" routerLink="/panel/accounts">View all <app-icon name="arrow-right" [size]="15" /></a>
          </div>
          @if (!p.loaded()) {
            <div class="grid gap-3 p-5"><div class="skeleton h-16"></div><div class="skeleton h-16"></div></div>
          } @else {
            <div class="divide-y divide-line border-t border-line">
              @for (a of p.accounts(); track a.id) {
                <app-account-row [a]="a" />
              } @empty {
                <app-empty icon="gamepad" title="No accounts yet" text="Add your first Free Fire account and the bot starts leveling it up right away.">
                  <button type="button" class="btn btn-brand btn-sm" data-add (click)="p.addOpen.set(true)"><app-icon name="plus" [size]="15" /><span>Add account</span></button>
                </app-empty>
              }
            </div>
          }
        </section>
        <section class="card min-w-0 overflow-hidden">
          <div class="card-head pb-3"><h3 class="card-title">Activity</h3></div>
          <div class="max-h-[560px] overflow-y-auto">
            <app-feed [logs]="p.logs()" emptyText="EXP gains and finished matches from your accounts show up here." />
          </div>
        </section>
      </div>
    </div>`,
})
export class PanelOverview {
  readonly p = inject(PanelData);
  readonly clock = fmt.clock;
  readonly compact = fmt.compact;
  readonly round = Math.round;
  readonly s = this.p.sub;
  readonly t = this.p.totals;

  readonly planLine = computed(() => {
    const s = this.s();
    if (s.unlimited) return 'Unlimited accounts, lifetime access';
    if (s.active) return `Ends ${fmt.date(s.expires_at)}`;
    if (s.expires_at) return `Expired ${fmt.date(s.expires_at)} — accounts are paused`;
    return 'Buy a plan or redeem a key to get started';
  });

  readonly kpis = computed(() => {
    const t = this.t();
    return [
      { label: 'Live matches', value: t.in_match || 0, icon: 'live', cls: t.in_match ? 'text-accent' : '' },
      { label: 'Matches played', value: t.matches || 0, icon: 'swords', cls: '' },
      { label: 'Highest level', value: t.top_level || 0, icon: 'trophy', cls: '' },
      { label: 'Accounts running', value: t.running || 0, icon: 'server', cls: '' },
    ];
  });
}
