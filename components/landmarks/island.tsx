/**
 * The Landmarks island: the controls (React) and the live field (FieldView), mounted over a page that is complete
 * without them. State is local: the URL is never read or written (the map's no-URL-state rule, checked by
 * scripts/llms/render.mjs); a story's address is its own fragment, which the browser handles.
 */
import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import {Pause, Play} from 'lucide-react';
import {META, POINTS, MILESTONES, DOMAIN} from '@/lib/landmarks/data';
import {GROUPS, GROUP_COLORS, GROUP_LABELS} from '@/lib/landmarks/field';
import {fetchSpot} from '@/lib/landmarks/prices';
import type {Group, Mode, View} from '@/lib/landmarks/types';
import {FieldView} from './field-view';
import {applyFilter, applySort, fillToday, markActive, restoreTarget, storyEls, todayValue, watchActive} from './stories-dom';

type PriceState = {state: 'loading' | 'live' | 'unavailable'; usd: Record<string, number> | null; source: string};

const titleOf = (entry: string) => document.querySelector<HTMLElement>(`#${CSS.escape(entry)} h3`)?.textContent?.trim() || entry;
const CHAINS = [...new Set(POINTS.map((p) => p.chain))].sort();
const neededAssets = [...new Set(POINTS.filter((p) => p.todayApplicable).map((p) => p.asset))];
/** One record per entry, from the generated data: the same facts the static articles carry in their data attributes. */
const ENTRIES = [...new Set(POINTS.filter((p) => !p.measured).map((p) => p.entry))].map((entry) => {
  const legs = POINTS.filter((p) => p.entry === entry);
  return {entry, group: legs[0].group, chains: [...new Set(legs.map((p) => p.chain))], recent: legs.some((p) => p.t >= META.recent.start && p.t <= META.recent.end)};
});

function setPill(p: PriceState) {
  const pill = document.getElementById('lm-prices');
  if (!pill) return;
  pill.dataset.state = p.state;
  const text = pill.querySelector('span');
  if (text) text.textContent = p.state === 'live' ? 'LIVE PRICES' : p.state === 'loading' ? 'LOADING PRICES' : 'PRICES UNAVAILABLE';
  pill.title = p.state === 'live' ? `Today's values use live prices from ${p.source}.` : p.state === 'loading' ? 'Reading live prices.' : 'Live prices did not load, so values at today’s price are not shown.';
}

/** Selects a story: marks it, and scrolls to it unless the browser is already following the light's own link. */
function selectStory(entry: string, scroll: boolean) {
  const el = document.getElementById(entry);
  if (!el) return;
  if (scroll) el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  el.querySelector<HTMLElement>('.lm-permalink')?.focus({preventScroll: true});
}

