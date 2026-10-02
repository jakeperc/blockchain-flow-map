/**
 * The gate for the Landmarks page (decision D7 and the approved plan; HANDOFF section 19). Run by verify-all.mjs with
 * the compiled lib/atlas modules in argv[2], so a failure stops `pnpm build:live` before Vite runs.
 *
 *   node scripts/verify-landmarks.mjs <compiled-modules-dir>
 *
 * It fails when: any entry breaks a rule in scripts/landmarks/build.mjs (readings that disagree or are not final, an
 * amount that does not follow from its declared basis, a name without D7 evidence, a person named without their own
 * statement or a conviction, a typed number or an unsupported superlative in prose, a source or quote that was not
 * found in its archived copy); lib/landmarks/data.ts differs from a fresh generation; a chain the map also reads
 * disagrees with lib/atlas/geography.ts; or the static page cannot be rendered. Its own checks are tested first, on
 * mutated copies of the recorded chain facts: a verifier that cannot fail proves nothing.
 */
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {ROOT, loadInputs, buildModel, typedNumbers, unsupportedSuperlatives, unitsToDecimal, scheduledBtc, sumDecimal, tagEvidenceProblems} from './landmarks/build.mjs';
import {amount} from '../lib/landmarks/format.ts';
import {renderData, DATA_FILE} from './landmarks/gen-landmarks.mjs';
import {renderFragments} from './landmarks/html.mjs';
import {CHAIN_INFO} from '../lib/landmarks/chains.ts';
import {makeFrame, placeLights, placeLabels, nearest, decadesFor} from '../lib/landmarks/field.ts';

const must = (cond, what) => {
  if (!cond) throw new Error(`landmarks self-test failed: ${what}`);
};
const clone = (o) => JSON.parse(JSON.stringify(o));

