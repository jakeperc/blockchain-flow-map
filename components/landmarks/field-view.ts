/**
 * The Landmarks field, live: a Canvas 2D glow layer (halos, beams, cores) under an SVG overlay (grid, axes, labels,
 * pointer targets) rendered by the same lib/landmarks/field.ts the build uses for the static page. Imperative on
 * purpose, like the map's renderer: React owns the controls, this owns the pixels.
 *
 * Motion follows the map's rules (components/map/engine.ts): a still scene draws nothing, a hidden tab draws nothing,
 * and prefers-reduced-motion removes ignition, breathing and tweens. Lights ignite in date order on arrival; switching
 * THEN to TODAY or the time window glides every light to its new place (easeInOutCubic, as the map's morph).
 */
import {GROUP_COLORS, SURFACE, makeFrame, placeLights, renderSvg, nearest, type Frame, type Light, type Size} from '@/lib/landmarks/field';
import type {Group, LandmarkPoint, Milestone, Mode, View} from '@/lib/landmarks/types';
import {Tween, easeInOutCubic, clamp01, lerp} from '@/lib/atlas/tween';
import {usd, dateUTC} from '@/lib/landmarks/format';

export interface FieldState {
  view: View;
  mode: Mode;
  prices: Record<string, number> | null;
  /** Point keys that pass the filters. */
  visible: Set<string>;
  /** Entry id of the story being read. */
  active: string | null;
  paused: boolean;
}
export interface FieldOptions {
  points: LandmarkPoint[];
  milestones: Milestone[];
  domain: {decMin: number; decMax: number};
  windows: {allTime: {start: number; end: number}; recent: {start: number; end: number}};
  titleOf: (entry: string) => string;
  /** `viaLink` is true when the browser is already following the light's own #entry link (no extra scroll needed). */
  onSelect: (entry: string, viaLink: boolean) => void;
}

interface Track {
  from: Light;
  to: Light;
  cur: Light;
  vis: number;
  visFrom: number;
  visTo: number;
  delay: number;
}

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** A light whose coins an earlier light of the same story already moved (a forward, a return) says so. */
const onward = (p: LandmarkPoint) => (p.counted ? '' : ', the same coins moving on');
const GLIDE_MS = 1200;
const IGNITE_MS = 2400;

