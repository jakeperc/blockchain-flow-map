/**
 * The Landmarks model: curated entries + chain facts + our own scans, joined and checked. Pure (no network), so the
 * generator (gen-landmarks.mjs), the static page (html.mjs), the Vite plugin and the gate (verify-landmarks.mjs) all
 * see the same model and the same errors.
 *
 * Inputs (scripts/landmarks/):
 *   entries/<id>.md     a ```json block (facts about the entry), then four prose sections
 *   chain-facts.json    what fetch-facts.mjs read: transactions from every source, candles, supply, match proofs,
 *                       source-document checks, protocol milestones
 *   measured.json       what measure-largest.mjs found (optional until the first scan)
 *   config.json         the fixed recent window
 *
 * Every rule below is decision D7 or a red-team finding from the approved plan (HANDOFF section 19). An error stops the
 * build; a warning is printed.
 */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHAIN_INFO, SINGLE_SOURCE_CHAINS} from '../../lib/landmarks/chains.ts';
import {amount as fmtAmount, groupDecimal, usd as fmtUsd, dateUTC, timeUTC, percent, isoDate} from '../../lib/landmarks/format.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ENTRIES_DIR = 'scripts/landmarks/entries';
export const FACTS_FILE = 'scripts/landmarks/chain-facts.json';
export const MEASURED_FILE = 'scripts/landmarks/measured.json';
export const CONFIG_FILE = 'scripts/landmarks/config.json';
export const STALE_DAYS = 45;
export const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const CATEGORY_GROUP = {milestone: 'milestone', record: 'milestone', fee: 'milestone', supply: 'milestone', dormant: 'milestone', theft: 'theft', seizure: 'seizure'};
const CATEGORY_LABEL = {milestone: 'Milestone', record: 'Record', fee: 'Fee', supply: 'Stablecoin supply', dormant: 'Dormant coins', theft: 'Theft', seizure: 'Seizure'};
const BASES = ['btc-output', 'coinbase', 'tx-value', 'erc20-log', 'token-event', 'trace', 'balance-delta'];
const DOC_TYPES = ['court', 'government', 'party'];
const SOURCE_KINDS = ['document', 'reporting', 'data'];
export const SECTION_TITLES = {happened: 'What happened', chain: 'What the chain shows', matters: 'Why it matters', next: 'What happened next'};
/** Token contracts this page decodes, from the issuers' own lists (the same contracts lib/atlas/evm.ts reads). */
export const TOKENS = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {asset: 'USDC', decimals: 6},
  '0xdac17f958d2ee523a2206206994597c13d831ec7': {asset: 'USDT', decimals: 6},
};
const DECIMALS = {BTC: 8, 'L-BTC': 8, ETH: 18, USDC: 6, USDT: 6};
const SUPERLATIVE = /\b(largest|biggest|first|earliest|highest|lowest|oldest|smallest|record-breaking|all-time high)\b/i;
/** Ethereum's Byzantium fork, from which receipts carry a status field (EIP-658). */
const BYZANTIUM_BLOCK = 4370000;
/** An explorer banner that credits a tag to someone other than the explorer (decision D7). */
export const THIRD_PARTY = /tagged based on|report|submitted by/i;
const PLACEHOLDER = /\{\{([A-Za-z0-9_.]+)\}\}/g;
const MARKER = /\[(\d+|m\d+)\]/g;
/** Words with digits that are names, not figures. */
const NAMED_DIGITS = /\b(?:ERC-20|ERC20|L1|L2|0x[0-9a-fA-F]{6,})\b/g;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ loading */

export function parseEntry(text, file) {
  const t = text.replace(/\r\n/g, '\n');
  const m = t.match(/^```json\n([\s\S]*?)\n```\n/);
  if (!m) throw new Error(`${file}: an entry must open with a \`\`\`json block`);
  let meta;
  try {
    meta = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`${file}: the json block does not parse (${e.message})`);
  }
  const keys = Object.fromEntries(Object.entries(SECTION_TITLES).map(([k, v]) => [v, k]));
  const sections = {};
  let cur = null;
  for (const line of t.slice(m[0].length).split('\n')) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      cur = keys[h[1].trim()];
      if (!cur) throw new Error(`${file}: unknown section "${h[1].trim()}"; use ${Object.values(SECTION_TITLES).join(', ')}`);
      sections[cur] = [];
      continue;
    }
    if (cur) sections[cur].push(line);
    else if (line.trim()) throw new Error(`${file}: text before the first section`);
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].join('\n').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return {file, meta, sections};
}

const readJson = (root, rel, fallback) => (existsSync(join(root, rel)) ? JSON.parse(readFileSync(join(root, rel), 'utf8')) : fallback);

export function loadInputs(root = ROOT) {
  const dir = join(root, ENTRIES_DIR);
  const entries = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => parseEntry(readFileSync(join(dir, f), 'utf8'), `${ENTRIES_DIR}/${f}`)) : [];
  return {
    entries,
    facts: readJson(root, FACTS_FILE, {txs: {}, prices: {}, supply: {}, matches: {}, sources: {}, milestones: []}),
    measured: readJson(root, MEASURED_FILE, null),
    config: readJson(root, CONFIG_FILE, null),
  };
}

/* ------------------------------------------------------------------ arithmetic */

