# API options for growing coverage — researched 2026-09-29

Section 7b of HANDOFF.md says: when free keyless sources run out, report which APIs Jake
should sign up for himself. This is that report. Prices were read from each provider's own
page where it loaded. Rows marked **unverified** could not be confirmed there.

**Any key needs a backend.** The live build is static and keyless, and keys must never ship in
the client bundle. The practical host is the deferred phase-2 backend: Cloudflare Workers
plus D1, running a proxy and cron jobs. The free Worker tier (10 ms CPU, 50 subrequests per
invocation) is too tight for scans, so plan on **Workers Paid at $5/month**.

## Recommended, ranked by coverage per dollar

| # | What | Cost | Unlocks |
|---|---|---|---|
| 1 | **Tronscan API key + TronGrid key** | Free | **Tron**: most USDT settlement, and the only route to India/LatAm/Africa exchanges whose Ethereum wallets are idle. Tronscan's `accountv2` returns `publicTag`, Tron's own-explorer name tag. **Decision for Jake:** admit Tronscan as Tron's explorer under rule 1. TronGrid free is about 100K requests/day at 15 QPS (partly unverified). |
| 2 | **Infura free** (Alchemy pay-as-you-go as fallback) | Free (Alchemy $0.525 per 1M CU) | **Un-parks Polygon.** Archive on all plans, no block-count cap on getLogs (10K-result and 10 s caps), 3M credits/day. That covers Brasil Bitcoin, Indodax and the Mexico corridor. Alchemy free caps getLogs at 10 blocks and is useless for scans; PAYG is unlimited. |
| 3 | **Helius** | Free; Developer $49 | **Solana USDC.** Free gives 1M credits/month at 10 RPS. Developer adds `getTransactionsForAddress`. |
| 4 | **Blockscout PRO API** | Free (100K credits/day) | Name-tag and CEX metadata on 100+ chains from one key: a **lead feed** that replaces manual search sweeps. Tags are Blockscout's, so each lead is still confirmed on its own Etherscan-family page. |
| 5 | **Solscan Pro Level 2** | $199/mo | Solana's own-explorer `account_label` and `account_tags`. Take it only after Helius shows Solana is worth labelling. |
| – | **Cloudflare Workers Paid** | $5/mo | Required host for all of the above. |

## Free options (full list)

| Provider | Free limits | Use here |
|---|---|---|
| Tronscan | Key mandatory since 2025-08; quota unverified | Tron name tags |
| TronGrid | ~100K req/day, 15 QPS, 3 keys | Tron TRC-20 transfers |
| Helius | 1M credits/mo, 10 RPS | Solana |
| Infura | 3M credits/day, archive | Polygon archive, EVM backup |
| Alchemy | 30M CU/mo; getLogs 10 blocks | Not for scans |
| Ankr Freemium | 200M credits/mo; getLogs 100 blocks | Backup EVM/Tron |
| Chainstack Developer | 3M RU/mo; no archive | Not for scans |
| Etherscan API V2 | 3/s, 100K/day; ETH, Arbitrum, Polygon only; no nametags; non-commercial | Per-address history |
| Blockscout PRO | 100K credits/day | Tag leads |
| Chainalysis sanctions API | Free key | Sanctions flag only |
| Nansen, Dune, Allium | Token free tiers | Leads only; Dune free has no API export |

## Paid options

| Provider | Plan | $/mo | Notes |
|---|---|---|---|
| Etherscan | Lite | $49 | Adds Base and Snowscan to V2. No nametags. |
| Etherscan | Pro Plus | $899 | Only tier with the `getaddresstag` nametag API. The terms forbid redistribution without written approval, so it is poor value for a public map. |
| Helius | Developer | $49 | Solana per-wallet history |
| QuickNode | Build | $49 | EVM/Solana/Tron archive; getLogs 10K blocks |
| Chainstack | Growth | $49 | getLogs 10K blocks; Tron has no archive |
| Infura | Developer | $50 | More Polygon headroom |
| NodeReal | Growth | $31 | EVM archive |
| Ankr | Premium PAYG | $10 minimum deposit | About $20 per 1M calls; getLogs 1,000 blocks |
| dRPC | PAYG | ~$6 per 1M requests | Range cap unverified |
| Bitquery | Pro + Labels | ~$158 | Leads only |
| Nansen | Pro | $49–69 | About $1 per label lookup; leads only |
| Arkham, OKLink, Breadcrumbs | – | unverified | Leads only |

Blast API shut down on 2025-10-31. Helius pricing changed on 2026-09-24 and its pages
disagree on archival credit cost, so re-check it before budgeting.

## Sources

- https://docs.tronscan.org/api-endpoints/account
- https://www.trongrid.io/price
- https://www.helius.dev/pricing
- https://www.infura.io/pricing
- https://docs.infura.io/networks/ethereum/json-rpc-methods/eth_getlogs
- https://www.alchemy.com/pricing
- https://www.alchemy.com/docs/reference/eth-getlogs
- https://www.ankr.com/docs/rpc-service/service-plans/
- https://chainstack.com/pricing/
- https://www.quicknode.com/pricing
- https://etherscan.io/apis
- https://etherscan.io/apiterms
- https://docs.etherscan.io/api-reference/endpoint/getaddresstag
- https://docs.blockscout.com/rate-limits
- https://docs.blockscout.com/devs/metadata-service
- https://pro-api.solscan.io/pro-api-docs/v2.0/reference/v2-account-metadata.md
- https://nodereal.io/pricing
- https://bitquery.io/pricing
- https://docs.nansen.ai/getting-started/credits
- https://docs.dune.com/api-reference/overview/billing
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
