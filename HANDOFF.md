# Ledger Atlas — handoff notes for the next agent

Last updated 2026-09-29 after the **public-post lead sweep and API options report** (section 15).
Before that came the **Avalanche Snowscan registry wave** (section 13, commit `684b4af`). Earlier work includes the renderer performance and look pass
(section 11), Avalanche going live with Polygon measured then parked and longer time
frames (section 12), and the unplaced-flow / Unmapped work (section 10). Read this before touching anything under
`lib/atlas/`, `scripts/registry/` or `docs/`. It explains the direction the project has
been taking, the rules that must not be broken, and the workflows that keep the build
honest. The longer explanations live in `docs/METHODOLOGY.md` and `live-lite/README.md`.
The approved plan behind the September phases is in `docs/PLAN-2026-09.md`; decisions D1 to D3
were all answered on 2026-09-21 and are recorded in `docs/DECISIONS-2026-09.md` (read its
reopen conditions before researching any of them again).

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
   **Exchange-published address lists are not admissible either** (decision D1, 2026-09-21).
2. **Entity jurisdiction comes from regulator or company documents** (licence registers,
   Terms of Service, filings), linked in `sourceUrl`. Confidence is `VERIFIED` or `HIGH`
   only; nothing lower exists in the registry. **The operator test** (decision D3): the
   brand's own documents must name ONE legal entity, in one jurisdiction, that holds customer
   crypto whatever the client's residence. If the entity is chosen by the client's residence
   or contract, the brand stays out (that removed FalconX and Copper on 2026-09-21).
3. **Never include**: exchange deposit addresses, funders, routers, bridges, DEX
   contracts, token contracts, or issuer treasuries (Circle, Tether mint/burn wallets).
   Issuer *operational* wallets that are labelled are fine (e.g. Paxos 4).
4. **Never bypass CAPTCHAs** or rate limits on explorers. If an explorer blocks a page,
   find another lawful route (Arbiscan address pages return 403 to bots but the
   `/txs?a=` page header still shows the tag) or skip the address.
5. **Evidence expires.** `admissible()` in `lib/atlas/model.ts` refuses evidence older
   than 180 days. Every address row carries the real date its explorer page was read.
   Never stamp a placeholder or a future date; a future date makes the row inadmissible
   immediately. The earliest current evidence expires **2027-03-17**; the build gate fails 60 days
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
   health state (Delayed/Partial/Reconnecting) instead. The legacy demo engine, demo mode
   and `DEMO DATA` health state were removed on 2026-09-21. `verify-live-build.cjs` walks
   the static entry's local import graph and fails the build if a demo mode, demo generator
   or synthetic record field reaches it. Unit tests may use recorded real chain data as fixtures.

## 3. Data model in one screen

```
scripts/registry/addresses.txt      curated source of truth, 6 columns:
                                    chain|entity|address|label|checked|note
scripts/registry/code-probe.json    eth_getCode result per chain per address (mechanical)
scripts/registry/probe-code.mjs     regenerates code-probe.json (run after adding rows)
scripts/registry/measure-dormancy.mjs  writes dormancy.json: per chain, which evidenced wallets moved no
                                    USDC/USDT in 90 days (monthly; the build fails after 45 days)
scripts/registry/dormancy.json      the dated dormancy measurement (dormant list + last block of the active)
scripts/registry/gen-addresses.mjs  addresses.txt + code-probe.json + dormancy.json -> lib/atlas/known-addresses.ts
lib/atlas/known-addresses.ts        GENERATED. Never hand-edit. ADDRESSES keyed "Chain:0xaddr", DERIVED list,
                                    WATCHED (the live filter: evidenced minus dormant) and DORMANCY (date, counts)
lib/atlas/known-entities.ts         ENTITIES (hand-edited) + knownAttribution(chain,address),
                                    evidencedAddresses(chain) = the WHOLE registry, watchedAddresses(chain) = the live
                                    filter, dormancyInfo(), registryHealth(), isDerived()
lib/atlas/geography.ts              COUNTRIES, MAP_LABELS, EXPLORERS (address/tx URL builders), CHAIN_COLORS
lib/atlas/evm.ts                    token CONTRACTS per chain as {asset, decimals}; issuer-published only
lib/atlas/model.ts                  types, admissible(), CHAINS, EVM_CHAINS (the one source for "which chains")
lib/atlas/rollup.ts                 PURE sealed history (section 12): sealSpan/mergeRollups/coverageOf/baselineFor
lib/atlas/history-store.ts          IndexedDB for sealed spans, per browser. Impure; degrades to memory-only
scripts/chains.mjs                  CHAINS/EVM_CHAINS parsed out of model.ts for the plain-Node scripts
lib/atlas/engine.ts                 aggregate() -> corridors/totals; applies no chain filter itself
lib/atlas/live-core.ts              PURE logic: log decoding, pricing, chunk planning,
                                    inferDeposits(). No fetch/DOM/timers. Fully unit-tested.
lib/atlas/feeds.ts                  FEEDS: per-chain endpoints with measured caps, chunking (pure)
lib/atlas/live-client.ts            transport + state machine: per-chain feeds, endpoint
                                    rotation, backfill, poll, sample, health, dispose()
components/atlas.tsx                the UI
components/map/                     the globe/atlas renderer (section 11): world-map.tsx shell, engine.ts,
                                    camera.ts, interaction.ts, quality.ts, land.ts, arcs.ts, anchors.ts,
                                    atmosphere.ts, labels.ts, shaders.ts, frame.ts
components/map-fallback.tsx         SVG fallback when WebGL is unavailable (flat map only)
lib/atlas/encoding.ts               the contractual visual encodings, shared by both renderers (verified)
lib/atlas/geo3d.ts                  sphere maths for the globe (verified by scripts/verify-map.cjs)
lib/atlas/quality-policy.ts         quality profiles and the frame-time governor (verified)
lib/atlas/tween.ts                  eases and retargetable tweens (verified)
```

Registry keys are `${chain}:${address}` (lowercase on EVM). This matches the deferred
backend's `store.ts addressKey`, so keep it.

Current registry: **1,141 first-party rows** (Ethereum 812, Base 260, Arbitrum 62, Avalanche 7) across
64 entities and 29 jurisdictions, plus **2,036 derived** (Base 555, Arbitrum 723, Avalanche 758).
Avalanche's five own-page Snowscan tags include one new Bitkub wallet; the other four replace
derived evidence. Polygon is parked (section 12) and carries no rows.
Live filter (`WATCHED`) is re-measured per chain by the dormancy scan; the caps it must stay
under are Ethereum 1,000, Arbitrum 997, Base 4,800 and Avalanche 4,800. The remaining
evidenced addresses stay in the dormant tier; `scripts/registry/dormancy.json` records the
current per-chain counts. One filtered request body was measured at about 10.9 KB
on Ethereum, 4.0 KB on Base and 3.6 KB on Arbitrum (was about 55 KB each) right after the
tier shipped; upload for the backfilled hour fell from about 2.2 MB to 0.23 MB.
Measurements: `docs/measurements/2026-09-21/dormancy.md`.

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