/** Base units (integer string) to a decimal string with trailing zeros removed. */
export function unitsToDecimal(base, decimals) {
  const neg = base.startsWith('-');
  const digits = (neg ? base.slice(1) : base).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals).replace(/^0+(?=\d)/, '');
  const frac = decimals ? digits.slice(digits.length - decimals).replace(/0+$/, '') : '';
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** Exact sum of non-negative decimal strings. */
export function sumDecimal(values) {
  const frac = Math.max(0, ...values.map((v) => (String(v).split('.')[1] || '').length));
  const total = values.reduce((s, v) => {
    const [i, f = ''] = String(v).split('.');
    return s + BigInt(i + f.padEnd(frac, '0'));
  }, 0n);
  if (!frac) return total.toString();
  const digits = total.toString().padStart(frac + 1, '0');
  return `${digits.slice(0, -frac)}.${digits.slice(-frac)}`.replace(/\.?0+$/, '');
}

/** Bitcoin's scheduled issuance up to and including `height`, in BTC. A few early blocks claimed less, so this is "allowed by the schedule". */
export function scheduledBtc(height) {
  let total = 0;
  let subsidy = 50;
  for (let start = 0; start <= height; start += 210000) {
    total += subsidy * Math.min(210000, height - start + 1);
    subsidy /= 2;
  }
  return total;
}

/* ------------------------------------------------------------------ text rules */

