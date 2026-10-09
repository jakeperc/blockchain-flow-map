# Decisions from the September 2026 runs

D1 to D3 came out of the 2026-09-21 "more flows and countries" run. **D4 and D5 were decided on 2026-09-25**,
when two new chains and the longer time frames were added; they are recorded at the end of this file, followed by
D6 (Tronscan tags, 2026-09-29) and **D7 (who the Landmarks page may name, 2026-10-02)**.

| | Answer | What changed |
|---|---|---|
| D4 | **BNB Chain stays out: its stablecoins are bridge-issued pegs, not issuer liabilities.** Jake decided. | Nothing added. Polygon's bridged USDT is excluded by the same rule, so Polygon ships USDC only. Evidence in section D4. |
| D5 | **A 24H or 7D figure means what THIS browser recorded, sealed in 15-minute spans, and the window is not offered below 80% coverage.** | Built: `rollup.ts`, `history-store.ts`, per-chain sealed spans, measured coverage, real baselines. Section D5. |

# Decisions from the 2026-09-21 run: all three answered

Three decisions came out of the "more flows and countries" run (prompt in `docs/PROMPT-add-flows.md`).
Each has a recommendation with measured numbers. Jake answered on 2026-09-21: he approved D2 and asked for D1 and D3
to be answered outright, "even if both answers are no", so the next agent does not re-research them. Activity figures
below are face-value USDC/USDT on Ethereum unless stated, from `scripts/registry/screen-activity.mjs` on 2026-09-21.

| | Answer | What changed |
|---|---|---|
| D1 | **No.** An explorer name tag stays the only way an address is admitted. | Header of `known-entities.ts` now says so; nothing else. |
| D2 | **Yes: (c), a 90-day dormant tier.** Approved by Jake. | Built: `measure-dormancy.mjs`, `dormancy.json`, generated `WATCHED` filter, 45-day build gate. Results in section D2. |
| D3 | **No additions. WhiteBIT stays out. Ten brands failed the operator test and were removed.** | FalconX and Copper on first pass; BitGo, Cumberland, Galaxy, Jump, B2C2, GSR, Zero Hash and Amber Group on a second pass over every brand carrying the same caveat. 37 address rows and 10 entities removed; the operator test is written into the `known-entities.ts` header. |

Do not re-research D1 or D3 unless one of the reopen conditions below is met.

## D1. Admit wallets that an exchange publishes itself?

**Decision: no.** Not as a general rule and not for Binance's file. Rule 1 in HANDOFF is unchanged: an address enters the
registry only when its own Etherscan, Basescan or Arbiscan page shows a public name tag. The `known-entities.ts` header
used to say an "exchange's own published disclosure" could also support an address; that wording was wrong and is fixed.
**Reopen only if** an exchange in a blocked region (Latin America, Africa, the Gulf, India) starts publishing a hot-wallet
list that separates its deposit addresses, sits on its own domain, and carries stablecoin flow on Ethereum, Base or
Arbitrum. None of the 40 checked does today. Binance's separate file (37 Ethereum, 24 Arbitrum and 14 Base addresses) would
only add first-party anchors for exchanges already on the map, and is not worth the rule change.

HANDOFF rule 1 admits a wallet only through its own explorer name tag. The `known-entities.ts` header also
mentions "an exchange's own published disclosure", for example a proof-of-reserves address list.

**Recommendation: not now, and not as a general rule.** It would not open the regions it was meant to open.
- **Latin America:** 11 exchanges checked, none publishes a usable stablecoin wallet list. Ripio lists 5
  Ethereum cold wallets that hold ETH and its own token, not stablecoins. Lemon shows addresses only in its
  app. Bitso and Mercado Bitcoin publish no addresses.
- **Africa and the Gulf:** 14 exchanges checked, none publishes one. The one Gulf-licensed publisher,
  Deribit, removed its page on 2026-09-01.
- **India:** CoinSwitch publishes about 102 Ethereum addresses, unsigned and mixing two Indian entities.
  Its explorer-tagged wallet moved nothing on Ethereum in 90 days.

What the lists would add is more wallets for exchanges already on the map. Binance's own hot/cold file has
37 Ethereum, 24 Arbitrum and 14 Base addresses; KuCoin's auditor PDF has 38, 8 and 9. These matter mainly
as first-party anchors for deposit inference on the L2s. The risks are real:
- Lists mix in customer deposit addresses: OKX's has about 702,000 entries, and Binance ships a separate
  352 MB deposit file.
