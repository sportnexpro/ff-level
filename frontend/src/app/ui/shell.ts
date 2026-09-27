import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Session } from '../core/session';
import { Avatar, Brand, ThemeToggle } from './common';
import { Icon } from './icon';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  /** Path under the shell's base ('' = the base itself). Defaults to the id. */
  path?: string;
  /** Absolute link outside this shell. */
  href?: string;
  /** Show in the account menu instead of the main navigation. */
  menu?: boolean;
}

/**
 * Top navigation layout shared by the user panel and the admin panel.
 * Phones get an app-style bottom tab bar (or a scrolling tab strip when there are many sections).
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, Brand, Avatar, ThemeToggle, Icon],
  template: `
    <header class="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl backdrop-saturate-150">
      <div class="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <a routerLink="/" class="mr-2 rounded-lg"><app-brand [name]="site()" /></a>
        @if (portal()) { <span class="hidden rounded-md border border-line-2 px-1.5 py-0.5 text-[11px] font-medium text-fg-3 sm:inline">{{ portal() }}</span> }

        <nav class="ml-3 hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex [scrollbar-width:none]" aria-label="Main navigation">
          @for (item of main(); track item.id) {
            <a class="nav-item" [routerLink]="link(item)" [attr.data-route]="item.id" [class.active]="activeNav() === item.id"
              [attr.aria-current]="activeNav() === item.id ? 'page' : null">
              {{ item.label }}
              @if (counts()[item.id]) { <span class="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember px-1 text-[10.5px] font-semibold text-[#1c0800]">{{ counts()[item.id] > 99 ? '99+' : counts()[item.id] }}</span> }
            </a>
          }
        </nav>

        <div class="ml-auto flex items-center gap-1.5">
          <ng-content select="[topbar]" />
          <app-theme-toggle />
          <div class="relative">
            <button type="button" class="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition hover:bg-surface-2" (click)="menuOpen.set(!menuOpen()); $event.stopPropagation()"
              aria-haspopup="menu" [attr.aria-expanded]="menuOpen()" aria-label="Account menu">
              <app-avatar [name]="session.user()?.username" [size]="32" [round]="true" />
              <app-icon name="chevron-down" [size]="14" class="text-fg-3" />
            </button>
            <div class="absolute top-full right-0 mt-2 w-64 origin-top-right rounded-2xl border border-line-2 bg-surface p-1.5 transition duration-150"
              style="box-shadow: var(--shadow-pop)" role="menu" [class.invisible]="!menuOpen()" [class.opacity-0]="!menuOpen()" [class.scale-95]="!menuOpen()"
              (click)="$event.stopPropagation()">
              <div class="flex items-center gap-3 px-2.5 py-2.5">
                <app-avatar [name]="session.user()?.username" [size]="36" [round]="true" />
                <div class="min-w-0 leading-tight">
                  <b class="block truncate text-sm font-semibold">{{ session.user()?.username }}</b>
                  <span class="text-xs text-fg-3 capitalize">{{ session.user()?.role }}</span>
                </div>
              </div>
              <div class="px-1.5 pb-2"><app-theme-toggle [full]="true" /></div>
              <div class="my-1 h-px bg-line"></div>
              @for (item of extra(); track item.id) {
                <a class="nav-item flex! w-full" [routerLink]="link(item)" [attr.data-route]="item.id" (click)="menuOpen.set(false)" role="menuitem">
                  <app-icon [name]="item.icon" [size]="16" />{{ item.label }}
                </a>
              }
              <a class="nav-item flex! w-full hover:text-bad!" href="/logout" role="menuitem"><app-icon name="logout" [size]="16" />Sign out</a>
            </div>
          </div>
        </div>
      </div>
      @if (!tabbar()) {
        <nav class="flex gap-1 overflow-x-auto px-4 pb-2.5 md:hidden [scrollbar-width:none]" aria-label="Sections">
          @for (item of main(); track item.id) {
            <a class="nav-item h-8! text-[13px]!" [routerLink]="link(item)" [class.active]="activeNav() === item.id">{{ item.label }}</a>
          }
        </nav>
      }
    </header>

    <main class="mx-auto max-w-[1200px] px-4 pt-7 sm:px-6 sm:pt-10" [class]="tabbar() ? 'pb-28 md:pb-16' : 'pb-16'">
      @if (announcement()) {
        <div class="mb-6 flex items-center gap-3 rounded-2xl border border-ember/25 bg-ember/[0.06] px-4 py-3 text-sm font-medium" role="note">
          <app-icon name="megaphone" [size]="17" class="text-accent" /><span>{{ announcement() }}</span>
        </div>
      }
      <div class="mb-7 min-w-0">
        <h1 id="page-title" class="text-[26px] leading-tight sm:text-[32px]">{{ title() }}</h1>
        @if (sub()) { <p id="page-sub" class="mt-1.5 text-[14.5px] text-fg-3">{{ sub() }}</p> }
      </div>
      <router-outlet />
    </main>

    @if (tabbar()) {
      <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Sections">
        <div class="mx-auto flex max-w-md">
          @for (item of main(); track item.id) {
            <a class="tabbar-item" [routerLink]="link(item)" [class.active]="activeNav() === item.id">
              <app-icon [name]="item.icon" [size]="21" />{{ item.label }}
            </a>
          }
        </div>
      </nav>
    }`,
  host: { '(document:click)': 'menuOpen.set(false)', '(document:keydown.escape)': 'menuOpen.set(false)' },
})
export class Shell implements OnInit {
  readonly session = inject(Session);
  private router = inject(Router);

  readonly nav = input.required<NavItem[]>();
  readonly portal = input('');
  readonly base = input.required<string>();
  readonly counts = input<Record<string, number>>({});
  readonly showAnnouncement = input(false);
  /** Old /base#/<id> bookmarks: id -> new path. */
  readonly legacy = input<Record<string, string>>({});

  readonly menuOpen = signal(false);
  readonly main = computed(() => this.nav().filter((i) => !i.menu));
  readonly extra = computed(() => this.nav().filter((i) => i.menu));
  readonly tabbar = computed(() => this.main().length <= 5);
  readonly site = computed(() => this.session.settings().site_name || 'FF Level');
  private data = signal<Record<string, any>>({});
  readonly activeNav = computed(() => this.data()['nav']);
  readonly title = computed(() => this.fill(this.data()['title']));
  readonly sub = computed(() => this.data()['sub'] || '');
  readonly announcement = computed(() => (this.showAnnouncement() ? this.session.settings().announcement : ''));

  constructor() {
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.readRoute();
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  ngOnInit() {
    this.readRoute();
    const legacy = location.hash.match(/^#\/([\w-]+)/);
    if (legacy) {
      const path = this.legacy()[legacy[1]] ?? legacy[1];
      this.router.navigateByUrl(path ? `${this.base()}/${path}` : this.base(), { replaceUrl: true });
    }
  }

  link(item: NavItem) {
    if (item.href) return item.href;
    const path = item.path ?? item.id;
    return path ? `${this.base()}/${path}` : this.base();
  }

  private readRoute() {
    let r: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let data: Record<string, any> = {};
    while (r) { data = { ...data, ...r.data }; r = r.firstChild; }
    this.data.set(data);
    const t = this.fill(data['title']);
    document.title = `${data['nav'] === 'overview' && this.base() === '/panel' ? 'Dashboard' : t} · ${this.site()}`;
  }

  /** Route titles may use {user} and {greeting}. */
  private fill(title: unknown) {
    const h = new Date().getHours();
    const greeting = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return String(title || '').replace('{greeting}', greeting).replace('{user}', this.session.user()?.username || '');
  }
}
