/**
 * The Landmarks page as static HTML, rendered at build time from the checked model (build.mjs). Everything a reader
 * needs is here without JavaScript: the hero, the field as SVG, the legend, every story with its facts, evidence and
 * sources, and the method. The island (components/landmarks/) enhances it; it never holds the only copy of anything.
 *
 * Text comes from the entries and is escaped; markers become links ([3] to source 3, [m1] to a match proof).
 */
import {renderSvg, GROUP_COLORS, GROUP_LABELS, GROUPS} from '../../lib/landmarks/field.ts';
import {CHAIN_INFO} from '../../lib/landmarks/chains.ts';
import {usd, amount, short, dateUTC, timeUTC, isoDate, percent, escapeHtml as esc, groupDecimal} from '../../lib/landmarks/format.ts';
import {SECTION_TITLES, pointsOf, sumDecimal} from './build.mjs';
import {domainOf} from './gen-landmarks.mjs';
import {thenTodayChart, shareChart, feeChart, supplyChart} from './charts.mjs';

/** lucide-react 1.31.0 "earth" (Globe2), the map's brand mark, and "arrow-up-right"; copied so the static page needs no React. */
const ICONS = {
  globe: '<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/>',
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
};
export const icon = (name, size, stroke = 1.5, cls = '') => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const DOC_LABEL = {court: 'Court record', government: 'Government document', party: "A party's own statement"};
const KIND_LABEL = {reporting: 'Reporting', data: 'Technical source'};
const BASIS_TEXT = {
  'btc-output': 'the value of the payment output',
  coinbase: 'the value of the block reward',
  'tx-value': 'the value field of the transaction',
  'erc20-log': 'the token Transfer event in the receipt',
  'token-event': "the issuer contract's own supply event in the receipt",
  trace: "the transaction's internal calls (trace)",
  'balance-delta': "the sender's balance before and after the block",
};

/** Escapes text, then turns [n] and [m1] markers into links to the story's sources and proofs. */
function prose(text, entryId) {
  return esc(text).replace(/\[(\d+|m\d+)\]/g, (all, ref) => (ref.startsWith('m') ? `<sup class="lm-ref"><a href="#${entryId}-${ref}" aria-label="match proof">proof</a></sup>` : `<sup class="lm-ref"><a href="#${entryId}-s${ref}" aria-label="source ${ref}">${ref}</a></sup>`));
}

const describePoint = (entries) => (p, value) => {
  const e = entries.find((x) => x.id === p.entry);
  const name = e ? e.title : p.measured ? 'USDT supply event, measured by this page' : p.label;
  return `${name}, ${dateUTC(p.t)}, ${value === null ? 'no market price' : usd(value)}${p.counted === false ? ', the same coins moving on' : ''}`;
};

export function renderHero(model) {
  const legs = model.entries.flatMap((e) => e.legs);
  // Transactions, not legs: two outputs of one transaction are one transaction.
  const txs = new Set(legs.map((l) => `${l.chain}:${l.txid}`)).size;
  const chains = [...new Set(legs.map((l) => l.chain))];
  const years = legs.map((l) => new Date(l.time).getUTCFullYear());
  const y0 = Math.min(...years);
  const y1 = Math.max(...years);
  return `<section class="lm-hero" aria-labelledby="lm-title">
  <div class="lm-hero-text">
    <div class="eyebrow"><span></span>THE RECORD BOOK</div>
    <h1 id="lm-title">Transactions that moved the ledger.</h1>
    <p>Every entry is a real transaction, read from its own chain. Each one is checked against every public source that serves it, and a name appears only when an explorer's own tag or a primary document supplies it.</p>
  </div>
  <div class="lm-metrics">
    <div class="lm-primary"><span>Verified on chain</span><strong>${txs}</strong><small>transactions in ${model.entries.length} ${model.entries.length === 1 ? 'entry' : 'entries'}</small></div>
    <div><span>Chains</span><strong>${chains.length}</strong><small>${esc(chains.join(' and '))}</small></div>
    <div><span>Years covered</span><strong>${y1 - y0 + 1}</strong><small>${y0} to ${y1}</small></div>
  </div>
</section>`;
}

