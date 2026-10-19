/**
 * llms.txt, methodology.md and the page surfaces that point to them, for dist-live/.
 *
 * The map is drawn by script and its numbers exist only inside a visitor's browser, so a fetcher that runs no
 * JavaScript sees an empty <div id="root">. This writes the plain-text description such a reader needs: what the page
 * is, how to read it, what it does not show, where its data comes from, and what an agent cannot get.
 *
 * Nothing is typed twice. The prose is live-lite/llms.txt.tpl; everything that moves (chains, assets, registry
 * counts, the evidence-expiry date, the polling and unlock thresholds) is read from the code and stamped into one
 * block, dated with the data's own date. docs/METHODOLOGY.md becomes the public methodology.md.
 *
 * Hooks: vite.live.config.ts (the build; emits the files and injects the head tags and <noscript> block) and
 * scripts/verify-llms.mjs (the gate; same render over the modules verify-all.mjs has already compiled).
 *
 * Checks run on every render and, because this build only ever runs interactively, FAIL the build (STRICT):
 *  - the contract JakePercy.com/scripts/check-llms.mjs enforces: ASCII, under 10 KB, shape, links;
 *  - every sentence the template quotes from the page is still in the page's source;
 *  - every UI term, external link and hard fact the prose leans on is still in the source (TERMS, urlStateProblems);
 *  - no number is hand-typed in the prose (volatile numbers are stamped);
 *  - the published methodology has no internal reference left, and agrees with the code on the chain list,
 *    the unlock share and the evidence horizon;
 *  - the page's meta description still names exactly the chains the build reads.
 * If this build is ever automated, set STRICT to false: a failure then drops the files and warns instead of throwing.
 *
 *   node scripts/llms/render.mjs                 print llms.txt (compiles the atlas modules; run from anywhere)
 *   node scripts/llms/render.mjs --methodology   print the public methodology
 *   node scripts/llms/render.mjs --surfaces      print the head tags and the <noscript> block
 *   node scripts/llms/render.mjs --trace         every quoted sentence with the file and line it was found at
 *   node scripts/llms/render.mjs --dist          check an existing dist-live/ (run after `pnpm build:live`)
 *
 * The sentences that must equal the hub's summary sheet (JakePercy.com/content/llms/sites.json, slug
 * global-blockchain-flow) are SUMMARY and CAVEAT below. llms.txt opens with `> SUMMARY CAVEAT`; the hub's
 * check-llms.mjs compares. Do not edit either without the sheet.
 */
import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE = 'https://jakepercy.com/global-blockchain-flow/';
export const HUB = 'https://jakepercy.com/llms.txt';
/** If the host serves .md without a content type, change this to '.txt'; nothing else needs to change. */
export const METHOD_EXT = '.md';
export const STRICT = true;
export const MAX_BYTES = 10 * 1024;
/** The dormancy measurement is redone monthly and the build refuses one older than 45 days (verify-registry.cjs). */
const STALE_AFTER_DAYS = 45;
/** Must equal the sheet's row. */
export const SUMMARY = "A live, evidence-only map of cross-border stablecoin settlement, read directly from public blockchains by the visitor's browser.";
export const CAVEAT = "It deliberately shows only a small fraction of onchain volume, and an address does not reveal its owner's physical location.";
/** The page's own drawing rule. Used verbatim in llms.txt and in the <noscript> block, and checked against the page. */
export const RULE = 'A route is drawn only when both ends of a transfer are publicly evidenced wallets in different jurisdictions. Most transfers are not, by design.';
const TEMPLATE = 'live-lite/llms.txt.tpl';
const METHODOLOGY = 'docs/METHODOLOGY.md';
const INDEX = 'live-lite/index.html';
/** The second page (HANDOFF section 19): static story text, so it gets its own canonical and og tags and no <noscript>. */
const LANDMARKS = 'live-lite/landmarks.html';
export const LANDMARKS_PAGE = 'landmarks.html';
/** The project's own links (author, site, repository), which the page imports as constants and this file reads as text. */
const LINKS = 'lib/site/links.ts';
/** The link-preview image: the globe's cartography only (land, outlines, the day-night line), never a route or a figure,
 *  because a preview is shown for weeks beside no window and no caveat. 1200 x 630. */
export const OG_IMAGE = 'og.jpg';
const OG_ALT = 'The Blockchain Flow Map globe: dotted land and the day-night line, with no routes drawn.';
const BUILT_NAMES = ['index.html', 'llms.txt', `methodology${METHOD_EXT}`, LANDMARKS_PAGE, OG_IMAGE];

export function siteLinks(root = ROOT) {
  const text = readFileSync(join(root, LINKS), 'utf8');
  const get = (name) => (text.match(new RegExp(`export const ${name}='([^']*)'`)) || [])[1] ?? '';
  return {author: get('AUTHOR'), hub: get('HUB_URL'), repo: get('REPO_URL'), linkedin: get('LINKEDIN_URL')};
}

/* ------------------------------------------------------------------------------------------ text helpers */

const U = String.fromCodePoint;
const chars = (...codes) => new RegExp(`[${U(...codes)}]`, 'g');
/** Typographic characters folded to ASCII, written as code points so the source stays plain ASCII and nothing invisible
 *  hides in a regex: curly quotes, dashes, ellipsis, middle dot, arrows, comparison and currency signs, odd spaces. */
