/**
 * The Landmarks page's measured section: complete reads of Ethereum over the fixed recent window in config.json, and
 * of USDT's whole supply history for context. Network, keyless, monthly; writes scripts/landmarks/measured.json.
 *
 *   node scripts/landmarks/measure-largest.mjs [--top 10]
 *
 * Tables (each may claim only "the largest X found by a complete read of blocks A to B"):
 *   usdt       every Issue, Redeem and DestroyedBlackFunds event of Tether's USDT contract in the window
 *   usdc       USDC Mint and Burn events in the window, by every minter except Circle's cross-chain (CCTP) minters,
 *              which are recognised by their own explorer tags; the minter list comes from MinterConfigured
 *   transfers  USDT and USDC Transfer events with BOTH ends in the map's first-party Ethereum registry, ranked; same-
 *              operator moves are reported as one share, not ranked (the map's method removes them from activity)
 * A table with any unread range is written as not measured. Prices are the traded candle containing each block
 * (readers.mjs). The tags of every wallet a table shows are re-read today, with the fixed reader, and a tag the
 * explorer credits to a compilation or a third-party report names nobody on the page (decision D7).
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT, CONFIG_FILE, MEASURED_FILE, TRANSFER, unitsToDecimal} from './build.mjs';
import {candleAt, sleep} from './readers.mjs';
import {rpc} from '../rpc-pool.mjs';
import {loadAtlas} from '../atlas-modules.mjs';
import {readTag, PAUSE_MS} from '../registry/tag-reader.mjs';

const args = process.argv.slice(2);
const TOP = Number(args.includes('--top') ? args[args.indexOf('--top') + 1] : 10);
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDT_DEPLOY = 4634748;
const USDC_DEPLOY = 6082465;
/** keccak-256 of the event signatures, read with web3_sha3 on 2026-10-02. */
const T = {
  issue: '0xcb8241adb0c3fdb35b70c24ce35c5eb0c17af7431c99f827d44a445ca624176a',
  redeem: '0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44',
  destroyed: '0x61e6e66b0d6339b2980aecc6ccc0039736791f0ccde9ed512e789a7fbdd698c6',
  minterConfigured: '0x46980fca912ef9bcdbd36877427b6b90e860769f604e89c0e67720cece530d20',
  mint: '0xab8530f87dc9b59234c4623bf917212bb2536d647574c8e7e5da92c2ede0c9f8',
  burn: '0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5',
};
/** Endpoints that serve full history to filtered eth_getLogs (HANDOFF section 5). Tenderly took 2,000,000-block spans
 *  when the result was small (measured 2026-10-02: every USDT Issue event since launch in 11 requests); a large result
 *  answers "more than 20000 results", which halves the span. MEV Blocker caps at 10,000 blocks. */
const ENDPOINTS = [{url: 'https://mainnet.gateway.tenderly.co', maxSpan: 2000000}, {url: 'https://rpc.mevblocker.io', maxSpan: 10000}];
const MAX_SPAN = Math.max(...ENDPOINTS.map((e) => e.maxSpan));
const hex = (n) => `0x${n.toString(16)}`;
const pad = (a) => `0x${'0'.repeat(24)}${a.slice(2).toLowerCase()}`;
const addr = (topic) => `0x${topic.slice(26)}`;
let requests = 0;

/* Error classes copied from scripts/registry/measure-dormancy.mjs (importing that script would run it). */
const TRANSIENT = /HTTP 429|rate.?limit|too many requests|fetch failed|timeout|aborted|HTTP 5\d\d|capacity|overloaded|busy|try again/i;
const TOO_BIG = /range|too large|too many results|more than \d+ results|exceed|limit.*block|block.*limit|response.*(large|big)|max.*results|payload|413|entity too/i;

async function call(method, params, span = 0) {
  let last;
  for (const ep of ENDPOINTS) {
    if (span > ep.maxSpan) continue;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        requests += 1;
        return await rpc(ep.url, method, params, 45000);
      } catch (e) {
        last = e;
        if (span > 0 && TOO_BIG.test(e.message)) throw Object.assign(new Error(e.message), {tooBig: true});
        await sleep((TRANSIENT.test(e.message) ? 1500 : 2500) * (attempt + 1));
      }
    }
  }
  throw last ?? new Error(`no endpoint serves a span of ${span} blocks`);
}

/** Every log matching `filter` from `from` to `to`, read completely: the span halves on "too big" and grows back. */
async function logsOver(filter, from, to, startSpan = 50000) {
  const out = [];
  let span = Math.min(startSpan, MAX_SPAN);
  let cursor = from;
  while (cursor <= to) {
    const end = Math.min(to, cursor + span - 1);
    try {
      const logs = await call('eth_getLogs', [{...filter, fromBlock: hex(cursor), toBlock: hex(end)}], end - cursor + 1);
      out.push(...logs);
      cursor = end + 1;
      if (logs.length < 4000) span = Math.min(MAX_SPAN, span * 2);
    } catch (e) {
      if (e.tooBig && span > 50) {
        span = Math.max(50, Math.floor(span / 2));
        continue;
      }
      throw e;
    }
    await sleep(250);
  }
  return out.filter((l) => !l.removed);
}