- Lists go stale or disappear (Deribit, Luno, Gate).
- No list says which legal entity controls a wallet.

If you want the L2 anchors, a narrow rule would be: only lists on the company's own domain that separate
hot/cold wallets from deposit addresses (today that is Binance's file alone); re-read every 180 days like
explorer tags; never for an entity that fails the operator test.

Findings for the 40 exchanges checked (company pages read 2026-09-21):
- **Publish 0x addresses:**
  - Binance: 111 unique hot/cold (Ethereum 37, BSC 32, Arbitrum 24, Base 14), plus a separate deposit file.
  - KuCoin: auditor PDF with Ethereum 38, Arbitrum 8, Base 9.
  - OKX: about 702,000 signed addresses, including deposits.
  - CoinSwitch: about 102 Ethereum.
  - Ripio: 5 Ethereum cold wallets, no stablecoins.
  - Excluded brands: Bybit (auditor PDF, 146 unique 0x), HTX (3 Ethereum), and WazirX (stale since October
    2024).
- **Publish nothing usable (Merkle root, auditor totals, in-app only, or a removed page):** Bitso, Mercado
  Bitcoin, Foxbit, NovaDAX, Lemon, Buenbit, Belo, Buda, Orionx, CryptoMKT, Yellow Card, Luno, VALR, Quidax,
  Busha, Ovex, AltCoinTrader (site blocked), Rain, BitOasis, CoinMENA, M2, CoinDCX, ZebPay, Mudrex, Giottus,
  Bitbns, Bitget, Gate, Crypto.com and Deribit.

## D2. What to do past 1,000 filter slots per chain

**Decision: (c), a 90-day dormant tier. Approved by Jake and built on 2026-09-21.** Measured over the 90 days to
2026-09-21, with every range read and no failed query (`docs/measurements/2026-09-21/dormancy.md`):

| Chain | Evidenced | Watched (live filter) | Dormant |
|---|---|---|---|
| Ethereum | 812 | 153 | 659 (81%) |
| Base | 819 | 55 | 764 (93%) |
| Arbitrum | 787 | 48 | 739 (94%) |

- One filtered request body fell from about 55 KB to 10.9 KB (Ethereum), 4.0 KB (Base) and 3.6 KB (Arbitrum), measured
  in the built page. Upload for the backfilled hour fell from about 2.2 MB to 0.23 MB, 89% (the memo estimated about 80%).
  Download is unchanged.
- Filter headroom is now 847 slots on Ethereum and 949 on Arbitrum (the memo estimated about 840 on Ethereum).
- Evidence is untouched: every dormant wallet still resolves to its entity. Replaying two stored hours gives identical
  corridors and values with and without the tier.
- Out of sample: of 648 Ethereum wallets dormant on 2026-08-22, 11 woke in the following 30 days. No transfer of theirs
  between two registry wallets went unseen; $11.0M moved against unlabelled counterparties, mostly four Galaxy Digital
  transfers. Arbitrum: 1 wake-up, $199.90. Base was not validated out of sample.
- Built as recommended: `scripts/registry/measure-dormancy.mjs` writes a dated `dormancy.json`, `gen-addresses.mjs`
  emits the live filter, and `verify-registry.cjs` fails the build when the file is older than 45 days (it warns at 30).
  Re-run it monthly.

The original analysis follows.

The binding caps are 1,000 addresses on Ethereum (eth.drpc.org) and 997 on Arbitrum (arb1, which counts
the token contracts and event topic against 1,000 selectors). Today: Ethereum 824/1000, Base 831/4800,
Arbitrum 799/997. Every Ethereum plain-account row also derives onto Base and Arbitrum.

Measured dormancy:
- **Ethereum:** 665 of the 805 baseline wallets (83%) moved no USDC/USDT in 90 days; 690 (86%) in 30 days.
  Bithumb alone accounts for 221 idle wallets, Coinbase 71, Kraken 69.
- **Wallets that were idle 30 days but active 30-90 days ago:** 25, together $473M, mostly three bursts
  (MEXC 27 $220M, Indodax 6 $135M, MEXC 21 $100M). That is well under 0.1% of the value that touches the
  registry over the same period.
- **Base:** about 96% of the 815-address filter was idle over 14 days. **Arbitrum:** about 96% of 773 idle
  over 7 days.

Options:
- (a) Stay under 1,000. Headroom now: 176 on Ethereum, 198 on Arbitrum. Free, but every new Ethereum
  plain-account row costs a slot on all three chains.
- (b) Shard into queries of at most 1,000. Doubles filtered requests and upload once past the cap. Keeps
  every wallet live.
- (c) Dormant tier: wallets with no transfer in N days stay in the registry as evidence but leave the live
  filter; re-measured monthly.

**Recommendation: (c) with a 90-day cutoff, and (a) until it is built.** Numbers:
- The Ethereum filter would drop from 824 to roughly 160, and Base and Arbitrum to roughly 40-60 each.
- The filter request body falls by about 80%, and upload is the larger part of a visitor's cost on Arbitrum.
- It frees about 840 Ethereum slots for active wallets.
- A wallet that wakes after 90 days of silence is missed until the next monthly re-measure: going by the
  30-90-day band, a few wallets and well under 0.1% of value.

Build it as: a script that writes a dated dormancy file, the generator reading it, and the verifier failing
the build if the file is older than 45 days, the same pattern as the evidence horizon.

## D3. Excluded high-volume entities (memo only; nothing added)

**Decision: no additions.** Every brand in the table stays out, WhiteBIT included. FalconX and Copper were then run through
the same test and failed it, so both were removed (details after the table).

**The operator test** (now written into the `known-entities.ts` header): a brand is admitted only if its own documents name
ONE legal entity, in one jurisdiction, that holds the brand's customer crypto whatever the client's residence. If the
contracting or custodying entity is chosen by the client's residence or contract, a brand-level wallet tag cannot be tied to
one jurisdiction and the brand stays out.

**WhiteBIT: no.** The only document is a user agreement naming Peak Horizon Corp. (Panama) as custodian, with no registration
number or licence cited. That is weaker than every other entity in the registry, it would add a new country (`PA`) on one
active wallet, and no regulator or register confirms it. **Reopen only if** a Panamanian registration or a licence for that
company is found.

**Reopen any other brand only if** its own document changes to name a single custodying entity for all clients, or a
regulator register names the entity that holds the tagged wallets.

7-day activity counts only wallets that moved at least $100k, among the first 15 tags the explorer search
returned per brand, so large brands are understated.

| Brand | Tags | Active | 7-day value | Operator documents (2026-09-21) | Verdict |
|---|---|---|---|---|---|
| Ceffu | 15+ | 2 | $946M | VARA (AE) custody-only, Bhutan (default terms), Poland; each custodies its own clients | Still ambiguous |
| Crypto.com | 15+ | 4 | $850M | Separate Foris DAX entities in MT, SG, GB, US, AU, KY and AE, chosen by residence | Still ambiguous |
| Coinbase Prime | 173 | 1 | $5.9B (Prime 1) | Coinbase's own page lists custodians Coinbase Custody Trust Co. (US), Coinbase Luxembourg, Coinbase Germany and Coinbase Inc, chosen by client contract | Still ambiguous |
| WhiteBIT | 15+ | 1 | $257M | User agreement puts all crypto custody with Peak Horizon Corp. (Panama); no registration number or licence cited | Could be HIGH, PA |
| Matrixport (BIT) | 6 | 1 | $200M | Operator Matrixport Technologies (VG), custody by Cactus Custody (entity undocumented) | Still ambiguous |
| Cobo | 15+ | 2 | $150M | Cobo Technologies (BVI, not on the BVI register) plus seven affiliates; MPC keys shared with clients | Still ambiguous |
| Bitstamp | 15+ | 1 | $35M | Six entities by residence (LU, GB x2, VG, SG, US); UK keys held by BitGo or Copper | Still ambiguous |
| Nexo | 15+ | 4 | $16M | Six licensed entities; US custody with Bakkt; non-US terms unreadable | Still ambiguous |
| eToro | 11 | 1 | $0.9M | 20-F: crypto segregated per regulatory framework (CY, GB, GI, US, AE, SC) | Still ambiguous |
| Bybit | 15+ | 0 in first 15 | – | Two current contracting companies (SC and AE) "as applicable" | Still ambiguous |
| HTX | 15+ | 0 in first 15 | – | No entity named anywhere; last named entity struck off 2023 | Still ambiguous |
| Luno | 13 | 0 | – | About 10 entities by residence; custody by BitGo and Fireblocks | Still ambiguous |
| Remitano | 15+ | 0 | – | Only named operator dissolved 2023 | Cannot be attributed |
| ProBit | 4 | 0 | – | Webthree Technology (SC), but closed 2026-04-01 | Keep out (ceased) |

**FalconX and Copper: both fail the test and were removed (2026-09-21).** They were admitted on 2026-09-19 at HIGH despite
multi-jurisdiction affiliates. Each was re-read from the company's own public documents by a research agent limited to WebFetch and WebSearch (no browser).
- **FalconX** (was US, HIGH; 6 Ethereum, 6 Base and 1 Arbitrum rows). Its disclosures page (last updated 2026-07-24) names
  eight entities and says availability "is subject to jurisdictional limitations and capabilities of each FalconX entity".
  No entity is named as holding client assets. US institutional clients' assets sit with Fireblocks Trust Company, a third
  party (release of 2026-02-04). The only FalconX entity documented with a custody permission is FalconX Limited (Malta).
  Its Singapore entity is disclosed as not MAS-licensed. Nothing says who controls the tagged wallets, so US/HIGH was not
  supported.
  Sources: https://www.falconx.io/disclaimers, https://www.falconx.io/licenses,
  https://www.falconx.io/newsroom/falconx-expands-u-s-institutional-offering-with-qualified-custody-via-fireblocks-trust.
- **Copper** (was CH, HIGH; 6 Ethereum rows). Its US terms (last updated July 2026) say services "including custody" for US
  persons are offered by Copper Markets (US), Inc. and that certain products come through Copper Markets (Switzerland) AG.
  Liechtenstein has a separate custody entity (Copper Markets (Liechtenstein) AG, FMA TVTG registration), and ADGM has a
  separately regulated affiliate (Copper Securities (ME) Limited, whose virtual-asset custody permission was only approved in
  principle in June 2026). The Swiss-only wording the registry cited is the older (June 2024) locale page.
  Sources: https://copper.co/en-us/terms, https://copper.co/en/terms.
- Their 13 + 6 address rows are gone from `addresses.txt`; the derived Base and Arbitrum rows go with them. Both brands
  are now listed as removed in the `known-entities.ts` header. Neither document could be read as a signed customer contract:
  what was tested is the public terms, which is the same standard as the rest of this table.

**The remaining eight with the same caveat were tested on 2026-09-21 and all eight fail too; removed.** BitGo, Cumberland
DRW, Galaxy Digital, Jump Trading, B2C2, GSR, Zero Hash and Amber Group carried the same "brand-level tag, several
affiliates" note as FalconX and Copper. Each was run through the operator test by its own research agent (WebFetch/
WebSearch only); none passed:
- **BitGo** (was US, HIGH): at least three differently-chartered US custody entities (federal OCC, NYDFS-limited New
  York, South Dakota) plus Singapore, Germany/Denmark, Switzerland and Dubai affiliates, each named as custodian for
  different clients. No document ties the Etherscan-tagged wallet to one of them.
