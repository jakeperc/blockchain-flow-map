# Blockchain Flow Map

A full-screen, stablecoin-first map of **attributed cross-border onchain settlement**: an interactive globe that unfolds into an Equal Earth map. The live build uses Three.js and React; a Cloudflare D1 backend is deferred.

## Delivery status

The static **live build** (`pnpm build:live` → `dist-live/`) reads USDC and USDT transfers on Ethereum, Base, Arbitrum, Avalanche, Polygon, Optimism and Tron from free public RPC endpoints in the browser, attributing them against a registry of 1,212 first-party explorer-labelled wallets (plus 3,567 derived) across 65 entities and 29 jurisdictions. A token contract is read only where its own issuer publishes it, so BNB Chain, whose stablecoins are bridge-issued pegs, is absent entirely. Polygon and Optimism joined on 2026-10-01 (USDC only on both), once a keyless endpoint with full history was found for Polygon. The 5M and 1H windows come from transfers held in memory; 24H and 7D are assembled from summaries of every completed 15 minutes the visitor's own browser has watched, and stay unavailable until it has seen at least 80% of the window. It is deployed by copying `dist-live/` under `public_html` on jakepercy.com. Tron joined on 2026-10-06/07 (USDT only), with 23 wallets whose public name tags were read from Tronscan using a free API key that never ships. Its feed costs a visitor about 1.2 MB an hour. Solana is not connected; it needs a keyed indexer. Solana needs a keyed indexer. The Cloudflare D1 backend mode remains unconnected and is deferred.

## Plain-text description for AI readers

The page draws everything with JavaScript, so `pnpm build:live` also writes `llms.txt` and `methodology.md` into
`dist-live/`, adds a canonical link, Open Graph tags, a link to `llms.txt` and a `<noscript>` summary to `index.html`, and
leaves the app bundle untouched. The prose is `live-lite/llms.txt.tpl`. Chains, assets, registry counts, the evidence-expiry
date and the thresholds are stamped from the code, and `methodology.md` is `docs/METHODOLOGY.md` with one internal reference
fixed. The build checks that every sentence the template quotes is still in the page, that no number is typed into the prose,
and that the methodology, the meta description and the code agree. Changing a label, band or formula the template quotes
means updating the template; adding a chain also means updating the chain list in `docs/METHODOLOGY.md` and the meta
description in `live-lite/index.html`. Details: [HANDOFF.md](HANDOFF.md) section 18.

## Landmarks page

`dist-live/landmarks.html` is a second page: sixteen landmark transactions (twelve all-time, four from the fixed window
3 July to 1 October 2026), each read from its own chain by every public source that serves it, with analysis charts,
Ethereum supply and transfer tables measured over the same window, and a list of events considered but not listed. It is
static HTML built from `scripts/landmarks/entries/`; only today's prices load in the browser. A party is named only under
decision D7 in `docs/DECISIONS-2026-09.md`. The recent window and the measured tables need a monthly refresh
(`scripts/landmarks/README.md`). Details: [HANDOFF.md](HANDOFF.md) section 19.

API and hosting plan for more coverage (Tron, Solana, Polygon), fitted to the budget: [docs/API-PLAN.md](docs/API-PLAN.md).

Compilation-disclosure audit (2026-10-02): re-reading 705 first-party rows with the fixed tag reader found 106 unrecorded
hildobby-compilation disclosures, so 590 of 1,189 rows now carry a recorded compilation origin; 63 Arbiscan and Optimistic
Etherscan rows cannot be audited through the bot-readable page. Nothing in the registry changed pending Jake's decision.
Report: [docs/measurements/2026-10-02/compilation-disclosure-audit.md](docs/measurements/2026-10-02/compilation-disclosure-audit.md).

**Handing this project to another agent or developer? Start with [HANDOFF.md](HANDOFF.md).**

ChatGPT and Claude share that handoff. Each material change should update it in the
same commit; `AGENTS.md` and `CLAUDE.md` point agents to the current state.
