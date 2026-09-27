import { Component, ElementRef, effect, inject, input } from '@angular/core';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Ban, Bot, Calendar, ChartLine, Check, ChevronDown,
  ChevronRight, CircleAlert, CircleCheck, CircleHelp, Clock, Cloud, Copy, CreditCard, Crosshair, Crown, Dices, Eye,
  EyeOff, ExternalLink, Fingerprint, Flame, Gamepad2, Gauge, Headset, Hourglass, House, IconNode, IdCard, Inbox, Info,
  Key, KeyRound, Layers, LayoutDashboard, Lock, LogOut, Megaphone, Menu, MessageCircle, Monitor, Moon, Palette, Pencil,
  Plus, RadioTower, Receipt, RefreshCw, Rocket, Route, Save, Search, Send, Server, Settings, Shield, ShieldCheck,
  SlidersHorizontal, Smartphone, Sparkles, Sun, Swords, Terminal, Timer, Trash2, TrendingUp, TriangleAlert, Trophy,
  User, UserPlus, Users, Wallet, WandSparkles, X, Zap,
} from 'lucide';

/** Lucide line icons used by the site, by short name. Only these are bundled. */
export const ICONS = {
  activity: Activity, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'arrow-up-right': ArrowUpRight,
  verified: BadgeCheck, ban: Ban, bot: Bot, calendar: Calendar, chart: ChartLine, check: Check, 'chevron-down': ChevronDown,
  'chevron-right': ChevronRight, alert: CircleAlert, 'circle-check': CircleCheck, help: CircleHelp, clock: Clock,
  cloud: Cloud, copy: Copy, card: CreditCard, crosshair: Crosshair, crown: Crown, dice: Dices, eye: Eye, 'eye-off': EyeOff,
  external: ExternalLink, fingerprint: Fingerprint, flame: Flame, gamepad: Gamepad2, gauge: Gauge, headset: Headset,
  hourglass: Hourglass, home: House, id: IdCard, inbox: Inbox, info: Info, key: Key, 'key-round': KeyRound, layers: Layers,
  dashboard: LayoutDashboard, lock: Lock, logout: LogOut, megaphone: Megaphone, menu: Menu, whatsapp: MessageCircle,
  monitor: Monitor, moon: Moon, palette: Palette, pencil: Pencil, plus: Plus, live: RadioTower, receipt: Receipt,
  refresh: RefreshCw, rocket: Rocket, route: Route, save: Save, search: Search, telegram: Send, server: Server,
  settings: Settings, shield: Shield, 'shield-check': ShieldCheck, sliders: SlidersHorizontal, phone: Smartphone,
  sparkles: Sparkles, sun: Sun, swords: Swords, terminal: Terminal, timer: Timer, trash: Trash2, trend: TrendingUp,
  warning: TriangleAlert, trophy: Trophy, user: User, 'user-plus': UserPlus, users: Users, wallet: Wallet,
  wand: WandSparkles, x: X, zap: Zap,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

const NS = 'http://www.w3.org/2000/svg';

/** <app-icon name="home" [size]="18" /> — inline SVG, inherits the text colour. */
@Component({
  selector: 'app-icon',
  template: '',
  host: { 'aria-hidden': 'true', class: 'inline-flex flex-none items-center justify-center' },
})
export class Icon {
  readonly name = input.required<IconName | string>();
  readonly size = input(18);
  readonly stroke = input(1.9);
  private host = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      const node: IconNode | undefined = (ICONS as Record<string, IconNode>)[this.name()];
      const el: HTMLElement = this.host.nativeElement;
      el.replaceChildren();
      if (!node) return;
      const svg = document.createElementNS(NS, 'svg');
      const attrs: Record<string, string> = {
        xmlns: NS, viewBox: '0 0 24 24', width: String(this.size()), height: String(this.size()), fill: 'none',
        stroke: 'currentColor', 'stroke-width': String(this.stroke()), 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      };
      for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
      for (const [tag, a] of node) {
        const child = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(a)) child.setAttribute(k, String(v));
        svg.appendChild(child);
      }
      el.appendChild(svg);
    });
  }
}
