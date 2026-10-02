/**
 * The analysis charts of the Landmarks page, rendered at build time as SVG with a table twin each (dataviz skill: thin
 * marks, 2px surface rings, hairline grids, text in text colours never in series colours, a legend for two or more
 * series, every value also readable in the table). Colours are the three validated group colours.
 */
import {GROUP_COLORS, GROUP_LABELS} from '../../lib/landmarks/field.ts';
import {usd, percent, dateUTC, timeUTC, escapeHtml as esc, amount as fmtAmount} from '../../lib/landmarks/format.ts';

const SURFACE = '#111a1e';
const GRID = '#ffffff10';
const MUTED = '#788c87';
const TEXT = '#c9d4cf';
const r1 = (n) => Math.round(n * 10) / 10;
/** The smallest share of supply the share chart draws (0.001%). */
const SHARE_FLOOR = 1e-5;
/** Axis ticks at powers of ten: 0.01%, 0.1%, 1%, 10%. */
const pctTick = (v) => `${Number((v * 100).toPrecision(1))}%`;
const decLabel = (d) => (d >= 12 ? `$${10 ** (d - 12)}T` : d >= 9 ? `$${10 ** (d - 9)}B` : d >= 6 ? `$${10 ** (d - 6)}M` : d >= 3 ? `$${10 ** (d - 3)}K` : `$${10 ** d}`);
const svgOpen = (w, h, title, desc, id) => `<svg class="lm-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(desc)}</desc>`;
const figure = (id, title, note, svg, table) => `<figure class="lm-chart" id="${id}"><figcaption><h3>${esc(title)}</h3><p>${note}</p></figcaption>${svg}<details class="lm-table-twin"><summary>Show the numbers</summary>${table}</details></figure>`;
const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table>`;
const legend = (items) => `<ul class="lm-legend lm-chart-legend">${items.map(([c, label, ring]) => `<li><i class="${ring ? 'lm-ring' : 'lm-dot'}" style="--c:${c}"></i>${esc(label)}</li>`).join('')}</ul>`;
const marker = (x, y, c, title) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="5" fill="${c}" stroke="${SURFACE}" stroke-width="2"><title>${esc(title)}</title></circle>`;

/** The legs whose coins count toward an entry's figures: a forward or a return of coins already shown is left out. */
const countedLegs = (e) => e.legs.filter((l) => l.counted);

/** How a chart names one transaction of an entry: the entry's label, plus the asset, day or time that tells its
 *  transactions apart when the entry contributes more than one. */
function legName(e, l, field = 'label') {
  const seen = new Set();
  const txs = countedLegs(e).filter((x) => !seen.has(x.txid) && seen.add(x.txid));
  if (txs.length < 2) return e[field];
  const day = (x) => dateUTC(x.time).replace(/ \d{4}$/, '');
  const parts = [];
  if (new Set(txs.map((x) => x.asset)).size > 1) parts.push(l.asset);
  if (new Set(txs.map(day)).size > 1) parts.push(day(l));
  if (txs.filter((x) => day(x) === day(l) && x.asset === l.asset).length > 1) parts.push(timeUTC(l.time).replace(' UTC', ''));
  return parts.length ? `${e[field]} (${parts.join(', ')})` : e[field];
}

/** One row per transaction (and asset): the outputs of one transaction are one dot, not several. */
function txRows(model, keep, byAsset = true) {
  return model.entries.flatMap((e) => {
    const groups = new Map();
    for (const l of countedLegs(e).filter(keep)) {
      const k = byAsset ? `${l.txid}:${l.asset}` : l.txid;
      groups.set(k, [...(groups.get(k) || []), l]);
    }
    return [...groups.values()].map((legs) => ({e, l: legs[0], legs}));
  });
}

