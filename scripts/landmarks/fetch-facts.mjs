/**
 * Reads everything the Landmarks entries claim, from the chains and the sources themselves, into
 * scripts/landmarks/chain-facts.json. Network, cached: an entry already read is not read again unless --refresh.
 * Nothing here decides anything; scripts/landmarks/build.mjs checks the facts against the entries.
 *
 *   node scripts/landmarks/fetch-facts.mjs [--refresh] [--only <entry-id>]
 *
 * Per leg: the transaction from every operator that serves it (two for Bitcoin and Ethereum), finality, the trace and
 * balance readings an EVM leg's basis needs, the traded price candle containing the block time, and historical supply
 * for stablecoins. Per match: a complete read of the stated window, recording how many transactions match. Per source:
 * the archived document, searched for every transaction id, address and quote the entry claims it contains.
 * Also: spot prices (the field's reference axis) and the protocol milestones drawn on the time axis.
 */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {rpc as rpcCall} from '../rpc-pool.mjs';
import {join} from 'node:path';
import {ROOT, FACTS_FILE, TOKENS, loadInputs} from './build.mjs';
import {ESPLORA, EVM, esploraTx, esploraTip, esploraHash, esploraBlock, esploraBlockTxs, esploraAddressTxs, heightAtOrBefore, evmRead, evmTrace, evmBalance, evmCall, evmFinalized, evmBlockTime, evmBatch, endpointName, candleAt, spotPrices, sourceText, normalise, getJson, sleep} from './readers.mjs';

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const file = join(ROOT, FACTS_FILE);
const facts = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
for (const k of ['txs', 'prices', 'supply', 'matches', 'sources', 'balances']) facts[k] ??= {};
facts.milestones ??= [];
const now = () => new Date().toISOString();
const log = (...m) => console.log(...m);

