import { AfterViewInit, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { contactUrls, fmt } from '../core/fmt';
import { Session } from '../core/session';
import { Brand, Empty, ThemeToggle } from '../ui/common';
import { PriceCard } from './panel/billing';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Brand, ThemeToggle, PriceCard, Empty],
  template: `
    <!-- glow + grid behind the hero -->
    <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] overflow-hidden" aria-hidden="true">
      <span class="absolute top-[-220px] left-1/2 h-[420px] w-[620px] -translate-x-[80%] rounded-full bg-[#ff3366] opacity-25 blur-[90px] dark:opacity-35"></span>
      <span class="absolute top-[-160px] left-1/2 h-[420px] w-[560px] rounded-full bg-[#7c3aed] opacity-20 blur-[90px] dark:opacity-30"></span>
      <div class="absolute inset-0 [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_20%,#000_20%,transparent_75%)]"
        style="background-image: linear-gradient(var(--c-line) 1px, transparent 1px), linear-gradient(90deg, var(--c-line) 1px, transparent 1px)"></div>
    </div>

    <div class="sticky top-3 z-50 px-3 sm:top-4 sm:px-4">
      <header class="mx-auto mt-3 flex h-[60px] max-w-[1140px] items-center gap-1.5 rounded-2xl border border-line-2 bg-surface/75 pr-2.5 pl-4 shadow-[0_10px_40px_-20px_rgba(0,0,0,.35)] backdrop-blur-xl backdrop-saturate-150 sm:mt-4">
        <a routerLink="/" class="mr-auto rounded-lg md:mr-4"><app-brand [name]="site()" /></a>
        <nav class="hidden gap-0.5 md:flex" aria-label="Sections">
          @for (l of links; track l[0]) {
            <a [href]="'#' + l[0]" (click)="jump($event, l[0])" class="rounded-lg px-3 py-2 text-[14.5px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg">{{ l[1] }}</a>
          }
        </nav>
        <div class="ml-auto flex items-center gap-1.5 sm:gap-2">
          <app-theme-toggle />
          <a class="btn btn-ghost hidden sm:inline-flex" routerLink="/login">Login</a>
          <a class="btn btn-primary" [routerLink]="signup()">Get started</a>
        </div>
      </header>
    </div>

    <main>
      <!-- hero -->
      <section class="relative px-4 pt-16 text-center sm:pt-24">
        <div class="mx-auto max-w-[1140px]">
          <a href="#pricing" (click)="jump($event, 'pricing')"
            class="inline-flex items-center gap-2.5 rounded-full border border-line-2 bg-surface/70 py-1 pr-3.5 pl-1 text-[13.5px] font-semibold text-fg-2 backdrop-blur transition hover:border-fg-3/40">
            <span class="rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white" style="background: linear-gradient(120deg,#ff3366,#ff5c8a 45%,#a855f7)">NEW</span>
            <span>{{ offer() }}</span><i class="fa-solid fa-arrow-right text-[11px]" aria-hidden="true"></i>
          </a>
          <h1 class="mx-auto mt-7 mb-5 max-w-[920px] text-[clamp(40px,7vw,78px)] leading-[1.02] font-bold tracking-[-0.035em]">
            Level up your Free Fire.<br><span class="grad-text">Without playing.</span>
          </h1>
          <p class="mx-auto max-w-[600px] text-[clamp(16px,1.7vw,19px)] leading-relaxed text-fg-2">
            {{ site() }} plays matches for you around the clock, so your account climbs while you sleep, study or work.
          </p>
          <div class="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a class="btn btn-primary btn-lg" [routerLink]="signup()">Start leveling <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
            <a class="btn btn-secondary btn-lg" href="#pricing" (click)="jump($event, 'pricing')">View pricing</a>
          </div>
          <div class="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13.5px] font-semibold text-fg-3">
            @for (t of trust; track t) { <span class="inline-flex items-center gap-2"><i class="fa-solid fa-circle-check text-ok" aria-hidden="true"></i>{{ t }}</span> }
          </div>

          <!-- product preview (demo data only) -->
          <div class="reveal relative mx-auto mt-16 max-w-[1020px] [perspective:1600px]" aria-hidden="true">
            <div class="absolute inset-x-[10%] top-[10%] -bottom-[6%] -z-10 rounded-[40px] opacity-25 blur-[80px]" style="background: linear-gradient(120deg,#ff3366,#ff5c8a 45%,#a855f7)"></div>
            <div class="overflow-hidden rounded-[18px] border border-line-2 bg-surface text-left shadow-[0_60px_120px_-40px_rgba(0,0,0,.55)] md:[transform:rotateX(8deg)] md:origin-top">
              <div class="flex items-center gap-1.5 border-b border-line bg-surface-2 px-4 py-3">
                <i class="h-[11px] w-[11px] rounded-full bg-[#ff5f57]"></i><i class="h-[11px] w-[11px] rounded-full bg-[#febc2e]"></i><i class="h-[11px] w-[11px] rounded-full bg-[#28c840]"></i>
                <span class="mx-auto rounded-lg bg-surface px-3.5 py-1 font-mono text-xs text-fg-3">ff-level / panel</span>
              </div>
              <div class="grid min-h-[360px] md:grid-cols-[180px_1fr]">
                <aside class="hidden content-start gap-1 border-r border-line bg-surface-2/50 p-3 md:grid">
                  <div class="flex items-center gap-2 px-2 pb-3 font-display text-sm font-bold"><span class="brand-mark h-6! w-6! rounded-md! text-[11px]!"><i class="fa-solid fa-fire"></i></span>{{ site() }}</div>
                  @for (n of demoNav; track n[1]; let first = $first) {
                    <span class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold" [class]="first ? 'bg-surface text-fg shadow-sm dark:bg-surface-3' : 'text-fg-3'">
                      <i class="fa-solid {{ n[0] }} w-4 text-center" [class.text-accent]="first"></i>{{ n[1] }}</span>
                  }
                </aside>
                <div class="grid content-start gap-3.5 p-4 sm:p-5">
                  <div class="grid gap-3.5 sm:grid-cols-[1.6fr_1fr]">
                    <div class="rounded-xl border border-line bg-surface-2/40 p-4">
                      <small class="eyebrow text-[10.5px]!">Current plan</small>
                      <div class="mt-1 flex items-center gap-2 font-display text-xl font-bold">Pro <span class="badge badge-ok"><span class="dot"></span>Active</span></div>
                    </div>
                    <div class="rounded-xl border border-line bg-surface-2/40 p-4">
                      <small class="eyebrow text-[10.5px]!">Time left</small>
                      <div class="mt-1 font-display text-xl font-bold tabular-nums">{{ demoTimer() }}</div>
                    </div>
                  </div>
                  <div class="grid grid-cols-3 gap-2 sm:gap-3.5">
                    <div class="rounded-xl border border-line bg-surface-2/40 p-3 sm:p-4"><small class="eyebrow text-[10.5px]!">EXP gained</small><b class="mt-1 block font-display text-base text-ok tabular-nums sm:text-xl">+{{ num(demoExp()) }}</b></div>
                    <div class="rounded-xl border border-line bg-surface-2/40 p-3 sm:p-4"><small class="eyebrow text-[10.5px]!">Matches</small><b class="mt-1 block font-display text-base tabular-nums sm:text-xl">{{ demoMatches() }}</b></div>
                    <div class="rounded-xl border border-line bg-surface-2/40 p-3 sm:p-4"><small class="eyebrow text-[10.5px]!">Level</small><b class="mt-1 block font-display text-base sm:text-xl">52</b></div>
                  </div>
                  <div class="rounded-xl border border-line bg-surface-2/40 px-4 py-1">
                    @for (d of demoAccounts; track d.name) {
                      <div class="flex items-center gap-3 border-b border-line py-3 text-[13px] last:border-b-0">
                        <span class="grid h-8 w-8 place-items-center rounded-[9px] text-xs font-bold text-white" [style.background]="d.bg">{{ d.name.slice(0, 2).toUpperCase() }}</span>
                        <span class="min-w-0 flex-1 font-bold">{{ d.name }}<small class="block font-mono text-[11px] font-medium text-fg-3">{{ d.id }}</small></span>
                        <div class="hidden w-40 sm:block"><div class="bar"><span [style.width.%]="d.pct"></span></div></div>
                        <span class="badge" [class]="d.badge"><span class="dot"></span>{{ d.status }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
            <p class="mt-3.5 text-xs text-fg-3">Dashboard preview with demo data</p>
          </div>
        </div>
      </section>

      <!-- features -->
      <section id="features" class="scroll-mt-28 px-4 pt-28 sm:pt-32">
        <div class="mx-auto max-w-[1140px]">
          <div class="reveal mx-auto mb-11 max-w-[640px] text-center">
            <span class="pill"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>Features</span>
            <h2 class="mt-4 mb-3 text-[clamp(30px,4vw,46px)] leading-[1.08] tracking-[-0.03em]">Everything you need.<br>Nothing you don't.</h2>
            <p class="text-[17px] text-fg-2">Add your account once. {{ site() }} handles login, matchmaking and re-queuing — you just watch the numbers go up.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <article class="tile reveal sm:col-span-2 lg:col-span-4">
              <span class="tile-ic"><i class="fa-solid fa-chart-line" aria-hidden="true"></i></span>
              <h3>Live EXP tracking</h3>
              <p>See your level, EXP gained and matches played update in real time from your personal dashboard.</p>
              <div class="mt-auto flex h-[130px] items-end gap-2 pt-5" aria-hidden="true">
                @for (h of chart; track $index) {
                  <span class="flex-1 origin-bottom rounded-t-md rounded-b-sm opacity-90" [style.height.%]="h"
                    style="background: linear-gradient(180deg, #ff3366, rgba(168,85,247,.45))"></span>
                }
              </div>
            </article>
            <article class="tile reveal lg:col-span-2">
              <span class="tile-ic"><i class="fa-solid fa-robot" aria-hidden="true"></i></span>
              <h3>Fully automatic</h3>
              <p>Matches start, finish and restart on their own.</p>
              <div class="grad-text mt-auto font-display text-[56px] leading-none font-bold tracking-tight">24/7</div>
            </article>
            <article class="tile reveal lg:col-span-2">
              <span class="tile-ic"><i class="fa-solid fa-lock" aria-hidden="true"></i></span>
              <h3>Private by default</h3>
              <p>Your accounts and stats are yours alone. No one else can see them.</p>
              <div class="mt-auto flex items-center gap-3 rounded-xl border border-ok/25 bg-ok/10 px-3.5 py-3 text-[13.5px] font-semibold text-ok">
                <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>Only visible to you</div>
            </article>
            <article class="tile reveal lg:col-span-2">
              <span class="tile-ic"><i class="fa-solid fa-layer-group" aria-hidden="true"></i></span>
              <h3>Multiple accounts</h3>
              <p>Level several accounts in parallel. Your plan sets the slots.</p>
              <div class="mt-auto flex gap-2 pt-3" aria-hidden="true">
                @for (on of [1, 1, 1, 0, 0]; track $index) {
                  <span class="grid h-9 w-9 place-items-center rounded-[10px] text-[13px]"
                    [class]="on ? 'border border-brand/40 bg-brand/15 text-accent' : 'border border-dashed border-line-2 text-fg-3'">
                    <i class="fa-solid" [class.fa-user]="on" [class.fa-plus]="!on"></i></span>
                }
              </div>
            </article>
            <article class="tile reveal lg:col-span-2">
              <span class="tile-ic"><i class="fa-solid fa-key" aria-hidden="true"></i></span>
              <h3>Instant activation</h3>
              <p>Redeem a license key and you're live in seconds.</p>
              <div class="mt-auto rounded-xl border border-line-2 bg-bg-2 px-3.5 py-3 font-mono text-[15px] font-bold tracking-[0.04em] text-accent">FFL-8K2M-Q7XP-4TNA</div>
            </article>
            <article class="tile reveal sm:col-span-2 lg:col-span-3">
              <span class="tile-ic"><i class="fa-solid fa-wallet" aria-hidden="true"></i></span>
              <h3>Local payments</h3>
              <p>Pay the way you already do. Renewals stack on top of the time you have left.</p>
              <div class="mt-auto flex flex-wrap gap-2">
                <span class="chip text-[#e2136e]">bKash</span><span class="chip text-[#f6921e]">Nagad</span><span class="chip text-[#8c3494] dark:text-[#b98cff]">Rocket</span>
              </div>
            </article>
            <article class="tile reveal sm:col-span-2 lg:col-span-3">
              <span class="tile-ic"><i class="fa-solid fa-mobile-screen" aria-hidden="true"></i></span>
              <h3>Persistent device profile</h3>
              <p>Every account keeps the same realistic device identity on every single login.</p>
              <div class="mt-auto flex flex-wrap gap-2"><span class="chip">Realme RMX3700</span><span class="chip">Android 14</span></div>
            </article>
          </div>
        </div>
      </section>

      <!-- how it works -->
      <section id="how" class="scroll-mt-28 px-4 pt-28 sm:pt-32">
        <div class="mx-auto max-w-[1140px]">
          <div class="reveal mx-auto mb-11 max-w-[640px] text-center">
            <span class="pill"><i class="fa-solid fa-route" aria-hidden="true"></i>How it works</span>
            <h2 class="mt-4 text-[clamp(30px,4vw,46px)] leading-[1.08] tracking-[-0.03em]">Up and running in minutes</h2>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            @for (s of steps; track s.n) {
              <article class="card reveal p-6 sm:p-7">
                <span class="font-mono text-[13px] font-bold text-fg-3">{{ s.n }}</span>
                <div class="my-4 grid h-12 w-12 place-items-center rounded-[13px] text-lg text-white shadow-[0_10px_30px_-12px_rgba(255,51,102,.7)]"
                  style="background: linear-gradient(135deg,#ff3366,#c026d3 55%,#8b5cf6)"><i class="fa-solid {{ s.icon }}" aria-hidden="true"></i></div>
                <h3 class="text-lg">{{ s.title }}</h3>
                <p class="mt-1.5 text-[14.5px] text-fg-2">{{ s.text }}</p>
              </article>
            }
          </div>
        </div>
      </section>

      <!-- pricing -->
      <section id="pricing" class="scroll-mt-28 px-4 pt-28 sm:pt-32">
        <div class="mx-auto max-w-[1140px]">
          <div class="reveal mx-auto mb-12 max-w-[640px] text-center">
            <span class="pill"><i class="fa-solid fa-crown" aria-hidden="true"></i>Pricing</span>
            <h2 class="mt-4 mb-3 text-[clamp(30px,4vw,46px)] leading-[1.08] tracking-[-0.03em]">Simple, honest pricing</h2>
            <p class="text-[17px] text-fg-2">Pay once for a fixed period. Renew anytime — extra time is added on top of what's left.</p>
          </div>
          <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            @if (!session.infoLoaded()) {
              @for (i of [1, 2, 3]; track i) { <div class="card h-[380px] p-6"><div class="skeleton h-full"></div></div> }
            } @else {
              @for (p of session.plans(); track p.id) {
                <app-price-card [plan]="p" [currency]="session.currency()">
                  <a class="btn btn-lg w-full" [class]="p.is_popular ? 'btn-primary' : 'btn-secondary'" [routerLink]="signup()">Get {{ p.name }}</a>
                </app-price-card>
              } @empty {
                <div class="card md:col-span-2 lg:col-span-3"><app-empty icon="fa-crown" title="Plans coming soon" text="Contact us for pricing." /></div>
              }
            }
          </div>
        </div>
      </section>

      <!-- faq -->
      <section id="faq" class="scroll-mt-28 px-4 pt-28 sm:pt-32">
        <div class="mx-auto grid max-w-[1140px] items-start gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:gap-12">
          <div class="reveal text-center lg:text-left">
            <span class="pill"><i class="fa-solid fa-circle-question" aria-hidden="true"></i>FAQ</span>
            <h2 class="mt-4 mb-3 text-[clamp(30px,4vw,46px)] leading-[1.08] tracking-[-0.03em]">Questions? Answered.</h2>
            <p class="text-[17px] text-fg-2">Can't find what you need?
              @if (contact().telegram || contact().whatsapp) {
                Message us on
                @if (contact().telegram) { <a class="font-bold text-fg underline-offset-4 hover:underline" target="_blank" rel="noopener" [href]="contact().telegram">Telegram</a> }
                @if (contact().telegram && contact().whatsapp) { or }
                @if (contact().whatsapp) { <a class="font-bold text-fg underline-offset-4 hover:underline" target="_blank" rel="noopener" [href]="contact().whatsapp">WhatsApp</a> }.
              } @else { Contact support after signing in. }
            </p>
          </div>
          <div class="grid gap-2.5">
            @for (q of faq; track q[0]) {
              <details class="faq reveal group rounded-2xl border border-line bg-surface transition-colors open:border-line-2">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15.5px] font-bold sm:px-6">
                  {{ q[0] }}<i class="fa-solid fa-plus flex-none text-fg-3 transition-transform duration-200 group-open:rotate-45 group-open:text-accent" aria-hidden="true"></i>
                </summary>
                <p class="px-5 pb-5 text-[14.5px] leading-relaxed text-fg-2 sm:px-6">{{ q[1] }}</p>
              </details>
            }
          </div>
        </div>
      </section>

      <!-- call to action -->
      <div class="px-4">
        <div class="reveal relative mx-auto mt-28 max-w-[1140px] overflow-hidden rounded-[28px] border border-line-2 bg-surface px-6 py-16 text-center sm:mt-32 sm:py-20">
          <div class="pointer-events-none absolute inset-x-[-10%] top-[-40%] h-[120%] blur-[30px]" aria-hidden="true"
            style="background: radial-gradient(closest-side, rgba(255,51,102,.28), transparent), radial-gradient(closest-side at 70% 50%, rgba(139,92,246,.24), transparent)"></div>
          <div class="relative">
            <h2 class="text-[clamp(30px,4.5vw,52px)] leading-[1.05] tracking-[-0.035em]">Stop grinding.<br><span class="grad-text">Start leveling.</span></h2>
            <p class="mx-auto mt-3.5 mb-8 max-w-[520px] text-[17px] text-fg-2">Create your account, add your Free Fire ID and let {{ site() }} do the rest.</p>
            <a class="btn btn-primary btn-lg" [routerLink]="signup()">Get started <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
          </div>
        </div>
      </div>
    </main>

    <footer class="mt-24 border-t border-line px-4">
      <div class="mx-auto max-w-[1140px]">
        <div class="grid grid-cols-2 gap-8 py-12 md:grid-cols-[1.6fr_1fr_1fr]">
          <div class="col-span-2 md:col-span-1">
            <a routerLink="/" class="rounded-lg"><app-brand [name]="site()" /></a>
            <p class="mt-3 max-w-[320px] text-sm text-fg-3">{{ session.settings().tagline || 'Free Fire auto level-up that runs 24/7 while you sleep.' }}</p>
          </div>
          <div>
            <h4 class="mb-3.5 font-sans text-[13px] font-bold">Product</h4>
            <ul class="grid gap-2.5 text-[14.5px] text-fg-3">
              <li><a class="hover:text-fg" href="#features" (click)="jump($event, 'features')">Features</a></li>
              <li><a class="hover:text-fg" href="#pricing" (click)="jump($event, 'pricing')">Pricing</a></li>
              <li><a class="hover:text-fg" href="#faq" (click)="jump($event, 'faq')">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 class="mb-3.5 font-sans text-[13px] font-bold">Account</h4>
            <ul class="grid gap-2.5 text-[14.5px] text-fg-3">
              <li><a class="hover:text-fg" routerLink="/login">Login</a></li>
              <li><a class="hover:text-fg" [routerLink]="signup()">Create account</a></li>
              @if (contact().telegram) { <li><a class="hover:text-fg" target="_blank" rel="noopener" [href]="contact().telegram"><i class="fa-brands fa-telegram" aria-hidden="true"></i> Telegram</a></li> }
              @if (contact().whatsapp) { <li><a class="hover:text-fg" target="_blank" rel="noopener" [href]="contact().whatsapp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a></li> }
            </ul>
          </div>
        </div>
        <div class="flex flex-wrap justify-between gap-3 border-t border-line pt-5 pb-8 text-[13px] text-fg-3">
          <span>© {{ year }} {{ site() }}. All rights reserved.</span><span>Not affiliated with Garena or Free Fire.</span>
        </div>
      </div>
    </footer>`,
  host: { class: 'relative block overflow-x-clip' },
})
export class Landing implements AfterViewInit {
  readonly session = inject(Session);
  private host = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);

  readonly site = computed(() => this.session.settings().site_name || 'FF Level');
  readonly signup = computed(() => (this.session.settings().allow_register === false ? '/login' : '/register'));
  readonly contact = computed(() => contactUrls(this.session.settings()));
  readonly offer = computed(() => {
    const plans = this.session.plans();
    if (!plans.length) return 'Cloud leveling, running 24/7';
    return `Plans from ${fmt.money(Math.min(...plans.map((p) => p.price)), this.session.currency())} — activate instantly`;
  });
  readonly year = new Date().getFullYear();
  readonly num = fmt.num;

  readonly links = [['features', 'Features'], ['how', 'How it works'], ['pricing', 'Pricing'], ['faq', 'FAQ']];
  readonly trust = ['No emulator needed', 'Private dashboard', 'Pay with bKash / Nagad'];
  readonly chart = [28, 36, 33, 48, 44, 60, 57, 72, 68, 84, 92, 100];
  readonly demoNav = [['fa-house', 'Dashboard'], ['fa-gamepad', 'Accounts'], ['fa-credit-card', 'Billing'], ['fa-user', 'Profile']];
  readonly demoAccounts = [
    { name: 'Player_X', id: 'ID 2081 ···· 3321', pct: 64, status: 'In match', badge: 'badge-accent', bg: 'linear-gradient(135deg,#ff3366,#a855f7)' },
    { name: 'Sniper_King', id: 'ID 1945 ···· 7780', pct: 38, status: 'Online', badge: 'badge-ok', bg: 'linear-gradient(135deg,#16a34a,#0891b2)' },
  ];
  readonly steps = [
    { n: '01', icon: 'fa-user-plus', title: 'Create your account', text: 'Sign up in seconds and pick the plan that fits how many accounts you want to level.' },
    { n: '02', icon: 'fa-wallet', title: 'Pay or redeem a key', text: 'Send money and submit the Transaction ID, or redeem a license key for instant access.' },
    { n: '03', icon: 'fa-gamepad', title: 'Add your game account', text: 'Enter a guest UID + password or an access token. The bot starts playing right away.' },
  ];
  readonly faq = [
    ['Do I need to keep my phone or PC on?', 'No. The bot runs on our server. Once you add your account it keeps playing until your plan ends — you can close everything.'],
    ['Can other users see my accounts?', 'No. Your accounts, levels and EXP are only visible inside your own dashboard. Nobody else can see them.'],
    ['What happens when my plan expires?', 'Your accounts pause automatically but stay saved. Renew or redeem a key and they resume on their own.'],
    ['Which accounts can I add?', 'Guest accounts (UID + password) or any account via its access token. Each account uses one slot of your plan.'],
    ['Is botting allowed by the game?', "No automation tool is officially allowed by the game's terms, so there's always some risk. We recommend using guest or secondary accounts you're comfortable leveling this way."],
    ['How fast is activation after payment?', 'Payments are verified manually, usually within a few hours. License keys activate instantly.'],
  ];

  // Preview animation — demo values only, never real user data.
  readonly demoExp = signal(48210);
  readonly demoMatches = signal(126);
  private demoSecs = 29 * 86400 + 23 * 3600 + 59 * 60;
  readonly demoTimer = signal(this.timer());

  constructor() {
    this.session.loadInfo();
    if (location.hash) history.replaceState(null, '', location.pathname);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = setInterval(() => {
        this.demoExp.update((v) => v + 90 + Math.floor(Math.random() * 180));
        if (Math.random() < 0.3) this.demoMatches.update((v) => v + 1);
        this.demoSecs -= 60;
        this.demoTimer.set(this.timer());
      }, 1600);
      this.destroyRef.onDestroy(() => clearInterval(id));
    }
  }

  ngAfterViewInit() {
    const root: HTMLElement = this.host.nativeElement;
    if (!('IntersectionObserver' in window)) {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.1 });
    const watch = () => root.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
    watch();
    // Price cards arrive after /api/public/info.
    const mo = new MutationObserver(watch);
    mo.observe(root, { childList: true, subtree: true });
    this.destroyRef.onDestroy(() => { io.disconnect(); mo.disconnect(); });
  }

  /** Section links scroll smoothly without putting # in the address bar. */
  jump(e: Event, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  private timer() {
    const s = this.demoSecs;
    return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  }
}
