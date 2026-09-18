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
  data source instead of letting it call `/api/snapshot`.
- `lib/atlas/live-client.ts` is that source. Every ~20 seconds it asks a free public Ethereum RPC
  endpoint (`eth.drpc.org`, falling back to `1rpc.io/eth`) for new USDC/USDT transfer events, prices
  them with CoinGecko's free public API (checked live, never assumed to be $1), attaches evidence from
  `lib/atlas/known-entities.ts`, and runs the transfers through the project's **real** classification
  and aggregation code in `lib/atlas/engine.ts`. Totals, corridor ranking and the accounting panel are
  therefore computed exactly as the production backend would compute them.
- Demo mode still works too (the "Demo simulation" tab in Data & coverage), computed client-side.

## What this build deliberately cannot do

It has no memory beyond the open browser tab: transfers are kept for about an hour, so only the
**5M and 1H** windows are offered (24H and 7D are disabled), there are no historical baselines or
anomaly scores, and refreshing the page starts over. Those features need somewhere to remember data
between visits — that's the main app's existing Cloudflare Workers + D1 backend, which is the phase 2
upgrade whenever you want it. Currently Ethereum only; Base and Arbitrum follow the same pattern.

## The evidence registry

`lib/atlas/known-entities.ts` is the only file to touch when adding evidenced wallets. It currently
holds 21 addresses across 8 jurisdictions: Binance (Cayman Islands), Coinbase, Kraken and Gemini (US),
OKX (Seychelles), Bitfinex (British Virgin Islands), Upbit and Bithumb (South Korea), CoinSpot
(Australia), CoinDCX (India), bitFlyer and Coincheck (Japan). Each was checked against its own
Etherscan label page and cross-referenced against a regulatory filing, court document or the
exchange's own disclosure for the jurisdiction claim. The file's header comment lists the rules and the
exchanges deliberately left out because their controlling entity is disputed in public sources.

A route is drawn only when **both** ends of a transfer are evidenced wallets in **different**
jurisdictions. Most on-chain transfers aren't, so most value shows as unresolved. That is the point,
not a bug.
