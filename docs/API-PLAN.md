# API and hosting plan — Jake's budget (agreed 2026-09-29)

Revisit this file before any API or hosting work. The full provider comparison with prices
and sources is in [API-OPTIONS-2026-09.md](API-OPTIONS-2026-09.md). This page is the short
version, fitted to Jake's budget.

## Budget

| Spend | Status |
|---|---|
| $49/month and $199/month plans (Helius Developer, QuickNode, Chainstack, Solscan Pro, Etherscan Lite) | **Not affordable. Do not propose them.** |
| Alchemy pay-as-you-go | Affordable. Usage-billed at about $0.525 per 1M compute units. |
| Cloudflare Workers Paid, $5/month | Affordable, but start on the free tier (see below). |
| Free keys (Infura, Tronscan, TronGrid, Helius free, Blockscout free) | Preferred |

## Decisions already made

- **D6 (2026-09-29): Tronscan's own name tags are admissible for Tron**, the same as Etherscan tags.
  See `docs/DECISIONS-2026-09.md`.
- Jake signs up for every account himself and hands over the keys. Agents never create accounts
  or handle credentials on his behalf.
- Keys never go in the static client bundle.

## Where each key has to live

| Upgrade | Key needed where | Server needed? | Cost |
|---|---|---|---|
| **Polygon** (Brazil, Indonesia, Mexico corridor) | Only in the monthly dormancy scan. The live feed keeps using the free public endpoint, because 37 hours of history is plenty for the 5M and 1H windows. | **No.** Run the scan on Jake's PC or in GitHub Actions with the key in an environment variable or secret, and commit `dormancy.json`. | **$0** with Infura free (archive, no block-range cap, 10K-result cap). Alchemy pay-as-you-go is the fallback, at cents per monthly scan. |
| **Tron** (India, LatAm, Africa; most USDT) | In the live feed, because visitors' browsers must fetch transfers | **Yes, a proxy.** | Free Tronscan and TronGrid keys, plus a Cloudflare Worker. |
| **Solana** (USDC) | Same as Tron | Yes, the same proxy | Helius free (1M credits/month) |
| Tag lead feed | Offline research scripts only | No | Blockscout PRO free |

## Hosting options

- **GitHub Pages** can host the static site for free, replacing FTP to jakepercy.com. It is on the
  to-do list. It **cannot** hide a key, so it cannot run the proxy.
- **GitHub Actions** runs scheduled jobs with secrets: the monthly Polygon dormancy scan, the
  monthly scans on the other chains, and label and lead refreshes. It then commits the results. It
  is free on public repos; private repos get 2,000 minutes a month.
- **Cloudflare Workers, free tier**, is probably enough for a Tron/Solana proxy. Waiting on the
  network does not count toward the 10 ms CPU limit, and 100,000 requests a day is plenty for a
  personal site. Move to Workers Paid ($5) only if a limit is hit.
  - The proxy **must cache responses and rate-limit**. Otherwise anyone can drain the key's quota
    through it.
  - Better still, a cron Worker fetches the latest Tron and Solana transfers every minute or so into
    KV or D1, and browsers read that cache. Visitor count then never touches the key.

## Suggested order

1. **Jake signs up for Infura (free)** and gives the agent the key. The agent adds a keyed endpoint to
   `measure-dormancy.mjs` (read from an environment variable, never committed), runs the Polygon
   scan, and un-parks Polygon (HANDOFF section 12, "Switch it on"). Optionally wire it into a GitHub
   Actions workflow.
2. **Jake gets Tronscan and TronGrid keys (free).** The agent builds the Cloudflare Worker proxy/cron
   and a Tron feed, and Tron wallets are researched with Tronscan tags under D6. Jurisdiction documents
   are still needed per entity.
3. **Helius free** for Solana, through the same Worker.
4. Optional: **Blockscout PRO free** as a tag lead feed for research waves.

Each new chain re-locks 24H/7D for visitors until it has history (HANDOFF section 12), so batch
chain additions where possible.
