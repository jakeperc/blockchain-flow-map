/**
 * The stories are static <article> elements written at build time (scripts/landmarks/html.mjs). These helpers filter,
 * sort and annotate them in place, so the page keeps one copy of every story and works without JavaScript.
 * Nothing here reads or writes the URL: a story's address is its own fragment, handled by the browser.
 */
import type {Group, LandmarkPoint, View} from '@/lib/landmarks/types';
import {usd} from '@/lib/landmarks/format';

export const storyEls = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('#lm-stories > .lm-story')];

export interface StoryFilter {
  view: View;
  groups: Record<Group, boolean>;
  chain: string;
  recent: {start: number; end: number};
}

/** Hides the stories the filters leave out; returns how many remain. */
export function applyFilter(els: HTMLElement[], f: StoryFilter): number {
  let shown = 0;
  for (const el of els) {
    const group = el.dataset.group as Group;
    const chains = (el.dataset.chains || '').split(' ');
    const ok = f.groups[group] && (f.chain === 'all' || chains.includes(f.chain)) && (f.view === 'all-time' || el.dataset.recent === 'true');
    el.hidden = !ok;
    if (ok) shown += 1;
  }
  return shown;
}

/** Re-orders the stories: by date, or by value (highest first; stories without a value last, by date). */
export function applySort(els: HTMLElement[], by: 'date' | 'value', valueOf: (entry: string) => number | null) {
  const host = document.getElementById('lm-stories');
  if (!host) return;
  const t = (el: HTMLElement) => Number(el.dataset.t || 0);
  const sorted = [...els].sort((a, b) => {
    if (by === 'date') return t(a) - t(b);
    const va = valueOf(a.dataset.entry || '');
    const vb = valueOf(b.dataset.entry || '');
    if (va === null && vb === null) return t(a) - t(b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });
  // Only move nodes when the order changes: moving them on load would cancel the browser's scroll to a #story link.
  const current = [...host.children].filter((c) => c.classList.contains('lm-story'));
  if (sorted.every((el, i) => current[i] === el)) return;
  for (const el of sorted) host.appendChild(el);
}

/** After the live field replaces the static one the page shifts; bring a linked story (#entry, via :target) back into
 *  view. Reads which element is targeted, never the URL. */
export function restoreTarget() {
  // Called from an effect, after layout; not via requestAnimationFrame, which a hidden or throttled tab may not run.
  const target = document.querySelector<HTMLElement>('.lm-story:target');
  // Instant: the page's smooth scroll-behavior is for reader actions, not for restoring a position on load.
  if (target) target.scrollIntoView({block: 'start', behavior: 'instant'});
}

/** An entry's value at today's prices: every counted leg must be applicable and priced, or there is no single figure.
 *  A leg that moves coins an earlier leg already moved is not counted twice. */
export function todayValue(points: LandmarkPoint[], entry: string, prices: Record<string, number> | null): number | null {
  const legs = points.filter((p) => p.entry === entry && p.counted);
  if (!prices || !legs.length || legs.some((p) => !p.todayApplicable || !(prices[p.asset] > 0))) return null;
  return legs.reduce((s, p) => s + p.amount * prices[p.asset], 0);
}

/** Writes each story's "at today's price" figure, or says honestly why there is none. */
export function fillToday(points: LandmarkPoint[], state: 'loading' | 'live' | 'unavailable', prices: Record<string, number> | null) {
  for (const dd of document.querySelectorAll<HTMLElement>('[data-today]')) {
    const entry = dd.dataset.today || '';
    const legs = points.filter((p) => p.entry === entry && p.counted);
    if (legs.some((p) => !p.todayApplicable)) continue; // the static text already explains why
    const value = todayValue(points, entry, prices);
    const main = document.createElement('span');
    const note = document.createElement('small');
    if (value !== null) {
      main.className = 'lm-today-value';
      main.textContent = usd(value);
      note.textContent = 'the same amount at live prices';
    } else {
      main.className = 'lm-needs-js';
      main.textContent = state === 'loading' ? 'Loading live prices' : 'Unavailable';
      note.textContent = state === 'loading' ? '' : 'live prices did not load, so no value is shown';
    }
    dd.replaceChildren(main, note);
  }
}

/** Calls back with the story nearest the top third of the viewport as the reader scrolls. */
export function watchActive(els: HTMLElement[], onActive: (entry: string | null) => void): () => void {
  const seen = new Map<HTMLElement, number>();
  const io = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        if (r.isIntersecting) seen.set(r.target as HTMLElement, r.boundingClientRect.top);
        else seen.delete(r.target as HTMLElement);
      }
      let best: HTMLElement | null = null;
      let bestTop = Infinity;
      for (const [el] of seen) {
        const top = Math.abs(el.getBoundingClientRect().top - innerHeight * 0.3);
        if (!el.hidden && top < bestTop) {
          best = el;
          bestTop = top;
        }
      }
      onActive(best ? best.dataset.entry || null : null);
    },
    {rootMargin: '-25% 0px -45% 0px', threshold: [0, 0.25, 0.5]},
  );
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/** Marks the reading position: the active story carries .is-active. */
export function markActive(els: HTMLElement[], entry: string | null) {
  for (const el of els) el.classList.toggle('is-active', el.dataset.entry === entry);
}
