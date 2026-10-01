# Blockchain Flow Map · Live (static, backend-free build)

The full Blockchain Flow Map interface — the Three.js Equal Earth map, corridor panels, evidence inspector,
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
- `lib/atlas/live-client.ts` is that source, one feed per chain: Ethereum (USDC, USDT), Base (USDC),
  Arbitrum (USDC, USDT), Avalanche (USDC, USDT), Polygon (USDC) and Optimism (USDC). On load each feed
  backfills the preceding hour — 300 Ethereum blocks, 1,800 Base, 14,400 Arbitrum, 3,000 Avalanche,
  2,400 Polygon or 1,800 Optimism —
  from keyless public RPC endpoints, then polls every ~20 seconds. A contract is only read where its own
  issuer publishes it, which is why BNB Chain is absent entirely (`docs/DECISIONS-2026-09.md`, D4). Polygon
  and Optimism went live on 2026-10-01 (HANDOFF section 17).
  **The feed is filtered**: it asks the node only for transfers that touch a wallet with evidence on that
  chain, using the two indexed address positions of the Transfer event. Measured on 2026-09-20 that is
  about 4 MB down and 2 MB up for one hour across all three chains, against roughly 140 MB unfiltered.
  Nothing that can draw a route is lost, because a corridor needs an evidenced wallet at each end and the
  deposit sweeps inference rests on are funded by exchange hot wallets. The cost is the denominator: the
  headline is therefore "Observed on evidenced wallets", and a small unfiltered sample of chain time is
  read every fifteen minutes and shown separately, never scaled up. Transfers are priced from a live 5-minute
  series (never an assumed $1 peg), fetched from CoinGecko's free public API first and, if that stalls or
  rate-limits, from Coinbase's or Kraken's free public APIs instead — each transfer's evidence cites whichever
  of the three actually priced it. Evidence is attached from the
  registry, and every transfer runs through the project's **real** classification and aggregation code in
  `lib/atlas/engine.ts`. Block times inside the backfilled hour are interpolated between fetched block
  headers; live blocks are exact. A chunk a public endpoint fails to serve is counted and the page reports
  the window as partial with its real start time, rather than quietly showing a short hour.
- The pure parts of that client — decoding, pricing, block-time interpolation, retention and the
  deposit-address inference — live in `lib/atlas/live-core.ts` and are exercised by
  `scripts/verify-live.cjs`. `pnpm build:live` runs every verifier first and refuses to build on a failure,
  including when the evidence registry would expire within 60 days of the build.
- **Country glow.** Most evidenced transfers have only one evidenced end (an exchange wallet and an
  unknown counterparty). Those can never be a route, but the app already sums them per jurisdiction as
  known-endpoint activity, so the map lights the jurisdiction's anchor in proportion. A glow is
  activity touching that jurisdiction; a line is a two-sided, cross-border, evidenced transfer.
- There is no fallback dataset: when a provider, price feed or evidence record is unavailable, the page shows its real delayed, partial or unpriced state.

## What this build deliberately cannot do

Raw transfers are still kept for only about 90 minutes, so per-transfer detail — the unmapped transfer
list, the counterparty lead list and the per-endpoint evidence cards — exists on the **5M and 1H**
windows alone. Since 2026-09-25 the page does remember the *accounting*: each completed 15 minutes is
sealed, per chain, into its exact totals and corridors and kept in that visitor's own browser
(`lib/atlas/rollup.ts`, `lib/atlas/history-store.ts`). That is what makes **24H and 7D** possible without
a server, along with real corridor baselines. Those windows stay disabled until this browser has actually
observed at least 80% of them, with a tooltip saying how much more is needed, because a partly watched
day presented as "24H" would read as the day's settlement. Coverage accrues only while the page is open,
so the long windows belong to a tab left running. The history is per browser, never uploaded and never
shared; "Clear recorded history" is in the Data & coverage panel. What still needs a server:
the main app's existing Cloudflare Workers + D1 backend, the phase 2 upgrade whenever you want it.
Tron needs a keyed TronGrid account and Solana a paid indexer, so both stay "Not connected" and the chain
filter only offers what the build actually reads.

## The evidence registry

Two files: `lib/atlas/known-entities.ts` (one record per operating entity: legal entity, jurisdiction,
confidence, and the regulator/court/company document that supports it) and
`lib/atlas/known-addresses.ts` (one line per address: the exact Etherscan public name tag and the date
it was read). `node scripts/verify-registry.cjs` checks every entry (see the main README).

