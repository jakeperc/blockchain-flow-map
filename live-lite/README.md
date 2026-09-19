# Ledger Atlas · Live (static, backend-free build)

The full Ledger Atlas interface — the Three.js Equal Earth map, corridor panels, evidence inspector,
playback, the lot — built as plain static files with an **in-browser live Ethereum data source**
instead of the server API. Deploy it exactly like `jakepercy.com/bitcoin-battlefield`: upload a folder
via FTP and open it. No server, no database, no environment variables.

## Build and deploy

```bash
pnpm build:live
```

That writes `dist-live/`. Upload the **contents** of `dist-live/` to wherever you want the page
addressable on jakepercy.com (for example a `ledger-atlas-live` folder under `public_html`). Asset
paths are relative, so any folder works. Rebuild and re-upload whenever the evidence registry or the
app changes.

## How it works

- `live-lite/main.tsx` mounts the same `Atlas` component the main app uses, passing it an in-browser
  data source instead of letting it call `/api/snapshot`. It opens on the 1-hour window in live mode.
- `lib/atlas/live-client.ts` is that source. On load it backfills the preceding hour (about 300
  blocks, fetched in 50-block chunks from a free public Ethereum RPC endpoint, `eth.drpc.org` with
  `1rpc.io/eth` as fallback), then polls for new blocks every ~20 seconds. Transfers are priced with
  CoinGecko's free public API using its 5-minute price series (never an assumed $1 peg), evidence is
  attached from the registry, and every transfer runs through the project's **real** classification
  and aggregation code in `lib/atlas/engine.ts`. Totals, corridor ranking and the accounting panel are
  therefore computed exactly as the production backend would compute them. Block times inside the
  backfilled hour are interpolated between fetched block headers (about ±12 s); live blocks are exact.
- **Country glow.** Most evidenced transfers have only one evidenced end (an exchange wallet and an
  unknown counterparty). Those can never be a route, but the app already sums them per jurisdiction as
  known-endpoint activity, so the map lights the jurisdiction's anchor in proportion. A glow is
  activity touching that jurisdiction; a line is a two-sided, cross-border, evidenced transfer.
- Demo mode still works too (the "Demo simulation" tab in Data & coverage), computed client-side.

## What this build deliberately cannot do

It has no memory beyond the open browser tab: transfers are kept for about 90 minutes, so only the
**5M and 1H** windows are offered (24H and 7D are disabled), there are no historical baselines or
anomaly scores, playback only reaches back as far as the retained buffer, and refreshing the page
starts over (it re-backfills the hour). Those features need somewhere to remember data between visits:
the main app's existing Cloudflare Workers + D1 backend, the phase 2 upgrade whenever you want it.
Currently Ethereum only; Base and Arbitrum follow the same pattern.

## The evidence registry

Two files: `lib/atlas/known-entities.ts` (one record per operating entity: legal entity, jurisdiction,
confidence, and the regulator/court/company document that supports it) and
`lib/atlas/known-addresses.ts` (one line per address: the exact Etherscan public name tag and the date
it was read). `node scripts/verify-registry.cjs` checks every entry (see the main README).