export function renderField(model) {
  const points = pointsOf(model);
  const {decMin, decMax} = domainOf(model, points);
  const base = {mode: 'then', t0: model.allTime.start, t1: model.allTime.end, decMin, decMax, milestones: model.milestones, prices: null, layers: 'all', describe: describePoint(model.entries), shelfLabel: 'No market price', title: 'Landmark transactions by date and value at the time', desc: 'Each light is one transaction, placed by its date and by its value in US dollars when it happened, on a logarithmic scale. Transactions with no market price that day sit on the shelf below the axis. The stories below list every value.'};
  const wide = renderSvg(points, {...base, size: {width: 1000, height: 560, compact: false}, idPrefix: 'lmw', labelMax: 10});
  const narrow = renderSvg(points, {...base, size: {width: 380, height: 330, compact: true}, idPrefix: 'lmn', labelMax: 4});
  return `<div class="lm-field-static lm-wide">${wide}</div><div class="lm-field-static lm-narrow">${narrow}</div>`;
}

export function renderLegend() {
  const groups = GROUPS.map((g) => `<li><i class="lm-dot" style="--c:${GROUP_COLORS[g]}"></i>${esc(GROUP_LABELS[g])}</li>`).join('');
  return `<ul class="lm-legend" aria-label="Legend">${groups}<li><i class="lm-ring"></i>Found by this page's own scan</li><li class="lm-legend-note">Height and halo: US dollars, log scale. Shelf: no market price that day.</li></ul>`;
}

function party(p, l, entryId, side) {
  const info = CHAIN_INFO[l.chain];
  const addr = p.address && /^(0x|[13bc]|tb1)/i.test(p.address) && !/ input addresses$/.test(p.address) ? `<a class="mono" href="${esc(info.address(p.address))}" rel="noopener noreferrer">${esc(short(p.address))}</a>` : p.address ? `<span class="mono">${esc(p.address)}</span>` : '<span class="lm-none">no address</span>';
  // A block reward has no sender to name: its coins are newly issued.
  const name = p.label ? `<b>${esc(p.label)}</b>` : l.basis === 'coinbase' && side === 'from' ? '<b>New coins</b>' : l.basis === 'token-event' && side === 'to' ? '<b>Removed from supply</b>' : '<b class="lm-unnamed">Not named</b>';
  return `<div class="lm-party">${name}<span>${prose(p.role, entryId)}</span>${addr}</div>`;
}

function evidence(p, side, leg, e) {
  if (!p.evidence) return '';
  const ev = p.evidence;
  const who = p.label ? esc(p.label) : side;
  if (ev.kind === 'tag') {
    const notes = (ev.alerts || []).length ? ` The explorer also shows: “${esc(ev.alerts.join(' '))}”` : '';
    return `<li><b>${who}</b>: public name tag on ${esc(CHAIN_INFO[leg.chain].explorer)}, “${esc(ev.tag)}”, read ${esc(dateUTC(Date.parse(ev.read)))}. The explorer credits no outside source for it.${notes}</li>`;
  }
  if (ev.kind === 'document') return `<li><b>${who}</b>: named by source <a href="#${e.id}-s${ev.source}">[${ev.source}]</a>, which lists this ${ev.identifies === 'address' ? 'address' : 'transaction'} in its own text.</li>`;
  if (ev.kind === 'matched') return `<li><b>${who}</b>: identified by matching the description in source <a href="#${e.id}-s${ev.source}">[${ev.source}]</a> to exactly one transaction (<a href="#${e.id}-${ev.match}">proof</a>).</li>`;
  return '';
}