- **Cumberland DRW** (was US, HIGH): Cumberland DRW LLC (Chicago, general), Cumberland New York LLC (NYDFS BitLicense,
  New York-specific), DRW Global Markets Ltd (UK FCA) and Cumberland SG Pte Ltd (Singapore MAS) — a document per
  jurisdiction, not one entity.
- **Galaxy Digital** (was US, HIGH): its own 10-K exhibit bundles Galaxy Digital LLC (Delaware) and Galaxy Digital
  Trading Cayman LLC together as one undifferentiated trading operation, and its Prime business explicitly splits New
  York clients from everyone else (GalaxyOne Prime NY LLC vs GalaxyOne Prime LLC).
- **Jump Trading** (was US, HIGH): the SEC's 2024 order named the Cayman subsidiary Tai Mo Shan Limited for buying UST
  in May 2021; a December 2025 Terraform-estate lawsuit attributes the same conduct to the US parent Jump Trading LLC.
  Nothing resolves which one controls the tagged wallet.
- **B2C2** (was GB, HIGH): its own disclaimer states "products and services may be provided by different members of
  the B2C2 group of companies, depending on the jurisdiction of the client and the regulatory status of the product
  or service," and names UK, Cayman, US (two entities), Luxembourg, Singapore and France entities.
- **GSR** (was HK, HIGH): its own trading terms define "GSR" as "GSR Markets Limited or any of its affiliates," and
  separate pages route US clients to GSR Digital LLC, UK clients to GSR Markets UK Limited and Singapore clients to
  GSR Markets Pte. Ltd.
