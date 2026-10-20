# Should the wallet-admission rules be loosened? (2026-10-20)

Jake asked two things: add more wallets, and check whether the rules that keep many wallets and exchanges off the map
are the right call. This report answers both with measurements taken on 2026-10-20 and a re-read of every excluded
brand's current documents. The rules under review are integrity rule 1 (an address enters only through its own
explorer name tag; decision D1 refused exchange-published lists) and the operator test (decision D3: a brand is admitted
only if its own documents name one legal entity, in one jurisdiction, that holds customer crypto whatever the client's
residence). Both are in `docs/DECISIONS-2026-09.md`.

**Recommendation: keep both rules as they are.** None of the twenty-three excluded brands can be placed on the map by
any honest reading of its own documents, so loosening the test would not add a single evidenced route. It would add
about 16% to the first headline figure (transfers touching an evidenced wallet) at the price of the one claim the map
makes that competitors do not: every endpoint is an evidenced jurisdiction. If Jake wants those brands visible at all,
the only honest shape is a separate "entity known, jurisdiction unresolved" tier that names the counterparty in the
Unmapped view and never draws a route (option B below). That is a new decision, not a loosening.

## 1. What the rules exclude, measured

Ethereum, USDC and USDT, the 7 days to 2026-10-20 (blocks 26,183,933 to 26,234,332), face value, read from public RPCs
with `scripts/registry/screen-activity.mjs`. The excluded brands' wallets are the ones the Dune spellbook compilation
lists for them (a lead compilation, not evidence) plus the 28 Ethereum rows removed from the registry on 2026-09-21,
whose tags this project had read itself. The registry comparison is every first-party Ethereum row, dormant tier
included. No query failed.

| Set | Wallets screened | Active | Value moved, 7 days |
|---|---:|---:|---:|
| The registry's own Ethereum wallets | 823 | 114 | $63.5B |
| Brands excluded by the operator test (D3) | 779 | 57 | $7.5B |
| The ten hubs removed on 2026-09-21 (their old registry rows) | 14 | 9 | $1.4B |
| Brands left out for other reasons (ceased, sanctioned, no operator, non-custodial) | 524 | 25 | $1.1B |

So the rules leave out about $10B a week against $63B observed, roughly 16% more "observed on evidenced wallets" if every
one of them were admitted. By brand, the largest:

| Brand | Why it is out | Active wallets | 7-day value | Largest wallet |
|---|---|---:|---:|---|
| Coinbase Prime | custody entity chosen per client | 1 | $2.08B | Coinbase Prime 1 |
| Bybit | per-entity terms since 2026-10-16 (Seychelles, Abu Dhabi) | 6 | $1.32B | Bybit 25, $834M |
| Deribit | multi-entity (left-out list) | 2 | $728M | Deribit 1, $714M |
| Crypto.com | a Foris DAX entity per jurisdiction | 5 | $716M | Crypto.com 5, $383M |
| B2C2 | nine group entities by client jurisdiction | 1 | $663M | B2C2 Group 1 |
| Gate | no entity named in the agreement | 2 | $610M | Gate.io 1, $608M |
| Bitstamp | seven entities by residency | 2 | $590M | Bitstamp 60, $561M |
| Galaxy Digital | Delaware, Cayman and HK trading entities; custody at unnamed third parties | 6 | $572M | Galaxy Digital: OTC, $366M |
| FalconX | custody split Malta / Fireblocks Trust (US) | 1 | $471M | FalconX 1 |
| Ceffu | FZE terms cover the FZE's own clients only | 2 | $375M | Ceffu 2, $373M |
| Copper | custody split US / Switzerland | 23 | $281M | Copper 14, $55M |
| BitGo | OCC bank, NY trust, SG/DE/CH/AE affiliates | 1 | $280M | BitGo 1 |
| WhiteBIT | Panama operator unconfirmed; EU custody now separate | 1 | $264M | WhiteBIT 1 |
| Luno | entity by country of verification | 2 | $208M | Luno 3, $165M |
| Nexo | Nexo US LLC / Bakkt; Tangany for the EEA | 5 | $183M | Nexo 9, $95M |
| Revolut | operating entity ambiguous | 5 | $174M | Revolut 3, $61M |
| Cumberland DRW | six trading entities | 1 | $138M | Cumberland: 0x87b...Dda |
| HitBTC | multi-entity (left-out list) | 1 | $81M | HitBTC 12 |
| Jump Trading | Tai Mo Shan (KY) vs Jump Trading LLC (US) | 1 | $68M | Jump Trading |
| Matrixport (now BIT) | BVI operator, custodian unnamed | 1 | $68M | Matrixport 3 |

