# Ledger Atlas — handoff notes for the next agent

Written 2026-09-21 at commit `7ab08d5`. Read this before touching anything under
`lib/atlas/`, `scripts/registry/` or `docs/`. It explains the direction the project has
been taking, the rules that must not be broken, and the workflows that keep the build
honest. The longer explanations live in `docs/METHODOLOGY.md` and `live-lite/README.md`.
The approved plan that produced the last four commits is in `docs/PLAN-2026-09.md`.

## 1. What this project is and how it ships

Ledger Atlas is a stablecoin cross-border settlement map (React + Three.js globe with an
SVG fallback). It started as a demo with synthetic data. It now has a **LIVE mode** that
reads USDC and USDT `Transfer` logs straight from free public JSON-RPC endpoints in the
visitor's browser. There is no backend for the live build.

- **Deploy path is manual and must stay simple.** `corepack pnpm build:live` writes a
  static site to `dist-live/`. Jake unzips it and FTPs the contents (keeping the
  `assets/` folder) into a folder under `public_html` on jakepercy.com. The build uses
  relative asset paths so it works from any nested folder. Do not introduce anything that
  needs a server, runtime environment variables, or an API key.
- `pnpm build:live` is **gated**: it runs `node scripts/verify-all.mjs` first and refuses
  to build if any verifier fails. Never remove that gate and never "fix" a failing
  verifier by weakening the assertion.
- GitHub/Cloudflare hosting is a noted future to-do, not started. The Next.js/Cloudflare
  Workers/D1 files (`app/`, `db/`, `drizzle/`, `lib/atlas/store.ts`, `production.ts`) are
  the deferred "phase 2 backend" and are not used by the live build.

Commits are made with `git -c user.email="223131039+jakeperc@users.noreply.github.com" -c user.name="Jake Percy"`.

## 2. The integrity rules (non-negotiable)

The whole point of the live mode is that every attribution on the map is backed by
public evidence. The map deliberately shows only a small fraction of onchain volume
(around 12% of what it observes) because most transfers cannot be evidenced. That
number is a feature, not a bug to be "improved" by loosening rules.

1. **Never guess an address-to-entity mapping.** An address enters the registry only when
   its own explorer page (Etherscan, Basescan, Arbiscan) shows a public name tag for it.
   The tag text is stored verbatim in the `label` column. Researcher compilations,
   Dune spellbooks, Arkham, Nansen, blog posts and memory are not admissible sources.
2. **Entity jurisdiction comes from regulator or company documents** (licence registers,
   Terms of Service, filings), linked in `sourceUrl`. Confidence is `VERIFIED` or `HIGH`
   only; nothing lower exists in the registry.
3. **Never include**: exchange deposit addresses, funders, routers, bridges, DEX
   contracts, token contracts, or issuer treasuries (Circle, Tether mint/burn wallets).
   Issuer *operational* wallets that are labelled are fine (e.g. Paxos 4).
4. **Never bypass CAPTCHAs** or rate limits on explorers. If an explorer blocks a page,
   find another lawful route (Arbiscan address pages return 403 to bots but the
   `/txs?a=` page header still shows the tag) or skip the address.
5. **Evidence expires.** `admissible()` in `lib/atlas/model.ts` refuses evidence older
   than 180 days. Every address row carries the real date its explorer page was read.
   Never stamp a placeholder or a future date; a future date makes the row inadmissible
   immediately. All current evidence expires **2027-03-17**; the build gate fails 60 days
   before that (`--horizon-days`).
6. **Derived evidence is second class.** See section 4. It may never anchor
   deposit-address inference and may never apply to a contract address.
7. **The observed total is a declared sample, never an estimate.** The "observed
   onchain" figure is an exact sum over a small unfiltered slice of chain time, and the
   UI states the sampling window. Do not scale it up to a projected hourly figure.
