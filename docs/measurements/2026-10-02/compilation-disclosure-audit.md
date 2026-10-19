# Compilation-disclosure audit: first-party rows read before the `read-tag.mjs` fix (2026-10-02)

Until 2026-10-02, `scripts/registry/read-tag.mjs` matched the Etherscan-family banner "This address has been tagged
based on ... compilation" on raw HTML with `([^<.]+)`. When the compilation's name is a link
(`<a href="https://dune.com/queries/...">hildobby</a>`) the match failed and the disclosure was silently dropped. The
fixed script reads each address banner as text. This report re-reads every first-party row whose note does not already
mention a compilation.

Per-row results (all 705 rows, with the exact proposed note text): `compilation-disclosure-audit.tsv`, kept offline since 2026-10-18 (it is a bulk list of explorer tags).

## Result in one paragraph

**106 of the 705 re-read rows carry a compilation disclosure the registry had not recorded**, every one crediting
**hildobby**. All 705 tags still match the row's `label` verbatim, no row lost its tag, and no row shows a third-party
report banner. The 106 sit almost entirely on Ethereum (74), Polygon (15) and Avalanche (13), plus Base (4). **The audit
cannot see 63 rows**: Arbiscan and Optimistic Etherscan answer 403 on address pages, so `read-tag.mjs` reads their
`/txs?a=` header, and that page carries the tag but not the banner (checked below). Nothing was changed in the registry,
the entities or any confidence level.

## 1. Measurement before the re-read

First-party rows in `scripts/registry/addresses.txt`: **1,189**. A row counts as already recorded when its note contains
"compilation" or "tagged based". 484 do (Ethereum 369, Base 109, Arbitrum 6). **705 do not.** Notes that only say
"Dune spellbook lead" describe how a lead was found, not an explorer disclosure, so those 22 rows were re-read too.

| Explorer host | Rows without a compilation note | Entry dates of those rows (`checked`) |
|---|---|---|
| etherscan.io | 453 | 2026-09-18 (406), 09-21 (19), 09-24 (17), 09-29 (6), 10-01 (4), 09-22 (1) |
| basescan.org | 153 | 2026-09-20 (148), 09-21 (2), 10-01 (2), 09-24 (1) |
| arbiscan.io | 57 | 2026-09-20 (42), 09-21 (13), 09-24 (1), 10-01 (1) |
| polygonscan.com | 20 | 2026-10-01 (20) |
| snowscan.xyz | 16 | 2026-09-28 (5), 09-29 (2), 10-01 (9) |
| optimistic.etherscan.io | 6 | 2026-10-01 (6) |

## 2. Method

- `node scripts/registry/read-tag.mjs <host> <addr>...` itself, in batches of 40, one process at a time, small hosts
  first, at the script's own 2.5 s pause (`PAUSE_MS`). The runner would have stopped on the first non-zero exit (a
  non-200 or a challenge page). **None occurred**: 705 reads, 705 HTTP 200s, no 403, 429 or challenge.
- Control: the Bybit example from the bug report, `0x1db92e2e...cf4` ("Bybit: Cold Wallet 1"), printed
  `[explorer discloses: tagged based on hildobby compilation]` with the fixed script.
- Per address: tag text compared with the row's `label` after Unicode normalisation; disclosure; any other banner.
- Five further single requests went to etherscan.io and arbiscan.io: the Bybit control, two Arbiscan rows and one raw
  `/txs?a=` page for the banner check in section 4, and one address page to read the "Gemini's Cold Wallet" banner.

## 3. Results

| Host | Rows read | Newly disclosed (hildobby) | Other banners | Tag differs from `label` | No tag |
|---|---|---|---|---|---|
| etherscan.io | 453 | **74** | 3 (informational, below) | 0 | 0 |
| basescan.org | 153 | **4** | 1 (informational) | 0 | 0 |
| polygonscan.com | 20 | **15** | 0 | 0 | 0 |
| snowscan.xyz | 16 | **13** | 0 | 0 | 0 |
| arbiscan.io | 57 | 0, **not detectable** | 0 | 0 | 0 |
| optimistic.etherscan.io | 6 | 0, **not detectable** | 0 | 0 | 0 |
| **Total** | **705** | **106** | 4 | 0 | 0 |

**Other banners (4, none a third-party report).** `Gemini 3` and `Kraken 6` (Ethereum; `Kraken 6` also on Base) show a dark
banner reading "Gemini's Cold Wallet" / "Kraken's Cold Wallet", an Etherscan annotation of the wallet's role.
`Poloniex 1` shows an unclaimed-ETH notice for the 2016 HongCoin ICO contract. None is a "Reported by ..." or "reported
to be involved in ..." banner, and none bears on who controls the address. No row triggered the plumbing flag.

