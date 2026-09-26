# Dormant tier measurements, 2026-09-21 to 2026-09-22

`node scripts/registry/measure-dormancy.mjs` over the 90 days to 2026-09-21 (all chains read to the end, no failed
queries), registry after removing FalconX and Copper. Re-run over the 90 days to 2026-09-22 after removing the other
eight brands that failed the same operator test (BitGo, Cumberland DRW, Galaxy Digital, Jump Trading, B2C2, GSR, Zero
Hash, Amber Group; docs/DECISIONS-2026-09.md). The result is `scripts/registry/dormancy.json`.

| Chain | Evidenced (FalconX/Copper removed) | Active | Dormant | Evidenced (all ten removed) | Active | Dormant |
|---|---|---|---|---|---|---|
| Ethereum | 812 | 153 | 659 (81%) | 794 | 139 | 655 (82%) |
| Base | 819 | 55 | 764 (93%) | 802 | 54 | 748 (93%) |
| Arbitrum | 787 | 48 | 739 (94%) | 770 | 45 | 725 (94%) |

The live filter before any of the ten removals was Ethereum 824, Base 831, Arbitrum 799.

Activity means at least one non-zero USDC or USDT transfer sent or received. Dust counts (a wallet that only received
$0.01 dust is "active"), so the tier errs towards keeping wallets.

## What a visitor's browser sends (measured in the built site, 2026-09-21)

Request bodies for one filtered `eth_getLogs` call, read from `fetch` in the running page:

| Chain | Addresses | Body now | Body before (about) | Requests per backfilled hour |
|---|---|---|---|---|
| Ethereum | 153 | 10,852 B | 56 KB | 12 |
| Base | 55 | 4,045 B | 57 KB | 4 |
| Arbitrum | 48 | 3,609 B | 55 KB | 24 |

Upload for the backfilled hour falls from about 2.2 MB to about 0.23 MB (-89%). Download is unchanged (4.1 MB), because
the wallets that left the filter had no transfers to send back.

## Does the tier lose anything? Replay of stored hours

`measure-corridors.mjs` over hour A (17:22-18:22 UTC) and hour C (15:15-16:18 UTC) of 2026-09-21, same chain history and
prices:

- **Dormant tier only** (new registry, whole registry as filter versus the live filter, `--full-filter`): identical.
  Hour A gives 36 corridors and $72.34M attributed both ways. This is expected in-sample (a dormant wallet had no
  transfers in these hours by definition), so it checks the mechanism, not the future.
- **Removing FalconX and Copper** (D3, first pass): hour A corridors 36 to 36, attributed $73.35M to $72.34M
  (-$1.0M, -1.4%), of which $0.5M was Arbitrum (FalconX 1 was labelled there). Hour C: attributed $41.15M both ways,
  one fewer jurisdiction lit (18 to 17).
- **Removing the other eight** (D3, second pass: BitGo, Cumberland, Galaxy, Jump, B2C2, GSR, Zero Hash, Amber Group):
  hour A corridors 36 to 33, attributed $73.35M to $66.18M (-9.8%), jurisdictions lit unchanged (20). Hour C corridors
  unchanged at 41, attributed $41.15M to $39.52M (-4.0%), one fewer jurisdiction lit (18 to 17). `--explain` shows most
  of the loss is deposit-address inferences that used to resolve to BitGo or Zero Hash: the unlabelled deposit address
  is unaffected, but with the anchor entity gone its inflow is no longer attributed. One deposit address that used to
  be read as BitGo's now correctly resolves to Coinbase instead.

## Out of sample: what would a tier built 30 days ago have missed?

Dormancy measured as of 2026-08-22 (`--days 90 --end-days-ago 30`), then every transfer of the wallets that woke
since (dormant then, active in the production measurement), classified by whether the other end was a wallet the
filter would have watched (then the transfer is seen anyway) or not (then it is missed).

| Chain | Dormant then | Woke since | Transfers | Seen anyway (watched counterparty) | Missed |
|---|---|---|---|---|---|
| Ethereum | 648 | 11 | 56 | 3 transfers, $161M | 53 transfers, $11.0M, all with an unlabelled counterparty |
| Arbitrum | 738 | 1 | 1 | none | 1 transfer, $199.90, unlabelled counterparty |

- **No missed transfer had evidenced wallets at both ends**, so no corridor between two registry wallets was lost.
  A missed transfer with one unlabelled end can at most have lit a glow or fed a deposit-address inference.
- $11.0M of the Ethereum misses is four Galaxy Digital transfers; the rest is dust and $3.9k at Coinone.
- Base was not validated out of sample (a Base rescan takes about 30 minutes on the one endpoint that serves it).
  Its in-sample result is 55 active of 819.
- For scale, Ethereum registry value on 2026-09-21 was about $3.7B in a four-hour US window
  (`measure-activity.mjs`, face value, intra-entity moves counted), which is roughly $0.7T over 30 days, so $11M is far
  under 0.1% of it. That is an extrapolation from one window, indicative only.
