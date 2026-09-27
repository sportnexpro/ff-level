import { Component, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { fmt } from '../core/fmt';
import { Theme, ThemeMode } from '../core/theme';
import { Icon } from './icon';

/** Logo mark + site name. */
@Component({
  selector: 'app-brand',
  imports: [Icon],
  template: `
    <span class="brand-mark"><app-icon name="flame" [size]="17" [stroke]="2.4" /></span>
    <span class="min-w-0 leading-none">
      <span class="block text-[16.5px] font-semibold tracking-[-0.02em] text-fg">{{ name() }}</span>
      @if (tag()) { <small class="mt-1 block text-[11px] font-medium text-fg-3">{{ tag() }}</small> }
    </span>`,
  host: { class: 'inline-flex items-center gap-2.5' },
})
export class Brand {
  readonly name = input('FF Level');
  readonly tag = input('');
}

/** Initials avatar with a stable colour per name. */
@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  host: {
    'aria-hidden': 'true',
    class: 'grid flex-none place-items-center font-semibold text-white select-none',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.border-radius.px]': 'round() ? size() : size() * 0.28',
    '[style.font-size.px]': 'size() * 0.36',
    '[style.background]': 'bg()',
    '[style.box-shadow]': '"inset 0 1px 0 rgba(255,255,255,.25), inset 0 -8px 16px -8px rgba(0,0,0,.25)"',
  },
})
export class Avatar {
  readonly name = input<string>('');
  readonly size = input(40);
  readonly round = input(false);
  readonly initials = computed(() => fmt.initials(this.name()));
  readonly bg = computed(() => {
    const h = fmt.hue(this.name());
    return `linear-gradient(145deg, hsl(${h} 70% 58%), hsl(${(h + 35) % 360} 72% 42%))`;
  });
}

/** Empty state with an optional projected action. */
@Component({
  selector: 'app-empty',
  imports: [Icon],
  template: `
    <div class="mx-auto grid max-w-sm justify-items-center gap-1.5 px-6 py-14 text-center">
      <span class="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-line-2 bg-surface-2 text-fg-3 dark:bg-white/[0.04]">
        <app-icon [name]="icon()" [size]="20" />
      </span>
      <h4 class="text-[15px]">{{ heading() }}</h4>
      <p class="text-sm text-fg-3">{{ text() }}</p>
      <div class="mt-4 empty:hidden"><ng-content /></div>
    </div>`,
})
export class Empty {
  readonly icon = input('inbox');
  readonly heading = input('', { alias: 'title' });
  readonly text = input('');
}

const STATUS: Record<string, [string, string]> = {
  IN_MATCH: ['match', 'In match'], SEARCHING: ['search', 'Finding a match'], ONLINE: ['online', 'Online'],
  CONNECTING: ['wait', 'Connecting'], STARTING: ['wait', 'Starting'], ERROR: ['error', 'Login error'],
  OFFLINE: ['off', 'Offline'], PAUSED: ['off', 'Paused'],
};