**The newest chains are the most compilation-sourced.** Among the re-read rows, 15 of 20 Polygon and 13 of 16 Avalanche
rows are hildobby-credited, against 4 of 153 on Base and 74 of 453 on Ethereum.

**Registry-wide after this audit.** 484 recorded + 106 newly found = **590 of 1,189 rows (49.6%)** carry a disclosed
compilation origin. Counting only the four hosts where the banner is visible (Ethereum, Base, Avalanche, Polygon: 1,120
rows) it is 584 (52.1%). The true figure is higher: 63 rows could not be audited.

## 4. What this audit cannot see: Arbiscan and Optimistic Etherscan (63 rows)

Arbiscan's address pages return 403 to bots (HANDOFF rule 4), so the script reads `/txs?a=<addr>` and takes the tag from
its header. **That page has no compilation banner.** Evidence: `Binance 54` (`0xb38e8c17...91d`) and `MEXC 10`
(`0x9b642038...f9e5`) are Arbitrum rows whose notes already say "Arbiscan discloses the label as sourced from a public
researcher compilation", yet `read-tag.mjs arbiscan.io` prints no disclosure for either, and the raw `/txs?a=` HTML for
`Binance 54` contains none of "tagged based", "compilation" or "hildobby". Optimistic Etherscan uses the same header
route and the same template, so it is treated the same (this is inferred, not separately tested: no Optimism row has a
recorded disclosure to use as a control).

So for these 63 rows (Arbitrum 57 and Optimism 6 without a note; Binance 14, Coinbase 14, KuCoin 6, MEXC 4, Bitget 4,
Robinhood 4, OKX 3, and 14 others at 1 or 2 each) the audit **confirms the tag text and nothing else**. "No disclosure
printed" there does not mean none exists. I did not look for a way around the 403. Options: Jake reads the 63 address
pages in his own browser (the TSV lists them, `banner_visible_on_route` = no), or `read-tag.mjs` prints a warning for
these two hosts so a silent "nothing found" cannot be mistaken for a clean read. The second is a change to the shared
`tag-reader.mjs`, which the Landmarks scan also uses, so I left it alone.

## 5. Proposed note change (needs Jake's go-ahead; nothing applied)

Row notes ship in the bundle: `known-addresses.ts` carries them and `known-entities.ts` puts each into the row's
evidence note shown to visitors. So this edit changes the built page. For each of the 106 rows, append to the note,
matching the existing wording and naming the compiler:

> `<Explorer> discloses the label as sourced from the hildobby public researcher compilation (read 2026-10-02).`

`<Explorer>` is Etherscan, Basescan, Snowscan or Polygonscan. The exact per-row text is in column
`proposed_note_addition` of the TSV. The `checked` date is left as is; applying means appending to the note column of the
106 rows, running `gen-addresses.mjs` and `verify-all.mjs`.