- Two topic-filtered `eth_getLogs` calls per chunk: `[TRANSFER, [watched addrs], null]`
  for senders and `[TRANSFER, null, [watched addrs]]` for receivers. "Watched" is the
  registry minus the **dormant tier** (section 6, "Dormancy"): wallets with no USDC/USDT
  transfer in 90 days stay evidence but are not requested. This loses nothing for route
  drawing that an active wallet does not still catch, because a corridor needs an evidenced
  wallet at both ends and deposit sweeps are funded by exchange hot wallets. Measured cost
  for one hour on all three chains before the dormant tier: **4.1 MB down / 2.1 MB up**,
  against roughly 140 MB unfiltered (the upload shrinks with the filter, see section 3 for
  the sizes now). Do not go back to unfiltered feeds; that was the 29 MB/hour problem.
- A separate small **unfiltered sample** is fetched every ~10 minutes for the honest
  denominator (`Snapshot.sample`).
- **Per-chain config** in `FEEDS` (`lib/atlas/feeds.ts`, pure, imported by `live-client.ts`,
  the registry verifier and the diagnostic scripts): chain id, slot time, blocks per hour,
  chunk size, pause, and each endpoint's measured caps. Ethereum 50-block chunks, Base 1500,
  Arbitrum 1200 with a 350 ms pause. Change them only after re-measuring.
- **Endpoint caps** (measured 2026-09-21 with `scripts/probe-endpoint-caps.mjs` in the live
  request shape, three tries per size; "topics" = addresses in one indexed position, ~68
  bytes each; 4,800 addresses and 5,000 blocks were the largest sizes tried, so those are
  lower bounds):

  | Chain | Endpoint | Filter? | Max topics | Largest body | Max filtered range | CORS |
  |---|---|---|---|---|---|---|
  | Ethereum | eth.drpc.org | yes | 1,000 (1,024 "exceed max topics") | ~67 KB | 100 | `*` |
  | Ethereum | rpc.mevblocker.io | yes | 4,800+ | ~323 KB+ | 5,000+ | echoes origin |
  | Ethereum | 1rpc.io/eth | no (demoted 2026-09-21) | refused 805 3/3 (503, "apply an OnFinality API key") | – | none (rate-limited) | `*` |
  | Ethereum | eth-pokt.nodies.app | no | 403 on any large POST | – | 50 | `*` |
  | Base | mainnet.base.org | yes | 4,800+ | ~323 KB+ | 2,000 | `*` |
  | Base | base-rpc.publicnode.com | yes | 4,800+ | ~323 KB+ | 5,000+ | `*` |
  | Base | 1rpc.io/base | no | 815 passed; rate-limited at 1,000 | ~55 KB | 50 | `*` |
  | Arbitrum | arbitrum.gateway.tenderly.co | yes | 1,000 (1,024 "exceed max topics") | ~67 KB | 5,000+ | `*` |
  | Arbitrum | arb1.arbitrum.io/rpc | yes | 997: 1,000 selectors incl. 2 contracts + event topic | ~67 KB | 5,000+ | `*` |
  | Arbitrum | arbitrum.drpc.org | no | 1,000 over 100 blocks | ~67 KB | 100 | `*` |
  | Arbitrum | 1rpc.io/arb | no | rate-limited at 773 | – | 50 | `*` |
  | Polygon | polygon-bor-rpc.publicnode.com | yes | 1,000 (1,024 "exceed max topics") | ~67 KB | 5,000 (10,000 for the dormancy scan) | `*` |
  | Polygon | polygon.drpc.org | yes | 1,000 | ~67 KB | 100 | `*` |
  | Polygon | polygon-rpc.com | – | **key-gated**: HTTP 401 "API key disabled, tenant disabled" | – | – | `*` |
  | Avalanche | api.avax.network/ext/bc/C/rpc | yes | 4,800+ | ~323 KB+ | 5,000 (**500,000** accepted for the dormancy scan) | echoes origin |
  | Avalanche | avalanche-c-chain-rpc.publicnode.com | yes | 4,800+ | ~323 KB+ | 5,000 (50,000 for the scan) | `*` |
  | Avalanche | avalanche.drpc.org | no (demoted 2026-09-25) | 2,400; 4,800 timed out 1/3 ("upgrade to paid plan") | ~162 KB | 100 | `*` |
  | Celo | forno.celo.org | measured, not shipped | 1,024 (1,200 failed 2/3) | ~69 KB | 5,000 | `*` |
  | Celo | celo.drpc.org | unusable | "invalid hex string" to the filtered shape | – | none | `*` |
  | Optimism | mainnet.optimism.io | measured, not shipped | 1,000 (1,024 failed 1/3) | ~67 KB | 5,000 | `*` |
  | Optimism | optimism-rpc.publicnode.com | measured, not shipped | 4,800+ | ~323 KB+ | 5,000 | `*` |

  Polygon and Avalanche were measured 2026-09-25; Celo and Optimism were measured and then rejected on
  activity (section 12). **Polygon's binding range cap is drpc's 100 blocks**, which is why its chunk is 100 —
  the same trade Ethereum makes to keep two endpoints able to serve the filtered feed.

  **The binding caps are 1,000 addresses on Ethereum (drpc) and 997 on Arbitrum (arb1).**
  They now apply to the WATCHED list, not the whole registry (D2). Every Ethereum plain-account
  row still derives onto Base and Arbitrum, but only takes a slot on a chain where it moved
  money in the last 90 days. Headroom on 2026-09-22: 861 slots on Ethereum, 952 on Arbitrum.
  `verify-registry.cjs` fails the build when a chain's live filter exceeds the smallest
  `maxTopics` among its `largeBody` endpoints, or its chunk exceeds the smallest `maxRange`;
  it warns within 5%. If the watched list ever reaches a cap, shard the query; never raise a
  cap without re-measuring.
- **Dormancy scan endpoints** (measured 2026-09-21, filtered request, `measure-dormancy.mjs`):
  mevblocker accepts 10,000 blocks (20,000 refused), publicnode Base 5,000 (20,000 refused)
  until it started answering 403 to everything, `mainnet.base.org` 2,000, Tenderly and arb1
  1,000,000+ blocks when the result is small. Ethereum takes about 2 minutes, Arbitrum 1, Base
  about 30 (3.9M blocks at 2,000 per request).
- **Other endpoint facts** (verified 2026-09-19–21): `base.drpc.org` rejects the filter.
  `arbitrum.drpc.org` returned chain id `42161` and real logs over a 40-block unfiltered
  sample, so it serves headers and samples. publicnode's Arbitrum node needs a token;
  llamarpc, blockpi, meowrpc and alchemy-demo are dead.
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

### Measuring first (before and after any research wave)

Rank work by measured activity, not row counts. On 2026-09-21, 83% of the Ethereum
registry had moved no USDC/USDT in 90 days, and filter slots are capped (section 5), so a
dormant row is not free. The diagnostics are read-only and never shipped:

