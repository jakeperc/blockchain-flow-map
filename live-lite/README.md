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

As of 2026-09-18 the registry holds **103 addresses across 29 entities and 17 jurisdictions**:
Binance (Cayman Islands); Coinbase, Kraken, Gemini (US); OKX (Seychelles); Bitfinex (BVI); Upbit,
Bithumb (South Korea); bitFlyer, Coincheck (Japan); CoinDCX (India); CoinSpot, CoinJar, Digital Surge,
BTC Markets (Australia); Coinsquare/Bitbuy, Shakepay, Newton, Wealthsimple (Canada); Wintermute (UK);
Bitvavo (Netherlands); Bitcoin Suisse, Copper (Switzerland); Paribu, BtcTurk (Türkiye); Coinmetro
(Estonia); Bitso (Gibraltar-licensed operator of the Mexican brand); Mercado Bitcoin (Brazil); VALR
(South Africa). Each address was checked against its own Etherscan page; each entity's jurisdiction is
tied to a regulator register, court filing or the company's own legal page, with HIGH rather than
VERIFIED wherever a brand runs several separately regulated affiliates. The entity file's header lists
the rules and the exchanges deliberately left out because their controlling entity is disputed in
public sources (Bybit, Crypto.com, Bitstamp, Luno, WazirX, HTX, CEX.IO, Nexo among them).

A route is drawn only when **both** ends of a transfer are evidenced wallets in **different**
jurisdictions. Most on-chain transfers aren't, so most value shows as unresolved and lights a glow at
most. That is the point, not a bug. Adding evidenced wallets is the lever that makes routes appear.