const blockTimes = new Map();
async function timeOf(block) {
  if (!blockTimes.has(block)) blockTimes.set(block, parseInt((await call('eth_getBlockByNumber', [hex(block), false])).timestamp, 16) * 1000);
  return blockTimes.get(block);
}
async function blockAt(ms, head) {
  let lo = 1;
  let hi = head;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await timeOf(mid)) < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
async function senderOf(txid) {
  const tx = await call('eth_getTransactionByHash', [txid]);
  return tx ? tx.from.toLowerCase() : null;
}
const priceCache = new Map();
async function valued(asset, units, ms) {
  const key = `${asset}@${ms}`;
  if (!priceCache.has(key)) priceCache.set(key, await candleAt(asset, ms));
  const c = priceCache.get(key);
  return c.none ? {usd: null, price: null} : {usd: Number(units) * c.close, price: {source: c.source, pair: c.pair, granularity: c.granularity, close: c.close}};
}
const tags = new Map();
async function tagOf(address) {
  if (!tags.has(address)) {
    try {
      tags.set(address, await readTag('etherscan.io', address));
    } catch (e) {
      tags.set(address, {tag: null, compilation: null, reports: [], alerts: [], error: e.message});
    }
    await sleep(PAUSE_MS);
  }
  return tags.get(address);
}
async function measure(name, fn) {
  const before = requests;
  try {
    const t = await fn();
    console.log(`${name}: complete, ${requests - before} requests`);
    return {complete: true, requests: requests - before, ...t};
  } catch (e) {
    console.log(`${name}: NOT MEASURED (${e.message})`);
    return {complete: false, requests: requests - before, error: e.message};
  }
}

const config = JSON.parse(readFileSync(join(ROOT, CONFIG_FILE), 'utf8'));
const startMs = Date.parse(`${config.recent.start}T00:00:00Z`);
const endMs = Date.parse(`${config.recent.end}T23:59:59Z`);
const head = parseInt(await call('eth_blockNumber', []), 16) - 64;
const fromBlock = await blockAt(startMs, head);
const toBlock = (await blockAt(endMs + 1000, head)) - 1;
console.log(`window ${config.recent.start} to ${config.recent.end}: blocks ${fromBlock} to ${toBlock}`);

/* ---------------------------------------------------------------- USDT supply */
const usdt = await measure('usdt', async () => {
  const logs = await logsOver({address: USDT, topics: [[T.issue, T.redeem, T.destroyed]]}, fromBlock, toBlock);
  const events = [];
  for (const l of logs) {
    const type = l.topics[0] === T.issue ? 'Issue' : l.topics[0] === T.redeem ? 'Redeem' : 'DestroyedBlackFunds';
    const data = l.data.slice(2);
    const units = BigInt(`0x${type === 'DestroyedBlackFunds' ? data.slice(64, 128) : data.slice(0, 64)}`).toString();
    events.push({type, units, block: parseInt(l.blockNumber, 16), txid: l.transactionHash, holder: type === 'DestroyedBlackFunds' ? `0x${data.slice(24, 64)}` : null});
  }
  events.sort((a, b) => Number(BigInt(b.units) - BigInt(a.units)));
  const supply = events.filter((e) => e.type !== 'DestroyedBlackFunds');
  const destroyed = events.filter((e) => e.type === 'DestroyedBlackFunds');
  const shown = [...supply, ...destroyed.slice(0, TOP)];
  for (const e of shown) {
    e.time = await timeOf(e.block);
    e.amount = unitsToDecimal(e.units, 6);
    Object.assign(e, await valued('USDT', e.amount, e.time));
    if (e.type !== 'DestroyedBlackFunds') {
      e.caller = await senderOf(e.txid);
      e.callerTag = await tagOf(e.caller);
    }
  }
  // The whole history, for the supply chart: every Issue and Redeem since the contract was deployed.
  const all = await logsOver({address: USDT, topics: [[T.issue, T.redeem]]}, USDT_DEPLOY, toBlock, 2000000);
  const history = [];
  for (const l of all) history.push({type: l.topics[0] === T.issue ? 'Issue' : 'Redeem', amount: unitsToDecimal(BigInt(`0x${l.data.slice(2, 66)}`).toString(), 6), block: parseInt(l.blockNumber, 16), time: await timeOf(parseInt(l.blockNumber, 16))});
  return {events: shown, counts: {issue: supply.filter((e) => e.type === 'Issue').length, redeem: supply.filter((e) => e.type === 'Redeem').length, destroyed: destroyed.length}, history};
});

