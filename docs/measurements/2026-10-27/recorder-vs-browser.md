# Does the history recorder seal what a browser seals? (2026-10-27)

Decision D8 adds a shared history recorder (`worker/`) so that the 24H and 7D windows work for a first-time visitor. The
page was to use its spans only after they had been compared with a browser's own for the same quarter hours. This is
that comparison.

**Result: the recorder reads the same transfers as a browser, and seals them correctly. The browser did not.** It sealed
a quarter hour from whatever it had read when its once-a-minute check fired after the close. On Tron, where exchanges
sweep deposits within minutes, that regularly left out a sweep made just after the close, and with it the inference
that places the deposit. The fix makes the browser seal by the recorder's rule (section 4). The recorder was then
switched on.

## 1. Method

- **Browser:** the dev page (`pnpm dev:live`) in one tab, loaded 2026-10-26 20:31:34 UTC and left alone for about 21 h.
  Its sealed spans were read from IndexedDB.
- **Recorder:** the day files at `https://bfm-recorder.jakepercy.workers.dev/`, decoded with `decodeDay`.
- **Compared:** every (chain, quarter hour) both hold, restricted to steady state:
  - the browser sealed it within 3 minutes of its end;
  - its end was at least 90 minutes after the tab loaded, so the browser had a full 90-minute context.
- **Coverage:** every row was fully observed by both (900 s of 900).
- **Data:** 488 rows, 7 chains, 2026-10-26 22:00 to 2026-10-27 16:15 UTC, in
  [`recorder-vs-browser.csv`](recorder-vs-browser.csv). Every figure below is computed from it.
  - A first pass at 17:25 UTC covered 510 rows to 17:00 and gave the same picture.
  - The CSV was rebuilt after a reload, so the last quarter hours, which the reload re-sealed, drop out.

## 2. Reading agrees

| Chain | Quarter hours | Transfers, browser | Transfers, recorder | Quarter hours with equal counts |
|---|---:|---:|---:|---:|
| Ethereum | 69 | 95,833 | 95,833 | 67 |
| Tron | 70 | 336,884 | 336,884 | 70 |
| Base | 70 | 12,238 | 12,238 | 70 |
| Arbitrum | 69 | 13,215 | 13,215 | 44 |
| Avalanche | 70 | 4,613 | 4,602 | 35 |
| Polygon | 70 | 4,076 | 4,077 | 64 |
| Optimism | 70 | 279 | 279 | 70 |

Over the period, totals are equal on five chains, differ by 1 transfer on Polygon, and differ by 11 of 4,613 (0.2%)
on Avalanche.

Where a single quarter hour differs, the opposite difference usually sits in the quarter hour next to it. A transfer
near a boundary is placed by an interpolated block time, and the two readers interpolate over different read ranges.
This happens most on Arbitrum and Avalanche, whose block times are least regular.

Observed USD agrees to within a few parts in ten thousand. The two price the same transfers from different samples.

## 3. Attributed value did not agree

| Chain | Attributed, browser | Attributed, recorder | Total difference | Median per quarter hour | Recorder higher / browser higher (>1%) |
|---|---:|---:|---:|---:|---:|
| Ethereum | $303.2M | $300.4M | -0.9% | 0.04% | 7 / 8 |
| Tron | $51.1M | $94.7M | **+46.1%** | **28.5%** | **60 / 2** |
| Base | $400K | $402K | +0.5% | 0.02% | 6 / 2 |
| Arbitrum | $2.53M | $3.16M | +20.0% | 0.02% | 5 / 3 |
| Avalanche | $4.20M | $4.19M | -0.3% | 0.03% | 5 / 4 |
| Polygon | $5.7K | $6.2K | +8.1% | 0.00% | 1 / 0 |
| Optimism | $525 | $525 | 0 | 0 | 0 / 0 |

Outside Tron, the typical quarter hour agrees to a few hundredths of a percent. The totals are moved by a handful of
quarter hours, in both directions; Arbitrum's 20% comes from two, at 01:00 and 02:45. On Tron the recorder placed more
in 60 of 70 quarter hours.

## 4. Why: the browser sealed before it had read the sweep

A deposit address is inferred, not labelled: an unlabelled address that received from outside an exchange and
forwarded at least 80% of it to that exchange's labelled wallet (`inferDeposits`, approved 2026-09-18). A quarter hour's
seal can only use sweeps already in its context.

**One quarter hour checked on-chain:** Tron, 2026-10-27 06:00. Its seal points:

| | Seal point | Context includes |
|---|---|---|
| Recorder | 06:17:00 (end + 2 min, once its reading has passed that point) | the sweep |
| Browser | 06:16:55 (115 s after the end) | reads only up to a few seconds earlier: no sweep |

The browser had read only up to a few seconds before its seal: it polls every 20 s, and the check fires once a minute.

1. 06:07:18: 19,999,999 USDT left a Binance wallet for the unlabelled address `0x160fc104…2dd3`.
2. 06:16:42: that address forwarded all of it to `0xcebabc6a…9813`, a KuCoin wallet in the registry. That was 102 s after
   the quarter hour closed.
3. The recorder placed the transfer as Binance (KY) to KuCoin (SC), $19.97M. The browser left it as "Receiver unknown":
   it attributed $40K in that quarter hour, the recorder $20.05M.

The sweep landed in the next quarter hour, so the 06:00 one was never marked for re-sealing and kept the shortfall.
Tron's exchanges sweep within minutes and Tron moves the most watched transfers, so Tron shows the effect most.

More context can also remove an inference: if the address sends part of its balance somewhere else, it is not an
exchange deposit address. That is why some quarter hours on other chains have the browser higher.

## 5. Fix, and the recorder switched on

The browser now uses the recorder's rule (`sealDue` in `lib/atlas/live-client.ts`, `SEAL_DELAY_MS` in
`lib/atlas/recorder-core.ts`, shared by both):

- a quarter hour is sealed once this feed has **read** to its end plus 2 minutes, not once the clock has passed its end;
- its inference context ends at that same point.

So the browser and the recorder seal from the same window of the same transfers. `pickSpans` still takes the
better-observed span of the two, and the recorder's on a tie.

With that in place, `RECORDER_URL` in `lib/site/links.ts` was set to `https://bfm-recorder.jakepercy.workers.dev/`.

## 6. After the fix

The dev page was reloaded with the fix at 17:42 UTC. It sealed the 17:30 quarter hour at its end + 212 s: the first
once-a-minute check after its reads had passed 17:47.

| Chain | Transfers, browser / recorder | Attributed, browser | Attributed, recorder |
|---|---:|---:|---:|
| Ethereum | 1,753 / 1,753 | $3,142,425 | $3,142,481 |
| Tron | 5,402 / 5,402 | $113,369 | $114,613 |
| Arbitrum | 219 / 219 | $5,815 | $5,815 |
| Avalanche | 79 / 78 | $7,275 | $7,275 |
| Base | 236 / 236 | $6 | $6 |
| Polygon | 64 / 64 | $0 | $0 |
| Optimism | 3 / 3 | $0 | $0 |

Attributed value is now identical on five chains and within 0.002% on Ethereum. Tron's remaining 1.1% is expected
here: the tab had been open only 8 minutes, so its context reaches back to its one-hour load backfill, not the recorder's
full 90 minutes. Before the fix the median Tron quarter hour differed by 28.5%. Avalanche's one-transfer difference
is a boundary transfer, as in section 2.