function legFacts(l) {
  const info = CHAIN_INFO[l.chain];
  const then = l.then && l.then.kind === 'candle' ? `${esc(usd(l.usdThen))} at ${l.then.price < 10 ? `$${l.then.price.toFixed(4)}` : esc(usd(l.then.price, false))}, from the ${esc(l.then.note)} containing the block` : l.then && l.then.kind === 'document' ? `${esc(usd(l.usdThen))}, ${esc(l.then.note)}` : 'No market price: no exchange series this page reads has a traded candle at that time';
  const reads = l.readings.length > 1 ? `${esc(l.readings.join(' and '))}, which agree` : `${esc(l.readings[0] || 'one source')} only (one public source serves this chain)`;
  const checks = l.check && Number.isInteger(l.check.logAmount) ? `; checked against event ${l.check.logAmount} in the receipt` : l.check && l.check.balanceDelta ? '; checked against the balance before and after the block' : '';
  const rows = [
    ['Transaction', `<a class="mono" href="${esc(info.tx(l.txid))}" rel="noopener noreferrer">${esc(short(l.txid))}</a>`],
    ['Block', `${groupDecimal(String(l.block))}, ${esc(dateUTC(l.time))} ${esc(timeUTC(l.time))}`],
    ['Amount', esc(amount(l.units, l.asset, {exact: true}))],
    ['Amount read from', `${esc(BASIS_TEXT[l.basis])}${checks}`],
    ['Fee', esc(amount(l.fee, l.feeAsset, {exact: true}))],
    ['Read from', `${reads}${l.traceSource ? `; trace from ${esc(l.traceSource)}` : ''}`],
    ['Value at the time', then],
  ];
  if (l.share) rows.push(['Share of supply', `${esc(percent(l.share.value))} of ${esc(l.share.of)}`]);
  return `<dl class="lm-facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function flow(l, e) {
  // A story told in several transactions dates each step; a step that moves coins already shown says it is not added again.
  const when = e.legs.length > 1 ? `<p class="lm-flow-when"><time datetime="${new Date(l.time).toISOString()}">${esc(dateUTC(l.time))}, ${esc(timeUTC(l.time))}</time>${l.follows ? ', the same coins moving on (not added to the total)' : ''}</p>` : '';
  return `${when}<div class="lm-flow" data-group="${e.group}">${party(l.from, l, e.id, 'from')}<div class="lm-flow-line" aria-hidden="true"><span class="lm-flow-amount">${esc(amount(l.units, l.asset))}</span></div>${party(l.to, l, e.id, 'to')}</div>`;
}


function sourceItem(s, e) {
  const kind = s.kind === 'document' ? DOC_LABEL[s.docType] : KIND_LABEL[s.kind];
  const meta = [s.publisher, s.author ? `by ${s.author}` : null, s.date ? dateUTC(Date.parse(s.date)) : null].filter(Boolean).map(esc).join(', ');
  const quote = s.quote ? ` <q>${esc(s.quote)}</q>` : '';
  return `<li id="${e.id}-s${s.n}"><span class="lm-src-kind">${esc(kind)}</span> <a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.title)}</a>, ${meta}. <a href="${esc(s.archive)}" rel="noopener noreferrer">Archived copy</a>, read ${esc(dateUTC(Date.parse(s.read)))}.${quote}</li>`;
}

function proofItem(m, e) {
  const p = m.proof;
  if (!p) return '';
  const g = (n) => groupDecimal(String(n));
  const chain = m.type.startsWith('evm-') ? m.chain || 'Ethereum' : 'Bitcoin';
  const info = CHAIN_INFO[chain];
  const range = p.heights[0] === p.heights[1] ? `block ${g(p.heights[0])}` : `blocks ${g(p.heights[0])} to ${g(p.heights[1])}`;
  const ids = p.matches.map((id) => `<a class="mono" href="${esc(info.tx(id))}" rel="noopener noreferrer">${esc(short(id))}</a>`).join(', ');
  const addr = (a) => `<a class="mono" href="${esc(info.address(a))}" rel="noopener noreferrer">${esc(short(a))}</a>`;
  let read;
  let verdict;
  if (m.type === 'evm-event-scan') {
    // A set, not a match: every event of one kind in the range, all of which the story shows.
    read = `every ${esc(m.event || 'matching')} event of the contract ${addr(m.contract)} in ${range}, on ${esc(p.source)}`;
    verdict = p.count === 0 ? 'none found' : p.count === 1 ? 'one found, and this story shows it' : `${g(p.count)} found, and this story shows every one`;
  } else if (m.type === 'btc-address-spend') {
    const span = p.window && p.window.from && p.window.to ? ` between ${esc(dateUTC(Date.parse(p.window.from)))} and ${esc(dateUTC(Date.parse(p.window.to)))}` : '';
    read = `every transaction of the address ${addr(m.address)}, on ${esc(p.source)} (${g(p.txsRead)} transactions in ${range})`;
    verdict = p.count === 1 ? `exactly one spends from it${span}` : m.set ? `${g(p.count)} spend from it${span}, and this story shows every one` : `${g(p.count)} spend from it${span}, so the description alone does not identify one of them`;
  } else if (m.type === 'evm-first-tx') {
    read = `every block header from the genesis block to block ${g(p.firstBlock ?? p.heights[1])}, on ${esc(p.source)}`;
    // The gas limit a transfer needs (21,000) is first reached at firstBlockAtGas; every block before that could not
    // hold one, and every block from there to firstBlock is read empty on both operators.
    const gas = `no earlier block holds a transaction; the gas limit started at ${g(p.genesisGas)} and first reached the 21,000 the least transfer needs at block ${g(p.firstBlockAtGas)}`;
    verdict = p.count === 1 ? `${gas}, and block ${g(p.firstBlock)} holds exactly one transaction` : `${gas}, and block ${g(p.firstBlock)} holds ${g(p.count)}`;
  } else {
    read = `${range} on ${esc(p.source)} (${g(p.txsRead)} transactions)`;
    verdict = p.count === 1 ? 'exactly one matches' : `${g(p.count)} match, so the description alone does not identify one of them`;
  }
  return `<li id="${e.id}-${m.id}"><b>Complete read</b> of ${read}: ${verdict}${ids ? `: ${ids}` : ''}.</li>`;
}

/** One address's balance at each stated block, as every operator returned it. */
function balanceItem(b) {
  const info = CHAIN_INFO[b.chain];
  const at = b.reads.map((r) => `${esc(amount(r.units, b.asset, {exact: true}))} at block ${groupDecimal(String(r.block))} (${esc(dateUTC(r.time))} ${esc(timeUTC(r.time))})`).join('; ');
  const sources = [...new Set(b.reads.flatMap((r) => r.sources))];
  return `<li><b>Balance</b> of <a class="mono" href="${esc(info.address(b.address))}" rel="noopener noreferrer">${esc(short(b.address))}</a>: ${at}. Read from ${esc(sources.join(' and '))}, which agree.</li>`;
}

export function renderStory(e, model) {
  const chains = e.chains.map((c) => `<span class="lm-chip"><i class="lm-dot" style="--c:${CHAIN_INFO[c].color}"></i>${esc(c)}</span>`).join('');
  // Totals count each coin once: a leg that moves coins an earlier leg already moved is shown in the flows only.
  const counted = e.legs.filter((l) => l.counted);
  const byAsset = new Map();
  for (const l of counted) byAsset.set(l.asset, [...(byAsset.get(l.asset) || []), l]);
  const txCount = (ls) => new Set(ls.map((l) => l.txid)).size;
  const moved = [...byAsset].map(([asset, ls]) => `${esc(amount(sumDecimal(ls.map((l) => l.units)), asset))}${txCount(ls) > 1 ? ` <small>in ${txCount(ls)} transactions</small>` : ''}`).join('<br>');
  const priced = counted.filter((l) => l.usdThen !== null);
  const then = priced.length === counted.length ? esc(usd(priced.reduce((s, l) => s + l.usdThen, 0))) : priced.length ? `${esc(usd(priced.reduce((s, l) => s + l.usdThen, 0)))} <small>for the priced legs</small>` : 'No market price';
  const todayOk = counted.every((l) => l.todayApplicable);
  const today = todayOk ? '<span class="lm-needs-js">Needs a live price</span>' : `<span>Not applicable</span><small>${prose(counted.find((l) => !l.todayApplicable).todayReason, e.id)}</small>`;
  const recent = e.legs.some((l) => l.time >= model.recent.start && l.time <= model.recent.end);
  const evidenceItems = e.legs.flatMap((l) => [evidence(l.from, 'Sender', l, e), evidence(l.to, 'Receiver', l, e)]).filter(Boolean);
  const unique = [...new Set(evidenceItems)];
  const attributions = e.attributions.map((a) => `<li><b>Attribution</b>: ${prose(a.claim, e.id)} <span class="lm-dim">(document dated ${esc(dateUTC(Date.parse(a.date)))})</span></li>`);
  const body = Object.keys(SECTION_TITLES).map((k) => `<section><h4>${SECTION_TITLES[k]}</h4>${e.sections[k].map((p) => `<p>${prose(p, e.id)}</p>`).join('')}</section>`).join('');
  return `<article class="lm-story" id="${e.id}" data-entry="${e.id}" data-group="${e.group}" data-category="${e.category}" data-chains="${esc(e.chains.join(' '))}" data-t="${e.time}" data-then="${priced.reduce((s, l) => s + l.usdThen, 0) || 0}" data-recent="${recent}">
  <header>
    <div class="lm-story-meta"><time datetime="${isoDate(e.time)}">${esc(dateUTC(e.time))}</time>${chains}<span class="lm-chip lm-chip-group"><i class="lm-dot" style="--c:${GROUP_COLORS[e.group]}"></i>${esc(e.categoryLabel)}</span></div>
    <h3><a class="lm-permalink" href="#${e.id}">${esc(e.title)}</a></h3>
    <p class="lm-dek">${prose(e.dek, e.id)}</p>
  </header>
  <dl class="lm-figures">
    <div><dt>Moved</dt><dd>${moved}</dd></div>
    <div><dt>Value at the time</dt><dd>${then}</dd></div>
    <div><dt>At today's price</dt><dd data-today="${e.id}">${today}</dd></div>
  </dl>
  <div class="lm-flows">${e.legs.map((l) => flow(l, e)).join('')}</div>
  <div class="lm-story-body">${body}</div>
  <p class="lm-status"><b>Status, ${esc(dateUTC(Date.parse(e.status.asOf)))}.</b> ${prose(e.status.text, e.id)}</p>
  <details class="lm-details">
    <summary>Facts, evidence and sources</summary>
    <p class="lm-criterion"><b>Why it is listed.</b> ${prose(e.criterion, e.id)}</p>
    ${e.legs.map((l) => legFacts(l)).join('')}
    <h5>Names</h5>
    <ul class="lm-evidence">${[...unique, ...attributions].join('') || '<li>No party is named: no explorer tag free of third-party credit and no primary document identifies these addresses.</li>'}</ul>
    ${e.matches.length ? `<h5>Proofs</h5><ul class="lm-proofs">${e.matches.map((m) => proofItem(m, e)).join('')}</ul>` : ''}
    ${(e.balances || []).length ? `<h5>Balance reads</h5><ul class="lm-proofs">${e.balances.map((b) => balanceItem(b)).join('')}</ul>` : ''}
    <h5>Sources</h5>
    <ol class="lm-sources">${e.sources.map((s) => sourceItem(s, e)).join('')}</ol>
  </details>
