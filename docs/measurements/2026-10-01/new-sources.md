# New keyless sources and a lead-feed wallet wave — 2026-10-01

Jake asked for more API sources and more wallets. Everything below was measured with keyless
public endpoints on 2026-10-01. Nothing here needs an account, a key or a server.

## 1. Polygon no longer needs a key: Tenderly's public gateway serves the archive

Polygon was parked on 2026-09-26 because the 90-day dormancy scan (decision D2) did not fit on the
two keyless endpoints known then: `polygon-bor-rpc.publicnode.com` prunes past ~37 hours and
`polygon.drpc.org` serves 100 blocks per request. The API plan's answer was an Infura key.

Twenty keyless Polygon endpoints were probed with a filtered `eth_getLogs` at the head and at 2, 30
and 90 days back. Four serve the full 90 days:

| Endpoint | 90 days back | Largest span that passed | CORS | Notes |
|---|---|---|---|---|
| `polygon.gateway.tenderly.co` | yes | **200,000** blocks (13,567 logs in 0.7 s); 1,000,000 answers "invalid params" | `*` | 1,000 topics (1,024 "not supported") |
| `rpc.sentio.xyz/matic` | yes | 10,000 ("exceeds the limit 10000") | echoes origin | 4,800+ topics |
| `rpc-mainnet.matic.quiknode.pro` | yes | 2,000 (10,000 timed out at 20 s) | echoes origin | Slow; not used |
| `137.rpc.thirdweb.com` | yes | 1,000 | `*` | Not used |

**Cross-check against the reference.** With the real registry filter (765 addresses), Tenderly,
Sentio, QuickNode and thirdweb each returned **the same logs** (same transaction hash and log index
set) as `polygon.drpc.org` for an unfiltered 3-block read and for both filtered directions over 100
blocks, at 1 hour, 3 days, 45 days and 89 days back.

Dead, gated or useless on 2026-10-01: `polygon.lava.build` (HTTP 410), `polygon.rpc.subquery.network`,
`polygon.meowrpc.com`, `polygon.public-rpc.com`, `polygon.rpc.grove.city` (no response),
`polygon-public.nodies.app` (403, paid), `api.zan.top` (getLogs needs an account),
`polygon-mainnet.gateway.tatum.io` (5 requests a minute), `endpoints.omniatech.io` (521),
`polygon.api.pocket.network` (404), `*.rpc.hypersync.xyz` (401), `polygon.blockscout.com/api/eth-rpc`
(error with no message).

Consequences, all built today:

- The 90-day scan took 64 queries (774 addresses, 38 active) instead of ~102,000 at 100 blocks.
- The live feed's chunk is 1,200 blocks instead of 100, because drpc no longer has to be able to
  serve the filtered query. drpc keeps the small calls.
- Polygon is switched on. The Infura step in `docs/API-PLAN.md` is no longer needed.

`probe-endpoint-caps.mjs Polygon --tries 3`: Tenderly 1,000 topics / 5,000 range; publicnode 1,000 /
5,000; Sentio 4,800+ / 5,000; drpc 1,000 / 100.

## 2. Which other chain is worth adding: measured again, twelve candidates

Token contracts were re-read from Circle's USDC registry and Tether's supported-protocols page.
`scripts/screen-candidate-chain.mjs` (new) screened the 765 Ethereum plain-account wallets, the set
that would derive onto any EVM chain, for three days of issuer-native USDC or USDT on each candidate.
No query failed on any chain.

| Chain | Token | Active of 765 | Over $100k | Face value, 3 days | Who |
|---|---|---|---|---|---|
| **Polygon** | USDC | **23** | **17** | **$66.4M** | Bitso $29.9M, Coinbase $22.7M, Wintermute, MEXC, Robinhood, Paxos, Lemon Cash, Brasil Bitcoin, CoinSpot, Bitget, MaiCoin, Shakepay, Indodax |
| **Optimism** | USDC | 12 | 6 | $27.6M | Coinbase $26.1M, Bitget, Robinhood, MEXC, Bitpanda, Lemon Cash |
| Sonic | USDC | 3 | 1 | $2.4M | One Bitget transfer of $2.3M |
| Morph | USDC | 2 | 1 | $1.4M | Bitget 6 |
| Kaia | USDT | 1 | 1 | $152k | Bitfinex hot wallet |
| World Chain | USDC | 1 | 0 | $2k | Lemon Cash |
| Linea, Unichain, ZKsync Era, Ink, Plasma, Cronos | USDC | 0 | 0 | 0 | – |
| Kava (1 day) | USDT | 0 | 0 | 0 | – |

Not screened: X Layer and Monad cap `eth_getLogs` at 100 blocks, HyperEVM rate-limits the filtered
shape, Sei's public node was saturated, XDC timed out above 1,000 blocks. None has an obvious
evidenced-exchange constituency, so they were not chased.