- `node scripts/measure-activity.mjs <Chain> [hours] [--end-hours-ago N] [--out f.json]`:
  which evidenced wallets moved money, idle entities, direct entity and jurisdiction edges,
  and the largest unlabelled counterparties per entity (research leads, not evidence).
- `node scripts/measure-corridors.mjs --window w.json [--end-hours-ago N] --refs <old>,<new>`:
  replays the map's 1H view with the browser's own pure functions and compares two
  registries on identical chain history and prices. Windows must end within about 22 hours
  (CoinGecko's free 5-minute series) and after the newest row's `checked` date. The five
  windows and results from 2026-09-21 are in `docs/measurements/2026-09-21/`.
- `node scripts/registry/label-scan.mjs [--host basescan.org|arbiscan.io|snowscan.xyz] [--expand] <term>...`:
  enumerates explorer tags; `--expand` walks numbered families past the 15-row cap. Terms
  for re-scanning the unlabelled and excluded lists are in `label-scan-terms.txt`.
- `node scripts/registry/screen-activity.mjs <Chain> <days> <candidates.txt>`: RPC activity
  screen for candidates before spending explorer requests or filter slots on them.
- `node scripts/registry/read-tag.mjs <etherscan.io|basescan.org|arbiscan.io|snowscan.xyz> <addr>...`:
  the admissible read. It prints the tag verbatim and any "tagged based on ... compilation"
  disclosure, which goes into the row's note.
- `node scripts/probe-endpoint-caps.mjs <Chain>`: endpoint caps for `feeds.ts`.

Working admission floor since 2026-09-21: a tagged wallet is added only if it moved at
least $100k in the screening window (7 days on Ethereum and Base, 3 days on Arbitrum).
Documented operators whose tagged wallets moved nothing in 90 days are recorded as such and
left out. Yields that day: hub counterparties 2 of 184 admissible; numbered exchange tails
10 of 598; country leads 11 of 58 active; Basescan 3 of 330; Arbiscan 14 of 679.

### Adding addresses (a "research wave")

1. Read the address's own explorer page on the target chain; record the exact tag.
2. Append a row to `scripts/registry/addresses.txt`, for example
   `Base|coinbase|0x...|Coinbase 10|2026-09-21|hot wallet, very active`. Address lowercase.
   `checked` is today's real date. The entity id must exist in `known-entities.ts`.
3. `node scripts/registry/probe-code.mjs` updates `code-probe.json`; it is cached, so only
   new addresses hit the network.
4. `node scripts/registry/gen-addresses.mjs scripts/registry/addresses.txt lib/atlas/known-addresses.ts`
   New rows are watched by default until the next dormancy measurement (see "Dormancy" below).
5. `node scripts/verify-all.mjs` must be green.
6. `corepack pnpm build:live`, then check `dist-live/` in a browser (see below).

### Dormancy (monthly, and after a research wave)

Decision D2 (approved 2026-09-21): a wallet with no non-zero USDC/USDT transfer on its chain in the last 90
days stays in the registry as evidence, but is left out of the live filter (`WATCHED`), so browsers do not
upload or query it. A transfer that touches a dormant wallet still resolves to its entity through
`knownAttribution()`, so an active hub paying one still draws its route. Only a wallet that wakes up next
to unwatched counterparties is missed, until the next measurement.

```
node scripts/registry/measure-dormancy.mjs        # about 30 minutes; writes scripts/registry/dormancy.json
node scripts/registry/gen-addresses.mjs scripts/registry/addresses.txt lib/atlas/known-addresses.ts
node scripts/verify-all.mjs
```

- The scan goes newest to oldest and drops each wallet from the query the first time it moves, so busy hubs leave
  in the first few requests. It aborts and writes nothing if any range cannot be read: an unread range cannot
  be called dormant.
- `verify-registry.cjs` fails the build when `dormancy.json` is older than 45 days (warns at 30), when the
  window is under 90 days, or when `WATCHED` disagrees with the file. Rows added after the measurement are
  reported as "unmeasured" and watched by default.
- If `known-addresses.ts` does not compile because `WATCHED` is missing, run `gen-addresses.mjs ... --bootstrap`
  first (all wallets watched, dated 1970, rejected by the build gate), then measure.
- Do not hammer publicnode's Base endpoint while a scan runs: it answered 403 to everything (even small
  requests) after repeated probing on 2026-09-21, and the scan then ran on `mainnet.base.org` at 2,000 blocks.

Adding an entity: add an `e(...)` line in `ENTITIES` in `known-entities.ts` with
jurisdiction, VERIFIED/HIGH, a regulator or company `sourceUrl`, a meaningful
`evidenceNote` and today's `lastVerified`. The `source` string must **not** begin with
"Etherscan"; the explorer name is composed per chain by `knownAttribution()` and the
verifier checks for it. New jurisdiction: add to `COUNTRIES` (and `MAP_LABELS` if it
should be labelled) in `geography.ts` with an anchor point.

Entities with **no label on Base** as of 2026-09-20: Fidelity (contributes there only via
derivation). Cumberland, Jump, Galaxy, GSR, B2C2, Amber and Zero Hash were removed from the
registry entirely on 2026-09-21 (see below); this note is stale for them. Basescan indexes
deeper numbered tails (Coinbase to about 200) but 59 and above were verified to be deposit
sweeps, so they were not pursued.

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
FTP folder. Look for: no 404s (including the `world-110m.json` preload), reaches LIVE,
corridors appear on All chains, Ethereum, Base, Arbitrum and Avalanche, Tron and
Solana say Not connected, no blank map on any option, and the layout holds at 375x812.
For recorded history (section 12): on a fresh profile **24H and 7D are disabled** and hovering one
explains how much more history is needed; after about an hour the Data & coverage panel shows sealed
spans (expect one per chain per quarter hour) and a span recorded; **reload and confirm the count
survives**; "Clear recorded history" empties it and re-locks the long windows. To exercise the long
window without waiting a day, lower `UNLOCK_SHARE` in `live-client.ts` temporarily — then check the
axis reads a date rather than "11:06 to 11:06", the corridor panel hides the evidence toggle and
explains the absent transaction list, and the Unmapped view keeps its exact headline while saying why
it lists no transfers. **Put the constant back.** A private window must still show the map with the
long windows locked, never an error. For the renderer
(section 11): the globe morphs to ATLAS and back, and toggling mid-morph reverses cleanly;
a country click flies the camera to it and opens the panel; a corridor click opens its
panel; the pause button stops particles, breathing and auto-rotation; `?fallback=svg`
shows the SVG map with the toggle hidden and the chrome visible; `?debug=map` prints draw
calls, smoothed frame time, DPR and phase in the bottom-left (expect 10-11 calls on the
globe, 8 on the atlas). Test a real phone over the LAN as well as the emulated viewport:
the embedded browser pane throttles animation frames and stops them while hidden, so
frame times and hover measured there mean nothing.

### Lint