const {entries} = loadInputs(ROOT);
const selected = entries.filter((e) => !only || e.meta.id === only);
/** Per archived copy, every transaction id, address and quote any entry claims it contains. */
const WANT = new Map();
for (const {meta} of entries) {
  for (const s of meta.sources || []) {
    const w = WANT.get(s.archive) || {claims: new Set(), quotes: new Set()};
    for (const x of [...(s.txids || []), ...(s.addresses || [])]) w.claims.add(x.toLowerCase());
    if (s.quote) w.quotes.add(s.quote);
    WANT.set(s.archive, w);
  }
}
if (only && !selected.length) {
  console.error(`no entry ${only}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ transactions */

/** The longest printable run among a coinbase script's data pushes (the genesis block's newspaper headline). */
function coinbaseText(scriptHex) {
  const b = Buffer.from(scriptHex || '', 'hex');
  const pushes = [];
  for (let i = 0; i < b.length;) {
    const op = b[i];
    let len = 0;
    let at = i + 1;
    if (op >= 1 && op <= 75) len = op;
    else if (op === 76) {
      len = b[i + 1];
      at = i + 2;
    } else {
      i += 1;
      continue;
    }
    pushes.push(b.subarray(at, at + len));
    i = at + len;
  }
  const texts = pushes.map((p) => p.toString('latin1')).filter((s) => s.length >= 12 && /^[\x20-\x7e]+$/.test(s));
  return texts.sort((x, y) => y.length - x.length)[0] || null;
}

async function readBitcoinLike(chain, txid) {
  const readings = [];
  for (const {name, base} of ESPLORA[chain]) {
    try {
      const tx = await esploraTx(base, txid);
      const tip = await esploraTip(base);
      if (!tx.status || !tx.status.confirmed) {
        log(`  ${name}: not confirmed yet`);
        continue;
      }
      readings.push({
        source: name, read: now(), block: tx.status.block_height, time: tx.status.block_time * 1000, confirmations: tip - tx.status.block_height + 1,
        fee: String(tx.fee ?? 0), coinbase: !!(tx.vin[0] && tx.vin[0].is_coinbase), coinbaseText: tx.vin[0] && tx.vin[0].is_coinbase ? coinbaseText(tx.vin[0].scriptsig) : null,
        vin: tx.vin.map((v) => ({address: v.prevout ? v.prevout.scriptpubkey_address || null : null, value: v.prevout && v.prevout.value != null ? String(v.prevout.value) : null})),
        vout: tx.vout.map((o) => ({address: o.scriptpubkey_address || null, value: o.value != null ? String(o.value) : null})),
      });
    } catch (e) {
      log(`  ${name}: ${e.message}`);
    }
  }
  const out = {readings, read: now()};
  // How long the spent coins had sat still: the funding blocks of the inputs. At most 25 funding transactions are
  // looked up; `complete` says whether that covered every one, and coin age is only stated when it did.
  if (readings.length && !readings[0].coinbase) {
    const tx = await esploraTx(ESPLORA[chain][0].base, txid);
    const ids = [...new Set(tx.vin.map((v) => v.txid))];
    const funding = [];
    for (const id of ids.slice(0, 25)) {
      const f = await esploraTx(ESPLORA[chain][0].base, id);
      if (f.status && f.status.confirmed) funding.push({height: f.status.block_height, time: f.status.block_time * 1000});
    }
    if (funding.length) {
      funding.sort((a, b) => a.time - b.time);
      out.funding = {source: ESPLORA[chain][0].name, inputs: tx.vin.length, fundingTxs: ids.length, fundingRead: funding.length, complete: funding.length === ids.length, oldest: funding[0], newest: funding[funding.length - 1]};
    }
  }
  return out;
}

async function readEvm(chain, leg) {
  const cfg = EVM[chain];
  const readings = [];
  for (const url of cfg.endpoints) {
    try {
      const r = await evmRead(url, leg.txid);
      if (!r) {
        log(`  ${endpointName(url)}: transaction not found`);
        continue;
      }
      r.finalized = r.block <= (await evmFinalized(url));
      readings.push(r);
    } catch (e) {
      log(`  ${endpointName(url)}: ${e.message}`);
    }
    await sleep(300);
  }
  const out = {readings, read: now()};
  if (!readings.length) return out;
  const block = readings[0].block;
  const needsTrace = leg.basis === 'trace' || (leg.check && leg.check.trace);
  if (needsTrace) {
    try {
      out.trace = {source: endpointName(cfg.trace), calls: await evmTrace(cfg.trace, leg.txid)};
    } catch (e) {
      log(`  trace: ${e.message}`);
    }
  }
  const deltaOf = leg.basis === 'balance-delta' ? leg.trace && leg.trace.from : leg.check && leg.check.balanceDelta;
  if (deltaOf) {
    out.balances = {[deltaOf]: []};
    for (const url of cfg.endpoints) {
      try {
        out.balances[deltaOf].push({source: endpointName(url), before: await evmBalance(url, deltaOf, block - 1), after: await evmBalance(url, deltaOf, block)});
      } catch (e) {
        log(`  balance on ${endpointName(url)}: ${e.message}`);
      }
      await sleep(300);
    }
  }
  return out;
}

const assetOfLeg = (leg) => leg.asset;

for (const {meta: e} of selected) {
  log(`${e.id}`);
  for (const leg of e.legs || []) {
    const key = `${leg.chain}:${leg.txid}`;
    if (!facts.txs[key] || refresh) {
      log(`  reading ${key}`);
      facts.txs[key] = ESPLORA[leg.chain] ? await readBitcoinLike(leg.chain, leg.txid) : EVM[leg.chain] ? await readEvm(leg.chain, leg) : {readings: [], read: now(), error: `no reader for ${leg.chain}`};
    }
    const r = facts.txs[key].readings[0];
    if (!r) continue;
    const pkey = `${assetOfLeg(leg)}@${r.time}`;
    if (!facts.prices[pkey] || refresh) {
      log(`  price ${pkey}`);
      facts.prices[pkey] = await candleAt(assetOfLeg(leg), r.time);
    }
    // A token transfer on Ethereum pays its fee in ETH: price that too, so the fee has a dollar value.
    const fkey = `ETH@${r.time}`;
    if (EVM[leg.chain] && leg.asset !== 'ETH' && (!facts.prices[fkey] || refresh)) {
      log(`  fee price ${fkey}`);
      facts.prices[fkey] = await candleAt('ETH', r.time);
    }
    const token = Object.entries(TOKENS).find(([, t]) => t.asset === leg.asset);
    if (token && leg.chain === 'Ethereum') {
      const skey = `${leg.asset}@${r.block}`;
      if (!facts.supply[skey] || refresh) {
        facts.supply[skey] = [];
        for (const url of EVM.Ethereum.endpoints) {
          try {
            facts.supply[skey].push({source: endpointName(url), value: BigInt(await evmCall(url, token[0], '0x18160ddd', r.block)).toString()});
          } catch (err) {
            log(`  supply on ${endpointName(url)}: ${err.message}`);
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- balance reads (an address at stated blocks) */
  for (const b of e.balances || []) {
    for (const block of b.blocks || []) {
      const key = `${b.chain}:${String(b.address).toLowerCase()}@${block}`;
      if (facts.balances[key] && !refresh) continue;
      log(`  balance ${key}`);
      const readings = [];
      for (const url of EVM[b.chain] ? EVM[b.chain].endpoints : []) {
        try {
          readings.push({source: endpointName(url), value: await evmBalance(url, b.address, block), time: await evmBlockTime(url, block)});
        } catch (err) {
          log(`    ${endpointName(url)}: ${err.message}`);
        }
        await sleep(300);
      }
      facts.balances[key] = {readings, read: now()};
    }
  }

  /* ---------------------------------------------------------------- match proofs (complete reads) */
  for (const m of e.matches || []) {
    const key = `${e.id}/${m.id}`;
    const params = JSON.stringify({type: m.type, window: m.window, value: m.value, height: m.height, through: m.through, address: m.address, contract: m.contract, topic: m.topic, fromBlock: m.fromBlock, toBlock: m.toBlock});
    if (facts.matches[key] && facts.matches[key].params === params && !refresh) continue;
    log(`  proof ${key} (${m.type})`);
    facts.matches[key] = {params, ...(await runMatch(m)), read: now()};
    log(`    ${facts.matches[key].count} match(es) in ${facts.matches[key].txsRead} transactions over ${facts.matches[key].blocksRead} blocks`);
  }

  /* ---------------------------------------------------------------- source documents */
  for (const s of e.sources || []) {
    // Several stories can cite one archived copy: its record answers for every claim and quote any of them makes.
    const w = WANT.get(s.archive);
    const claims = [...w.claims].sort();
    const quotes = [...w.quotes].sort();
    if (!claims.length && !quotes.length) continue;
    const prev = facts.sources[s.archive];
    const want = JSON.stringify({claims, quotes});
    if (prev && prev.want === want && prev.ok && !refresh) continue;
    log(`  source [${s.n}] ${s.archive}`);
    try {
      const doc = await sourceText(s.archive);
      const raw = doc.raw.toLowerCase();
      // A quote is matched against the readable text and, for pages that carry their content as data or metadata
      // (GitHub's code view, an X post, an announcement rendered by script), against the raw document as well.
      const text = normalise(doc.text);
      const rawText = normalise(doc.raw);
      const found = (q) => text.includes(normalise(q)) || rawText.includes(normalise(q));
      facts.sources[s.archive] = {want, ok: true, read: now(), found: claims.filter((c) => raw.includes(c)), quotes: Object.fromEntries(quotes.map((q) => [q, found(q)]))};
      const missing = claims.filter((c) => !raw.includes(c));
      if (missing.length) log(`    NOT FOUND: ${missing.join(', ')}`);
      for (const q of quotes) if (!facts.sources[s.archive].quotes[q]) log(`    QUOTE NOT FOUND: ${q}`);
    } catch (err) {
      facts.sources[s.archive] = {want, ok: false, read: now(), error: err.message, found: [], quotes: Object.fromEntries(quotes.map((q) => [q, false]))};
      log(`    could not read: ${err.message}`);
    }
    await sleep(800);
  }
}

/** Complete reads that prove a description identifies exactly one transaction (decision D7, matched tier). */
async function runMatch(m) {
  const base = ESPLORA.Bitcoin[0].base;
  if (m.type === 'btc-output-value') {
    // Every block from the newest at or before the window's start to the first after its end: a superset of the window.
    const sats = BigInt(Math.round(Number(m.value) * 1e8)).toString();
    const h0 = await heightAtOrBefore(Math.floor(Date.parse(m.window.from) / 1000));
    const h1 = (await heightAtOrBefore(Math.floor(Date.parse(m.window.to) / 1000))) + 1;
    let blocksRead = 0;
    let txsRead = 0;
    const found = [];
    for (let top = h1; top >= h0; top -= 15) {
      const summaries = await getJson(`https://mempool.space/api/v1/blocks/${top}`);
      await sleep(250);
      for (const b of summaries) {
        if (b.height < h0 || b.height > h1) continue;
        blocksRead += 1;
        txsRead += b.tx_count;
        // A block whose only transaction is the coinbase holds no transfer: its outputs are new issuance, at most the
        // subsidy plus fees, so it is counted from the summary rather than fetched.
        if (b.tx_count < 2) continue;
        for (let start = 0; start < b.tx_count; start += 25) {
          const txs = await esploraBlockTxs(base, b.id, start);
          for (const tx of txs) if (!(tx.vin[0] && tx.vin[0].is_coinbase) && tx.vout.some((o) => String(o.value) === sats)) found.push(tx.txid);
        }
      }
    }
    return {type: m.type, source: 'mempool.space', window: m.window, heights: [h0, h1], blocksRead, txsRead, matches: found, count: found.length, complete: blocksRead === h1 - h0 + 1};
  }
  if (m.type === 'btc-first-transfer') {
    // Blocks 0..through, oldest first: every transaction that is not a coinbase, in the first block holding any. A
    // block whose only transaction is its coinbase is counted from its summary (15 summaries per request).
    let blocksRead = 0;
    let txsRead = 0;
    let found = [];
    for (let top = 14; top - 14 <= m.through && !found.length; top += 15) {
      const summaries = (await getJson(`https://mempool.space/api/v1/blocks/${Math.min(top, m.through)}`)).filter((b) => b.height <= m.through).sort((a, b) => a.height - b.height);
      await sleep(250);
      for (const b of summaries) {
        if (b.height < top - 14) continue;
        blocksRead += 1;
        txsRead += b.tx_count;
        if (b.tx_count < 2) continue;
        found = (await esploraBlockTxs(base, b.id, 0)).filter((tx) => !(tx.vin[0] && tx.vin[0].is_coinbase)).map((tx) => tx.txid);
        if (found.length) break;
      }
    }
    return {type: m.type, source: 'mempool.space', window: {from: '2009-01-03T00:00:00Z', to: null}, heights: [0, m.through], blocksRead, txsRead, matches: found, count: found.length, complete: blocksRead > 0};
  }
  if (m.type === 'btc-address-spend') {
    // Every confirmed transaction of the address, then those in the window that spend from it.
    const {txs, complete} = await esploraAddressTxs(base, m.address);
    const from = Date.parse(m.window.from) / 1000;
    const to = Date.parse(m.window.to) / 1000;
    const inWindow = txs.filter((tx) => tx.status && tx.status.block_time >= from && tx.status.block_time <= to);
    const spends = inWindow.filter((tx) => tx.vin.some((v) => v.prevout && v.prevout.scriptpubkey_address === m.address)).map((tx) => tx.txid);
    const heights = txs.map((tx) => tx.status.block_height);
    return {type: m.type, source: 'mempool.space', window: m.window, address: m.address, heights: [Math.min(...heights), Math.max(...heights)], blocksRead: new Set(heights).size, txsRead: txs.length, matches: spends, count: spends.length, complete};
  }
  if (m.type === 'btc-coinbase') {
    const hash = await esploraHash(base, m.height);
    const txs = await esploraBlockTxs(base, hash, 0);
    const cb = txs.filter((tx) => tx.vin[0] && tx.vin[0].is_coinbase).map((tx) => tx.txid);
    return {type: m.type, source: 'mempool.space', window: {from: null, to: null}, heights: [m.height, m.height], blocksRead: 1, txsRead: txs.length, matches: cb, count: cb.length, complete: true};
  }
  if (m.type === 'evm-event-scan') {
    // Every log of one event from one contract over a block range: a complete set, not a single match.
    const url = EVM[m.chain || 'Ethereum'].endpoints[0];
    const found = [];
    let blocksRead = 0;
    let span = 200000;
    for (let a = m.fromBlock; a <= m.toBlock;) {
      const b = Math.min(m.toBlock, a + span - 1);
      try {
        const logs = await rpcCall(url, 'eth_getLogs', [{address: m.contract, topics: [m.topic], fromBlock: `0x${a.toString(16)}`, toBlock: `0x${b.toString(16)}`}]);
        found.push(...logs.filter((l) => !l.removed).map((l) => l.transactionHash.toLowerCase()));
        blocksRead += b - a + 1;
        a = b + 1;
      } catch (e) {
        if (span <= 1000) throw e;
        span = Math.floor(span / 2);
      }
      await sleep(300);
    }
    const unique = [...new Set(found)];
    return {type: m.type, source: endpointName(url), window: m.window || null, heights: [m.fromBlock, m.toBlock], blocksRead, txsRead: found.length, matches: unique, count: unique.length, complete: blocksRead === m.toBlock - m.fromBlock + 1};
  }
  if (m.type === 'evm-first-tx') {
    // Every block header from the genesis block, oldest first, 100 per batch, with its transaction list. A transfer
    // needs at least 21,000 gas, so a block whose gas limit is lower cannot hold one: the read records the highest
    // limit before the first transaction, and checks each step against the protocol's rule that the limit moves by
    // less than 1/1024 per block (an operator returning stale or invented headers would break it). A missing block
    // fails the read; it is never taken as empty. The blocks from the first that could hold a transaction to the
    // first that does are then re-read on a second operator.
    const cfg = EVM[m.chain || 'Ethereum'];
    const url = cfg.batch;
    let blocksRead = 0;
    let first = null;
    let txs = [];
    let maxGasBefore = 0;
    let firstAtGas = null;
    let prevGas = null;
    let boundHeld = true;
    let genesisGas = null;
    for (let a = 0; a <= m.through && first === null; a += 100) {
      const b = Math.min(m.through, a + 99);
      const heights = Array.from({length: b - a + 1}, (_, i) => a + i);
      const blocks = await evmBatch(url, heights.map((n) => ['eth_getBlockByNumber', [`0x${n.toString(16)}`, false]]));
      for (let i = 0; i < heights.length; i += 1) {
        const blk = blocks[i];
        if (!blk) throw new Error(`block ${heights[i]} is missing on ${endpointName(url)}`);
        const gas = parseInt(blk.gasLimit, 16);
        if (heights[i] === 0) genesisGas = gas;
        if (prevGas !== null && Math.abs(gas - prevGas) > Math.floor(prevGas / 1024)) boundHeld = false;
        prevGas = gas;
        blocksRead += 1;
        if (firstAtGas === null && gas >= 21000) firstAtGas = heights[i];
        if (blk.transactions.length) {
          first = heights[i];
          txs = blk.transactions.map((x) => x.toLowerCase());
          break;
        }
        maxGasBefore = Math.max(maxGasBefore, gas);
      }
      await sleep(250);
    }
    let agree = first !== null;
    for (let n = firstAtGas ?? first ?? 0; first !== null && n <= first; n += 1) {
      const other = await rpcCall(cfg.endpoints[0], 'eth_getBlockByNumber', [`0x${n.toString(16)}`, false]);
      if (!other || JSON.stringify(other.transactions.map((x) => x.toLowerCase())) !== JSON.stringify(n === first ? txs : [])) agree = false;
      await sleep(300);
    }
    return {type: m.type, source: `${endpointName(url)}, checked on ${endpointName(cfg.endpoints[0])}`, window: {from: null, to: null}, heights: [0, first ?? m.through], blocksRead, txsRead: txs.length, firstBlock: first, genesisGas, maxGasBefore, firstBlockAtGas: firstAtGas, gasBoundHeld: boundHeld, secondOperatorAgrees: agree, matches: txs, count: txs.length, complete: first !== null && blocksRead === first + 1 && boundHeld && agree};
  }
  throw new Error(`unknown match type ${m.type}`);
}

/* ------------------------------------------------------------------ milestones and reference prices */

if (!facts.milestones.length || refresh) {
  log('milestones');
  const base = ESPLORA.Bitcoin[0].base;
  const tip = await esploraTip(base);
  const out = [];
  for (let h = 210000; h <= tip; h += 210000) out.push({label: 'Halving', chain: 'Bitcoin', height: h, t: (await esploraBlock(base, await esploraHash(base, h))).timestamp * 1000});
  out.push({label: 'The Merge', chain: 'Ethereum', height: 15537394, t: await evmBlockTime(EVM.Ethereum.endpoints[0], 15537394)});
  facts.milestones = out;
}
try {
  facts.refPrices = await spotPrices();
} catch (e) {
  log(`spot prices: ${e.message} (the previous reference is kept)`);
}

facts.fetchedAt = now();
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
writeFileSync(file, `${JSON.stringify({fetchedAt: facts.fetchedAt, refPrices: facts.refPrices ?? null, milestones: facts.milestones, txs: sorted(facts.txs), prices: sorted(facts.prices), supply: sorted(facts.supply), balances: sorted(facts.balances), matches: sorted(facts.matches), sources: sorted(facts.sources)}, null, 1)}\n`);
log(`wrote ${FACTS_FILE}`);
