# Tron open items: India and LatAm, and the unregistered tagged brands (2026-10-07)

Follow-up to `../2026-10-06/tron-tronscan-tags.md`, on Jake's request to keep researching the two open items. The
admission rules are unchanged:
- A Tron address needs a Tronscan `publicTag` (D6).
- A brand needs a document naming one custodying operator (D3).
- A wallet needs at least $100k of USDT in its screening window.

Raw data: `regional-hits.json`, `unregistered-screen.json`, `counterparty-tags.json` in this folder.

## 1. India and Latin America: no admissible Tron wallet exists yet

**Tronscan search** (`search/v2`, type address, one page of 50 per term, 500 ms pace, no block). It covered 64 terms:
the registered Indian and LatAm brands, the unregistered Indian and LatAm exchanges, and other regional and global
exchanges.
- No address of any kind matched CoinDCX, Mercado Bitcoin, Brasil Bitcoin, CoinSwitch, Giottus, Unocoin, Buenbit, Foxbit,
  Bitpreço, Satoshitango, Buda or CryptoMKT.
- Bitso (14 results), Lemon (26), Ripio (6), ZebPay, Mudrex, Belo and NovaDAX matched only accounts with an owner-set
  name and **no Tronscan tag**, which is not evidence.
- Two Indian exchanges do carry Tronscan tags, but both wallets are idle. The last USDT transfer of each was read from
  TronGrid's account history:
  - "WazirX Exchange Hot Wallet" (TXe3EibZP9jFogwyqLPd3APdwxZbiQBUqi): last moved USDT on 2025-05-15.
  - "Bitbns" (TByxhqkBrdKuW984Yt9wJP3Kmsy57dnirw): last moved USDT on 2023-01-02.
  - Neither brand is registered either. Both would need D3, and WazirX's operator has been in restructuring since its
    July 2024 hack.

**Counterparty sweep.** This is the route that does not depend on how a tag is spelled.
- Method: 6 hours of the 22-wallet filter returned 106,864 distinct counterparties. Tronscan tags were read on the
  400 largest by USD.
- Only 4 carry a tag: "Bybit" (already known), "VIR8 Hot Wallet 1" (already known), "HiFiSwap cross-chain 3" (a bridge,
  rule 3) and "Artis Turba" (unidentified). The rest are untagged, mostly deposit addresses.
- No Indian or LatAm exchange wallet appeared.

**Conclusion.** Tronscan's own tags currently contain nothing that would put Tron flow on India or Latin America. The
Dune leads for Bitso, Lemon Cash and CoinDCX remain untagged (section 22). Reopen if Tronscan tags one of those brands;
re-run the search with the monthly lead sweep.

## 2. Unregistered tagged brands: activity, then the operator test

**7-day USDT activity** (filtered scan, publicnode, falling back to TronGrid, no failed query). Wallets moving at least
$100k:

| Brand (Tronscan tag) | 7-day USDT | Transfers |
|---|---|---|
| Bybit | $2.04B | 532,121 |
| Gate | $706M | 94,457 |
| Well Wallet Hot 2 | $396M | 6,216 |
| WhiteBIT | $383M | 68,181 |
| Cobo Custody | $212M | 45,356 |
| VIR8 Hot Wallet 1 | $208M | 1,569 |
| UEEx Hot Wallet 19 | $92M | 1,413 |
| FixedFloat Exchange Hot Wallet | $75M | 24,540 |
| MaskEX Hot Wallets 16–23 | $143M combined | 631 |
| Swapster Wallet | $36M | 2,801 |
| OURBIT Exchange Reserves | $0.89M | 6 |
| Flipster Exchange Hot Wallet | $0.60M | 272 |

Idle in 7 days: Bybit Cold, all 13 HTX tags, LBank, XT.COM, WhiteBIT 2 and 3, and the WazirX and Bitbns wallets above.

**Operator test.** Three research agents used WebSearch and WebFetch only. Bybit, WhiteBIT and Cobo were already in D3's
2026-09-21 table, so each was checked only against its reopen condition.

| Brand | Verdict | Decisive document (read 2026-10-07) |
|---|---|---|
| **Ourbit** | **PASS, HIGH, VG** | https://www.ourbit.com/terms (last updated 2026-05-30) names "Ourbit Holdings Ltd. (Company No. 2138612)", Tortola, BVI, and says "Ourbit maintains full custody of the assets, funds…". No entity depends on residence. Re-read by the main session before admission. |
| Bybit | Still fails | Two platform terms, BTL and the UAE's BVAPO, "as applicable". bybit.com timed out; read via its bybitglobal.com mirror and search extracts. |
| WhiteBIT | Still fails | The agreement still names Peak Horizon Corp. (Panama), and no Panamanian registration or licence was found (OpenCorporates has no match). whitebit.com returned 403. |
| Cobo | Still fails | Terms (April 2026): "Cobo" means the whole Cobo Group, with no single custodying entity and terms that vary by jurisdiction. |
| Gate | Fails | The global agreement names no entity ("Gate and/or any of its Affiliates"); EU clients go to Gate Technology Ltd. (Malta, C 89337). |
| Well Wallet | Held, not admitted | See below. |
| VIR8 | Fails | Business not identifiable: no site, terms or register. |
| UEEx | Fails | Terms say "the Company and its affiliates … jointly operate" the site; no registered entity or custodian is named. |
| FixedFloat | Never attribute | Its terms (2026-10-02) say "non-custodial … we do not store your funds". It is a swap service. |
| MaskEX | Fails | No entity in its own documents. VARA has no listing. ADGM regulatory alert (2026-04-14): never granted FSRA permission. |
| Swapster | Pending | The current agreement PDF (24.03.2026) could not be read with WebFetch. Earlier versions name Kyrgyz LLCs with exchange-operator licences, and the operator changed in 2025. |
| Flipster | Fails | Contracting entity by residence (Singapore and Poland entities, Flipster FZE for UAE clients). |

**Well Wallet.** Its terms (effective 2025-08-29) describe custodial storage. They name WELL CORE TECHNOLOGIES SRL, Costa
Rica, Legal ID 3-102-913956, but only in the page footer. No registry confirms the company, and Costa Rica (`CR`) is not
yet a map jurisdiction. The link from the Tronscan tag "Well Wallet" to wellwallet.io also rests on the name alone. That is
the WhiteBIT situation in D3: one active wallet, a new country, and no regulator or register confirming the entity. It is
held for Jake's decision rather than admitted.

## 3. Applied

- `ourbit` was added to `known-entities.ts`: VG, HIGH, lastVerified 2026-10-07.
- One Tron row was added: OURBIT Exchange Reserves (TJP6zoGwWwUmANvMdrtqYq9iWA8qMAAY4q), Tronscan tag read 2026-10-07,
  normal account.
- Tron dormancy was re-measured: 22 of 22 active.
- Registry: 1,211 first-party rows, 65 entities.
