# Landmarks: the data behind `landmarks.html`

The second page of the site lists landmark transactions, all-time and recent, with analysis. It is static HTML
written at build time; only today's prices are fetched in the visitor's browser. Decision D7 in
`docs/DECISIONS-2026-09.md` sets who it may name; HANDOFF section 19 has the history and the verification.

| File | What it is | Written by |
|---|---|---|
| `entries/<id>.md` | One entry: a ```json block of facts, then four prose sections | hand, after research |
| `config.json` | The fixed recent window (`recent.start`, `recent.end`) and where all-time starts | hand, monthly |
| `chain-facts.json` | Every reading of every transaction, candles, supply, match proofs, source checks, milestones | `fetch-facts.mjs` |
| `measured.json` | The measured tables: USDT supply events, USDC mints and burns, transfers between registry wallets | `measure-largest.mjs` |
| `lib/landmarks/data.ts` | The numbers the island needs (GENERATED, never edit) | `gen-landmarks.mjs` |

`build.mjs` joins and checks everything (pure, no network); `html.mjs` and `charts.mjs` render the page;
`page.mjs` is what the Vite plugin calls. `scripts/verify-landmarks.mjs` is the gate inside `verify-all.mjs`.

## Monthly refresh (about an hour)

1. Move the window in `config.json`: the 90 days ending on the last day of the previous month.
2. `node scripts/landmarks/measure-largest.mjs` (about ten minutes; it re-reads the tags of every wallet it shows).
3. Research events in the new window. Use primary documents (court filings, government releases, the party's own
   statements). Research agents use WebSearch and WebFetch only; PDFs through WebFetch or the source check below.
4. Add or edit entries. A recent entry whose transactions leave the window either becomes `"list": "all-time"`
   (only if it still qualifies) or is deleted.
5. Re-check every story's status (pardons, recoveries, court outcomes, revised figures) and update `status.asOf`.
6. `node scripts/landmarks/fetch-facts.mjs` (new entries only; `--refresh` re-reads everything, `--only <id>` one entry).
7. `node scripts/landmarks/gen-landmarks.mjs`, then `node scripts/verify-all.mjs` and `corepack pnpm build:live`.

A late refresh is stale but never false: every window and status carries its own date. The gate warns when
`chain-facts.json` or `measured.json` is more than 45 days old; it does not fail on age.

## Writing an entry

```
{
  "id": "ronin-2022",                 // equals the file name
  "list": "all-time" | "recent",
  "category": "milestone" | "record" | "fee" | "supply" | "dormant" | "theft" | "seizure",
  "label": "Ronin bridge",            // 24 characters or fewer, drawn beside the light; no digits
  "title", "dek", "criterion",        // may use placeholders; digits need a source marker
  "priority": 1-10,                   // label priority in the field
  "legs": [{
    "id": "leg1", "chain": "Ethereum", "txid": "0x...",
    "idSource": 1 | "m1",             // a source that prints this txid (listed in its txids), or a match proof
    "basis": "btc-output" | "coinbase" | "tx-value" | "erc20-log" | "token-event" | "trace" | "balance-delta",
    "output": 0, "logIndex": 29,      // for btc-output; erc20-log and token-event
    "event": "0x...",                 // token-event: the topic of the issuer's supply event (USDT Redeem or Issue)
    "trace": {"from": "0x...", "to": "0x..."},   // for trace and balance-delta
    "check": {"logAmount": 66} | {"balanceDelta": "0x..."},   // optional second reading of the amount
    "asset": "ETH",
    "follows": "leg1",                // optional: moves coins an earlier leg already moved (a forward, a return);
                                      // drawn and told, never added to a total
    "from": {"role": "...", "label": "...", "evidence": {...}, "person": true, "personBasis": "self" | "convicted"},
    "to": {...},
    "todayApplicable": true, "todayReason": "..."   // false for coins that can never move, frozen or burned
  }],
  "matches": [{"id": "m1", "source": 1, "type": "btc-output-value" | "btc-first-transfer" | "btc-coinbase" |
               "btc-address-spend" | "evm-first-tx" | "evm-event-scan", "set": true, ...}],
  "balances": [{"id": "b1", "chain": "Ethereum", "address": "0x...", "asset": "ETH", "blocks": [n, ...]}],
  "attributions": [{"source": 2, "claim": "...", "date": "YYYY-MM-DD"}],   // a court or government document's claim
  "status": {"asOf": "YYYY-MM-DD", "text": "..."},
  "sources": [{"n": 1, "kind": "document" | "reporting" | "data", "docType": "court" | "government" | "party",
               "publisher", "title", "date", "url", "archive": "https://web.archive.org/web/<14 digits>/...",
               "read", "quote" (under 15 words), "txids": [], "addresses": []}]
}
```

Match types. `btc-output-value`: every transaction in a window paying an exact value. `btc-first-transfer`: the first
non-coinbase transaction. `btc-coinbase`: a block's reward. `btc-address-spend`: every spend from an address in a
window. `evm-first-tx`: every block header from genesis to the first block holding a transaction, with each gas limit
checked against the protocol's 1/1024 rule and the last blocks re-read on a second operator. `evm-event-scan`: every
event of one topic from one contract over a block range (no `source`; the chain alone). A match identifies a
transaction only when it finds exactly one; `"set": true` (and every `evm-event-scan`) instead means the read is a
complete set, and the entry must show every member.

Balance reads give a total no single transaction carries (the DAO drain, a genesis allocation): every operator reads
the native balance at each block and they must agree. Placeholders `{{b1.at0}}`, `{{b1.block0}}`, `{{b1.date0}}`,
`{{b1.time0}}` (one set per block) and `{{b1.change}}` (first to last).

Evidence for a name (D7): `{"kind": "tag", "host": "etherscan.io", "tag": "...", "read": "...", "alerts": [...]}`
(read it with `node scripts/registry/read-tag.mjs`; a compilation, report or "Submitted by" banner disqualifies it);
`{"kind": "document", "source": n, "identifies": "address" | "tx"}`; or
`{"kind": "matched", "source": n, "match": "m1"}` where m1 found exactly one transaction and is the leg's idSource.

Prose: four sections, `## What happened`, `## What the chain shows`, `## Why it matters`, `## What happened next`.
Every on-chain number is a placeholder (`{{leg1.amount}}`, `{{leg1.usdThen}}`, `{{leg1.date}}`, `{{leg1.block}}`,
`{{leg1.fee}}`, `{{leg1.feeUsd}}`, `{{leg1.share}}`, `{{leg1.inputs}}`, `{{leg1.inputTotal}}`, `{{leg1.changeBack}}`,
`{{leg1.txAmount}}`, `{{leg1.txShare}}` (all counted outputs of the leg's transaction), `{{leg1.coinAge}}`,
`{{leg1.oldestInput}}`, `{{m1.txs}}`, `{{m1.maxGas}}`, ...). A label or title cannot carry a digit (it has no room for a
marker), and a tag name with digits ("Bitget 6") cannot be quoted in prose; describe it instead. Any other digit, and any superlative
(largest, first, earliest, highest, ...), needs a marker in the same sentence: `[2]` for source 2, `[m1]` for a proof.
Describe what the chain shows; attribute every other claim; no speculation about intent and no investment advice.

`fetch-facts.mjs` then reads each source's archived copy and records whether every listed txid, address and quote
is really in it; the gate fails if not. A source we could not read ourselves supports nothing.