- **Zero Hash** (was US, HIGH): US, Louisiana (a separate contracting entity within the US), EEA, Bermuda, Australia
  and Brazil entities, assigned by client residence per its own onboarding docs.
- **Amber Group** (was KY, HIGH): a Hong Kong SFC-licensed entity, a Singapore MAS entity trading under a different
  corporate name (Sparrow Tech Private Limited), a Dubai VASP subsidiary and a separate Cayman public holding
  company; no document ties the tagged wallets to any one of them.

18 Ethereum address rows and 8 entity records were removed (none had Base or Arbitrum rows, so nothing derived directly,
but derived Base/Arbitrum rows from those Ethereum accounts went too). Registry after both passes: **1,114 first-party
addresses, 64 entities, 29 jurisdictions**; the dormant tier (D2) was re-measured against the smaller registry. Replaying
two stored hours (`measure-corridors.mjs --explain`): the loss is mostly deposit-address inferences that anchored on the
removed entities. Hour A: corridors 36 to 33, attributed value $73.35M to $66.18M (-9.8%), jurisdictions lit unchanged
at 20, Arbitrum lost one corridor (its FalconX leg). Hour C: corridors unchanged at 41, attributed value $41.15M to
$39.52M (-4.0%), one fewer jurisdiction lit (18 to 17); `--explain` shows the drop is inferred deposit addresses that
used to be read as BitGo's or Zero Hash's (their inflow is now unattributed, since nothing anchors the inference), plus
one deposit address that used to pay BitGo and now correctly resolves to Coinbase.
**Reopen any of the ten removed brands (FalconX, Copper, and these eight) only if** its own documents change to name a
single custodying entity for all clients, or a regulator register names the entity that holds the tagged wallets.


