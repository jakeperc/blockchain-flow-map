/**
 * Shapes shared by the Landmarks page, its island and the build scripts. Type-only on purpose: the pure modules here
 * (field.ts, format.ts, chains.ts) import nothing but types, so Node can load them directly (its type stripping erases
 * `import type`) and the build scripts render the static page from the same code the browser runs.
 */

/** Colour group of a light. Three, because a scatter field can keep only three hues pairwise distinct (dataviz check 4). */
export type Group = 'milestone' | 'theft' | 'seizure';
export type Mode = 'then' | 'today';
export type View = 'all-time' | 'recent';

/** One light in the field: one leg of one entry. Numbers and a short label only; the stories are static HTML. */
export interface LandmarkPoint {
  /** `${entry}:${leg}` */
  key: string;
  /** Entry id, which is also the id of the story's <article>. */
  entry: string;
  /** Short label drawn beside the light (24 characters or fewer). */
  label: string;
  group: Group;
  chain: string;
  /** Block time, milliseconds since the epoch, UTC. */
  t: number;
  /** BTC, ETH, USDC, USDT. */
  asset: string;
  /** Amount in units of the asset, at display precision; the exact figure is in the story. */
  amount: number;
  /** USD at the time from a cited candle or document, or null when no market price exists. */
  usdThen: number | null;
  /** False when a value "at today's price" would be fiction (unspendable, frozen or burned). */
  todayApplicable: boolean;
  /** True for a row found by our own scan rather than curated; drawn as a hollow ring. */
  measured: boolean;
  /** False for a leg that moves coins an earlier leg of the same entry already moved (a forward or a return): it is
   *  drawn, but never added to the entry's total. */
  counted: boolean;
  /** Label priority: higher labels are placed first. */
  priority: number;
}

/** A protocol milestone drawn as a faint rule on the time axis, dated from its block. */
export interface Milestone {
  label: string;
  chain: string;
  t: number;
}

export interface LandmarksMeta {
  /** Date of the newest chain or source read behind the page (not the build date). */
  dataAsOf: string;
  /** The fixed recent window, ms since the epoch, UTC. */
  recent: {start: number; end: number};
  allTime: {start: number; end: number};
}

/** Live spot prices in USD by asset symbol, with where they came from. */
export interface SpotPrices {
  source: string;
  at: number;
  usd: Record<string, number>;
}
