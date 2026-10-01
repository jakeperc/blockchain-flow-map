# Blockchain Flow Map

A full-screen, stablecoin-first map of **attributed cross-border onchain settlement**: an interactive globe that unfolds into an Equal Earth map. The live build uses Three.js and React; a Cloudflare D1 backend is deferred.

## Delivery status

The static **live build** (`pnpm build:live` → `dist-live/`) reads USDC and USDT transfers on Ethereum, Base, Arbitrum, Avalanche, Polygon and Optimism from free public RPC endpoints in the browser, attributing them against a registry of 1,189 first-party explorer-labelled wallets (plus 3,567 derived) across 64 entities and 29 jurisdictions. A token contract is read only where its own issuer publishes it, so BNB Chain, whose stablecoins are bridge-issued pegs, is absent entirely. Polygon and Optimism joined on 2026-10-01 (USDC only on both), once a keyless endpoint with full history was found for Polygon. The 5M and 1H windows come from transfers held in memory; 24H and 7D are assembled from summaries of every completed 15 minutes the visitor's own browser has watched, and stay unavailable until it has seen at least 80% of the window. It is deployed by copying `dist-live/` under `public_html` on jakepercy.com. Tron and Solana are not connected. Tron's transfers turned out to be readable without a key (measured 2026-10-01); it is waiting on tag evidence, which needs a free Tronscan API key. Solana needs a keyed indexer. The Cloudflare D1 backend mode remains unconnected and is deferred.

API and hosting plan for more coverage (Tron, Solana, Polygon), fitted to the budget: [docs/API-PLAN.md](docs/API-PLAN.md).

**Handing this project to another agent or developer? Start with [HANDOFF.md](HANDOFF.md).**

ChatGPT and Claude share that handoff. Each material change should update it in the
same commit; `AGENTS.md` and `CLAUDE.md` point agents to the current state.
