# The history recorder

A Cloudflare Worker that records the map's 24H and 7D history around the clock, so those windows are ready when the
page opens (decision D8 in [`docs/DECISIONS-2026-09.md`](../docs/DECISIONS-2026-09.md)). It reads the same keyless public
endpoints the page reads (`lib/atlas/feeds.ts`) and seals the same 15-minute spans through the same code
(`lib/atlas/recorder-core.ts`). It publishes nothing but those spans.

## What it does every minute

1. **Prices.** Every fifth minute it fetches the page's three providers (CoinGecko, Coinbase Exchange, Kraken). While a
   backfill is running it also fetches Bitstamp's 5-minute candles.
2. **Live reading.** It reads each chain's new blocks with the page's filtered `eth_getLogs` query.
3. **Backfill.** It reads up to four chunks per chain backwards in time, from the moment the recorder first started,
   until a week plus 90 minutes has been read. The most recent day is therefore sealed first: 24H is complete
   within about an hour, and 7D within hours (Arbitrum is the slowest). Backfill reads stop 20 seconds into a run,
   and a chain's backfill pauses while more than 8 of its quarter hours are waiting to be sealed.
4. **Sealing.** It seals every quarter hour whose 90 minutes of context have been read, newest first.
   - A chain's quarter hours are sealed up to eight at a time from one load of its rows. Each is still sealed at its
     own seal point, from its own 90 minutes. Loading each context separately reread the same rows over D1's network
     and fell behind on Cloudflare.
   - Each transfer is priced from the first of the page's providers holding a sample within ten minutes of its block.
   - A backfilled transfer that none of them can price is priced from Bitstamp.
   - A transfer nothing can price stays unpriced.
5. **Publishing and pruning.**
   - Each changed UTC day is written to R2 as one gzipped file, named by its content hash, and then the manifest.
   - Raw transfers and price samples are deleted once no unsealed quarter hour needs them.
   - Spans are kept 8 days.

## The public API

| Path | What | Cache |
|---|---|---|
| `GET /v1/manifest` | `format`, `dayFormat`, `schema`, `registry`; per chain `liveSince` (spans ending at or before it were backfilled), `backfilledTo` and `backfillDone`; and the day files | 60 s |
| `GET /v1/day/<day>.<hash>.json` | One UTC day of spans in the `bfm-day/1` format | immutable |

Every response carries `Access-Control-Allow-Origin: *`. Anything other than GET, HEAD or OPTIONS is refused.

**The day-file format.** It is a lossless encoding of the stored spans (`StoredRollup`, `lib/atlas/rollup.ts`).
- Each span is a positional tuple, as written by `encodeDay` and read by `decodeDay` in `recorder-core.ts`.
- Values the reader can recompute exactly are left out: the span's end, its attributed value, both coverage ratios,
  corridor IDs, and the unmapped entities, which repeat the jurisdictions' entity rows.
- A span that does not fit the tuple is carried whole.
- `scripts/verify-recorder.cjs` checks that decoding gives back the same JSON text.

A fully priced week is about 2.6 MB gzipped.

## Running it

Run wrangler 4.148.0 from the repository root. It needs no account ID or secret in this folder.

1. **Once, on the Cloudflare account** (Workers Paid, with R2 enabled):
   ```
   npx wrangler@4.148.0 d1 create bfm-recorder
   ```
   Put the printed `database_id` into `wrangler.toml`. Then create the bucket:
   ```
   npx wrangler@4.148.0 r2 bucket create bfm-history
   ```
2. **Schema and deploy:**
   ```
   npx wrangler@4.148.0 d1 migrations apply DB --remote --config worker/wrangler.toml
   npx wrangler@4.148.0 deploy --config worker/wrangler.toml
   ```
3. **Locally:**
   ```
   npx wrangler@4.148.0 d1 migrations apply DB --local --config worker/wrangler.toml
   npx wrangler@4.148.0 dev --config worker/wrangler.toml --test-scheduled
   ```
   Then request `http://localhost:8787/__scheduled?cron=*+*+*+*+*` once per run. Local state stays in `worker/.wrangler/`,
   which Git ignores.

`node scripts/verify-all.mjs` type-checks this folder against `@cloudflare/workers-types`. The page does not read the
recorder until its address is set in `lib/site/links.ts` (plan step B5). Until then, nothing changes for visitors.