/** Account status: coloured dot (pulsing while live) + words + live match count. */
@Component({
  selector: 'app-status',
  template: `<span class="st st-{{ cls() }}"><i [class.pulse]="live()" aria-hidden="true"></i>{{ label() }}@if (matches()) {<span class="font-normal text-fg-3">&nbsp;· {{ matches() }} live</span>}</span>`,
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

let seq = 0;

/** Level number in the middle, progress to the next level around it. */
@Component({
  selector: 'app-level-ring',
  template: `
    <div class="relative flex-none" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="label()">
      <svg viewBox="0 0 80 80" class="h-full w-full -rotate-90" aria-hidden="true">
        <defs><linearGradient [attr.id]="gid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb224" /><stop offset=".55" stop-color="#ff6a1a" /><stop offset="1" stop-color="#ff3d2e" /></linearGradient></defs>
        <circle cx="40" cy="40" r="34" fill="none" stroke-width="6" class="stroke-surface-3 dark:stroke-white/[0.07]" />
        @if (pct()) {
          <circle cx="40" cy="40" r="34" fill="none" stroke-width="6" stroke-linecap="round" [attr.stroke]="'url(#' + gid + ')'"
            [attr.stroke-dasharray]="dash()" style="transition: stroke-dasharray 800ms cubic-bezier(.16,1,.3,1)" />
        }
      </svg>
      <div class="absolute inset-0 grid place-content-center text-center leading-none">
        <b class="num font-semibold tracking-[-0.03em]" [style.font-size.px]="size() * 0.3">{{ a().level ?? '–' }}</b>
        <small class="mt-1 text-[10px] font-medium text-fg-3">level</small>
      </div>
    </div>`,
})
export class LevelRing {
  readonly a = input.required<any>();
  readonly size = input(76);
  readonly gid = `ring-${++seq}`;
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

/** In-game profile banner. The avatar + name sit underneath and the banner fades in once it has loaded. */
@Component({
  selector: 'app-banner',
  imports: [Avatar],
  template: `
    <div class="relative aspect-[513/110] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line dark:bg-white/[0.03]">
      <div class="absolute inset-0 flex items-center gap-3 px-4"
        style="background: radial-gradient(120% 160% at 0% 0%, rgba(255,106,26,.16), transparent 60%)">
        <app-avatar [name]="a().nickname || a().login" [size]="40" />
        <div class="min-w-0">
          <div class="truncate text-[15px] font-semibold">{{ a().nickname || 'New account' }}</div>
          <div class="truncate font-mono text-xs text-fg-3">{{ a().game_id || a().login }}</div>
        </div>
      </div>
      @if (src() && !failed()) {
        <img [src]="src()" width="513" height="110" class="relative block h-full w-full object-cover transition-opacity duration-500"
          [class.opacity-0]="!loaded()" [alt]="alt()" (load)="loaded.set(true)" (error)="failed.set(true)" />
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

/** Light / dark switch: a single sun/moon button, or a 3-way Light · Auto · Dark control. */
@Component({
  selector: 'app-theme-toggle',
  imports: [Icon],
  template: `
    @if (full()) {
      <div class="seg w-full" role="group" aria-label="Theme">
        @for (o of options; track o.mode) {
          <button type="button" class="flex flex-1 items-center justify-center gap-1.5" [attr.aria-pressed]="theme.mode() === o.mode" (click)="theme.set(o.mode)">
            <app-icon [name]="o.icon" [size]="14" />{{ o.label }}
          </button>
        }
      </div>
    } @else {
      <button type="button" class="btn btn-ghost btn-icon" (click)="theme.toggle()"
        [attr.aria-label]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'" [title]="theme.dark() ? 'Light mode' : 'Dark mode'">
        <app-icon [name]="theme.dark() ? 'sun' : 'moon'" [size]="18" />
      </button>
    }`,
})
export class ThemeToggle {
  readonly theme = inject(Theme);
  readonly full = input(false);
  readonly options: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: 'sun' },
    { mode: 'system', label: 'Auto', icon: 'monitor' },
    { mode: 'dark', label: 'Dark', icon: 'moon' },
  ];
}

/** A number that counts smoothly to its new value. */
@Component({
  selector: 'app-count',
  template: '',
  host: { class: 'num' },
})
export class CountUp implements OnDestroy {
  readonly value = input<number>(0);
  readonly format = input<'num' | 'compact' | 'plus' | 'plus-compact'>('num');
  private el: HTMLElement = inject(ElementRef).nativeElement;
  private zone = inject(NgZone);
  private shown = 0;
  private frame = 0;
  private first = true;

  constructor() {
    effect(() => {
      const to = Number(this.value()) || 0;
      const f = this.format();
      this.zone.runOutsideAngular(() => this.animate(to, f));
    });
  }

  private text(v: number, f: string) {
    const n = Math.round(v);
    if (f === 'compact') return fmt.compact(n);
    if (f === 'plus') return `+${fmt.num(n)}`;
    if (f === 'plus-compact') return `+${fmt.compact(n)}`;
    return fmt.num(n);
  }

  private animate(to: number, f: string) {
    cancelAnimationFrame(this.frame);
    const from = this.first ? 0 : this.shown;
    this.first = false;
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.shown = to;
      this.el.textContent = this.text(to, f);
      return;
    }
    const start = performance.now(), dur = 900;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.shown = from + (to - from) * e;
      this.el.textContent = this.text(this.shown, f);
      if (k < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  ngOnDestroy() { cancelAnimationFrame(this.frame); }
}

/** Small area chart for a live series. */
@Component({
  selector: 'app-sparkline',
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" class="block h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gid + 'f'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a1a" stop-opacity=".32" /><stop offset="1" stop-color="#ff6a1a" stop-opacity="0" /></linearGradient>
        <linearGradient [attr.id]="gid + 's'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb224" /><stop offset="1" stop-color="#ff3d2e" /></linearGradient>
      </defs>
      @if (paths(); as p) {
        <path [attr.d]="p.area" [attr.fill]="'url(#' + gid + 'f)'" />
        <path [attr.d]="p.line" fill="none" [attr.stroke]="'url(#' + gid + 's)'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      }
    </svg>`,
  host: { class: 'block' },
})
export class Sparkline {
  readonly data = input<number[]>([]);
  readonly gid = `spark-${++seq}`;
  readonly w = 300;
  readonly h = 80;
  readonly paths = computed(() => {
    const d = this.data();
    if (d.length < 2) return null;
    const min = Math.min(...d), max = Math.max(...d), span = max - min || 1;
    const pts = d.map((v, i) => [(i / (d.length - 1)) * this.w, this.h - 6 - ((v - min) / span) * (this.h - 12)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${this.w},${this.h} L0,${this.h} Z` };
  });
}