const sentencesOf = (text) => text.split(/(?<=[.!?]["')\]]?)\s+(?=["'(A-Z0-9{[])/);
const hasMarker = (s) => /\[(\d+|m\d+)\]/.test(s);

/** Digits outside placeholders and markers need a source marker in the same sentence. Returns the offending sentences. */
export function typedNumbers(text) {
  return sentencesOf(text).filter((s) => /\d/.test(s.replace(PLACEHOLDER, '').replace(MARKER, '').replace(NAMED_DIGITS, '')) && !hasMarker(s));
}
/** A superlative needs a marker (a source or a match proof) in the same sentence. */
export function unsupportedSuperlatives(text) {
  return sentencesOf(text).filter((s) => SUPERLATIVE.test(s.replace(PLACEHOLDER, '')) && !hasMarker(s));
}
export const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/** Explorers whose only readable page (`/txs?a=`) shows the tag but not the banners that credit it, so a tag read there
 *  cannot be shown to credit no outside source (registry audit, HANDOFF section 20). */
const BANNERLESS_TAG_HOSTS = ['arbiscan.io', 'optimistic.etherscan.io'];

/** Why a tag cannot name anyone under D7, if it cannot: wrong explorer, no verbatim tag or read date, a host whose
 *  readable page hides the credit banners, or any third-party credit (a compilation, a report, or a submission through
 *  a curation service such as "Submitted by Kleros Curate"). */
export function tagEvidenceProblems(chain, ev) {
  const out = [];
  const info = CHAIN_INFO[chain];
  if (!info || info.tagHost !== ev.host) out.push(`a tag must come from ${info ? info.tagHost : 'the chain'}'s own explorer`);
  if (BANNERLESS_TAG_HOSTS.includes(ev.host)) out.push(`${ev.host} shows no credit banners on the page this project can read, so its tag cannot be shown to credit no outside source`);
  if (!ev.tag || !ISO.test(ev.read || '')) out.push('a tag needs the verbatim tag and its read date');
  if ((ev.alerts || []).some((x) => THIRD_PARTY.test(x))) out.push(`the explorer credits this tag to a third party (${ev.alerts.join(' | ')}), so it cannot name anyone`);
  return out;
}

/* ------------------------------------------------------------------ the model */

function legAmount(leg, chainFacts, push) {
  const r = chainFacts.readings || [];
  if (!r.length) return null;
  const evm = !!CHAIN_INFO[leg.chain] && !['Bitcoin', 'Liquid'].includes(leg.chain);
  if (!evm) {
    const out = (rd) => (leg.basis === 'coinbase' ? rd.vout[0] : rd.vout[leg.output]);
    const views = r.map((rd) => {
      const o = out(rd);
      // What the inputs held in total, and how much of it went straight back to an input address (change): a
      // transaction's total input is not what it paid.
      const ins = new Set(rd.vin.map((v) => v.address).filter(Boolean));
      const inputTotal = rd.coinbase || rd.vin.some((v) => v.value == null) ? null : rd.vin.reduce((s, v) => s + BigInt(v.value), 0n).toString();
      const changeBack = rd.vout.filter((x) => x.address && ins.has(x.address)).reduce((s, x) => s + BigInt(x.value), 0n).toString();
      return o ? {block: rd.block, time: rd.time, fee: rd.fee, amount: o.value, to: o.address || null, from: rd.coinbase ? null : rd.vin.map((v) => v.address).filter(Boolean), inputs: rd.vin.length, outputs: rd.vout.length, coinbaseText: rd.coinbaseText || null, inputTotal, changeBack} : null;
    });
    if (views.some((v) => !v)) return push(`output ${leg.output} does not exist`), null;
    const a = JSON.stringify(views[0]);
    if (views.some((v) => JSON.stringify(v) !== a)) push(`the ${r.length} readings disagree (${r.map((x) => x.source).join(', ')})`);
    if (r.some((rd) => !(rd.confirmations >= 6))) push('fewer than six confirmations: not final');
    const v = views[0];
    const from = v.from && v.from.length ? [...new Set(v.from)] : [];
    return {block: v.block, time: v.time, units: v.amount, decimals: DECIMALS[leg.asset] ?? 8, fee: v.fee, feeAsset: leg.asset, from: from.length === 1 ? from[0] : from.length ? `${from.length} input addresses` : null, fromList: from, to: v.to, inputs: v.inputs, outputs: v.outputs, coinbaseText: v.coinbaseText, inputTotal: v.inputTotal, changeBack: v.changeBack};
  }
  // EVM: header facts must agree across endpoints; the amount comes from the declared basis.
  // Before Byzantium (block 4,370,000) a receipt carries no status: some operators leave it out, others fill it in by
  // re-executing. It is then left out of the agreement, no operator may report a failure, and one must report success.
  const preByzantium = r[0].block < BYZANTIUM_BLOCK;
  const head = r.map((rd) => JSON.stringify([rd.block, rd.time, rd.from, rd.to, preByzantium ? null : rd.status]));
  if (head.some((h) => h !== head[0])) push(`the ${r.length} readings disagree on the transaction (${r.map((x) => x.source).join(', ')})`);
  if (preByzantium) {
    if (r.some((rd) => rd.status === '0x0') || !r.some((rd) => rd.status === '0x1')) push('no operator shows the transaction succeeding (receipts before Byzantium carry no status)');
  } else if (r.some((rd) => rd.status !== '0x1')) push('the transaction failed on chain');
  if (r.some((rd) => !rd.finalized)) push('the block is not finalized');
  const rd = r[0];
  const fee = (BigInt(rd.gasUsed) * BigInt(rd.gasPrice)).toString();
  const base = {block: rd.block, time: rd.time, fee, feeAsset: 'ETH'};
  if (leg.basis === 'tx-value') return {...base, units: rd.value, decimals: 18, from: rd.from, to: rd.to};
  if (leg.basis === 'erc20-log') {
    const logs = r.map((x) => x.logs.find((l) => l.logIndex === leg.logIndex));
    if (logs.some((l) => !l)) return push(`log ${leg.logIndex} is missing from a reading`), null;
    if (logs.some((l) => JSON.stringify(l) !== JSON.stringify(logs[0]))) push(`log ${leg.logIndex} differs between readings`);
    const l = logs[0];
    const tok = TOKENS[l.address];
    if (l.topics[0] !== TRANSFER || l.topics.length !== 3) return push(`log ${leg.logIndex} is not an ERC-20 Transfer`), null;
    if (!tok) return push(`log ${leg.logIndex} is from ${l.address}, which is not a token this page decodes`), null;
    if (tok.asset !== leg.asset) push(`log ${leg.logIndex} moves ${tok.asset}, but the leg says ${leg.asset}`);
    return {...base, units: BigInt(l.data).toString(), decimals: tok.decimals, from: `0x${l.topics[1].slice(26)}`, to: `0x${l.topics[2].slice(26)}`};
  }
  if (leg.basis === 'token-event') {
    // An issuer's own supply event (USDT's Issue or Redeem): the amount is a word of the event's data. There is no
    // receiver: the tokens enter or leave the supply. The party is the contract the transaction called (Tether's
    // multisig, the token's owner), not whichever signer submitted it.
    const logs = r.map((x) => x.logs.find((l) => l.logIndex === leg.logIndex));
    if (logs.some((l) => !l)) return push(`log ${leg.logIndex} is missing from a reading`), null;
    if (logs.some((l) => JSON.stringify(l) !== JSON.stringify(logs[0]))) push(`log ${leg.logIndex} differs between readings`);
    const l = logs[0];
    const tok = TOKENS[l.address];
    if (!tok) return push(`log ${leg.logIndex} is from ${l.address}, which is not a token this page decodes`), null;
    if (!leg.event || l.topics[0] !== leg.event) push(`log ${leg.logIndex} is not the declared event ${leg.event}`);
    const word = leg.word || 0;
    return {...base, units: BigInt(`0x${l.data.slice(2 + 64 * word, 2 + 64 * (word + 1)) || '0'}`).toString(), decimals: tok.decimals, from: rd.to, to: null};
  }
  if (leg.basis === 'trace' || leg.basis === 'balance-delta') {
    const spec = leg.trace || {};
    let units = null;
    if (leg.basis === 'trace' || (leg.check && leg.check.trace)) {
      if (!chainFacts.trace) push('no trace was read for this transaction');
      else units = chainFacts.trace.calls.filter((c) => c.from === spec.from && c.to === spec.to).reduce((s, c) => s + BigInt(c.value), 0n).toString();
    }
    // An event in the receipt that states the same amount (for example WETH's Withdrawal when a bridge unwraps before
    // paying out, which leaves the bridge's own balance unchanged). Every endpoint's receipt must carry it.
    if (leg.check && Number.isInteger(leg.check.logAmount)) {
      const logs = r.map((x) => x.logs.find((l) => l.logIndex === leg.check.logAmount));
      if (logs.some((l) => !l)) push(`log ${leg.check.logAmount} is missing from a reading`);
      else {
        const amounts = logs.map((l) => BigInt(`0x${l.data.slice(2, 66) || '0'}`).toString());
        if (amounts.some((x) => x !== amounts[0])) push(`log ${leg.check.logAmount} differs between readings`);
        else if (units !== null && units !== amounts[0]) push(`the trace (${units}) and log ${leg.check.logAmount} (${amounts[0]}) disagree`);
      }
    }
    const deltaOf = leg.basis === 'balance-delta' ? spec.from : leg.check && leg.check.balanceDelta;
    if (deltaOf) {
      const b = (chainFacts.balances || {})[deltaOf];
      if (!b) push(`no balance reading for ${deltaOf}`);
      else {
        const deltas = b.map((x) => (BigInt(x.before) - BigInt(x.after)).toString());
        if (deltas.some((d) => d !== deltas[0])) push(`balance deltas disagree between endpoints for ${deltaOf}`);
        if (units === null) units = deltas[0];
        else if (units !== deltas[0]) push(`the trace (${units}) and the balance delta (${deltas[0]}) disagree`);
      }
    }
    if (units === null || units === '0') return push('the declared basis yields no amount'), null;
    return {...base, units, decimals: 18, from: spec.from, to: spec.to};
  }
  push(`unknown basis ${leg.basis}`);
  return null;
}

function priceNote(c) {
  const g = c.granularity === 60 ? 'one-minute' : c.granularity === 3600 ? 'hourly' : 'daily';
  return `${c.source} ${c.pair} ${g} candle`;
}

export function buildModel({entries, facts, measured, config}, opts = {}) {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const errors = [];
  const warnings = [];
  const out = [];
  if (!config || !config.recent || !ISO.test(config.recent.start) || !ISO.test(config.recent.end)) errors.push(`${CONFIG_FILE}: needs recent.start and recent.end as YYYY-MM-DD`);
  const recent = config && config.recent ? {start: Date.parse(`${config.recent.start}T00:00:00Z`), end: Date.parse(`${config.recent.end}T23:59:59Z`)} : {start: 0, end: 0};
  const allTime = {start: Date.parse(`${(config && config.allTimeStart) || '2009-01-03'}T00:00:00Z`), end: recent.end};
  const ids = new Set();

  for (const {file, meta: e, sections} of entries) {
    const err = (m) => errors.push(`${file}: ${m}`);
    if (!/^[a-z0-9-]+$/.test(e.id || '') || basename(file, '.md') !== e.id) err('id must be lowercase letters, digits and hyphens, and equal the file name');
    if (ids.has(e.id)) err(`duplicate id ${e.id}`);
    ids.add(e.id);
    if (!['all-time', 'recent'].includes(e.list)) err('list must be all-time or recent');
    if (!CATEGORY_GROUP[e.category]) err(`category must be one of ${Object.keys(CATEGORY_GROUP).join(', ')}`);
    for (const k of ['label', 'title', 'dek', 'criterion']) if (typeof e[k] !== 'string' || !e[k].trim()) err(`${k} is required`);
    if ((e.label || '').length > 24) err('label is longer than 24 characters');
    for (const k of Object.keys(SECTION_TITLES)) if (!sections[k] || !sections[k].length) err(`section "${SECTION_TITLES[k]}" is missing or empty`);
    if (!e.status || !ISO.test(e.status.asOf || '') || !e.status.text) err('status needs asOf (YYYY-MM-DD) and text');
    if (e.returned && (e.category !== 'theft' || !e.returned.text)) err('returned is for a theft and needs text');
    else if (e.status.asOf > today) err('status.asOf is in the future');

    // Sources: what they are, that we read them, and that their quotes are short.
    const sources = new Map();
    for (const s of e.sources || []) {
      const se = (m) => err(`source [${s.n}]: ${m}`);
      if (!Number.isInteger(s.n) || sources.has(s.n)) se('n must be a unique integer');
      sources.set(s.n, s);
      if (!SOURCE_KINDS.includes(s.kind)) se(`kind must be one of ${SOURCE_KINDS.join(', ')}`);
      if (s.kind === 'document' && !DOC_TYPES.includes(s.docType)) se(`a document needs docType ${DOC_TYPES.join(', ')}`);
      if (!/^https:\/\//.test(s.url || '')) se('url must be https');
      if (!/^https:\/\/web\.archive\.org\/web\/\d{14}\//.test(s.archive || '')) se('archive must be an archive.org snapshot URL (https://web.archive.org/web/<timestamp>/...)');
      if (!ISO.test(s.read || '') || s.read > today) se('read must be a real YYYY-MM-DD, not in the future');
      if (!s.title || !s.publisher) se('title and publisher are required');
      if (s.date && !ISO.test(s.date)) se('date must be YYYY-MM-DD');
      if (s.quote && wordCount(s.quote) >= 15) se('quotes stay under 15 words');
      const check = (facts.sources || {})[s.archive];
      const claims = [...(s.txids || []), ...(s.addresses || [])];
      if (claims.length || s.quote) {
        if (!check) se('not read yet: run fetch-facts.mjs (a source we could not read cannot support a name or a figure)');
        else {
          if (!check.ok) se(`could not be read (${check.error})`);
          for (const id of claims) if (!(check.found || []).includes(id.toLowerCase())) se(`does not contain ${id}`);
          // One archived copy can serve several stories, so its record holds a result per quote.
          const quoteFound = check.quotes ? check.quotes[s.quote] : check.quote;
          if (s.quote && !quoteFound) se(`does not contain the quote "${s.quote}"`);
        }
      }
    }
    const matches = new Map((e.matches || []).map((m) => [m.id, m]));
    for (const m of matches.values()) {
      if (!/^m\d+$/.test(m.id)) err(`match id ${m.id} must look like m1`);
      // A set scan reads the chain alone; every other match rests on the description in a cited source.
      if (m.type !== 'evm-event-scan' && !sources.has(m.source)) err(`match ${m.id} cites missing source [${m.source}]`);
      const proof = (facts.matches || {})[`${e.id}/${m.id}`];
      if (!proof) err(`match ${m.id} has no proof yet: run fetch-facts.mjs`);
      else if (!proof.complete) err(`match ${m.id}: the read of its window is incomplete, so uniqueness is not proven`);
    }

    // Text rules over everything a reader sees.
    const texts = [['title', e.title], ['dek', e.dek], ['criterion', e.criterion], ['label', e.label], ['status', e.status && e.status.text], ...Object.entries(sections).flatMap(([k, ps]) => ps.map((p) => [SECTION_TITLES[k], p])), ...(e.attributions || []).map((a) => ['attribution', a.claim]), ['returned', e.returned && e.returned.text], ...(e.legs || []).flatMap((l) => [['role', l.from && l.from.role], ['role', l.to && l.to.role], ['todayReason', l.todayReason]])];
    for (const [where, text] of texts) {
      if (!text) continue;
      for (const s of typedNumbers(text)) err(`${where}: a number typed into prose needs a placeholder or a source marker: "${s}"`);
      for (const s of unsupportedSuperlatives(text)) err(`${where}: a superlative needs a source marker or a match proof: "${s}"`);
      for (const [, ref] of text.matchAll(MARKER)) if (ref.startsWith('m') ? !matches.has(ref) : !sources.has(Number(ref))) err(`${where}: marker [${ref}] points nowhere`);
    }
    for (const a of e.attributions || []) {
      const s = sources.get(a.source);
      if (!s || s.kind !== 'document' || !['court', 'government'].includes(s.docType)) err('an attribution must cite a court or government document');
      if (!ISO.test(a.date || '')) err('an attribution needs the document date');
    }

    // Legs: verified on chain, amount from the declared basis, parties named only under D7.
    const legs = [];
    for (const leg of e.legs || []) {
      const le = (m) => err(`${leg.id}: ${m}`);
      if (!CHAIN_INFO[leg.chain]) le(`unknown chain ${leg.chain}`);
      if (!BASES.includes(leg.basis)) le(`basis must be one of ${BASES.join(', ')}`);
      // A leg that moves coins an earlier leg already moved (a forward, a return) is shown but never added to a total.
      if (leg.follows !== undefined) {
        const earlier = (e.legs || []).slice(0, (e.legs || []).indexOf(leg)).find((x) => x.id === leg.follows);
        if (!earlier) le(`follows ${leg.follows}, which is not an earlier leg of this entry`);
        else if (earlier.asset !== leg.asset) le(`follows ${leg.follows} but moves ${leg.asset}, not ${earlier.asset}`);
      }
      const idOk = typeof leg.idSource === 'number' ? sources.has(leg.idSource) && (sources.get(leg.idSource).txids || []).map((x) => x.toLowerCase()).includes(String(leg.txid).toLowerCase()) : matches.has(leg.idSource);
      if (!idOk) le('the transaction id must appear in a cited source (listed in its txids) or come from a match proof (idSource)');
      if (typeof leg.idSource === 'string') {
        const proof = (facts.matches || {})[`${e.id}/${leg.idSource}`];
        const spec = matches.get(leg.idSource);
        if (proof && !(proof.matches || []).map((x) => x.toLowerCase()).includes(String(leg.txid).toLowerCase())) le(`match ${leg.idSource} found ${JSON.stringify(proof.matches)}, not this transaction`);
        // A set (every event of one kind in a range, or every spend from an address in a window) identifies each
        // member; the entry must then show them all.
        if (spec && (spec.type === 'evm-event-scan' || spec.set === true)) {
          if (proof) for (const id of proof.matches) if (!(e.legs || []).some((x) => String(x.txid).toLowerCase() === id)) le(`match ${leg.idSource} found ${id}, which the entry leaves out; a complete set is shown whole`);
        } else if (proof && proof.count !== 1) le(`match ${leg.idSource} found ${proof.count} candidates; a description identifies a transaction only when exactly one matches`);
      }
      const cf = (facts.txs || {})[`${leg.chain}:${leg.txid}`];
      if (!cf) {
        le('not read yet: run fetch-facts.mjs');
        continue;
      }
      const single = SINGLE_SOURCE_CHAINS.includes(leg.chain);
      if (!single && (cf.readings || []).length < 2) le('needs two agreeing readings from different operators');
      const a = legAmount(leg, cf, le);
      if (!a) continue;
      const units = unitsToDecimal(a.units, a.decimals);
      const priceKey = `${leg.asset}@${a.time}`;
      const candle = (facts.prices || {})[priceKey];
      let usdThen = null;
      let then = null;
      if (candle && !candle.none) {
        usdThen = Number(units) * candle.close;
        then = {kind: 'candle', price: candle.close, note: priceNote(candle), at: candle.start};
      } else if (leg.thenFromSource) {
        const s = sources.get(leg.thenFromSource.source);
        if (!s || s.kind !== 'document') le('thenFromSource must cite a document');
        usdThen = leg.thenFromSource.usd;
        then = {kind: 'document', source: leg.thenFromSource.source, note: `the figure in source [${leg.thenFromSource.source}]`};
      } else if (!candle) le(`no price lookup recorded for ${priceKey}: run fetch-facts.mjs`);
      else then = {kind: 'none', note: candle.reason};
      // The fee in dollars, at the fee asset's own traded candle (ETH for a token transfer on Ethereum).
      const feeAssetName = a.feeAsset === 'ETH' ? 'ETH' : leg.asset;
      const feeCandle = feeAssetName === leg.asset ? candle : (facts.prices || {})[`${feeAssetName}@${a.time}`];
      const feeUsd = feeCandle && !feeCandle.none ? Number(unitsToDecimal(a.fee, feeAssetName === 'ETH' ? 18 : 8)) * feeCandle.close : null;
      let share = null;
      if (leg.asset === 'BTC' && leg.basis !== 'coinbase') share = {value: Number(units) / scheduledBtc(a.block), of: 'the bitcoin the issuance schedule allowed by that block'};
      else if (TOKENS_BY_ASSET[leg.asset]) {
        const sup = (facts.supply || {})[`${leg.asset}@${a.block}`];
        if (sup && sup.length) {
          if (sup.some((x) => x.value !== sup[0].value)) le('totalSupply readings disagree');
          share = {value: Number(units) / Number(unitsToDecimal(sup[0].value, 6)), of: `${leg.asset} supply on Ethereum at that block`};
        }
      }
      if (leg.todayApplicable === false && !leg.todayReason) le('todayApplicable false needs todayReason');
      const party = (side) => {
        const p = leg[side] || {};
        const addr = side === 'from' ? a.from : a.to;
        if (p.address && addr && p.address.toLowerCase() !== String(addr).toLowerCase()) le(`${side}.address ${p.address} differs from the chain's ${addr}`);
        if (!p.role) le(`${side}.role is required`);
        let label = null;
        const ev = p.evidence;
        if (p.label && !ev) le(`${side} has a label but no evidence; unnamed parties carry a role only`);
        if (ev) {
          const s = sources.get(ev.source);
          if (ev.kind === 'tag') {
            for (const problem of tagEvidenceProblems(leg.chain, ev)) le(`${side}: ${problem}`);
            label = p.label || ev.tag;
          } else if (ev.kind === 'document') {
            if (!s || s.kind !== 'document') le(`${side}: document evidence must cite a document source`);
            else if (ev.identifies === 'address' && !(s.addresses || []).some((x) => x.toLowerCase() === String(addr).toLowerCase())) le(`${side}: source [${ev.source}] does not list ${addr}`);
            else if (ev.identifies === 'tx' && !(s.txids || []).some((x) => x.toLowerCase() === String(leg.txid).toLowerCase())) le(`${side}: source [${ev.source}] does not list this transaction`);
            else if (!['address', 'tx'].includes(ev.identifies)) le(`${side}: document evidence must say whether it identifies the address or the transaction`);
            label = p.label;
          } else if (ev.kind === 'matched') {
            if (!s || s.kind !== 'document') le(`${side}: a match must rest on a document`);
            if (!matches.has(ev.match) || leg.idSource !== ev.match) le(`${side}: the match ${ev.match} must be the one that identified this transaction`);
            label = p.label;
          } else le(`${side}: evidence kind must be tag, document or matched`);
          if (!label) le(`${side}: evidence given but no label`);
          if (p.person) {
            const ok = s && ((p.personBasis === 'self' && s.docType === 'party') || (p.personBasis === 'convicted' && s.docType === 'court'));
            if (!ok) le(`${side}: a person is named only on their own statement (personBasis self, a party document) or a court record of conviction or plea (personBasis convicted, a court document)`);
          }
        }
        return {role: p.role, label, address: addr, addresses: side === 'from' ? a.fromList || null : null, evidence: ev || null, source: ev && ev.source ? sources.get(ev.source) : null};
      };
      legs.push({
        id: leg.id, chain: leg.chain, txid: leg.txid, basis: leg.basis, asset: leg.asset, block: a.block, time: a.time, units, exactUnits: units, amount: Number(units),
        fee: unitsToDecimal(a.fee, a.feeAsset === 'ETH' ? 18 : 8), feeAsset: a.feeAsset === 'ETH' ? 'ETH' : leg.asset === 'L-BTC' ? 'L-BTC' : 'BTC',
        usdThen, then, share, feeUsd, todayApplicable: leg.todayApplicable !== false, todayReason: leg.todayReason || null,
        readings: (cf.readings || []).map((x) => x.source), traceSource: cf.trace ? cf.trace.source : null, read: cf.read || null, single,
        inputs: a.inputs ?? null, outputs: a.outputs ?? null, coinbaseText: a.coinbaseText ?? null, funding: cf.funding || null,
        inputTotal: a.inputTotal != null ? unitsToDecimal(a.inputTotal, 8) : null, changeBack: a.changeBack != null ? unitsToDecimal(a.changeBack, 8) : null,
        check: leg.check || null, from: party('from'), to: party('to'), measured: false, follows: leg.follows || null, counted: !leg.follows,
      });
      if (e.list === 'recent' && config && config.recent && (a.time < recent.start || a.time > recent.end)) le(`dated ${isoDate(a.time)}, outside the recent window ${config.recent.start} to ${config.recent.end}`);
    }
    if (!legs.length) continue;

    // Balance reads: an address's native balance at stated blocks, from every operator, which must agree. They let a
    // story state a total that no single transaction carries (a drain spread over many transactions).
    const balances = [];
    for (const b of e.balances || []) {
      const be = (m) => err(`balance ${b.id}: ${m}`);
      if (!/^b\d+$/.test(b.id || '')) be('id must look like b1');
      if (!CHAIN_INFO[b.chain] || ['Bitcoin', 'Liquid'].includes(b.chain)) be('balance reads are for EVM chains');
      if (b.asset !== CHAIN_INFO[b.chain]?.native) be(`asset must be the chain's native asset (${CHAIN_INFO[b.chain]?.native})`);
      if (!Array.isArray(b.blocks) || !b.blocks.length || b.blocks.some((x, i) => !Number.isInteger(x) || (i && x <= b.blocks[i - 1]))) be('blocks must be ascending block numbers');
      const reads = [];
      for (const block of b.blocks || []) {
        const f = (facts.balances || {})[`${b.chain}:${String(b.address).toLowerCase()}@${block}`];
        if (!f) {
          be(`block ${block} not read yet: run fetch-facts.mjs`);
          continue;
        }
        if (f.readings.length < 2) be(`block ${block} needs two agreeing readings from different operators`);
        if (f.readings.some((r) => r.value !== f.readings[0].value || r.time !== f.readings[0].time)) be(`the readings at block ${block} disagree`);
        if (f.readings.length) reads.push({block, time: f.readings[0].time, wei: f.readings[0].value, units: unitsToDecimal(f.readings[0].value, 18), sources: f.readings.map((r) => r.source)});
      }
      balances.push({id: b.id, chain: b.chain, address: String(b.address).toLowerCase(), asset: b.asset, reads});
    }

    // Placeholders: every number a reader sees is stamped from the chain facts.
    const vars = {};
    for (const b of balances) {
      b.reads.forEach((r, i) => {
        vars[`${b.id}.at${i}`] = fmtAmount(r.units, b.asset, {digits: 2});
        vars[`${b.id}.block${i}`] = groupDecimal(String(r.block));
        vars[`${b.id}.date${i}`] = dateUTC(r.time);
        vars[`${b.id}.time${i}`] = timeUTC(r.time);
      });
      if (b.reads.length > 1) {
        const diff = BigInt(b.reads[b.reads.length - 1].wei) - BigInt(b.reads[0].wei);
        vars[`${b.id}.change`] = fmtAmount(unitsToDecimal((diff < 0n ? -diff : diff).toString(), 18), b.asset);
      }
    }
    for (const l of legs) {
      vars[`${l.id}.amount`] = fmtAmount(l.units, l.asset);
      vars[`${l.id}.amountExact`] = fmtAmount(l.units, l.asset, {exact: true});
      vars[`${l.id}.usdThen`] = l.usdThen === null ? 'no market price' : fmtUsd(l.usdThen);
      vars[`${l.id}.price`] = l.then && l.then.kind === 'candle' ? (l.then.price < 10 ? `$${l.then.price.toFixed(4)}` : fmtUsd(l.then.price, false)) : 'no market price';
      vars[`${l.id}.inputs`] = l.inputs == null ? 'not applicable' : groupDecimal(String(l.inputs));
      vars[`${l.id}.outputs`] = l.outputs == null ? 'not applicable' : groupDecimal(String(l.outputs));
      if (l.coinbaseText) vars[`${l.id}.coinbaseText`] = l.coinbaseText;
      // Coin age only from a complete read of the inputs' funding transactions; a partial read could understate it.
      if (l.funding && l.funding.oldest && (l.funding.complete ?? l.funding.inputsRead === l.funding.inputs)) {
        vars[`${l.id}.oldestInput`] = dateUTC(l.funding.oldest.time);
        vars[`${l.id}.coinAge`] = `${((l.time - l.funding.oldest.time) / (365.25 * 86400000)).toFixed(1)} years`;
        vars[`${l.id}.oldestBlock`] = groupDecimal(String(l.funding.oldest.height));
      }
      if (l.inputTotal != null) vars[`${l.id}.inputTotal`] = fmtAmount(l.inputTotal, l.asset);
      if (l.changeBack != null) vars[`${l.id}.changeBack`] = fmtAmount(l.changeBack, l.asset);
      vars[`${l.id}.feeUsd`] = l.feeUsd == null ? 'no market price' : l.feeUsd < 1 ? `$${l.feeUsd.toFixed(2)}` : fmtUsd(l.feeUsd);
      // The whole of a transaction's counted outputs in one asset (several legs can be outputs of one transaction).
      const same = legs.filter((x) => x.counted && x.txid === l.txid && x.asset === l.asset);
      vars[`${l.id}.txAmount`] = fmtAmount(sumDecimal(same.map((x) => x.units)), l.asset);
      vars[`${l.id}.txShare`] = same.every((x) => x.share) ? percent(same.reduce((s, x) => s + x.share.value, 0)) : 'not available';
      vars[`${l.id}.date`] = dateUTC(l.time);
      vars[`${l.id}.time`] = timeUTC(l.time);
      vars[`${l.id}.block`] = groupDecimal(String(l.block));
      // A fee of a whole unit or more reads rounded (the exact figure is in the facts); a smaller one keeps every digit.
      vars[`${l.id}.fee`] = Number(l.fee) >= 1 ? fmtAmount(l.fee, l.feeAsset, {digits: 2}) : fmtAmount(l.fee, l.feeAsset, {exact: true});
      vars[`${l.id}.share`] = l.share ? percent(l.share.value) : 'not available';
      vars[`${l.id}.year`] = String(new Date(l.time).getUTCFullYear());
    }
    for (const m of matches.values()) {
      const p = (facts.matches || {})[`${e.id}/${m.id}`];
      if (!p) continue;
      vars[`${m.id}.blocks`] = groupDecimal(String(p.blocksRead));
      vars[`${m.id}.txs`] = groupDecimal(String(p.txsRead));
      vars[`${m.id}.firstBlock`] = groupDecimal(String(p.heights[0]));
      vars[`${m.id}.lastBlock`] = groupDecimal(String(p.heights[1]));
      if (p.maxGasBefore != null) vars[`${m.id}.maxGas`] = groupDecimal(String(p.maxGasBefore));
      if (p.firstBlockAtGas != null) vars[`${m.id}.firstAtGas`] = groupDecimal(String(p.firstBlockAtGas));
      if (p.genesisGas != null) vars[`${m.id}.genesisGas`] = groupDecimal(String(p.genesisGas));
      if (p.window && p.window.from) vars[`${m.id}.from`] = dateUTC(Date.parse(p.window.from));
      if (p.window && p.window.to) vars[`${m.id}.to`] = dateUTC(Date.parse(p.window.to));
    }
    const fill = (text, where) => (text || '').replace(PLACEHOLDER, (all, k) => {
      if (!(k in vars)) {
        err(`${where}: unknown placeholder ${all}`);
        return all;
      }
      return vars[k];
    });
    const first = legs[0];
    out.push({
      id: e.id, list: e.list, category: e.category, categoryLabel: CATEGORY_LABEL[e.category], group: CATEGORY_GROUP[e.category], priority: e.priority ?? 5,
      label: fill(e.label, 'label'), title: fill(e.title, 'title'), dek: fill(e.dek, 'dek'), criterion: fill(e.criterion, 'criterion'),
      sections: Object.fromEntries(Object.entries(sections).map(([k, ps]) => [k, ps.map((p) => fill(p, SECTION_TITLES[k]))])),
      status: e.status ? {asOf: e.status.asOf, text: fill(e.status.text, 'status')} : null,
      attributions: (e.attributions || []).map((a) => ({...a, claim: fill(a.claim, 'attribution')})),
      returned: e.returned ? {text: fill(e.returned.text, 'returned')} : null,
      sources: [...sources.values()], balances, matches: [...matches.values()].map((m) => ({...m, proof: (facts.matches || {})[`${e.id}/${m.id}`] || null})),
      legs: legs.map((l) => ({...l, from: {...l.from, role: fill(l.from.role, 'role')}, to: {...l.to, role: fill(l.to.role, 'role')}, todayReason: l.todayReason ? fill(l.todayReason, 'todayReason') : null})),
      time: first.time, chains: [...new Set(legs.map((l) => l.chain))],
    });
  }

  checkMeasured(measured, config, errors);
  // Data freshness: dated, never failing on age alone (fixed window dates keep a late refresh true).
  if (facts.fetchedAt) {
    const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(facts.fetchedAt)) / 86400000;
    if (age > STALE_DAYS) warnings.push(`${FACTS_FILE} was read ${Math.floor(age)} days ago; refresh the recent entries (scripts/landmarks/README.md)`);
  }
  if (measured && measured.measuredAt) {
    const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${measured.measuredAt}T00:00:00Z`)) / 86400000;
    if (age > STALE_DAYS) warnings.push(`${MEASURED_FILE} is ${Math.floor(age)} days old; re-run measure-largest.mjs`);
  }
  const dataAsOf = [facts.fetchedAt ? facts.fetchedAt.slice(0, 10) : null, measured && measured.measuredAt].filter(Boolean).sort().pop() || today;
  out.sort((x, y) => x.time - y.time);
  return {model: {entries: out, recent, allTime, dataAsOf, milestones: facts.milestones || [], refPrices: facts.refPrices || null, measured: measured || null, config}, errors, warnings};
}

const TOKENS_BY_ASSET = Object.fromEntries(Object.values(TOKENS).map((t) => [t.asset, t]));

/** The field's points: one per leg, plus the USDT supply events our own scan found (hollow rings, linked to their
 *  table). A supply event is not a holding, so it has no value at today's price. */
export function pointsOf(model) {
  const stories = model.entries.flatMap((e) => e.legs.map((l, i) => ({
    key: `${e.id}:${l.id}`, entry: e.id, label: e.legs.length > 1 && i > 0 ? '' : e.label, group: e.group, chain: l.chain, t: l.time, asset: l.asset,
    amount: Number(l.amount.toPrecision(12)), usdThen: l.usdThen === null ? null : Math.round(l.usdThen * 100) / 100, todayApplicable: l.todayApplicable, measured: l.measured, counted: l.counted, priority: e.priority,
  })));
  // A measured event that a story already tells is drawn once, as the story's light.
  const told = new Set(model.entries.flatMap((e) => e.legs.map((l) => String(l.txid).toLowerCase())));
  const usdt = model.measured && model.measured.tables.usdt && model.measured.tables.usdt.complete ? model.measured.tables.usdt.events.filter((x) => x.type !== 'DestroyedBlackFunds' && !told.has(String(x.txid).toLowerCase())) : [];
  const measured = usdt.map((x) => ({
    key: `m-usdt:${x.txid}`, entry: 'lm-m-usdt', label: '', group: 'milestone', chain: 'Ethereum', t: x.time, asset: 'USDT',
    amount: Number(Number(x.amount).toPrecision(12)), usdThen: x.usd === null ? null : Math.round(x.usd * 100) / 100, todayApplicable: false, measured: true, counted: true, priority: 2,
  }));
  return [...stories, ...measured].sort((a, b) => a.t - b.t);
}

/** What the measured section may show: a window that matches the config, or an error saying it does not. */
export function checkMeasured(measured, config, errors) {
  if (!measured) return;
  if (!config || !config.recent || measured.window.start !== config.recent.start || measured.window.end !== config.recent.end) errors.push(`${MEASURED_FILE} covers ${measured.window.start} to ${measured.window.end}, not the configured window; re-run scripts/landmarks/measure-largest.mjs`);
  for (const [name, t] of Object.entries(measured.tables)) if (t.complete && !Array.isArray(t.events || t.cross)) errors.push(`${MEASURED_FILE}: table ${name} is marked complete but lists no rows`);
}