**Decision.** Polygon and Optimism were added together. A new chain re-locks
the 24H and 7D windows for every visitor, so chains should be added in one wave. Optimism was third
on 2026-09-25 and is second now; its caps were already measured and its dormancy scan took 22
queries on Tenderly (up to 1,000,000 blocks each; `mainnet.optimism.io` caps at 10,000 and
`optimism-rpc.publicnode.com` refuses archive depth without a token). Every other candidate is
rejected on activity. Do not re-screen them without a reason: the same lesson as Celo.

`probe-endpoint-caps.mjs Optimism --tries 3`: Tenderly 4,800+ topics / 5,000 range; publicnode 4,800+
/ 5,000; `mainnet.optimism.io` 1,000 (1,024 passed 2 of 3) / 5,000; drpc refuses filtered ranges on
its free plan.

Optimistic Etherscan answers 403 on address pages, like Arbiscan. Its `/txs?a=` page header carries
the same public name tag, so `read-tag.mjs` now uses that route for both.

## 3. Tron's live feed needs no key and no Worker

The project notes and the API plan said Tron needs a TronGrid key and therefore a proxy. Measured today:

| Endpoint | CORS | Filtered `eth_getLogs` (USDT, 1,000 addresses in a topic position) |
|---|---|---|
| `api.trongrid.io/jsonrpc` | `*` | 1,200 blocks (one hour) in 3.5 s; 30 requests at 250 ms spacing all passed; 90 days back answers; refuses a reply over 10,000 logs |
| `tron-evm-rpc.publicnode.com` | `*` | 1,200 blocks in 17 s; 1,000 topics max ("exceed max topics: 1000") |
| `tron-rpc.publicnode.com/jsonrpc` | `*` | Same node family; 5,000 blocks passed |
| `tron.api.pocket.network` | echoes origin | Erratic ("request is too complex/large" at 50 addresses, then passed 1,000) |
| `tron.drpc.org`, `rpc.ankr.com/tron_jsonrpc` | – | 500 / 403 |

The replies are ordinary EVM-shaped logs. Addresses are the 20-byte form of the base58 address, and
USDT `TR7NHq…Lj6t` is `0xa614f803b6fd780986a42c78ec9c7f77e6ded13c`. Blocks are 3 seconds.

**How much evidenced flow is there?** The Dune spellbook's Tron table (a lead compilation, not
evidence) lists 69 addresses for brands already in the registry. Over one day on keyless TronGrid,
with no failed query, **17 of them moved $3.70B of USDT**: Binance $3.06B, Bitfinex $311M, KuCoin
$237M, MEXC $57M, Bitso $30M, Lemon Cash $1.9M, CoinDCX $5k. Raw rows: `tron-lead-screen.json`. For
scale, the Polygon screen above is $66M in three days.

What still stands between this and a Tron feed:

1. **Evidence.** Decision D6 admits Tronscan's own name tags. Tronscan's `accountv2` API answers 401
   without a key, and tronscan.org address pages sit behind a bot challenge, which must not be
   bypassed. So Jake needs one **free Tronscan API key**, used offline by the research scripts only.
   It never ships and needs no server.
2. **Volume.** One Binance lead wallet made 145,628 USDT transfers in a day. A filtered Tron feed
   would download several times what the other chains do together. That needs a design choice before
   any build: watch fewer wallets, or accept the bandwidth.
3. **Build.** Tron is not an EVM chain in the model (it must never derive), and the registry needs
   base58 keys alongside the hex topics.

India is still not solved by this: CoinDCX's lead wallets moved $5k.

## 4. Wallet wave: the Dune spellbook as a lead feed

`cex_evms_addresses.sql` in `duneanalytics/spellbook` was named on 2026-09-29 as an unread lead
compilation. It was read today from GitHub. It is a compilation, so every hit is a lead only.

| Step | Count |
|---|---:|
| Addresses in the table | 4,957 |
| For brands already in the registry (60 Dune brand names, 59 of 64 entities) | 2,516 |
| Not yet in the registry | 1,724 |
| After dropping deposit, funder, deployer, token, fee and staking titles | 1,538 |
| Active on Ethereum (7 days) / Base (7) / Arbitrum (3) / Avalanche (3) / Polygon (3) / Optimism (3) | 10 / 3 / 4 / 10 / 7 / 2 |
| At or above the $100k floor (address and chain pairs) | 25 |
| Admitted after reading the address's own explorer page | **22 rows** |

No screen query failed. Raw results: `dune-leads-activity.json`. Leads for brands outside the
registry (Bybit, HTX, Crypto.com, Bitstamp, Gate.io, Nexo and the rest) were not screened; those
brands are excluded by the operator test or by disputed jurisdiction.