const FOLD = [
  [chars(0x2018, 0x2019, 0x201A, 0x2032), "'"],
  [chars(0x201C, 0x201D, 0x201E, 0x2033), '"'],
  [new RegExp(`\\s*[${U(0x2014, 0x2015)}]\\s*`, 'g'), ' - '],
  [chars(0x2010, 0x2011, 0x2012, 0x2013, 0x2212), '-'],
  [chars(0x2026), '...'],
  [new RegExp(`\\s*${U(0xB7)}\\s*`, 'g'), ', '],
  [chars(0x2192), '->'],
  [chars(0x2265), '>='],
  [chars(0x2264), '<='],
  [chars(0xD7), 'x'],
  [chars(0xF7), '/'],
  [chars(0x20AC), 'EUR '],
  [chars(0xA3), 'GBP '],
  [chars(0xA0, 0x2007, 0x2009, 0x200A, 0x202F), ' '],
  [chars(0x200B, 0x200C, 0x200D, 0xFEFF), ''],
];
/** Fold to ASCII. The host serves .txt with no charset header, so anything else arrives garbled. */
export function ascii(s) {
  let out = String(s == null ? '' : s);
  for (const [re, to] of FOLD) out = out.replace(re, to);
  return out.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
}
const collapse = (s) => s.replace(/\s+/g, ' ').trim();
const read = (root, rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const number = (n) => n.toLocaleString('en-US');
const joinAnd = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const duration = (ms) => (ms % 60000 === 0 ? `${ms / 60000} minute${ms === 60000 ? '' : 's'}` : `${Math.round(ms / 1000)} seconds`);

const ENTITY = {'&apos;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&rsquo;': U(0x2019), '&lsquo;': U(0x2018), '&ldquo;': U(0x201C), '&rdquo;': U(0x201D), '&mdash;': U(0x2014), '&ndash;': U(0x2013), '&middot;': U(0xB7), '&amp;': '&'};
const decode = (s) => s.replace(/&(?:apos|quot|lt|gt|nbsp|rsquo|lsquo|ldquo|rdquo|mdash|ndash|middot|amp);/g, (m) => ENTITY[m]);
/** Markup-ish tags only: a `<` must be followed by a tag name, so `a<b` comparisons are left alone. */
const TAGS = /<\/?[A-Za-z][A-Za-z0-9.]*(?:\s[^<>]*)?\/?>/g;
/** A source file flattened the two ways a sentence can sit in it: as written, and with JSX/HTML tags removed. */
const flatten = (raw) => {
  const text = decode(raw);
  return {as: collapse(ascii(text)), bare: collapse(ascii(text.replace(TAGS, '')))};
};

/* ------------------------------------------------------------------------------------------ facts from code */

/** The compiled lib/atlas modules (what verify-all.mjs already compiled), or null if they cannot be loaded. */
export function loadCompiled(out) {
  const req = createRequire(join(out, 'index.js'));
  return Object.fromEntries(['model', 'feeds', 'evm', 'known-entities', 'known-addresses'].map((m) => [m, req(`./${m}.js`)]));
}

/** Compile and load them the way the diagnostics do (scripts/atlas-modules.mjs). That helper resolves tsc and the
 *  sources against the working directory, so it runs from the repo root whatever the caller's directory is. */
export async function loadAtlasFor(root = ROOT) {
  const {loadAtlas} = await import(pathToFileURL(join(root, 'scripts', 'atlas-modules.mjs')).href);
  const cwd = process.cwd();
  try {
    process.chdir(root);
    return loadAtlas();
  } finally {
    process.chdir(cwd);
  }
}

/** Tunables that live as constants in live-client.ts (not exported, and importing the client would pull in the DOM).
 *  A constant that cannot be read comes back null and the sentence that uses it loses its number. */
function tunables(root) {
  const src = read(root, 'lib/atlas/live-client.ts');
  const num = (name) => {
    const m = src.match(new RegExp(`\\b${name}\\s*=\\s*(\\d*\\.?\\d+)`));
    return m && Number(m[1]) > 0 ? Number(m[1]) : null;
  };
  return {pollMs: num('POLL_MS'), priceMs: num('PRICE_MS'), sampleMs: num('SAMPLE_MS'), unlockShare: num('UNLOCK_SHARE')};
}

/** How many days an evidence row stays admissible: asked of the model's own admissible(), not parsed out of it. */
function horizonDays(model) {
  const at = Date.UTC(2026, 0, 1);
  const probe = {entity: 'probe', addressCluster: 'probe', category: 'probe', jurisdiction: 'US', confidence: 'HIGH', score: 0.8, source: 'probe', sourceUrl: null, evidenceNote: 'probe', association: 'operating entity'};
  const ok = (days) => model.admissible({...probe, lastVerified: new Date(at - days * 86400000).toISOString()}, at);
  if (!ok(0)) throw new Error('admissible() rejects fresh evidence');
  let n = 0;
  while (n < 1000 && ok(n + 1)) n += 1;
  return n;
}

export function collectFacts(root, atlas) {
  const {model, feeds, evm} = atlas;
  const ke = atlas['known-entities'];
  const ka = atlas['known-addresses'];
  const live = model.CHAINS.filter((c) => c in feeds.FEEDS);
  const stats = ke.registryStats();
  const health = ke.registryHealth();
  const checked = Object.values(ka.ADDRESSES).map((r) => r.checked).sort();
  const asOf = [ka.DORMANCY.measuredAt, checked[checked.length - 1]].filter(Boolean).sort().pop();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf || '')) throw new Error('no usable data date in the registry');
  if (!Number.isFinite(health.earliestExpiry)) throw new Error('registryHealth() has no earliest expiry');
  const {pollMs, priceMs, sampleMs, unlockShare} = tunables(root);
  return {
    asOf,
    chains: live.map((name) => ({name, assets: [...new Set(Object.values(evm.CONTRACTS[name] || {}).map((t) => t.asset))].sort()})),
    notConnected: model.CHAINS.filter((c) => !(c in feeds.FEEDS)),
    windows: Object.keys(model.WINDOWS),
    registry: {
      addresses: stats.addresses,
      derived: stats.derived,
      entities: stats.entities,
      jurisdictions: Object.keys(stats.byJurisdiction).length,
    },
    expiry: new Date(health.earliestExpiry).toISOString().slice(0, 10),
    horizonDays: horizonDays(model),
    dormancy: ka.DORMANCY,
    pollMs, priceMs, sampleMs, unlockShare,
    allChains: model.CHAINS,
    evmChains: model.EVM_CHAINS,
  };
}

