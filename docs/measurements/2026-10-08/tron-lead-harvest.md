# Tron lead harvest from untried Tronscan lists (2026-10-08)

Jake asked whether the Tronscan API can yield more wallets or countries. The 2026-10-06/07 waves used two lead sources:
`search/v2` and the USDT holder list. This pass tried the other list endpoints the free key opens. The admission rules
are unchanged:
- A Tron address needs a Tronscan `publicTag` (D6).
- A brand needs a document naming one custodying operator (D3).
- A wallet needs at least $100k of USDT in its screening window.

Raw data in this folder:
- `tron-lead-harvest.json`: every tagged lead, with the list and page where it was found (raw scan output, kept offline since 2026-10-18: `work/offline-scans/`, not in the public repository).
- `tron-lead-screen.json`: the activity screen (kept offline likewise).

## 1. Lead sources (leads only, never evidence)

943 requests to `apilist.tronscanapi.com` at a 450-500 ms pace. Every reply was 200.

| Source | Rows read | Notes |
|---|---|---|
| `account/list?sort=-balance` (top TRX accounts) | 10,000 (the list's end) | `addressTag` is present only when a tag is set |
| `token_trc20/holders`, first 2,500 rows of each of 12 tokens | BTC, ETH, old USDC, USDD, TUSD, WIN, JST, SUN, BTT, NFT, LTC, DOGE | page size is fixed at 50 |
| `search/v2` | 180 terms | global, regional and payment brands, plus the generic terms "Exchange", "Hot Wallet" and "Cold Wallet" |

Result:
- 186 tagged addresses.
- 22 were already registered and 103 were already seen in the 2026-10-06/07 sweeps.
- **83 were new.**

26 of the new ones were set aside without screening:
- 15 "SR"/"SR Partners" (Tron super-representative voting accounts);
- black-hole and burn addresses;
- the Ukrainian government donation address;
- energy-rental and gambling services (TRXfee, TronSave, TronLucky);
- a bridge ("HiFiSwap cross-chain 3", rule 3);
- "Artis Turba", which is unidentified.

## 2. Activity screen

Method:
- 7 days of USDT `Transfer` logs to 2026-10-08.
- Blocks 86,734,904 to 86,936,503.
- Keyless publicnode, with TronGrid as fallback.
- Both directions, non-zero transfers only.
- 84 queries, none failed.

**16 of the 57 moved USDT. 13 cleared the $100k floor:**

| Tronscan tag | 7-day USDT | Transfers | Brand status |
|---|---|---|---|
| MaskEX Hot Wallet 25 / 24 / 26 / 27 | $101.3M combined | 254 | failed D3 on 2026-10-07 (ADGM alert) |
| DTCPay Hot Wallet 2 / 3 | $36.6M | 142 | researched below: held |
| Urban Crypto Exchange Hot Wallet | $26.0M | 360 | researched below: unclear |
| WestWallet Exchange Hot Wallet | $3.04M | 2,729 | researched below: unclear |
| **OURBIT Exchange Hot Wallet** | **$2.99M** | **1,050** | **registered (passed D3 2026-10-07): admitted** |
| CEEX Hot Wallet 1 | $2.27M | 20 | researched below: unclear |
| Cropty Wallet Hot Wallet | $1.32M | 1,307 | researched below: held |
| CEX.IO | $1.19M | 37 | fails D3 |
| Wallib Exchange Hot Wallet | $0.29M | 15 | researched below: unclear |

Three more moved USDT but stayed under the floor: Walbi ($0.02M), UEEx Hot Wallet 3 and YEX.

**Idle in 7 days** (no USDT transfer):
- Every new regional exchange tag that could have added a country. These are Kuna (Ukraine), ONUS (Vietnam),
  Cryptoforce (India), Kuantist and Darkex (both possibly Turkey), Rapidz, Bitanica and iSCAT.
- Binance-Cold 3.
- The global brands BitMart, Phemex, CoinEx, ProBit, Bitrue, BigONE, AscendEX, Biconomy, YouHodler, Paybis, XeggeX,
  NonKYC, Coinsbit and Bittrex.
- UEEx 1/2/4, DTCPay 1, the Heleket payment gateway, UPay and Zovix.

## 3. Operator test (D3)

One research agent did this work, using WebSearch and WebFetch only, on 2026-10-08.

| Brand | Business | Finding | Verdict |
|---|---|---|---|
| DTCPay | Singapore payment firm: merchant gateway, wallet and card | Its Terms of Business (https://dtcpay.com/terms-of-business) name Digital Treasures Center Pte. Ltd., MAS Major Payment Institution PS20200531, including DPT service (MAS directory entry updated 2026-08-25). They say "we hold the private keys", but "dtcpay" is defined as the company "and its Related Parties". | **Held for Jake** (see below) |
| Cropty | Custodial wallet app | Its Terms of Service (https://www.cropty.io/terms-of-services, undated) say it is "operated by Coinscatch (Private) Limited (Sri Lanka)". No registration number, and no register record found. | **Held for Jake** (see below) |
| CEX.IO | Exchange | Terms (2026-09-17): the entity is "determined by your residency and account type" (US, UK and LT entities). | **Fails** |
| Urban Crypto Exchange | Brazilian institutional exchange/OTC (urbanexchange.com.br) | Site and terms return 403, and no CNPJ was found. The tag-to-brand link rests on the name alone. | **Unclear** |
| CEEX | Exchange claiming a Singapore HQ | The site is JavaScript-only. No entity is identifiable, and MAS has no "CEEX" entry. | **Unclear, leaning fail** |
| WestWallet | Wallet and merchant gateway | Own terms unreadable (403). The only entity link (Estonian code 14767403) now belongs to a different company that is being deleted. | **Unclear, leaning fail** |
| Wallib | Colombian wallet app and OTC | Terms return 404 to WebFetch. A snippet names Wallib App S.A.S. (Colombia), unconfirmed. | **Unclear** |

Why the two passes are held, not admitted:

- **DTCPay.** Two concerns:
  - It is a payment processor. The registry so far holds only exchange and custodian wallets. Its hot-wallet flow is
    largely merchant settlement, so whether it belongs on the map is a policy question.
  - Its terms define the operator as the company "and its Related Parties". That is close to the "Company and its
    affiliates" wording that D3 fails, although one licensed entity is named. Singapore is already on the map, so
    admitting it adds flow but no country.
- **Cropty.** This is the Well Wallet situation:
  - a new country (`LK` is not a map jurisdiction);
  - an entity named only in undated terms;
  - no registration number and no register confirmation.

## 4. Applied

- One Tron row was added: OURBIT Exchange Hot Wallet (TApNqy5BNx11TiNa7oibbBUV63BY5a2sNE). Its tag was read through
  `read-tag.mjs tronscan.org` on 2026-10-08: normal account, no risk flag.
- Registry: 1,212 first-party rows across 65 entities. Tron has 23.
- Tron dormancy was not re-measured. The new row is watched by default. That is correct, since it moved USDT within
  the last day, but `verify-all` warns until the next monthly run (due by 2026-11-21).

## 5. Conclusion: Tronscan's free API is close to exhausted for this project

- Both list endpoints, the holder lists of 13 tokens, and about 240 search terms over two days have now been read.
- What Tronscan has tagged is mostly:
  - the big offshore exchanges already registered;
  - brands that fail D3;
  - idle regional wallets;
  - payment services.
- **No new country is reachable on Tron without a decision from Jake** (Well Wallet CR, Cropty LK, or DTCPay as a
  payment processor). The other way to reach one is for Tronscan to tag an active local-exchange wallet.
- Re-run this harvest with the monthly lead sweep: Tronscan adds tags over time.
- Pages Jake could read in a browser to resolve the unclear brands:
  - https://urbanexchange.com.br/termos-de-uso (Urban Crypto Exchange, Brazil);
  - https://www.wallib.com/terms (Wallib, Colombia; would add `CO`).