/** Then (value at the time) and today (at the reference prices read on a stated date), on one log scale. */
export function thenTodayChart(model) {
  const ref = model.refPrices;
  if (!ref || !ref.usd) return '';
  const rows = model.entries.map((e) => {
    const legs = countedLegs(e);
    const then = legs.every((l) => l.usdThen !== null) ? legs.reduce((s, l) => s + l.usdThen, 0) : null;
    const today = legs.every((l) => l.todayApplicable && ref.usd[l.asset] > 0) ? legs.reduce((s, l) => s + l.amount * ref.usd[l.asset], 0) : null;
    return {e, then, today};
  }).filter((r) => r.today !== null);
  if (rows.length < 2) return '';
  const values = rows.flatMap((r) => [r.then, r.today]).filter((v) => v !== null);
  const lo = Math.floor(Math.log10(Math.min(...values)));
  const hi = Math.ceil(Math.log10(Math.max(...values)));
  const W = 640;
  const H = 380;
  const top = 28;
  const shelf = H - 34;
  const bottom = H - 62;
  const xa = 210;
  const xb = 430;
  const y = (v) => bottom - ((Math.log10(v) - lo) / Math.max(1, hi - lo)) * (bottom - top);
  const parts = [svgOpen(W, H, 'Value at the time and at today\'s price', 'For each entry, a line from its value when it happened to the same amount at reference prices. Entries with no market price at the time start on the shelf.', 'lmc-tt')];
  for (let d = lo; d <= hi; d += 1) parts.push(`<line x1="${xa - 40}" x2="${xb + 40}" y1="${r1(y(10 ** d))}" y2="${r1(y(10 ** d))}" stroke="${GRID}"/><text x="${xa - 48}" y="${r1(y(10 ** d) + 3.5)}" text-anchor="end" font-size="10" fill="${MUTED}">${decLabel(d)}</text>`);
  parts.push(`<rect x="${xa - 40}" y="${shelf - 10}" width="${xb - xa + 80}" height="20" fill="#ffffff06"/><text x="${xa - 48}" y="${shelf + 3.5}" text-anchor="end" font-size="10" fill="${MUTED}">No price</text>`);
  parts.push(`<text x="${xa}" y="14" text-anchor="middle" font-size="10.5" fill="${TEXT}">At the time</text><text x="${xb}" y="14" text-anchor="middle" font-size="10.5" fill="${TEXT}">At ${esc(dateUTC(Date.parse(ref.at)))} prices</text>`);
  const ends = [];
  for (const r of rows) {
    const c = GROUP_COLORS[r.e.group];
    const y0 = r.then === null ? shelf : y(r.then);
    const y1 = y(r.today);
    parts.push(`<line x1="${xa}" y1="${r1(y0)}" x2="${xb}" y2="${r1(y1)}" stroke="${c}" stroke-width="2" stroke-opacity="${r.then === null ? 0.45 : 0.9}" stroke-linecap="round"/>`);
    parts.push(marker(xa, y0, c, `${r.e.title}: ${r.then === null ? 'no market price' : usd(r.then)} at the time`));
    parts.push(marker(xb, y1, c, `${r.e.title}: ${usd(r.today)} at reference prices`));
    ends.push({y: y1, text: `${r.e.label} ${usd(r.today)}`});
  }
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  for (const t of ends) parts.push(`<text x="${xb + 12}" y="${r1(t.y + 3.5)}" font-size="10.5" fill="${TEXT}">${esc(t.text)}</text>`);
  parts.push('</svg>');
  const groups = [...new Set(rows.map((r) => r.e.group))];
  const note = `Reference prices from ${esc(ref.source)}, read ${esc(dateUTC(Date.parse(ref.at)))}; the stories above use live prices. Coins that can never move are left out.`;
  return figure('lmc-then-today', 'What the same amounts are worth now', note, parts.join('') + legend(groups.map((g) => [GROUP_COLORS[g], GROUP_LABELS[g]])), table(['Entry', 'At the time', 'At reference prices', 'Change'], rows.map((r) => [esc(r.e.title), r.then === null ? 'no market price' : esc(usd(r.then)), esc(usd(r.today)), r.then === null ? 'not defined' : `${(r.today / r.then).toFixed(r.today / r.then >= 10 ? 0 : 2)} times`])));
}

