# Blockchain Flow Map

A full-screen, stablecoin-first map of **attributed cross-border onchain settlement**: an interactive globe that unfolds into an Equal Earth map. The live build uses Three.js and React, with no server behind it.

## Delivery status

The static **live build** (`pnpm build:live` → `dist-live/`) reads USDC and USDT transfers on Ethereum, Base, Arbitrum, Avalanche, Polygon, Optimism and Tron from free public RPC endpoints in the browser, attributing them against a registry of 1,217 first-party explorer-labelled wallets (plus 3,572 derived) across 68 entities and 30 jurisdictions. A token contract is read only where its own issuer publishes it, so BNB Chain, whose stablecoins are bridge-issued pegs, is absent entirely. Polygon and Optimism joined on 2026-10-01 (USDC only on both), once a keyless endpoint with full history was found for Polygon. The 5M and 1H windows come from transfers held in memory; 24H and 7D are assembled from summaries of every completed 15 minutes the visitor's own browser has watched, and stay unavailable until it has seen at least 80% of the window. It is deployed by copying `dist-live/` under `public_html` on jakepercy.com. Tron joined on 2026-10-06/07 (USDT only); it now has 27 wallets whose public name tags were read from Tronscan using a free API key that never ships. Its feed costs a visitor about 1.2 MB an hour. Solana is not connected; it needs a keyed indexer (a free Helius key behind a Cloudflare Worker). On 2026-10-09 the renderer stopped presenting a cleared frame on canvas resize or render-scale changes, and the per-chain poll updates were merged into one (HANDOFF section 26). Later that day payment firms were allowed on the map, and Urban Crypto Exchange (Brazil), Well Wallet (Costa Rica, a new map country) and DTCPay (Singapore) were admitted after an operator review; Swapster, Wallib and Cropty are recorded as left out (HANDOFF section 27). On 2026-10-12 three faults in a tab left running were fixed (HANDOFF section 28): each poll recorded one block's time too little, so Ethereum logged about 40% of the time actually watched and 24H and 7D could never reach their 80% bar on all chains; after a sleeping computer, a frozen tab or a dropped network the feed crawled through the missed blocks for hours, leaving the map empty, where it now re-reads the latest hour; and transfers left unpriced by a gap in price samples are now re-priced. On 2026-10-18 the repository was pruned for publication on GitHub (HANDOFF section 29): the deferred backend scaffold and the unused template code left the tree, and the build gate now type-checks the whole project. Later that day the page's first minute was made honest (HANDOFF section 30): LOADING and PARTIAL page states by cause instead of a blanket DELAYED, the first headline figure always labelled as evidenced-wallet volume, the connecting pill naming every chain, and the registry's size, dormancy date and evidence expiry shown in the Data & coverage panel. Both pages now name and link their author and the source code and carry a link-preview image with the card tags (HANDOFF section 31). The 1H window now has corridor baselines from the browser's sealed history, with the prior windows anchored to the quarter-hour (HANDOFF section 32).

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
