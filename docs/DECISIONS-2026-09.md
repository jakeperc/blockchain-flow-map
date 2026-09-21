# Decisions pending for Jake (2026-09-21)

Three decisions came out of the "more flows and countries" run (prompt in `docs/PROMPT-add-flows.md`).
Each has a recommendation with measured numbers. Nothing here has been implemented; the registry was
grown under the current rules only. Activity figures are face-value USDC/USDT on Ethereum unless stated,
from `scripts/registry/screen-activity.mjs` on 2026-09-21.

## D1. Admit wallets that an exchange publishes itself?

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

Two things to note:
- **WhiteBIT** is the only brand a document now settles, at HIGH at most, as Panama (not yet in `geography.ts`).
  Adding it would be your call.
- **Consistency check:** FalconX and Copper were admitted on 2026-09-19 at HIGH despite multi-jurisdiction
  affiliates, while Coinbase Prime, Bitstamp and Crypto.com are out because the contracting entity depends on
  the client. You may want to review FalconX and Copper against the same test.
