# Prompt: add more real flows and countries

Written 2026-09-21. Paste the fenced block into a fresh agent session, or tell the agent
"Follow docs/PROMPT-add-flows.md". It assumes the agent reads `HANDOFF.md` first.

Why it is shaped this way: a first draft counted wallets and entities. Measuring the live
registry against real chain data showed that activity, hub structure and the RPC filter-slot
budget decide what appears on the map, so this version measures first and ranks work by
activity. The numbers in the prompt are a snapshot; the scripts below reproduce them.

Tools written for this prompt (all read-only against public endpoints, none shipped in the build):

| Script | Purpose |
|---|---|
| `scripts/measure-activity.mjs` | Per-chain, per-window activity of the registry: active wallets, idle entities, direct edges, top unlabelled counterparties |
| `scripts/probe-endpoint-caps.mjs` | Per-endpoint CORS, block-range cap and topic-list cap, for HANDOFF section 5 |
| `scripts/registry/label-scan.mjs` | Explorer autocomplete scan for public name tags (re-check "unlabelled" entities, find candidate wallets) |
| `scripts/registry/read-tag.mjs` | Read the name tag from an address's own explorer page (the only admissible evidence) |
| `scripts/rpc-pool.mjs` | Shared endpoint pools and RPC helpers for the two scripts above |

