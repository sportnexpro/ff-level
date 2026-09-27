import { AfterViewInit, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { contactUrls, fmt } from '../core/fmt';
import { Session } from '../core/session';
import { Brand, Empty, ThemeToggle } from '../ui/common';
import { Icon } from '../ui/icon';
import { PriceCard } from './panel/billing';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Brand, ThemeToggle, PriceCard, Empty, Icon],
  template: `
    <!-- backdrop -->
    <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1000px] overflow-hidden" aria-hidden="true">
      <div class="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_30%,transparent_75%)]"></div>
      <div class="absolute top-[-300px] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-ember/20 blur-[120px] dark:bg-ember/25"></div>
    </div>

    <header class="sticky top-0 z-50 border-b border-transparent transition-colors duration-300"
      [class]="scrolled() ? 'border-line! bg-bg/75 backdrop-blur-xl backdrop-saturate-150' : ''">
      <div class="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 sm:px-6">
        <a routerLink="/" class="mr-auto rounded-lg lg:mr-0"><app-brand [name]="site()" /></a>
        <nav class="mx-auto hidden gap-1 lg:flex" aria-label="Sections">
          @for (l of links; track l[0]) {
            <a [href]="'#' + l[0]" (click)="jump($event, l[0])" class="rounded-lg px-3 py-2 text-[14px] font-medium text-fg-3 transition hover:text-fg">{{ l[1] }}</a>
          }
        </nav>
        <div class="flex items-center gap-1.5">
          <app-theme-toggle />
          <a class="btn btn-ghost hidden sm:inline-flex" routerLink="/login">Sign in</a>
          <a class="btn btn-primary" [routerLink]="signup()">Get started</a>
        </div>
      </div>
    </header>

    <main>
      <!-- hero -->
      <section class="mx-auto grid max-w-[1200px] items-center gap-14 px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:pt-24">
        <div class="text-center lg:text-left">
          <a href="#pricing" (click)="jump($event, 'pricing')" class="pill hover:border-fg-3/40">
            <span class="st st-online"><i class="pulse"></i></span>{{ offer() }}<app-icon name="arrow-right" [size]="14" class="text-fg-3" />
          </a>
          <h1 class="mt-7 text-[clamp(40px,5vw,62px)] leading-[1.02] font-semibold tracking-[-0.045em]">
            Your Free Fire level,<br><span class="ember-text">climbing while you sleep.</span>
          </h1>
          <p class="mx-auto mt-6 max-w-[540px] text-[clamp(16px,1.6vw,18.5px)] leading-relaxed text-fg-3 lg:mx-0">
            {{ site() }} plays real matches for your account around the clock in the cloud. Add your ID once, then watch the EXP roll in from your own private dashboard.
          </p>
          <div class="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <a class="btn btn-brand btn-lg" [routerLink]="signup()">Start leveling <app-icon name="arrow-right" [size]="17" /></a>
            <a class="btn btn-secondary btn-lg" href="#pricing" (click)="jump($event, 'pricing')">See pricing</a>
          </div>
          <div class="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13.5px] text-fg-3 lg:justify-start">
            @for (t of trust; track t) { <span class="inline-flex items-center gap-2"><app-icon name="circle-check" [size]="16" class="text-ok" />{{ t }}</span> }
          </div>
        </div>

        <!-- product preview (demo values, animated) -->
        <div class="relative mx-auto w-full max-w-[520px]" aria-hidden="true">
          <div class="absolute inset-8 -z-10 rounded-full bg-ember/25 blur-[80px]"></div>
          <div class="card relative overflow-hidden rounded-[28px] p-6 shadow-[0_40px_100px_-40px_rgba(0,0,0,.45)]">
            <div class="flex items-center gap-3">
              <span class="grid h-11 w-11 place-items-center rounded-2xl text-sm font-semibold text-white" style="background: linear-gradient(145deg,#ff8a3d,#e0442a)">PX</span>
              <div class="min-w-0 flex-1 text-left">
                <div class="text-[15px] font-semibold">Player_X</div>
                <div class="font-mono text-xs text-fg-3">2081 ···· 3321 · BD</div>
              </div>
              <span class="st st-match"><i class="pulse"></i>In match</span>
            </div>
            <div class="mt-6 flex items-center gap-6">
              <div class="relative h-[118px] w-[118px] flex-none">
                <svg viewBox="0 0 80 80" class="h-full w-full -rotate-90">
                  <defs><linearGradient id="heroRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb224" /><stop offset=".55" stop-color="#ff6a1a" /><stop offset="1" stop-color="#ff3d2e" /></linearGradient></defs>
                  <circle cx="40" cy="40" r="34" fill="none" stroke-width="6" class="stroke-surface-3 dark:stroke-white/[0.07]" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke-width="6" stroke-linecap="round" stroke="url(#heroRing)" [attr.stroke-dasharray]="ringDash()" style="transition: stroke-dasharray 1s" />
                </svg>
                <div class="absolute inset-0 grid place-content-center text-center leading-none">
                  <b class="num text-[34px] font-semibold tracking-[-0.04em]">{{ demoLevel() }}</b><small class="mt-1 text-[11px] text-fg-3">level</small>
                </div>
              </div>
              <div class="min-w-0 flex-1 text-left">
                <div class="eyebrow">EXP gained today</div>
                <div class="num mt-1 text-[30px] leading-none font-semibold tracking-[-0.04em] text-ok">+{{ num(demoExp()) }}</div>
                <div class="mt-4 flex justify-between text-[12px] text-fg-3"><span>to level {{ demoLevel() + 1 }}</span><span class="num">{{ demoPct() }}%</span></div>
                <div class="bar mt-1.5"><span [style.width.%]="demoPct()"></span></div>
              </div>
            </div>
            <div class="mt-6 grid grid-cols-3 rounded-2xl border border-line text-left">
              <div class="px-4 py-3"><div class="text-[11.5px] text-fg-3">Per hour</div><div class="num mt-0.5 font-semibold">+14.2K</div></div>
              <div class="border-l border-line px-4 py-3"><div class="text-[11.5px] text-fg-3">Matches</div><div class="num mt-0.5 font-semibold">{{ demoMatches() }}</div></div>
              <div class="border-l border-line px-4 py-3"><div class="text-[11.5px] text-fg-3">Next level</div><div class="num mt-0.5 font-semibold">~1h 20m</div></div>
            </div>
          </div>
          <div class="float card absolute -top-5 -right-2 hidden items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-xl sm:flex" style="animation-delay:-2s">
            <span class="grid h-7 w-7 place-items-center rounded-full bg-ok/15 text-ok"><app-icon name="trend" [size]="15" /></span>
            <div class="text-left leading-tight"><div class="num text-sm font-semibold">+1,240 EXP</div><div class="text-[11px] text-fg-3">Match #{{ demoMatches() }} finished</div></div>
          </div>
          <div class="float card absolute -bottom-6 -left-3 hidden items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-xl sm:flex">
            <span class="grid h-7 w-7 place-items-center rounded-full bg-ember/15 text-accent"><app-icon name="live" [size]="15" /></span>
            <div class="text-left leading-tight"><div class="text-sm font-semibold">3 live matches</div><div class="text-[11px] text-fg-3">Running 24/7 in the cloud</div></div>
          </div>
          <p class="mt-10 text-center text-xs text-fg-3">Preview with demo data</p>
        </div>
      </section>

      <!-- facts -->
      <section class="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div class="reveal grid grid-cols-2 overflow-hidden rounded-3xl border border-line bg-surface md:grid-cols-4" style="box-shadow: var(--shadow-card)">
          @for (f of facts; track f[0]; let i = $index) {
            <div class="border-line p-6 sm:p-7" [class]="(i % 2 ? 'border-l ' : '') + (i > 1 ? 'border-t md:border-t-0 ' : '') + (i === 2 ? 'md:border-l' : '')">
              <div class="text-[30px] leading-none font-semibold tracking-[-0.04em] sm:text-[36px]">{{ f[0] }}</div>
              <div class="mt-2 text-[13.5px] text-fg-3">{{ f[1] }}</div>
            </div>
          }
        </div>
      </section>

      <!-- features -->
      <section id="features" class="mx-auto max-w-[1200px] scroll-mt-20 px-4 pt-28 sm:px-6 sm:pt-36">
        <div class="reveal max-w-[640px]">
          <span class="eyebrow text-accent!">Features</span>
          <h2 class="mt-3 text-[clamp(32px,4.4vw,52px)] leading-[1.02] tracking-[-0.04em]">Everything handled.<br><span class="text-fg-3">You just watch it climb.</span></h2>
        </div>
        <div class="mt-12 grid gap-4 md:grid-cols-6">
          <article class="tile reveal md:col-span-4">
            <span class="tile-ic"><app-icon name="chart" [size]="19" /></span>
            <h3>Live EXP tracking</h3>
            <p>Level, EXP gained, matches and time to the next level — updating live in your private dashboard.</p>
            <div class="mt-6 flex h-[140px] items-end gap-2" aria-hidden="true">
              @for (h of chart; track $index) {
                <span class="flex-1 rounded-t-lg rounded-b-sm" [style.height.%]="h" [style.opacity]="0.35 + h / 160"
                  style="background: linear-gradient(180deg, #ff8a3d, rgba(255,106,26,.15))"></span>
              }
            </div>
          </article>
          <article class="tile reveal md:col-span-2">
            <span class="tile-ic"><app-icon name="bot" [size]="19" /></span>
            <h3>Fully automatic</h3>
            <p>Matchmaking, playing and re-queuing — all on its own.</p>
            <div class="ember-text mt-auto pt-6 text-[64px] leading-none font-semibold tracking-[-0.05em]">24/7</div>
          </article>
          <article class="tile reveal md:col-span-2">
            <span class="tile-ic"><app-icon name="shield-check" [size]="19" /></span>
            <h3>Private by default</h3>
            <p>Your accounts and stats are visible only to you.</p>
            <div class="mt-auto flex items-center gap-2 pt-6 text-[13.5px] font-medium text-ok"><app-icon name="lock" [size]="16" />Only visible to you</div>
          </article>
          <article class="tile reveal md:col-span-2">
            <span class="tile-ic"><app-icon name="layers" [size]="19" /></span>
            <h3>Many accounts at once</h3>
            <p>Level several IDs in parallel. Your plan sets the slots.</p>
            <div class="mt-auto flex gap-2 pt-6" aria-hidden="true">
              @for (on of [1, 1, 1, 0, 0]; track $index) {
                <span class="grid h-10 w-10 place-items-center rounded-xl" [class]="on ? 'bg-ember/12 text-accent ring-1 ring-ember/30' : 'border border-dashed border-line-2 text-fg-3'">
                  <app-icon [name]="on ? 'user' : 'plus'" [size]="16" /></span>
              }
            </div>
          </article>
          <article class="tile reveal md:col-span-2">
            <span class="tile-ic"><app-icon name="key-round" [size]="19" /></span>
            <h3>Instant activation</h3>
            <p>Redeem a license key and you're live in seconds.</p>
            <div class="mt-auto pt-6"><code class="block rounded-xl border border-line-2 bg-bg-2 px-3.5 py-3 font-mono text-[14px] font-medium tracking-[0.04em]">FFL-8K2M-Q7XP-4TNA</code></div>
          </article>
          <article class="tile reveal md:col-span-3">
            <span class="tile-ic"><app-icon name="wallet" [size]="19" /></span>
            <h3>Pay the local way</h3>
            <p>bKash, Nagad or Rocket. Renewals stack on top of the time you have left.</p>
            <div class="mt-auto flex flex-wrap gap-2 pt-6"><span class="chip text-[#e2136e]">bKash</span><span class="chip text-[#f6921e]">Nagad</span><span class="chip text-[#8c3494] dark:text-[#c18cff]">Rocket</span></div>
          </article>
          <article class="tile reveal md:col-span-3">
            <span class="tile-ic"><app-icon name="phone" [size]="19" /></span>
            <h3>Same device, every login</h3>
            <p>Each account keeps one realistic device identity on every sign-in.</p>
            <div class="mt-auto flex flex-wrap gap-2 pt-6"><span class="chip"><app-icon name="phone" [size]="14" />Realme RMX3700</span><span class="chip">Android 14</span></div>
          </article>
        </div>
      </section>

      <!-- how it works -->
      <section id="how" class="mx-auto max-w-[1200px] scroll-mt-20 px-4 pt-28 sm:px-6 sm:pt-36">
        <div class="reveal max-w-[640px]">
          <span class="eyebrow text-accent!">How it works</span>
          <h2 class="mt-3 text-[clamp(32px,4.4vw,52px)] leading-[1.02] tracking-[-0.04em]">Up and running<br><span class="text-fg-3">in three steps.</span></h2>
        </div>
        <ol class="relative mt-12 grid gap-4 md:grid-cols-3">
          <span class="absolute top-[52px] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-line-2 to-transparent md:block" aria-hidden="true"></span>
          @for (s of steps; track s.n) {
            <li class="reveal relative rounded-3xl border border-line bg-surface p-7" style="box-shadow: var(--shadow-card)">
              <div class="flex items-center justify-between">
                <span class="grid h-12 w-12 place-items-center rounded-2xl bg-fg text-bg"><app-icon [name]="s.icon" [size]="20" /></span>
                <span class="font-mono text-[13px] text-fg-3">{{ s.n }}</span>
              </div>
              <h3 class="mt-6 text-[17px]">{{ s.title }}</h3>
              <p class="mt-1.5 text-[14.5px] leading-relaxed text-fg-3">{{ s.text }}</p>
            </li>
          }
        </ol>
      </section>

      <!-- pricing -->
      <section id="pricing" class="mx-auto max-w-[1200px] scroll-mt-20 px-4 pt-28 sm:px-6 sm:pt-36">
        <div class="reveal mx-auto max-w-[640px] text-center">
          <span class="eyebrow text-accent!">Pricing</span>
          <h2 class="mt-3 text-[clamp(32px,4.4vw,52px)] leading-[1.02] tracking-[-0.04em]">Simple, honest pricing</h2>
          <p class="mt-4 text-[16.5px] text-fg-3">Pay once for a fixed period. Renew anytime — extra time is added on top of what's left.</p>
        </div>
        <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          @if (!session.infoLoaded()) {
            @for (i of [1, 2, 3]; track i) { <div class="card h-[420px] rounded-3xl p-6"><div class="skeleton h-full"></div></div> }
          } @else {
            @for (p of session.plans(); track p.id) {
              <app-price-card [plan]="p" [currency]="session.currency()">
                <a class="btn btn-lg w-full" [class]="p.is_popular ? 'btn-brand' : 'btn-secondary'" [routerLink]="signup()">Get {{ p.name }}</a>
              </app-price-card>
            } @empty {
              <div class="card md:col-span-2 lg:col-span-3"><app-empty icon="crown" title="Plans coming soon" text="Contact us for pricing." /></div>
            }
          }
        </div>
      </section>

      <!-- faq -->
      <section id="faq" class="mx-auto grid max-w-[1200px] scroll-mt-20 items-start gap-10 px-4 pt-28 sm:px-6 sm:pt-36 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div class="reveal">
          <span class="eyebrow text-accent!">FAQ</span>
          <h2 class="mt-3 text-[clamp(32px,4.4vw,52px)] leading-[1.02] tracking-[-0.04em]">Questions,<br><span class="text-fg-3">answered.</span></h2>
          <p class="mt-5 text-[15.5px] text-fg-3">Can't find what you need?
            @if (contact().telegram || contact().whatsapp) {
              Message us on
              @if (contact().telegram) { <a class="font-medium text-fg underline decoration-line-2 underline-offset-4 hover:decoration-fg" target="_blank" rel="noopener" [href]="contact().telegram">Telegram</a> }
              @if (contact().telegram && contact().whatsapp) { or }
              @if (contact().whatsapp) { <a class="font-medium text-fg underline decoration-line-2 underline-offset-4 hover:decoration-fg" target="_blank" rel="noopener" [href]="contact().whatsapp">WhatsApp</a> }.
            } @else { Contact support after signing in. }
          </p>
        </div>
        <div class="divide-y divide-line border-y border-line">
          @for (q of faq; track q[0]) {
            <details class="faq reveal group">
              <summary class="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium">
                {{ q[0] }}
                <span class="grid h-7 w-7 flex-none place-items-center rounded-full border border-line-2 text-fg-3 transition duration-300 group-open:rotate-45 group-open:border-ember/40 group-open:text-accent"><app-icon name="plus" [size]="15" /></span>
              </summary>
              <p class="max-w-[600px] pb-5 text-[15px] leading-relaxed text-fg-3">{{ q[1] }}</p>
            </details>
          }
        </div>
      </section>

      <!-- call to action -->
      <section class="mx-auto max-w-[1200px] px-4 pt-28 sm:px-6 sm:pt-36">
        <div class="reveal relative overflow-hidden rounded-[32px] bg-[#0b0b0d] px-6 py-16 text-center text-white sm:py-24 dark:border dark:border-line-2">
          <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <div class="absolute -bottom-40 left-1/2 h-80 w-[700px] -translate-x-1/2 rounded-full bg-ember/40 blur-[100px]"></div>
            <div class="absolute inset-0 opacity-40 [background-size:48px_48px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_100%,#000,transparent)]"
              style="background-image: linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)"></div>
          </div>
          <div class="relative">
            <h2 class="text-[clamp(34px,5vw,60px)] leading-[1] tracking-[-0.045em]">Stop grinding.<br><span class="ember-text">Start leveling.</span></h2>
            <p class="mx-auto mt-5 max-w-[480px] text-[16.5px] text-white/60">Create your account, add your Free Fire ID and let {{ site() }} do the rest.</p>
            <a class="btn btn-brand btn-lg mt-9" [routerLink]="signup()">Get started <app-icon name="arrow-right" [size]="17" /></a>
          </div>
        </div>
      </section>
    </main>

    <footer class="mx-auto mt-24 max-w-[1200px] px-4 sm:px-6">
      <div class="grid grid-cols-2 gap-8 border-t border-line py-12 md:grid-cols-[1.6fr_1fr_1fr]">
        <div class="col-span-2 md:col-span-1">
          <a routerLink="/" class="rounded-lg"><app-brand [name]="site()" /></a>
          <p class="mt-4 max-w-[320px] text-sm text-fg-3">{{ session.settings().tagline || 'Free Fire auto level-up that runs 24/7 while you sleep.' }}</p>
        </div>
        <div>
          <h4 class="mb-4 text-[13px] font-semibold">Product</h4>
          <ul class="grid gap-3 text-[14px] text-fg-3">
            <li><a class="hover:text-fg" href="#features" (click)="jump($event, 'features')">Features</a></li>
            <li><a class="hover:text-fg" href="#pricing" (click)="jump($event, 'pricing')">Pricing</a></li>
            <li><a class="hover:text-fg" href="#faq" (click)="jump($event, 'faq')">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4 class="mb-4 text-[13px] font-semibold">Account</h4>
          <ul class="grid gap-3 text-[14px] text-fg-3">
            <li><a class="hover:text-fg" routerLink="/login">Sign in</a></li>
            <li><a class="hover:text-fg" [routerLink]="signup()">Create account</a></li>
            @if (contact().telegram) { <li><a class="inline-flex items-center gap-1.5 hover:text-fg" target="_blank" rel="noopener" [href]="contact().telegram"><app-icon name="telegram" [size]="14" />Telegram</a></li> }
            @if (contact().whatsapp) { <li><a class="inline-flex items-center gap-1.5 hover:text-fg" target="_blank" rel="noopener" [href]="contact().whatsapp"><app-icon name="whatsapp" [size]="14" />WhatsApp</a></li> }
          </ul>
        </div>
      </div>
      <div class="flex flex-wrap justify-between gap-3 border-t border-line py-6 text-[13px] text-fg-3">
        <span>© {{ year }} {{ site() }}</span><span>Not affiliated with Garena or Free Fire.</span>
      </div>
    </footer>`,
  host: { class: 'relative block overflow-x-clip', '(window:scroll)': 'onScroll()' },
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
    return `Plans from ${fmt.money(Math.min(...plans.map((p) => p.price)), this.session.currency())} · instant activation`;
  });
  readonly year = new Date().getFullYear();
  readonly num = fmt.num;
  readonly scrolled = signal(false);

  readonly links = [['features', 'Features'], ['how', 'How it works'], ['pricing', 'Pricing'], ['faq', 'FAQ']];
  readonly trust = ['No emulator needed', 'Private dashboard', 'bKash · Nagad'];
  readonly facts = [['24/7', 'Plays around the clock'], ['0', 'Emulators or PCs needed'], ['1 min', 'To add a new account'], ['100%', 'Private — only you see your stats']];
  readonly chart = [22, 30, 28, 40, 38, 52, 49, 63, 60, 74, 83, 100];
  readonly steps = [
    { n: '01', icon: 'user-plus', title: 'Create your account', text: 'Sign up in seconds and pick the plan that fits how many IDs you want to level.' },
    { n: '02', icon: 'wallet', title: 'Pay or redeem a key', text: 'Send the payment and submit the Transaction ID, or redeem a license key instantly.' },
    { n: '03', icon: 'gamepad', title: 'Add your game ID', text: 'Enter a guest UID + password or an access token. The bot starts playing right away.' },
  ];
  readonly faq = [
    ['Do I need to keep my phone or PC on?', 'No. The bot runs on our server. Once you add your account it keeps playing until your plan ends — you can close everything.'],
    ['Can other users see my accounts?', 'No. Your accounts, levels and EXP are only visible inside your own dashboard.'],
    ['What happens when my plan expires?', 'Your accounts pause automatically but stay saved. Renew or redeem a key and they resume on their own.'],
    ['Which accounts can I add?', 'Guest accounts (UID + password) or any account via its access token. Each account uses one slot of your plan.'],
    ['Is botting allowed by the game?', "No automation tool is officially allowed by the game's terms, so there's always some risk. We recommend guest or secondary accounts you're comfortable leveling this way."],
    ['How fast is activation after payment?', 'Payments are checked by hand, usually within a few hours. License keys activate instantly.'],
  ];

  // Hero preview animation — demo values only, never real user data.
  readonly demoExp = signal(48210);
  readonly demoMatches = signal(126);
  readonly demoLevel = signal(52);
  readonly demoPct = signal(64);
  readonly ringDash = computed(() => {
    const c = 2 * Math.PI * 34;
    return `${((c * this.demoPct()) / 100).toFixed(1)} ${c.toFixed(1)}`;
  });

  constructor() {
    this.session.loadInfo();
    if (location.hash) history.replaceState(null, '', location.pathname);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = setInterval(() => {
        this.demoExp.update((v) => v + 120 + Math.floor(Math.random() * 260));
        if (Math.random() < 0.35) this.demoMatches.update((v) => v + 1);
        this.demoPct.update((v) => {
          const next = v + 1 + Math.floor(Math.random() * 3);
          if (next >= 100) { this.demoLevel.update((l) => l + 1); return 4; }
          return next;
        });
      }, 1600);
      this.destroyRef.onDestroy(() => clearInterval(id));
    }
  }

  onScroll() {
    const s = window.scrollY > 8;
    if (s !== this.scrolled()) this.scrolled.set(s);
  }

  ngAfterViewInit() {
    const root: HTMLElement = this.host.nativeElement;
    if (!('IntersectionObserver' in window)) {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.08 });
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
}