function selfTest(inputs) {
  must(typedNumbers('It moved 10,000 BTC.').length === 1, 'a typed amount must be flagged');
  must(typedNumbers('It moved {{leg1.amount}}.').length === 0, 'a placeholder is not a typed number');
  must(typedNumbers('He offered 10,000 bitcoins [1].').length === 0, 'a sourced figure is allowed');
  must(typedNumbers('The ERC-20 transfer moved {{leg1.amount}}.').length === 0, 'a name with digits is not a figure');
  must(unsupportedSuperlatives('It was the largest theft.').length === 1, 'an unsupported superlative must be flagged');
  must(unsupportedSuperlatives('It was the largest theft [2].').length === 0, 'a sourced superlative is allowed');
  must(unsupportedSuperlatives('The first transfer [m1].').length === 0, 'a superlative proven by a scan is allowed');
  must(unitsToDecimal('1000000000000', 8) === '10000', 'satoshis to BTC');
  must(unitsToDecimal('401346768858314986440099', 18) === '401346.768858314986440099', 'wei to ETH keeps every digit');
  must(unitsToDecimal('5', 6) === '0.000005', 'small amounts keep their leading zeros');
  must(scheduledBtc(0) === 50 && scheduledBtc(209999) === 10500000 && scheduledBtc(210000) === 10500025, 'the issuance schedule');

  // Rule tests: real entries and recorded facts, each mutated to break one rule.
  const base = clone(inputs);
  const errorsOf = (mutate) => {
    const x = clone(base);
    mutate(x);
    return buildModel(x).errors;
  };
  const entry = (x, id) => x.entries.find((e) => e.meta.id === id);
  const leg = (x, id) => entry(x, id).meta.legs[0];
  if (!entry(base, 'pizza-2010') || !entry(base, 'ronin-2022')) throw new Error('landmarks self-test needs the pizza-2010 and ronin-2022 pilot entries and their facts');
  must(errorsOf((x) => {
    const k = 'Bitcoin:a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d';
    x.facts.txs[k].readings[1].block += 1;
  }).some((e) => /readings disagree/.test(e)), 'two readings that disagree must fail');
  must(errorsOf((x) => {
    const k = 'Bitcoin:a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d';
    x.facts.txs[k].readings = x.facts.txs[k].readings.slice(0, 1);
  }).some((e) => /two agreeing readings/.test(e)), 'one reading on a two-operator chain must fail');
  must(errorsOf((x) => {
    const k = 'Bitcoin:a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d';
    for (const r of x.facts.txs[k].readings) r.confirmations = 2;
  }).some((e) => /not final/.test(e)), 'an unconfirmed transaction must fail');
  must(errorsOf((x) => {
    leg(x, 'pizza-2010').from = {role: 'the buyer', label: 'laszlo', person: true, personBasis: 'self', evidence: {kind: 'matched', source: 1, match: 'm1'}};
  }).some((e) => /must be the one that identified/.test(e)), 'a match that did not identify the transaction cannot name anyone');
  must(errorsOf((x) => {
    leg(x, 'pizza-2010').idSource = 'm1';
  }).some((e) => /candidates|found/.test(e)), 'a match with two candidates cannot identify a transaction');
  must(errorsOf((x) => {
    leg(x, 'ronin-2022').from.evidence.alerts = ['This address has been tagged based on hildobby compilation.'];
  }).some((e) => /credits this tag to a third party/.test(e)), 'a tag credited to a compilation cannot name anyone');
  must(errorsOf((x) => {
    entry(x, 'ronin-2022').meta.sources.find((s) => s.n === 2).addresses = [];
  }).some((e) => /does not list/.test(e)), 'a document that does not list the address cannot name it');
  must(errorsOf((x) => {
    const l = leg(x, 'ronin-2022');
    l.to.person = true;
  }).some((e) => /a person is named only/.test(e)), 'a person needs their own statement or a conviction');
  must(errorsOf((x) => {
    x.facts.sources[entry(x, 'ronin-2022').meta.sources[0].archive].found = [];
  }).some((e) => /does not contain 0x/.test(e)), 'a transaction id missing from the archived source must fail');
  must(errorsOf((x) => {
    const rec = x.facts.sources[entry(x, 'pizza-2010').meta.sources[0].archive];
    rec.quote = false;
    for (const q of Object.keys(rec.quotes || {})) rec.quotes[q] = false;
  }).some((e) => /does not contain the quote/.test(e)), 'a quote missing from the archived source must fail');
  must(errorsOf((x) => {
    entry(x, 'pizza-2010').sections.happened[0] = 'It cost 41 dollars.';
  }).some((e) => /typed into prose/.test(e)), 'a typed number in a story must fail');
  must(errorsOf((x) => {
    entry(x, 'pizza-2010').meta.title = '{{leg1.nonsense}}';
  }).some((e) => /unknown placeholder/.test(e)), 'an unknown placeholder must fail');
  must(errorsOf((x) => {
    const k = 'Ethereum:0xc28fad5e8d5e0ce6a2eaf67b6687be5d58113e16be590824d6cfa1a94467d0b7';
    x.facts.txs[k].trace.calls = x.facts.txs[k].trace.calls.map((c) => ({...c, value: '1'}));
  }).some((e) => /disagree/.test(e)), 'a trace that disagrees with the receipt event must fail');
  must(errorsOf((x) => {
    leg(x, 'ronin-2022').from.evidence.alerts = ['Public Name Tag. Submitted by Kleros Curate.'];
  }).some((e) => /credits this tag to a third party/.test(e)), 'a tag submitted through a curation service cannot name anyone');
  must(tagEvidenceProblems('Arbitrum', {host: CHAIN_INFO.Arbitrum.tagHost, tag: 'Example 1', read: '2026-10-02'}).some((p) => /shows no credit banners/.test(p)) && tagEvidenceProblems('Ethereum', {host: 'etherscan.io', tag: 'Example 1', read: '2026-10-02'}).length === 0, 'a tag read where the credit banners cannot be seen names nobody');

  // Rules added with the full entry set; each uses an all-time entry, so a monthly refresh cannot retire its test.
  for (const id of ['half-million-2011', 'silk-road-2020', 'dao-2016', 'first-eth-2015']) if (!entry(base, id)) throw new Error(`landmarks self-test needs the ${id} entry and its facts`);
  const legN = (x, id, n) => entry(x, id).meta.legs[n];
  must(errorsOf((x) => {
    legN(x, 'half-million-2011', 1).follows = 'leg9';
  }).some((e) => /follows leg9, which is not an earlier leg/.test(e)), 'a leg can follow only an earlier leg of its entry');
  must(errorsOf((x) => {
    legN(x, 'ronin-2022', 1).follows = 'leg1';
  }).some((e) => /follows leg1 but moves USDC, not ETH/.test(e)), 'a leg that follows another moves the same asset');
  {
    const x = clone(base);
    legN(x, 'half-million-2011', 1).follows = 'leg1';
    const e = buildModel(x).model.entries.find((m) => m.id === 'half-million-2011');
    must(e && e.legs[0].counted && !e.legs[1].counted, 'a following leg is shown but not counted');
  }
  must(errorsOf((x) => {
    entry(x, 'silk-road-2020').meta.legs.pop();
  }).some((e) => /which the entry leaves out/.test(e)), 'a complete set is shown whole');
  must(errorsOf((x) => {
    entry(x, 'silk-road-2020').meta.matches[0].set = false;
  }).some((e) => /candidates/.test(e)), 'outside a set, a match must find exactly one transaction');
  must(errorsOf((x) => {
    const r = x.facts.balances['Ethereum:0x304a554a310c7e546dfe434669c62820b7d83490@1720245'].readings;
    r[1].value = String(BigInt(r[1].value) + 1n);
  }).some((e) => /readings at block 1720245 disagree/.test(e)), 'balance readings that disagree must fail');
  must(errorsOf((x) => {
    const f = x.facts.balances['Ethereum:0x304a554a310c7e546dfe434669c62820b7d83490@1720245'];
    f.readings = f.readings.slice(0, 1);
  }).some((e) => /needs two agreeing readings/.test(e)), 'a balance read by one operator must fail');
  must(errorsOf((x) => {
    x.facts.matches['first-eth-2015/m1'].complete = false;
  }).some((e) => /incomplete, so uniqueness is not proven/.test(e)), 'an incomplete read of the earlier blocks proves nothing');
  must(errorsOf((x) => {
    const k = 'Bitcoin:29a3efd3ef04f9153d47a990bd7b048a4b2d213daaa5fb8ed670fb85f13bdbcf';
    x.facts.txs[k].funding.complete = false;
    entry(x, 'half-million-2011').sections.chain[0] = 'Its coins had sat for {{leg1.coinAge}}.';
  }).some((e) => /unknown placeholder \{\{leg1\.coinAge\}\}/.test(e)), 'coin age is stated only from a complete read of the funding transactions');

  // Features only the recent window uses today: tested whenever an entry uses them.
  const tokenEvent = base.entries.find((e) => (e.meta.legs || []).some((l) => l.basis === 'token-event'));
  if (tokenEvent) {
    must(errorsOf((x) => {
      entry(x, tokenEvent.meta.id).meta.legs.find((l) => l.basis === 'token-event').event = '0x00';
    }).some((e) => /is not the declared event/.test(e)), 'a supply event must be the event the leg declares');
  }
  const eventSet = base.entries.find((e) => (e.meta.matches || []).some((m) => m.type === 'evm-event-scan' && (e.meta.legs || []).some((l) => l.idSource === m.id)));
  if (eventSet) {
    must(errorsOf((x) => {
      entry(x, eventSet.meta.id).meta.legs.pop();
    }).some((e) => /which the entry leaves out/.test(e)), 'every event a scan finds is shown');
  }
  must(amount('0.000000000000031337', 'ETH') === '31,337 wei' && amount('5', 'BTC') === '5 BTC', 'a tiny amount is shown exactly, never rounded to nothing');
  must(sumDecimal(['7130.858709312', '1879.2', '223.2']) === '9233.258709312' && sumDecimal(['12.50']) === '12.5', 'amounts add exactly');

  // Field geometry.
  const f = makeFrame({width: 1000, height: 560, compact: false}, Date.UTC(2009, 0, 3), Date.UTC(2026, 9, 1), 0, 11);
  const pt = (k, day, usd, priority) => ({key: `${k}:leg1`, entry: k, label: `Label ${k}`, group: 'milestone', chain: 'Bitcoin', t: Date.UTC(2015, 0, day), asset: 'BTC', amount: 1, usdThen: usd, todayApplicable: true, measured: false, priority});
  const pts = [pt('a', 1, 1e6, 9), pt('b', 2, 1.01e6, 8), pt('c', 3, 1.02e6, 7)];
  const lights = placeLights(pts, f, 'then', null);
  const labels = placeLabels(pts, lights, f, 10);
  const box = (l) => {
    const w = l.text.length * 6.2;
    return l.anchor === 'start' ? [l.x, l.y - 12, l.x + w, l.y + 2] : [l.x - w, l.y - 12, l.x, l.y + 2];
  };
  const boxes = labels.map(box);
  must(labels.length >= 1 && labels.length <= 2, 'three coincident lights get at most one label on each side');
  must(boxes.every((b, i) => boxes.every((o, j) => i === j || b[2] <= o[0] || o[2] <= b[0] || b[3] <= o[1] || o[3] <= b[1])), 'placed labels never overlap');
  must(nearest(lights, lights[0].x - 3, lights[0].y + 20, 24) !== null && nearest(lights, lights[0].x, lights[0].y + 200, 24) === null, 'hit-testing finds the nearest light within its radius and nothing beyond it');
  must(decadesFor([null, 40, 2e9]).decMin <= 1 && decadesFor([40, 2e9]).decMax >= 10, 'the value range holds every value');
}