/** Share of supply at the block, on a log axis: dots, not bars, because a log axis has no zero for a bar to start from. */
export function shareChart(model) {
  // Outputs of one transaction share a block and so a denominator: their shares add up.
  // A test payment worth a millionth of supply would stretch the axis across decades of nothing; the note says so.
  const rows = txRows(model, (l) => l.share).map((r) => ({...r, v: r.legs.reduce((s, l) => s + l.share.value, 0)})).filter((r) => r.v >= SHARE_FLOOR).sort((a, b) => b.v - a.v);
  if (rows.length < 2) return '';
  const W = 640;
  const rowH = 30;
  const H = 40 + rows.length * rowH + 26;
  const x0 = 210;
  const x1 = W - 70;
  const lo = Math.floor(Math.log10(Math.min(...rows.map((r) => r.v)))) ;
  const hi = Math.ceil(Math.log10(Math.max(...rows.map((r) => r.v))));
  const x = (v) => x0 + ((Math.log10(v) - lo) / Math.max(1, hi - lo)) * (x1 - x0);
  const parts = [svgOpen(W, H, 'Share of supply moved', 'Each dot is one transaction: the share of all the coins in existence at that block that it moved, on a logarithmic scale.', 'lmc-share')];
  for (let d = lo; d <= hi; d += 1) parts.push(`<line x1="${r1(x(10 ** d))}" x2="${r1(x(10 ** d))}" y1="24" y2="${H - 24}" stroke="${GRID}"/><text x="${r1(x(10 ** d))}" y="${H - 8}" text-anchor="middle" font-size="10" fill="${MUTED}">${pctTick(10 ** d)}</text>`);
  rows.forEach((r, i) => {
    const yy = 40 + i * rowH;
    const c = GROUP_COLORS[r.e.group];
    parts.push(`<text x="${x0 - 14}" y="${yy + 3.5}" text-anchor="end" font-size="10.5" fill="${TEXT}">${esc(legName(r.e, r.l))}</text>`);
    parts.push(`<line x1="${x0}" x2="${r1(x(r.v))}" y1="${yy}" y2="${yy}" stroke="${c}" stroke-opacity=".35" stroke-width="2"/>`);
    parts.push(marker(x(r.v), yy, c, `${r.e.title}: ${percent(r.v)} of ${r.l.share.of}`));
    parts.push(`<text x="${r1(x(r.v) + 10)}" y="${yy + 3.5}" font-size="10.5" fill="${TEXT}">${esc(percent(r.v))}</text>`);
  });
  parts.push('</svg>');
  const note = 'Bitcoin against the coins its issuance schedule allowed by that block; stablecoins against their Ethereum supply at that block, read from the contract. Not shown for ETH, whose supply no keyless call returns, or for transactions under 0.001% of supply.';
  const groups = [...new Set(rows.map((r) => r.e.group))];
  return figure('lmc-share', 'How much of everything that existed', note, parts.join('') + legend(groups.map((g) => [GROUP_COLORS[g], GROUP_LABELS[g]])), table(['Transaction', 'Share', 'Of'], rows.map((r) => [esc(legName(r.e, r.l, 'title')), esc(percent(r.v)), esc(r.l.share.of)])));
}

