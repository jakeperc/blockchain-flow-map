# Public-post wallet leads and Avalanche additions — 2026-09-29

## Method

Jake asked for one more sweep of sites not used before, including public posts about
USDT/USDC flows. A research agent (WebSearch/WebFetch only) tried Whale Alert, Lookonchain,
Spot On Chain, Arkham posts, news coverage, DefiLlama CEX adapters, the Dune spellbook
CEX address tables, and the `brianleect/etherscan-labels` GitHub scrape.

- **Posts and news gave no usable addresses.** Whale Alert, Lookonchain and Arkham posts
  name entities but either omit addresses or render them in JavaScript. DefiLlama's CEX
  adapters have moved (404) and its CEX pages return 403. The Dune spellbook file is too
  large for a summarising fetch.
- **Productive routes:** search-engine-indexed explorer pages (the title carries the tag)
  and the `etherscan-labels` scrape. Both are compilations, so they are leads only.

In total, 122 leads named entities already in the registry. Leads for brands excluded by
the operator test or by disputed jurisdiction were dropped unscreened: Bybit, Bitstamp,
Luno, WazirX, Revolut, LBank, XT.com, BingX, Bitrue, ChangeNOW and SideShift. Deposit, funder,
contract, "internal" and exploiter tags were dropped too.

| Step | Count |
| --- | ---: |
| Leads for registered entities | 122 |
| Already first-party in the registry (same chain) | 96 |
| New candidates screened (Ethereum 7 days, Avalanche 3 days) | 26 |
| Active | 4 |
| Above the $100k floor | 2 |
| Admitted after reading their own Snowscan page | 2 |

The high overlap (96 of 122) is independent confirmation that the explorer tags on these
chains have been well mined. The 18 new Ethereum candidates were idle except Bitvavo hot 2
(~$18k out) and CoinDCX 4 (~$2k in), both below the floor.

## Admitted rows

| Entity | Address and own-page tag | Three-day activity | Change |
| --- | --- | ---: | --- |
| Binance (Cayman Islands) | [Binance 49](https://snowscan.xyz/address/0x9f8c163cba728e99993abe7495f06c0a3c8ac8b9) | $73.7M (in $33.6M / out $40.0M) | New wallet |
| Bitfinex (BVI) | [Bitfinex: Hot Wallet](https://snowscan.xyz/address/0x77134cbc06cb00b66f4c7e623d5fdbf6777635ec) | $21.4M | Derived → first-party |

Activity is incoming plus outgoing face value, used only to prioritise. It is not mapped
settlement. Binance 49 was added after the 2026-09-28 dormancy measurement, so it is
watched by default until the next scan.

## Not pursued

Idle Avalanche leads were already derived: Upbit hot 1, Robinhood, Coinbase 33/44 and two
Binance tags. The only Polygon leads were Bitkub hot 6 and Robinhood; Polygon is parked.
No Tron or Solana addresses were found.

Etherscan's USDT top-holders page was considered as a lead source. It is a page for people rather than for
scripts, so it was not read by script; Jake exported it himself (see `usdt-top-holders.md`).