/* ---------------------------------------------------------------- USDC supply */
const usdc = await measure('usdc', async () => {
  const configured = await logsOver({address: USDC, topics: [T.minterConfigured]}, USDC_DEPLOY, toBlock, 2000000);
  const minters = [...new Set(configured.map((l) => addr(l.topics[1])))];
  // Every configured minter is tagged first, so the cross-chain (CCTP) minters, which mint tens of thousands of small
  // bridge amounts, can be left out of the read itself. An untagged minter is kept, not assumed to be a bridge.
  const kinds = {};
  for (const m of minters) {
    const t = await tagOf(m);
    kinds[m] = {tag: t.tag, compilation: t.compilation, reports: t.reports, bridge: !!(t.tag && /^Circle(?: CCTP)?: Token Minter/.test(t.tag))};
  }
  const own = minters.filter((m) => !kinds[m].bridge);
  const mintLogs = await logsOver({address: USDC, topics: [T.mint, own.map(pad)]}, fromBlock, toBlock, 20000);
  const burnLogs = await logsOver({address: USDC, topics: [T.burn, own.map(pad)]}, fromBlock, toBlock, 20000);
  const decode = (l, kind) => ({kind, minter: addr(l.topics[1]), to: kind === 'Mint' ? addr(l.topics[2]) : null, units: BigInt(l.data).toString(), block: parseInt(l.blockNumber, 16), txid: l.transactionHash});
  const all = [...mintLogs.map((l) => decode(l, 'Mint')), ...burnLogs.map((l) => decode(l, 'Burn'))];
  const ranked = [...all].sort((a, b) => Number(BigInt(b.units) - BigInt(a.units)));
  const shown = [...ranked.filter((e) => e.kind === 'Mint').slice(0, TOP), ...ranked.filter((e) => e.kind === 'Burn').slice(0, TOP)];
  for (const e of shown) {
    e.time = await timeOf(e.block);
    e.amount = unitsToDecimal(e.units, 6);
    Object.assign(e, await valued('USDC', e.amount, e.time));
  }
  return {minters: kinds, mintersConfigured: minters.length, bridgeMinters: minters.filter((m) => kinds[m].bridge), events: shown, counts: {mints: mintLogs.length, burns: burnLogs.length}};
});

/* ---------------------------------------------------------------- transfers between registry wallets */
const transfers = await measure('transfers', async () => {
  const atlas = loadAtlas();
  const ka = atlas['known-addresses'];
  const ke = atlas['known-entities'];
  const keys = Object.keys(ka.ADDRESSES).filter((k) => k.startsWith('Ethereum:'));
  const list = keys.map((k) => k.slice('Ethereum:'.length));
  if (list.length > 1000) throw new Error(`${list.length} registry wallets exceed one topic position's cap of 1,000`);
  const logs = await logsOver({address: [USDT, USDC], topics: [TRANSFER, list.map(pad), list.map(pad)]}, fromBlock, toBlock, 10000);
  const entityOf = (a) => {
    const at = ke.knownAttribution('Ethereum', a);
    return at ? {id: at.addressCluster, name: at.entity, jurisdiction: at.jurisdiction} : null;
  };
  const decoded = logs.map((l) => {
    const token = l.address.toLowerCase() === USDT ? 'USDT' : 'USDC';
    const from = addr(l.topics[1]);
    const to = addr(l.topics[2]);
    return {asset: token, units: BigInt(l.data).toString(), from, to, fromEntity: entityOf(from), toEntity: entityOf(to), block: parseInt(l.blockNumber, 16), txid: l.transactionHash};
  }).filter((x) => x.units !== '0');
  decoded.sort((a, b) => Number(BigInt(b.units) - BigInt(a.units)));
  const internal = (x) => x.fromEntity && x.toEntity && x.fromEntity.id === x.toEntity.id;
  const top20 = decoded.slice(0, 20);
  const cross = decoded.filter((x) => !internal(x)).slice(0, TOP);
  for (const x of cross) {
    x.time = await timeOf(x.block);
    x.amount = unitsToDecimal(x.units, 6);
    Object.assign(x, await valued(x.asset, x.amount, x.time));
    for (const side of ['from', 'to']) {
      const key = `Ethereum:${x[side]}`;
      const row = ka.ADDRESSES[key];
      x[`${side}Registry`] = row ? {label: row.label, checked: row.checked} : null;
      x[`${side}Tag`] = await tagOf(x[side]);
    }
  }
  return {wallets: list.length, logs: decoded.length, cross, internalShareTop20: top20.filter(internal).length / Math.max(1, top20.length), top20Internal: top20.filter(internal).length};
});

const out = {
  measuredAt: new Date().toISOString().slice(0, 10),
  asOf: new Date().toISOString(),
  script: 'scripts/landmarks/measure-largest.mjs',
  window: {start: config.recent.start, end: config.recent.end, fromBlock, toBlock},
  requests,
  tables: {usdt, usdc, transfers},
};
writeFileSync(join(ROOT, MEASURED_FILE), `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${MEASURED_FILE} (${requests} requests)`);
