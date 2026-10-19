# Blockchain Flow Map — handoff notes for the next agent

Last updated 2026-10-18: **the tree was pruned for a public GitHub repository: the deferred backend scaffold, 44 unused
UI files and 26 unused packages left, `verify-all` now type-checks the whole project, and lint is re-based at 34 errors**
(section 29). On 2026-10-12 **24H and 7D could never unlock on all chains, because each poll recorded one block's time too
little (Ethereum logged about 40% of the time watched); fixed. A tab left open also recovers now after the computer sleeps,
the browser freezes it or the network drops, instead of crawling through the gap with an empty map, and transfers left
unpriced by a price gap are re-priced** (section 28). On 2026-10-09 (later) **Jake approved payment firms on the map and three held brands were admitted: Urban
Crypto Exchange (Brazil), Well Wallet (Costa Rica, a new map country) and DTCPay (Singapore, the first `payment` entity);
Swapster, Wallib and Cropty are recorded as left out** (section 27). Earlier that day **the map stopped blanking for a frame on resize or render-scale changes, and the 20 s update burst was coalesced** (section 26). On 2026-10-08 **Tronscan's other free lists were harvested for leads** (section 25). One more Ourbit wallet
was admitted (23 Tron wallets). No new country is reachable without a decision from Jake, and the free Tronscan API is
close to exhausted for this project. On 2026-10-07 **the Tron open items were researched** (section 24). India and LatAm have no admissible
Tron wallet; of the unregistered tagged brands only Ourbit passed D3 and was added (22 Tron wallets now). Before that,
2026-10-06/07: **Tron is live.** A keyless feed carries 21 Tronscan-tagged wallets (Binance, OKX, Kraken,
Bitfinex, KuCoin, Bitget, MEXC, Coinone, Bithumb and Coins.ph) at about 1.2 MB per visitor-hour (section 23). Earlier the
same day Jake supplied the free Tronscan API key and `read-tag.mjs` learned to read Tron tags (section 22). Before that,
2026-10-02 brought **a second page, Landmarks (`landmarks.html`): sixteen landmark transactions, each
read from its own chain, with analysis, under the new naming decision D7** (section 19). On 2026-10-01 **the build
began publishing `llms.txt` and `methodology.md` beside the page, and a plain-text summary inside it for readers that
run no JavaScript** (section 18); earlier that day came **Polygon and Optimism going live on keyless endpoints, a
42-row wallet wave from the Dune lead feed, and the finding that Tron's feed needs no key** (section 17). Before that
came the
USDT top-holders wave, Tronscan decision D6 and API plan (section 16), and the **Avalanche Snowscan registry wave** (section 13, commit `684b4af`). Earlier work includes the renderer performance and look pass
(section 11), Avalanche going live with Polygon measured then parked and longer time
frames (section 12), and the unplaced-flow / Unmapped work (section 10). Read this before touching anything under
`lib/atlas/`, `scripts/registry/` or `docs/`. It explains the direction the project has
been taking, the rules that must not be broken, and the workflows that keep the build
honest. The longer explanations live in `docs/METHODOLOGY.md` and `live-lite/README.md`.
The approved plan behind the September phases is in `docs/PLAN-2026-09.md`; decisions D1 to D3
were all answered on 2026-09-21 and are recorded in `docs/DECISIONS-2026-09.md` (read its
reopen conditions before researching any of them again).

## 1. What this project is and how it ships