</article>`;
}

/* ---------------------------------------------------------------- measured section */

/** A wallet named only under D7: a clean tag re-read today; otherwise its role in the registry and a short address. */
function walletCell(address, tag) {
  const link = `<a class="mono" href="${esc(CHAIN_INFO.Ethereum.address(address))}" rel="noopener noreferrer">${esc(short(address))}</a>`;
  if (tag && tag.tag && !tag.compilation && !(tag.reports || []).length) return `<b>${esc(tag.tag)}</b> ${link}`;
  const why = tag && tag.compilation ? 'its tag is credited to a compilation' : tag && (tag.reports || []).length ? 'its tag rests on a third-party report' : 'no public tag';
  return `<span class="lm-dim">Not named (${why})</span> ${link}`;
}
/** Whose balance was destroyed. Two holders read oddly but are real: tokens sent by mistake to the USDT contract itself
 *  or to the zero address, frozen and later destroyed. */
function frozenCell(holder) {
  const h = String(holder || '').toLowerCase();
  const where = h === '0xdac17f958d2ee523a2206206994597c13d831ec7' ? 'Held at the USDT contract itself' : /^0x0{40}$/.test(h) ? 'Held at the zero address' : 'Frozen address';
  return `<span class="lm-dim">${where}</span> <span class="mono">${esc(short(h))}</span>`;
}
const txCell = (txid) => `<a class="mono" href="${esc(CHAIN_INFO.Ethereum.tx(txid))}" rel="noopener noreferrer">${esc(short(txid))}</a>`;
const valueCell = (x) => (x.usd === null || x.usd === undefined ? 'no market price' : esc(usd(x.usd)));
const notMeasured = (t) => `<p class="lm-not-measured">Not measured for this window: part of it could not be read (${esc(t.error || 'unknown error')}), and an unread range cannot be ranked.</p>`;

export function renderMeasured(model) {
  const m = model.measured;
  if (!m) return '';
  const w = m.window;
  const {usdt, usdc, transfers} = m.tables;
  const usdtRows = usdt.complete ? usdt.events.map((e) => [
    `<time>${esc(dateUTC(e.time))}</time>`,
    e.type === 'Issue' ? 'Added (Issue)' : e.type === 'Redeem' ? 'Removed (Redeem)' : 'Frozen tokens destroyed',
    esc(amount(e.amount, 'USDT')),
    valueCell(e),
    e.caller ? walletCell(e.caller, e.callerTag) : frozenCell(e.holder),
    txCell(e.txid),
  ]) : [];
  const usdcRows = usdc.complete ? usdc.events.map((e) => [
    `<time>${esc(dateUTC(e.time))}</time>`,
    e.kind === 'Mint' ? 'Minted' : 'Burned',
    esc(amount(e.amount, 'USDC')),
    valueCell(e),
    walletCell(e.minter, usdc.minters[e.minter]),
    txCell(e.txid),
  ]) : [];
  const xRows = transfers.complete ? transfers.cross.map((x) => [
    `<time>${esc(dateUTC(x.time))}</time>`,
    walletCell(x.from, x.fromTag),
    walletCell(x.to, x.toTag),
    esc(amount(x.amount, x.asset)),
    valueCell(x),
    txCell(x.txid),
  ]) : [];
  const tbl = (head, rows) => `<div class="lm-table-wrap"><table class="lm-table"><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const internal = transfers.complete ? `<p class="lm-finding"><b>${transfers.top20Internal} of the 20 largest</b> transfers between registry wallets in the window were moves inside one operator. The map counts such moves as treasury, not activity, so they are not ranked here.</p>` : '';
  return `<section class="lm-section lm-measured" id="lm-measured" aria-labelledby="lm-measured-title">
  <div class="eyebrow"><span></span>MEASURED BY THIS PAGE</div>
  <h2 id="lm-measured-title">The latest window, read in full.</h2>
  <p class="lm-sub">Every Ethereum block from ${esc(dateUTC(Date.parse(w.start)))} to ${esc(dateUTC(Date.parse(w.end)))}, blocks ${groupDecimal(String(w.fromBlock))} to ${groupDecimal(String(w.toBlock))}, read on ${esc(dateUTC(Date.parse(m.measuredAt)))} in ${groupDecimal(String(m.requests))} requests. Each table says only what that read found: the largest it found, not the largest anywhere, and nothing about other chains or about transfers with only one known end.</p>
  <div class="lm-tables">
    <article class="lm-table-card" id="lm-m-usdt">
      <h3>USDT added to and removed from Ethereum</h3>
      <p class="lm-caption">Every Issue and Redeem event of Tether's USDT contract in the window, and the largest destructions of frozen balances. Redeem is the contract's own word: it removes tokens from Ethereum's supply, and says nothing by itself about dollars paid out. The account is, for an Issue or a Redeem, the one that signed and sent the transaction, acting through the contract's owner (the multisig the Tether story above names by its tag); for a destruction, it is the frozen holder whose balance was destroyed.</p>
      ${usdt.complete ? tbl(['Date', 'Event', 'Amount', 'Value then', 'Account', 'Transaction'], usdtRows) : notMeasured(usdt)}
    </article>
    <article class="lm-table-card" id="lm-m-usdc">
      <h3>The largest USDC mints and burns</h3>
      <p class="lm-caption">Mint and Burn events by every USDC minter except Circle's cross-chain minters, which its own explorer tags identify; their mints move USDC between chains rather than add to it.</p>
      ${usdc.complete ? tbl(['Date', 'Event', 'Amount', 'Value then', 'Minter', 'Transaction'], usdcRows) : notMeasured(usdc)}
    </article>
    <article class="lm-table-card" id="lm-m-transfers">
      <h3>The largest transfers between two operators</h3>
      <p class="lm-caption">USDT and USDC transfers with both ends in the map's registry of ${groupDecimal(String(transfers.wallets || 0))} Ethereum wallets, between different operators. A wallet is named only when its explorer tag, read again today, credits no outside source.</p>
      ${transfers.complete ? tbl(['Date', 'From', 'To', 'Amount', 'Value then', 'Transaction'], xRows) + internal : notMeasured(transfers)}
    </article>
  </div>
</section>`;
}