```
Read HANDOFF.md, AGENTS.md and docs/METHODOLOGY.md, then run `git status`. If HANDOFF.md or lib/atlas/live-client.ts have uncommitted changes from an earlier session, do not overwrite or discard them; commit them separately or ask me.

GOAL
Make the live map show more real flows and more countries without weakening the evidence rules (HANDOFF sections 2 and 7b). Real data only. Judge every step by measured activity, not row counts.

MEASURED ON 2026-09-21 BY A PREVIOUS AGENT (single windows; re-measure before relying on any of it)
- Ethereum, 4h, registry-filtered USDC+USDT: 77 of 805 wallets moved anything; 33 of 70 entities idle (Bithumb holds 223 rows, silent). $3.30B touched the registry, but only $75.6M (2.3%) moved directly between two different evidenced entities, and every dollar had Wintermute, Jump, B2C2 or Galaxy on one end. Market makers, OTC desks, prime brokers and custodians are the hubs; exchanges are spokes.
- Base (4h) and Arbitrum (2h): 18/263 and 12/48 wallets active, zero direct cross-entity edges. L2 corridors exist only through deposit-address inference.
- eth.drpc.org rejects a topic position with 1,024+ entries (1,000 passes). The Ethereum registry is 805. rpc.mevblocker.io accepted 4,800; 1rpc.io/eth was flaky on large bodies.
- Explorer label autocomplete (`<explorer>/searchHandler?term=X&filterby=0`) returns a capped list (about 15 address rows) and token/NFT hits crowd out address labels ("kraken" returns none, "kraken 1" returns labels; `total 0` is a true miss). Searching a full address never returns its tag; read `/address/<addr>` and look for "Name Tag (viewable by anyone)". Arbiscan address pages 403; `/txs?a=` works.
- Of the 18 biggest unlabelled Ethereum counterparties, 1 was an admissible new wallet (OKX 191), 4 were "Binance Deposit" addresses, 1 was Circle, 1 was "Binance: Internal 2", 11 had no tag. Expect low yield per lead.
- The "properly licensed but unlabelled" list in the header of known-entities.ts is stale: Gopax, HashKey Exchange, Independent Reserve, Ripio, Lemon Cash, Bitcoin.de, Bitbns now have tags.
- Other stablecoins (RLUSD, PYUSD, USD1, USDe, EURC, USDS, DAI) touched about 1.4% as much value as USDC+USDT. Low priority.

DECISIONS FOR ME (recommend with numbers, then wait; do not decide yourself)
D1. HANDOFF rule 1 says explorer tag only; the header of known-entities.ts also allows "an exchange's own published disclosure" (proof-of-reserves address lists). Those lists could open LatAm, Africa and the Gulf. Do not use them until I choose. Write a one-paragraph recommendation.
D2. Filter slots past 1,000 per chain: (a) stay under 1,000, (b) shard into queries of <=1,000 entries (2x requests and upload), or (c) a dormant tier (no transfer in 30+ days: kept as evidence, left out of the live filter, re-measured monthly). Recommend one.
D3. Excluded high-volume entities (Bybit, Crypto.com, HTX/Huobi, Bitstamp, Luno, Ceffu, Cobo, Matrixport, Nexo, eToro, Remitano, ProBit, WhiteBIT). Produce a memo only (Phase 1d). Do not add them.

PHASE 0: INSTRUMENTS AND BASELINE (before any research)
0a. scripts/measure-activity.mjs already exists (tested on all three chains). Review it, fix anything wrong, then run `node scripts/measure-activity.mjs <Chain> 4 --out <file.json>` for Ethereum, Base and Arbitrum in at least two windows at different times of day (use --end-hours-ago 12 for an earlier window). Korean and Japanese venues trade on local hours, so one window can mislabel them as idle. Keep the --out files from the baseline and the final run so before and after are comparable.
0b. Record the baseline scoreboard: corridors, attributed share, active wallets, filter slots used per chain, from the built site or a harness over live-core.
0c. Run `node scripts/probe-endpoint-caps.mjs <Chain>` for each chain (a failed size can be a rate limit, so re-run before trusting a low number) and write the per-endpoint cap table into HANDOFF section 5. Add a verify-registry assertion that fails the build if any chain's filter exceeds the smallest cap among endpoints marked largeBody:true.
0d. Re-scan every entity in the "unlabelled" list and every excluded entity with `node scripts/registry/label-scan.mjs --file <terms> --out scripts/registry/label-scan.json` (the output is gitignored: a bulk list of explorer tags is kept offline, never published). Fix the stale comment in known-entities.ts.

PHASE 1: HUBS FIRST (highest yield per wallet)
1a. For each hub (Wintermute, Jump, B2C2, Galaxy, FalconX, Cumberland, GSR, Amber, Bullish, Anchorage, Coinbase Prime if tagged): find every tagged wallet not yet in the registry. Autocomplete showed Wintermute 11 tags vs 5 on Ethereum in the registry, and FalconX 12 vs 6. Read each address page with scripts/registry/read-tag.mjs, keep only wallets admissible under HANDOFF rule 3, and add them on every chain where the explorer tags them.
1b. Work the top-25 unlabelled counterparties from 0a for each hub: read the address page and admit only tagged, admissible wallets. Log every rejection by reason (deposit address, issuer, no tag, internal/funder) so yield is visible.
1c. Numbered tails (Binance, Coinbase, OKX, Kraken) only for wallets observed active in 0a. OKX 191 moved about $84M in the window and is not in the registry.
1d. Memo only for D3: what document names the operating entity, whether any regulator or company document settles it, how many wallets are tagged, how active they were.

PHASE 2: COUNTRIES (breadth track)
Leads from the label autocomplete on 2026-09-21. None is verified, and tag existence is not admissibility.
- New: Argentina (Ripio, Lemon Cash), Chile (Orionx), Poland (Kanga Exchange), Malaysia (Tokenize Xchange, Hata), Germany (Bitcoin.de; one address).
- Deepen: Hong Kong (HashKey Exchange), India (CoinSwitch), Australia (Independent Reserve), Brazil (Mercado Bitcoin, 4 tags vs 1 in the registry), Bitso (15+ tags vs 1 on Ethereum), Netherlands (Anycoin Direct), Korea (Gopax).
- No tag found on 2026-09-21, so do not spend time: Coinmate, Bits of Gold, Coinmotion, Safello, Foxbit, NovaDAX, BitOasis, CoinMENA, Yellow Card, Busha, Swyftx, Buda, Belo, Buenbit, SatoshiTango, Volabit. Re-scan in 0d and only then reconsider.
For each: read the address page, find a regulator register or company document naming the operating legal entity (HIGH if the tag is brand-level), then add the COUNTRIES and MAP_LABELS entries and the entity line. Skip Deployer, Token, "Deposit Funder", Forwarder and Invoice tags. Run measure-activity and report whether each new country actually lit up. A quiet country is fine, but say so.

PHASE 3: L2 EVIDENCE
First-party Base and Arbitrum labels only for entities that were active on that chain in 0a. Market makers were idle on both L2s, so do not spend time there. Prioritise the exchange hot wallets that receive customer sweeps, since inference is the only source of L2 corridors.

PHASE 4: ONLY IF 0-3 ARE EXHAUSTED (report options, do not build)
- New chains. Keyless probes on 2026-09-21: Optimism and Avalanche C-Chain via publicnode accept 5,000-block unfiltered getLogs, CORS *. BNB Chain via publicnode passed only 100 blocks and returned 9,821 USDT logs, so it needs filtering; verify decimals (BNB Chain USDT and USDC are 18). polygon-rpc.com is dead and Polygon via drpc passes 100 blocks. Add a chain only if its explorer tags entities we already hold and those entities are active there.
- More assets are about 1.4% more value and need pricing (EURC is not $1). Not worth it yet.
- Tron and Solana need keys, so put them on the list for me (HANDOFF 7b).

GUARDRAILS
- No synthetic, seeded or placeholder data. Never guess an address-to-entity mapping. Never loosen a rule or weaken a verifier to raise the attributed share.
- Explorer etiquette: at least 1.2 s between requests. Stop on any 429, 403 or challenge page. Never rotate agents or IPs, or bypass a CAPTCHA.
- Use today's real date in the `checked` column. Delete a row that trips the orphan rule; do not work around it.
- Follow the addresses.txt -> probe-code.mjs -> gen-addresses.mjs -> verify-all.mjs -> build:live workflow. Check dist-check at 375x812 and on every chain option.
- Stop a lever after two consecutive waves add no active wallets or corridors, and tell me. Report when free sources run out (HANDOFF 7b).

REPORT AT THE END
Before and after, per chain: registry rows, active wallets, filter slots used, corridors, attributed share. New countries and whether they lit up. Leads worked and yield per lead. Hub findings and the D1 to D3 recommendations. Commit in small commits.
```

## Reproducing the snapshot numbers

```
node scripts/measure-activity.mjs Ethereum 4
node scripts/measure-activity.mjs Base 4
node scripts/measure-activity.mjs Arbitrum 2
node scripts/probe-endpoint-caps.mjs Ethereum
node scripts/registry/label-scan.mjs "kraken 1" hashkey gopax ripio
node scripts/registry/read-tag.mjs etherscan.io 0x71660c4005ba85c37ccec55d0c4493e66fe775d3
```

Caveats on the snapshot: token amounts are at face value with no price feed, only direct
both-ends-evidenced edges are counted (the map also draws routes from deposit-address
inference), and each figure is a single window on 2026-09-21.
