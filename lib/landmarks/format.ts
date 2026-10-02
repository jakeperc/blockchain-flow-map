/**
 * Formatting for the Landmarks page. Dependency-free so the build scripts can import it directly; `usd()` mirrors
 * money() in lib/atlas/model.ts (compact T/B/M/K, a true minus sign) so the two pages read the same. Dates are UTC.
 */

export function usd(n: number, compact = true): string {
  if (!compact) return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(n);
  const a = Math.abs(n);
  const d = a >= 1e12 ? 1e12 : a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : a >= 1e3 ? 1e3 : 1;
  const unit = d === 1e12 ? 'T' : d === 1e9 ? 'B' : d === 1e6 ? 'M' : d === 1e3 ? 'K' : '';
  return `${n < 0 ? '−' : ''}$${(a / d).toFixed(d === 1 ? 0 : 2)}${unit}`;
}

/** Groups the integer part of a non-negative decimal string with commas, keeping every fractional digit. */
export function groupDecimal(value: string): string {
  const [whole, frac] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

/** An amount for reading: at most `digits` decimals, trailing zeros dropped. `exact` keeps every recorded digit. */
export function amount(value: string, asset: string, opts: {exact?: boolean; digits?: number} = {}): string {
  if (opts.exact) return `${groupDecimal(value)} ${asset}`;
  const n = Number(value);
  // Too small for six decimals (a test payment of a few wei): shown exactly, never rounded to nothing.
  if (n > 0 && n < 0.000001) return asset === 'ETH' ? `${weiOf(value)} wei` : `${value} ${asset}`;
  const digits = opts.digits ?? (n >= 1000 ? 0 : n >= 1 ? 2 : 6);
  return `${n.toLocaleString('en-US', {maximumFractionDigits: digits, minimumFractionDigits: 0})} ${asset}`;
}

/** An ETH amount given as a decimal string, in wei (18 decimals), grouped. */
function weiOf(value: string): string {
  const [whole, frac = ''] = value.split('.');
  return groupDecimal(BigInt(whole + frac.padEnd(18, '0').slice(0, 18)).toString());
}

/** Same shape as the map's address shortener. */
export function short(a: string): string {
  return a.length > 18 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "22 May 2010" */
export function dateUTC(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "18:16 UTC" */
export function timeUTC(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "2010-05-22" */
export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function monthName(ms: number): string {
  return MONTHS[new Date(ms).getUTCMonth()];
}

/** A share as a percentage with sensible precision: "6.93%", "0.33%", "0.0041%". */
export function percent(share: number): string {
  const p = share * 100;
  const digits = p >= 10 ? 1 : p >= 0.1 ? 2 : p >= 0.001 ? 4 : 6;
  return `${p.toFixed(digits)}%`;
}

/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