**Re-checked 2026-10-07 on Tron (no change for any brand in the table).** Bybit (two platform terms, "as applicable"),
WhiteBIT (still no Panamanian registration or licence for Peak Horizon Corp.) and Cobo (the whole Cobo Group) still fail
their reopen conditions. Brands first met on Tronscan were tested on the same standard:
- **Ourbit passed:** Ourbit Holdings Ltd., BVI, company no. 2138612, named as custodian in its own terms. Admitted at HIGH.
- **Gate, UEEx, VIR8, MaskEX and Flipster fail.**
- **FixedFloat is a non-custodial swap service** and is never attributed.
- **Well Wallet** (Costa Rica, footer-only entity) and **Swapster** (current agreement unreadable) are held.
- Details: `docs/measurements/2026-10-07/tron-open-items.md`.

**2026-10-09 follow-up on the brands held on 2026-10-07 and 2026-10-08** (main session; terms read on the brands' own sites):
- **Cropty: left out by Jake's decision.** Tronscan tag "Cropty Wallet Hot Wallet" (TVCEYdpK6o8hBt71h82aUVbgfyyxJNMYfe,
  `docs/measurements/2026-10-08/tron-lead-screen.json`), $1.32M of USDT and 1,307 transfers in the
  7 days to 2026-10-08. Its undated Terms of Service (https://www.cropty.io/terms-of-services) say it is operated by
  Coinscatch (Private) Limited (Sri Lanka), with no registration number and no register record. It would add `LK`.
  It already clears the $100k-a-week activity floor; it is out because the entity is unconfirmed and the flow is small.
  **Reopen if** its weekly USDT flow grows to tens of millions, and then look first for a Sri Lankan registry entry or
  licence for Coinscatch.
- **Swapster fails.** The current user agreement (https://swapster.fi/docs/en_new/USER_AGREEMENT-2.pdf, last updated
  24.03.2026) was read in full. It is a public offer under the Kyrgyz Civil Code and calls the operator only "the Company";
  no company name, registration or licence number appears anywhere in it, and the website names none either. Earlier
  versions named Kyrgyz LLCs and the operator changed in 2025. Same verdict as UEEx: no named entity. **Reopen if** the
  agreement names the licensed Kyrgyz entity.
- **Urban Crypto Exchange: passes on documents; held only on the payment-business question.** Terms of Use v9.0 dated
  2026-08-05 (https://urbanexchange.com.br/docs/termos-de-uso-urban.pdf; the old `/termos-de-uso` URL is now a 404) name
  URBAN SOCIEDADE PRESTADORA DE SERVIÇOS DE ATIVOS VIRTUAIS LTDA, CNPJ 34.278.950/0001-02, São Paulo, operating under
  Law 14.478/2022 and BCB Resolutions 520 and 521/2025. Receita Federal's record (via publica.cnpj.ws, read 2026-10-09):
  trade name "URBAN CRYPTO EXCHANGE", active, founded 2019-07-22, which matches the Tronscan tag. One entity, no affiliates,
  no residence-based contracting. Its terms say it intermediates and does not custody client assets, and holds the crypto
  "in its custody until payment is confirmed", so the hot wallet is Urban's own settlement wallet. Its business is
  institutional OTC and cross-border stablecoin settlement ("Global Payments").
- **Wallib: fails.** Terms (https://www.wallib.com/legal-pages/privacy-policy, titled "Terminos y condiciones", read
  2026-10-09) name Wallib S.A.S., NIT 901.384.917-4, Bogotá. But custody of digital assets is "with third parties or
  through Wallib"; purchased stablecoins sit in a "Subcuenta Wallib" inside an unnamed US infrastructure provider (FinCEN
  MSB) that Wallib may replace at any time, and the site footer says some services come from third-party partners in
  Mexico and Colombia. Nothing says who controls the tagged Tron wallet. Its 7-day flow was $0.29M.
- **Well Wallet: still held, for Jake (who wants it added).** One research agent (WebSearch and WebFetch only), with the
  two decisive points re-read by the main session on 2026-10-09:
  - Brand link closed: https://wellwallet.io/en/public-wallets lists TRC20 `TQgxyP1jDXGBvmgwqnJ7jKkEqWEogfRM5V`, the exact
    Tronscan "Well Wallet Hot 2" address, as one of the "official public crypto wallets used by our bot". (The page
    corroborates the tag; it is not the admission source, per D1.)
  - Entity exists: Ministerio de Hacienda (api.hacienda.go.cr, cédula 3102913956) returns WELL CORE TECHNOLOGIES SOCIEDAD
    DE RESPONSABILIDAD LIMITADA, a company, status "Inscrito de Oficio", with only the generic activity code 960113. Every
    page of the site names this one entity in its footer; no other entity and no residence split appears anywhere.
  - New weakness: the Terms of Use (effective 29/08/2025) say they bind "you and [WellWallet Operator Entity]", an unfilled
    placeholder, and have no governing-law clause. They describe "custodial storage" but name no licence.
  - Unreachable: SUGEF's Art. 15/15 bis search (server error), Registro Nacional (login). Costa Rica's VASP law (Law 10961)
    took effect 2026-09-19 and its register may not exist yet.
  - Against WhiteBIT: WhiteBIT's entity is named in its agreement but has no government record; Well Wallet's has a
    government record but is named only in footers. HIGH at most, with the placeholder recorded as a caveat.
## D4. BNB Chain: are Binance-Peg stablecoins admissible? (2026-09-25)

**Answer: no. BNB Chain stays out, and Polygon's bridged USDT with it.**

The backlog had BNB Chain as the best remaining coverage win. Research on 2026-09-25 found the premise wrong.

The allowlist in `lib/atlas/evm.ts` admits a token contract only when its own **issuer** publishes it, from
Circle's USDC contract registry or Tether's supported-protocols page. Both are cited in the methodology panel's
technical references, and that provenance is what makes "USDC" and "USDT" on this map claims about a Circle or
Tether liability rather than about any token using the ticker. On BNB Chain:

- Circle's registry lists 38 mainnet chains. **BNB Smart Chain is not one of them.**
- Tether's supported-protocols page lists **no USDT contract on BNB Smart Chain** (only XAU₮).
- The chain's large stablecoin is `0x55d398326f99059fF775485246999027B3197955`, **Binance-Peg BSC-USD**, 18
  decimals, 1,569 Transfer logs per 20 blocks. It is a **Binance** liability created by a bridge, and integrity
  rule 3 excludes bridges.

Jake was offered three options: skip BNB; admit BSC-USD as its own disclosed peg asset (a new asset label, its
own price source, an explicit "bridge-issued, Binance liability" note, and this decision record); or label it
`USDT` and move on. He chose to **skip**, and to spend the effort on chains where the issuer publishes the
contract. The third option was the one to avoid: it would have put a Binance liability into every asset
composition chart under Tether's name.

The same rule excludes **Polygon's** widely used USDT `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`, bridged
through the Polygon PoS bridge and absent from Tether's list. Polygon therefore carries **USDC only**, exactly
as Base does.

**Reopen if** Tether or Circle begins publishing a native contract for BNB Smart Chain, or if Jake decides the
coverage is worth admitting a disclosed peg asset on the terms in option two. Note what is lost meanwhile: BNB
carries a large share of Asian and retail stablecoin flow, and none of it is on this map.

## D5. What a 24H or 7D figure means without a backend (2026-09-25)

**Answer: this browser's own recorded observation, sealed in 15-minute spans, and no window is offered until
80% of it has actually been watched.**

24H and 7D had been rendered but permanently disabled: the client holds about 90 minutes of transfers and
nothing survived a reload, so baselines were null and the snapshot message said as much. Keeping raw transfers
for a week is not an option — two `Attribution` records per transfer, each with a long evidence note, puts a
week past 100 MB per visitor.

So each completed 15 minutes is reduced once, **per chain**, to the accounting it supports (`rollup.ts`) and
kept in IndexedDB in that browser alone. Consequences, all deliberate:

- **The totals are exact, not estimated.** Sealing calls the same `aggregateSpan()` a live window uses over a
  half-open span, so spans tile the timeline exactly once. `scripts/verify-rollup.cjs` asserts that a 24H window
  rebuilt from 96 sealed spans reproduces a direct `aggregate()` over the same transfers — totals, corridors,
  top-6 lists, jurisdictions and classifications.
- **Coverage is measured, not assumed.** Each feed records only the block ranges it actually read, so a failed
  chunk lowers the coverage of the spans it touches. A window's coverage is its least-covered chain.
- **Progressive unlock, Jake's choice.** A partly watched day is a real measurement of part of a day, but
  presenting it as "24H" invites reading it as the day's settlement. The window stays locked, with a tooltip
  saying how much more history is needed. Consequence he accepted: coverage accrues only while the page is open,
  so a visitor who drops in for an hour a day will never unlock 7D. These windows belong to a page left running.
  `UNLOCK_SHARE` in `live-client.ts` is the single constant to tune.
- **No per-transfer detail is stored.** A long window therefore has no transfer list, no counterparty ranking
  and no evidence cards; those stay on 5M and 1H, where the records and today's registry are both in hand. A
  stored citation would also freeze evidence the registry may since have corrected, which is what rule 5's
  expiry horizon exists to prevent.
- **Baselines are finally real.** Four preceding windows of equal length from the same recorded history, each
  required to clear the same coverage bar — so a gap in watching cannot read as a collapse in volume. Where the
  history does not support one, the panel still says "Baseline unavailable".
- **A registry change does not discard history.** A span sealed under an older registry attributed fewer wallets
  than today's would; that is a true property of the observation, so such spans are kept and the mixed span is
  disclosed. A change to the stored *shape* does discard, because reinterpreting a summary under new rules would
  make a number mean something nobody measured.
- The unfiltered denominator sample is **not** sealed: it describes recently read chain time, and attaching it
  to a 24H figure would invite reading it as that window's denominator.

**Reopen if** a backend arrives (the sealed spans then become a cache rather than the only history), or if Jake
wants the unlock bar moved after seeing how rarely 7D unlocks in practice.

## D6. Tronscan's own name tags are admissible evidence for Tron (2026-09-29)

**Decision (Jake, 2026-09-29): yes.** For Tron addresses, the public name tag shown by Tronscan (Tron's own block
explorer, `tronscan.org`) is treated exactly like an Etherscan-family tag under rule 1. Tronscan exposes it as
`publicTag` from `apilist.tronscanapi.com/api/accountv2?address=`, which needs a free Tronscan API key.

Everything else in rule 1 and rule 3 still applies to Tron:
- store the tag verbatim with the real read date;
- the entity still needs a regulator or company document naming one operator in one jurisdiction (D3);
- deposit addresses, funders, bridges, token contracts and Tether treasury/issuer wallets stay out;
- Tronscan `redTag` or `greyTag` (risk flags) are not identity tags and never admit a wallet.

Tron addresses never derive from EVM rows (section 4). The feed plan and budget are in `docs/API-PLAN.md`.

**Reopen if** Tronscan starts sourcing its tags from third-party compilations without saying so, or the tag API
disappears behind a paid tier.

## D7. Who the Landmarks page may name, and on what evidence (2026-10-02)

**Decision (Jake, 2026-10-02), with two refinements he chose after the red-team review.** The Landmarks page
(`landmarks.html`, HANDOFF section 19) names the sender or receiver of a transaction only on one of three kinds of
evidence. Anything else stays unnamed: the page shows the party's role and a shortened address.

1. **Tag.** The public name tag on the address's own block explorer, stored verbatim with its read date, and only
   when the explorer credits no outside source. A tag the explorer says was "tagged based on" a researcher
   compilation, that carries a "Reported by ..." or "reported to be involved in ..." banner, or that was
   "Submitted by" a curation service (for example Kleros Curate) names nobody on this page.
   `scripts/registry/tag-reader.mjs` reads both the tag and those banners.
2. **Named in a document.** A primary document prints the address (equal to the chain's, or the mismatch is
   disclosed with the paragraph cited) or the transaction id. Primary means a court filing, a government release
   (for example DOJ, FBI or the Treasury's OFAC), or the party's own statement.
3. **Matched to a description** (Jake's refinement). A primary document describes a transaction without printing
   its id. The description identifies it only when a complete read of the stated window finds exactly one matching
   transaction; the proof (window, transactions read, matches) is stored with the entry and shown on the page,
   which says "identified by matching". When more than one transaction matches, nobody is named from it.

**People** (Jake's refinement). Organisations and governments are named under the three kinds above. A natural
person is named only when they publicly tied themselves to the transaction (their own statement) or a court record
shows their conviction or plea. An alleged, unconvicted individual is never named.

Two further rules follow from the review:
- **Who did it is a separate claim.** A court or government document's statement of who was responsible may be
  quoted as that document's claim, with its date ("the FBI attributed the theft to ..."). It never labels an
  address on its own.
- **News and analytics firms never name anyone.** They may be cited as the source that prints a transaction id,
  because the chain itself then verifies every fact about the transaction.

These names never enter the map's registry, and the map's rule 3 (no treasuries, bridges or deposit addresses)
governs what may anchor a route, not what this page may name. Chains with one keyless source (Tron, Solana,
Liquid) are allowed with a visible "one public source" badge.

**Found while applying it** (2026-10-02). The rule changed two pilot stories. Laszlo's pizza posts describe a
payment of 10,000 BTC; a complete read of the week found two such payments on the same day, so the posts identify
neither, and the paying address is not named (the transaction is the one reporting identifies). Bybit's cold
wallet tag on Etherscan is credited to the hildobby compilation, so it cannot name the wallet.

Writing the full set of stories found five more cases, each settled by the rule as written:
- **Bybit's receiver** carries "Reported by ZachXBT", so neither side of the theft is named. The FBI's attribution
  to North Korea is quoted as the FBI's claim, with its date.
- **Poly Network's receiver** carries a "reported to be involved" banner. It is named instead from Poly Network's
  own notice, which prints the address.
- **DeversiFi's deposit contract** is tagged "Submitted by Kleros Curate". The gate did not catch that credit until
  this session; it now rejects it, and the contract is named from DeversiFi's own post, which prints the
  transaction.
- **Silk Road.** The complaint says the United States took custody of the coins from the address on 3 November
  2020. Two transactions left it that day, both to one address. A description identifies a transaction only when
  exactly one matches, so the receiving address stays unnamed, though every coin that left that day went to it.
- **Liquid.** Blockstream's report prints the reserve's release and SideSwap's same-block forward. The release's
  receiver is therefore named SideSwap from the document, and the forward's receiver stays "the attacker's address".

**A complete set is not a match.** A scan that reads every event of one kind from one contract in a window (USDT's
Redeem events), or every spend from one address in a window, identifies each member when the story shows all of
them. No description is being matched, so nobody is named by it; the members are shown because the set is
complete. The gate fails a story that leaves a member out.

**Reopen if** an explorer starts crediting tags inconsistently, Jake wants analytics attributions admitted with a
"reported" label, or he wants a complete set whose every member pays one address (the Silk Road case) to identify
that address.
