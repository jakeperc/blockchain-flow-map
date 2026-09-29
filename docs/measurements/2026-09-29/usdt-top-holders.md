# Etherscan USDT top-1000 holders — 2026-09-29

## Method

Jake exported Etherscan's top-holders list for Ethereum USDT
(`0xdac17f958d2ee523a2206206994597c13d831ec7`) himself, as ten CSV files covering ranks 1–1,000.
The export's `Address_Nametag` column is a **lead only**. Every admitted address was then read on
its own Etherscan page with `read-tag.mjs`, as rule 1 requires.

| Step | Count |
| --- | ---: |
| Holders | 1,000 |
| With a name tag | 169 |
| Already first-party Ethereum rows | 50 |
| Tagged wallets of registered entities, not yet registered | 12 |
| Active in 7 days | 6 |
| Admitted (all above the $100k floor, own-page tag confirmed) | 6 |

The other 107 tags were not screened. They fall into three groups:

- **Not wallets:** DeFi pools and tokens, bridges, Tether: Treasury, Binance-Peg, U.S. Gov confiscated
  funds, "Gate Dep" deposit addresses and multisigs.
- **Brands excluded by rule:** Bybit, Crypto.com, Bitstamp, Ceffu, Cobo, BitGo, Copper, Galaxy Digital,
  Cumberland and Jump Trading, under the operator test or disputed jurisdiction.
- **Unregistered offshore exchanges and trading firms:** BitMEX, BingX, Deribit, CoinEx, Phemex,
  CoinList, Remitano and DWF Labs.

Idle and not admitted: Binance 124 (~1B USDT held, no transfer in 7 days), Binance 117, MEXC 25, and
KuCoin 47, 52 and 67. Large balances do not mean activity; these are reserve wallets.

## Admitted rows

| Entity | Address and own-page tag | Rank | 7-day activity (face value) |
| --- | --- | ---: | ---: |
| OKX | [OKX: Cold Wallet 2](https://etherscan.io/address/0xccdcfc4598f539408fc0393b42905c1e0d24a91e) | 20 | $266.9M |
| MEXC | [MEXC 22](https://etherscan.io/address/0xc411ab12837f63935b71b6c6643d0f7000e55e4b) | 42 | $100.0M |
| Upbit (Korea) | [Upbit 58](https://etherscan.io/address/0x1d791f12bb6808dc08ab365e2ec8913273c00193) | 165 | $43.2M over 245 transfers |
| KuCoin | [KuCoin 66](https://etherscan.io/address/0xe8c15aad9d4cd3f59c9dfa18828b91a8b2c49596) | 370 | $25.5M |
| KuCoin | [KuCoin 54](https://etherscan.io/address/0x5b234aaab0f61d346a3ef8faca474c1c19f80c1f) | 58 | $12.0M |
| Bitget | [Bitget 23](https://etherscan.io/address/0x59708733fbbf64378d9293ec56b977c011a08fd2) | 466 | $2.6M |

Activity values prioritise research only. They are not mapped settlement. These rows are watched by
default until the next dormancy measurement, and no corridor change is claimed without a
matched-window replay.

**Worth repeating:** this export found six active wallets in one pass, after the search-based
sweeps had found two. The USDC top holders (`0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`) and the
L2/Avalanche holder lists have not been exported yet.