As of 2026-09-21 the registry holds **1,114 first-party addresses across 64 entities and 29 jurisdictions**
(figures grow with each research wave; current counts print from `scripts/verify-registry.cjs`). Exchanges and
custodians with a settled single-entity attribution: Binance (Cayman Islands); Coinbase, Kraken, Gemini,
Binance.US, Robinhood Crypto, Uphold, Paxos/itBit, Anchorage Digital, Fidelity Digital Assets (US); OKX, KuCoin,
Bitget, MEXC, Poloniex (Seychelles); Bitfinex (BVI); Upbit, Bithumb, Coinone, Korbit (South Korea); bitFlyer,
Coincheck, GMO Coin, bitbank (Japan); Coinhako (Singapore); Indodax, Tokocrypto (Indonesia); Bitkub (Thailand);
Coins.ph (Philippines); BitoPro, MaiCoin (Taiwan); CoinDCX (India); CoinSpot, CoinJar, Digital Surge, BTC Markets
(Australia); Coinsquare/Bitbuy, Shakepay, Newton, Wealthsimple, NDAX, Netcoins (Canada); Wintermute (UK);
Bitvavo (Netherlands); Bitpanda (Austria); Bitcoin Suisse (Switzerland); LCX (Liechtenstein); SwissBorg (France);
Firi, NBX (Norway); Paribu, BtcTurk, Bitci (Türkiye); Coinmetro (Estonia); Cryptal (Georgia); Bitso, Bullish
(Gibraltar); Mercado Bitcoin (Brazil); VALR, AltCoinTrader (South Africa). **Not in the registry despite a public
Etherscan tag**, because their own documents split custody or contracting by client residence (the operator
test, decision D3): BitGo, Cumberland DRW, Galaxy Digital, Jump Trading, B2C2, GSR, Zero Hash, Amber Group,
FalconX and Copper.
Roughly half the wallets belong to Bithumb, Coinbase, Kraken, Binance and OKX, whose numbered hot, cold
and collector wallets were traced one by one; a few dozen labelled wallets with no Ethereum mainnet
activity at all were left out. The source list is `scripts/registry/addresses.txt` (`chain|entity|address|label|checked|note`, one row
per address per chain); regenerate the TypeScript with
`node scripts/registry/gen-addresses.mjs scripts/registry/addresses.txt lib/atlas/known-addresses.ts`
after running `node scripts/registry/probe-code.mjs`.

**Inferred deposit addresses.** Even with hundreds of labelled wallets, exchange customers almost never
send from one exchange's hot wallet to another's: they withdraw to a per-customer *deposit address*
that the receiving exchange sweeps into its hot wallet minutes later. The live client watches for that
sweep inside the buffered hour: an unlabelled address whose only outgoing transfers go to one registry
entity, after receiving from outside it, and which forwarded at least 80% of what it received, is
treated as that entity's deposit address for the rest of the session. Such evidence is marked
**INFERRED** in its category, source and note, cites the sweep transaction, and is never persisted.
This is what turns a Coinbase-to-Binance withdrawal into a US to Cayman Islands route. Open any route's
"Why is this mapped here?" panel to see which endpoints rest on inference rather than a published label.

**Derived cross-chain evidence.** An Etherscan label is evidence about Ethereum. For Base and Arbitrum the
build starts from the same registry: every Ethereum address is classified with `eth_getCode` on all three
chains (`scripts/registry/probe-code.mjs`, result in `scripts/registry/code-probe.json`), and an address
that is a plain key-controlled account on Ethereum *and* on the target chain is reused there as DERIVED
evidence — HIGH at the minimum admissible score, never VERIFIED, with the derivation stated in the
evidence panel. Of the 805 Ethereum addresses, 46 are contracts (multisigs, proxies) and never derive; 9
more carry code on Base and 6 on Arbitrum and are excluded there too. A first-party Basescan or Arbiscan
label always wins over a derivation, and only a first-party label can anchor a deposit-address inference,
so routes on Base and Arbitrum depend on the labels read on those explorers. Each address was checked against its own Etherscan page; each entity's jurisdiction is
tied to a regulator register, court filing or the company's own legal page, with HIGH rather than
VERIFIED wherever a brand runs several separately regulated affiliates. The entity file's header lists
the rules and the exchanges deliberately left out because their controlling entity is disputed in
public sources (Bybit, Crypto.com, Bitstamp, Luno, WazirX, HTX, CEX.IO, Nexo among them). Ten brands with a public
Etherscan tag were admitted, then removed on 2026-09-21 by the same test: FalconX and Copper first (FalconX: "each
FalconX entity", US client assets with Fireblocks Trust; Copper: Copper Markets (US), Inc. for US persons, the
Swiss AG for others), then BitGo, Cumberland DRW, Galaxy Digital, Jump Trading, B2C2, GSR, Zero Hash and Amber
Group once the same "brand-level tag, several affiliates" caveat on their entries was tested too (each split
custody or contracting by client residence in its own documents, or a regulator's own filing named a different
entity for the same conduct, as with Jump Trading and the SEC's Tai Mo Shan order). A brand-level wallet tag
cannot be tied to one jurisdiction in any of these cases. A much larger group
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

**Dormant tier.** Most registry wallets are idle: 81% of the Ethereum registry moved no USDC or USDT in
the 90 days to 2026-09-21. Those wallets stay in the registry as evidence, and any transfer that touches
one still resolves to its entity, but the live filter does not ask the public nodes about them
(`scripts/registry/measure-dormancy.mjs` writes `scripts/registry/dormancy.json`; `gen-addresses.mjs` emits
the smaller `WATCHED` list the browser sends). That cuts what each visitor uploads and frees filter slots for
wallets that move money. A wallet that wakes up after the measurement, next to only unwatched counterparties,
is missed until the next monthly re-measure, and the build fails if the measurement is older than 45 days.

A route is drawn only when **both** ends of a transfer are evidenced wallets in **different**
jurisdictions. Most on-chain transfers aren't, so most value shows as unresolved and lights a glow at
most. That is the point, not a bug. Adding evidenced wallets is the lever that makes routes appear.
