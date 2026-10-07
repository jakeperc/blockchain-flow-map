# Tronscan tags for the Tron lead wallets (2026-10-06)

Jake supplied the free Tronscan API key (`TRONSCAN_API_KEY` in `.env.local`, ignored by Git). Under decision D6,
Tronscan's own `publicTag` counts as admissible evidence for Tron, the same way an Etherscan-family tag does. The key is
used offline by `read-tag.mjs` and never ships.

## Tooling

- `scripts/registry/tag-reader.mjs` now accepts `tronscan.org`. tronscan.org pages sit behind a bot challenge, so the reader
  uses `apilist.tronscanapi.com/api/accountv2?address=` with the `TRON-PRO-API-KEY` header. It loads `.env.local` itself
  when the variable is not already set. Any non-200 reply stops the run, the same as for the other explorers.
- Only `publicTag` is returned as the tag. `redTag` and `greyTag` are risk flags: they are printed as explorer alerts and
  never admit a wallet (D6).
- `read-tag.mjs tronscan.org <T…>…` accepts base58 addresses and prints them unchanged. Tron addresses are case-sensitive,
  so they are not lowercased.

## Result

The input was the 17 Dune lead wallets that moved USDT in the one-day keyless TronGrid screen
(`../2026-10-01/tron-lead-screen.json`). Read at 2026-10-07 UTC, the date `read-tag.mjs` prints, at its 2.5 s pace, with
no blocks. No red or grey tags appeared.

| Address | Dune lead name | Tronscan `publicTag` | USDT moved, 1 day | Transfers |
|---|---|---|---|---|
| TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf | Binance 10 | **Binance-Hot 7** | $2,045.5M | 145,628 |
| TAzsQ9Gx8eqFNFSKbeXrbi45CuVPHzA8wr | Binance 6 | **Binance-Hot 5** | $288.0M | 17,574 |
| TXFBqBbqJommqZf7BV8NNYzePh97UmJodJ | Bitfinex 3 | **Bitfinex** | $286.4M | 573 |
| TUpHuDkiCCmwaTZBHZvQdwWzGNm5t8J2b9 | KuCoin 4 | **Kucoin 4** | $222.1M | 13,219 |
| TQrY8tryqsYVCYS3MFbtffiPp2ccyn4STm | Binance 7 | **Binance 2** | $183.6M | 17,811 |
| TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G | Binance 8 | **Binance-Hot 4** | $179.2M | 17,758 |
| TJDENsfBJs4RFETt1X1W8wMDc8M5XnJhCe | Binance 5 | **Binance-Hot 6** | $173.2M | 16,878 |
| TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS | Binance 9 | **Binance-Hot 3** | $159.1M | 15,783 |
| TEPSrSYPDSQ7yXpMFPq91Fb1QEWpMkRGfn | MEXC 1 | **MXC** | $57.1M | 22,140 |
| TJy2LR9FFrP7ZQw99CRfHeiFCG2RZUasGF | Bitso 1 | no name tag | $30.3M | 999 |
| TVGDpgtCs45PJE7ZMHhiC76L3v77qAwJW9 | Binance 16 | no name tag | $30.0M | 1 |
| TMhJviFWiaxvqKLdng9dmsi1H5H5yTGEeu | Bitfinex 4 | no name tag | $24.8M | 12 |
| TQeNNo5zVarhdKm5EiJSekfNXg6H1tRN4n | KuCoin 2 | no name tag | $15.0M | 1 |
| TE7RYLrzMFQ73CAmpMq5EUfqa1nj8ZxBq7 | Lemon Cash 5 | no name tag | $0.7M | 611 |
| TLb8A3T4PvmNtVsZtKW9E1z2JxojnGdcVP | Lemon Cash 3 | no name tag | $0.6M | 730 |
| TJwH7ToejXwPP4ro9BwdXzHReza95bDLTh | Lemon Cash 4 | no name tag | $0.6M | 10 |
| TU7BbAsb8t371eMijQeiGXsiLvY1vZbsFs | CoinDCX 2 | no name tag | $0.0M | 7 |

