# Choosing two new chains — measurements, 2026-09-25

Backlog item "BNB Chain, then Polygon" (HANDOFF section 8, item 3b). Jake approved adding **two** chains,
chosen by measured evidenced-wallet activity rather than by name. BNB Chain was excluded before measuring, on
evidence (decision D4); four issuer-native candidates were then measured and two shipped.

## Why BNB Chain was excluded before any measurement

The allowlist in `lib/atlas/evm.ts` admits a contract only when its own issuer publishes it — Circle's USDC
contract registry or Tether's supported-protocols page, both cited in the methodology panel. On 2026-09-25:

- Circle's registry lists 38 mainnet chains. **BNB Smart Chain is not among them.**
- Tether's supported-protocols page lists **no USDT contract on BNB Smart Chain** (only XAU₮).
- The chain's large stablecoin, `0x55d398326f99059fF775485246999027B3197955`, is **Binance-Peg BSC-USD**,
  **18 decimals**, 1,569 Transfer logs per 20 blocks. It is a Binance liability created by a bridge, and
  integrity rule 3 excludes bridges.

The same rule excludes **Polygon's** widely used USDT `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (bridged via
the Polygon PoS bridge, absent from Tether's list). Polygon therefore ships **USDC only**, as Base does.

## Endpoints, tokens and block times (measured)

Every endpoint below is keyless and answered a filtered `eth_getLogs` with 200 addresses in one topic position
over 100 blocks. CORS is `*` except where noted. Block times measured over 100 blocks.

| Chain | id | slot | blocks/hr | Issuer-native tokens | dec | Transfer logs / 20 blk |
|---|---|---|---|---|---|---|
| Celo | 42220 | 1,000 ms | 3,600 | USDT `0x48065f…` (Tether), USDC `0xcebA93…` (Circle) | 6 | **2,553** / 9 |
| Optimism | 10 | 2,000 ms | 1,800 | USDC `0x0b2C63…` (Circle) | 6 | 432 |
| Polygon PoS | 137 | 1,500 ms | 2,400 | USDC `0x3c499c…` (Circle) | 6 | 382 |
| Avalanche | 43114 | 1,140 ms | 3,157 | USDC `0xB97EF9…` (Circle), USDT `0x970223…` (Tether) | 6 | 3 / 10 |

Every token is 6 decimals, so the backlog's 18-decimal warning applied only to the BNB peg asset.

### Endpoint caps (`scripts/probe-endpoint-caps.mjs`, 3 tries per size)

| Chain | Endpoint | Max topics | Max filtered range | CORS |
|---|---|---|---|---|
| Polygon | polygon-bor-rpc.publicnode.com | 1,000 (1,024 "exceed max topics") | 5,000 | `*` |
| Polygon | polygon.drpc.org | 1,000 | 100 | `*` |
| Avalanche | api.avax.network/ext/bc/C/rpc | 4,800+ | 5,000 | echoes origin |
| Avalanche | avalanche-c-chain-rpc.publicnode.com | 4,800+ | 5,000 | `*` |
| Avalanche | avalanche.drpc.org | 2,400 (4,800 timed out 1/3, "upgrade to paid plan") | 100 | `*` |
| Celo | forno.celo.org | 1,024 (1,200 failed 2/3) | 5,000 | `*` |
| Celo | celo.drpc.org | **unusable** — "invalid hex string" to the filtered shape | none | `*` |
| Optimism | mainnet.optimism.io | 1,000 (1,024 failed 1/3) | 5,000 | `*` |
| Optimism | optimism-rpc.publicnode.com | 4,800+ | 5,000 | `*` |

Also found: **`polygon-rpc.com` is now key-gated** — HTTP 401, "API key disabled, tenant disabled". It is not
listed anywhere in the build.

**Polygon has one usable keyless endpoint, and that is a standing risk.** `polygon-bor-rpc.publicnode.com`
is the only host that serves large filtered reads; `polygon.drpc.org` caps at 100 blocks and
`polygon-rpc.com` is key-gated. Seven alternatives were tried and none worked: `polygon.llamarpc.com`
(dead), `polygon-mainnet.public.blastapi.io` (no response), `1rpc.io/matic` (capped at 50 blocks),
`polygon.blockpi.network/v1/rpc/public` (returns HTML), `polygon-pokt.nodies.app` (network error),
`rpc.therpc.io/polygon` (dead), `polygon.api.onfinality.io/public` (no response). Measured against the
real 763-address filter, publicnode answers a 10,000-block request in about 2.2 s with no errors when
paced at 700 ms between requests. If it ever goes the way of `polygon-rpc.com`, Polygon drops off the map
and there is no free replacement — this is the clearest "free sources are running out" signal on the
board, alongside Tron.

Five script defects were found and fixed by this run:

- `probe-endpoint-caps.mjs` tried the registry's own size first, which is **0** for a chain with no rows yet.
  An empty list in a topic position is not a filter but a match-everything query, so it failed on the
  endpoint's unfiltered result cap and broke the ascending loop, reporting "maxTopics 0" for Celo and Optimism.
  Sizes below one are now skipped.
- `rpc-pool.mjs` had a fixed 60-second timeout. When Polygon's publicnode began **hanging** rather than
  refusing after sustained probing, every timeout was retried per endpoint and multiplied by the caller's
  range-halving, and a two-minute scan stalled past 25 minutes. `ATLAS_RPC_TIMEOUT_MS` now overrides it.
