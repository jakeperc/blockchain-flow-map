/**
 * The Landmarks field: transactions placed by date (x) and USD on a log scale (y). Pure and dependency-free, so the
 * build scripts render the static SVG with exactly the code the browser island uses for interaction.
 *
 * Encodings (stated in the page's legend): position is date and USD; the halo repeats USD; colour is one of three
 * groups (a scatter keeps only three hues pairwise distinct, dataviz check 4, validated on the page surface); a hollow
 * ring marks a row from our own scans; a hairline joins the legs of one event. Positions are data and never jittered:
 * overlapping lights are resolved by drawing large halos first and by nearest-light hit-testing, not by moving them.
 */
import type {Group, LandmarkPoint, Milestone, Mode} from './types';

/** Validated with the dataviz skill: dark mode, surface #111a1e, all pairs (scatter). */
export const GROUP_COLORS: Record<Group, string> = {milestone: '#199e70', theft: '#d95926', seizure: '#3987e5'};
export const GROUP_LABELS: Record<Group, string> = {milestone: 'Milestones and records', theft: 'Thefts and exploits', seizure: 'Seizures and forfeitures'};
export const GROUPS: Group[] = ['milestone', 'theft', 'seizure'];
export const SURFACE = '#111a1e';
const GRID = '#ffffff10';
const AXIS_TEXT = '#788c87';
const LABEL_TEXT = '#c9d4cf';
const MILESTONE_LINE = '#ffffff1a';
const SHELF_FILL = '#ffffff06';

export interface Size {
  width: number;
  height: number;
  compact: boolean;
}

export interface Frame {
  width: number;
  height: number;
  compact: boolean;
  left: number;
  right: number;
  top: number;
  plotBottom: number;
  shelfTop: number;
  shelfBottom: number;
  shelfY: number;
  axisY: number;
  t0: number;
  t1: number;
  decMin: number;
  decMax: number;
}

export interface Light {
  key: string;
  entry: string;
  x: number;
  y: number;
  halo: number;
  core: number;
  shelf: boolean;
  group: Group;
  measured: boolean;
  usd: number | null;
}

export interface Label {
  key: string;
  entry: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  text: string;
}

const YEAR = 365.25 * 86400000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function makeFrame(size: Size, t0: number, t1: number, decMin: number, decMax: number): Frame {
  const {width, height, compact} = size;
  const left = compact ? 40 : 56;
  const right = compact ? 12 : 20;
  const top = compact ? 14 : 22;
  const axisBand = compact ? 22 : 26;
  const shelfBand = compact ? 24 : 30;
  const plotBottom = height - axisBand - shelfBand;
  return {width, height, compact, left, right, top, plotBottom, shelfTop: plotBottom + 4, shelfBottom: plotBottom + shelfBand - 2, shelfY: plotBottom + shelfBand / 2 + 1, axisY: height - 7, t0, t1, decMin, decMax};
}

export const xOf = (f: Frame, t: number) => f.left + ((t - f.t0) / Math.max(1, f.t1 - f.t0)) * (f.width - f.left - f.right);

export function yOf(f: Frame, usd: number): number {
  const v = Math.log10(Math.max(usd, 1e-9));
  const k = (v - f.decMin) / Math.max(1e-9, f.decMax - f.decMin);
  return f.plotBottom - Math.min(1, Math.max(0, k)) * (f.plotBottom - f.top);
}

/** Decades that hold every value, padded by half a decade so no light sits on the frame. */
export function decadesFor(values: Array<number | null>): {decMin: number; decMax: number} {
  const v = values.filter((x): x is number => x !== null && x > 0);
  if (!v.length) return {decMin: 3, decMax: 11};
  const lo = Math.floor(Math.log10(Math.min(...v)) - 0.5);
  const hi = Math.ceil(Math.log10(Math.max(...v)) + 0.5);
  return {decMin: lo, decMax: Math.max(hi, lo + 4)};
}

export function usdOf(p: LandmarkPoint, mode: Mode, prices: Record<string, number> | null): number | null {
  if (mode === 'then') return p.usdThen;
  if (!p.todayApplicable || !prices) return null;
  const price = prices[p.asset];
  return typeof price === 'number' && price > 0 ? p.amount * price : null;
}