/** The one block of volatile facts. Each number carries its unit and its caveat in the same sentence. */
function currentState(f) {
  const chains = f.chains.map((c) => `${c.name} (${c.assets.join(', ')})`).join('; ');
  const r = f.registry;
  const parts = [
    `Chains this build reads live, with the stablecoins read on each: ${chains}.`,
    f.notConnected.length ? `${joinAnd(f.notConnected)} ${f.notConnected.length === 1 ? 'is' : 'are'} not connected (the page lists ${f.notConnected.length === 1 ? 'it' : 'them'} as Not connected).` : '',
    `The registry bundled into this build holds ${number(r.addresses)} addresses with a public name tag read on that chain's own block explorer and ${number(r.derived)} derived addresses, covering ${number(r.entities)} operating entities in ${number(r.jurisdictions)} jurisdictions; these count addresses with evidence, not wallets watched, value moved or any share of the market.`,
    `Evidence older than ${f.horizonDays} days stops counting toward routes, and the earliest evidence in this build reaches that age on ${f.expiry}.`,
    `The list sent to the nodes leaves out addresses that moved no USDC or USDT in the ${f.dormancy.windowDays} days to ${f.dormancy.measuredAt}: such an address is still attributed when the other end of a transfer is on the list, a transfer between two off-list addresses is not requested, and a wallet that wakes up is added at the next measurement.`,
    f.unlockShare ? `24H and 7D appear only once a browser has recorded at least ${Math.round(f.unlockShare * 100)}% of the window.` : '',
    f.pollMs && f.priceMs && f.sampleMs ? `A browser polls each chain about every ${duration(f.pollMs)}, refreshes prices about every ${duration(f.priceMs)} and reads a small unfiltered sample of chain time about every ${duration(f.sampleMs)}.` : '',
  ];
  return `**Current state (data as of ${f.asOf}; treat as stale after ${STALE_AFTER_DAYS} days).** ${parts.filter(Boolean).join(' ')}`;
}

/* ------------------------------------------------------------------------------------------ the source checks */

/** Where each hand-written sentence of the template may be quoted from: the page, the client and the methodology. */
const QUOTE_SOURCES = ['components/atlas.tsx', 'lib/atlas/live-client.ts', METHODOLOGY, INDEX, 'components/map-fallback.tsx', LANDMARKS, 'scripts/landmarks/html.mjs'];

/** Terms the prose names without quoting them. Each must still be in the file; a rename there fails the build here. */
const TERMS = {
  'components/atlas.tsx': ['Unmapped', 'Methodology', 'Playback', 'Raw events', 'Largest unplaced counterparties', 'EQUAL EARTH PROJECTION', 'Bounded logarithmic USD value', 'Direction only; constant speed', 'One-sided evidenced activity at a jurisdiction; never a route', "timeZone:'UTC'", 'BLOCKCHAIN FLOW MAP BY JAKE PERCY', 'href="./landmarks.html"'],
  // The second line is how a transfer reaches the page: the node is asked about the watched list in the sender position and
  // again in the receiver position; the headline totals are built from the filtered buffer only (the sample has its own
  // buffer); the sample is attached to a snapshot only for the live windows.
  'lib/atlas/live-client.ts': [
    'eth_getLogs', 'api.coingecko.com', 'api.exchange.coinbase.com', 'api.kraken.com', "'Not connected'", "'LIVE'", "'Backfilling'", "'Partial'", "'Delayed'", "'Reconnecting'", "'Connecting'", "'Misconfigured'", "from './known-entities'",
    'topics:[ERC20_TRANSFER_TOPIC,topics,null]', 'topics:[ERC20_TRANSFER_TOPIC,null,topics]', 'watchedAddresses(chain).map(', 'for(const r of f.buffer)yield r.tx??r;', 'if(sampleRecs.length&&!long)',
  ],
  // Both ends of a transfer are looked up in the whole registry (every ADDRESSES row, dormant or not); a first-party row is
  // dated by the earlier of its explorer read and its entity review; derived evidence has one fixed score.
  'lib/atlas/live-core.ts': ['senderEntity=attributionFor(r.chain,r.sender),receiverEntity=attributionFor(r.chain,r.receiver)'],
  'lib/atlas/known-entities.ts': ['for(const [key,rec] of Object.entries(ADDRESSES))', 'INDEX.get(keyOf(chain,address))', 'Math.min(Date.parse(ent.lastVerified),Date.parse(rec.checked))', "confidence:'HIGH',score:.8,"],
  // The 180 days are counted at each transfer's own time, the same way at both ends.
  'lib/atlas/engine.ts': ['admissible(t.senderEntity,t.blockTime)', 'admissible(t.receiverEntity,t.blockTime)'],
  'lib/atlas/history-store.ts': ['indexedDB'],
  'HANDOFF.md': ['formerly Ledger Atlas'],
  // The second page's names rest on the rule the prose describes (the map's link to it is pinned with atlas.tsx above).
  'scripts/landmarks/build.mjs': ['credits this tag to a third party', 'a person is named only on their own statement', 'exactly one matches'],
};