- `measure-dormancy.mjs` permanently halved an endpoint's `maxSpan` on **any** error, a one-way ratchet
  with no recovery. Polygon's load errors name no range, so they were read as "request too big" and the
  span collapsed from 10,000 to 100 blocks: 14,850 queries to cover 16% of the window, heading for an
  eight-hour run. Halving the range is also exactly backwards for a load error, since it doubles the
  number of requests. Only an error that genuinely names a range or size may shrink an endpoint now;
  anything else backs off and retries. With that fixed and the pace at 700 ms, the same scan runs clean
  at 10,000 blocks per request with no errors at all.
- That change had a gap: an **archive refusal** is neither a size problem nor transient. Base's publicnode
  answers "Archive requests require a personal token" in ~50 ms for every block past its free depth, and
  as "unclassified" each of those burned four backed-off retries (~20 s) before falling through to
  `mainnet.base.org`. A scan only moves further back, so that happened on every remaining query: after
  twelve hours Base was 23% done. Archive and pruning replies now retire the endpoint for the rest of the
  run, and the span-growth ceiling ignores retired endpoints so it stops overshooting the survivor's cap.
- `rpc-pool.mjs` relied on `AbortSignal.timeout` alone and `measure-dormancy.mjs` hard-coded a 90 s timeout
  that ignored `ATLAS_RPC_TIMEOUT_MS`. `rpc()` now races the whole request, headers and body, against its own
  timer, and the dormancy scan honours the override (default 45 s).

## The decision: measured evidenced-wallet activity

`screen-activity.mjs` over the **763 Ethereum plain-account rows** in the registry — the candidate set that
derives onto any EVM chain. Values are token units at face value. The floor for admitting a wallet is $100k in
the screening window.

| Chain | Window | Active of 763 | Approx. value | Jurisdictions reached |
|---|---|---|---|---|
| **Avalanche** | 3 days | **19** | **~$150M** | **ZA** (VALR $70M), **TR** (BtcTurk $48M), TW, AR, GI, US, SC |
| **Polygon** | 1 day | **20** | ~$12M | **BR**, **ID**, **AR**, **AU**, TW, CA, GI/MX (Bitso $4.7M), US |
| Optimism | 3 days | 13 | ~$24M | Mostly US (Coinbase, Robinhood, Bitget), AR |
| Celo | 3 days | 3 | ~$0.75M | VG (Bitfinex $745k), AR |

Polygon was screened over one day rather than three because its public endpoint degraded under sustained
querying (above); at 20 active wallets and ~$12M in a single day it outranks Optimism's ~$8M/day on both count
and value, so the shorter window does not change the ordering.

### Chosen: Avalanche and Polygon — Avalanche shipped, Polygon parked

- **Avalanche** carries the most evidenced settlement by a wide margin and reaches exactly the geography the
  2026-09-21 run recorded as blocked by chain rather than by labels: **VALR (South Africa)** and
  **BtcTurk (Türkiye)** alone moved ~$118M in three days.
- **Polygon** has the broadest jurisdictional spread of the four — Brasil Bitcoin (BR), Indodax (ID), Lemon
  Cash (AR), Bitso (Mexico corridor), CoinSpot (AU), MaiCoin (TW), Shakepay (CA) — which is what the South
  America gap needed. India remains Tron-only.

### Polygon parked (2026-09-26)

Polygon passed the activity gate but could not pass decision D2's 90-day dormancy scan on free endpoints.
`polygon-bor-rpc.publicnode.com` prunes history: a binary search put the boundary at about 89,600 blocks
(~37 hours) back, beyond which every request answers "History has been pruned for this block".
`polygon.drpc.org` keeps the full 90 days (verified to 5.18M blocks back) but serves 100 blocks per request,
at ~140 ms each with the full filter, so the scan is ~102,000 requests — about 8 hours, and monthly. Shipping
it unmeasured would upload the full 763-address filter (~52 KB) on every poll, ~19 MB an hour per open tab.
Jake chose to park Polygon rather than accept either cost. Its measured feed config is `PARKED` in
`lib/atlas/feeds.ts`.

Also found while scanning: **Base's publicnode prunes too** — "Archive requests require a personal token" for
anything past roughly the newest 5% of a 90-day window — while `mainnet.base.org` serves the whole range. And
**Avalanche's publicnode** answers a bare "not found" past ~1–3.5M blocks, while `api.avax.network` serves the
full 90 days. The dormancy scan now treats those replies as permanent for the run (see below).

### Rejected

- **Celo** is the instructive one. It is by far the busiest candidate by raw volume — 2,553 USDT Transfer logs
  per 20 blocks, roughly 460,000 transfers an hour, more than Ethereum — and yet only **three** evidenced
  wallets touched it in three days, one of them above the floor. Its traffic is retail peer-to-peer payments
  between wallets with no admissible evidence, not exchange settlement. Ranking candidates by chain volume
  would have picked it first and Avalanche last; ranking by measured evidenced activity does the opposite.
  Worth revisiting only if African exchange operators appear with tagged Celo wallets.
- **Optimism** clears the floor with real activity ($24M/3 days) but is third on value, third on wallet count
  and narrowly US-concentrated. Its endpoint caps are measured and its tokens are issuer-native, so it is the
  cheapest next chain to add if another is wanted.

## Reproducing

```
node scripts/probe-endpoint-caps.mjs <Chain> --tries 3
node scripts/registry/screen-activity.mjs <Chain> <days> <candidates.txt> --out screen-<Chain>.json
```

The candidate list is every `Ethereum:` row in `addresses.txt` whose `kind` is not `contract`. Raw screening
output for all four chains was kept in this session's scratch directory and is summarised above; the rejections
are recorded here so they do not have to be re-derived.