export function haloRadius(usd: number | null, compact: boolean): number {
  const base = usd === null ? 6 : Math.max(7, Math.min(44, 7 + 4.2 * Math.log10(Math.max(usd, 1) / 1e3)));
  return base * (compact ? 0.72 : 1);
}

export function placeLights(points: LandmarkPoint[], f: Frame, mode: Mode, prices: Record<string, number> | null): Light[] {
  return points.map((p) => {
    const usd = usdOf(p, mode, prices);
    const shelf = usd === null;
    return {key: p.key, entry: p.entry, x: xOf(f, p.t), y: shelf ? f.shelfY : yOf(f, usd), halo: haloRadius(usd, f.compact), core: f.compact ? 3.5 : 4.5, shelf, group: p.group, measured: p.measured, usd};
  });
}

export function usdTickLabel(dec: number): string {
  const units: Array<[number, string]> = [[12, 'T'], [9, 'B'], [6, 'M'], [3, 'K']];
  for (const [d, u] of units) if (dec >= d) return `$${10 ** (dec - d)}${u}`;
  return `$${10 ** dec}`;
}

export function yTicks(f: Frame): Array<{dec: number; y: number; label: string}> {
  const out: Array<{dec: number; y: number; label: string}> = [];
  const step = f.compact ? 2 : 1;
  for (let d = f.decMin; d <= f.decMax; d += 1) if ((d - f.decMin) % step === 0) out.push({dec: d, y: yOf(f, 10 ** d), label: usdTickLabel(d)});
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function xTicks(f: Frame): Array<{t: number; x: number; label: string}> {
  const out: Array<{t: number; x: number; label: string}> = [];
  const span = (f.t1 - f.t0) / YEAR;
  if (span > 2) {
    const y0 = new Date(f.t0).getUTCFullYear() + 1;
    const y1 = new Date(f.t1).getUTCFullYear();
    const step = span > 10 ? (f.compact ? 4 : 2) : f.compact ? 2 : 1;
    for (let y = y0; y <= y1; y += 1) {
      if ((y1 - y) % step !== 0) continue;
      const t = Date.UTC(y, 0, 1);
      out.push({t, x: xOf(f, t), label: String(y)});
    }
  } else {
    const d = new Date(f.t0);
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth() + 1;
    for (;;) {
      if (m > 11) {
        m = 0;
        y += 1;
      }
      const t = Date.UTC(y, m, 1);
      if (t > f.t1) break;
      out.push({t, x: xOf(f, t), label: MONTHS[m]});
      m += 1;
    }
  }
  return out;
}

/** Greedy label placement by priority: right of the light, else left; dropped when it would collide. */
export function placeLabels(points: LandmarkPoint[], lights: Light[], f: Frame, max: number): Label[] {
  const charW = f.compact ? 5.6 : 6.2;
  const boxes: Array<[number, number, number, number]> = [];
  const cores = lights.map((l) => [l.x - l.core - 1, l.y - l.core - 1, l.x + l.core + 1, l.y + l.core + 1] as [number, number, number, number]);
  const hit = (b: [number, number, number, number], own: number) =>
    boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) || cores.some((c, i) => i !== own && b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
  const byKey = new Map(points.map((p) => [p.key, p]));
  // Unlabelled lights (a story's later legs, measured rows) take no label slot.
  const order = lights.map((l, i) => ({l, i, p: byKey.get(l.key)})).filter((o) => o.p && o.p.label && !o.l.shelf).sort((a, b) => (b.p!.priority - a.p!.priority) || ((b.l.usd ?? 0) - (a.l.usd ?? 0)));
  const out: Label[] = [];
  for (const {l, i, p} of order) {
    if (out.length >= max) break;
    const w = p!.label.length * charW;
    const right: [number, number, number, number] = [l.x + l.core + 6, l.y - 8, l.x + l.core + 6 + w, l.y + 6];
    const left: [number, number, number, number] = [l.x - l.core - 6 - w, l.y - 8, l.x - l.core - 6, l.y + 6];
    const inside = (b: [number, number, number, number]) => b[0] >= f.left && b[2] <= f.width - f.right && b[1] >= f.top - 4 && b[3] <= f.plotBottom;
    const pick = inside(right) && !hit(right, i) ? 'start' : inside(left) && !hit(left, i) ? 'end' : null;
    if (!pick) continue;
    boxes.push(pick === 'start' ? right : left);
    out.push({key: l.key, entry: l.entry, x: pick === 'start' ? right[0] : left[2], y: l.y + 4, anchor: pick, text: p!.label});
  }
  return out;
}

/** The light closest to a point, within `maxDist` pixels. */
export function nearest(lights: Light[], x: number, y: number, maxDist: number): Light | null {
  let best: Light | null = null;
  let bestD = maxDist;
  for (const l of lights) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d <= bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}

export interface SvgOptions {
  size: Size;
  mode: Mode;
  t0: number;
  t1: number;
  decMin: number;
  decMax: number;
  milestones: Milestone[];
  prices: Record<string, number> | null;
  idPrefix: string;
  title: string;
  desc: string;
  /** 'all' draws everything (the static page); 'overlay' leaves halos, beams and cores to the island's canvas. */
  layers: 'all' | 'overlay';
  labelMax: number;
  /** Text for a light's accessible name, by point key. */
  describe: (p: LandmarkPoint, usd: number | null) => string;
  shelfLabel: string;
}

export function renderSvg(points: LandmarkPoint[], o: SvgOptions): string {
  const f = makeFrame(o.size, o.t0, o.t1, o.decMin, o.decMax);
  const visible = points.filter((p) => p.t >= o.t0 && p.t <= o.t1);
  const lights = placeLights(visible, f, o.mode, o.prices);
  const labels = placeLabels(visible, lights, f, o.labelMax);
  const byKey = new Map(visible.map((p) => [p.key, p]));
  const fs = f.compact ? 9.5 : 10.5;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" class="lm-field-svg" viewBox="0 0 ${f.width} ${f.height}" width="${f.width}" height="${f.height}" role="img" aria-labelledby="${o.idPrefix}-title ${o.idPrefix}-desc">`);
  parts.push(`<title id="${o.idPrefix}-title">${esc(o.title)}</title><desc id="${o.idPrefix}-desc">${esc(o.desc)}</desc>`);
  if (o.layers === 'all') {
    parts.push('<defs>');
    for (const g of GROUPS) parts.push(`<radialGradient id="${o.idPrefix}-g-${g}"><stop offset="0" stop-color="${GROUP_COLORS[g]}" stop-opacity=".5"/><stop offset=".38" stop-color="${GROUP_COLORS[g]}" stop-opacity=".16"/><stop offset="1" stop-color="${GROUP_COLORS[g]}" stop-opacity="0"/></radialGradient>`);
    parts.push('</defs>');
  }
  // Recessive grid: solid hairlines one step off the surface.
  parts.push(`<g class="lm-grid" stroke="${GRID}" stroke-width="1">`);
  for (const t of yTicks(f)) parts.push(`<line x1="${f.left}" x2="${f.width - f.right}" y1="${r1(t.y)}" y2="${r1(t.y)}"/>`);
  parts.push(`<line x1="${f.left}" x2="${f.width - f.right}" y1="${r1(f.plotBottom)}" y2="${r1(f.plotBottom)}"/>`);
  parts.push('</g>');
  parts.push(`<rect class="lm-shelf" x="${f.left}" y="${r1(f.shelfTop)}" width="${r1(f.width - f.left - f.right)}" height="${r1(f.shelfBottom - f.shelfTop)}" fill="${SHELF_FILL}"/>`);
  // At the shelf's right end: the earliest transactions, which most often lack a price, sit at its left.
  parts.push(`<text class="lm-shelf-label" x="${r1(f.width - f.right - 6)}" y="${r1(f.shelfY + 3.5)}" text-anchor="end" fill="${AXIS_TEXT}" font-size="${fs}">${esc(o.shelfLabel)}</text>`);
  // Protocol milestones: chain facts dated from their blocks.
  parts.push(`<g class="lm-milestones">`);
  // Labels left to right, each skipped when it would run into the previous one; every rule is still drawn.
  let labelEnd = -Infinity;
  for (const m of [...o.milestones].sort((a, b) => a.t - b.t)) {
    if (m.t < o.t0 || m.t > o.t1) continue;
    const x = r1(xOf(f, m.t));
    parts.push(`<line x1="${x}" x2="${x}" y1="${f.top}" y2="${r1(f.plotBottom)}" stroke="${MILESTONE_LINE}" stroke-width="1"/>`);
    if (f.compact || x + 4 < labelEnd + 6) continue;
    parts.push(`<text x="${r1(x + 4)}" y="${f.top + 9}" fill="${AXIS_TEXT}" font-size="9.5">${esc(m.label)}</text>`);
    labelEnd = x + 4 + m.label.length * 5.4;
  }
  parts.push('</g>');
  if (o.layers === 'all') {
    // Events with more than one leg: a hairline joins the legs in time order.
    const byEntry = new Map<string, Light[]>();
    for (const l of lights) byEntry.set(l.entry, [...(byEntry.get(l.entry) ?? []), l]);
    parts.push('<g class="lm-legs" fill="none" stroke-width="1">');
    for (const ls of byEntry.values()) {
      if (ls.length < 2) continue;
      const s = [...ls].sort((a, b) => a.x - b.x);
      parts.push(`<polyline points="${s.map((l) => `${r1(l.x)},${r1(l.y)}`).join(' ')}" stroke="${GROUP_COLORS[s[0].group]}" stroke-opacity=".35"/>`);
    }
    parts.push('</g><g class="lm-beams" stroke-width="1">');
    for (const l of lights) if (!l.shelf) parts.push(`<line x1="${r1(l.x)}" x2="${r1(l.x)}" y1="${r1(l.y + l.core)}" y2="${r1(f.plotBottom)}" stroke="${GROUP_COLORS[l.group]}" stroke-opacity=".22"/>`);
    parts.push('</g><g class="lm-halos">');
    for (const l of [...lights].sort((a, b) => b.halo - a.halo)) parts.push(`<circle cx="${r1(l.x)}" cy="${r1(l.y)}" r="${r1(l.halo)}" fill="url(#${o.idPrefix}-g-${l.group})"/>`);
    parts.push('</g><g class="lm-cores">');
    for (const l of lights) {
      const c = GROUP_COLORS[l.group];
      parts.push(l.measured ? `<circle cx="${r1(l.x)}" cy="${r1(l.y)}" r="${l.core}" fill="${SURFACE}" stroke="${c}" stroke-width="2"/>` : `<circle cx="${r1(l.x)}" cy="${r1(l.y)}" r="${l.core + 1}" fill="${c}" stroke="${SURFACE}" stroke-width="2"/>`);
    }
    parts.push('</g>');
  }
  parts.push(`<g class="lm-labels" font-size="${fs + 0.5}" fill="${LABEL_TEXT}" stroke="${SURFACE}" stroke-width="3" paint-order="stroke">`);
  for (const lb of labels) parts.push(`<text x="${r1(lb.x)}" y="${r1(lb.y)}" text-anchor="${lb.anchor}" data-key="${esc(lb.key)}">${esc(lb.text)}</text>`);
  parts.push('</g>');
  // Pointer targets: 24 px or more, larger than the painted mark. Not tab stops; the stories are the keyboard path.
  parts.push('<g class="lm-hits">');
  for (const l of lights) {
    const p = byKey.get(l.key)!;
    parts.push(`<a href="#${esc(l.entry)}" tabindex="-1" aria-label="${esc(o.describe(p, l.usd))}" data-key="${esc(l.key)}"><circle cx="${r1(l.x)}" cy="${r1(l.y)}" r="${f.compact ? 14 : 12}" fill="transparent"/></a>`);
  }
  parts.push('</g>');
  parts.push(`<g class="lm-axes" fill="${AXIS_TEXT}" font-size="${fs}">`);
  for (const t of yTicks(f)) parts.push(`<text x="${f.left - 8}" y="${r1(t.y + 3.5)}" text-anchor="end">${esc(t.label)}</text>`);
  for (const t of xTicks(f)) parts.push(`<text x="${r1(t.x)}" y="${r1(f.axisY)}" text-anchor="middle">${esc(t.label)}</text>`);
  parts.push('</g></svg>');
  return parts.join('');
}