/* ---------------------------------------------------------------- analysis */

/** What came back after each theft: what the chain or the victim's own statement shows, else an honest blank. A list,
 *  not a chart: a return read from the chain, a fork and a statement are not alike enough to share an axis. */
function returnedFigure(model) {
  const thefts = model.entries.filter((e) => e.category === 'theft');
  if (!thefts.length) return '';
  const rows = thefts.map((e) => `<div><dt><a href="#${e.id}">${esc(e.title)}</a> <span class="lm-dim">${esc(dateUTC(e.time))}</span></dt><dd>${e.returned ? prose(e.returned.text, e.id) : 'No source this page read gives a figure.'}</dd></div>`).join('');
  return `<figure class="lm-chart lm-returned" id="lmc-returned"><figcaption><h3>What came back</h3><p>For each theft on this page, what the chain or the victim's own statement shows was returned, recovered or frozen. Markers link to the sources in each story.</p></figcaption><dl class="lm-returned-list">${rows}</dl></figure>`;
}

export function renderAnalysis(model) {
  const charts = [thenTodayChart(model), shareChart(model), feeChart(model), returnedFigure(model), supplyChart(model)].filter(Boolean);
  if (!charts.length) return '';
  return `<section class="lm-section lm-analysis" id="lm-analysis" aria-labelledby="lm-analysis-title">
  <div class="eyebrow"><span></span>WHAT THE RECORD SHOWS</div>
  <h2 id="lm-analysis-title">Reading the transactions side by side.</h2>
  <p class="lm-sub">Each chart is computed from the facts above. Hover a mark for its value, or open the numbers under each chart.</p>
  <div class="lm-charts">${charts.join('')}</div>
</section>`;
}

