import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { fmt } from '../core/fmt';
import { Theme, ThemeMode } from '../core/theme';

/** Brand mark + site name. */
@Component({
  selector: 'app-brand',
  template: `
    <span class="brand-mark" aria-hidden="true"><i class="fa-solid fa-fire"></i></span>
    <span class="min-w-0 leading-tight">
      <span class="block font-display text-[18px] font-bold tracking-[0.01em] text-fg">{{ name() }}</span>
      @if (tag()) { <small class="block text-[11.5px] font-semibold text-fg-3">{{ tag() }}</small> }
    </span>`,
  host: { class: 'inline-flex items-center gap-2.5' },
})
export class Brand {
  readonly name = input('FF Level');
  readonly tag = input('');
}

/** Coloured initials avatar. */
@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  host: {
    'aria-hidden': 'true',
    class: 'grid flex-none place-items-center font-display font-bold text-white select-none',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.border-radius.px]': 'size() * 0.3',
    '[style.font-size.px]': 'size() * 0.36',
    '[style.background]': 'bg()',
    '[style.box-shadow]': '"inset 0 1px 0 rgba(255,255,255,.22), 0 6px 14px -8px rgba(0,0,0,.6)"',
  },
})
export class Avatar {
  readonly name = input<string>('');
  readonly size = input(40);
  readonly initials = computed(() => fmt.initials(this.name()));
  readonly bg = computed(() => {
    const h = fmt.hue(this.name());
    return `linear-gradient(135deg, hsl(${h} 72% 56%), hsl(${(h + 40) % 360} 70% 44%))`;
  });
}

/** Empty state with an optional action (projected). */
@Component({
  selector: 'app-empty',
  template: `
    <div class="mx-auto grid max-w-sm justify-items-center gap-2 px-6 py-12 text-center">
      <span class="mb-2 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface-2 text-xl text-fg-3">
        <i class="fa-solid {{ icon() }}" aria-hidden="true"></i>
      </span>
      <h4 class="text-base">{{ heading() }}</h4>
      <p class="text-sm text-fg-3">{{ text() }}</p>
      <div class="mt-3 empty:hidden"><ng-content /></div>
    </div>`,
})
export class Empty {
  readonly icon = input('fa-inbox');
  readonly heading = input('', { alias: 'title' });
  readonly text = input('');
}

const STATUS: Record<string, [string, string]> = {
  IN_MATCH: ['match', 'In match'], SEARCHING: ['search', 'Finding a match'], ONLINE: ['online', 'Online'],
  CONNECTING: ['wait', 'Connecting'], STARTING: ['wait', 'Starting'], ERROR: ['error', 'Login error'],
  OFFLINE: ['off', 'Offline'], PAUSED: ['off', 'Paused'],
};

/** Account status as a quiet dot + words (+ live match count). */
@Component({
  selector: 'app-status',
  template: `<span class="st st-{{ cls() }}"><i aria-hidden="true" [class.pulse]="live()"></i>{{ label() }}@if (matches()) {<span class="text-fg-3">&nbsp;· {{ matches() }} live</span>}</span>`,
})
export class Status {
  readonly a = input.required<any>();
  private entry = computed(() => STATUS[this.a().status] || ['off', this.a().status || 'Unknown']);
  readonly cls = computed(() => this.entry()[0]);
  readonly label = computed(() => this.entry()[1]);
  readonly live = computed(() => ['match', 'search', 'online'].includes(this.cls()));
  readonly matches = computed(() => (this.a().running && this.a().active_matches) || 0);
}

const BADGE: Record<string, [string, string]> = {
  ONLINE: ['badge-ok', 'Online'], IN_MATCH: ['badge-accent', 'In match'], SEARCHING: ['badge-info', 'Searching'],
  CONNECTING: ['badge-warn', 'Connecting'], STARTING: ['badge-warn', 'Starting'], ERROR: ['badge-bad', 'Error'],
  OFFLINE: ['', 'Offline'], PAUSED: ['', 'Paused'],
};

@Component({
  selector: 'app-status-badge',
  template: `<span class="badge {{ entry()[0] }}"><span class="dot" aria-hidden="true"></span>{{ entry()[1] }}</span>`,
})
export class StatusBadge {
  readonly status = input('');
  readonly entry = computed(() => BADGE[this.status()] || ['', this.status() || 'Unknown']);
}

export function levelPct(a: any): number | null {
  if (a.max_level) return 100;
  return a.level_pct === null || a.level_pct === undefined ? null : Math.min(100, Math.max(0, a.level_pct));
}

let ringSeq = 0;