function Island({fieldHost}: {fieldHost: HTMLElement}) {
  const [view, setView] = useState<View>('all-time');
  const [mode, setMode] = useState<Mode>('then');
  const [groups, setGroups] = useState<Record<Group, boolean>>({milestone: true, theft: true, seizure: true});
  const [chain, setChain] = useState('all');
  const [sort, setSort] = useState<'date' | 'value'>('date');
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [prices, setPrices] = useState<PriceState>({state: 'loading', usd: null, source: ''});
  const field = useRef<FieldView | null>(null);
  const els = useMemo(() => storyEls(), []);

  const visible = useMemo(() => {
    const keys = POINTS.filter((p) => groups[p.group] && (chain === 'all' || p.chain === chain)).map((p) => p.key);
    return new Set(keys);
  }, [groups, chain]);
  const todayReady = prices.state === 'live';
  const shownMode: Mode = mode === 'today' && todayReady ? 'today' : 'then';

  // The field lives for the page's lifetime; it is created once and told about every state change.
  useEffect(() => {
    const f = new FieldView(fieldHost, {
      points: POINTS,
      milestones: MILESTONES,
      domain: DOMAIN,
      windows: {allTime: META.allTime, recent: META.recent},
      titleOf,
      onSelect: (entry, viaLink) => selectStory(entry, !viaLink),
    }, {view: 'all-time', mode: 'then', prices: null, visible: new Set(POINTS.map((p) => p.key)), active: null, paused: false});
    field.current = f;
    restoreTarget();
    return () => f.destroy();
  }, [fieldHost]);

  useEffect(() => {
    field.current?.setState({view, mode: shownMode, prices: todayReady ? prices.usd : null, visible, active, paused});
  }, [view, shownMode, todayReady, prices.usd, visible, active, paused]);

  useEffect(() => {
    let alive = true;
    setPill({state: 'loading', usd: null, source: ''});
    fillToday(POINTS, 'loading', null);
    fetchSpot(neededAssets).then(
      (spot) => {
        if (!alive) return;
        const complete = neededAssets.every((a) => spot.usd[a] > 0);
        const next: PriceState = complete ? {state: 'live', usd: spot.usd, source: spot.source} : {state: 'unavailable', usd: null, source: spot.source};
        setPrices(next);
        setPill(next);
        fillToday(POINTS, next.state, next.usd);
      },
      () => {
        if (!alive) return;
        const next: PriceState = {state: 'unavailable', usd: null, source: ''};
        setPrices(next);
        setPill(next);
        fillToday(POINTS, 'unavailable', null);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => watchActive(els, (entry) => setActive(entry)), [els]);
  useEffect(() => markActive(els, active), [els, active]);
  useEffect(() => {
    document.documentElement.classList.toggle('lm-paused', paused);
  }, [paused]);
  const shown = ENTRIES.filter((e) => groups[e.group] && (chain === 'all' || e.chains.includes(chain)) && (view === 'all-time' || e.recent)).length;
  useEffect(() => {
    applyFilter(els, {view, groups, chain, recent: META.recent});
  }, [els, view, groups, chain]);
  useEffect(() => {
    applySort(els, sort, (entry) => {
      if (shownMode === 'today') return todayValue(POINTS, entry, prices.usd);
      const v = POINTS.filter((p) => p.entry === entry && p.counted).map((p) => p.usdThen);
      return v.some((x) => x === null) ? null : v.reduce<number>((s, x) => s + (x ?? 0), 0);
    });
  }, [els, sort, shownMode, prices.usd]);

  const lockReason = prices.state === 'loading' ? 'Reading live prices' : 'Live prices did not load, so values at today’s price cannot be shown';
  return (
    <>
      <div className="lm-seg" role="group" aria-label="Time window">
        {(['all-time', 'recent'] as View[]).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            {v === 'all-time' ? 'ALL-TIME' : 'RECENT'}
          </button>
        ))}
      </div>
      <div className="lm-seg lm-seg-key" role="group" aria-label="Value shown">
        <button type="button" aria-pressed={shownMode === 'then'} onClick={() => setMode('then')}>
          THEN
        </button>
        <button type="button" aria-pressed={shownMode === 'today'} aria-disabled={!todayReady} title={todayReady ? 'Value of the same amounts at live prices' : lockReason} onClick={() => todayReady && setMode('today')}>
          TODAY
        </button>
      </div>
      {GROUPS.map((g) => (
        <button key={g} type="button" className="lm-chipbtn" aria-pressed={groups[g]} onClick={() => setGroups({...groups, [g]: !groups[g]})}>
          <i className="lm-dot" style={{'--c': GROUP_COLORS[g]} as CSSProperties} />
          {GROUP_LABELS[g]}
        </button>
      ))}
      <select className="lm-select" aria-label="Chain" value={chain} onChange={(e) => setChain(e.target.value)}>
        <option value="all">All chains</option>
        {CHAINS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select className="lm-select" aria-label="Order of the stories" value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'value')}>
        <option value="date">By date</option>
        <option value="value">By value</option>
      </select>
      <button type="button" className="lm-chipbtn lm-pause" aria-pressed={paused} aria-label={paused ? 'Resume motion' : 'Pause motion'} onClick={() => setPaused(!paused)}>
        {paused ? <Play size={13} /> : <Pause size={13} />}
      </button>
      <span className="lm-count" aria-live="polite">
        {shown} of {els.length} {els.length === 1 ? 'story' : 'stories'}
      </span>
    </>
  );
}

export function mountLandmarks() {
  const controls = document.getElementById('lm-controls');
  const fieldHost = document.getElementById('lm-field');
  if (!controls || !fieldHost) return;
  createRoot(controls).render(<Island fieldHost={fieldHost} />);
}