As of 2026-09-19 the registry holds **805 addresses across 70 entities and 28 jurisdictions**:
Binance, Amber Group (Cayman Islands); Coinbase, Kraken, Gemini, Binance.US, Robinhood Crypto, Uphold,
Paxos/itBit, BitGo, Anchorage Digital, Fidelity Digital Assets, Zero Hash, Cumberland, Jump Trading,
Galaxy Digital, FalconX (US); OKX, KuCoin, Bitget, MEXC, Poloniex (Seychelles); Bitfinex (BVI); Upbit,
Bithumb, Coinone, Korbit (South Korea); bitFlyer, Coincheck, GMO Coin, bitbank (Japan); GSR (Hong Kong);
Coinhako (Singapore); Indodax, Tokocrypto (Indonesia); Bitkub (Thailand); Coins.ph (Philippines);
BitoPro, MaiCoin (Taiwan); CoinDCX (India); CoinSpot, CoinJar, Digital Surge, BTC Markets (Australia);
Coinsquare/Bitbuy, Shakepay, Newton, Wealthsimple, NDAX, Netcoins (Canada); Wintermute, B2C2 (UK);
Bitvavo (Netherlands); Bitpanda (Austria); Bitcoin Suisse, Copper (Switzerland); LCX (Liechtenstein);
SwissBorg (France); Firi, NBX (Norway); Paribu, BtcTurk, Bitci (Türkiye); Coinmetro (Estonia); Cryptal
(Georgia); Bitso, Bullish (Gibraltar); Mercado Bitcoin (Brazil); VALR, AltCoinTrader (South Africa).
Roughly half the wallets belong to Bithumb, Coinbase, Kraken, Binance and OKX, whose numbered hot, cold
and collector wallets were traced one by one; a few dozen labelled wallets with no Ethereum mainnet
activity at all were left out. The source list is `scripts/registry/addresses.txt`; regenerate the TypeScript with
`node scripts/registry/gen-addresses.mjs scripts/registry/addresses.txt lib/atlas/known-addresses.ts`.

**Inferred deposit addresses.** Even with hundreds of labelled wallets, exchange customers almost never
send from one exchange's hot wallet to another's: they withdraw to a per-customer *deposit address*
that the receiving exchange sweeps into its hot wallet minutes later. The live client watches for that
sweep inside the buffered hour: an unlabelled address whose only outgoing transfers go to one registry
entity, after receiving from outside it, and which forwarded at least 80% of what it received, is
treated as that entity's deposit address for the rest of the session. Such evidence is marked
**INFERRED** in its category, source and note, cites the sweep transaction, and is never persisted.
This is what turns a Coinbase-to-Binance withdrawal into a US to Cayman Islands route. Open any route's
"Why is this mapped here?" panel to see which endpoints rest on inference rather than a published label. Each address was checked against its own Etherscan page; each entity's jurisdiction is
tied to a regulator register, court filing or the company's own legal page, with HIGH rather than
VERIFIED wherever a brand runs several separately regulated affiliates. The entity file's header lists
the rules and the exchanges deliberately left out because their controlling entity is disputed in
public sources (Bybit, Crypto.com, Bitstamp, Luno, WazirX, HTX, CEX.IO, Nexo among them). A much larger group
is regulated and unambiguous but simply has no publicly labelled Ethereum wallet, so nothing can be
attributed to it yet. That is the case for essentially every Latin American, African, Gulf and Indian
exchange checked (Lemon, Ripio, Buda, Foxbit, NovaDAX, Volabit, Yellow Card, Quidax, Busha, Ovex, Rain,
CoinMENA, BitOasis, M2, ZebPay, Bitbns, Giottus, Mudrex), for Gopax, SBI VC Trade, Zaif, HashKey, OSL,
Independent Reserve, Pintu and PDAX in Asia, and for Bit2Me, Young Platform, Swissquote, BISON and
Bitcoin.de in Europe. Those regions therefore glow and route less than their real activity, and the map
says so rather than guessing. They would join the registry the day a public label appears. A few more
have clean labels but an ambiguous or lapsed operating entity and stay out on purpose: WhiteBIT, Revolut,
zondacrypto (Estonian licence revoked June 2026), Kuna (ceased trading 2025), Genesis Trading (ceased
2023), BitMEX (winding up September 2026), EXMO (sanctioned May 2026), DWF Labs, Blockchain.com, Deribit,
BitMart, Phemex, AscendEX, Bitrue, LBank, CoinEx, BingX, WOO X, XT.com and HitBTC (no document identifies
which of several affiliates controls the wallet, or the claimed operator is contradicted by a regulator).

A route is drawn only when **both** ends of a transfer are evidenced wallets in **different**
jurisdictions. Most on-chain transfers aren't, so most value shows as unresolved and lights a glow at
most. That is the point, not a bug. Adding evidenced wallets is the lever that makes routes appear.