const out = process.argv[2];
try {
  const inputs = loadInputs(ROOT);
  selfTest(inputs);
  const {model, errors, warnings} = buildModel(inputs);
  for (const w of warnings) console.warn(`WARN ${w}`);
  if (errors.length) throw new Error(`landmarks: ${errors.length} problem(s)\n  - ${errors.join('\n  - ')}`);

  const fresh = renderData(model);
  const file = join(ROOT, DATA_FILE);
  if (!existsSync(file) || readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== fresh) throw new Error(`${DATA_FILE} is stale or missing; run node scripts/landmarks/gen-landmarks.mjs`);

  if (out) {
    const geo = createRequire(join(out, 'index.js'))('./geography.js');
    for (const [chain, info] of Object.entries(CHAIN_INFO)) {
      if (!geo.EXPLORERS[chain]) continue;
      const a = '0x0000000000000000000000000000000000000001';
      if (geo.EXPLORERS[chain].address(a) !== info.address(a) || geo.EXPLORERS[chain].tx(a) !== info.tx(a)) throw new Error(`lib/landmarks/chains.ts links ${chain} differently from lib/atlas/geography.ts`);
      if (geo.CHAIN_COLORS[chain] !== info.color) throw new Error(`lib/landmarks/chains.ts colours ${chain} ${info.color}; lib/atlas/geography.ts says ${geo.CHAIN_COLORS[chain]}`);
    }
  }

  const fragments = renderFragments(model);
  const html = Object.values(fragments).join('\n');
  if (/\{\{/.test(html)) throw new Error('the static page still has an unfilled placeholder');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`the static page repeats the id "${dup}"`);
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) if (!ids.includes(target)) throw new Error(`the static page links #${target}, which does not exist`);

  const legs = new Set(model.entries.flatMap((e) => e.legs.map((l) => `${l.chain}:${l.txid}`))).size;
  console.log(`PASS: landmarks (${model.entries.length} entries, ${legs} transactions read from every operator this page uses and in agreement, names under D7, sources found in their archived copies, data as of ${model.dataAsOf}; ${DATA_FILE} current; self-tests passed)`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