HTX, with 242 compiled wallets, moved $146k: its Ethereum flow has left. The 2026-09-21 replay already measured the
other side of this: removing the ten hubs cost 4% to 10% of attributed value in two stored hours, mostly inferred
deposit addresses that had anchored on them (D3 in the decisions file).

## 2. Every excluded brand re-read on 2026-10-20

Three research agents (WebFetch and WebSearch only, no browser, no downloads) re-read each brand's current terms,
disclosure pages, regulator register entries and SEC filings, and reported the entities named, the clause that selects
the entity, who holds customer crypto, and a verdict. **No reopen condition is met.** The verdict tables, with every URL
and "last updated" date, are in section 5. What changed since September:

- **Bybit** replaced its single ToS on 2026-10-16 with per-entity documents: Bybit Technology Limited (on the Seychelles
  FSA list as "Assessment") and Bybit Virtual Asset Platform Operator L.L.C. S.P.C. (Abu Dhabi, CMA licence). Two
  entities by region, as before. Only the preamble of the Bybit Technology document renders to a fetcher; a browser read
  is worth doing when convenient.
- **Coinbase Prime**'s legal page cited in September is a 404; the custody page now says "Asset availability may depend
  on client jurisdiction and custody entity". **Ceffu**'s global terms are gone too; its FZE terms (May 2026) cover the
  FZE's own clients, and its entity page says MirrorX and Prime Wallet are "not provided by Ceffu Custody FZE".