`pnpm lint` has **45 pre-existing errors** (recounted 2026-09-25 after the renderer rewrite;
the same figure as 2026-09-21) in `components/atlas.tsx`, the SVG fallback, the deferred
backend files and the CommonJS verifiers. The new renderer under `components/map/` and the new
pure modules are lint-clean; `scripts/verify-map.cjs` carries a file-level disable for the
`require` rule rather than adding four more. That count is the baseline; do not add to it and
do not spend time fixing it unless asked.

## 7. Things that look wrong but are intentional

- The map attributes only about 12% of observed value. By design.
- Dormant wallets stay in the registry. Since D2 they no longer cost filter bytes (they are
  left out of `WATCHED`), but they are still evidence, and evidence is not deleted for
  convenience. `evidencedAddresses()` is the whole registry; `watchedAddresses()` is the filter.
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
- **Limits reached on 2026-09-21** (reported to Jake):
  - **Explorer labels are close to exhausted on the three chains.** Every tagged, unregistered
    wallet of the hubs, the big exchanges and the country leads was enumerated and screened;
    what was active has been added.
  - **Coverage of India and South America is blocked by chain, not labels.** CoinSwitch,
    Bitbns, GOPAX, Ripio, Hata and Bitcoin.de have documented operators, but their tagged
    Ethereum wallets moved nothing in 90 days. Their stablecoin flow is most likely on Tron or
    BNB Chain. Tron needs a TronGrid key.
  - **BNB Chain is keyless but tight.** publicnode passed 100-block getLogs and returned
    9,821 USDT logs in that span, so it needs the filtered feed. Its stablecoins use 18
    decimals. **Superseded 2026-09-25: BNB is inadmissible, not just tight** — no issuer
    publishes a USDC or USDT contract for it, so its volume is a Binance-Peg bridge asset
    (decision D4, section 12). The India/LatAm gap is Tron's to fill, not BNB's.
- **Resolved 2026-09-25/26 (section 12):** Avalanche is live, adding South Africa (VALR) and
  Türkiye (BtcTurk). Polygon, which would add Brazil (Brasil Bitcoin), Indonesia (Indodax) and
  the Mexico corridor, is measured but **parked**: free endpoints cannot support its dormancy scan.
  Circle's registry lists 38 mainnet chains, so the keyless, issuer-native headroom is far
  from exhausted: Linea, Unichain, World Chain, Sonic, ZKsync Era, X Layer, Ink and Plasma
  are all candidates, and Optimism is already measured. **India still needs Tron.**
  - **Filter slots:** no longer a constraint after the dormant tier (D2): 861 left on Ethereum
    and 952 on Arbitrum, and a new wallet only costs a slot where it is active.

## 8. Open to-dos, in rough priority

1. **Done 2026-09-21 — remove synthetic data** (rule 8). The demo generator, UI/API demo
   switches, seeded snapshot fields and synthetic model fields are gone. `verify-live-build.cjs`
   is wired into `verify-all.mjs` and inspects the static live import graph before Vite runs.
2. **In progress — expand free real-data sources** (section 7b), and report to Jake when free sources
   run out, with a recommended list of free/paid APIs for him to get.
2b. **Done 2026-09-21: D1, D2 and D3** (`docs/DECISIONS-2026-09.md`). D1 no; D2 a 90-day dormant
   tier, built; D3 no additions. Ten brands failed the operator test and were removed: FalconX
   and Copper first, then BitGo, Cumberland, Galaxy, Jump, B2C2, GSR, Zero Hash and Amber Group
   once tested against the same standard (37 address rows, 10 entities; none had Base or Arbitrum
   rows). **Recurring: re-run `measure-dormancy.mjs` monthly** (the build fails after 45 days).
3. **Re-verify evidence before 2027-03-17.** The build gate starts failing around
   mid-January 2027. Re-read the explorer pages and update the `checked` and
   `lastVerified` dates; do not just bump dates.
3b. **Product backlog agreed with Jake on 2026-09-24.** He reviewed a full list of improvement
   options and picked two to build now: the per-jurisdiction one-sided flow view and the unmapped
   investigation tools (both shipped that day, see section 10). On 2026-09-25 he then commissioned
   the globe renderer rewrite (section 11), which shipped the same day. The rest he deferred, in
   his stated priority order. **Raise these again the next time he asks what to work on:**
   - ~~**BNB Chain, then Polygon.**~~ **Done 2026-09-25, with a different answer than the backlog
     assumed (section 12).** BNB is inadmissible (D4); **Avalanche** shipped and **Polygon** is parked, chosen by
     measured evidenced activity over Celo and Optimism. A first Snowscan label wave shipped on
     2026-09-28 (section 13); **Polygonscan labels remain unresearched** while Polygon is parked.
   - **Tron**, once Jake supplies a TronGrid key: still the single largest coverage jump, and now the
     only route to India, since BNB is out (section 7b). Needs the key to live somewhere other than the
     client bundle.
   - ~~**Longer in-browser history via IndexedDB.**~~ **Done 2026-09-25 (section 12, decision D5):**
     15-minute sealed spans, measured coverage, 24H/7D unlocking at 80% observed, and real baselines.
     Tunable: `UNLOCK_SHARE` in `live-client.ts`.
   - **Shareable URL state** for view/window/chain/country (hash routing).
   - **`walk-families.mjs`**: promote the 2026-09-24 scratch pipeline (derive tag families from
     addresses.txt → `label-scan --expand` → diff → `screen-activity` → `read-tag`) into a repo
     script. It found 19 wallets in two days and should be a monthly job, not a rediscovery.
   - **Broader deposit inference** (relaxed forward threshold, or exclusive-counterparty
     addresses). Methodology change: needs Jake's explicit approval and a measured before/after
     with `measure-corridors.mjs --explain`. Deliberately last.
   - **Smaller hygiene:** show registry counts and the dormancy date in the Data & coverage
     panel; code-split three.js out of the ~1.35 MB bundle; drop the expected public-endpoint
     400/404/429 console noise to `debug` so real faults stand out.