/** Every sentence the template quotes (12 or more characters) must be in a source, ASCII-folded and whitespace-collapsed.
 *  Returns the trace of where each was found. Throws-free: the caller decides what a miss costs. */
export function checkQuotes(text, sources) {
  const flat = Object.fromEntries(Object.entries(sources).map(([file, raw]) => [file, flatten(raw)]));
  const lines = Object.fromEntries(Object.entries(sources).map(([file, raw]) => [file, raw.split('\n').map(flatten)]));
  const misses = [];
  const trace = [];
  for (const [, q0] of ascii(text).matchAll(/"([^"\n]{12,})"/g)) {
    const q = collapse(q0);
    const file = Object.keys(flat).find((f) => flat[f].as.includes(q) || flat[f].bare.includes(q));
    if (!file) {
      misses.push(q);
      continue;
    }
    const head = q.slice(0, 40);
    const line = lines[file].findIndex((l) => l.as.includes(head) || l.bare.includes(head)) + 1;
    trace.push({quote: q, file, line});
  }
  return {misses, trace};
}

/** Hand-typed numbers in the prose. Volatile numbers are stamped, so any digit outside a quotation, a URL or a
 *  placeholder is either a stable fact that belongs in ALLOWED_NUMBERS or something to stamp instead. The window
 *  tabs are interface vocabulary, not figures; renderChecked() asserts WINDOWS still names exactly these four. */
const WINDOW_LABELS = ['5M', '1H', '24H', '7D'];
const ALLOWED_NUMBERS = ['110m', '110m.json', 'v1', ...WINDOW_LABELS];
export function handTypedNumbers(text) {
  const prose = text
    .replace(/"[^"\n]*"/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\{\{\w+\}\}/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\?\w+=\w+/g, '');
  return [...prose.matchAll(/[A-Za-z]*\d[\w.,%-]*/g)].map((m) => m[0].replace(/[.,;:]+$/, '')).filter((w) => !ALLOWED_NUMBERS.includes(w));
}

/** Source files whose behaviour is the live page's. The generated registry is not. */
function liveSources(root) {
  const skip = new Set(['known-addresses.ts']);
  const walk = (dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  }) : []);
  return [...walk('components'), ...walk('live-lite'), ...walk('lib/atlas').filter((f) => !skip.has(f.split('/').pop())), ...walk('lib/landmarks')].filter((f) => /\.(?:tsx?|html)$/.test(f));
}
const URL_STATE = /URLSearchParams|\blocation\.(?:search|hash|href|pathname)\b|\bhistory\.(?:push|replace)State\b|\bhashchange\b|\bpopstate\b/;
const DEBUG_FLAG = /new URLSearchParams\(location\.search\)\.get\('(?:debug|fallback)'\)===/g;
/** The prose says views have no addresses. If anything in the live page starts reading the URL, that stops being true.
 *  The two debug flags are cut out of each line first, so a line that has one of them and reads something else too is still flagged. */
export function urlStateProblems(files) {
  return Object.entries(files).flatMap(([file, raw]) => raw.split('\n').flatMap((l, i) => (URL_STATE.test(l.replace(DEBUG_FLAG, '')) ? [`${file}:${i + 1} reads the URL: ${l.trim().slice(0, 90)}`] : [])));
}

/* ------------------------------------------------------------------------------------------ the contract */

/** What JakePercy.com/scripts/check-llms.mjs enforces, so a violation stops the build here and not at upload time.
 *  `exists(rel)` says whether a same-site path is in the built output ('' is the page itself). */