- **WhiteBIT** now prints a Panamanian company number for Peak Horizon Corp. (155761182). No reachable register confirmed
  it (Panama's portal errors; OpenCorporates sits behind a CAPTCHA that was not bypassed), and since 2026-06-18 EU/EEA
  users are custodied by a separate FMA-authorised Austrian entity, WB-Shield Innovations GmbH. The reopen condition
  became stricter, not met.
- **Bitstamp** under Robinhood: branding only; seven entities "depending on client residency"; keys at BitGo and Copper.
- **BitGo** is an OCC national trust bank since 2025-12-12 and listed since 2026-01-21; its prospectus still maps no
  client to an entity and keeps the New York trust and the foreign affiliates.
- **Galaxy**'s FY2025 10-K says Prime client assets sit at unnamed third-party custodians and no affiliate holds a
  BitLicense; **Amber**'s 20-F says the private parent runs the wallet infrastructure; **HTX**'s agreement now chooses
  Pakistani law and still names no operator; **Gate** re-dated its agreement (2026-07-22), lists nine licensed entities
  and disclaims any link between them and the platform; **Matrixport** is now BIT, same BVI operator.
- **A consistency finding on an admitted brand.** Wintermute's own disclaimer says "different Wintermute entities trade
  different products" (derivatives through Wintermute Asia Pte Ltd, Singapore) and that availability depends on "the
  capabilities of each Wintermute entity", the wording that removed FalconX. Both entities trade their own book, so no
  customer crypto is held and the split is by product, not by client residence. That is a reading D3 does not currently
  state. Jake decides: either record in D3 that a product split between own-book entities passes, or restrict the
  Wintermute entry to spot wallets with a note. The registry is otherwise consistent: the big exchanges were admitted on
  a court or regulator document naming one operating company (Binance, OKX, KuCoin, MEXC), which rule 2 allows.

## 3. Wallets added under the current rules, and the levers that produced nothing

| Lever | Requests | Result |
|---|---:|---|
| Top 25 unlabelled counterparties of registry wallets, Ethereum, 4 h (`measure-activity.mjs`), each read with `read-tag.mjs` | 25 | 0 admissible: 17 untagged, 5 "Binance Deposit", 1 "Bitfinex Deposit", 1 "Bybit: Hot Wallet" ($39.8M in 4 h; excluded by D3), 1 "Ethena: Coinbase Web3 Wallet 1" (not an exchange wallet) |
| Same on Base and Arbitrum | 50 | 0 admissible: 45 untagged, 3 deposit tags, a generic "Market Maker" tag on both chains |
| Dune spellbook compilation re-read from GitHub | 1 | Unchanged since 2026-10-01: 4,957 rows, 328 brands. 1,485 leads for registered brands are not in the registry |
| Those 1,485 leads screened on Ethereum, 7 days | ~120 RPC | 12 active; 4 above $100k: "Binance Internal 2" (plumbing), "Bitfinex Tether Treasury" (issuer), "HashKey 2" and "KuCoin: ERC-20 Batch Transfer" (both rejected on 2026-10-01), and two new ones below |
| Tags read for the two | 2 | **Admitted:** `MAX Exchange 1` (0xa9bf...52d6, entity MaiCoin, same Taipei company; $331k, 264 transfers) and `BTC Markets: MultiSig 1` (0xaecf...3ddc, a custody contract; $224k). Both tags are disclosed by Etherscan as sourced from a public researcher compilation, recorded in the row notes as the registry already does |

Registry after this: 1,219 first-party rows, 3,577 derived, 68 entities, 30 jurisdictions. The free label sources are
where the 2026-09-21 and 2026-10-08 reports left them: the explorer tags of active, admissible wallets are enumerated,
and a lead sweep now yields two small wallets a month. What would add more, in order: Jake's holder CSV exports from the
explorers (the only unscreened first-party source; `work` item 6b), the monthly Tronscan harvest (due 2026-11-08), and
the monthly family walk. None of them is blocked by the admission rules.

## 4. The options, weighed

- **A. Keep rule 1 and the operator test (recommended).** The test is doing exactly what it was written for: every
  excluded brand's own documents say its custodian depends on where the client lives or what it signed, or name nobody.
  Placing such a brand in one country would be the project asserting what the brand itself does not. For the audience
  this project is written for (analytics, compliance and investigations reviewers), a bent rule costs more than the
  16% of observed flow it would buy, and the flow it would buy draws no route anyway.
- **B. An "entity known, jurisdiction unresolved" tier (a new decision, if Jake wants it).** Admit a D3-failing brand's
  tagged wallets with the entity name and no jurisdiction. They would never draw a route, light a country or enter
  "Geographically attributed"; they would name the counterparty in the Unmapped view and in a jurisdiction panel's
  unplaced flow ("to Bybit, jurisdiction unresolved" instead of "to an unevidenced address"). This is honest and useful
  to an analyst. Cost: a model change (a third confidence value and a null jurisdiction, with `verify-model.cjs`,
  `verify-registry.cjs`, the llms template and the methodology text updated), about 60 filter slots on Ethereum, and the
  first headline figure grows by what section 1 measured, which the label "evidenced wallets" would still cover. The
  entity-level operator document would still be required (a brand with no named entity at all, HTX or Gate, stays out
  even here).
- **C. Place a multi-entity brand at its group headquarters at a lower confidence.** No. This is the exact case D3 was
  written to refuse, and the measured brands show why: Bybit's documents put most of the world under an Abu Dhabi
  operator and the rest under a Seychelles one; Crypto.com has a different custodian per region. A reviewer would catch
  it on the first corridor.
- **D. Read "the entity named in the global agreement" and ignore regional carve-outs.** Buys almost nothing: HTX, Gate,
  Jump, Amber and Cobo name no entity, Bybit and Crypto.com have no global contracting entity any more, and Coinbase Prime
  and Bitstamp name several in the same document.
- **D1 (exchange-published address lists) was not re-researched.** Its reopen condition (an exchange in a blocked region
  publishing a hot-wallet list that separates deposits, on its own domain) is unchanged and nothing seen today meets it.

## 5. Verdict tables from the re-read

Entities, clauses and dates as reported by the research agents on 2026-10-20. Quotes are from the brands' own pages.

### 5a. Exchanges (agent A)


| Brand | URLs + dates | Entities named | Custody clause | Verdict | Change since 2026-09-21 |
|---|---|---|---|---|---|
| Crypto.com | UAE T&Cs crypto.com/document/entity_uae ("Last Update: 24 April 2026"); EEA disclosure crypto.com/eea; AU Financial Services Guide (issued 2026-10-01); VARA register entry for Foris DAX Middle East FZE; global T&Cs crypto.com/document/terms-and-conditions return 403; crypto.com/licenses lists licences by jurisdiction without entity names | Foris DAX Middle East FZE (Dubai, VARA VL/23/10/003; custody not among its licensed activities); Foris DAX MT Limited (Malta C 88392, MFSA MiCA CASP incl. custody) and Foris MT Limited (EMI) on the EEA page; Foris DAX AU Pty Ltd on the AU guide. UAE T&Cs: services "are provided to you by Foris DAX Middle East FZE", some "offered by Affiliates", with "country annexes" | UAE: assets "held by us on your behalf in a ring-fenced, pooled, custody account", possibly with third-party custodians; EEA: Foris DAX MT authorised for custody. No single global custodian | FAIL (each jurisdiction's document names its own Foris DAX entity) | No structural change; UAE T&Cs re-dated 2026-04-24; the global T&C page now blocks automated reads |
| Bybit | Legal hub bybit.com/en/legal/terms-of-service/ now lists two platform T&C sets: "Bybit Platform Terms and Conditions" (Bybit Technology Limited, effective 2026-10-16) and "BVAPO Platform Terms and Conditions" (last updated 2026-10-16; PDF of 2026-01-23 read in full); separate Bybit Brasil, Kazakhstan, India/NZ/French addenda; the old single ToS URL is dead | Bybit Technology Limited ("the Company"; Seychelles FSA VASP list shows "Bybit Technology Limited T/A BYBIT", Mahe, status "Assessment"); Bybit Virtual Asset Platform Operator L.L.C. S.P.C., Abu Dhabi, CMA licence 20200000337 (excludes US, UK, SG, HK, CA, FR, mainland China, Dubai); VARA still lists Bybit Fintech FZE as "Pending" | BVAPO: custody "held and controlled by Bybit", omnibus or client money account, third-party custodian possible; the BTL custody section is not readable to fetchers (JS) | FAIL (contracting and custodying entity depends on which regional T&C set applies) | Wording changed on 2026-10-16: the old "Seychelles and Dubai ... as applicable" ToS was replaced by per-entity documents; Abu Dhabi BVAPO now appears instead of the Dubai FZE. Still two or more entities by region |
| Bitstamp | bitstamp.net/terms-of-use/ ("last updated on May 30, 2025", title "Bitstamp by Robinhood"); entity list bitstamp.net/legal/ | "We" = Bitstamp Ltd (E&W 8157033), may transfer to Bitstamp Europe S.A., Bitstamp UK Ltd, Bitstamp USA Inc., Bitstamp Asia Pte Ltd; legal page lists seven entities (Bitstamp Europe S.A. LU/CSSF; Bitstamp UK Ltd FCA; Bitstamp Ltd; Bitstamp Global Ltd BVI FSC VASP; Bitstamp Asia Pte Ltd MAS MPI; Bitstamp USA Inc. NYDFS; Bitstamp Financial Services Ltd SI, derivatives) and says the entity "depends on client residency" | "We do not store any Virtual Assets or other Digital Assets directly"; custodians "including BitGo and Copper" appointed under separate custodial terms; no Robinhood entity has a role | FAIL (entity by residence; keys at third-party custodians) | The Robinhood acquisition (closed 2025-06-02) changed branding only; seven entities now (adds a BVI VASP and the Slovenian derivatives firm); custody unchanged |
| Coinbase Prime | coinbase.com/legal/prime (the page cited on 2026-09-21) now 404; coinbase.com/prime/custody and /en-gb/prime/custody (undated); Coinbase's Prime Broker Agreement form as filed with the SEC (sec.gov/Archives/edgar/data/1855781/000119312524004916/d507893dex104.htm, 2023-09-29) | Coinbase Custody Trust Company, LLC (NYDFS trust) and Coinbase, Inc.; "Asset availability may depend on client jurisdiction and custody entity"; the agreement form: Coinbase, Inc. "as agent for" Coinbase Custody Trust Company, LLC and "as applicable based on Client's election" Coinbase Credit, Inc.; a 2025-filed form adds "if applicable ... Coinbase Custody International Ltd."; Coinbase Luxembourg S.A. appears only in third-party ETP notices | Coinbase Custody holds the vault account; Coinbase, Inc. holds the trading balance; the custody entity varies by jurisdiction and election | FAIL (more than one custody entity, chosen per client) | The dedicated Prime legal page was removed; the custody page now carries the "depends on client jurisdiction and custody entity" line |
| Ceffu | Ceffu Custody FZE Terms of Use (PDF, "Last updated: May 2026"); entity page ceffu.com/en-AE/uae/custody-fze; website account terms (2022-10-12); the global ceffu.com/terms-of-use that named the Bhutan entity is now 404; blog 2026-06-07 on a Bhutan GMC licence names no entity | Ceffu Custody FZE (Dubai, VARA VL/25/10/001, shown on its own page as "valid until 8 Oct 2026", i.e. lapsed twelve days ago unless renewed; not checked on the VARA register); affiliates Block Technologies Pte Ltd and Ceffu SG Pte Ltd provide "wallet services"; Binance Institutional Holdings Limited ("not your custodian"); the entity page says Prime Wallet, MirrorX, MirrorRSV and Staking are "not provided by Ceffu Custody FZE" | FZE terms: "The Client's Virtual Assets shall be held and stored by the Custodian" (the FZE), with possible delegation; who custodies MirrorX/Prime Wallet clients is not stated | FAIL (single entity only for the FZE's own clients; the flagship products sit with an unnamed other entity; global terms gone) | Global terms removed; FZE terms re-dated; Bhutan licence announced without an entity name |
| HTX (Huobi) | User Agreement htx.com/support/en-us/detail/360000298561 (published 2021-02-22, "Last updated [2026-09]" with placeholder brackets); licences page htx.com/en-us/global-licensed-businesses | No legal entity anywhere: "HTX Operators refer to all parties that run the Platform", may change without notice; governing law now "laws of Pakistan", HKIAC arbitration; licences page shows only a Pakistan PVARA no-objection certificate issued to "HTX" | Assets "held by the Platform on a custodial basis" by the unnamed operators | FAIL (no entity named) | Governing law moved to Pakistan with a PVARA certificate; still no named operator |
| Gate.io / Gate | gate.com/user-agreement ("Last updated on 22 July 2026"); gate.com/gategroup/legal/licenses | The agreement names no company: "Gate" = "the Sites, Gate and/or any of its Affiliates", an unnamed "Authorized Onboarding Entity", Panamanian law and ICC arbitration in Panama; the licences page lists nine independent entities (Gate Technology Ltd MT; Gate Technology FZE Dubai; Gate Global Limited BS; Hippo Financial Services Ltd HK; Hippo Capital Co. Ltd GI; Gate MENA DMCC; Gate Information Pty AU; Gate Japan K.K.; Gate Securities (Cyprus) Ltd) and says "Each of the entities operates independently" | No custody clause for spot assets | FAIL (no contracting or custodying entity named; unchanged from 2026-10-07) | Agreement re-dated; the licences page now enumerates nine entities but disclaims any link to the platform |
| Nexo | nexo.com/terms (US version, "Last updated: [September 18, 2026]"); EEA page nexo.com/eea/wallet-terms renders only a disclaimer; the non-US General Terms never render (JS); licence list nexo.io/institution-license | US: "a legally binding agreement between you and Nexo US, LLC" (Delaware), providers "may vary by state, client type, and product", Bakkt Crypto Solutions LLC; EEA: Tangany GmbH (Munich, BaFin) as custody counterparty, DLT Securities GmbH, DiPocket UAB; six Nexo entities on the licence page (CA, AR, AU, HK, PL, SC) and custody providers Ledger, Fireblocks, Bakkt, Tangany | US: "Provider does not itself act as a custodian of record"; EEA: Tangany custodies; no single custodian across regions | FAIL (contracting entity and custodian depend on region; non-US terms unreadable) | US contracting entity is now Nexo US, LLC; EEA custody now named as Tangany GmbH; the residence split is unchanged |

## Reopen conditions met
None. Crypto.com, Bybit, Bitstamp, Coinbase Prime and Nexo select the entity by residence or contract; Ceffu names a single custodian only for the FZE's own clients; HTX and Gate name no entity at all.

## Notes
- Bybit's documents were restructured on 2026-10-16 into per-entity T&Cs; only the preamble of the Bybit Technology Limited document renders to fetchers, so a browser read of it is worth doing when convenient.
- Two pages cited in the September finding are now 404: coinbase.com/legal/prime and ceffu.com/terms-of-use.
- Ceffu's VARA licence shows "valid until 8 Oct 2026" on its own page; renewal was not checked on the register.
- Unreadable this run (the verdicts do not depend on them): crypto.com global T&Cs (403), the full Bybit Technology Limited document (JS), Nexo's non-US General Terms (JS).

### 5b. Exchanges and custodians (agent B)


| Brand | URLs + dates | Entities named | Custody clause | Verdict | Change since previous check |
|---|---|---|---|---|---|
| Cobo | cobo.com/policy/terms ("Last update: April 2026"); risk warning PDF 2026-04-17 | Cobo Technologies Limited (BVI) = "Cobo"; "Cobo Group" may include Cobo Global HK Ltd, Cobo Global Ltd, Cobo Technologies HK Ltd, Cobo Singapore Pte Ltd, Cobo Singapore Technology Pte Ltd, Cobo America Ltd, Cobo Fintech HK Ltd; no registration or licence numbers | Agreements are "entered between you and the relevant member(s) of the Cobo Group"; the terms never say which entity holds keys or MPC shares | FAIL | None material |
| Luno | luno.com/legal/terms-list ("Last updated 03 Sept 2025"); luno.com/legal/terms-of-use (SA, 2026-05-14) | Country of verification maps to the entity: Bermuda = Luno International Limited; Indonesia = PT Luno Indonesia Ltd; Malaysia = Luno Malaysia Sdn Bhd; Nigeria = Luno Fintech Nigeria Ltd; South Africa = Luno (Pty) Ltd; Uganda, Zambia, Kenya entities; Luno Australia Pty Ltd | Terms "are based on the country in which you have verified your Luno account"; SA terms: Luno stores the private keys itself | FAIL (entity by country of verification) | Eight entities now; BitGo/Fireblocks no longer named as custodians |
| eToro | FY2025 Form 20-F (sec.gov/Archives/edgar/data/1493318/000121390026022034/ea0278371-20f_etoro.htm); terms hub etoro.com/customer-service/terms-conditions/ (regional T&Cs dated Aug-Sep 2026) | eToro (Europe) Ltd (CY, CySEC, MiCA CASP), eToro (UK) Ltd (FCA 583263), eToro AUS Capital Ltd, eToro (Seychelles) Ltd, eToro (ME) Ltd (ADGM), eToro USA LLC, eToro NY LLC, eToro X Ltd (GI), Tangany GmbH (DE third-party custodian) | 20-F: custody provided "in all jurisdictions in which we are licensed" by "the applicable eToro entity (the regulated entity or the custodian)" | FAIL | None material; Europe entity now a MiCA CASP; a German third-party custodian added |
| WhiteBIT | whitebit.uk/terms (undated; whitebit.com/terms 403); Austrian FMA notice fma.gv.at/en/?p=40022710 (decision 2026-06-18) | Clause 1.1/6.3: Peak Horizon Corp., Panama City, company no. 155761182, "All crypto-related operations are conducted through the company Peak Horizon Corp."; WB Technologies AG, Zug (fiat); CORELINE Solutions LLC, Sofia (UK promotions); group members UAB Clear White Technologies (LT), Clear White Technologies Ltd (HK), Nova Fintech LLC (SVG), WhiteBIT Georgia LLC, WHITEBIT S.A.; WB-Shield Innovations GmbH, Vienna, FN 649506g, FMA-authorised under MiCAR on 2026-06-18 for custody, serving EU/EEA users ("WhiteBIT EU"). A Spanish help-centre notice (snippet only) says UAB Clear White Technologies holds the custody wallets, which conflicts with clause 6.3 | Peak Horizon is the stated crypto operator for the global platform; no licence cited; nothing says which entity custodies EU residents once routed to WhiteBIT EU | FAIL. (a) The reopen condition is not met: a company number is now printed but no Panamanian registry record or licence could be found (the registry portal is unqueryable by fetch). (b) Even if confirmed, EU/EEA residents are now contracted and custodied under a different, FMA-authorised entity, so the custodian is residence-dependent | CHANGED: company number 155761182 now cited (was none); a second regulated custody entity for EU residents appeared |
| Matrixport (renamed BIT on 2026-03-20) | bit.com/terms-conditions (undated); matrixport.com/terms-of-service redirects to bit.com; rebrand notice bit.com/bit-formerly-matrixport | "BIT is operated by and proprietary to Matrixport Technologies Ltd. (BVI)" and unnamed affiliates; Matrix Gelephu Pte Ltd (Bhutan) for an HK stock product; Cactus Custody's own pages say supported assets "vary by operating entity": Matrix Trust Company Limited (HK trust licence TC006789), Matrix Bhutan Pte Ltd, Cactus Keylabs Ltd (BVI) | No custodian named in the exchange terms; assets "may be commingled" | FAIL | Renamed; entities unchanged; Cactus now shows three operating entities |
| BitGo | bitgo.com/legal/disclosures/ (2026-04-24); custodial services agreement bitgo.com/legal/bitgo-bank-and-trust-agreements/ (2025-12-02); bitgo.com/company/licenses/; 424B4 prospectus sec.gov/Archives/edgar/data/1740604/000162828026003180/bitgoholdingsinc424b4-janu.htm (2026-01-21); OCC conditional approval NR 2025-125 (2025-12-12) | BitGo Bank & Trust, N.A. (OCC national trust bank, formerly BitGo Trust Company, SD; conversion 2025-12-12); BitGo New York Trust Company LLC (NYDFS, New York customers); BitGo Custody MENA FZE (VARA); BitGo Singapore Pte Ltd (MAS MPI); BitGo Europe GmbH (BaFin MiCAR custody); BitGo Europe ApS; BitGo GmbH (CH); BitGo Technologies LLC; BitGo Prime LLC; BitGo, Inc. | Prospectus: assets "held in custody by [the BitGo Trust Companies] ... in segregated accounts"; no mapping of clients to entities; NY custody runs through the NY trust; the hot-wallet-controlling entity is never stated | FAIL (custodian depends on client location) | SD trust became an OCC national trust bank; IPO priced 2026-01-21; the three-way US split persists |
| Cumberland DRW | cumberland.io/compliance/disclosures, /terms-and-conditions, /policy, /requirements (undated, (c) 2026) | DRW Holdings LLC; Cumberland DRW LLC; Cumberland New York LLC (BitLicense); DRW Global Markets Ltd (UK FCA); Cumberland International Trading Ltd (BVI FSC); Cumberland Global Limited (CIMA); Cumberland SG Pte Ltd (MAS in-principle) | Principal-only trading; no clause says which entity faces a counterparty; "Cumberland may, but does not necessarily, hold or control positions" | FAIL | Two more entities visible (BVI, Cayman) |
| Galaxy Digital | FY2025 Form 10-K sec.gov/Archives/edgar/data/1859392/000185939226000016/glxy-20251231.htm; Exhibit 21.1 (subsidiaries as of 2025-12-31); galaxy.com/trust-and-transparency | Galaxy Digital LLC (DE), Galaxy Digital Trading Cayman LLC, GalaxyOne Prime LLC (DE, FinCEN MSB), Galaxy Trading Asia Ltd (HK), Galaxy Digital UK Ltd, Galaxy Bahamas Ltd, Galaxy Digital Partners LLC | 10-K: Prime customers' digital assets are "in omnibus custodial accounts ... at one or more third party custodians"; "Neither Galaxy nor any of its affiliates currently have a BitLicense"; retail custody by Paxos | FAIL (no Galaxy entity holds client crypto; three trading entities) | The 10-K now says no affiliate holds a BitLicense; still no single named custodian |

## Reopen conditions met
None.

## Watch items
- WhiteBIT is the only brand that moved toward its condition (a Panamanian company number is now printed). A manual Registro Publico lookup of folio 155761182 would settle the number, but the new EU custody entity (WB-Shield Innovations GmbH) means the brand fails the residence test anyway.
- BitGo: if D3 were ever relaxed to "one US custodian", New York residents still sit on the NY trust and non-US clients on SG/DE/CH/UAE affiliates.
- Pages worth a manual browser read: whitebit.com/terms (403 to fetch), help.whitebit.com/hc/es/articles/9788717522077 (Spanish custody notice naming UAB Clear White Technologies), mycactus.com/support-token (operating-entity list).

### 5c. Market makers, prime brokers and Wintermute (agent C)


| Brand | URLs + dates | Entities named | Selection clause | Verdict | Change since 2026-09-21 |
|---|---|---|---|---|---|
| Jump Trading / Jump Crypto | jumptrading.com/policies/terms-of-use and /disclosures (undated); jumpcrypto.com legal pages 404 | "Jump Trading, LLC and its affiliates"; disclosures list Jump Trading LLC, Jump Execution LLC, Jump Trading Futures LLC, Jump Trading Europe B.V., Jump Trading International Ltd (UK). Tai Mo Shan Limited not mentioned on either domain | None names a crypto trading entity or a wallet | FAIL | None; still unresolved between Tai Mo Shan (KY) and Jump Trading LLC (US) |
| B2C2 | b2c2.com/disclaimer (undated, (c) 2026) | B2C2 Ltd (E&W 07995888), B2C2 OTC Ltd (FCA 810834), B2C2 Overseas Ltd (Cayman, CIMA), B2C2 USA Inc. (FinCEN MSB), B2C2 Securities LLC, B2C2 Europe S.a r.l. (Luxembourg MiCAR CASP), B2C2 Asia Pte Ltd, B2C2 Singapore Pte Ltd, Woorton SAS (France, AMF CASP) | "Products and services may be provided by different members of the B2C2 group" depending on "the jurisdiction of the client" | FAIL | Expanded to nine entities; clause unchanged |
| GSR | gsr.io/general-trading-terms-of-business, /gsr-website-terms-and-conditions, /regulatory-legal-notices (undated) | "GSR Markets Limited or any of its affiliates"; GSR Digital LLC (US, NMLS 2318094, US residents only); GSR Markets UK Limited (FCA FRN 1018980); GSR Markets Pte Ltd (MAS MPI); GSR Resources UK Limited (website operator) | Affiliates by client region; no custody clause | FAIL | None material |
| Zero Hash | docs.zerohash.com/page/about-zero-hash (2026-06-25), /faq (2026-07-31), /us-licenses-and-disclosures (2026-06-25); zerohash.com/legal 404; current user agreements are PDF buttons whose paths 404 | zerohash holdings ltd; zerohash llc (NYDFS BitLicense 0000017, Louisiana, FINTRAC, Argentina CNV); zerohash liquidity services llc (BitLicense 0000016); zerohash trust company llc (North Carolina trust); zerohash worldwide ltd (Bermuda BMA Class F); zerohash global liquidity ltd (Bermuda); zerohash europe B.V. (AFM CASP, DNB EMI); zerohash australia pty ltd (AUSTRAC); Zero Hash Brazil Limitada | "In the United States, zerohash llc..."; "In Europe, zerohash europe B.V...."; "In Australia, zerohash australia pty ltd..." | FAIL | Entity list grew (NC trust company, Bermuda liquidity entity); still regional |
| Amber Group | ambergroup.io and ambr.io have no legal pages; SEC 20-F filed 2026-05-13 (sec.gov/Archives/edgar/data/1697818/000110465926060362/ambr-20251231x20f.htm) | Amber International Holding Ltd (Cayman, Nasdaq AMBR); Sparrow Tech Private Limited (Singapore MAS MPI); Amber Premium FZE (Dubai VARA, licensed 2026-04-02); Amber DWM Limited (HK); WhaleFin Markets Limited (HK, SFC pending); Amber Custodian Services Ltd; Amber Match Limited (BVI); Amber Technologies Service Pte Ltd; Amber Global Limited | 20-F: the private Amber Group "provides us with secure hot and cold wallet infrastructure"; OTC desk entity not named; third-party custodians unnamed | FAIL | VARA licence in April 2026; the 20-F says wallet infrastructure belongs to the private parent, further from any licensed entity |
| FalconX | falconx.io/disclosures (undated), /eu-regulatory-disclosures, /summary-of-custody-policy (board-approved 2025-11-11), Fireblocks Trust announcement 2026-02-04; /terms-of-service 404 | FalconX Bravo, Inc. (CFTC swap dealer); FalconX Delta, Inc. (NMLS 2419717); FalconX Limited (Malta, MFSA MiCA CASP incl. custody); FalconX Foxtrot Pte Ltd and FalconX Golf Pte Ltd (Singapore); Warp Drive Inc. (custody operations outsourcee); Fireblocks Trust Company LLC holds US client assets. Footer lists five entities, was eight | "Availability ... subject to jurisdictional limitations ... and capabilities of each FalconX entity"; "Custody service is offered through FalconX Limited ... Malta"; US assets at Fireblocks Trust | FAIL | Custody now explicitly split Malta vs US; still residence-dependent |
| Copper | copper.co/en-us/terms ("Last updated: July 2026"), /en-us/disclosures, /disclosures, /en-ch/disclosures, /en-ch/terms (June 2024) | Copper Markets (US) Inc. (Delaware, SEC broker-dealer, FINRA, SIPC); Copper Markets (Switzerland) AG (CHE 477.629.838, VQF member, not FINMA-licensed); Copper Technologies (UK) Limited (parent). Liechtenstein and ADGM no longer on the pages fetched | "Services in the United States or to U.S. persons, including custody, are offered by Copper Markets (US), Inc."; "provided by the specific entity identified in the relevant agreement" | FAIL | US entity became an SEC broker-dealer; custody still split US vs Swiss by client |
| Wintermute (ADMITTED, GB) | wintermute.com/disclaimer and /terms-of-service (undated, JS-rendered, read through a rendering proxy of the same URLs); Companies House 10882520 active | Wintermute Trading Ltd (E&W 10882520, FCA cryptoasset registration FRN 928764); Wintermute Asia Pte Ltd (Singapore 202108542H, unregulated); "Wintermute" is a marketing name for the group "which includes ... other affiliates". No Cayman or BVI entity named | "Different Wintermute entities trade different products"; derivatives "carried out by Wintermute Asia Pte Ltd"; "Each Wintermute Entity trades for its own account"; "Availability of products and offerings is subject to jurisdictional limitation and capabilities of each Wintermute entity" | Split by PRODUCT, not by client residence; spot/market-making not expressly assigned to Wintermute Trading Ltd | Terms page carries a draft note about a new address; otherwise consistent with the admission facts |

## Reopen conditions met
None. No brand's own documents name a single custodying or trading entity for all clients, and no register ties an entity to the tagged wallets.

## Wintermute consistency note (agent's words, for Jake)
Wintermute's disclaimer uses the same "capabilities of each ... entity" language the project rejected for FalconX, and splits trading by product (derivatives through Wintermute Asia, Singapore). Both entities trade their own book only, so no customer crypto is held, and the split is by product rather than by client residence. The admission is defensible only if the tagged Wintermute wallets are taken to be spot market-making wallets and D3 is read as not covering a product split. Either document that reading in D3, or restrict the entry to spot wallets with a note.

## Caveats
- wintermute.com is JS-rendered; the content was read through a rendering proxy of the same URLs, not a third-party summary.
- Zero Hash's current user agreement PDFs could not be fetched (404 on the guessed paths); findings rest on the dated docs.zerohash.com pages.
- Amber's 20-F organisation chart is an image; the subsidiary list comes from the filing's text.
- FCA FRNs are as printed on the brands' own pages, not independently confirmed (the FCA register page did not render).
