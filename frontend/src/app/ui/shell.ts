import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Session } from '../core/session';
import { Avatar, Brand, ThemeToggle } from './common';

export interface NavItem {
  id?: string;
  label?: string;
  icon?: string;
  /** Path under the shell's base ('' = the base itself). Defaults to the id. */
  path?: string;
  /** Absolute link outside this shell. */
  href?: string;
  section?: string;
}

/** Sidebar + topbar layout shared by the user panel and the admin panel. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, Brand, Avatar, ThemeToggle],
  template: `
    <div class="min-h-screen lg:pl-[264px]">
      <aside id="sidebar" aria-label="Main navigation"
        class="fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-line bg-surface transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] lg:translate-x-0 dark:bg-[#0e0e1d]"
        [class.-translate-x-full]="!navOpen()" [class.shadow-2xl]="navOpen()">
        <div class="flex h-[68px] flex-none items-center px-5">
          <a routerLink="/" class="rounded-lg"><app-brand [name]="session.settings().site_name || 'FF Level'" [tag]="portal()" /></a>
        </div>
        <nav class="grid gap-0.5 overflow-y-auto px-3 pt-2">
          @for (item of nav(); track $index) {
            @if (item.section) {
              <div class="px-3 pt-4 pb-1.5 text-[11px] font-bold tracking-[0.1em] text-fg-3 uppercase">{{ item.section }}</div>
            } @else {
              <a class="nav-item" [routerLink]="link(item)" [attr.data-route]="item.id" [class.active]="activeNav() === item.id"
                [attr.aria-current]="activeNav() === item.id ? 'page' : null" (click)="navOpen.set(false)">
                <i class="fa-solid {{ item.icon }}" aria-hidden="true"></i><span class="flex-1">{{ item.label }}</span>
                @if (counts()[item.id!]) {
                  <span class="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{{ counts()[item.id!] > 99 ? '99+' : counts()[item.id!] }}</span>
                }
              </a>
            }
          }
        </nav>
        <div class="px-3"><ng-content select="[sidebar]" /></div>
        <div class="mt-auto grid gap-3 border-t border-line p-3">
          <app-theme-toggle [full]="true" />
          <div class="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <app-avatar [name]="session.user()?.username" [size]="36" />
            <div class="min-w-0 flex-1 leading-tight">
              <b class="block truncate text-sm">{{ session.user()?.username }}</b>
              <span class="text-xs text-fg-3 capitalize">{{ session.user()?.role }}</span>
            </div>
            <a class="btn btn-ghost btn-icon btn-sm" href="/logout" aria-label="Sign out" title="Sign out"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i></a>
          </div>
        </div>
      </aside>

      @if (navOpen()) {
        <div class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden" (click)="navOpen.set(false)" aria-hidden="true"></div>
      }

      <main class="min-w-0">
        <header class="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
          <div class="mx-auto flex h-[68px] max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" class="btn btn-secondary btn-icon lg:hidden" (click)="navOpen.set(true)" aria-label="Open menu" aria-controls="sidebar" [attr.aria-expanded]="navOpen()">
              <i class="fa-solid fa-bars" aria-hidden="true"></i>
            </button>
            <div class="min-w-0 flex-1">
              <h1 id="page-title" class="truncate text-[19px] leading-tight sm:text-[22px]">{{ title() }}</h1>
              @if (sub()) { <p id="page-sub" class="hidden truncate text-[13px] text-fg-3 sm:block">{{ sub() }}</p> }
            </div>
            <ng-content select="[topbar]" />
            <app-theme-toggle />
          </div>
        </header>
        @if (announcement()) {
          <div class="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-8" role="note">
            <div class="flex items-center gap-3 rounded-xl border border-brand/25 bg-brand/[0.07] px-4 py-3 text-sm font-medium">
              <i class="fa-solid fa-bullhorn text-accent" aria-hidden="true"></i><span>{{ announcement() }}</span>
            </div>
          </div>
        }
        <section class="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8" tabindex="-1">
          <router-outlet />
        </section>
      </main>
    </div>`,
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

  readonly navOpen = signal(false);
  private data = signal<Record<string, any>>({});
  readonly activeNav = computed(() => this.data()['nav']);
  readonly title = computed(() => String(this.data()['title'] || '').replace('{user}', this.session.user()?.username || ''));
  readonly sub = computed(() => this.data()['sub'] || '');
  readonly announcement = computed(() => (this.showAnnouncement() ? this.session.settings().announcement : ''));

  constructor() {
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.readRoute());
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
    const site = this.session.settings().site_name || 'FF Level';
    const t = String(data['title'] || '').replace('{user}', this.session.user()?.username || '');
    document.title = data['nav'] === 'overview' && this.base() === '/panel' ? `Dashboard · ${site}` : `${t} · ${site}`;
  }
}