Rows by entity (all hildobby; "Conf." is the entity's current confidence):

| Entity | Conf. | New | Where |
|---|---|---|---|
| CoinSpot | VERIFIED | 19 | Ethereum 17, Avalanche 1, Polygon 1 |
| OKX | VERIFIED | 9 | Ethereum 6, Avalanche 2, Base 1 |
| Binance | VERIFIED | 8 | Ethereum 2, Avalanche 6 |
| BtcTurk | VERIFIED | 8 | Ethereum 7, Avalanche 1 |
| Coinmetro | HIGH | 5 | Ethereum 5 |
| Lemon Cash | HIGH | 5 | Ethereum 4, Polygon 1 |
| Coinbase | VERIFIED | 4 | Polygon 4 |
| KuCoin | HIGH | 4 | Ethereum 2, Avalanche 1, Polygon 1 |
| Bitso | HIGH | 4 | Ethereum 2, Avalanche 1, Polygon 1 |
| Bitkub | VERIFIED | 4 | Ethereum, Base, Avalanche, Polygon 1 each |
| Shakepay | VERIFIED | 4 | Ethereum 4 |
| Upbit | VERIFIED | 3 | Ethereum, Base, Polygon 1 each |
| HashKey Exchange | HIGH | 3 | Ethereum 3 |
| CoinJar | HIGH | 3 | Ethereum 3 |
| MEXC | VERIFIED | 2 | Polygon 2 |
| Bitget | VERIFIED | 2 | Ethereum 1, Base 1 |
| Bitpanda | HIGH | 2 | Ethereum 1, Polygon 1 |
| Coinsquare | VERIFIED | 2 | Ethereum 2 |
| Coinhako | VERIFIED | 2 | Ethereum 2 |
| BTC Markets | HIGH | 2 | Ethereum 2 |
| one row each | | 11 | Ethereum: Bithumb, Bitvavo, Bitcoin Suisse, BitoPro, Coins.ph, NBX, Digital Surge, Wealthsimple, Mercado Bitcoin. Polygon: Robinhood, Paxos / itBit |

## 6. Should any entity drop from VERIFIED to HIGH? Recommendation: no change, Jake to decide

**Where the rule comes from.** The sentence "it can lower an entity's confidence to HIGH" appears in this repository
only in the comment of the old `read-tag.mjs`, which the 2026-10-02 edit removed. The written rules do not state it.
The `known-entities.ts` header defines `HIGH` as "tag + corroborated jurisdiction, but the brand runs several separately
regulated affiliates", and HANDOFF section 6 says only that a disclosure "goes into the row's note". There is no
threshold (one row, a share of rows, every row) anywhere.

**What practice shows.** The registry is inconsistent in both directions:
- HIGH, citing disclosure with other grounds: Bitpanda ("every tag is disclosed ... and the group runs separately
  regulated affiliates"), Anchorage, Bullish.
- VERIFIED although every detectable tag is disclosed: GMO Coin (7 of 7), bitbank (5 of 5), Netcoins (3 of 3), NDAX (1 of 1),
  and Bitvavo (whose own entity note says its tags are compilation-sourced).

**Entities this audit newly brings to "every detectable row disclosed"** (counting only rows on the four readable hosts):

| Entity | Conf. | Disclosed / readable rows | Rows not auditable |
|---|---|---|---|
| Bitvavo | VERIFIED | 12 / 12 | 1 (Arbitrum) |
| Bitcoin Suisse | VERIFIED | 3 / 3 | 0 |
| BitoPro | VERIFIED | 3 / 3 | 0 |
| Digital Surge | VERIFIED | 1 / 1 | 0 |
| Wealthsimple Crypto | VERIFIED | 1 / 1 | 0 |

Already HIGH, so unaffected: Lemon Cash, Bitso, CoinJar, Bitpanda, BTC Markets, Mercado Bitcoin (all now at every readable
row). Entities with many rows (Binance 20%, OKX 27%, KuCoin 15% of readable rows) are far from "every tag".

**Recommendation.** Do not change any confidence level on this evidence:
1. The disclosure concerns who named the wallet; VERIFIED rests on the operator's own document naming one legal entity
   (rule 2), which this audit does not touch.
2. Applying "all readable rows disclosed means HIGH" would flip these five **and** GMO Coin, bitbank, Netcoins and NDAX,
   which nobody questioned when they were added. That is a policy change, not a correction.
3. VERIFIED to HIGH changes the shown confidence and score (0.95 to 0.85). Both clear the 0.80 route threshold, so no
   route appears or disappears; the methodology says ranking uses confidence, so ordering could move slightly.

If Jake prefers the strict rule, the nine VERIFIED entities to move are Bitvavo, Bitcoin Suisse, BitoPro, Digital Surge,
Wealthsimple Crypto, GMO Coin, bitbank, Netcoins and NDAX, and the rule should be written down in `known-entities.ts` and
HANDOFF section 2 (it currently is not). Confidence levels are unchanged until he decides.

## 7. A larger question this surfaces

HANDOFF rule 1 says researcher compilations "are not admissible sources", and also that the explorer's own page showing a
name tag is the evidence. 590 of 1,189 rows (at least half) are tags the explorer itself says it copied from hildobby's
compilation. The registry has always admitted them with a note, so this is not new, but the first-party count is
softer than "explorer-labelled" suggests. D7 (the Landmarks page) draws the opposite line: a compilation-credited tag
names nobody there. Whether the map should keep "the explorer shows the tag" as its standard is Jake's call; nothing here
changes it.

Landmarks note (not touched): D7 requires a tag the explorer credits to no outside source. On Arbiscan and Optimistic
Etherscan the shared `tag-reader.mjs` cannot see that credit (section 4), so a Landmarks entry named from an Arbiscan or
Optimistic Etherscan tag could not meet D7 by that route.

## 8. Verification (2026-10-02, with the working tree as it stood, Landmarks work included)

- `node scripts/verify-all.mjs`: passed ("All integrity checks passed"; registry 1,189 first-party plus 3,567 derived,
  64 entities, 29 jurisdictions, evidence valid through 2027-03-17).
- `node node_modules/typescript/bin/tsc --noEmit`: clean.
- `corepack pnpm build:live`: built.
- The audit changed no registry, entity or generated file, so these results describe the tree as it was.

Side note: all 705 tags were re-read today and matched, which is real re-verification for those rows. Their `checked`
dates were not bumped, because that was not asked for and the other 484 rows were not re-read.
