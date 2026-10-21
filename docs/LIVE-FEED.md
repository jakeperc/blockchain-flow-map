# How the live feed works and why it is shaped this way

Moved on 2026-10-19 from the project's engineering notes, where it was kept current. Every figure carries the date
it was measured. `scripts/probe-endpoint-caps.mjs` re-measures the endpoint caps and `lib/atlas/feeds.ts` holds the
values the build uses; `scripts/verify-registry.cjs` fails the build when the watched list outgrows them. Update this
file whenever a cap or chunk size is re-measured.

- Two topic-filtered `eth_getLogs` calls per chunk: `[TRANSFER, [watched addrs], null]`
  for senders and `[TRANSFER, null, [watched addrs]]` for receivers. "Watched" is the
  registry minus the **dormant tier** (`scripts/registry/measure-dormancy.mjs`, docs/measurements/2026-09-21/dormancy.md): wallets with no USDC/USDT
  transfer in 90 days stay evidence but are not requested. This loses nothing for route
  drawing that an active wallet does not still catch, because a corridor needs an evidenced
  wallet at both ends and deposit sweeps are funded by exchange hot wallets. Measured cost
  for one hour on all three chains before the dormant tier: **4.1 MB down / 2.1 MB up**,
  against roughly 140 MB unfiltered (the upload shrinks with the filter). Do not go back to unfiltered feeds; that was the 29 MB/hour problem.