4. GitHub plus Cloudflare Pages hosting to replace manual FTP (Jake's noted future to-do).
5. More first-party L2 labels: done on 2026-09-21 for every entity measured as active on
   Base or Arbitrum. The unregistered market-maker, Upbit and Bithumb wallets were idle, so
   they were not pursued.
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
- 2026-09-21, "more flows and countries" (`679b514` to `be03bf3`):
  - Measured endpoint caps became a build gate (`feeds.ts`), and 1rpc.io/eth was demoted.
  - Diagnostics now measure activity and replay the 1H view against stored hours.
  - Each research wave was ranked by measured activity:
    - Ten newer OKX, Kraken, Bitpanda and Binance hot wallets. OKX 225, 217 and 191 alone moved about
      $3.8B in the week.
    - Four operators: HashKey (HK), Independent Reserve (AU), Lemon Cash (AR, a new country) and
      Brasil Bitcoin (BR).
    - Sixteen first-party L2 labels, six of them upgrades from derived.
  - Over five stored hours, corridors rose 14% and attributed value 4%; Arbitrum's attributed value
    more than doubled (`docs/measurements/2026-09-21/`).
  - The market-maker hubs were already covered: of 186 unregistered hub tags only Coinbase Prime 1
    was active, and its custodian is ambiguous (D3).
- 2026-09-21, decisions D1-D3 (`docs/DECISIONS-2026-09.md`): Jake approved D2 and asked for D1 and D3 to be
  answered outright.
  - D2 built: `measure-dormancy.mjs`, `dormancy.json`, generated `WATCHED`, a 45-day build gate. The live
    filter fell from 824/831/799 to 153/55/48 addresses; upload for the backfilled hour fell about 89%.
    Replayed hours are identical with and without the tier; out of sample, no wallet that woke in the
    last 30 days would have cost a corridor (`docs/measurements/2026-09-21/dormancy.md`).
  - D1 no. D3 no additions. FalconX and Copper failed the operator test and were removed first (hour A
    attributed value fell $1.0M of $73.4M). Every other entity carrying the same "brand-level tag, several
    affiliates" caveat was then tested by a research agent per entity, WebFetch/WebSearch only: BitGo,
    Cumberland DRW, Galaxy Digital, Jump Trading, B2C2, GSR, Zero Hash and Amber Group all failed too and
    were removed. 37 address rows and 10 entities removed in total; the dormant tier and every verifier
    were re-run clean afterwards.

## 10. Unplaced flow and the Unmapped view (2026-09-24)

The map draws a route only when both ends are evidenced in different jurisdictions, which is about
5-10% of adjusted value. The other 90% used to exist only as an undifferentiated country glow and a
single `totals.unattributed` number. Two views now report it, without loosening any evidence rule.

- **`CountrySummary.unplacedIn` / `unplacedOut` / `entities`** (`engine.ts aggregate`). When exactly
  one end of an adjusted transfer is admissible, the direction and the evidenced entity are both
  known even though the counterparty is not. That is recorded per jurisdiction and per entity, and
  shown in the jurisdiction panel under "Flow with unplaced counterparties". It is **not** settlement
  between two places and must never be presented as such, or added to `attributed`. Cayman Islands on
  the first live run: $12.6M attributed, $62.4M unplaced flow.
- **`selectUnattributed()`** (`engine.ts`, pure, covered by `verify-model.cjs`) backs the Unmapped
  tab: the same economic filter as `aggregate` (priced, not excluded, not placed at both ends), but
  it keeps the transfers, the evidenced entity on the known side and the unplaced counterparty
  addresses. `live-client.ts unattributed()` is now only a chain filter over the buffers.
- **Filters never move the headline.** `count`, `usdValue` and `reasons` always describe the whole
  window; `minUsd`, `search`, `sort` and `limit` narrow `items`, `shown`, `counterparties` and
  `entities` only. The default list filter is >= $1k because most rows are dust. Asserted in
  `verify-model.cjs`; keep that invariant if you touch the filter.
- **"Largest unplaced counterparties" is a lead list, not evidence.** It ranks unevidenced addresses
  by value moved against evidenced wallets — the same signal `measure-activity.mjs` prints offline,
  which is how most wallets were found in the September waves. Rule 1 still applies: an address is
  only ever admitted from its own explorer name tag plus an operator document, never from who it
  transacts with. The UI says so; do not remove that line.

## 11. Renderer: the globe that unfolds into the atlas (2026-09-25)

Jake's brief was a visual transformation "from a $5k website to a $500k one": a 3D globe on arrival
that unfolds into the Equal Earth map, a cinematic but data-first look in the existing palette, and
the same experience on the newest phones with only imperceptible degradation. `components/map/`
replaced `components/world-map.tsx` wholesale; `components/map-fallback.tsx` (SVG) stays for browsers
without WebGL. Plan: `~/.claude/plans/i-would-like-you-dazzling-kazoo.md`.

**How it is built (why it is fast).** One perspective camera in both modes. Every vertex carries two
positions, `position` on the sphere (R = 265) and `aFlat` on the Equal Earth plane z = R (today's
`scale(190)` frame, so every overlay offset still lands), and one uniform `uMorph` blends them in the
vertex shader: the morph costs the CPU nothing. Land is a Fibonacci dot set classified against a
country-index raster (one `Points` draw; the same raster gives O(1) country hit-testing); outlines
and graticule are one merged `LineSegments`, split at the antimeridian. Corridors live in 64 slots:
two RGBA32F textures hold each slot's great-circle and Bézier samples, one quad-strip geometry is
drawn twice (core, then a wider additive halo — the "bloom" without a post-processing pass) and one
`Points` system samples the same textures in its vertex shader, so particles cost zero per-frame
uploads. Anchors are three instanced draws (ring+dot, halo, beam; instance 36 is the raw-event
ripple). Atmosphere is the sphere body plus a back-face Fresnel rim. Total: 10-11 draw calls on the
globe, 8 on the atlas, no `EffectComposer`, no lights, no textures shipped. On desktop the canvas
runs under the header and footer bands (`.world-map{inset:-70px 0 -90px}` above 980 px) so the globe
can be large; `engine.ts` measures the map area from the computed insets and keeps the atlas frame
fitted to it, so overlays never moved.

**Mobile.** `quality-policy.ts` picks High or Balanced from device hints (never the UA), renders at
DPR ≤ 2 (DOM labels stay at native DPR, so text is always crisp), uses no MSAA (see "Performance
pass" below) and runs a frame-time governor with hysteresis and a lock after every change
(2 → 1.75 → 1.5, two-way; Balanced thins dots with `setDrawRange` on the prefix-uniform Fibonacci
sequence, drops particles per route and beams). `prefers-reduced-motion` freezes the clock, skips
the arrival reveal and makes the morph instant while keeping the direction ramp legible. The RAF
loop is cancelled while the tab is hidden.

**Gotchas found while building it.** Float textures must be declared `highp sampler2D` (the GLSL
default `lowp` clamps to ±2 and every arc collapses to the origin). Screen-space ribbon quads wind
either way, so their materials are `DoubleSide` (front-face culling silently removed every arc).
`renderer.setSize(w,h)` must set the canvas CSS size: with `updateStyle=false` a DPR-2 phone draws
the canvas at its intrinsic 2× size and the globe appears doubled and offset. `splitAntimeridian`
must handle a ring stepping straight from −180 to +180 (Russia), or two NaN vertices poison a
bounding sphere. The distance tween must start at the globe end, not the atlas end.

**Encodings.** Unchanged in meaning; the methodology `<dl>`, the legend caption and
`docs/METHODOLOGY.md` now also say: arc height is visual on the globe and the map; the brighter end
of a line is the destination; glow, beam and brighter land are one one-sided-activity encoding, never
a route; day/night is the real solar position (astronomy, not data); dotted land is cartography with
no data in dot density. Route cap is 32 desktop / 24 on ≤ 980 px, in `encoding.ts`.

**Flags and hooks.** `?debug=map` (draw calls, governor EMA ms, CPU ms per frame, DPR, phase, `60 cap` when
the idle cap is on, land build ms; exposes `window.__atlasScene` and `window.__atlasBench`, below),
`?fallback=svg` (forces the SVG path). `MapHandle` is unchanged; `mode` and `onReady` were added.
`onReady` fires on the first frame with land (or on the fallback/error paths) and lifts the chrome.

**Not yet measured.** Frame times on a real iPhone/Android and a thermal soak: the embedded browser
pane used for checks throttles to ~10 fps and stops while hidden, so only the draw-call budget and
the governor's demotion path were observed. Hover was verified by code path only for the same reason.

### Performance and look pass (2026-09-26)

Jake asked to "improve performance of the threejs" and "upgrade design elements". Measured on this
machine's Intel UHD 770 (ANGLE/D3D11, Chrome) with the new bench, canvas 631×680 CSS px:

| | before | after |
|---|---|---|
| GPU per frame at DPR 2 | ~5.5 ms (4× MSAA) | ~0.6-0.8 ms (no MSAA) |
| GPU per frame at DPR 1 | ~1.9 ms (4× MSAA) | ~0.4 ms |
| CPU per frame (render submission + our JS) | ~0.7 ms | ~0.65 ms |
| Paused or reduced motion | full frame every vsync | 0 frames drawn, ~0.005 ms per tick |
| Idle on a 120 / 144 Hz display | 120 / 144 fps | 60 / 72 fps (by construction; this machine is 60 Hz) |

What changed and why:
- **No MSAA.** It was ~80% of the GPU frame. Desktops (fine pointer) now render at the governor's DPR
  even on a DPR 1 screen, so the anti-aliasing is 2× supersampling, which measured cheaper than 4× MSAA at
  DPR 1. Touch devices still never render above native density. `HIGH.antialias` is now false.
- **Governor recovery.** `FAST_MS=12` could never be reached at 60 Hz (the sample is `max(cpu, frame
  interval)` and the interval is 16.7), so one slow second lowered DPR for the rest of the session.
  Now `ON_TIME_MS=17.2`, and recovery is a probe with back-off: a step up that is undone within 6 s
  doubles the next wait (3 s up to 48 s). `verify-map.cjs` covers it.
- **Frame pacing** (`engine.ts` `draw`/`step`): a still scene (paused, reduced motion, settled camera,
  nothing easing) draws nothing and writes no styles; ambient motion is capped near 60 fps (ticks under
  10.5 ms apart are skipped) while input, flights and the morph run at the display rate. `arcs.frame`
  and `anchors.frame` return whether they are still easing; `rig.moving()` covers tweens and inertia.
- **Smaller:** land dots that are invisible (far side, not yet revealed) leave the clip volume; the sun
  updates every 10 s; `--vignette` and label styles are written only on change; hover hit-testing runs
  only when the cursor or view moved, with no per-sample allocations; one world raster instead of two;
  shaders compile with `compileAsync` before the first frame and before land joins the scene.
- **three.js is code-split** (`world-map.tsx` dynamic-imports `./engine`; the request starts at module
  evaluation). A failed chunk load falls back to the SVG map. `verify-live-build.cjs` now walks dynamic
  imports and asserts the renderer is inside the checked graph. Confirmed in the 2026-09-28
  production build after the dormancy refresh: `dist-live/assets` contains a separate `engine-*.js`
  chunk, and the nested FTP-style `dist-check` path serves it and the page assets with HTTP 200.
  A real-device render and thermal check remain open below.
- **`dispose()` no longer calls `host.replaceChildren()`**, which deleted React-owned nodes (vignette,
  tooltip) and made React throw `insertBefore` on remount (HMR, StrictMode).

Look (same palette, no encoding changed in meaning):
- **Atmosphere** is shaded analytically from the view ray's closest approach to the centre: a thin
  bright limb over a soft exponential haze, brighter on the real day side, fading quickly inside the
  limb so the morph never shows a lit disc. It fades in with the land reveal.
- **Body** is lit in the globe's own frame. Before this it mixed a world-space normal with the
  globe-space sun, so its shading disagreed with the dot terminator as the globe turned. It also gets a
  faint specular glint and a Fresnel edge.
- **Comet trails:** each particle leaves a short tail along its ribbon (same phase formula, fragment
  shader loop, no extra draw call), with a hot core on the particle itself. The legend and METHODOLOGY
  say the tail only repeats the direction.
- **Depth:** land dots shrink and dim toward the limb. **Arrival:** a 2.4 s dolly-in from 0.84× while
  the land reveals (skipped with reduced motion or after input).

**Bench.** With `?debug=map`, `await __atlasBench(n,{dpr,hover,force})` drives the frame function
synchronously (it works while the tab is hidden, unlike RAF) and returns mean CPU ms, GPU ms from
`EXT_disjoint_timer_query_webgl2` where available, frames drawn and canvas size. `force:false` counts
how many of `n` ticks would actually draw. Toggle `__atlasScene.children[0].children[i].visible` to
attribute GPU time per layer. GPU numbers are this iGPU's; a phone still needs a real-device check.

## 12. Two new chains, and the longer time frames (2026-09-25)

Backlog item 3b's first and third entries, both approved by Jake the same day. Plan:
`~/.claude/plans/floating-cuddling-moth.md`. Measurements:
`docs/measurements/2026-09-25/new-chain-candidates.md`. Decisions: **D4** and **D5** in
`docs/DECISIONS-2026-09.md`.

### Avalanche live, Polygon parked, and why not BNB or Celo

The backlog said "BNB Chain, then Polygon". **BNB Chain turned out to be inadmissible, not merely
awkward**: Circle publishes no native USDC for it and Tether publishes no USDT contract for it, so its
large stablecoin (Binance-Peg BSC-USD, 18 decimals) is a Binance liability created by a bridge, which
rule 3 excludes. Jake decided to skip it (D4). **The same rule excludes Polygon's bridged USDT**, so
Polygon carries USDC only, exactly as Base does. Do not "fix" that by adding `0xc2132d05…`.

Four issuer-native candidates were then measured and the best two shipped:

| Chain | Active of 763 candidates | Value | What it adds |
|---|---|---|---|
| **Avalanche** | 19 in 3 days | ~$150M | **VALR (South Africa) $70M, BtcTurk (Türkiye) $48M**, MaiCoin, Bitso, Lemon Cash |
| **Polygon** | 20 in 1 day | ~$12M | **Brasil Bitcoin, Indodax, Lemon Cash**, Bitso, CoinSpot, MaiCoin, Shakepay |
| Optimism | 13 in 3 days | ~$24M | Third on both counts, US-concentrated. Cheapest next chain: caps measured, tokens issuer-native |
| Celo | 3 in 3 days | ~$0.75M | Rejected |

**Celo is the lesson worth keeping.** It is the busiest of the four by a wide margin — about 460,000
USDT transfers an hour, more than Ethereum — and only three evidenced wallets touched it in three days.
Its traffic is retail peer-to-peer, not exchange settlement. Ranking candidates by chain volume would
have chosen Celo first and Avalanche last; ranking by measured evidenced activity did the opposite.
This is why section 6 says to measure first.

Also found: **`polygon-rpc.com` is now key-gated** (HTTP 401, "API key disabled"), and
**`celo.drpc.org` answers "invalid hex string"** to the filtered request shape.

**Polygon was then parked (2026-09-26, Jake's decision), and only Avalanche went live.** Polygon's
live feed works, but the 90-day dormancy scan decision D2 requires does not fit on free endpoints:
`polygon-bor-rpc.publicnode.com` **prunes everything older than ~37 hours** ("History has been pruned
for this block", boundary found by binary search at ~89,600 blocks back), and `polygon.drpc.org` keeps
full history but serves **100 blocks per request** — about 102,000 requests, ~8 hours, every month.
Shipping it unmeasured would upload the whole 763-address filter on every poll, ~19 MB an hour per open
tab. Jake chose to park it over both. Its measured config is `PARKED` in `feeds.ts`; contracts,
explorer, colour and script pools are kept. **Switch it on** when a keyed Polygon endpoint with
archive access exists or the phase-2 backend can run the scan: move `PARKED.Polygon` into `FEEDS`, add
Polygon to `CHAINS` and `EVM_CHAINS`, then follow the add-a-chain order below.

### Adding a chain is now cheap — one list, not seven

`CHAINS` and `EVM_CHAINS` in `model.ts` are the single source of truth. The literal chain arrays that
used to be scattered through `verify-registry.cjs` (five of them) and `gen-addresses.mjs` (two) are
gone; `scripts/chains.mjs` parses `model.ts` as text for the plain-Node scripts, deliberately without
compiling, so a broken `known-addresses.ts` cannot stop it being regenerated. `verify-registry.cjs`
now derives its chain lists from `FEEDS` (live chains), from `WATCHED` (chains with a filter) and from
the registry itself, and asserts that **every CHAINS member has an `EXPLORERS` and a `CHAIN_COLORS`
entry** — both are string-keyed, so a missing one is not a type error but throws at runtime.

Still per-chain by necessity, because each carries measured facts: `FEEDS` (`feeds.ts`), `CONTRACTS`
(`evm.ts`), `POOLS` (`rpc-pool.mjs`), the `eth_getCode` pool in `probe-code.mjs`, and `ENDPOINTS` /
`FIRST_SPAN` in `measure-dormancy.mjs`. `probe-code.mjs` now throws if an EVM chain has no entry.

**Order matters when adding a chain**, because it is circular — the dormancy scan reads evidenced
addresses out of the generated file, which does not list the new chain until the generator has run,
which wants a dormancy entry for it:

```
1. model.ts (CHAINS, EVM_CHAINS) · evm.ts · geography.ts (EXPLORERS + CHAIN_COLORS) · feeds.ts · rpc-pool.mjs
2. node scripts/probe-endpoint-caps.mjs <Chain> --tries 3      # fill in the real maxTopics/maxRange
3. node scripts/registry/screen-activity.mjs <Chain> 3 <candidates.txt>   # THE GATE: measured activity
4. node scripts/registry/probe-code.mjs                        # lets Ethereum plain accounts derive there
5. node scripts/registry/gen-addresses.mjs … --bootstrap        # fills in the MISSING chains as unmeasured
6. node scripts/registry/measure-dormancy.mjs                   # now it can see the new chain's addresses
7. node scripts/registry/gen-addresses.mjs …                    # the real filter
8. node scripts/verify-all.mjs
```

`--bootstrap` now **merges**: it fills in only the chains absent from `dormancy.json` and leaves a real
measurement alone. It cannot ship, because `verify-registry.cjs` errors on a chain that has a live
filter but no dormancy entry — the measurement is deferred, never skipped.

**Recurring cost Jake was warned about:** each new chain adds a monthly dormancy scan. Measured spans
for the new ones: Polygon's publicnode caps at 10,000 blocks per filtered request;
`api.avax.network` took **500,000** (11,263 logs in 26 s).

**Polygon is the thin one, and it bit hard.** It has exactly one usable keyless endpoint for large
filtered reads (`polygon-bor-rpc.publicnode.com`); `polygon.drpc.org` serves only 100-block ranges and
`polygon-rpc.com` is now key-gated. Seven further candidates were tried on 2026-09-25 —
llamarpc, blastapi, `1rpc.io/matic`, blockpi, pokt/nodies, therpc.io and onfinality — and **all** were
dead, HTML-blocked or capped at 50 blocks. So Polygon's monthly scan rests on one host, which throttles
sustained querying. Its pace is set by `POOLS.Polygon.pauseMs` (700 ms, deliberately slower than the
250 ms elsewhere); the scan takes about 50 minutes and the whole five-chain run about 100.

**A real defect this exposed, now fixed in `measure-dormancy.mjs`.** On an error the scan used to halve
that endpoint's `maxSpan` permanently for the run. Polygon's node answers sustained load with errors
that name no range, those were read as "request too big", and the span ratcheted 10,000 → 100 with no
way back — 14,850 queries to cover 16% of the window, an eight-hour tail. Halving the range is also the
worst possible response to a load error, because it doubles the request count. The classification is now
explicit: only a message that genuinely names a range or size may shrink an endpoint, everything else
backs off and retries. **If a scan ever crawls again, check the span in the progress line first** — a
collapsing span is this failure mode, not a slow chain.

**A second failure mode, found 2026-09-26: archive depth.** Several free nodes serve only recent history.
Base's publicnode refuses anything past roughly the newest 5% of a 90-day window ("Archive requests require
a personal token"), Avalanche's publicnode answers "not found" past ~1–3.5M blocks, and Polygon's prunes
past ~37 hours. Those replies are now classified as archive limits and retire the endpoint for the rest of
the run, because a scan only moves further back in time. Before that, each one cost four backed-off
retries on every remaining query, and a Base scan was 23% done after twelve hours with a perfectly steady
span — **so a crawl with a steady span means an unclassified permanent refusal**; add its wording to
`ARCHIVE_LIMIT`. The full-history endpoints are `mainnet.base.org`, `api.avax.network`, `rpc.mevblocker.io`
and the Arbitrum pair.

### Recorded history: what a 24H or 7D figure means

`rollup.ts` (pure) + `history-store.ts` (IndexedDB) + the sealing loop in `live-client.ts`. Full
reasoning in D5; the short version:

- Each completed 15 minutes is sealed **once, per chain**, into its exact accounting and kept in that
  visitor's browser. Per chain because totals summed across chains cannot be taken apart again, and the
  map's chain filter has to stay exact.
- Sealing calls the **same** `aggregateSpan()` a live window uses, over a half-open span, so spans tile
  the timeline exactly once. `verify-rollup.cjs` asserts a 24H window from 96 sealed spans equals a
  direct `aggregate()` over the same transfers. **Do not add a second accounting path.**
- **Coverage is measured.** Feeds append an interval only for a range they actually read, so a failed
  chunk lowers the coverage of the spans it touches. A window's coverage is its least-covered chain.
- **Windows unlock progressively** at `UNLOCK_SHARE` (0.8) — Jake's choice over showing a partial window
  with a badge. Coverage accrues only while the page is open, so a visitor who drops in briefly will
  never unlock 7D; these windows are for a page left running. That constant is the one to tune.
- **No per-transfer detail is stored** — two Attributions per transfer would put a week past 100 MB, and
  a stored citation would freeze evidence the registry may since have corrected. So a long window has no
  transfer list, no counterparty ranking and no evidence cards, and the UI says so in each place.
- **Baselines finally work**, from four preceding windows that each clear the same coverage bar. The
  corridor panel's anomaly UI had never been reachable before.
- A registry change does **not** discard history (the span records what could be attributed at the
  time, and mixing is disclosed); a change to the stored *shape* does, via `SCHEMA` in
  `history-store.ts`.

**Consequence to expect when you next add a chain:** a window's coverage is its least-covered chain, so
a newly added chain has no recorded history and **re-locks 24H and 7D for every visitor** until it has
been watched too. That is honest — the new chain really was not observed for those hours — but it means
a chain addition resets the long windows, and it is the reason to add chains in one wave rather than
one at a time.

Traps worth knowing: `verify-rollup.cjs` guards against passing vacuously — an early version of its
fixture used evidence 194 days old, so every corridor assertion compared two empty lists and passed.
If you edit that fixture, keep `lastVerified` inside the 180-day horizon and keep the guard assertions.

### Not done here

- **Polygonscan labels remain unresearched.** Polygon is parked and has no registry rows. Avalanche
  now has five first-party Snowscan rows (section 13); the remaining 759 derived addresses are still
  useful search leads. `label-scan.mjs` reads Etherscan-family hosts.
- The unfiltered denominator sample is not sealed, so long windows show no sample figure.
- Optimism is measured and ready if another chain is wanted.

## 13. Avalanche first-party labels and country wallet screen (2026-09-28)

Snowscan's own address pages were read for every admitted row. A three-day USDC/USDT activity
screen above the $100k admission floor found **Bitkub 10** (Thailand), a new Avalanche wallet,
at about $363k of incoming plus outgoing token face value. Four active derived addresses also
had first-party tags: VALR (South Africa, about $54.4M), BtcTurk (Türkiye, $12.9M), MaiCoin
(Taiwan, $2.0M), and Bitso (Gibraltar operator, $324k). Their first-party rows can anchor
deposit inference on Avalanche; the derived rows could not. Their activity values are
screening totals, not new mapped settlement or an estimate of country flows.

The broader Snowscan screen found only **1 active of 98** previously unevidenced search
hits after a lightweight title filter. A Basescan screen of **115** comparable hits found **0 active** over
seven days. Search hits alone were never admitted. Seven existing derived Avalanche wallets
with own-page tags were screened; Lemon Cash, Bitpanda and Coinsquare were below the $100k
three-day floor and were left derived. See `docs/measurements/2026-09-28/` for the scans and
the exact activity results. A fresh Etherscan search across 35 country terms found no new
unregistered hit since 2026-09-21. Of 19 old unregistered wallet-like hits re-screened,
Kanga Exchange 1 alone was active (~$22.1M over seven days) but **must stay out**: the
brand-level tag cannot be assigned to one operator now that Kanga has a separate Latvia
EU platform, and Poland's KNF says the companies behind kanga.exchange are not registered
there. See the source links in the measurement report. Free explorer tags on these chains are sparse as a source of new
active wallets; research future chains by measured activity first.

The 2026-09-28 wave is commit `684b4af`. `node scripts/verify-all.mjs`, TypeScript
typecheck and `corepack pnpm build:live` passed; lint remained at its existing 45
errors. `outputs/ledger-atlas-live-2026-09-28.zip` packages `dist-live/` with
`index.html` at the zip root for Jake's FTP deployment. The zip is ignored by Git;
rebuild and repackage it after any later live-build change.
These additions broaden first-party Avalanche coverage across five countries; the
project still has 29 jurisdictions overall. Further country expansion on existing
chains is constrained by sparse active public labels. The next source decisions are
TronGrid for Tron and archive-capable Polygon RPC, both requiring a plan that keeps
credentials out of the static client. Jake signs up for any needed API access himself.

## 14. Cross-agent handoff rule (2026-09-28)

Jake uses both ChatGPT and Claude on this repository. `AGENTS.md` directs coding
agents here; `CLAUDE.md` directs Claude here. After material code, data, evidence,
or deployment changes, update this file in the same commit with the current state,
verification, unresolved work and deliverable path. Keep the short status in
`README.md` synchronized. Do not rely on chat history as the handoff.

## 15. Public-post lead sweep and API options (2026-09-29)

Jake asked for (a) a list of free and paid APIs he could sign up for, and (b) one last sweep of
sites not used before, including public posts about USDT/USDC flows.

**APIs:** `docs/API-OPTIONS-2026-09.md`. Top picks, ranked by coverage per dollar:
1. Tronscan + TronGrid keys (free): Tron.
2. Infura free: un-parks Polygon with archive getLogs.
3. Helius (free, or $49): Solana.
4. Blockscout PRO (free): a tag lead feed.
5. Solscan Pro ($199): Solana own-explorer labels.

Every key needs the phase-2 Worker backend; plan on Workers Paid at $5/month. **Open decision
for Jake:** accept Tronscan's `publicTag` as Tron's own-explorer name tag under rule 1.
Etherscan's nametag API is Pro Plus ($899) and its terms forbid redistribution, so it is not
recommended.

**Leads:** `docs/measurements/2026-09-29/public-post-leads.md`.
- Posts (Whale Alert, Lookonchain, Arkham, news) gave no copyable addresses.
- Search-indexed explorer pages and the `brianleect/etherscan-labels` scrape gave 122 leads for
  registered entities. 96 of them were already first-party rows.
- Of the 26 new candidates, two cleared the floor. Both were read on their own Snowscan pages:
  - **Binance 49**: new, $73.7M over three days.
  - **Bitfinex: Hot Wallet**: derived → first-party, $21.4M.
- Excluded brands (Bybit, Bitstamp, Luno, WazirX, Revolut, offshore exchanges, swap services)
  were dropped unscreened.

A direct scrape of Etherscan's USDT top-holders page was blocked by the agent's safety classifier
and was not pursued. The Dune spellbook `cex_evms_addresses.sql` remains an unread lead
compilation.

**Verification:** `verify-all.mjs` passed with one expected warning (Binance 49 is unmeasured
until the next dormancy scan). `tsc --noEmit` is clean and `pnpm build:live` passed. The UI was
not changed, so no browser check was run. Deliverable: `outputs/ledger-atlas-live-2026-09-29.zip`
(ignored by Git).

**Next:** run `measure-dormancy.mjs` at the next monthly refresh (due by 2026-11-12), then wait
for Jake's API keys and his Tronscan decision.