8. **No synthetic data, ever (Jake's standing rule, 2026-09-21).** Everything the
   project shows must be real data, live where possible and otherwise recent. Do not add
   simulated, seeded, placeholder, sample-fixture or "illustrative" values to anything a
   visitor can see, and do not fall back to fake data when a feed fails: show the honest
   health state (Delayed/Partial/Reconnecting) instead. The legacy demo engine
   (`demoEvents`/`demoSnapshot` in `lib/atlas/engine.ts`, the `'demo'` mode and the
   `DEMO DATA` health state) is a leftover from the project's start and is slated for
   removal (see section 8, item 1). Unit tests may use recorded real chain data as fixtures.

## 3. Data model in one screen

```
scripts/registry/addresses.txt      curated source of truth, 6 columns:
                                    chain|entity|address|label|checked|note
scripts/registry/code-probe.json    eth_getCode result per chain per address (mechanical)
scripts/registry/probe-code.mjs     regenerates code-probe.json (run after adding rows)
scripts/registry/gen-addresses.mjs  addresses.txt + code-probe.json -> lib/atlas/known-addresses.ts
lib/atlas/known-addresses.ts        GENERATED. Never hand-edit. ADDRESSES keyed "Chain:0xaddr" + DERIVED list
lib/atlas/known-entities.ts         ENTITIES (hand-edited) + knownAttribution(chain,address),
                                    evidencedAddresses(chain), registryHealth(), isDerived()
lib/atlas/geography.ts              COUNTRIES, MAP_LABELS, EXPLORERS (address/tx URL builders)
lib/atlas/evm.ts                    token CONTRACTS per chain as {asset, decimals}
lib/atlas/model.ts                  types, admissible(), CHAINS
lib/atlas/engine.ts                 aggregate() -> corridors/totals; applies no chain filter itself
lib/atlas/live-core.ts              PURE logic: log decoding, pricing, chunk planning,
                                    inferDeposits(). No fetch/DOM/timers. Fully unit-tested.
lib/atlas/live-client.ts            transport + state machine: per-chain feeds, endpoint
                                    rotation, backfill, poll, sample, health, dispose()
components/atlas.tsx                the UI
```

Registry keys are `${chain}:${address}` (lowercase on EVM). This matches the deferred
backend's `store.ts addressKey`, so keep it.

Current registry: **1,116 first-party rows** (Ethereum 805, Base 263, Arbitrum 48) across
70 entities and 28 jurisdictions, plus **1,277 derived** (Base 552, Arbitrum 725).

## 4. Cross-chain evidence: first-party vs DERIVED

An Etherscan label is evidence about Ethereum only. For Base and Arbitrum we use a hybrid
that Jake chose explicitly:

- **First-party**: a row whose `chain` is Base or Arbitrum, with the label read from
  Basescan or Arbiscan. These anchor deposit-address inference, so they are what makes
  routes appear on those chains.
- **DERIVED**: an Ethereum row whose address is a plain key-controlled account (`eoa` or
  EIP-7702 `delegated`) on Ethereum *and* has no code on the target chain. The same private
  key controls it there, so it is reused at `HIGH`/score 0.8 (the minimum admissible
  score) with `DERIVED` in category, source and evidence note. Generated automatically by
  `gen-addresses.mjs`; a first-party row for the same chain:address always wins.
- **Contracts never derive.** The same address on another chain may be an unrelated
  deployment, or nothing at all.
- **Orphan rule** (important trap): explorers copy researcher labels across chains by
  address. An address that is a contract on Ethereum but has *no code* on Base is orphaned
  there: nobody controls it and inflows are stuck, not settlement. `gen-addresses.mjs`
  throws if such a row is in `addresses.txt`, even though Basescan labels it. 23 such rows
  were refused in the last wave (Poloniex Safe, a run of Bitget wallets). Do not work
  around this error; delete the row.
- Derivation is EVM-only. Tron and Solana never derive.

## 5. How the live feed works and why it is shaped this way

- Two topic-filtered `eth_getLogs` calls per chunk: `[TRANSFER, [evidenced addrs], null]`
  for senders and `[TRANSFER, null, [evidenced addrs]]` for receivers. This loses nothing
  for route drawing, because a corridor needs an evidenced wallet at both ends and
  deposit sweeps are funded by exchange hot wallets. Measured cost for one hour on all
  three chains: **4.1 MB down / 2.1 MB up**, against roughly 140 MB unfiltered. Do not go
  back to unfiltered feeds; that was the 29 MB/hour problem.
- A separate small **unfiltered sample** is fetched every ~10 minutes for the honest
  denominator (`Snapshot.sample`).
- **Per-chain config** in `CHAIN_CONFIG` (`live-client.ts`): chain id, slot time, blocks
  per hour, chunk size, pause. Ethereum 50-block chunks, Base 1500, Arbitrum 1200 with a
  350 ms pause. These were measured against each endpoint's range cap; change them only
  after re-measuring.
- **Endpoint facts** (verified 2026-09-19/20, all CORS `*`):
  - Ethereum: `eth.drpc.org`, `rpc.mevblocker.io`, `1rpc.io/eth` accept the ~55 KB filter
    body. `eth-pokt.nodies.app` returns 403 to any large POST, so it is flagged
    `largeBody:false` and used only for headers and the sample.
  - Base: `mainnet.base.org` and `base-rpc.publicnode.com` are OK at 1500 blocks.
    `base.drpc.org` rejects the filter. `1rpc.io/base` caps at 50 blocks.
  - Arbitrum: only `arbitrum.gateway.tenderly.co` and `arb1.arbitrum.io/rpc` are usable
    free; the latter rate-limits. publicnode needs a token; llamarpc, blockpi, meowrpc and
    alchemy-demo are dead.
- **Retry policy**: transient errors (429/5xx/code 12) retry the same endpoint with
  strikes; hard errors rotate immediately; attempts = max(4, pool size + 1). Failed chunks
  are counted in `missingBlocks` and surface as Partial/Delayed, never swallowed.
- **Health states**: LIVE / Backfilling / Partial / Delayed / Reconnecting / Connecting /
  Misconfigured, per chain. `registryHealth()` flips the whole page to DELAYED with an
  explanatory message if more than 25% of the registry has expired.
- `LiveSource.dispose()` clears every timer and aborts fetches; `import.meta.hot.dispose`
  is wired so HMR does not start a second backfill.
- Inference (`inferDeposits` in `live-core.ts`) is recomputed from the buffer each cycle
  so it expires with its evidence. It refuses unpriced legs, out-legs to two clusters, no
  external in-leg, sweep-before-receipt, cross-chain matches, and derived anchors.

## 6. Workflows

### Adding addresses (a "research wave")

1. Read the address's own explorer page on the target chain; record the exact tag.
2. Append a row to `scripts/registry/addresses.txt`, for example
   `Base|coinbase|0x...|Coinbase 10|2026-09-21|hot wallet, very active`. Address lowercase.
   `checked` is today's real date. The entity id must exist in `known-entities.ts`.
3. `node scripts/registry/probe-code.mjs` updates `code-probe.json`; it is cached, so only
   new addresses hit the network.
4. `node scripts/registry/gen-addresses.mjs scripts/registry/addresses.txt lib/atlas/known-addresses.ts`
5. `node scripts/verify-all.mjs` must be green.
6. `corepack pnpm build:live`, then check `dist-live/` in a browser (see below).

Adding an entity: add an `e(...)` line in `ENTITIES` in `known-entities.ts` with
jurisdiction, VERIFIED/HIGH, a regulator or company `sourceUrl`, a meaningful
`evidenceNote` and today's `lastVerified`. The `source` string must **not** begin with
"Etherscan"; the explorer name is composed per chain by `knownAttribution()` and the
verifier checks for it. New jurisdiction: add to `COUNTRIES` (and `MAP_LABELS` if it
should be labelled) in `geography.ts` with an anchor point.

Entities with **no label on Base** as of 2026-09-20 (they contribute there only via
derivation): Cumberland, Jump, Galaxy, GSR, B2C2, Amber, Zero Hash, Fidelity. Basescan
indexes deeper numbered tails (Coinbase to about 200) but 59 and above were verified to be
deposit sweeps, so they were not pursued.

### Verifying

```
node scripts/verify-all.mjs
node node_modules/typescript/bin/tsc --noEmit
corepack pnpm build:live
```

- `verify-model.cjs`: model and engine invariants.
- `verify-registry.cjs`: every row resolves, explorer host matches chain, evidence note
  names the explorer, horizon check, DERIVED assertions, contract guard,
  `evidencedAddresses()` agrees with the registry.
- `verify-live.cjs`: 27 assertion groups over `live-core.ts` (inference happy path and
  every refusal, the 80% boundary, cross-chain, derived anchors, expiry, decoding,
  decimals, block times, chunking, retention). Add a test here for any change to
  `live-core.ts`.

### Checking the built site

`.claude/launch.json` has a `dist-check` entry: `node scripts/serve-dist.cjs dist-live`
serves the build on port 5180 under a nested path (`/ledger-atlas-live/`) to mimic the
FTP folder. Look for: no 404s, reaches LIVE, corridors appear on All chains, Ethereum,
Base and Arbitrum, Tron and Solana say Not connected, no blank map on any option, and the
layout holds at 375x812.

### Lint

`pnpm lint` has **44 pre-existing errors** in vendored shadcn components and the map
renderers. That count is the baseline; do not add to it and do not spend time fixing it
unless asked.

## 7. Things that look wrong but are intentional

- The map attributes only about 12% of observed value. By design.
- Dormant wallets stay in the registry. They cost filter bytes but they are evidence, and
  evidence is not deleted for convenience.
- The chain selector in production lists only chains the build actually reads.
- `known-addresses.ts` is large and generated. Do not edit or "clean up" by hand.
- `ENTITIES[*].source` strings no longer mention Etherscan. The verifier enforces this.
- `live-core.ts` has no imports of fetch, DOM or timers. Keep it that way so it stays
  testable in plain Node.
- `formatAmount` uses `BigInt(10)**BigInt(decimals)` because tsconfig targets ES2017 and
  `10n` literals do not compile.
- Line endings in some files are CRLF (OneDrive on Windows). Match regexes with `\r?\n`.

## 7b. Growing data and sources, and when to ask Jake for API keys

Jake's direction (2026-09-21): **add as much real data and as many sources as possible
using free APIs and free public endpoints that the agent can reach itself**, within the
integrity rules in section 2 (free does not relax the evidence standard).

- Keep going as far as free sources allow: more chains with keyless CORS-friendly RPCs,
  more first-party explorer labels, more regulator/company documents for jurisdictions,
  free price feeds, and any other free public dataset that makes the flows richer.
  Re-check that each endpoint really works (CORS, range caps, rate limits) and record the
  verified facts in section 5, as has been done so far.
- **Tell Jake when you are approaching the limit of what free sources can give.** Signs:
  free endpoints rate-limit or cap ranges so the feed goes Partial/Delayed; a chain or
  dataset only exists behind a key (Tron/TronGrid and Solana indexers already are); the
  explorer labels that are freely readable are exhausted; or the keyless static build
  cannot carry more filter bytes without hurting visitors.
- When that happens, **stop and report to Jake** rather than working around it. Give him a
  short list: which source, free tier or paid, what it costs, what it unlocks (chains,
  flows, wallets, history), and roughly how much more coverage it would add. Jake will
  sign up for the free/paid APIs himself and hand over the keys. Never create accounts or
  handle credentials on his behalf.
- Note that API keys conflict with the current keyless static build (section 1). Using
  them properly probably means the phase-2 backend (Workers + D1) so keys stay
  server-side. Raise that trade-off with Jake at the same time; do not put keys in the
  client bundle.

## 8. Open to-dos, in rough priority

1. **Remove synthetic data** (rule 8). Retire the demo engine and demo mode, and make sure
   nothing visitor-facing can render simulated values. Keep the build gate green; add a
   verifier assertion that fails if synthetic data can reach the live build. Files that
   still reference demo/synthetic data (2026-09-21): `lib/atlas/engine.ts`, `model.ts`,
   `connectors.ts`, `production.ts`, `store.ts`, `known-entities.ts`, `live-core.ts`,
   `components/atlas.tsx`, `app/page.tsx`, `app/api/snapshot/route.ts`,
   `app/api/evidence/route.ts`. Some hits are `synthetic:false` guards, which can stay.
2. **Expand free real-data sources** (section 7b), and report to Jake when free sources
   run out, with a recommended list of free/paid APIs for him to get.
3. **Re-verify evidence before 2027-03-17.** The build gate starts failing around
   mid-January 2027. Re-read the explorer pages and update the `checked` and
   `lastVerified` dates; do not just bump dates.
4. GitHub plus Cloudflare Pages hosting to replace manual FTP (Jake's noted future to-do).
5. More first-party L2 labels: market makers on Base and Arbitrum, Upbit and Bithumb on Base.
6. Tron needs a keyed TronGrid account, so it is out of scope for the keyless static build. Candidate for the key list Jake is asked for (section 7b).
7. Solana needs a paid indexer; same.
8. Phase-2 backend (Workers + D1): the registry loader is trivial now that keys are
   `chain:address`, but nothing has been started.
9. Pre-existing lint failures.

## 9. History of the direction (why it is like this)

- Started demo-only. Went live on Ethereum with an unfiltered feed and about 21 wallets.
- The registry grew through research waves to 805 Ethereum wallets, 70 entities and
  28 jurisdictions (commits `b5f2bf4`, `3032ded`, `4e04dd5`).
- Measurement showed the unfiltered feed cost visitors about 29 MB/hour and hid failures.
  Phase 0 (`3b90781`) extracted the pure logic, added the live-core test suite, gated the
  build, added the expiry gate and UI signal, switched to the filtered feed plus declared
  sample, and fixed leaks and silent gaps.
- Phases 1 and 2 (`ab54955`) made the registry chain-qualified and brought Base and
  Arbitrum online with per-chain feeds and the derived tier.
- Phase 3 (`7ab08d5`) added first-party Basescan and Arbiscan labels and the orphan rule.
