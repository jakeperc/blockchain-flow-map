/**
 * Network readers for the Landmarks scripts (fetch-facts.mjs, measure-largest.mjs). Keyless public endpoints only,
 * paced, and never shipped: the page itself reads nothing but live spot prices.
 *
 *   Bitcoin    mempool.space and blockstream.info (two operators, the same Esplora API)
 *   Liquid     blockstream.info/liquid (one operator; amounts are usually confidential)
 *   Ethereum   Tenderly's gateway, drpc and MEV Blocker (all serve full history; trace_transaction on drpc only)
 *   Prices     Bitstamp and Coinbase Exchange candles: the 1-minute candle containing the block, else the hourly,
 *              else the daily, and only a candle that traded (a zero-volume candle repeats an old price)
 *   Sources    any URL; archive.org snapshots are read raw (id_), PDFs through pdftotext or Python's pypdf
 *
 * Endpoint facts behind these choices were measured on 2026-10-02.
 */
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rpc} from '../rpc-pool.mjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (compatible; BlockchainFlowMap-Landmarks/1.0; +https://jakepercy.com/global-blockchain-flow/)';
const PAUSE_MS = 250;

/** GET with retries on 429/5xx and network errors. Other 4xx answers are final: a blocked page is not retried around. */
async function request(url, {tries = 4, accept = 'application/json', timeoutMs = 45000} = {}) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {headers: {'user-agent': UA, accept}, signal: ctl.signal, redirect: 'follow'});
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`HTTP ${res.status} ${url}`);
        await sleep(1500 * (i + 1));
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), {final: true});
      return res;
    } catch (e) {
      if (e.final) throw e;
      last = e;
      await sleep(1000 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}
export const getJson = async (url, opts) => (await request(url, opts)).json();
const getPlain = async (url) => (await (await request(url, {accept: 'text/plain'})).text()).trim();

/* ------------------------------------------------------------------ Bitcoin and Liquid (Esplora) */

export const ESPLORA = {
  Bitcoin: [{name: 'mempool.space', base: 'https://mempool.space/api'}, {name: 'blockstream.info', base: 'https://blockstream.info/api'}],
  Liquid: [{name: 'blockstream.info', base: 'https://blockstream.info/liquid/api'}],
};

export async function esploraTx(base, txid) {
  await sleep(PAUSE_MS);
  return getJson(`${base}/tx/${txid}`);
}
export async function esploraTip(base) {
  await sleep(PAUSE_MS);
  return Number(await getPlain(`${base}/blocks/tip/height`));
}
export async function esploraHash(base, height) {
  await sleep(PAUSE_MS);
  return getPlain(`${base}/block-height/${height}`);
}
export async function esploraBlock(base, hash) {
  await sleep(PAUSE_MS);
  return getJson(`${base}/block/${hash}`);
}
/** One page (25) of a block's transactions, in block order. */
export async function esploraBlockTxs(base, hash, start = 0) {
  await sleep(PAUSE_MS);
  return getJson(`${base}/block/${hash}/txs/${start}`);
}
/** Every confirmed transaction of an address, newest first (25 per page). */
export async function esploraAddressTxs(base, address, maxPages = 40) {
  const out = [];
  let last = null;
  for (let page = 0; page < maxPages; page += 1) {
    await sleep(PAUSE_MS);
    const batch = await getJson(`${base}/address/${address}/txs/chain${last ? `/${last}` : ''}`);
    out.push(...batch);
    if (batch.length < 25) return {txs: out, complete: true};
    last = batch[batch.length - 1].txid;
  }
  return {txs: out, complete: false};
}
/** Height of the newest block whose time is at or before `sec` (mempool.space's mining API). */
export async function heightAtOrBefore(sec) {
  await sleep(PAUSE_MS);
  const j = await getJson(`https://mempool.space/api/v1/mining/blocks/timestamp/${sec}`);
  return j.height;
}

/* ------------------------------------------------------------------ EVM */

export const EVM = {
  // batch: the endpoint that answers JSON-RPC batches keylessly (MEV Blocker takes 100 per request; Tenderly's gateway
  // rate-limits a batch of 100 and drpc's free tier refuses more than 3).
  Ethereum: {endpoints: ['https://mainnet.gateway.tenderly.co', 'https://eth.drpc.org', 'https://rpc.mevblocker.io'], trace: 'https://eth.drpc.org', batch: 'https://rpc.mevblocker.io'},
};
const hex = (n) => `0x${n.toString(16)}`;
const host = (url) => new URL(url).host;
export const endpointName = host;

/** Many calls in one JSON-RPC batch, results in call order. Any failed item fails the whole batch: a complete read
 *  either has every answer or is not complete. */
export async function evmBatch(url, calls) {
  const body = calls.map(([method, params], id) => ({jsonrpc: '2.0', id, method, params}));
  let last;
  for (let i = 0; i < 4; i += 1) {
    try {
      const res = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json', 'user-agent': UA}, body: JSON.stringify(body)});
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} ${url}`);
      const j = await res.json();
      if (!Array.isArray(j)) throw new Error(`batch refused by ${host(url)}: ${JSON.stringify(j).slice(0, 160)}`);
      const byId = new Map(j.map((x) => [x.id, x]));
      return calls.map((_, id) => {
        const r = byId.get(id);
        if (!r || r.error) throw Object.assign(new Error(`batch item ${id} on ${host(url)}: ${r ? r.error.message : 'missing'}`), {final: !r});
        return r.result;
      });
    } catch (e) {
      last = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

/** One endpoint's reading of a transaction: header facts, receipt, logs and the block's time. */
export async function evmRead(url, hash) {
  const tx = await rpc(url, 'eth_getTransactionByHash', [hash]);
  if (!tx || !tx.blockNumber) return null;
  const rc = await rpc(url, 'eth_getTransactionReceipt', [hash]);
  const blk = await rpc(url, 'eth_getBlockByNumber', [tx.blockNumber, false]);
  return {
    source: host(url),
    block: parseInt(tx.blockNumber, 16),
    time: parseInt(blk.timestamp, 16) * 1000,
    from: tx.from.toLowerCase(),
    to: (tx.to || '').toLowerCase(),
    value: BigInt(tx.value).toString(),
    status: rc.status,
    gasUsed: BigInt(rc.gasUsed).toString(),
    gasPrice: BigInt(rc.effectiveGasPrice ?? tx.gasPrice).toString(),
    logs: rc.logs.map((l) => ({address: l.address.toLowerCase(), topics: l.topics.map((t) => t.toLowerCase()), data: l.data.toLowerCase(), logIndex: parseInt(l.logIndex, 16)})),
  };
}
/** Value-bearing internal calls (trace_transaction). Only drpc answers this keylessly, so a trace is one reading. */
export async function evmTrace(url, hash) {
  const tr = await rpc(url, 'trace_transaction', [hash]);
  return tr.filter((t) => t.action && t.action.value && BigInt(t.action.value) > 0n && !t.error).map((t) => ({from: t.action.from.toLowerCase(), to: (t.action.to || '').toLowerCase(), value: BigInt(t.action.value).toString()}));
}
export async function evmBalance(url, address, block) {
  return BigInt(await rpc(url, 'eth_getBalance', [address, hex(block)])).toString();
}
export async function evmCall(url, to, data, block) {
  return rpc(url, 'eth_call', [{to, data}, hex(block)]);
}
export async function evmFinalized(url) {
  const b = await rpc(url, 'eth_getBlockByNumber', ['finalized', false]);
  return parseInt(b.number, 16);
}
export async function evmBlockTime(url, block) {
  const b = await rpc(url, 'eth_getBlockByNumber', [hex(block), false]);
  return parseInt(b.timestamp, 16) * 1000;
}

/* ------------------------------------------------------------------ prices */

const bitstamp = (pair) => ({
  name: 'Bitstamp',
  pair: pair.toUpperCase().replace(/(...)$/, '/$1'),
  url: (step, start) => `https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=${step}&limit=2&start=${start}`,
  parse: (j) => (j && j.data && j.data.ohlc ? j.data.ohlc : []).map((c) => ({start: Number(c.timestamp), close: Number(c.close), volume: Number(c.volume)})),
});
const coinbase = (product) => ({
  name: 'Coinbase Exchange',
  pair: product.replace('-', '/'),
  url: (step, start) => `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${step}&start=${new Date(start * 1000).toISOString()}&end=${new Date((start + step) * 1000).toISOString()}`,
  parse: (j) => (Array.isArray(j) ? j : []).map((c) => ({start: c[0], close: c[4], volume: c[5]})),
});
/** Where each asset's USD price is read from, in order. A stablecoin is priced like anything else: never an assumed peg. */
export const PRICE_SOURCES = {
  BTC: [bitstamp('btcusd'), coinbase('BTC-USD')],
  ETH: [coinbase('ETH-USD'), bitstamp('ethusd')],
  USDT: [bitstamp('usdtusd'), coinbase('USDT-USD')],
  USDC: [bitstamp('usdcusd')],
};
const STEPS = [60, 3600, 86400];

/** The traded candle containing `ms`, finest first. Returns {none, reason} when no keyless series covers it. */
export async function candleAt(asset, ms) {
  const sec = Math.floor(ms / 1000);
  const tried = [];
  for (const step of STEPS) {
    for (const src of PRICE_SOURCES[asset] || []) {
      const start = sec - (sec % step);
      let rows;
      try {
        rows = src.parse(await getJson(src.url(step, start)));
      } catch (e) {
        tried.push(`${src.name} ${step}s: ${e.message}`);
        continue;
      } finally {
        await sleep(350);
      }
      const c = rows.find((r) => r.start <= sec && sec < r.start + step);
      if (c && c.volume > 0 && c.close > 0) return {source: src.name, pair: src.pair, granularity: step, start: c.start * 1000, close: c.close, volume: c.volume};
      tried.push(`${src.name} ${step}s: ${c ? 'no trades in that candle' : 'no candle'}`);
    }
  }
  return {none: true, reason: `No keyless exchange series has a traded candle containing this time for ${asset}.`, tried};
}

/** Spot prices now, CoinGecko first (the map's order), for the field's reference axis. */
export async function spotPrices() {
  const ids = {BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin'};
  const j = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(ids).join(',')}&vs_currencies=usd`);
  const usd = {};
  for (const [sym, id] of Object.entries(ids)) if (j[id] && j[id].usd > 0) usd[sym] = j[id].usd;
  return {source: 'CoinGecko', at: new Date().toISOString(), usd};
}

/* ------------------------------------------------------------------ source documents */

/** archive.org's raw capture of a snapshot URL (no toolbar, original bytes). */
export const rawArchiveUrl = (u) => u.replace(/^(https?:\/\/web\.archive\.org\/web\/\d+)\//, '$1id_/');

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', mdash: '-', ndash: '-'};
const decodeEntities = (s) => s.replace(/&(#?\w+);/g, (m, k) => ENTITIES[k] ?? (k.startsWith('#x') ? String.fromCodePoint(parseInt(k.slice(2), 16)) : k.startsWith('#') ? String.fromCodePoint(Number(k.slice(1))) : m));

function pdfText(buf) {
  const dir = mkdtempSync(join(tmpdir(), 'landmarks-pdf-'));
  try {
    const file = join(dir, 'doc.pdf');
    writeFileSync(file, buf);
    const a = spawnSync('pdftotext', ['-layout', file, '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    if (a.status === 0 && a.stdout.trim()) return a.stdout;
    const py = spawnSync('python', ['-c', 'import sys,pypdf;r=pypdf.PdfReader(sys.argv[1]);print("\\n".join((p.extract_text() or "") for p in r.pages))', file], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    if (py.status === 0 && py.stdout.trim()) return py.stdout;
    throw new Error('no PDF text extractor worked (install pdftotext, or Python with pypdf)');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

/**
 * A source's raw bytes as text (so identifiers inside links and attributes count) and its readable text (so a quote
 * is matched against what a reader sees). The caller compares normalised forms.
 */
export async function sourceText(url) {
  const res = await request(rawArchiveUrl(url), {accept: '*/*', tries: 3, timeoutMs: 90000});
  const type = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (/pdf/i.test(type) || buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    const text = pdfText(buf);
    return {raw: text, text};
  }
  const raw = buf.toString('utf8');
  const text = decodeEntities(raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
  return {raw: decodeEntities(raw), text};
}

/** For matching quotes: typographic characters folded, case and whitespace ignored, stray spaces before punctuation removed. */
export function normalise(s) {
  return String(s)
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[     ]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?)])/g, '$1')
    .trim()
    .toLowerCase();
}
