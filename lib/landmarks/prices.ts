/**
 * Live spot prices for the Landmarks page's "at today's price" values, read in the visitor's browser from keyless
 * public APIs in the map's order: CoinGecko, then Coinbase Exchange, then Kraken (lib/atlas/live-client.ts). Each
 * asset falls through on its own. An asset no provider prices is simply absent: the page then says the value is
 * unavailable rather than assuming one. A stablecoin is priced like anything else, never at an assumed peg.
 */
import type {SpotPrices} from './types';

export const ASSETS = ['BTC', 'ETH', 'USDT', 'USDC'] as const;
const GECKO_IDS: Record<string, string> = {BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin'};
const COINBASE: Record<string, string> = {BTC: 'BTC-USD', ETH: 'ETH-USD', USDT: 'USDT-USD'};
const KRAKEN: Record<string, string> = {BTC: 'XBTUSD', ETH: 'ETHUSD', USDT: 'USDTZUSD', USDC: 'USDCUSD'};
/** The keys Kraken answers with for each requested pair (measured 2026-10-02: XXBTZUSD, XETHZUSD, USDTZUSD, USDCUSD). */
const KRAKEN_KEYS: Record<string, string[]> = {BTC: ['XXBTZUSD', 'XBTUSD'], ETH: ['XETHZUSD', 'ETHUSD'], USDT: ['USDTZUSD', 'USDTUSD'], USDC: ['USDCUSD']};

async function getJson(url: string, ms = 8000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, {signal: ctl.signal});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const positive = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Prices for every asset any provider could price, and the providers that supplied them. */
export async function fetchSpot(assets: readonly string[] = ASSETS): Promise<SpotPrices> {
  const usd: Record<string, number> = {};
  const used = new Set<string>();
  try {
    const ids = assets.map((a) => GECKO_IDS[a]).filter(Boolean).join(',');
    const j = (await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)) as Record<string, {usd?: number}>;
    for (const a of assets) {
      const p = positive(j[GECKO_IDS[a]] && j[GECKO_IDS[a]].usd);
      if (p !== null) {
        usd[a] = p;
        used.add('CoinGecko');
      }
    }
  } catch {
    // Falls through to the next provider for every asset.
  }
  for (const a of assets.filter((x) => !(x in usd) && COINBASE[x])) {
    try {
      const j = (await getJson(`https://api.exchange.coinbase.com/products/${COINBASE[a]}/ticker`)) as {price?: string};
      const p = positive(j.price);
      if (p !== null) {
        usd[a] = p;
        used.add('Coinbase Exchange');
      }
    } catch {
      // Next provider.
    }
  }
  const missing = assets.filter((x) => !(x in usd) && KRAKEN[x]);
  if (missing.length) {
    try {
      const j = (await getJson(`https://api.kraken.com/0/public/Ticker?pair=${missing.map((a) => KRAKEN[a]).join(',')}`)) as {result?: Record<string, {c?: string[]}>};
      const result = j.result || {};
      for (const a of missing) {
        const key = KRAKEN_KEYS[a].find((k) => k in result);
        const p = key ? positive(result[key].c && result[key].c[0]) : null;
        if (p !== null) {
          usd[a] = p;
          used.add('Kraken');
        }
      }
    } catch {
      // No provider left; the asset stays unpriced.
    }
  }
  return {source: [...used].join(', ') || 'none', at: Date.now(), usd};
}