**Nine of the 17 carry a Tronscan tag. Those nine moved $3.59B of the screen's $3.70B (97%)**: Binance six wallets,
then Bitfinex, KuCoin and MEXC one each. The other eight are not admissible and must not be added. They include
every Latin American and Indian lead (Bitso, Lemon Cash, CoinDCX), so Tron does not yet help those corridors.

Notes for admission:

- The Dune numbering does not match Tronscan's: Dune's "Binance 10" is Tronscan's "Binance-Hot 7". The registry `label`
  must be the Tronscan tag verbatim, as for every other chain.
- "MXC" was MEXC's earlier brand name. Tying the tag to the registered MEXC entity needs the same brand check used
  elsewhere (rule 3) before admission.
- "Bitfinex" is a bare brand-level tag. Section 17 rejected "HashKey 2" as brand-level. Check rule 3 before treating
  this one differently.
- "Binance-Hot 7" made 145,628 USDT transfers in a day. That number is the bandwidth question below.

## What still blocks a Tron feed

1. **Bandwidth (Jake's decision).** Watching the nine tagged wallets means downloading roughly 270,000 transfer logs a
   day, about 220,000 of them from three Binance hot wallets. The choice is between watching fewer wallets (for example
   leaving out Binance-Hot 7) and accepting the download cost for visitors.
2. **Model work.** Tron must not join `EVM_CHAINS`, because it must never derive. The registry needs base58 keys next to the
   20-byte hex topic form. The feed goes into `feeds.ts` on `api.trongrid.io/jsonrpc`, and USDT `TR7NHq…Lj6t` is
   `0xa614f803b6fd780986a42c78ec9c7f77e6ded13c`.
3. **Lead supply.** Only 69 Dune leads exist for registered brands. A wider Tron lead list (Tronscan's tagged-account
   search, holder lists) is the next research step once the feed design is settled.

## Bandwidth, measured (2026-10-06, later)

This measured one hour (1,200 blocks) of the filtered feed for all nine tagged wallets: sent by them and received by them,
USDT only.

| Endpoint | Logs | On the wire | Time | Compression |
|---|---|---|---|---|
| `api.trongrid.io/jsonrpc` (200-block chunks) | 8,323 | 5.29 MB | – | none (no `Content-Encoding`) |
| `tron-evm-rpc.publicnode.com` (one request per side) | 8,437 | **0.67 MB** | **4.4 s** | brotli |

Each log is about 635 bytes uncompressed. Binance-Hot 7 (3,629) and MXC (2,002) made two-thirds of the hour's logs.
**None of the 8,323 TronGrid logs ran between two watched wallets**, so Tron corridors depend on deposit inference, not
on direct wallet-to-wallet transfers. On 2026-10-01 publicnode needed 17 s for the same span, so its speed varies.
TronGrid stays the fallback.

**Conclusion:** with publicnode as the primary endpoint, watching all nine wallets costs about 0.7 MB per visitor-hour.
That makes the bandwidth decision much smaller than it looked: no wallet needs to be dropped. All four brands are offshore
(Binance KY, Bitfinex VG, KuCoin SC, MEXC SC), so this flow lands mostly as one-sided, unplaced flow on those
jurisdictions until local-exchange Tron wallets are found.

## Research wave and go-live (2026-10-06 evening, reads dated 2026-10-07 UTC)

Jake's decisions: count "MXC" tags as MEXC with a note on each row; allow up to about 2 MB per visitor-hour; registered
brands only tonight. Raw data: `tron-screen.json` (per-address screen, rejections, unregistered leads).

**Leads (never evidence).** There were two Tronscan API sources, each paced at 450 ms, with no block:
- `api/search/v2?term=<brand>&type=address`, one page of 50, for each of the 64 registered entity names plus the
  aliases MXC, Kucoin, OKEx, "Upbit Exchange", Paxos and itBit. A second page is refused with HTTP 400, so only the
  first page was read.
- `api/token_trc20/holders` for USDT, walked to its 10,000-row end.

Only the `address_tag` / `addressTag` field was used. The account `name` field is set by the owner and was ignored.
Result: 90 tagged addresses.
- **67 name a registered brand.**
- **4 were rejected:**
  - Tether Treasury: issuer treasury, rule 3.
  - "Bithumb Global": BitGlobal, a separate company from Bithumb Korea.
  - "Poloniex Deposit": deposit plumbing.
  - "Paribu Exchange Deposit Funder": a funder.
- **19 name unregistered brands.** They wait for D3 operator research:
  - Bybit ($66.4M held), Gate ($14.4M), OURBIT, Well Wallet, Cobo Custody, FixedFloat, Flipster, Swapster, VIR8 and UEEx.
  - MaskEX hot wallets 16 to 23.
  - "SunX: VaultColdWallet 2" is a protocol vault and would be refused anyway.

**Activity screen.**
- Method: a filtered pass over USDT logs on keyless publicnode, falling back to TronGrid. Both directions, non-zero
  transfers only, with no failed query (101 queries over day 1, 96 for days 2-3, 96 for days 4-7).
- Floor: $100k, the working admission floor. Wallets under it after one day were re-screened over 3 days, then over 7
  (the Ethereum window).
- **21 passed:** 20 within 3 days, plus Bithumb's hot wallet ($21.2M over 7 days; its last transfer was on 2026-10-02,
  confirmed independently through TronGrid's account history).
- **The other 46 moved nothing in 7 days.** They include every "Okex 1-7", Upbit, Paribu, BtcTurk, Korbit, Indodax,
  CoinSpot, Bitpanda and Poloniex tag, older KuCoin and Bitget numbers, and Binance cold wallets.

**Admission read.** All 21 were read through `read-tag.mjs tronscan.org`. Every `publicTag` matched the lead tag
verbatim, every account is normal (`accountType` 0), and none carries a red or grey tag.

| Entity (jurisdiction) | Rows | Tags | Largest |
|---|---|---|---|
| Binance (KY) | 10 | Binance-Hot 3–11, Binance 2 | Binance-Hot 7, $1.84B in a day, 138,491 transfers |
| OKX (SC) | 1 | OKX Hot Wallet 8 | $814M in a day, 131,073 transfers |
| Kraken (US) | 1 | Kraken: Hot Wallet | $353M in a day |
| Bitfinex (VG) | 1 | Bitfinex | $202M in a day |
| KuCoin (SC) | 2 | Kucoin 4, KuCoin 10 | $192M in a day |
| Bitget (SC) | 1 | Bitget 9 | $106M in a day |
| MEXC (SC) | 2 | MXC, MXC 2 | $57M in a day |
| Coinone (KR) | 1 | Coinone | $24M in a day |
| Bithumb (KR) | 1 | Bithumb Exchange Hot Wallet | $21M in 7 days |
| Coins.ph (PH) | 1 | coins.ph | $16M in a day |

The bare "Bitfinex" tag follows the Ethereum precedent: Bitfinex has one registered operator (iFinex), unlike "HashKey 2".

**Bandwidth of the final filter.** One hour of all 21 wallets in the live request shape (600-block chunks, sent and
received, publicnode): **15,773 logs, 1.24 MB on the wire**, inside the 2 MB budget. The largest single reply was
4,301 logs, well under the 10,000-log cap.

**Dormancy.** Measured over 90 days with the new Tron path in `measure-dormancy.mjs`: 21 of 21 active, no failed
query.

**In the browser** (dev server, first hour):
- Tron is LIVE in Chain health, and only Solana says Not connected.
- With the filter on Tron alone: $198M observed on evidenced wallets, $12.15M geographically attributed, and 16
  corridors.
- The top corridor is KY→SC at $6.14M. It is Binance-Hot 8 paying a deposit address that inference attributes to OKX.
- Addresses display in base58, and the Tronscan transaction links carry bare hashes.

Still not reached: India (CoinDCX) and Latin America (Bitso, Lemon Cash, Mercado Bitcoin). Tronscan search found no
tagged Tron wallet for them.