/** What moving it cost: fee against the value moved, both in US dollars at the time, on log axes. */
export function feeChart(model) {
  // One dot per transaction: the value of everything it moved, and the fee it paid once.
  const rows = txRows(model, (l) => l.usdThen !== null && l.then && l.then.kind === 'candle' && l.feeUsd !== null, false)
    .map((r) => ({...r, moved: r.legs.reduce((s, l) => s + l.usdThen, 0), fee: r.l.feeUsd}))
    .filter((r) => r.fee > 0);
  if (rows.length < 2) return '';
  const W = 640;
  const H = 360;
  const left = 70;
  const right = W - 24;
  const top = 18;
  const bottom = H - 40;
  const lx = rows.map((r) => Math.log10(r.moved));
  const ly = rows.map((r) => Math.log10(r.fee));
  const [xlo, xhi] = [Math.floor(Math.min(...lx)), Math.ceil(Math.max(...lx))];
  const [ylo, yhi] = [Math.floor(Math.min(...ly)), Math.ceil(Math.max(...ly))];
  const x = (v) => left + ((Math.log10(v) - xlo) / Math.max(1, xhi - xlo)) * (right - left);
  const y = (v) => bottom - ((Math.log10(v) - ylo) / Math.max(1, yhi - ylo)) * (bottom - top);
  const parts = [svgOpen(W, H, 'Fee paid against value moved', 'Each dot is one transaction: horizontally the value it moved, vertically the fee it paid, both in US dollars at the time, on logarithmic scales.', 'lmc-fee')];
  for (let d = xlo; d <= xhi; d += 1) parts.push(`<line x1="${r1(x(10 ** d))}" x2="${r1(x(10 ** d))}" y1="${top}" y2="${bottom}" stroke="${GRID}"/><text x="${r1(x(10 ** d))}" y="${H - 22}" text-anchor="middle" font-size="10" fill="${MUTED}">${decLabel(d)}</text>`);
  for (let d = ylo; d <= yhi; d += 1) parts.push(`<line x1="${left}" x2="${right}" y1="${r1(y(10 ** d))}" y2="${r1(y(10 ** d))}" stroke="${GRID}"/><text x="${left - 8}" y="${r1(y(10 ** d) + 3.5)}" text-anchor="end" font-size="10" fill="${MUTED}">${decLabel(d)}</text>`);
  parts.push(`<text x="${(left + right) / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="${MUTED}">Value moved, at the time</text><text x="14" y="${(top + bottom) / 2}" transform="rotate(-90 14 ${(top + bottom) / 2})" text-anchor="middle" font-size="10" fill="${MUTED}">Fee paid</text>`);
  // One label per entry, on its largest transaction, placed right of the dot or else left of it, and dropped when it
  // would collide with a placed label or a dot: every value is still in its tooltip and the table.
  const labelled = new Set();
  const placed = [];
  const dots = rows.map((r) => [x(r.moved) - 6, y(r.fee) - 6, x(r.moved) + 6, y(r.fee) + 6]);
  const hits = (b) => placed.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) || dots.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const inside = (b) => b[0] >= left && b[2] <= right && b[1] >= top - 4 && b[3] <= bottom;
  for (const r of [...rows].sort((a, b) => b.moved - a.moved)) {
    parts.push(marker(x(r.moved), y(r.fee), GROUP_COLORS[r.e.group], `${legName(r.e, r.l, 'title')}: moved ${usd(r.moved)}, fee ${usd(r.fee)}`));
    if (labelled.has(r.e.id)) continue;
    const w = r.e.label.length * 5.4;
    const cx = x(r.moved);
    const cy = y(r.fee);
    const right1 = [cx + 9, cy - 16, cx + 9 + w, cy - 5];
    const left1 = [cx - 9 - w, cy - 16, cx - 9, cy - 5];
    const box = inside(right1) && !hits(right1) ? right1 : inside(left1) && !hits(left1) ? left1 : null;
    if (!box) continue;
    labelled.add(r.e.id);
    placed.push(box);
    parts.push(`<text x="${r1(box[0])}" y="${r1(cy - 7)}" font-size="10" fill="${TEXT}">${esc(r.e.label)}</text>`);
  }
  parts.push('</svg>');
  const groups = [...new Set(rows.map((r) => r.e.group))];
  return figure('lmc-fee', 'What moving it cost', 'Fees at the price of the fee asset in the same candle as the transaction. Transactions without a market price at the time are left out.', parts.join('') + legend(groups.map((g) => [GROUP_COLORS[g], GROUP_LABELS[g]])), table(['Transaction', 'Value moved', 'Fee', 'Fee as a share'], rows.map((r) => [esc(legName(r.e, r.l, 'title')), esc(usd(r.moved)), esc(usd(r.fee)), esc(percent(r.fee / r.moved))])));
}