function sprite(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `${color}8c`);
  grad.addColorStop(0.38, `${color}29`);
  grad.addColorStop(1, `${color}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export class FieldView {
  private readonly host: HTMLElement;
  private readonly o: FieldOptions;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly overlay: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private readonly live: HTMLDivElement;
  private readonly sprites: Record<Group, HTMLCanvasElement>;
  private readonly tracks = new Map<string, Track>();
  private readonly byKey: Map<string, LandmarkPoint>;
  private readonly progress = new Tween(1, easeInOutCubic);
  private readonly resize: ResizeObserver;
  private state: FieldState;
  private size: Size = {width: 0, height: 0, compact: false};
  private frame: Frame | null = null;
  private dpr = 1;
  private raf = 0;
  private igniteAt = 0;
  private hover: string | null = null;
  private focusKey: string | null = null;

  constructor(host: HTMLElement, options: FieldOptions, initial: FieldState) {
    this.host = host;
    this.o = options;
    this.state = initial;
    this.byKey = new Map(options.points.map((p) => [p.key, p]));
    this.sprites = {milestone: sprite(GROUP_COLORS.milestone), theft: sprite(GROUP_COLORS.theft), seizure: sprite(GROUP_COLORS.seizure)};
    // The static SVG stays in the HTML for readers without JavaScript; the live layers replace it below.
    host.classList.add('is-live');
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    this.overlay = document.createElement('div');
    this.overlay.className = 'lm-overlay';
    this.tip = document.createElement('div');
    this.tip.className = 'lm-tooltip';
    this.tip.hidden = true;
    this.live = document.createElement('div');
    this.live.className = 'lm-sr';
    this.live.setAttribute('aria-live', 'polite');
    // replaceChildren, not append: this repo also loads @cloudflare/workers-types, whose Element.append is HTMLRewriter's.
    host.replaceChildren(this.canvas, this.overlay, this.tip, this.live);
    host.tabIndex = 0;
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Landmark transactions by date and value. Use the arrow keys to step through them and Enter to read the story.');
    host.addEventListener('pointermove', this.onPointer);
    host.addEventListener('pointerleave', this.onLeave);
    host.addEventListener('click', this.onClick);
    host.addEventListener('keydown', this.onKey);
    host.addEventListener('blur', this.onLeave);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(host);
    this.igniteAt = REDUCED ? -1 : performance.now();
    this.measure();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.host.removeEventListener('pointermove', this.onPointer);
    this.host.removeEventListener('pointerleave', this.onLeave);
    this.host.removeEventListener('click', this.onClick);
    this.host.removeEventListener('keydown', this.onKey);
    this.host.removeEventListener('blur', this.onLeave);
  }

  setState(next: Partial<FieldState>) {
    const prev = this.state;
    this.state = {...prev, ...next};
    const moved = prev.view !== this.state.view || prev.mode !== this.state.mode || prev.prices !== this.state.prices || prev.visible !== this.state.visible;
    if (moved) this.layout(true);
    else this.request();
  }

  /* ------------------------------------------------------------ layout */

  private window() {
    return this.state.view === 'recent' ? this.o.windows.recent : this.o.windows.allTime;
  }

  private measure() {
    const width = Math.round(this.host.clientWidth);
    if (!width) return;
    const compact = width < 560;
    const height = Math.round(compact ? Math.min(330, Math.max(260, width * 0.86)) : Math.max(360, Math.min(width * 0.6, innerHeight - 250)));
    if (width === this.size.width && height === this.size.height) return;
    this.size = {width, height, compact};
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.overlay.style.height = `${height}px`;
    this.layout(false);
  }

  private layout(animate: boolean) {
    if (!this.size.width) return;
    const w = this.window();
    this.frame = makeFrame(this.size, w.start, w.end, this.o.domain.decMin, this.o.domain.decMax);
    const targets = placeLights(this.o.points, this.frame, this.state.mode, this.state.prices);
    const now = performance.now();
    const order = [...this.o.points].sort((a, b) => a.t - b.t).map((p) => p.key);
    for (const t of targets) {
      const p = this.byKey.get(t.key);
      const inWindow = !!p && p.t >= w.start && p.t <= w.end;
      const visTo = inWindow && this.state.visible.has(t.key) ? 1 : 0;
      const existing = this.tracks.get(t.key);
      if (!existing) {
        const delay = (order.indexOf(t.key) / Math.max(1, order.length - 1)) * (IGNITE_MS - 600);
        this.tracks.set(t.key, {from: t, to: t, cur: {...t}, vis: visTo, visFrom: visTo, visTo, delay});
      } else {
        existing.from = {...existing.cur};
        existing.to = t;
        existing.visFrom = existing.vis;
        existing.visTo = visTo;
        if (!animate || REDUCED) {
          existing.cur = {...t};
          existing.vis = visTo;
        }
      }
    }
    if (animate && !REDUCED) {
      this.progress.jump(0);
      this.progress.retarget(1, GLIDE_MS, now);
      this.host.classList.add('is-moving');
    } else this.progress.jump(1);
    this.renderOverlay();
    this.request();
  }

  private renderOverlay() {
    if (!this.frame) return;
    const w = this.window();
    const visible = this.o.points.filter((p) => this.state.visible.has(p.key));
    this.overlay.innerHTML = renderSvg(visible, {
      size: this.size,
      mode: this.state.mode,
      t0: w.start,
      t1: w.end,
      decMin: this.o.domain.decMin,
      decMax: this.o.domain.decMax,
      milestones: this.o.milestones,
      prices: this.state.prices,
      idPrefix: 'lmf',
      title: 'Landmark transactions by date and value',
      desc: 'Each light is one transaction. The stories below list every value.',
      layers: 'overlay',
      labelMax: this.size.compact ? 4 : 10,
      describe: (p, value) => `${this.o.titleOf(p.entry)}, ${dateUTC(p.t)}, ${value === null ? 'no price' : usd(value)}${onward(p)}`,
      shelfLabel: this.state.mode === 'then' ? 'No market price' : 'No price today',
    });
  }

  /* ------------------------------------------------------------ drawing */

  private request() {
    if (!this.raf && !document.hidden) this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    this.raf = 0;
    const keepGoing = this.draw(now);
    if (keepGoing) this.request();
  };

  /** Draws one frame; returns whether anything is still moving. */
  private draw(now: number): boolean {
    const g = this.ctx;
    const f = this.frame;
    if (!g || !f) return false;
    const k = this.progress.update(now);
    const gliding = this.progress.active;
    if (!gliding && this.host.classList.contains('is-moving')) {
      this.host.classList.remove('is-moving');
      this.renderOverlay();
    }
    let igniting = false;
    for (const tr of this.tracks.values()) {
      tr.cur = {...tr.to, x: lerp(tr.from.x, tr.to.x, k), y: lerp(tr.from.y, tr.to.y, k), halo: lerp(tr.from.halo, tr.to.halo, k)};
      tr.vis = lerp(tr.visFrom, tr.visTo, k);
    }
    const ignite = (tr: Track) => {
      if (this.igniteAt < 0) return 1;
      const a = clamp01((now - this.igniteAt - tr.delay) / 600);
      if (a < 1) igniting = true;
      return a;
    };
    const breathing = !REDUCED && !this.state.paused && !!this.state.active;
    const pulse = breathing ? 1 + 0.07 * Math.sin(now / 650) : 1;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.size.width, this.size.height);
    const items = [...this.tracks.values()].map((tr) => ({tr, a: tr.vis * ignite(tr)})).filter((x) => x.a > 0.01);
    // Legs of one event: a hairline in time order.
    const byEntry = new Map<string, Light[]>();
    for (const {tr} of items) byEntry.set(tr.cur.entry, [...(byEntry.get(tr.cur.entry) ?? []), tr.cur]);
    g.lineWidth = 1;
    for (const ls of byEntry.values()) {
      if (ls.length < 2) continue;
      const s = [...ls].sort((a, b) => a.x - b.x);
      g.strokeStyle = `${GROUP_COLORS[s[0].group]}59`;
      g.beginPath();
      s.forEach((l, i) => (i ? g.lineTo(l.x, l.y) : g.moveTo(l.x, l.y)));
      g.stroke();
    }
    for (const {tr, a} of items) {
      const l = tr.cur;
      if (l.shelf) continue;
      g.globalAlpha = 0.24 * a;
      g.strokeStyle = GROUP_COLORS[l.group];
      g.beginPath();
      g.moveTo(l.x, l.y + l.core);
      g.lineTo(l.x, f.plotBottom);
      g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    for (const {tr, a} of [...items].sort((x, y) => y.tr.cur.halo - x.tr.cur.halo)) {
      const l = tr.cur;
      const lit = this.state.active === l.entry ? 1.5 * pulse : this.hover === l.key || this.focusKey === l.key ? 1.3 : 1;
      const r = l.halo * (this.state.active === l.entry ? pulse : 1) * (0.6 + 0.4 * a);
      g.globalAlpha = Math.min(1, 0.95 * a * lit);
      g.drawImage(this.sprites[l.group], l.x - r, l.y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
    for (const {tr, a} of items) {
      const l = tr.cur;
      g.globalAlpha = a;
      g.beginPath();
      g.arc(l.x, l.y, l.core + (l.measured ? 0 : 1), 0, Math.PI * 2);
      if (l.measured) {
        g.fillStyle = SURFACE;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = GROUP_COLORS[l.group];
        g.stroke();
      } else {
        g.fillStyle = GROUP_COLORS[l.group];
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = SURFACE;
        g.stroke();
      }
      if (this.hover === l.key || this.focusKey === l.key || this.state.active === l.entry) {
        g.lineWidth = 1.5;
        g.strokeStyle = '#e3e8e5';
        g.globalAlpha = a * (this.state.active === l.entry && this.hover !== l.key && this.focusKey !== l.key ? 0.55 : 0.95);
        g.beginPath();
        g.arc(l.x, l.y, l.core + 5, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    return gliding || igniting || breathing;
  }

  /* ------------------------------------------------------------ interaction */

  private currentLights(): Light[] {
    return [...this.tracks.values()].filter((t) => t.visTo > 0).map((t) => t.cur);
  }

  private show(key: string | null) {
    const p = key ? this.byKey.get(key) : null;
    const l = key ? this.tracks.get(key) : null;
    if (!p || !l) {
      this.tip.hidden = true;
      return;
    }
    const value = l.cur.usd;
    const strong = document.createElement('strong');
    strong.textContent = value === null ? (this.state.mode === 'then' ? 'No market price' : 'No price today') : usd(value);
    const title = document.createElement('b');
    title.textContent = this.o.titleOf(p.entry);
    const meta = document.createElement('span');
    meta.textContent = `${dateUTC(p.t)} · ${p.chain} · ${this.state.mode === 'then' ? 'value at the time' : "at today's price"}${onward(p)}`;
    this.tip.replaceChildren(strong, title, meta);
    this.tip.hidden = false;
    const x = Math.min(this.size.width - 190, Math.max(4, l.cur.x + 14));
    const y = Math.max(4, l.cur.y - 70);
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private readonly onPointer = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect();
    const hit = nearest(this.currentLights(), e.clientX - r.left, e.clientY - r.top, e.pointerType === 'touch' ? 32 : 24);
    const key = hit ? hit.key : null;
    if (key !== this.hover) {
      this.hover = key;
      this.host.style.cursor = key ? 'pointer' : '';
      this.show(key);
      this.request();
    }
  };

  private readonly onLeave = () => {
    this.hover = null;
    this.focusKey = null;
    this.tip.hidden = true;
    this.request();
  };

  private readonly onClick = (e: MouseEvent) => {
    // A click on a light's own link navigates natively (#entry); a click near one selects it the same way.
    const link = (e.target as Element).closest('a');
    if (link) {
      const key = link.getAttribute('data-key');
      const p = key ? this.byKey.get(key) : null;
      if (p) this.o.onSelect(p.entry, true);
      return;
    }
    if (this.hover) {
      const p = this.byKey.get(this.hover);
      if (p) this.o.onSelect(p.entry, false);
    }
  };

  private readonly onKey = (e: KeyboardEvent) => {
    const order = this.currentLights().sort((a, b) => a.x - b.x || a.y - b.y);
    if (!order.length) return;
    const i = this.focusKey ? order.findIndex((l) => l.key === this.focusKey) : -1;
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i < 0 ? 0 : Math.min(order.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i < 0 ? order.length - 1 : Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    else if (e.key === 'Enter' && this.focusKey) {
      const p = this.byKey.get(this.focusKey);
      if (p) this.o.onSelect(p.entry, false);
      e.preventDefault();
      return;
    } else if (e.key === 'Escape') {
      this.onLeave();
      return;
    } else return;
    e.preventDefault();
    this.focusKey = order[next].key;
    this.show(this.focusKey);
    const p = this.byKey.get(this.focusKey);
    const l = this.tracks.get(this.focusKey);
    if (p && l) this.live.textContent = `${this.o.titleOf(p.entry)}, ${dateUTC(p.t)}, ${l.cur.usd === null ? 'no price' : usd(l.cur.usd)}${onward(p)}. Press Enter to read the story.`;
    this.request();
  };

  private readonly onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else this.request();
  };
}