export function checkContract(text, exists) {
  const errors = [];
  const lines = text.split('\n');
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_BYTES) errors.push(`${bytes} bytes; the cap is ${MAX_BYTES}`);
  const bad = text.match(/[^\x00-\x7F]/);
  if (bad) errors.push(`non-ASCII character ${JSON.stringify(bad[0])}`);
  if (/\{\{[^}]*\}\}/.test(text)) errors.push(`unresolved placeholder ${text.match(/\{\{[^}]*\}\}/)[0]}`);
  if (text.includes('_next/')) errors.push('contains "_next/"');
  if (!/^# \S/.test(lines[0])) errors.push('first line is not an H1');
  if (lines.filter((l) => /^# /.test(l)).length !== 1) errors.push('more than one H1');
  const quote = lines.find((l) => l.startsWith('> '));
  if (!quote) errors.push('no blockquote summary');
  else if (quote !== `> ${SUMMARY} ${CAVEAT}`) errors.push('the opening blockquote is not "> summary caveat" from the sheet, on one line');
  if (lines.some((l) => /^#{3,} /.test(l))) errors.push('headings deeper than H2');
  const firstH2 = lines.findIndex((l) => l.startsWith('## '));
  lines.slice(0, firstH2 < 0 ? lines.length : firstH2).forEach((l) => {
    if (l.trim() && !/^(# |> |\*\*)/.test(l)) errors.push(`prose before the first H2 must open with a bold lead-in: ${l.slice(0, 60)}`);
  });
  let section = null;
  for (const l of lines) {
    if (l.startsWith('## ')) {
      section = l.slice(3);
      continue;
    }
    if (section && l.trim() && !/^- \[[^\]]+\]\([^)]+\)(: .+)?$/.test(l)) errors.push(`"## ${section}" has a line that is not "- [title](url): note": ${l.slice(0, 60)}`);
  }
  const h2 = lines.filter((l) => l.startsWith('## '));
  if (h2.includes('## Optional') && h2[h2.length - 1] !== '## Optional') errors.push('## Optional must be last');
  const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  for (const url of links) {
    if (!/^(https:\/\/|mailto:)/.test(url)) errors.push(`link is not absolute https: ${url}`);
    else if (url.startsWith(SITE) && !exists(decodeURIComponent(url.slice(SITE.length).split(/[?#]/)[0]))) errors.push(`link target is not in the built output: ${url}`);
  }
  for (const url of [HUB, SITE]) if (!links.includes(url)) errors.push(`missing required link: ${url}`);
  return errors;
}

/* ------------------------------------------------------------------------------------------ methodology.md */

/** What a reader of the public copy must not be sent to look for: this repo's own notes and files. */
const INTERNAL = /\bdecisions?\s+D\d\b|\bD[1-9]\b|HANDOFF|AGENTS\.md|CLAUDE\.md|DECISIONS-|PLAN-20|\bdocs\/|\b(?:scripts|lib|components|app)\/[\w./-]+|\.(?:cjs|mjs|tsx?)\b/i;

/** The project's methodology document, published as written except that the one reference to an internal decision
 *  record becomes a plain date, the paragraphs are separated by blank lines (the source keeps each on one line), and
 *  the text is folded to ASCII. Anything internal still left after that fails the build. */
export function publicMethodology(source) {
  let t = source.replace(/\r\n/g, '\n').replace(/\s*\(decision D\d+,\s*(\d{4}-\d{2}-\d{2})\)/g, ' (decided $1)');
  t = t.replace(/^(# [^\n]+)\n+/, `$1\n\nBy Jake Percy. The dashboard is at ${SITE} and its plain-text description is at ${SITE}llms.txt.\n\n`);
  const block = (l) => /^(#{1,6} |[-*+] |\d+\. |\| |    |```|>)/.test(l);
  const out = [];
  const ls = t.split('\n');
  ls.forEach((l, i) => {
    out.push(l);
    if (l.trim() && ls[i + 1] !== undefined && ls[i + 1].trim() && !block(l) && !block(ls[i + 1])) out.push('');
  });
  t = ascii(out.join('\n')).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  const leak = t.match(INTERNAL);
  if (leak) throw new Error(`methodology${METHOD_EXT} still has an internal reference (${JSON.stringify(leak[0])}); fix it in publicMethodology() in scripts/llms/render.mjs`);
  return t;
}

/* ------------------------------------------------------------------------------------------ page surfaces */

function indexFacts(root, rel = INDEX) {
  const html = read(root, rel);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const description = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1];
  if (!title || !description) throw new Error(`${rel} needs a <title> and a meta description`);
  return {title: title.trim(), description};
}

/** Head tags for the Landmarks page: its own canonical and og tags, the llms.txt alternate, no <noscript> (its stories
 *  are static HTML). Built from the page's own title and meta description. */
export function landmarksSurfaces({title, description}) {
  const url = `${SITE}${LANDMARKS_PAGE}`, image = `${SITE}${OG_IMAGE}`, links = siteLinks(), DESCRIPTION = description;
  const head = [
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<link rel="alternate" type="text/markdown" href="llms.txt" title="llms.txt" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeAttr(OG_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(DESCRIPTION)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    `<meta name="author" content="${escapeAttr(links.author)}" />`,
    `<link rel="author" href="${escapeAttr(links.hub)}" />`,
  ];
  return {head: head.join('\n    '), noscript: '', markers: [head[0], head[1], head[5], head[6]]};
}

/** Surfaces for every page the build writes, keyed by the built file name. */
function pagesOf(root) {
  const pages = {'index.html': pageSurfaces(indexFacts(root))};
  if (existsSync(join(root, LANDMARKS))) pages[LANDMARKS_PAGE] = landmarksSurfaces(indexFacts(root, LANDMARKS));
  return pages;
}

/** Head tags and the <noscript> block, built from the same strings as llms.txt. */
export function pageSurfaces({title}) {
  const image = `${SITE}${OG_IMAGE}`, links = siteLinks(), DESCRIPTION = SUMMARY;
  const head = [
    `<link rel="canonical" href="${escapeAttr(SITE)}" />`,
    `<link rel="alternate" type="text/markdown" href="llms.txt" title="llms.txt" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(SUMMARY)}" />`,
    `<meta property="og:url" content="${escapeAttr(SITE)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeAttr(OG_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(DESCRIPTION)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    `<meta name="author" content="${escapeAttr(links.author)}" />`,
    `<link rel="author" href="${escapeAttr(links.hub)}" />`,
  ];
  // The page's CSS sets `html, body {overflow: hidden; height: 100%}`, so the block scrolls inside a fixed box.
  const noscript = [
    '<noscript>',
    '  <div style="position:fixed;inset:0;overflow:auto;padding:24px;background:#111a1e;color:#e3e8e5;font:16px/1.55 Arial,Helvetica,sans-serif">',
    '    <div style="max-width:42rem;margin:0 auto">',
    '      <h1 style="font-size:22px;font-weight:600;margin:0 0 14px">Blockchain Flow Map</h1>',
    `      <p style="margin:0 0 12px">${escapeText(SUMMARY)}</p>`,
    `      <p style="margin:0 0 12px">How to read it, in the page&#39;s words: &ldquo;${escapeText(RULE)}&rdquo;</p>`,
    `      <p style="margin:0 0 12px">${escapeText(CAVEAT)}</p>`,
    `      <p style="margin:0 0 12px">The map is drawn with JavaScript. A plain-text description for readers that do not run scripts: <a href="llms.txt" style="color:#bed2c5">llms.txt</a>. The method in full: <a href="methodology${METHOD_EXT}" style="color:#bed2c5">methodology${METHOD_EXT}</a>.</p>`,
    `      <p style="margin:0 0 12px">By <a href="${escapeAttr(links.hub)}" style="color:#bed2c5">${escapeText(links.author)}</a>. Source code, evidence registry and decision records: <a href="${escapeAttr(links.repo)}" style="color:#bed2c5">GitHub</a>.</p>`,
    '    </div>',
    '  </div>',
    '</noscript>',
  ];
  // What verifyBuilt() looks for in the built page: canonical, the llms.txt alternate, og:url and the <noscript> block.
  return {head: head.join('\n    '), noscript: noscript.join('\n    '), markers: [head[0], head[1], head[5], head[6], '<noscript>']};
}

/* ------------------------------------------------------------------------------------------ render */

function renderChecked(root, atlas) {
  const warnings = [];
  const errors = [];
  const src = (rel) => read(root, rel);

  const sources = {};
  for (const rel of QUOTE_SOURCES) sources[rel] = src(rel);
  const raw = {...sources};
  for (const rel of Object.keys(TERMS)) raw[rel] = raw[rel] ?? src(rel);

  // Facts from code. If they cannot be had the stamped block is dropped and the build carries on.
  let facts = null;
  try {
    if (!atlas) throw new Error('the compiled lib/atlas modules were not provided');
    facts = collectFacts(root, atlas);
  } catch (e) {
    warnings.push(`llms: the "Current state" block is dropped because the facts could not be read from the code: ${e.message}`);
  }

  // The template, with constants filled and the stamped block left out: this is the hand-written prose.
  const tpl = ascii(src(TEMPLATE));
  const constants = {
    summary: SUMMARY, caveat: CAVEAT, rule: RULE, site: SITE, hub: HUB, methodExt: METHOD_EXT, repo: siteLinks(root).repo,
    windows: facts ? `window tabs ${joinAnd(facts.windows)}` : 'time-window tabs',
  };
  const fillConstants = (s) => s.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in constants ? constants[k] : all));
  const prose = fillConstants(tpl).replace('{{current}}', '');

  const numbers = handTypedNumbers(tpl);
  if (numbers.length) errors.push(`${TEMPLATE} has hand-typed numbers (${[...new Set(numbers)].join(', ')}); stamp them from the code in collectFacts() or quote the page`);
  const {misses, trace} = checkQuotes(prose, sources);
  for (const q of misses) errors.push(`${TEMPLATE} quotes a sentence that is no longer in the page's source:\n    "${q}"`);

  for (const [rel, terms] of Object.entries(TERMS)) {
    const text = flatten(raw[rel]);
    for (const term of terms) if (!text.as.includes(collapse(ascii(term))) && !text.bare.includes(collapse(ascii(term)))) errors.push(`${rel} no longer contains ${JSON.stringify(term)}, which ${TEMPLATE} relies on`);
  }
  const lc = raw['lib/atlas/live-client.ts'];
  if (!(lc.indexOf('api.coingecko.com') < lc.indexOf('api.exchange.coinbase.com') && lc.indexOf('api.exchange.coinbase.com') < lc.indexOf('api.kraken.com'))) errors.push('lib/atlas/live-client.ts no longer tries CoinGecko, then Coinbase, then Kraken, as the prose says');
  for (const url of [...prose.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('https://jakepercy.com/'))) {
    if (!raw['components/atlas.tsx'].includes(url) && !readFileSync(join(root, LINKS), 'utf8').includes(url)) errors.push(`${TEMPLATE} links ${url}, which neither the page nor ${LINKS} links`);
  }
  const files = Object.fromEntries(liveSources(root).map((f) => [f, src(f)]));
  errors.push(...urlStateProblems(files).map((p) => `${p}; the prose says views have no addresses, so update ${TEMPLATE} and urlStateProblems()`));

  // Agreement between the published methodology, the page's head and the code.
  const method = src(METHODOLOGY);
  const index = indexFacts(root);
  if (facts) {
    if (facts.windows.join() !== WINDOW_LABELS.join()) errors.push(`${TEMPLATE} names the windows ${WINDOW_LABELS.join(', ')}; WINDOWS in lib/atlas/model.ts is ${facts.windows.join(', ')}`);
    const named = (method.match(/another EVM chain the build reads \(([^)]*)\)/) || [])[1];
    // The sentence is about reusing an Ethereum label on the other EVM chains, so it lists the live EVM chains only. Tron is
    // read too, but it is never a derivation target, so naming it there would be false.
    const want = facts.chains.map((c) => c.name).filter((c) => c !== 'Ethereum' && facts.evmChains.includes(c)).sort();
    const got = (named || '').split(/,|\bor\b|\band\b/).map((s) => s.trim()).filter(Boolean).sort();
    if (!named) errors.push(`${METHODOLOGY} no longer has the sentence "another EVM chain the build reads (...)" that scripts/llms/render.mjs checks against FEEDS`);
    else if (want.join() !== got.join()) errors.push(`${METHODOLOGY} lists ${got.join(', ')} as the other chains read; the build reads ${want.join(', ')}. Update the methodology (it is published as methodology${METHOD_EXT})`);
    const doc = (method.match(/until at least (\d+)% of it has been observed/) || [])[1];
    if (facts.unlockShare && String(Math.round(facts.unlockShare * 100)) !== doc) errors.push(`${METHODOLOGY} says ${doc || '(not found)'}% of a window must be observed; UNLOCK_SHARE in lib/atlas/live-client.ts is ${facts.unlockShare}`);
    const days = (method.match(/verification within (\d+) days/) || [])[1];
    if (String(facts.horizonDays) !== days) errors.push(`${METHODOLOGY} says evidence is good for ${days || '(not found)'} days; admissible() allows ${facts.horizonDays}`);
    for (const c of facts.chains.map((x) => x.name)) if (!index.description.includes(c)) errors.push(`the meta description in ${INDEX} does not name ${c}, which the build reads`);
    for (const c of facts.notConnected) if (new RegExp(`\\b${c}\\b`).test(index.description)) errors.push(`the meta description in ${INDEX} names ${c}, which the build does not read`);
    if (facts.allChains.some((c) => /bnb|bsc|binance/i.test(c))) errors.push('model.ts lists a BNB chain, but the prose says BNB Chain is not read');
  }
  for (const name of ['llms.txt', `methodology${METHOD_EXT}`]) {
    if (existsSync(join(root, 'public', name))) errors.push(`public/${name} exists; ${name} is generated at build, so a static copy would be a second source of truth`);
  }

  const methodology = publicMethodology(method);
  const llms = ascii(fillConstants(tpl).replace('{{current}}', facts ? currentState(facts) : '')).replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '');
  const outputs = (rel) => rel === '' || BUILT_NAMES.includes(rel) || existsSync(join(root, 'public', rel));
  errors.push(...checkContract(llms, outputs).map((e) => `llms.txt: ${e}`));

  const surfaces = pageSurfaces(index);
  return {files: {'llms.txt': llms, [`methodology${METHOD_EXT}`]: methodology}, head: surfaces.head, noscript: surfaces.noscript, markers: surfaces.markers, pages: pagesOf(root), warnings, errors, trace, facts};
}

/** Render everything. `opts.atlas` is the compiled lib/atlas modules (loadCompiled / loadAtlasFor). In STRICT mode a
 *  failed check throws; otherwise it is returned as a warning and no files are produced. */
export function renderAll(opts = {}) {
  const root = opts.root ?? ROOT;
  const strict = opts.strict ?? STRICT;
  let r;
  try {
    r = renderChecked(root, opts.atlas);
  } catch (e) {
    if (strict) throw e;
    return {files: {}, head: '', noscript: '', markers: [], pages: {}, warnings: [`llms: skipped, ${e.message}`], errors: [], trace: [], facts: null};
  }
  if (r.errors.length) {
    if (strict) throw new Error(`llms: ${r.errors.length} problem(s)\n  - ${r.errors.join('\n  - ')}`);
    return {...r, files: {}, head: '', noscript: '', markers: [], pages: {}, warnings: [...r.warnings, ...r.errors.map((e) => `llms: skipped, ${e}`)]};
  }
  return r;
}

/** After the build: the files are in dist-live/, the page carries the surfaces, and llms.txt links only what exists. */
export function verifyBuilt(dir, root = ROOT) {
  const errors = [];
  const file = (n) => join(dir, n);
  for (const n of BUILT_NAMES) if (!existsSync(file(n))) errors.push(`${n} is missing from ${dir}`);
  if (errors.length) return errors;
  const llms = readFileSync(file('llms.txt'), 'utf8');
  errors.push(...checkContract(llms, (rel) => existsSync(file(rel || 'index.html'))).map((e) => `llms.txt: ${e}`));
  const bad = readFileSync(file(`methodology${METHOD_EXT}`), 'utf8').match(/[^\x00-\x7F]|\{\{/);
  if (bad) errors.push(`methodology${METHOD_EXT} has ${JSON.stringify(bad[0])}`);
  for (const [name, surfaces] of Object.entries(pagesOf(root))) {
    if (!existsSync(file(name))) {
      errors.push(`${name} is missing from ${dir}`);
      continue;
    }
    const html = readFileSync(file(name), 'utf8');
    for (const m of surfaces.markers) if (!html.includes(m)) errors.push(`${name} is missing ${m}`);
    if (/<base\s/i.test(html)) errors.push(`${name} has a <base> tag, which would change how href="llms.txt" resolves`);
    // Each page carries only its own surfaces: the map's canonical and <noscript> must not leak into another page.
    for (const [other, s] of Object.entries(pagesOf(root))) if (other !== name && s.markers[0] && html.includes(s.markers[0])) errors.push(`${name} carries the canonical link of ${other}`);
  }
  return errors;
}

/** The checks' own checks: a verifier that cannot fail proves nothing (see verify-rollup.cjs in HANDOFF section 12). */
export function selfTest() {
  const must = (cond, what) => {
    if (!cond) throw new Error(`llms self-test failed: ${what}`);
  };
  const ok = () => true;
  must(pageSurfaces({title: 'T'}).head.includes('property="og:image"') && pageSurfaces({title: 'T'}).head.includes('name="twitter:card"') && landmarksSurfaces({title: 'T', description: 'd'}).head.includes('property="og:image"'), 'both pages must carry og:image and twitter:card');
  must(/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(siteLinks().repo) && siteLinks().author.length > 0, 'lib/site/links.ts must name the author and the repository');
  const good = `# T\n\n> ${SUMMARY} ${CAVEAT}\n\n**A.** text\n\n## Related\n\n- [Page](${SITE}): the page\n- [Hub](${HUB}): the hub\n`;
  must(checkContract(good, ok).length === 0, 'a minimal valid file should pass the contract');
  must(checkContract(good.replace('text', 'caf' + U(0xE9)), ok).some((e) => /non-ASCII/.test(e)), 'non-ASCII must fail');
  must(checkContract(good.replace(`- [Hub](${HUB}): the hub\n`, ''), ok).some((e) => /missing required link/.test(e)), 'a missing hub link must fail');
  must(checkContract(good.replace('**A.** text', '### deep'), ok).some((e) => /deeper than H2/.test(e)), 'H3 must fail');
  must(checkContract(good.replace('- [Page]', 'Page [x]'), ok).some((e) => /not "- \[title\]/.test(e)), 'a prose line under an H2 must fail');
  must(checkContract(good.replace('> A live', '> A LIVE'), ok).some((e) => /blockquote/.test(e)), 'a changed blockquote must fail');
  must(checkContract(good.replace(`${SITE}):`, `${SITE}gone.txt):`), (rel) => rel === '').some((e) => /not in the built output/.test(e)), 'a link to a missing file must fail');
  must(checkQuotes('He said "this sentence is not on the page at all".', {'a.md': 'Something else entirely.'}).misses.length === 1, 'a fabricated quote must be caught');
  must(checkQuotes('He said "Entity evidence is time-bound and can be wrong".', {'a.tsx': "<p>Entity evidence is <b>time-bound</b> and can be wrong.</p> it&apos;s"}).misses.length === 0, 'a quote split by tags must be found');
  must(handTypedNumbers('There are 1,189 wallets in "29 places" on v1, a 110m map [x](https://a.b/1) {{n}}.').join('|') === '1,189', 'only the hand-typed number is flagged');
  must(urlStateProblems({'a.ts': 'const h=location.hash;'}).length === 1, 'a new URL reader must be flagged');
  must(urlStateProblems({'a.ts': "const d=new URLSearchParams(location.search).get('debug')==='map';"}).length === 0, 'the two debug flags are allowed');
  must(urlStateProblems({'a.ts': "const d=new URLSearchParams(location.search).get('debug')==='map'||location.hash;"}).length === 1, 'a debug flag must not excuse another URL reader on the same line');
  must(urlStateProblems({'a.ts': "const d=new URLSearchParams(location.search).get('view');"}).length === 1, 'any other URL parameter must be flagged');
  must(ascii(`Caf${U(0xE9)} ${U(0x2014)} ${U(0x201C)}quoted${U(0x201D)} ${U(0xB7)} x${U(0x2192)}y`) === 'Cafe - "quoted", x->y', 'ascii() folds typography');
  let threw = false;
  try {
    publicMethodology('# T\n\nSee decision D9 for why.\n');
  } catch {
    threw = true;
  }
  must(threw, 'an internal reference left in the methodology must fail');
  must(/\(decided 2026-09-25\)/.test(publicMethodology('# T\n\nnever USDT (decision D4, 2026-09-25). Next.\n')), 'the decision reference becomes a date');
  must(!/decision D4/.test(publicMethodology('# T\n\nnever USDT (decision D4, 2026-09-25). Next.\n')), 'the decision reference is gone');
}

/* ------------------------------------------------------------------------------------------ command line */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--dist')) {
      const errors = verifyBuilt(join(ROOT, 'dist-live'));
      if (errors.length) throw new Error(`dist-live/ is not right:\n  - ${errors.join('\n  - ')}`);
      console.log('dist-live/ has llms.txt, methodology and the page surfaces.');
    } else {
      const r = renderAll({atlas: await loadAtlasFor(ROOT)});
      r.warnings.forEach((w) => console.warn(w));
      if (args.includes('--trace')) r.trace.forEach((t) => console.log(`${t.file}:${t.line}\t${t.quote}`));
      else if (args.includes('--methodology')) process.stdout.write(r.files[`methodology${METHOD_EXT}`]);
      else if (args.includes('--surfaces')) console.log(`${r.head}\n\n${r.noscript}`);
      else process.stdout.write(r.files['llms.txt']);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