/** Level number inside, progress to the next level around it. */
@Component({
  selector: 'app-level-ring',
  template: `
    <div class="relative h-[76px] w-[76px] flex-none" role="img" [attr.aria-label]="label()">
      <svg viewBox="0 0 80 80" class="h-full w-full -rotate-90" aria-hidden="true">
        <defs><linearGradient [attr.id]="gid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3366" /><stop offset="1" stop-color="#a855f7" /></linearGradient></defs>
        <circle cx="40" cy="40" r="34" fill="none" stroke-width="7" class="stroke-surface-3" />
        @if (pct()) {
          <circle cx="40" cy="40" r="34" fill="none" stroke-width="7" stroke-linecap="round" [attr.stroke]="'url(#' + gid + ')'"
            [attr.stroke-dasharray]="dash()" class="transition-[stroke-dasharray] duration-700" />
        }
      </svg>
      <div class="absolute inset-0 grid place-content-center text-center leading-none">
        <b class="font-display text-[22px] font-bold">{{ a().level ?? '–' }}</b>
        <small class="mt-1 text-[10px] font-bold tracking-[0.08em] text-fg-3 uppercase">level</small>
      </div>
    </div>`,
})
export class LevelRing {
  readonly a = input.required<any>();
  readonly gid = `ring-${++ringSeq}`;
  readonly pct = computed(() => levelPct(this.a()) || 0);
  readonly dash = computed(() => {
    const c = 2 * Math.PI * 34;
    return `${((c * this.pct()) / 100).toFixed(1)} ${c.toFixed(1)}`;
  });
  readonly label = computed(() => {
    const a = this.a();
    if (!a.level) return 'Level unknown';
    const p = levelPct(a);
    return `Level ${a.level}${p !== null && !a.max_level ? `, ${Math.floor(p)}% to level ${a.next_level}` : ''}`;
  });
}

/** In-game profile banner; falls back to avatar + name when there is none or it fails to load. */
@Component({
  selector: 'app-banner',
  imports: [Avatar],
  template: `
    <div class="relative aspect-[513/110] overflow-hidden rounded-xl bg-surface-3 shadow-[0_10px_24px_-14px_rgba(0,0,0,.7)] ring-1 ring-black/5 dark:ring-white/5">
      <!-- avatar + name underneath; the banner fades in over it once it has loaded -->
      <div class="absolute inset-0 flex items-center gap-3 px-4"
        style="background: radial-gradient(120% 140% at 0% 0%, rgba(255,51,102,.18), transparent 60%), radial-gradient(120% 140% at 100% 100%, rgba(168,85,247,.16), transparent 60%)">
        <app-avatar [name]="a().nickname || a().login" [size]="42" />
        <div class="min-w-0">
          <div class="truncate font-display text-[15px] font-bold">{{ a().nickname || 'New account' }}</div>
          <div class="truncate font-mono text-xs text-fg-3">{{ a().game_id || a().login }}</div>
        </div>
      </div>
      @if (src() && !failed()) {
        <img [src]="src()" width="513" height="110" class="relative block h-full w-full object-cover transition-opacity duration-300" [class.opacity-0]="!loaded()"
          [alt]="alt()" (load)="loaded.set(true)" (error)="failed.set(true)" />
      }
    </div>`,
})
export class Banner {
  readonly a = input.required<any>();
  readonly failed = signal(false);
  readonly loaded = signal(false);
  readonly src = computed(() => {
    const a = this.a();
    if (!(a.level && a.game_id)) return '';
    return `/api/panel/banner/${a.id}?lv=${a.level}&v=${a.banner_id || 0}-${a.avatar_id || 0}`;
  });
  readonly alt = computed(() => `${this.a().nickname || this.a().login} · UID ${this.a().game_id} · level ${this.a().level}`);

  constructor() {
    // A new banner URL (level up, new cosmetics) gets a fresh chance to load.
    effect(() => { this.src(); this.failed.set(false); });
  }
}

/** Theme switch: a single sun/moon button, or a 3-way light / system / dark control. */
@Component({
  selector: 'app-theme-toggle',
  template: `
    @if (full()) {
      <div class="seg w-full" role="group" aria-label="Theme">
        @for (o of options; track o.mode) {
          <button type="button" class="flex flex-1 items-center justify-center gap-1.5 px-2!" [attr.aria-pressed]="theme.mode() === o.mode"
            (click)="theme.set(o.mode)" [attr.aria-label]="o.label + ' theme'" [title]="o.label">
            <i class="fa-solid {{ o.icon }} text-[12px]" aria-hidden="true"></i><span class="text-[12.5px]">{{ o.label }}</span>
          </button>
        }
      </div>
    } @else {
      <button type="button" class="btn btn-secondary btn-icon" (click)="theme.toggle()"
        [attr.aria-label]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'" [title]="theme.dark() ? 'Light mode' : 'Dark mode'">
        <i class="fa-solid" [class.fa-sun]="theme.dark()" [class.fa-moon]="!theme.dark()" aria-hidden="true"></i>
      </button>
    }`,
})
export class ThemeToggle {
  readonly theme = inject(Theme);
  readonly full = input(false);
  readonly options: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: 'fa-sun' },
    { mode: 'system', label: 'Auto', icon: 'fa-desktop' },
    { mode: 'dark', label: 'Dark', icon: 'fa-moon' },
  ];
}
