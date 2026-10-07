/**
 * Reads the public name tag on an address's own explorer page, with the page's address banners (compilation
 * disclosures and third-party reports). Shared by read-tag.mjs (the registry's admissible read) and the Landmarks scan
 * (scripts/landmarks/measure-largest.mjs). Never works around a block: a non-200 answer or a challenge page throws.
 */
export const TAG_HOSTS = ['etherscan.io', 'basescan.org', 'arbiscan.io', 'snowscan.xyz', 'polygonscan.com', 'optimistic.etherscan.io', 'tronscan.org'];
export const PAUSE_MS = 2500;

export class BlockedError extends Error {}

/** {tag, compilation, reports, alerts}; tag is null when the page shows none. */
export async function readTag(host, address) {
  if (!TAG_HOSTS.includes(host)) throw new Error(`unknown explorer ${host}`);
  if (host === 'tronscan.org') return readTronscanTag(address);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error(`${address} is not an address`);
  // Arbiscan and Optimistic Etherscan answer 403 on address pages; their /txs?a= page header carries the same tag.
  const header = host.startsWith('arbiscan') || host.startsWith('optimistic.');
  const res = await fetch(`https://${host}/${header ? `txs?a=${address}` : `address/${address}`}`, {headers: {'user-agent': 'Mozilla/5.0'}});
  const html = await res.text();
  if (res.status !== 200 || /just a moment|cf-chl|captcha/i.test(html.slice(0, 5000))) throw new BlockedError(`HTTP ${res.status} (challenge or block); do not work around it`);
  // The tag sits in a tooltip attribute ending at &#10; or a closing quote; Arbiscan's header uses a span.
  const m = header ? html.match(/Public Name Tag \(viewable by anyone\)">([^<]+)<\/span>/) : html.match(/Name Tag \(viewable by anyone\) <br\/> (.*?)(?:&#10;|')/);
  const tag = m ? m[1].trim() : null;
  // Etherscan-family pages disclose labels copied from a public researcher compilation in a banner, and third-party
  // reports ("Reported by ZachXBT", "reported to be involved in a hack") sit in the same kind of banner. The
  // compilation's name is often a link ("tagged based on <a ...>hildobby</a> compilation"), so each banner is read as
  // text with its markup stripped. Until 2026-10-02 the disclosure was matched on raw HTML with ([^<.]+), which a
  // linked name defeated, so linked disclosures were silently missed. Only the address banners count (class "alert
  // alert-<kind> alert-dismissible fade show mb-3"); the page's other role="alert" elements are boilerplate.
  const alerts = [...html.matchAll(/<div class=['"]alert alert-[a-z]+ alert-dismissible fade show mb-3['"] role=['"]alert['"]>([\s\S]*?)<\/div>/g)]
    .map((x) => x[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').replace(/ ([.,])/g, '$1').trim())
    .filter(Boolean);
  const via = alerts.map((x) => x.match(/tagged based on ([^.]+)/i)).find(Boolean);
  return {tag, compilation: via ? via[1].trim() : null, reports: alerts.filter((x) => !/tagged based on/i.test(x)), alerts};
}

/**
 * Tronscan's own name tag (decision D6), read from its accountv2 API because tronscan.org pages sit behind a bot
 * challenge. The API needs a free key, TRONSCAN_API_KEY in .env.local; it is used offline only and never ships.
 * Only publicTag identifies an owner. redTag and greyTag are risk flags, so they are returned as reports and never
 * as the tag. `kind` reports Tronscan's accountType, since Tron rows have no eth_getCode probe.
 */
async function readTronscanTag(address) {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) throw new Error(`${address} is not a Tron address`);
  if (!process.env.TRONSCAN_API_KEY) {
    try { process.loadEnvFile('.env.local'); } catch {}
  }
  const key = process.env.TRONSCAN_API_KEY;
  if (!key) throw new BlockedError('TRONSCAN_API_KEY is not set (put it in .env.local)');
  const res = await fetch(`https://apilist.tronscanapi.com/api/accountv2?address=${address}`, {headers: {'TRON-PRO-API-KEY': key}});
  if (res.status !== 200) throw new BlockedError(`Tronscan API HTTP ${res.status}; do not work around it`);
  const body = await res.json();
  const tag = typeof body.publicTag === 'string' && body.publicTag.trim() ? body.publicTag.trim() : null;
  const reports = [['red tag', body.redTag], ['grey tag', body.greyTag]].filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => `Tronscan ${k}: ${v.trim()}`);
  // accountType 0 is a normal key-controlled account; anything else (2 = contract) needs a rule-3 look before admission.
  const kind = body.accountType === 0 ? 'eoa' : body.accountType === 2 ? 'contract' : `accountType ${body.accountType}`;
  return {tag, compilation: null, reports, alerts: reports, kind};
}