- A separate small **unfiltered sample** is fetched every 15 minutes (`SAMPLE_MS` in `live-client.ts`) for the honest denominator (`Snapshot.sample`).
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
  | Avalanche | api.avax.network/ext/bc/C/rpc | no (demoted 2026-10-21) | 1,024 over 100 blocks; 1,200 rate-limited 3/3 (HTTP 429) | ~69 KB | **100** on 2026-10-21 (10 earlier that day; 5,000, and 500,000 for the scan, on 2026-09-25). A wider filtered read gets HTTP 200 with -32602 "block range too large". 100 blocks still served 90 days back | echoes origin |
  | Avalanche | avalanche-c-chain-rpc.publicnode.com | yes | 4,800+ | ~323 KB+ | 5,000 (50,000 for the scan) | `*` |
  | Avalanche | avalanche.gateway.tenderly.co | yes (since 2026-10-21) | 4,800+ | ~323 KB+ | 5,000 (**200,000** for the dormancy scan, 90 days back; 500,000 "invalid params") | `*` |
  | Avalanche | avalanche.drpc.org | no (demoted 2026-09-25) | 4,800 over 100 blocks on 2026-10-21 (2,400 on 2026-09-25; 4,800 timed out 1/3, "upgrade to paid plan") | ~323 KB | 100 | `*` |
  | Avalanche | rpc.sentio.xyz/avalanche | measured 2026-10-21, not listed | 4,800+ over 1,000 blocks | ~323 KB+ | 1,000 (1,500: HTTP 429 "public eth_getLogs is limited to 1000 blocks") | echoes origin |
  | Celo | forno.celo.org | measured, not shipped | 1,024 (1,200 failed 2/3) | ~69 KB | 5,000 | `*` |
  | Celo | celo.drpc.org | unusable | "invalid hex string" to the filtered shape | – | none | `*` |
  | Optimism | optimism.gateway.tenderly.co | yes | 4,800+ | ~323 KB+ | 5,000 (**1,000,000** for the dormancy scan) | `*` |
  | Optimism | optimism-rpc.publicnode.com | yes | 4,800+ | ~323 KB+ | 5,000; refuses archive depth without a token | `*` |
  | Optimism | mainnet.optimism.io | yes | 1,000 (1,024 passed 2/3) | ~67 KB | 5,000 (10,000 for the scan) | `*` |
  | Optimism | optimism.drpc.org | no | refuses filtered ranges on the free plan | – | 100 | `*` |
  | Tron | api.trongrid.io/jsonrpc | yes (since 2026-10-06) | 1,000 | ~67 KB | 1,200 in 3.5 s; refuses replies over 10,000 logs; 90 days back answers | `*` |
  | Tron | tron-evm-rpc.publicnode.com | yes (since 2026-10-06) | 1,000 ("exceed max topics: 1000") | ~67 KB | 1,200 in 17 s | `*` |

  Polygon and Avalanche were first measured 2026-09-25, and Polygon and Optimism were re-measured on 2026-10-01
  when they went live (docs/measurements/2026-10-01/). Avalanche was re-measured on 2026-10-21, after
  api.avax.network's cut from 5,000 blocks to 100 had failed every Avalanche chunk (the page read Partial, "3,000
  of 3,000 Avalanche blocks could not be loaded"). Tenderly's Avalanche gateway joined publicnode on the filtered feed
  and returned the same logs over the live chunk. Other keyless Avalanche endpoints tried that day did not qualify:
  1rpc.io/avax/c caps at 50 blocks; avalanche.api.onfinality.io and api.zan.top refuse eth_getLogs without a key
  or under load; rpc.ankr.com/avalanche, avalanche.public-rpc.com, avalanche.blockpi.network and the nodies and
  Blast endpoints are key-gated or retired; avax.meowrpc.com and avalanche.llamarpc.com did not answer. Celo was measured and rejected on activity
  (docs/measurements/2026-09-25/new-chain-candidates.md). Polygon's chunk
  was 100 while drpc had to serve the filtered feed; with Tenderly, publicnode and Sentio serving it, the chunk
  is 1,200 and drpc keeps only the small calls. The Tron rows were measured before Tron went live on 2026-10-06 (docs/measurements/2026-10-06/); the two filtered
  endpoints now serve its feed.

  **The binding caps are 1,000 addresses on Ethereum (drpc) and 997 on Arbitrum (arb1).**
  They now apply to the WATCHED list, not the whole registry (decision D2, docs/DECISIONS-2026-09.md). Every Ethereum plain-account
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
  strikes; hard errors rotate immediately; attempts = max(4, pool size + 1). Since 2026-10-21 a JSON-RPC error to a
  single request (how a node states its own cap, often over HTTP 200) also rotates, so one endpoint lowering its cap
  costs that endpoint and not the chain; when every endpoint refuses, the refusal is the chunk's error and is not
  counted as a lost connection (`replyVerdict` in `live-core.ts`). Failed chunks
  are counted in `missingBlocks` and surface as Partial/Delayed, never swallowed.
- **After a pause** (the computer slept, the browser froze the tab, the network dropped) a feed more than its backfilled
  hour behind re-reads the latest hour instead of crawling through blocks the buffer would prune, and any transfer left
  unpriced makes the next price tick fetch the series again (`nextPollRange`, `refreshPriceGaps`).
- **Observed time** for recorded history comes from `readInterval()`: consecutive reads tile, a read after a gap claims
  none of it. Do not go back to `time(to) - time(from)` per read; on Ethereum that recorded 40% of the time watched.
- **Health states**: LIVE / Backfilling / Partial / Delayed / Reconnecting / Connecting /
  Misconfigured, per chain. The page-level state is decided by cause since 2026-10-18: RECONNECTING,
  DELAYED (a feed behind the tip), LOADING (start-up), PARTIAL (at the tip with blocks missing), NOT CONNECTED, LIVE.
  `registryHealth()` flips the whole page to DELAYED with an explanatory message if more than 25% of the registry has
  expired.
- `LiveSource.dispose()` clears every timer and aborts fetches; `import.meta.hot.dispose`
  is wired so HMR does not start a second backfill.
- Inference (`inferDeposits` in `live-core.ts`) is recomputed from the buffer each cycle
  so it expires with its evidence. It refuses unpriced legs, out-legs to two clusters, no
  external in-leg, sweep-before-receipt, cross-chain matches, and derived anchors.