/** Every USDT Issue and Redeem on Ethereum since launch, from our complete read; the recent window is shaded. */
export function supplyChart(model) {
  const t = model.measured && model.measured.tables.usdt;
  if (!t || !t.complete || !t.history || t.history.length < 2) return '';
  const ev = t.history.map((h) => ({...h, v: Number(h.amount)}));
  const W = 640;
  const H = 300;
  const left = 56;
  const right = W - 16;
  const mid = 150;
  const span = 112;
  const t0 = Math.min(...ev.map((e) => e.time));
  const t1 = Math.max(model.recent.end, ...ev.map((e) => e.time));
  const max = Math.max(...ev.map((e) => e.v));
  const x = (ms) => left + ((ms - t0) / Math.max(1, t1 - t0)) * (right - left);
  const h = (v) => (v / max) * span;
  const issue = GROUP_COLORS.milestone;
  const redeem = GROUP_COLORS.theft;
  const parts = [svgOpen(W, H, 'USDT added to and removed from Ethereum', 'Each stem is one Issue event (above the line) or Redeem event (below), sized by amount, from the contract\'s launch to the end of the recent window.', 'lmc-supply')];
  parts.push(`<rect x="${r1(x(model.recent.start))}" y="20" width="${r1(Math.max(2, x(model.recent.end) - x(model.recent.start)))}" height="${H - 64}" fill="#d7bc8314"/><text x="${r1(x(model.recent.start) - 4)}" y="16" text-anchor="end" font-size="10" fill="${MUTED}">Recent window</text>`);
  parts.push(`<line x1="${left}" x2="${right}" y1="${mid}" y2="${mid}" stroke="${MUTED}" stroke-opacity=".5"/>`);
  for (const g of [max / 2, max]) {
    parts.push(`<text x="${left - 6}" y="${r1(mid - h(g) + 3.5)}" text-anchor="end" font-size="10" fill="${MUTED}">${esc(usd(g).replace('$', ''))}</text><text x="${left - 6}" y="${r1(mid + h(g) + 3.5)}" text-anchor="end" font-size="10" fill="${MUTED}">${esc(usd(g).replace('$', ''))}</text>`);
  }
  for (const e of ev) {
    const c = e.type === 'Issue' ? issue : redeem;
    const yy = e.type === 'Issue' ? mid - h(e.v) : mid + h(e.v);
    parts.push(`<line x1="${r1(x(e.time))}" x2="${r1(x(e.time))}" y1="${mid}" y2="${r1(yy)}" stroke="${c}" stroke-width="1.5" stroke-opacity=".75"><title>${esc(`${e.type === 'Issue' ? 'Added' : 'Removed'} ${fmtAmount(e.amount, 'USDT')}, ${dateUTC(e.time)}`)}</title></line>`);
  }
  for (let year = new Date(t0).getUTCFullYear() + 1; year <= new Date(t1).getUTCFullYear(); year += 1) {
    if (year % 2) continue;
    const xx = x(Date.UTC(year, 0, 1));
    parts.push(`<text x="${r1(xx)}" y="${H - 18}" text-anchor="middle" font-size="10" fill="${MUTED}">${year}</text>`);
  }
  parts.push('</svg>');
  const largest = [...ev].sort((a, b) => b.v - a.v).slice(0, 12);
  const note = `A complete read of the contract's Issue and Redeem events, ${ev.length} in all. Redeem is the contract's own word: it removes tokens from Ethereum's supply, and says nothing by itself about dollars paid out.`;
  return figure('lmc-supply', 'USDT on Ethereum, issue by issue', note, parts.join('') + legend([[issue, 'Added (Issue)'], [redeem, 'Removed (Redeem)']]), table(['Date', 'Event', 'Amount'], largest.map((e) => [esc(dateUTC(e.time)), e.type === 'Issue' ? 'Added (Issue)' : 'Removed (Redeem)', esc(fmtAmount(e.amount, 'USDT'))])));
}