export function renderMethod(model) {
  const considered = (model.config && model.config.considered) || [];
  return `<section class="lm-method" id="lm-method" aria-labelledby="lm-method-title">
  <div class="eyebrow"><span></span>HOW THIS PAGE IS BUILT</div>
  <h2 id="lm-method-title">A record you can check.</h2>
  <div class="lm-method-grid">
    <div class="method-step"><span>01</span><div><h3>Read from the chain</h3><p>Every transaction is read from each public source that serves its chain, two operators for Bitcoin and three endpoints for Ethereum, and listed only if they agree and the block is final. Amounts come from the transaction itself: an output, a token event, or the internal calls a contract made.</p></div></div>
    <div class="method-step"><span>02</span><div><h3>Names need evidence</h3><p>A sender or receiver is named only by the explorer's own public tag, when the explorer credits no outside source, or by a court record, a government document or the party's own statement that identifies the address or the transaction. News and analytics firms never name anyone here. A person is named only on their own statement or a court record of conviction or plea.</p></div></div>
    <div class="method-step"><span>03</span><div><h3>Descriptions are matched, not assumed</h3><p>When a document describes a transaction without giving its id, the page reads every transaction in the stated window. The description identifies a transaction only if exactly one matches; otherwise the page says how many did.</p></div></div>
    <div class="method-step"><span>04</span><div><h3>Prices from traded candles</h3><p>The value at the time comes from the exchange candle containing the block, one minute where it traded, then hourly, then daily, and only from a candle with trades. Where no series reaches the date the page says so. Today's value uses live prices in your browser and is not shown for coins that can never move.</p></div></div>
  </div>
  <p class="lm-method-note">Sources are archived, and every quotation, address and transaction id a story relies on was found in the archived copy. Stories carry the date their status was last checked. This page uses its own evidence rule and never adds names to the map's registry.</p>
  ${considered.length ? `<h3 class="lm-considered-title">Considered, not listed</h3><ul class="lm-considered">${considered.map((c) => `<li><b>${esc(c.title)}</b> ${esc(c.reason)}</li>`).join('')}</ul>` : ''}
</section>`;
}

export function renderFooter(model) {
  return `<footer class="lm-footer"><p>Data as of ${esc(dateUTC(Date.parse(model.dataAsOf)))}. Blockchain Flow Map by Jake Percy. <a href="./">The live map</a> · <a href="llms.txt">llms.txt</a> · <a href="methodology.md">Map methodology</a></p></footer>`;
}

/** Every fragment the page template takes, keyed by its marker name (<!--lm:name-->). */
export function renderFragments(model) {
  return {
    hero: renderHero(model),
    field: renderField(model),
    legend: renderLegend(),
    stories: model.entries.map((e) => renderStory(e, model)).join('\n'),
    measured: renderMeasured(model),
    analysis: renderAnalysis(model),
    method: renderMethod(model),
    footer: renderFooter(model),
  };
}