The tag families already in the registry (104 of them) were also walked with
`label-scan.mjs --expand` on Polygonscan (2,228 tags) and Optimistic Etherscan (2,269 tags). All but
61 of the unregistered hits were already in the Dune candidate set, and those 61 were idle.

### Admitted (tag verbatim from the address's own explorer page, read 2026-10-01)

| Chain | Tag | Entity | Window activity |
|---|---|---|---:|
| Ethereum | KuCoin 65 | KuCoin | $11.1M / 7 d |
| Ethereum | HashKey Exchange 11 | HashKey Exchange | $2.0M / 7 d |
| Ethereum | HashKey Exchange 5 | HashKey Exchange | $768k / 7 d |
| Ethereum | Coins.ph 1 | Coins.ph | idle on Ethereum; $21.8M / 3 d on Arbitrum, where it derives |
| Avalanche | OKX 179 | OKX | $59.9M / 3 d |
| Avalanche | Binance 113, 118, 85, 109, 110 | Binance | $15.7M, $14.9M, $13.7M, $12.2M, $10.3M / 3 d |
| Avalanche | KuCoin 32 | KuCoin | $4.2M / 3 d |
| Avalanche | OKX 190 | OKX | $1.2M / 3 d |
| Avalanche | CoinSpot 23 | CoinSpot | $161k / 3 d |
| Base | OKX 234 | OKX | $43.5M / 7 d |
| Base | Upbit 59 | Upbit | $359k received / 7 d |
| Arbitrum | Bitkub 7 | Bitkub | $341k / 3 d |
| Polygon | Coinbase 7, Coinbase 6 | Coinbase | $45.3M, $4.8M / 3 d |
| Polygon | KuCoin 29 | KuCoin | $8.8M / 3 d |
| Polygon | Bitkub 24 | Bitkub | $300k / 3 d |
| Polygon | Bitpanda 11 | Bitpanda | $185k / 3 d |
| Polygon | Upbit 59 | Upbit | $147k received / 3 d |

Explorers number the same wallet differently per chain (Dune's "OKX 164" is "OKX 179" on Snowscan),
which is why the stored label is always the one on the row's own explorer.

KuCoin 65 (Ethereum) and OKX 234 (Base) are upgradeable-proxy contract wallets, not plain accounts.
They are first-party rows on their own chain and never derive.

### First-party rows for wallets that would otherwise be derived

Active derived wallets on the two new chains were read on their own explorer pages, so they can
anchor deposit inference there.

- **Polygon (14):** Bitso 1 ($29.9M), Coinbase 39, 30, 16 and 41 ($7.0M, $6.0M, $5.6M, $4.1M),
  MEXC 11 and 8 ($2.1M, $2.0M), Paxos 4 ($951k), Robinhood 5 ($586k), Lemon Cash 8 ($550k),
  Brasil Bitcoin 1 ($435k), CoinSpot 7 ($181k), Bitget 6 ($158k), MaiCoin 1 ($136k).
- **Optimism (6):** Coinbase 11, 18 and 34 ($19.1M, $6.2M, $821k), Bitget 35 ($1.0M), MEXC 7
  ($168k), Robinhood 5 ($120k).

Wintermute 5, Wintermute 4 and Robinhood 9 have no tag on Polygonscan and stay derived there.

### Rejected, with reasons (do not re-research)

- **`0xffe15ff5…a779ae`, $231M in 7 days on Ethereum.** Etherscan's tag is "HashKey 2", not
  "HashKey Exchange". The group also runs HashKey Global (Bermuda) and other affiliates, so a
  brand-level tag cannot be assigned to the Hong Kong operator. Dune calling it "HashKey Exchange 1"
  is a compilation, not evidence.
- **`0xd91efec7…950747`, $80.6M in 7 days.** Tag "KuCoin: ERC-20 Batch Transfer": a distribution
  contract, which rule 3 treats as plumbing.
- **Bitfinex Tether Treasury.** An issuer treasury, excluded by rule 3.
- **Arbitrum `0x4577f1a9…b3225c`.** Arbiscan's tag reads "Coins.p", a truncation. Etherscan tags the
  same key "Coins.ph 1", so the Ethereum row was written and Arbitrum takes it as derived evidence.
  No first-party Arbitrum row was written on a tag that needs interpreting.
- **KuCoin 26 on Optimism** ($98k in 3 days): under the floor.

## Reproducing

```
node scripts/screen-candidate-chain.mjs <Chain> 3 --out screen.json
node scripts/probe-endpoint-caps.mjs <Polygon|Optimism> --tries 3
node scripts/registry/screen-activity.mjs <Chain> <days> <candidates.txt>
node scripts/registry/read-tag.mjs <explorer host> <address>...
```

The endpoint probes for sections 1 and 3 were one-off scratch scripts; their results are the tables
above. Chain screens are in `chain-screen-*.json`.
