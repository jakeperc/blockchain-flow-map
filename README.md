# Ledger Atlas

A full-screen, stablecoin-first map of **attributed cross-border onchain settlement**. Built with Three.js, Equal Earth geography, React and server-side Cloudflare D1 aggregation.

## Delivery status

The static **live build** (`pnpm build:live` → `dist-live/`) reads USDC and USDT transfers on Ethereum, Base and Arbitrum from free public RPC endpoints in the browser, attributing them against a registry of 1,116 first-party explorer-labelled wallets (plus 1,277 derived) across 70 entities and 28 jurisdictions. It is deployed by copying `dist-live/` under `public_html` on jakepercy.com. Tron and Solana are not connected (they need keyed or paid data sources). The Cloudflare D1 backend mode remains unconnected and is deferred.

**Handing this project to another agent or developer? Start with [HANDOFF.md](HANDOFF.md).**


