# Before/after measurements, 2026-09-21

Five stored hours of real chain history, each replayed with `scripts/measure-corridors.mjs` for the registry
before this run (`cc97055`) and after it (`8303043`). Each `window-*.json` holds the block ranges, header times and
the CoinGecko 5-minute price series; each `corridors-*.json` holds what the map's 1H view shows for both registries.
Re-run one with:

```
node scripts/measure-corridors.mjs --window docs/measurements/2026-09-21/window-A.json --refs cc97055,8303043 --explain
```

Chain history is immutable and the prices are stored, so a re-run reproduces these figures as long as the free
endpoints still serve those blocks. Figures are what the map shows right after backfill; attributed value is the
UI's "% attributed" numerator (routes between evidenced wallets in different jurisdictions).

| Hour (UTC) | Corridors, all chains | Attributed | Share | Jurisdictions lit | Newly lit |
|---|---|---|---|---|---|
| A 17:22–18:22 | 29 → 36 | $70.45M → $73.35M | 9.9% → 10.6% | 17 → 20 | AR, BR, HK |
| B 05:17–06:23 | 24 → 26 | $5.16M → $7.18M | 4.4% → 7.2% | 18 → 20 | AR, BR |
| C 15:15–16:18 | 35 → 41 | $48.22M → $41.15M | 6.7% → 5.7% | 16 → 18 | AR, BR |
| D 09:12–10:18 | 32 → 36 | $63.65M → $72.73M | 10.2% → 11.6% | 17 → 19 | AR, HK |
| E 03:11–04:19 | 19 → 20 | $10.62M → $10.98M | 5.4% → 5.5% | 15 → 18 | AR, BR, HK |
| **All five** | **139 → 159 (+14%)** | **$198.1M → $205.4M (+4%)** | **8.4% → 8.8%** | | |

By chain over the five hours (active wallets = evidenced wallets that moved money in the hour, averaged):

| Chain | Filter slots | Active wallets / hour | Corridor-hours | Attributed | Pooled share |
|---|---|---|---|---|---|
| Ethereum | 805 → 824 of 1000 | 63 → 74 | 137 → 155 | $197.1M → $203.3M | 9.6% → 10.0% |
| Base | 815 → 831 of 4800 | 16 → 17 | 16 → 17 | $248k → $248k | 0.3% → 0.3% |
| Arbitrum | 773 → 799 of 997 | 19 → 28 | 28 → 37 | $0.73M → $1.89M | 0.3% → 0.9% |

A re-run on 2026-09-21 reproduced every figure exactly, with no failed block queries.

**Why hour C falls:** one address, 0x0b2fdf41…c8c2, was inferred as a Binance deposit address under the old
registry, carrying $8.00M of US→KY value. The new wallets reveal more of its inflows ($8.00M → $11.60M visible),
and it forwarded $9.05M to Binance, 78%, under the 80% threshold, so inference now correctly refuses it. More
evidence can remove an inference that rested on a partial view; `--explain` prints each such case.

Activity baselines from the same day (`scripts/measure-activity.mjs`, 4-hour windows, face value):
- **Ethereum:**
  - In US hours, 78 of 805 wallets were active and $3.72B touched the registry. Cross-entity value was $81.9M,
    all with a market maker, broker or custodian on one end.
  - In Asian hours, 74 were active and $1.10B touched the registry.
- **Base:** 23 and 16 of 815 filtered addresses were active.
- **Arbitrum:** 22 and 19 of 773 were active.
- **Dormancy:** 665 of the 805 Ethereum wallets moved nothing in 90 days.