Blockchain Flow Map (formerly Ledger Atlas) is a stablecoin cross-border settlement map (React + Three.js globe with an
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
- GitHub hosting of the code is in progress (section 29). The Next.js/Cloudflare Workers/D1 scaffold that was
  the deferred "phase 2 backend" (`app/`, `db/`, `drizzle/`, `lib/atlas/store.ts`, `production.ts`,
  `connectors.ts`) left the tree on 2026-10-18: it is at git tag `backend-deferred-2026-10` and its design note is
  `docs/archive/OPERATIONS-2026-09-backend-design.md`. Any future proxy (`docs/API-PLAN.md`) is written fresh as a
  Worker; nothing in the live build ever depended on the scaffold.

Commits are made with `git -c user.email="223131039+jakeperc@users.noreply.github.com" -c user.name="Jake Percy"`.

## 2. The integrity rules (non-negotiable)

The whole point of the live mode is that every attribution on the map is backed by
public evidence. The map deliberately shows only a small fraction of onchain volume
(around 12% of what it observes) because most transfers cannot be evidenced. That
number is a feature, not a bug to be "improved" by loosening rules.

1. **Never guess an address-to-entity mapping.** An address enters the registry only when
   its own explorer page (Etherscan, Basescan, Arbiscan, Snowscan, Polygonscan, Optimistic Etherscan, and Tronscan's
   `publicTag` under decision D6) shows a public name tag for it.
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
live-lite/llms.txt.tpl              the hand-written prose of the published llms.txt (section 18)
scripts/llms/render.mjs             llms.txt, methodology.md, head tags and <noscript>; run by vite.live.config.ts and verify-llms.mjs
```

Registry keys are `${chain}:${address}` (lowercase on EVM, base58 on Tron). Keep that shape: the generator, the
verifiers, the rollup registry version and the llms stamp all key on it.

Current registry (2026-10-01): **1,189 first-party rows** (Ethereum 822, Base 262, Arbitrum 63, Avalanche 16,
Polygon 20, Optimism 6) across 64 entities and 29 jurisdictions, plus **3,567 derived** (Base 560, Arbitrum 728,
Avalanche 763, Polygon 754, Optimism 762). Polygon and Optimism went live on 2026-10-01 (section 17).
Live filter (`WATCHED`) is re-measured per chain by the dormancy scan; on 2026-10-01 it was Ethereum 166 of 822, Base 59 of 822, Arbitrum 52 of 791, Avalanche 34 of 779, Polygon 38 of 774, Optimism 15 of 768.
The caps it must stay under are Ethereum 1,000, Arbitrum 997, Base 4,800, Avalanche 4,800, Polygon 1,000 and
Optimism 1,000. The remaining
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
- A separate small **unfiltered sample** is fetched every 15 minutes (`SAMPLE_MS` in `live-client.ts`; this line said ~10
  until 2026-10-01) for the honest denominator (`Snapshot.sample`).
- **Per-chain config** in `FEEDS` (`lib/atlas/feeds.ts`, pure, imported by `live-client.ts`,
  the registry verifier and the diagnostic scripts): chain id, slot time, blocks per hour,
  chunk size, pause, and each endpoint's measured caps. Ethereum 50-block chunks, Base 1500,
  Arbitrum 1200 with a 350 ms pause, Avalanche 1500, Polygon 1200, Optimism 1500. Change them only after re-measuring.
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
  | Polygon | polygon.gateway.tenderly.co | yes | 1,000 (1,024 "not supported") | ~67 KB | 5,000 (**200,000** for the dormancy scan, 90 days back) | `*` |
  | Polygon | polygon-bor-rpc.publicnode.com | yes | 1,000 (1,024 "exceed max topics") | ~67 KB | 5,000; prunes past ~37 hours | `*` |
  | Polygon | rpc.sentio.xyz/matic | yes | 4,800+ | ~323 KB+ | 5,000 (10,000 for the scan, 90 days back) | echoes origin |
  | Polygon | polygon.drpc.org | no (demoted 2026-10-01) | 1,000 | ~67 KB | 100 | `*` |
  | Polygon | polygon-rpc.com | – | **key-gated**: HTTP 401 "API key disabled, tenant disabled" | – | – | `*` |
  | Avalanche | api.avax.network/ext/bc/C/rpc | yes | 4,800+ | ~323 KB+ | 5,000 (**500,000** accepted for the dormancy scan) | echoes origin |
  | Avalanche | avalanche-c-chain-rpc.publicnode.com | yes | 4,800+ | ~323 KB+ | 5,000 (50,000 for the scan) | `*` |
  | Avalanche | avalanche.drpc.org | no (demoted 2026-09-25) | 2,400; 4,800 timed out 1/3 ("upgrade to paid plan") | ~162 KB | 100 | `*` |
  | Celo | forno.celo.org | measured, not shipped | 1,024 (1,200 failed 2/3) | ~69 KB | 5,000 | `*` |
  | Celo | celo.drpc.org | unusable | "invalid hex string" to the filtered shape | – | none | `*` |
  | Optimism | optimism.gateway.tenderly.co | yes | 4,800+ | ~323 KB+ | 5,000 (**1,000,000** for the dormancy scan) | `*` |
  | Optimism | optimism-rpc.publicnode.com | yes | 4,800+ | ~323 KB+ | 5,000; refuses archive depth without a token | `*` |
  | Optimism | mainnet.optimism.io | yes | 1,000 (1,024 passed 2/3) | ~67 KB | 5,000 (10,000 for the scan) | `*` |
  | Optimism | optimism.drpc.org | no | refuses filtered ranges on the free plan | – | 100 | `*` |
  | Tron | api.trongrid.io/jsonrpc | measured, not shipped | 1,000 | ~67 KB | 1,200 in 3.5 s; refuses replies over 10,000 logs; 90 days back answers | `*` |
  | Tron | tron-evm-rpc.publicnode.com | measured, not shipped | 1,000 ("exceed max topics: 1000") | ~67 KB | 1,200 in 17 s | `*` |

  Polygon and Avalanche were first measured 2026-09-25, and Polygon and Optimism were re-measured on 2026-10-01
  when they went live (section 17). Celo was measured and rejected on activity (section 12). Polygon's chunk
  was 100 while drpc had to serve the filtered feed; with Tenderly, publicnode and Sentio serving it, the chunk
  is 1,200 and drpc keeps only the small calls. The Tron rows are a measurement only: Tron is not built.

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
- **After a pause** (the computer slept, the browser froze the tab, the network dropped) a feed more than its backfilled
  hour behind re-reads the latest hour instead of crawling through blocks the buffer would prune, and any transfer left
  unpriced makes the next price tick fetch the series again (`nextPollRange`, `refreshPriceGaps`; section 28).
- **Observed time** for recorded history comes from `readInterval()`: consecutive reads tile, a read after a gap claims
  none of it. Do not go back to `time(to) - time(from)` per read; on Ethereum that recorded 40% of the time watched.
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
- `node scripts/screen-candidate-chain.mjs <Chain> <days>`: the gate for a chain the build does not read
  yet. It needs no entry in `model.ts` or `rpc-pool.mjs`, so a candidate is measured before anything is wired.
- `node scripts/registry/label-scan.mjs [--host basescan.org|arbiscan.io|snowscan.xyz|polygonscan.com|optimistic.etherscan.io] [--expand] <term>...`:
  enumerates explorer tags; `--expand` walks numbered families past the 15-row cap. Terms
  for re-scanning the unlabelled and excluded lists are in `label-scan-terms.txt`.
- `node scripts/registry/screen-activity.mjs <Chain> <days> <candidates.txt>`: RPC activity
  screen for candidates before spending explorer requests or filter slots on them.
- `node scripts/registry/read-tag.mjs <etherscan.io|basescan.org|arbiscan.io|snowscan.xyz|polygonscan.com|optimistic.etherscan.io|tronscan.org> <addr>...`:
  the admissible read. Optimistic Etherscan, like Arbiscan, answers 403 on address pages, so its `/txs?a=`
  page header is read instead. It prints the tag verbatim and any "tagged based on ... compilation"
  disclosure, which goes into the row's note. **The header page carries no banner, so on Arbiscan and Optimistic
  Etherscan a missing disclosure proves nothing** (section 20).
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

- To save the 35 to 40 minutes Base takes, run it beside the rest and merge the parts (same day, same window):
  `--chains Base --out base.json`, `--chains Ethereum,Arbitrum,Avalanche,Polygon,Optimism --out rest.json`,
  then `--merge base.json,rest.json`.
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
node scripts/verify-all.mjs        # ends with tsc --noEmit over the whole project since 2026-10-18 (pnpm typecheck runs that alone)
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
- `verify-llms.mjs`: renders `llms.txt`, `methodology.md` and the page's head tags and `<noscript>` block over the same
  compiled modules and fails if a sentence the template quotes left the page, a UI term it names was renamed, a number was
  typed into the prose, the live page started reading the URL, or the methodology, the meta description and the code
  disagree about the chains, the unlock share or the evidence horizon. It tests its own checks too. Section 18.

### Checking the built site

`.claude/launch.json` has a `dist-check` entry: `node scripts/serve-dist.cjs dist-live`
serves the build on port 5180 under a nested path (`/ledger-atlas-live/`) to mimic the
FTP folder. Look for: no 404s (including the `world-110m.json` preload), reaches LIVE,
corridors appear on All chains, Ethereum, Base, Arbitrum, Avalanche, Polygon, Optimism and Tron, only
Solana says Not connected, Tron addresses show in base58 with bare-hash Tronscan links, no blank map on any option, and the layout holds at 375x812.
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

**Re-based 2026-10-18: 34 errors and 6 warnings under the typescript-eslint and react-hooks presets (section 29).** Before
that, `pnpm lint` had **45 pre-existing errors** (recounted 2026-09-25 after the renderer rewrite;
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
- `dist-live/llms.txt` and `dist-live/methodology.md` are generated by the build, so `public/` must not hold a copy (the
  build fails if one appears). The meta description in `live-lite/index.html` names the chains by hand on purpose, and the
  build fails if it stops matching what `FEEDS` reads (section 18).

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
- **Resolved 2026-10-01 (section 17):** Polygon is live with no key. Tenderly's public gateway serves the
  90-day archive, so the "free endpoints cannot support its dormancy scan" limit below is gone. Optimism is
  live too. Linea, Unichain, World Chain, Sonic, ZKsync Era, Ink, Plasma, Kaia, Cronos, Morph and Kava were
  screened and rejected on activity. **Tron's feed needs no key either**: TronGrid's JSON-RPC serves the
  filtered request shape with CORS. What Tron still needs from Jake is one free Tronscan API key for reading
  tags offline, plus a decision on bandwidth.
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
   - ~~**Tron**~~ **Done 2026-10-06/07 (section 23):** live with 21 Tronscan-tagged wallets. India and LatAm are
     still not reached: no tagged Tron wallet exists for CoinDCX, Bitso, Lemon Cash or Mercado Bitcoin. Next on Tron,
     D3 research for the 19 unregistered tagged brands (Bybit, Gate and others) in `docs/measurements/2026-10-06/`.
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
6. **Done 2026-10-06/07 — Tron live** (section 23). Follow-ups: D3 operator research for the unregistered tagged brands
   (Bybit first), and re-run the Tronscan lead sweep monthly with the dormancy run. The brands held for Jake in sections
   24 and 25 were resolved on 2026-10-09 (section 27); CEEX and WestWallet remain unclear and unresearched.
6b. **Holder CSV exports from Jake** (USDC on Etherscan; USDC and USDT on Polygonscan, Snowscan, Optimistic Etherscan):
   process them like the 2026-09-29 USDT wave (section 16) when they arrive. Thin first-party coverage is why Polygon,
   Optimism and Avalanche show few routes.
6c. **`measure-corridors.mjs` knows only Ethereum, Base and Arbitrum** (section 27); teach it the `FEEDS` chains.
7. Solana needs a keyed indexer: a free Helius key plus a Cloudflare Worker on the free tier (`docs/API-PLAN.md`), and a
   decision on whether Solscan tags are admissible. Jake has been reminded (2026-10-09).
8. Phase-2 backend: the Next.js/D1 scaffold left the tree on 2026-10-18 (tag `backend-deferred-2026-10`, section 29).
   If a proxy is ever needed for Solana it is written fresh as the cron Worker in `docs/API-PLAN.md`; the registry
   loader is trivial because keys are `chain:address`.
9. Pre-existing lint failures.
10. **Upload, then flip the hub flag (Jake).** `dist-live/` now carries `llms.txt` and `methodology.md` (section 18). Once
   they are on the host, `JakePercy.com/content/llms/sites.json` can set `llms: true` for `global-blockchain-flow`
   (that flag means "uploaded"; nothing in this repo sets it) and `node scripts/check-llms.mjs --live` there confirms the
   host serves both. The host has not been tested for `.md`: if it sends no content type, flip `METHOD_EXT` in
   `scripts/llms/render.mjs` to `.txt`.
11. **Headline label on 24H, 7D and early in a session** (section 18, "Found while doing it"): the first figure reads
   "Observed onchain / All qualifying transfers" although the build reads only transfers touching an evidenced wallet.

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

**Superseded 2026-10-01: Polygon is live (section 17).** The history below explains why it waited.
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

Since 2026-10-01 a new chain also needs two hand edits that the build checks (section 18): the chain list in
`docs/METHODOLOGY.md` ("another EVM chain the build reads (...)", published as `methodology.md`) and the meta
description in `live-lite/index.html`. `llms.txt` itself picks the chain up from `FEEDS`, `CONTRACTS` and the registry.

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

- ~~Polygonscan labels remain unresearched.~~ Done 2026-10-01 (section 17): 20 first-party Polygon rows and
  6 Optimism rows. `label-scan.mjs` reads Etherscan-family hosts.
- The unfiltered denominator sample is not sealed, so long windows show no sample figure.
- ~~Optimism is measured and ready if another chain is wanted.~~ Live since 2026-10-01 (section 17).

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

## 16. USDT top-holders wave, D6 and the API plan (2026-09-29, later)

- **Budget and hosting are recorded in `docs/API-PLAN.md`. Read it before any API work.**
  - Jake cannot afford $49 or $199/month plans. He can afford Alchemy pay-as-you-go and Cloudflare $5.
  - Polygon needs a key only for the offline dormancy scan, so Infura free un-parks it with no server.
    Run it locally or in GitHub Actions.
  - Tron and Solana need a cached, rate-limited Cloudflare Worker proxy or cron. The free tier is
    probably enough.
  - GitHub Pages can host the site but cannot hold keys.
- **D6 (Jake, 2026-09-29):** Tronscan's own public name tags are admissible for Tron, like Etherscan
  tags. See `docs/DECISIONS-2026-09.md`. Operator documents and the rule-3 exclusions still apply.
- **Registry +6 Ethereum rows** from Jake's Etherscan USDT top-1000 holders export:
  - OKX: Cold Wallet 2 ($267M over 7 days)
  - MEXC 22 ($100M)
  - Upbit 58 ($43M)
  - KuCoin 66 ($25M)
  - KuCoin 54 ($12M)
  - Bitget 23 ($2.6M)

  Of 169 tags, 50 were already registered and 107 were plumbing or excluded brands. Report:
  `docs/measurements/2026-09-29/usdt-top-holders.md`. **This export beat the search sweeps**
  (6 wallets against 2), so ask Jake for the USDC and L2/Avalanche holder exports next time. Agents
  cannot fetch these pages themselves: a direct scrape was blocked by the agent safety classifier.
- **Verification:** `verify-all.mjs` passed. The only warnings are the expected "unmeasured" ones for
  rows added since the 2026-09-28 dormancy scan; re-run `measure-dormancy.mjs` to clear them.
  `tsc --noEmit` is clean and `pnpm build:live` passed. Registry-only change, so no browser check.
  Deliverable: `outputs/ledger-atlas-live-2026-09-29.zip`, rebuilt after this wave.

## 17. Polygon and Optimism live, a 42-row wallet wave, and keyless Tron (2026-10-01)

Jake asked for more API sources and more wallets. Report with every table:
`docs/measurements/2026-10-01/new-sources.md`.

- **Polygon is un-parked with no key.** `polygon.gateway.tenderly.co` serves 90 days of history in
  200,000-block spans and returned the same logs as `polygon.drpc.org` at four depths. `rpc.sentio.xyz/matic`
  does too, at 10,000 blocks. The dormancy scan took 64 queries. The Infura step in
  `docs/API-PLAN.md` is no longer needed.
- **Optimism is live**, added in the same wave so 24H and 7D re-lock once (section 12). Its scan took
  22 queries on Tenderly.
- **Twelve candidate chains were screened** with the new `scripts/screen-candidate-chain.mjs`. Polygon had 23
  active evidenced wallets and $66.4M in three days; Optimism 12 and $27.6M. Sonic, Morph, Kaia and World Chain
  had one to three wallets. Linea, Unichain, ZKsync Era, Ink, Plasma, Cronos and Kava had none. Do not re-screen
  the rejected ones without a reason.
- **Registry +42 rows**, every tag read on the address's own explorer page today:
  - 22 from the Dune spellbook lead feed (4,957 leads, 1,538 unregistered candidates for registered brands,
    screened on all six chains). Largest: OKX 179 on Avalanche ($59.9M in 3 days), Coinbase 7 on Polygon
    ($45.3M), OKX 234 on Base ($43.5M in 7 days), five Binance wallets on Avalanche ($10M to $16M each).
  - 14 Polygon and 6 Optimism first-party rows for active wallets that would otherwise be derived.
  - Rejected and recorded in the report: "HashKey 2" ($231M, brand-level tag), "KuCoin: ERC-20 Batch Transfer"
    ($80.6M, distribution contract), Bitfinex Tether Treasury, and Arbiscan's truncated "Coins.p" tag.
- **Tron's feed needs no key and no Worker.** `api.trongrid.io/jsonrpc` answers the filtered `eth_getLogs`
  shape with CORS `*`, 1,000 addresses per topic position, one hour in 3.5 s, and 90 days back. 17 Dune lead
  wallets for registered brands moved $3.70B of USDT in one day. Not built. It needs a free Tronscan API key
  from Jake (tags, offline only; tronscan.org pages sit behind a bot challenge), a bandwidth decision, and
  model work. `docs/API-PLAN.md` is updated.
- `read-tag.mjs` reads Optimistic Etherscan through the `/txs?a=` header, as it does Arbiscan.
- **Dormancy re-measured 2026-10-01** on all six chains: Ethereum 166 of 822, Base 59 of 822, Arbitrum 52 of 791, Avalanche 34 of 779, Polygon 38 of 774, Optimism 15 of 768. Next due by 2026-11-15.
- **`measure-dormancy.mjs` hardening.** It writes nothing until every chain has finished, and a null block header
  from Tenderly's Optimism gateway (it has no pre-Bedrock blocks) crashed the first run after 45 minutes. A null
  header now falls through to the next endpoint. `--chains X --out part.json` followed by
  `--merge a.json,b.json` lets Base run beside the other chains; `--merge` refuses parts from different days
  or windows and refuses to leave a live chain out.
- **Base's scan is the slow one**: about 35 minutes on `mainnet.base.org` at 2,000 blocks.
  `base.gateway.tenderly.co` answers "invalid params" to the filtered shape, so it does not help.

**Verification:** `node scripts/verify-all.mjs` passed with no warnings. `tsc --noEmit` is clean, `pnpm build:live` passed and lint is still at 45 errors. The built site was served from the nested `dist-check` path: no local 404s, LIVE on all six chains, Tron and Solana Not connected, 46 corridors on All chains, and no horizontal overflow at 375x812. In the first hour Polygon showed $2.04M and Optimism $272k of evidenced activity but one small corridor each: most of their flow is one-sided until deposit inference finds anchors, so expect unplaced flow there before routes.

**Deliverable:** `outputs/ledger-atlas-live-2026-10-01.zip` (ignored by Git).

**Next:** ask Jake for a free Tronscan API key and his bandwidth decision for Tron. Holder CSV exports
(USDC on Ethereum, and the Polygon, Base and Avalanche holder pages) are still the best wallet source he
can supply. Re-run the Dune lead screen monthly with the family walk.

## 18. llms.txt, methodology.md and the page's plain-text surfaces (2026-10-01)

The page draws everything with JavaScript, so a reader that runs none (most AI fetchers) saw an empty `<div id="root">`.
The build now publishes a plain-text description beside the page and points to it. The standard these files are built to
is `JakePercy.com/content/llms/AUTHORING.md`; the hub's summary sheet is `JakePercy.com/content/llms/sites.json`
(slug `global-blockchain-flow`, output `../live-blockchain-flows/dist-live`).

**What the build writes into `dist-live/`**
- `llms.txt`: about 9.5 KB, cap 10 KB (a new chain adds roughly 40 bytes; if a wave would pass the cap the build says so, and
  the fix is shorter prose, not a higher cap), ASCII only. The prose is `live-lite/llms.txt.tpl`. Everything that moves is stamped
  into one block, "Current state (data as of <date>; treat as stale after 45 days)": the live chains and the assets read on
  each (`FEEDS` x `CONTRACTS`), the registry counts, the earliest evidence expiry (`registryHealth()`), the dormancy window,
  the window tabs, and the polling, price, sample and unlock thresholds, which are read as text from `live-client.ts`
  (`POLL_MS`, `PRICE_MS`, `SAMPLE_MS`, `UNLOCK_SHARE`; they are not exported). The date is the data's own (newest evidence
  read or dormancy measurement), never the build date. If the facts cannot be read the block is dropped with a warning and
  the rest is still written.
- `methodology.md`: `docs/METHODOLOGY.md` as written, plus a byline, blank lines between paragraphs and an ASCII fold, with
  its one internal reference ("(decision D4, 2026-09-25)") turned into "(decided 2026-09-25)". The original doc is not
  changed. Any other internal reference (a decision id, HANDOFF, a file path) fails the build.
- `index.html` gains `rel=canonical`, `rel=alternate type=text/markdown href=llms.txt`, `og:type`, `og:title`,
  `og:description`, `og:url` and a `<noscript>` block (the summary, the page's own drawing rule, the caveat, links to both
  files), all built from the same constants as `llms.txt`. Nothing else in the page or the app bundle changed (the built
  `assets/` files are byte-identical to the build before).

**Where it hooks in**
- `vite.live.config.ts`: the `llms()` plugin, build only. `buildStart` renders, `transformIndexHtml` (post) injects the tags
  and the block, `generateBundle` emits the two files, `closeBundle` checks them on disk (`verifyBuilt`).
- `scripts/verify-all.mjs`: `verify-llms.mjs` is in `CHECKS`, over the modules it already compiled.
- All of the logic is in `scripts/llms/render.mjs`. `node scripts/llms/render.mjs` prints `llms.txt` (it compiles the atlas
  modules itself); `--methodology`, `--surfaces`, `--trace` (every quoted sentence with the file and line it was found at)
  and `--dist` (check an existing `dist-live/`) do the rest. `scripts/serve-dist.cjs` now serves `.txt` and `.md` too, with
  no charset, as the host does.

**Rules that fail the build.** This build only runs interactively, so they fail it; `STRICT` in `render.mjs` turns them into
warnings that drop the files if it is ever automated (an unattended build must not fail because of llms.txt).
1. Every sentence of 12 or more characters that the template puts in double quotes must still be in the page's source
   (`components/atlas.tsx`, `lib/atlas/live-client.ts`, `docs/METHODOLOGY.md`, `live-lite/index.html`), ASCII-folded and
   whitespace-collapsed. Reword a page sentence the template quotes and the build names the sentence.
2. The UI terms, provider names and health states the prose names without quoting (`TERMS` in `render.mjs`) must still
   exist, and every external link in the template must still be one that `atlas.tsx` links. `TERMS` also pins the code facts
   the prose describes: both Transfer topic positions are filtered; both ends of a returned transfer go through the
   whole-registry lookup; the headline totals read only the filtered buffer; the unfiltered sample is attached only to the
   live windows; a first-party row is dated by the earlier of its explorer read and its entity review; derived evidence has
   one fixed score; and the 180 days are judged at each transfer's own time, at both ends.
3. No number is typed into the prose (`handTypedNumbers`): stamp it in `collectFacts()` or quote the page. The four window
   labels and `110m` are allowed.
4. Nothing in the live page may read the URL except the two debug flags (`urlStateProblems`). The prose says views have no
   addresses, so **adding hash routing (backlog 3b) means updating the template and that guard together.**
5. `docs/METHODOLOGY.md` must agree with the code on the other chains read ("another EVM chain the build reads (...)"), on
   the unlock share (80%) and on the evidence horizon (180 days), and the meta description in `live-lite/index.html` must name
   exactly the chains `FEEDS` reads.
6. The file meets the hub contract (`JakePercy.com/scripts/check-llms.mjs`): ASCII, size, shape, links, the hub and dashboard
   links present, and an opening blockquote equal to `SUMMARY CAVEAT` in `render.mjs`. **Those two constants are copies of
   the hub sheet row; change them only together with `sites.json`.**
7. No `public/llms.txt` or `public/methodology.md`: a static copy would be a second source of truth.

**When you change the page.** A label, band, threshold or formula that the template quotes or names: update
`live-lite/llms.txt.tpl` (and `docs/METHODOLOGY.md` if the method changed), run `node scripts/verify-all.mjs`, and read the
whole generated `llms.txt`, because a garbled or over-strong sentence passes every check. **Adding a chain:** also update the
chain list in `docs/METHODOLOGY.md` and the meta description in `live-lite/index.html`; both are checked. The companion
extension is the `METHOD_EXT` constant (`.md`).

**Gotcha.** `render.mjs` is plain ASCII on purpose: its fold table builds characters from code points with
`String.fromCodePoint`. The editing tools used on this repo can decode a backslash-u escape into the raw character,
including invisible ones (zero-width space, no-break space), which is how an invisible character ended up inside a regex
here once. Never write a Unicode escape in that file. `grep -c -P '[^\x00-\x7F]' scripts/llms/render.mjs` must print 0.

**Verification (2026-10-01).** `node scripts/verify-all.mjs` and `corepack pnpm build:live` passed, `tsc --noEmit` is clean and
`pnpm lint` is still at 45 errors (the files added are lint-clean). The hub's `node scripts/check-llms.mjs`, run from
JakePercy.com, reported 0 failures and 0 warnings. The page was loaded from the nested `dist-check` path (LIVE, headline
figures, globe) and the `<noscript>` block was viewed with scripts disabled (a sandboxed iframe), at desktop width and at
375 px with no horizontal overflow. About thirty deliberate edits to a scratch copy of the sources (a reworded quote, a
renamed term, a new hash reader, a stale chain list, a retuned unlock share, a second internal reference, a hand-typed
number, a static `public/llms.txt`, a changed derived-evidence score, a sample attached to long windows, ...) each failed the
render with a message that names the file.

**Cold-read follow-up (2026-10-01, later).** A fresh agent given only `llms.txt` got the traps right but hesitated on four
things, now fixed: (1) it took "Observed onchain" for whole-chain volume, so the file now says the figure is not, and says what
the unfiltered sample is for and where it appears; (2) it could not see how an address the filter does not ask about can
attribute a transfer, so the Data paragraph and the stamped block now explain that a transfer comes back when either end is on
the list and both ends are then looked up in the whole registry; (3) the evidence terms were unconnected, so there is a new
"Evidence" paragraph (three kinds, one bar, which can draw a route, who can anchor an inference, what "weaker as a receiver"
means, and that the 180 days run from the "Last verified" date at each transfer's own time); (4) two ambiguous phrases were
reworded ("the page was formerly named Ledger Atlas"; "no URL routes"). The file grew to about 9.5 KB.

**Deliverable:** `outputs/ledger-atlas-live-2026-10-01.zip`, rebuilt to include `llms.txt` and `methodology.md` (ignored by Git).

**Found while doing it (reported, not fixed)**
- The first headline figure reads "Observed onchain / All qualifying transfers" on 24H, on 7D and until the first unfiltered
  sample arrives, although this build reads only transfers that touch an evidenced wallet. "Observed on evidenced wallets"
  appears only when a sample exists, and the sample is deliberately not attached to long windows (`build()` in
  `live-client.ts`: `if(sampleRecs.length&&!long)`; the label is `sampled` in `atlas.tsx`). `llms.txt` describes it as it is;
  if the label is fixed, the build will name the quotes in the "Do not conclude" paragraph that moved.
- "Sampled chain time" in the Data & coverage panel is cumulative for the session (`sampledMs` in `createFeed`, never reset),
  but the sample's totals come from `aggregate(sampleRecs,'1H',at)` (`live-client.ts:553`) over records stamped with the time
  they were read, so after the tab has been open for more than an hour the seconds shown cover more chain time than the
  transfers beside them. The evidenced-share ratio is unaffected. Read from the code, not reproduced in a long session.
  `llms.txt` quotes only "never scaled up to the window" from the page's sentence, not its "exact accounting" wording.
- The homepage card in JakePercy.com says "3 chains"; the page reads six. The meta description in `live-lite/index.html` is
  also hand-typed (now checked); the card is not.
- `docs/OPERATIONS.md` still says the hosted application opens in DEMO DATA, which section 2 says was removed on 2026-09-21,
  and `live-lite/README.md` quotes the 2026-09-21 registry figures. Neither is read by the build.
- `public/` ships `file.svg`, `globe.svg` and `window.svg`, Next.js starter files the page does not use.

## 19. Landmarks: a second page of landmark transactions (2026-10-02)

Jake asked for a page about the most significant transactions ever and of the last few months, with analysis, as
beautiful as the map. It is `landmarks.html`, beside `index.html`. The approved plan, with its 30-point red-team
review, is in the session plan file (`lets-plan-to-add-proud-graham.md`); this section is the durable record.

**What Jake decided (2026-10-02).** All of crypto; a curated recent list plus our own measured tables; names only
under the new decision D7 (`docs/DECISIONS-2026-09.md`: an explorer tag crediting no outside source, a primary
document that prints the address or transaction, or a document's description matched to exactly one transaction by
a complete read); a person only on their own statement or a court record of conviction or plea; a "Constellation"
hero (a glowing value-over-time field linked to the stories).

**How the page works**
- Static first. The build renders the hero, the field as SVG, every story, the measured tables, the charts and the
  method as HTML (`scripts/landmarks/html.mjs`, `charts.mjs`), injected into `live-lite/landmarks.html` by the
  `landmarksPage()` plugin in `vite.live.config.ts`. Readers without JavaScript and AI fetchers get everything.
- The island (`components/landmarks/`) adds the canvas glow, THEN to TODAY (live prices: CoinGecko, then Coinbase,
  then Kraken; TODAY is locked with a reason until they load), filters, sort, scroll-linking and the keyboard path. It
  never builds or reads a URL: a story's address is its own `#id`, and the island only asks which story is `:target`.
- It loads no three.js, no engine chunk and no registry (`verify-live-build.cjs` walks its module graph).

**The data pipeline** (`scripts/landmarks/README.md` has the monthly runbook and the entry schema)
- `entries/<id>.md`: a JSON block of facts, then four prose sections. Every on-chain number is a placeholder.
- `fetch-facts.mjs` (network, cached) writes `chain-facts.json`: every transaction from every operator that serves it
  (two for Bitcoin, three for Ethereum), finality, traces and balance reads, the traded candle containing the block,
  supply at the block, match proofs (complete reads), and each source's archived copy searched for its txids,
  addresses and quote.
- `build.mjs` (pure) checks everything; `gen-landmarks.mjs` writes `lib/landmarks/data.ts` (GENERATED); the gate is
  `scripts/verify-landmarks.mjs`, run by `verify-all.mjs`, with self-tests that mutate copies of the real facts.
- `measure-largest.mjs` writes `measured.json`: Ethereum only, the fixed window 2026-07-03 to 2026-10-01.

**Entries (v1): twelve all-time, four recent**

| Entry | Chain | What identifies the transaction | Who is named, and on what |
|---|---|---|---|
| `genesis-2009` | Bitcoin | Match: block 0's coinbase | Nobody (new coins); TODAY not applicable (unspendable) |
| `block170-2009` | Bitcoin | Match: first non-coinbase transaction, blocks 0 to 170 | Hal Finney, receiver (matched tier, his own post) |
| `pizza-2010` | Bitcoin | Reporting prints the txid; a complete read found two 10,000 BTC payments that day | Nobody |
| `half-million-2011` | Bitcoin | Reporting prints the txid (two outputs, 550,000 BTC) | Nobody |
| `first-eth-2015` | Ethereum | Match: every header from genesis; the gas limit first reached 21,000 at block 46,145, and 46,147 holds the first transaction | Nobody |
| `dao-2016` | Ethereum | A technical source prints the txid; balance reads show the drain and the fork | Both sides by clean Etherscan tags |
| `bitfinex-refill-2020` | Bitcoin | Bitfinex's CTO's reply (txid in the archived thread) | Bitfinex and its hot wallet (party statement) |
| `silk-road-2020` | Bitcoin | Set: every spend from the complaint's address on 3 Nov 2020 (two) | The sending address (court filing); receiver unnamed |
| `fee-2021` | Ethereum | DeversiFi's post-mortem prints the txid | Sender by tag (Bitfinex 2); DeversiFi from its own post |
| `poly-2021` | Ethereum | Reporting prints the txids (ETH, USDC, USDT legs) | Receiver from Poly Network's own notice |
| `ronin-2022` | Ethereum | Ronin's post prints both txids | Bridge by tag; receiver from OFAC's list |
| `bybit-2025` | Ethereum | Reporting prints the txid; trace checked against the balance delta | Nobody; the FBI's attribution quoted |
| `tether-redeem-2026` | Ethereum | Set: every USDT Redeem event in the window (four) | Tether: Multisig by tag |
| `dormant-2026` | Bitcoin | Match: the address's only spend ever (reporting links the address) | Nobody |
| `liquid-2026` | Bitcoin | Blockstream's report prints all three txids | Liquid Federation and SideSwap (the report) |
| `bitget-2026` | Ethereum | Reporting prints the txids | Sender by tag (Bitget 6); receiver from Bitget's update |

Considered, not listed (on the page, with reasons, from `config.json`): the 3 Aug 2026 16,400 BTC move (coins only
months old), OFAC's July 2026 Iran listing (addresses, no txids), the SDNY Iran forfeiture (bot-checked page), the
Coldcard theft (no addresses), Mt. Gox, the Bitfinex theft and 2022 seizure (no primary document prints any of the
many transactions), the Prince Group forfeiture (addresses, not transactions; contested).

**Rules the gate enforces** (`verify-landmarks.mjs`; every one has a self-test that mutates the real facts)
- Every leg read from every operator that serves its chain, in agreement, final (six confirmations on Bitcoin,
  Ethereum's `finalized` tag). Amounts from the declared basis only: an output, a token event, an issuer's supply
  event, the trace, or a balance delta; a trace is checked against the receipt event or the balance where declared.
- Names only under D7. A tag with any third-party credit (compilation, report, or "Submitted by") names nobody, and
  neither does a tag read on Arbiscan or Optimistic Etherscan, whose readable page hides those banners (section 20).
  A person needs their own statement or a court record of conviction or plea.
- A match identifies a transaction only when exactly one is found; a set (`"set": true`, every event scan) must be
  shown whole. A read that is not complete proves nothing.
- No typed numbers in prose (placeholders or a source marker), no superlative without a marker, quotes under 15
  words and found in the archived copy, every claimed txid and address found there too.
- A leg that `follows` another (a forward, a return) is drawn and told but never added to a total; totals, the sort,
  TODAY and the charts all count each coin once.
- Coin age only from a complete read of the inputs' funding transactions. Balance reads need agreeing operators.
- Before Byzantium (block 4,370,000) receipts carry no status: it is left out of the agreement, no operator may report
  a failure and one must report success (Tenderly re-executes and fills one in; MEV Blocker leaves it out).
- `lib/landmarks/data.ts` must equal a fresh generation; chains shared with the map must link and colour the same.

**Endpoint facts measured on 2026-10-02**
- Ethereum batches: MEV Blocker answers 100 calls per JSON-RPC batch; Tenderly's gateway rate-limits a batch of
  100; drpc's free tier refuses more than 3.
- MEV Blocker once returned 0 ETH for the DAO's child at block 1,919,999, where Tenderly and drpc returned
  3,642,408 ETH; a minute later all three agreed. The agreement rule exists for exactly this. The first-transaction
  proof reads headers from MEV Blocker but fails on any missing block, checks every gas-limit step against the
  protocol, and re-reads the decisive block on Tenderly.
- archive.org answers 429 under load (pace 8 to 10 s); WebFetch cannot read web.archive.org, so the scripts read the
  raw `id_` snapshots themselves. X posts and Bybit's announcement carry their text only in the page's metadata,
  which the source check also reads.

**Analysis on the page** ("What the record shows"): what the same amounts are worth now (slope chart at reference
prices), how much of everything that existed (share of supply at the block; under 0.001% left out), what moving it cost
(fee against value, one dot per transaction, fees priced in their own asset), what came back after each theft (from the
chain where it shows a return, else the victim's own statement, else an honest blank; entry field `returned`), and every
USDT issue and redemption on Ethereum since launch. The measured tables (2026-07-03 to 2026-10-01, blocks 25,448,271 to
26,100,913, 380 requests): USDT had four Redeems and no Issue; USDC 43,042 mints and 19,461 burns by non-bridge minters;
the 20 largest transfers between registry wallets were all a company's own wallets, which the page reports as a finding
rather than ranking them.

**Verification (2026-10-02)**
- `node scripts/verify-all.mjs`: all checks pass, including `verify-landmarks` (16 entries, 28 transactions, every
  self-test) and `verify-llms` (`llms.txt` 9,974 of 10,240 bytes; its Landmarks paragraph now names the matched tier). `tsc --noEmit` clean. `pnpm lint` still 45 errors
  (the Landmarks files lint clean). `corepack pnpm build:live` built; `render.mjs --dist` passes; the hub's
  `check-llms.mjs`, run from JakePercy.com, reports 0 failures and 0 warnings.
- In `dist-check` (port 5180, nested path): the map and Landmarks load with no local 404s; Landmarks loads its own chunk,
  the shared chunk and its CSS, never the engine. Live prices loaded and every TODAY figure filled.
  With all three price hosts made to fail (a fresh frame with `fetch` stubbed before the island ran), the pill reads
  PRICES UNAVAILABLE, TODAY is `aria-disabled` with its reason as the title and ignores clicks, and every TODAY figure
  says why it is missing. `#bybit-2025` lands on its story. Home, End and the arrows step through the lights in date order
  and the live region announces each one ("the same coins moving on" for a follow-on leg); Enter focuses the story.
  Without scripts (a sandboxed frame) all 16 stories, the static field, the five analysis blocks and every details panel
  render. At 375 x 812 neither page overflows and the map's status-strip link to Landmarks shows; the measured tables
  were clipped on phones until `.lm-tables` got a `minmax(0, 1fr)` column (fixed and re-checked). No chart has
  overlapping labels (the fee chart now places labels greedily). Reduced motion was checked in the code (no ignition,
  glide, breathing, riding light or smooth scroll), because the pane was hidden and runs no animation frames.
- Hand checks against the chain, independent of the gate: Liquid's three transactions on both Bitcoin operators (the
  forward spends the release's output in the same block and pays the address the return came from), the dormant and
  Silk Road addresses' histories, the 2011 and 2020 output orders, and every Ethereum leg's log index or trace by RPC.
- Bundle sizes: the map's JS is 875.8 KB raw, 266.9 KB gzipped (874.4 KB and 263.4 KB before); the engine is unchanged.
  Landmarks loads 224.8 KB of JS (72.1 KB gzipped) and a 282.7 KB static page (47.5 KB gzipped).
- Cold read (2026-10-02, later): a fresh agent given only the page as text and the archived sources found five
  serious problems, all fixed. The genesis story cited only GitHub's copy of `validation.cpp`, whose readable text is
  cut off (the gate had found the quote in the page's embedded data); it now also cites the Bitcoin Wiki. The Tether
  story said "exactly these four removals", but destroying frozen balances also lowers supply; it now says four Redeem
  events and points to the destructions. Poly's USDT "stayed frozen" overstated a source that says Tether was
  confirming how to unfreeze it. Bybit's "the signers approved the transaction" was wrong: they signed the earlier code
  change, not the drain. It also asked for the Silk Road receiver to be re-read: both operators still show it unspent.
  Of the moderate and minor items, these were fixed: the hero and method say two Bitcoin operators or three Ethereum
  endpoints instead of "every public source"; shares of supply say "allowed by the issuance schedule"; evidence lines
  say the archived copy contains the id or address; the considered list is worded neutrally; Satoshi is no longer
  named; the DAO and Liquid figures explain what they cover; the genesis balance date and rounded balances read
  correctly. Not changed: the two Ethereum Foundation posts keep different source labels, and "Years covered" counts
  calendar years (2009 to 2026 is 18).

**Deliverable:** `outputs/ledger-atlas-live-2026-10-02.zip` (ignored by Git): `dist-live/` with `index.html` and
`landmarks.html` at the root.

**Found while doing it (reported, not fixed)**
- The hub's upload manifest (`JakePercy.com/content/llms/upload-manifest.md`, row 24) lists `llms.txt`, `methodology.md`
  and `index.html`; it now also needs `landmarks.html` and the new `assets/` files. The homepage card still says
  "3 chains" (the build reads six).
- The recent window is fixed at 2026-07-03 to 2026-10-01. Refresh it monthly (`scripts/landmarks/README.md`): the four
  recent stories leave the window at the next refresh unless they still qualify.
- D7's reopen condition now includes the Silk Road case: a complete set whose every member pays one address cannot
  name that address under "exactly one matches".
- The research agents could not read PDFs (justice.gov, CourtListener storage, the SEC's DAO report, Verichains' Bybit
  report); the entries avoid them. Court records came from CourtListener's archived HTML text.

## 20. Compilation-disclosure audit of the rows read before the `read-tag.mjs` fix (2026-10-02)

`read-tag.mjs` used to match the "tagged based on ... compilation" banner on raw HTML, and a linked compiler name defeated
it (fixed 2026-10-02, logic now in `tag-reader.mjs`). The 705 first-party rows whose note did not mention a compilation
were re-read with the fixed script at its own 2.5 s pace: no block, 705 pages. Report and per-row data:
`docs/measurements/2026-10-02/compilation-disclosure-audit.md` and `.tsv` (the TSV holds the exact proposed note text).
(Section 19 is the Landmarks page, written by the other session; this number is not a gap.)

- **106 rows carry a disclosure the registry had not recorded**, all crediting hildobby: Ethereum 74, Polygon 15,
  Avalanche 13, Base 4. All 705 tags still equal the row's `label`; none lost its tag; no third-party report banner
  ("Reported by ...") appeared. Four informational banners (Gemini's and Kraken's "Cold Wallet", a HongCoin unclaimed-ETH
  notice) are unrelated to attribution.
- **63 rows cannot be audited this way.** The `/txs?a=` header page used for Arbiscan and Optimistic Etherscan carries the
  tag but not the banner (two Arbitrum rows whose notes record a disclosure print none). Do not read "nothing printed"
  there as clean. Options: Jake reads those address pages in his browser, or `read-tag.mjs` warns on these hosts (it shares
  `tag-reader.mjs` with the Landmarks scan, so not changed here). It also means Landmarks entries named from an Arbiscan or
  Optimistic Etherscan tag cannot show D7's "credited to no outside source".
- **Registry-wide, 590 of 1,189 rows (49.6%) now carry a recorded compilation origin** (584 of the 1,120 rows on hosts
  where the banner is visible).
- **Nothing was applied.** Two decisions wait for Jake: (1) append the proposed note to the 106 rows (it ships: row notes
  appear in the evidence text), then `gen-addresses.mjs` and `verify-all.mjs`; (2) whether a disclosure lowers an entity
  to HIGH. The written rules never said so (the sentence lived in the old script comment, now removed) and practice is mixed:
  GMO Coin, bitbank, Netcoins, NDAX and Bitvavo are VERIFIED with every tag disclosed, Bitpanda, Anchorage and Bullish are
  HIGH. Recommendation in the report: no confidence change. Five VERIFIED entities newly reach "every readable row
  disclosed": Bitvavo, Bitcoin Suisse, BitoPro, Digital Surge, Wealthsimple Crypto.
- **Verification:** `node scripts/verify-all.mjs` passed, `node node_modules/typescript/bin/tsc --noEmit` is clean and
  `corepack pnpm build:live` built, run on the working tree with the Landmarks work present. No registry, entity or generated
  file changed. No browser check (no UI change). No new zip: the built page is the same as before this audit.
- **Open:** the 484 rows that already had a note were not re-read; the `checked` dates of the 705 re-read rows were not
  bumped (the tags matched, which is real re-verification, but it was not asked for).

## 21. Phone layout: corridors start minimized, colour key moves into the dropdown (2026-10-03)

Jake's request after viewing the live page on a phone: the Leading corridors card and the Dominant asset legend took too much
of the globe.

- **`components/atlas.tsx`:** `showRoutes` now starts `false` below 650px (the same breakpoint as the `mobile` flag), so the
  Leading corridors card opens as its one-line heading and expands on tap. Desktop and tablet still start expanded.
  `Choice` takes an optional `keys` prop; on phones the "Color by" dropdown passes it, which puts the colour dots inside
  the trigger (shown only when a mode has three entries or fewer: Asset and Confidence) and a labelled key under each mode
  name in the open list (Asset: USDC, USDT; Chain: all eight; Confidence: Verified, High).
- **`app/globals.css`:** in the `max-width:650px` block `.map-legend` is `display:none` and `.key-dots`, `.key-row`,
  `.key-item` style the new key. The legend's width/motion/glow wording remains in "How to read the map". Tablet and
  desktop keep the floating legend unchanged.
- **Verification:** previewed at 430px wide: card collapsed on load, legend gone, two dots in the trigger, open list shows the
  keys. `node scripts/verify-all.mjs` passed and `tsc --noEmit` reports nothing in `atlas.tsx`. Not rebuilt, so no new zip:
  run `corepack pnpm build:live` before the next FTP upload.
- **Open:** Chain mode shows no dots in the closed trigger (eight is too wide); its key is only in the open list.

## 22. Tronscan API key wired in; Tron lead wallets read (2026-10-06)

Jake added a free Tronscan API key as `TRONSCAN_API_KEY` in `.env.local`, which Git ignores. It is for offline research
only (D6) and never ships. The live build is unchanged and still needs no key.

- **`scripts/registry/tag-reader.mjs`** accepts `tronscan.org`. It reads `publicTag` from
  `apilist.tronscanapi.com/api/accountv2` with the `TRON-PRO-API-KEY` header, because tronscan.org pages sit behind a
  bot challenge. It loads `.env.local` itself if the variable is unset and stops on any non-200 reply. `redTag` and
  `greyTag` are printed as explorer alerts and are never the tag. **`read-tag.mjs tronscan.org <T…>`** takes base58
  addresses and does not lowercase them. **`.env.example`** lists the variable.
- **Result** (`docs/measurements/2026-10-06/tron-tronscan-tags.md`): **9 of the 17 Dune lead wallets that moved USDT in
  the 2026-10-01 screen carry a Tronscan tag, and those 9 moved $3.59B of the $3.70B.** That is six Binance wallets
  ("Binance-Hot 3/4/5/6/7", "Binance 2"), plus "Bitfinex", "Kucoin 4" and "MXC". Bitso, Lemon Cash, CoinDCX, and one
  wallet each for Binance, Bitfinex and KuCoin have no tag and are not admissible, so Tron does not yet reach LatAm or
  India. The Dune names do not match Tronscan's (Dune "Binance 10" is "Binance-Hot 7"), so labels must be the Tronscan
  tag verbatim. "MXC" (MEXC's old name) and the bare brand tag "Bitfinex" need a rule-3 check before admission.
- **Nothing was added to the registry.** Tron rows need the model work first: base58 keys, and Tron kept out of
  `EVM_CHAINS`.
- **Verification:** the key returned real tags (also `Binance-Cold 2` on a test address); 17 reads, no block; bad
  addresses are refused; `node scripts/verify-all.mjs` passed. No UI change, so no build or zip.
- **Bandwidth measured, same day:** one hour of all nine wallets is 8,400 logs. That is 5.29 MB from TronGrid, which does
  not compress, but **0.67 MB in 4.4 s from `tron-evm-rpc.publicnode.com`**, which sends brotli. Use publicnode as the
  primary endpoint and TronGrid as the fallback, and watch all nine. No log in that hour ran between two watched wallets,
  so Tron corridors depend on deposit inference. All four brands are offshore (KY, VG, SC), so expect mostly unplaced flow.
- **Next:** the Tron model work, a `feeds.ts` entry, Tron in `measure-dormancy.mjs`, then a lead hunt for local-exchange
  Tron wallets, which are what would reach India and LatAm.

## 23. Tron live: 21 Tronscan-tagged wallets on a keyless feed (2026-10-06 evening, reads dated 2026-10-07 UTC)

Jake's decisions on 2026-10-06:
- "MXC" tags count as MEXC, with a note on each row.
- The Tron feed may cost up to about 2 MB per visitor-hour.
- Registered brands only tonight.
- The §20/§21 work ships too. It is committed separately as `e9eb6ec`.

Full research record: `docs/measurements/2026-10-06/tron-tronscan-tags.md`, with raw data in `tron-screen.json`.

**Registry.** 21 Tron rows were added to `addresses.txt`. All carry a Tronscan `publicTag` read through
`read-tag.mjs tronscan.org`. All are normal accounts with no risk flag, and all moved at least $100k (1 to 7 days):

| Entity | Rows |
|---|---|
| Binance (KY) | 10: Binance-Hot 3–11, Binance 2 |
| OKX (SC) | 1: OKX Hot Wallet 8 |
| Kraken (US) | 1: Kraken: Hot Wallet |
| Bitfinex (VG) | 1 |
| KuCoin (SC) | 2 |
| Bitget (SC) | 1 |
| MEXC (SC) | 2: MXC, MXC 2 |
| Coinone (KR) | 1 |
| Bithumb (KR) | 1: Bithumb Exchange Hot Wallet |
| Coins.ph (PH) | 1 |

Registry totals: 1,210 first-party rows across 64 entities.

The leads came from Tronscan's `search/v2` and from the USDT holders list. Those are lead sources only:
- 90 tagged addresses were found.
- 4 were rejected under rule 3 or as the wrong operator ("Bithumb Global").
- 46 tags of registered brands moved nothing in 7 days.
- 19 tags name unregistered brands (Bybit, Gate, MaskEX and others). They need D3 research first.

**Code.**
- **`lib/atlas/tron.ts`** is new and synchronous:
  - base58check ⇄ 20-byte hex, with its own small SHA-256 because `crypto.subtle` is async.
  - `rpcAddress`, `recordAddress`, `isZeroAddress`, `TRON_ZERO`.
- **`feeds.ts` `Tron`:**
  - Endpoints: `tron-evm-rpc.publicnode.com` (brotli) first, then `api.trongrid.io/jsonrpc`; `tron-rpc.publicnode.com` for small calls only.
  - `chainId` 728126428, `slotMs` 3000, `chunk` 600, `sampleBlocks` 6.
  - `maxTopics` 1000, `maxRange` 1200.
  - `ENDPOINTS_MEASURED` is now 2026-10-06.
- **`live-client.ts`:** topics and the contract list go through `rpcAddress`. `CONTRACTS.Tron` stays keyed by base58, the
  registry's own key shape.
- **`live-core.ts`:**
  - `decodeTransferLog` writes Tron addresses in base58, and EVM output is unchanged.
  - The `ZERO` regex is replaced by the per-chain `isZeroAddress`.
- **Tronscan transaction links** strip the `0x` prefix, in `geography.ts` and `lib/landmarks/chains.ts`.
- **Tools that now handle Tron:**
  - `gen-addresses.mjs` validates base58check and gives Tron a WATCHED list and a dormancy entry.
  - `measure-dormancy.mjs` and `rpc-pool.mjs` have Tron endpoints. A "more than 10000 results" reply now counts as too big.
  - `probe-endpoint-caps.mjs` and `atlas-modules.mjs` (no lowercasing on Tron) are updated.
  - `tag-reader.mjs` prints the Tron account type.
- **Verifiers:**
  - `verify-registry.cjs` gains a Tron checksum and round-trip check (stricter, nothing relaxed).
  - `verify-live.cjs` gains Tron decoding fixtures.
- **One verifier correction, `scripts/llms/render.mjs`.** The METHODOLOGY sentence "another EVM chain the build reads (…)"
  is now compared with the live **EVM** chains minus Ethereum. Comparing it with every live chain would have required
  naming Tron in a sentence about EVM derivation, and Tron never derives. The meta-description check, which requires
  every live chain to be named, is unchanged; `live-lite/index.html` now names Tron.
- **Text:**
  - `docs/METHODOLOGY.md` gains two sentences: Tron uses Tronscan tags only and never derives, and Tron is USDT only.
  - Rule 1 above and `known-entities.ts` now name Tronscan.
  - `live-lite/README.md` and `README.md` are updated.

**Dormancy** was re-measured for all seven chains on 2026-10-07: Ethereum 165/822, Base 58/822, Arbitrum 53/791,
Avalanche 35/779, Polygon 38/774, Optimism 15/768, Tron 21/21. The next run is due by 2026-11-21.

**Bandwidth.** One hour of the 21-wallet filter on publicnode is 15,773 logs and 1.24 MB on the wire. The largest
600-block reply was 4,301 logs, against the 10,000-log cap. If visitors fall back to TronGrid (no compression), the same
hour is roughly 10 MB.

**Expect on the live page:**
- Tron is the largest chain by volume, about $200M an hour on evidenced wallets.
- Its flow lands mostly on KY, SC, VG, US, KR and PH. Routes come from deposit inference: in the first hour the top
  Tron corridor was KY→SC at $6.14M, Binance-Hot 8 paying a deposit address inferred as OKX's.
- 24H and 7D re-lock on "All chains" until each visitor's browser has recorded Tron history, as they did when Polygon
  and Optimism joined.

**Verification:**
- `node scripts/verify-all.mjs` passed. It reports 7 chains and 1,210 addresses stamped in `llms.txt` (9,991 of 10,240
  bytes).
- `tsc --noEmit` is clean, and `corepack pnpm build:live` built.
- Dev server: Tron LIVE. With the filter on Tron alone: $198M observed, $12.15M attributed, 16 corridors. Base58
  addresses and bare-hash Tronscan links. At 375x812 there is no overflow, the legend is hidden and the corridors card
  starts collapsed.
- Built `dist-live` served at `/ledger-atlas-live/`: no local 404s, all seven chains LIVE, only Solana Not connected,
  $556M observed, $34.1M attributed and 32 routes on All chains in the first hour.
- Lint was not re-run (45 pre-existing errors).

**Deliverable:** `outputs/ledger-atlas-live-2026-10-07.zip` (ignored by Git). `index.html` and `landmarks.html` are at
the zip root. Jake FTPs its contents into the existing folder, keeping `assets/`.

**Open:**
- D3 operator research for Bybit, Gate and the other unregistered tagged brands.
- India and LatAm still have no tagged Tron wallets.
- The 46 idle tagged wallets of registered brands should be re-screened when the lead sweep is re-run monthly.
- The hub upload manifest and the `llms: true` flag (to-do 10) still need Jake's upload.

## 24. Tron open items researched: India/LatAm and the unregistered tagged brands (2026-10-07)

Jake asked for the two open items from section 23 to be researched. Report: `docs/measurements/2026-10-07/tron-open-items.md`,
with raw data beside it. The D3 table in `docs/DECISIONS-2026-09.md` gained a dated re-check note.

**India and LatAm: nothing admissible exists on Tron yet.**
- Tronscan search across 64 brand terms found no tagged address for CoinDCX, Bitso, Lemon Cash, Mercado Bitcoin, Brasil
  Bitcoin, CoinSwitch, Ripio, Buenbit, Foxbit and others. Bitso and Lemon matches are owner-set names only.
- The only tagged Indian wallets are idle: "WazirX Exchange Hot Wallet" last moved USDT on 2025-05-15, "Bitbns" on
  2023-01-02.
- A counterparty sweep found no regional exchange either: the 400 largest of 106,864 counterparties of the 22 hubs over
  6 hours had their Tronscan tags read, and only 4 carried a tag.

**Unregistered tagged brands: activity screen, then D3** (three research agents using WebSearch and WebFetch only;
Ourbit's terms were re-read by the main session).
- **Ourbit passed:** Ourbit Holdings Ltd., BVI no. 2138612, named as custodian in its own terms dated 2026-05-30. It is
  admitted at HIGH (`ourbit` entity, VG) with one Tron row, "OURBIT Exchange Reserves" ($888k in 7 days).
- **Still failing their 2026-09-21 reopen conditions:** Bybit ($2.04B in 7 days on Tron), WhiteBIT ($383M) and Cobo
  ($212M).
- **Fail:** Gate ($706M; the global agreement names no entity), UEEx, VIR8, MaskEX (ADGM alert) and Flipster.
- **Never attributed:** FixedFloat, which is a non-custodial swap service by its own terms.
- **Held for Jake:**
  - **Well Wallet** ($396M): Costa Rica entity in the footer only, no registry confirmation, and `CR` would be a new map
    country. It parallels WhiteBIT.
  - **Swapster** ($36M): the current agreement PDF could not be read with WebFetch.
- Idle on Tron: all 13 HTX tags, Bybit Cold, LBank, XT.COM, WhiteBIT 2 and 3.

**Registry:** 1,211 first-party rows across 65 entities. Tron has 22 rows. Tron dormancy was re-measured and merged with
the same-day parts for the other six chains: 22 of 22 active.

**Verification:**
- `node scripts/verify-all.mjs` passed (llms.txt stamps 1,211 addresses), and `tsc --noEmit` is clean.
- `corepack pnpm build:live` built.
- The built site served at `/ledger-atlas-live/` showed no local 404s, all seven chains LIVE and Solana Not connected.

**Deliverable:** `outputs/ledger-atlas-live-2026-10-07b.zip`. It supersedes `ledger-atlas-live-2026-10-07.zip` and differs
only by the Ourbit row. Uploading either works.

**Open (Jake):**
- Decide on Well Wallet.
- Read Swapster's current user agreement (https://swapster.fi/docs/en_new/USER_AGREEMENT-2.pdf) in a browser to confirm
  its operator, or leave it out.
- If Bybit's main terms ever name one custodian for all clients, its 532k transfers a week would add about 0.25 MB per
  visitor-hour to the Tron feed.

## 25. Tronscan lead harvest from the untried list endpoints (2026-10-08)

Jake asked whether the Tronscan API could add more wallets or countries. Report: `docs/measurements/2026-10-08/tron-lead-harvest.md`,
with raw data beside it (`tron-lead-harvest.json`, `tron-lead-screen.json`).

**Sources (leads only).** All 943 requests returned 200. The sources were:
- `account/list?sort=-balance`: the top 10,000 TRX accounts.
- `token_trc20/holders`: the first 2,500 holders of 12 non-USDT tokens.
- `search/v2`: 180 terms.

They gave 186 tagged addresses, 83 of them new. After dropping super-representative, burn, energy-rental, gambling,
donation and bridge tags, 57 were screened.

**7-day USDT screen** (publicnode, then TronGrid; 84 queries, none failed): 16 moved USDT.
- **Admitted: OURBIT Exchange Hot Wallet** (TApNqy5BNx11TiNa7oibbBUV63BY5a2sNE, $2.99M, 1,050 transfers). Ourbit already
  passed D3 on 2026-10-07, and its tag was read through `read-tag.mjs tronscan.org`.
- **Every new regional tag that could add a country was idle:** Kuna (UA), ONUS (VN), Cryptoforce (IN), Kuantist and
  Darkex. So were Binance-Cold 3 and the global brands BitMart, Phemex, CoinEx, ProBit, Bitrue and others.

**Operator test (D3) on the active unregistered brands** (one research agent, WebSearch and WebFetch only):
- **CEX.IO fails:** its entity depends on the client's residence.
- **Unclear, mostly because their own terms pages were unreadable:**
  - Urban Crypto Exchange (Brazil), $26M.
  - CEEX.
  - WestWallet: its only entity link points at a company being deleted.
  - Wallib (Colombia).
- MaskEX's four new hot wallets ($101M) stay out: MaskEX failed D3 on 2026-10-07.

**Held for Jake:**
- **DTCPay** ($36.6M):
  - It passes on paper: Digital Treasures Center Pte. Ltd., MAS Major Payment Institution PS20200531.
  - It is a payment processor, though, and the registry has held only exchange and custodian wallets.
  - Its terms define the operator as the company "and its Related Parties".
  - SG is already on the map, so it adds flow but no country.
- **Cropty** ($1.3M): it is the Well Wallet case again.
  - Coinscatch (Private) Limited, Sri Lanka, is named only in undated terms.
  - There is no registration number.
  - `LK` would be a new country.

**Registry:** 1,212 first-party rows across 65 entities. Tron has 23. Tron dormancy was not re-measured, because
`--merge` needs every part from the same day. The new row is watched by default, and `verify-all` warns about it until
the monthly run (due by 2026-11-21).

**Verification:**
- `node scripts/verify-all.mjs` passed; `llms.txt` stamps 1,212 addresses.
- `tsc --noEmit` is clean.
- `corepack pnpm build:live` built.

**Deliverable:** `outputs/ledger-atlas-live-2026-10-08.zip`. It supersedes the 2026-10-07b zip, and it differs only by
the new Ourbit row.

**Open (Jake):**
- Decide on DTCPay (payment processors on the map?), Cropty (LK) and Well Wallet (CR, section 24).
- Optionally read https://urbanexchange.com.br/termos-de-uso and https://www.wallib.com/terms in a browser. Either could
  pass and is reachable no other way.
- The free Tronscan API is close to exhausted as a lead source. Re-run this harvest monthly with the lead sweep, since
  Tronscan adds tags over time. No paid Tron API would add evidence, because admission needs Tronscan's own tag.


## 26. Map blackout fix: no cleared frame on resize or render-scale change; coalesced updates (2026-10-09)

Jake reported the map blacking out for a split second every few seconds, apparently on updates. A full backup was taken
first: git tag `backup-before-blackout-fix-2026-10-09` and a copy of the tree (minus `node_modules`) beside the repo as
`live-blockchain-flows-backup-2026-10-09-pre-blackout-fix`.

**Cause (two mechanisms, found by reading the renderer and measuring the running page):**
1. Assigning a canvas `width`/`height` empties its drawing buffer. `renderer.setSize` does that even for an unchanged
   size, and the redraw waited for the next animation frame, so the compositor painted one empty (black) frame. It happened
   on every `ResizeObserver` callback (which also fires for layout changes that leave the map's box alone) and every time
   the quality governor stepped the render scale (`quality.sample` → `setPixelRatio`, which ran *after* that frame's
   render). On a slower GPU the governor steps down, then probes back up after 3, 6, 12 … 48 s, a repeating blink.
2. Every chain's `poll()` ended with a full-buffer `reinfer()` and a snapshot `emit()`, and the six polls share one 20 s
   timer. Measured on the dev server: a burst of about seven main-thread tasks of 55–73 ms every 20 s, each also
   re-rendering the whole React tree.

**Fix:**
- `components/map/engine.ts`: `resize()` no longer calls `setSize` when width, height and pixel ratio are unchanged; a
  real resize redraws synchronously via `redraw()` (guarded until the first frame has drawn, so start-up still compiles
  shaders asynchronously); the governor's pixel-ratio change redraws in the same callback instead of setting `invalid`.
- `lib/atlas/live-client.ts`: a poll now sets `reinferDue` and calls `emitSoon()`, which coalesces polls finishing within
  `EMIT_COALESCE_MS` (1500 ms) into one `emit()`. `emit()` always runs a pending `reinfer()` first, so no snapshot is built
  from unclassified records. Backfill and the 8 s tick still call `emit()` directly. `dispose()` clears the timer.

**Verification:**
- Dev server before: long-task bursts of about 7 per 20 s cycle. After: 1 per cycle (about 60 ms) at 81.9, 102.4 and
  121.8 s. The globe renders correctly after resizing to tablet and back to desktop.
- `node scripts/verify-all.mjs` passed (exit 0); `corepack pnpm build:live` built.
- **Not measured directly:** the embedded browser pane does not run `requestAnimationFrame` from the debug tool, so a blank
  frame could not be observed on a live compositor. The fix removes both known ways to present a cleared buffer; Jake
  should confirm on his own display. If a blink remains, instrument `gl.clear` and canvas width writes per frame
  (the `HTMLCanvasElement.prototype` width/height setter hook used in this session) and look for another clearing source.
- Dev-environment note, not a repo change: OneDrive had replaced about 370 pnpm symlinks in `node_modules/.pnpm` with
  empty directories (the real links survive as `*-JakePowerSpec` copies), which broke vite. They were re-created as
  junctions. If vite fails with "Cannot find package ... @rolldown/pluginutils", the same OneDrive damage has recurred.

**Deliverable:** `outputs/ledger-atlas-live-2026-10-09.zip` (ignored by Git), `dist-live/` rebuilt with the fix.

## 27. Three held brands admitted: Urban (BR), Well Wallet (CR) and DTCPay (SG); payment firms allowed (2026-10-09)

Jake asked for the brands held in sections 24 and 25 to be resolved. The evidence is in the 2026-10-09 follow-up note under
D3 in `docs/DECISIONS-2026-09.md`.

**Decisions (Jake, 2026-10-09):**
- **Payment firms are admissible.** The map is about cross-border stablecoin settlement, so a licensed payment or settlement
  company's own hot wallet belongs on it under the same operator test. New entity category `payment` in `known-entities.ts`,
  whose header now states the rule. Merchant or customer deposit addresses stay out (rule 3).
- **Admitted:** Urban Crypto Exchange, Well Wallet and DTCPay.
- **Left out, with the reasons written into the `known-entities.ts` header and DECISIONS so a future lead sweep skips them:**
  Swapster, Wallib and Cropty (with Gate, UEEx, VIR8, MaskEX, Flipster, CEX.IO and FixedFloat from earlier passes).

**Research done this session (main session, plus one research agent for Well Wallet; no downloads):**
- **Urban:** the new terms (v9.0, 2026-08-05, a PDF linked from the site footer; the old `/termos-de-uso` URL is a 404) name
  one São Paulo company, CNPJ 34.278.950/0001-02. Receita Federal (via publica.cnpj.ws) records the trade name as
  "URBAN CRYPTO EXCHANGE", matching the Tronscan tag.
- **Well Wallet:** its own public-wallets page lists the tagged Tron and Ethereum addresses. Costa Rica's Ministerio de
  Hacienda confirms the footer company and its legal ID. Caveat in the entity note: the terms' party clause is an unfilled
  placeholder. Jake may still search the ID on SUGEF's register to strengthen it.
- **DTCPay:** terms say "we hold the private keys"; MAS licence PS20200531 confirmed through press coverage. The terms
  themselves do not cite the licence number.
- **Swapster:** the full 2026-03-24 agreement names no company at all. **Wallib:** its coins sit with an unnamed, replaceable
  US provider. **Cropty:** Jake's call to leave it out.

**Applied:**
- `geography.ts`: Costa Rica (`CR`, numeric 188) added; 30 jurisdictions. No `MAP_LABELS` entry: it labels itself when active.
- Entities `urban` (BR, exchange), `wellwallet` (CR, exchange), `dtcpay` (SG, payment), all HIGH, verified 2026-10-09.
- Six rows, tags read through `read-tag.mjs` on 2026-10-09:
  - Tron: Urban Crypto Exchange Hot Wallet ($26.0M a week), Well Wallet Hot 2 ($396M), DTCPay Hot Wallets 2 and 3
    ($33.9M and $2.6M). DTCPay Hot Wallet 1 is idle and left out.
  - Ethereum: Well Wallet: Hot 1, `0x9dab…13b0` ($50.2M of USDC/USDT in 7 days). It is a plain account, so it derives onto
    the five other EVM chains.
- Registry: 1,217 first-party rows (Tron 27, Ethereum 823), 3,572 derived, 68 entities.

**Verification:**
- `node scripts/verify-all.mjs` passed. Its only warnings are the expected "added since the dormancy measurement" ones (one
  new row per EVM chain, five on Tron); the next dormancy run, due by 2026-11-21, clears them. `llms.txt` is 9,991 of
  10,240 bytes, so the next wave that adds prose may hit the cap (the fix is shorter prose).
- `tsc --noEmit` is clean; `corepack pnpm build:live` built.
- Built site served from `/ledger-atlas-live/` (dist-check): all chains LIVE; with the Tron filter, Costa Rica and Brazil
  are labelled on the globe and 13 corridors show in the first hour.
- `scripts/measure-corridors.mjs` only knows Ethereum, Base and Arbitrum (it crashes on `cfg.slotMs` for the newer chains),
  so per-chain corridor counts for Avalanche, Polygon, Optimism and Tron were not measured. Worth fixing before the next
  methodology change.

**Deliverable:** `outputs/ledger-atlas-live-2026-10-09b.zip` (ignored by Git). It supersedes `ledger-atlas-live-2026-10-09.zip`.

**Open (Jake):**
- Upload the zip, then set `llms: true` in the hub (section 8, item 10).
- Holder CSV exports of USDC and USDT from Etherscan (USDC), Polygonscan, Snowscan and Optimistic Etherscan: the best
  source of first-party wallets on the thin chains, which is what lets routes form there.
- Optionally search Well Wallet's cédula 3-102-913956 on https://www.sugef.fi.cr/Sipo.Reportes/.
- Solana: a free Helius key plus a Cloudflare Worker on the free tier (`docs/API-PLAN.md`), and a decision on Solscan tags.

## 28. A tab left running: 24H could never unlock, and the map emptied after a sleep (2026-10-12)

Jake left the live site open over the weekend of 10-11 October to unlock 24H. When he came back every route had gone and
the header figures read $0. The site was then running the 8 October build (`assets/index-DTYJbPu9.js`, uploaded
2026-10-09 03:49 UTC, so before sections 26 and 27), but every fault below is older and was in later builds too.

**Causes (read from `live-client.ts`, then reproduced in the dev server):**
1. **24H and 7D could never unlock on "All chains".** A window's coverage is its least-covered chain (section 12), and each
   poll recorded `time(to) - time(from)` for the blocks it read: one block's time short per read. Ethereum has 12 s blocks
   and is polled every 20 s, so two polls in five read one block and recorded nothing. A simulation of a day of polls gives
   Ethereum 40.0%, Tron 85.0%, Base and Optimism 90.0%, Polygon 92.5%, Avalanche 94.0% and Arbitrum 98.8%, and the spans
   this machine had recorded on 2026-10-09 (20:30 to 21:45 UTC, a tab left polling) show the same: Ethereum 39-40%, Tron
   85%, Base and Optimism 90%. Against an 80% bar, Ethereum alone kept both long windows locked however long the page ran.
2. **The feed crawled through a pause.** A computer that sleeps, a background tab Chrome freezes or a lost network stops every
   timer. On waking, each chain's poll resumed at the block after the last one it had read and moved forward one catch-up
   range per 20 s poll. After 60 hours that is 864,000 Arbitrum blocks: 772 polls, about 4.3 hours in a visible tab and about
   15 hours at the one poll a minute Chrome allows a hidden tab (Ethereum: about 2 and 7 hours). Every block read on the way
   was older than the 90-minute buffer, so each transfer was pruned the moment it landed. Until the crawl ended the map
   showed no routes, $0 and the Delayed state. This is the most likely cause of what Jake saw.
3. **Prices did not recover after a gap.** The price series is fetched once at start; after that only a spot price is
   sampled, every two minutes, and a transfer is priced only from a sample within 10 minutes of its block time. Transfers
   from before the first new sample after a pause had no sample near them, and nothing fetched the series again
   (`fetchPriceSeries` re-ran only while a series had never loaded). They stayed unpriced, outside every USD figure and every
   route, until they aged out, while the health badge said LIVE.
4. Two smaller faults that matter only to a long-running tab: one backfill chunk that failed kept that chain at Partial for
   the rest of the session (`missingBlocks` was never reset), and a sealed span whose last seconds were read after it was
   sealed kept its short coverage unless a new transfer happened to land in it.

**Fix:**
- `readInterval()` in `live-core.ts` (pure, tested): reading block n observes the chain over (time(n-1), time(n)], so a read
  that starts at the block after the previous read claims the time since that read ended, and consecutive reads tile. A read
  after a gap (the first one, or after a failed range) claims one block's time before its first block, never the gap. Every
  backfill chunk and every poll records its interval through it (`noteRead`).
- `nextPollRange()` in `live-core.ts` (pure, tested) decides each poll's range. When a feed is more than its backfilled hour
  behind (`cfg.blocks`) it returns `'rejoin'`, and `poll()` runs `backfill()` again: the latest hour, read the way a page load
  reads it, with the loading progress shown. The skipped stretch is never marked observed, so recorded history counts it as
  a gap. Gaps of an hour or less are still crawled as before.
- `refreshPriceGaps()` runs on every two-minute price tick and after a rejoin. Any asset with an unpriced transfer in the
  buffer has its series fetched again (`seriesBusy` stops overlapping fetches), and `repriceUnpriced()` now marks the
  transfer's span dirty so its sealed summary is corrected too.
- `missingAt` records the block time of the newest range that failed to load; once it is older than the buffer the gap is in
  no live window, `missingBlocks` resets and the chain can be LIVE again.
- `noteObserved()` marks every span it touches dirty, so a span sealed before its last seconds were read is re-sealed with
  its real coverage. `sealDue()` drops dirty marks for spans that have left the buffer.

**Verification (dev server, 2026-10-12, with a temporary harness page that wrapped `fetch`; deleted afterwards):**
- `verify-live.cjs` now simulates a day of polls: Ethereum at 20 s and at the 60 s a hidden tab gets, and five other block
  times, each above 99.9% observed (the old formula gives the percentages in cause 1).
- Coverage, live: the same quarter hour (19:00 to 19:15 UTC) sealed in two tabs at once. The built tab, still on
  the old formula: Ethereum 40.0%, Tron 85.0%, Base 90.0%, Optimism 90.0%, Arbitrum 92.2%, Polygon 92.5%, Avalanche 94.2%.
  The dev tab with the fix (about 4 minutes of start-up backfill, then polls): 100.0% on all seven chains.
- Rejoin: Base's first tip was faked 4,000 blocks low, so the start-up backfill read an hour that ended 2.2 hours ago. The
  first poll logged "Base is 4,001 blocks behind ... re-reading the latest hour" and re-read it; within 15 s Base was LIVE and
  its four latest spans were sealed at 100% coverage with real transfers and no unpriced ones.
- Price gap: the first series for each asset was cut 30 minutes short. Fixed code: 6,171 unpriced transfers at 45 s; the series
  was fetched again at the 120 s tick, unpriced fell to 0, observed value rose from $217M to $289M, and the next seal rewrote
  the two affected spans with no unpriced transfers. Old code (stashed, same harness): 5,671 unpriced at 62 s and still 5,671
  at 142 s, with no second series request, health LIVE throughout.
- Normal page with the fix while CoinGecko was answering 429 to this machine (repeated reloads): Coinbase and Kraken priced
  everything, all seven chains LIVE, 41 corridors, 0 unpriced. The built `dist-live/` (dist-check) was LIVE on every chain.
- `node scripts/verify-all.mjs` passed (same dormancy warnings as section 27); project `tsc --noEmit` clean.

**What this does not change:** history still accrues only while the page runs. Hours the computer sleeps are unobserved,
honestly, and 24H needs 19.2 of the last 24 hours watched (7D needs 134.4 of 168). To unlock them the computer must stay
awake and the tab should have its own visible window: Chrome treats a minimized or fully covered window as hidden, throttles
it, and with Energy Saver or Memory Saver on may freeze or discard it. History lives in that browser profile's site storage
for jakepercy.com, so uploading a new build and reloading keeps it; clearing site data or switching browser loses it. Spans
recorded before this build keep their under-recorded coverage (they are summaries; the reads cannot be replayed), so the
first 24H unlock needs roughly 16 to 20 hours of this build running with the computer awake.

**Also found:** `outputs/ledger-atlas-live-2026-10-09.zip` is a tar archive with a `.zip` name (its first bytes are `./`), so
Windows cannot open it. It was superseded by `2026-10-09b`, which is a real zip.

**Deliverable:** `outputs/ledger-atlas-live-2026-10-12.zip` (ignored by Git), built from this commit. It also carries
sections 26 and 27, which the live site does not have yet.

**Open (Jake):** upload it and reload the open tab; keep the computer awake while recording. An optional "keep this screen
awake" switch on the page (the Screen Wake Lock API) was considered and not built; it holds only while the tab is visible.

## 29. Public-repository preparation, part 1: the tree pruned, the gate type-checks, lint re-based (2026-10-18)

Jake asked how to make the project impress the companies he is applying to (data/research analyst, product and
investigations/compliance roles at on-chain analytics, exchange, stablecoin-issuer and infra companies). The approved
three-week plan is `~/.claude/plans/any-ideas-on-how-swift-toucan.md`, with a plain-English summary at its end and a
red-team table of what it must not bend (no data licence on the explorer tags, bulk scan outputs kept offline, `SCHEMA`
bumped rather than worked around, no Prettier pass, `og.png` cartography only, phones unchanged). Week 1 makes the
project findable and credible; this section is its first step.

**Removed from the tree** (git history keeps everything; the pre-prune commit `b35900c` is tagged
`backend-deferred-2026-10` once the history rewrite in a later step lands):
- The Next.js / Cloudflare Workers / D1 scaffold that was the deferred phase-2 backend: `app/api/**`, `app/layout.tsx`,
  `app/page.tsx`, `app/chatgpt-auth.ts`, `db/`, `drizzle/`, `drizzle.config.ts`, `examples/`, `build/`,
  `next.config.ts`, `vite.config.ts`, `cloudflare-env.d.ts`, `.openai/`, `lib/atlas/{store,production,connectors}.ts`,
  `scripts/collector.mjs` and the template installer scripts (`run-framework`, `sites-env`, `install-ci`,
  `install-pnpm`, `pnpm-install`, `execution-profile`, `build-verified.sh`).
- 44 unused shadcn files under `components/ui/` (`sheet`, `select`, `tabs`, `switch` and `slider` stay: the only five
  `atlas.tsx` imports, and none of them imports another), `hooks/use-mobile.ts`, `components.json`, the three Next.js
  starter SVGs in `public/`.
- 18 dependencies and 8 devDependencies nothing imported (`next`, `drizzle-orm`, `zod`, `recharts`, `wrangler`,
  `vinext`, ...); `@types/*` moved to devDependencies; the lockfile shrank by about 3,200 lines. `eslint-config-next`
  had to go too: it loads `next` at runtime. Lint now runs on `@eslint/js`, `typescript-eslint` and
  `eslint-plugin-react-hooks` 7 (the same React Compiler rules as before).
- `docs/OPERATIONS.md` moved to `docs/archive/OPERATIONS-2026-09-backend-design.md` with a banner: it described the
  scaffold's demo mode in the present tense.

**Moved:** `app/globals.css` and `app/landmarks.css` to `live-lite/styles/` (the only live files under `app/`);
`main.tsx`, `landmarks.tsx` and the vendor import follow. `render.mjs liveSources()` no longer skips the deleted
backend files or walks `hooks/`.

**Changed:** `package.json` is `blockchain-flow-map` with `dev:live`, `build:live`, `verify`, `typecheck` and `lint`,
and `engines.node >=22.18.0`, because the build-time renderers import `.ts` from `.mjs` through Node's type stripping
(this machine runs Node 24). `tsconfig.json` lost the Next plugin, the `.next` includes and the Workers types;
`.env.example` holds only `TRONSCAN_API_KEY`; `pnpm-workspace.yaml` keeps the project-local store (changing it would
purge and re-download `node_modules`; a first attempt did exactly that and was reverted) and drops the `sharp` and
`workerd` entries; `.claude/launch.json` lost the `start` entry. **`verify-all.mjs` now ends with `tsc --noEmit` over
the whole project**, so a type error in `atlas.tsx` or `live-client.ts` fails `pnpm build:live`; the manual `tsc` step
in section 6 is folded into the gate.

**Lint re-based.** The old count (46 errors, 16 warnings on the morning of 2026-10-18; the documented 45 had drifted)
was under the Next config. Under the new presets, with a config override for `require()` in the CommonJS verifiers
(their two file-level disables removed) and a stale local `.next/` folder deleted: **34 errors, 6 warnings**. New in
the count are `@eslint/js` rules the Next config never ran: `no-control-regex` on the deliberate `\x00-\x7F` ASCII
checks in `render.mjs`, `no-irregular-whitespace` on the deliberate thin-space character class in
`scripts/landmarks/readers.mjs:277` (a regex that normalises non-breaking and thin spaces, not a stray character),
`preserve-caught-error` and `no-empty` in the scripts. Gone are the eleven in deleted files. The rule stands: do not
add to the count, do not spend time fixing it unless asked.

**Verification:** `node scripts/verify-all.mjs` passes with the new `tsc` step (the only warnings are the expected
"added since the dormancy measurement" ones); `corepack pnpm build:live` builds, `llms.txt` still 9,991 bytes;
`corepack pnpm install --frozen-lockfile` exits 0, as CI will run it; `pnpm lint` gives the count above. No UI change,
so no browser check and no new zip.

**Documents updated in this commit:** sections 1, 3, 6, 8 (item 8) and 23 where they named the deferred backend;
`README.md`; `docs/API-PLAN.md`; `AGENTS.md` (tsc in the gate, Node floor, scripts, the lint baseline, and the
sentence that called `engine.ts` a demo slated for removal, which was wrong); `live-lite/README.md` (the backend
sentence only; its registry figures are still the 2026-09-21 ones and are refreshed in week 1 step 5).

**Next (plan week 1):** step 2 first-minute fixes (a LOADING health state, the pill naming every chain, the headline
label of to-do 11, an Evidence registry section in Data & coverage), step 3 author links and `og:image`, step 4 1H
baselines, step 5 the history rewrite, NOTICE, README, CI and the push to GitHub on Jake's go-ahead.
