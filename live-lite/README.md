# Ledger Atlas · Live (Lite)

A standalone, backend-free live view of Ethereum stablecoin transfers, built the same way as
`jakepercy.com/bitcoin-battlefield`: a browser connects directly to free public data sources, no
server or database involved. Deploy it exactly like that page — upload the folder via FTP and open it.

## What's in this folder

- **`index.html`** — the whole app. Loads three small charting libraries from a public CDN
  (d3-array, d3-geo, topojson-client) and otherwise runs entirely on its own.
- **`known-entities.js`** — the evidence registry: a hand-curated, sourced list of Ethereum addresses
  publicly documented as belonging to specific exchanges, with a jurisdiction and a citation for each.
  This is the file to edit when you want to add more evidenced wallets later. Every entry has a real
  `sourceUrl` — don't add one without one.

## How it works

1. Every ~20 seconds, your browser asks a free public Ethereum RPC endpoint (`eth.drpc.org`, with
   `1rpc.io/eth` as a fallback) for new USDC/USDT transfer events on the last few blocks.
2. It prices those transfers using CoinGecko's free public API (checked live — never assumes $1).
3. It checks both ends of each transfer against `known-entities.js`. If both ends are evidenced *and*
   in different jurisdictions, it draws a route. Otherwise the transfer is counted honestly as
   "no public jurisdiction evidence" — that's most of them, by design, not a bug.
4. Everything is kept in memory only, for up to about an hour, to support the 5-minute and 1-hour
   window toggle. Refreshing the page starts over.

## Deploying it

Upload this whole folder to wherever you want it addressable on jakepercy.com (e.g. a
`ledger-atlas-live` folder under `public_html`), the same way you publish Bitcoin Battlefield. No
build step, no server config, no environment variables. Just the files.

## Honest scope — what this is and isn't

This is deliberately the lightweight version. It trades the full Ledger Atlas app's 24-hour/7-day
windows and trailing-history anomaly detection for something that needs zero hosting. It cannot add
those back without somewhere to remember data between visits (a small database) — see the main
project's `docs/OPERATIONS.md` and the plan discussed for **Phase 2: the full backend**, which reuses
the Ethereum poller and D1 schema already built into the main app, via a free Cloudflare account.

Currently covers **Ethereum only**. The same approach extends to Base and Arbitrum cheaply (same
contract-log pattern, different free RPC endpoint) whenever you want to add them.

## Evidence registry: what's included and what's honestly missing

21 addresses across 8 jurisdictions are currently evidenced: Binance (Cayman Islands), Coinbase (US),
Kraken (US), OKX (Seychelles), Bitfinex (British Virgin Islands), Upbit and Bithumb (South Korea),
Gemini (US), CoinSpot (Australia), CoinDCX (India), and bitFlyer and Coincheck (Japan). Every one was
checked against its own Etherscan label page, cross-referenced against a regulatory filing, court
document, or the exchange's own published disclosure for the jurisdiction claim.

Deliberately excluded because the specific controlling entity or jurisdiction was genuinely disputed
in public sources, not because the exchange itself is obscure: **Bybit** (its BVI entity was formally
dissolved; a same-named Seychelles entity appears to have taken over, but which one controls this
wallet today isn't publicly confirmable), **Crypto.com**, **Bitstamp**, **Luno**, **WazirX**, and
**HTX/Huobi** (multi-entity corporate groups where the brand is clear but the licensed subsidiary
behind a specific wallet isn't). Also missing entirely for lack of a solid public address: Coinbase
Custody as distinct from retail Coinbase, Independent Reserve, and any exchange specifically
domiciled in Latin America, continental Europe, Turkey, Nigeria, Kenya, the UAE, the Philippines,
Indonesia or Hong Kong. Circle's and Tether's own treasury/issuance addresses are intentionally left
out entirely — a transfer from an issuer's treasury is issuance, not bilateral settlement, and mapping
it as a "corridor" would misrepresent it exactly the way the main app's mint/burn exclusion exists to
prevent.

Adding more evidenced addresses later is safe and additive: just add entries to `known-entities.js`
following its schema comment, each with a real source. Re-verify existing entries periodically —
exchanges do sometimes rotate hot wallets.
