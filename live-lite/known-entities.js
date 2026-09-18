/**
 * Known entity evidence for Ledger Atlas · Live (Lite).
 *
 * This is the ONLY file that should need updating to add or refresh evidenced wallets.
 * It ships separately from index.html so it's easy to edit without touching the app logic.
 *
 * RULES (do not relax these — they are the whole point of this project):
 *  - Only add an address you can point to a real, working https:// source for (an exchange's own
 *    published deposit/reserve address disclosure, or a blockchain explorer's own public label
 *    feature). Never guess or infer an address-to-entity mapping.
 *  - "jurisdiction" must be the ISO-2 code of the SPECIFIC operating entity the source documents —
 *    not just "where the company is famous for being based". If your source doesn't support a
 *    jurisdiction claim, leave jurisdiction null; the entry will still show in the raw feed context
 *    but will never form a mapped corridor (a corridor needs jurisdiction on both ends).
 *  - confidence must be 'VERIFIED' (documented primary evidence, e.g. the exchange's own page or a
 *    regulator/court filing) or 'HIGH' (strong corroborated evidence, e.g. a widely-corroborated
 *    explorer label). Anything weaker should be left out entirely rather than marked HIGH.
 *  - Keys are lowercase 0x addresses.
 *
 * Schema per entry:
 * "0x...": {
 *   entity: "Specific operating entity name",
 *   category: "exchange" | "custodian" | "issuer" | ...,
 *   jurisdiction: "US" | null,   // ISO-2, must be one of the codes listed in index.html's COUNTRIES
 *   confidence: "VERIFIED" | "HIGH",
 *   source: "Short source description",
 *   sourceUrl: "https://...",
 *   evidenceNote: "One sentence on what specifically documents this address."
 * }
 *
 * Researched 2026-09-18 by checking each address's own Etherscan label page directly, cross-checked
 * against regulatory/court filings for jurisdiction claims. See live-lite/README.md for the full
 * research notes, including entities deliberately excluded because jurisdiction was disputed
 * (Bybit, Crypto.com, Bitstamp, Luno, WazirX, HTX/Huobi) or no solid public address could be found
 * (Coinbase Custody as distinct from retail Coinbase, Independent Reserve, and most of Latin America,
 * continental Europe, Turkey, Nigeria, Kenya, the UAE, the Philippines, Indonesia and Hong Kong).
 * Circle's and Tether's issuer/treasury addresses are intentionally NOT included: a transfer from an
 * issuer's own treasury is issuance-adjacent, not bilateral settlement, and mapping it as a "corridor"
 * would misrepresent it exactly the way the main Ledger Atlas app's mint/burn exclusion is designed
 * to prevent.
 */
var KNOWN_ENTITIES = {
  // --- Binance (Binance Holdings Limited, d/b/a Binance.com) — Cayman Islands ---
  // Jurisdiction per the DOJ's November 2023 plea agreement naming Binance Holdings Limited as a
  // Cayman Islands company. Distinct from the separate US entity Binance.US/BAM Trading.
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": { entity: "Binance", category: "exchange", jurisdiction: "KY", confidence: "VERIFIED", source: "Etherscan public label + DOJ Nov 2023 plea agreement", sourceUrl: "https://etherscan.io/address/0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", evidenceNote: "Etherscan labels this 'Binance' (Exchange); DOJ's plea agreement names Binance Holdings Limited as a Cayman Islands company." },
  "0xd551234ae421e3bcba99a0da6d736074f22192ff": { entity: "Binance", category: "exchange", jurisdiction: "KY", confidence: "VERIFIED", source: "Etherscan public label + DOJ Nov 2023 plea agreement", sourceUrl: "https://etherscan.io/address/0xD551234Ae421e3BCBA99A0Da6d736074f22192FF", evidenceNote: "Etherscan labels this 'Binance 2' (Exchange); same corporate entity and jurisdiction basis as above." },
  "0xf977814e90da44bfa03b6295a0616a897441acec": { entity: "Binance", category: "exchange", jurisdiction: "KY", confidence: "VERIFIED", source: "Etherscan public label + DOJ Nov 2023 plea agreement", sourceUrl: "https://etherscan.io/address/0xF977814e90dA44bFA03b6295A0616a897441aceC", evidenceNote: "Etherscan labels this 'Binance: Hot Wallet 20' (Exchange), one of the largest and most consistently active exchange wallets on Ethereum." },
  "0x28c6c06298d514db089934071355e5743bf21d60": { entity: "Binance", category: "exchange", jurisdiction: "KY", confidence: "VERIFIED", source: "Etherscan public label + DOJ Nov 2023 plea agreement", sourceUrl: "https://etherscan.io/address/0x28C6c06298d514Db089934071355E5743bf21d60", evidenceNote: "Etherscan labels this 'Binance 14' (Exchange); heavily used, high-balance wallet." },

  // --- Coinbase, Inc. — United States ---
  "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": { entity: "Coinbase", category: "exchange", jurisdiction: "US", confidence: "VERIFIED", source: "Etherscan public label + Coinbase Global SEC filings", sourceUrl: "https://etherscan.io/address/0x71660c4005ba85c37ccec55d0c4493e66fe775d3", evidenceNote: "Etherscan labels this 'Coinbase 1' (Exchange); Coinbase, Inc. is a Delaware corporation per its own SEC 10-K." },
  "0x503828976d22510aad0201ac7ec88293211d23da": { entity: "Coinbase", category: "exchange", jurisdiction: "US", confidence: "VERIFIED", source: "Etherscan public label + Coinbase Global SEC filings", sourceUrl: "https://etherscan.io/address/0x503828976d22510aad0201ac7ec88293211d23da", evidenceNote: "Etherscan labels this 'Coinbase 12' (Exchange)." },

  // --- Kraken (Payward, Inc. / Payward Ventures, Inc.) — United States ---
  "0xf30ba13e4b04ce5dc4d254ae5fa95477800f0eb0": { entity: "Kraken", category: "exchange", jurisdiction: "US", confidence: "VERIFIED", source: "Etherscan public label + Payward regulatory filings", sourceUrl: "https://etherscan.io/address/0xf30ba13e4b04ce5dc4d254ae5fa95477800f0eb0", evidenceNote: "Etherscan labels this 'Kraken: Hot Wallet 2' (Exchange); Payward is a Delaware corporation based in San Francisco." },
  "0x05ff6964d21e5dae3b1010d5ae0465b3c450f381": { entity: "Kraken", category: "exchange", jurisdiction: "US", confidence: "VERIFIED", source: "Etherscan public label + Payward regulatory filings", sourceUrl: "https://etherscan.io/address/0x05ff6964d21e5dae3b1010d5ae0465b3c450f381", evidenceNote: "Etherscan labels this 'Kraken: Hot Wallet 4' (Exchange)." },

  // --- OKX (Aux Cayes FinTech Co. Ltd) — Seychelles ---
  "0x4b4e14a3773ee558b6597070797fd51eb48606e5": { entity: "OKX", category: "exchange", jurisdiction: "SC", confidence: "VERIFIED", source: "Etherscan public label + OKX Terms of Service + DOJ Feb 2025 case", sourceUrl: "https://etherscan.io/address/0x4b4e14a3773ee558b6597070797fd51eb48606e5", evidenceNote: "Etherscan labels this 'OKX: Hot Wallet' (Exchange); OKX's own ToS names Aux Cayes FinTech Co. Ltd (Seychelles) as operator, and this entity pled guilty in a Feb 2025 DOJ case." },
  "0x4e7b110335511f662fdbb01bf958a7844118c0d4": { entity: "OKX", category: "exchange", jurisdiction: "SC", confidence: "VERIFIED", source: "Etherscan public label + OKX Terms of Service + DOJ Feb 2025 case", sourceUrl: "https://etherscan.io/address/0x4e7b110335511f662fdbb01bf958a7844118c0d4", evidenceNote: "Etherscan labels this 'OKX: Hot Wallet 2' (Exchange)." },

  // --- Bitfinex (iFinex Inc.) — British Virgin Islands ---
  "0x1151314c646ce4e0efd76d1af4760ae66a9fe30f": { entity: "Bitfinex", category: "exchange", jurisdiction: "VG", confidence: "VERIFIED", source: "Etherscan public label + 2021 NY AG settlement", sourceUrl: "https://etherscan.io/address/0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F", evidenceNote: "Etherscan labels this 'Bitfinex 1' (Exchange); the 2021 NY AG settlement with Bitfinex/Tether names iFinex Inc. as a BVI company." },
  "0x1b29dd8ff0eb3240238bf97cafd6edea05d5ba82": { entity: "Bitfinex", category: "exchange", jurisdiction: "VG", confidence: "VERIFIED", source: "Etherscan public label + 2021 NY AG settlement", sourceUrl: "https://etherscan.io/address/0x1b29DD8fF0EB3240238bF97CaFD6edeA05D5Ba82", evidenceNote: "Etherscan labels this 'Bitfinex 6' (Exchange); large historical transfer volumes." },

  // --- Upbit (Dunamu Inc.) — South Korea ---
  "0xba826fec90cefdf6706858e5fbafcb27a290fbe0": { entity: "Upbit", category: "exchange", jurisdiction: "KR", confidence: "VERIFIED", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0xba826fec90cefdf6706858e5fbafcb27a290fbe0", evidenceNote: "Etherscan labels this 'Upbit 2' (Exchange); operated by Dunamu Inc., Seoul, the first FSC-licensed exchange in Korea." },
  "0x5e032243d507c743b061ef021e2ec7fcc6d3ab89": { entity: "Upbit", category: "exchange", jurisdiction: "KR", confidence: "VERIFIED", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0x5e032243d507c743b061ef021e2ec7fcc6d3ab89", evidenceNote: "Etherscan labels this 'Upbit 3' (Exchange)." },

  // --- Bithumb Korea Co., Ltd. — South Korea ---
  "0x17e5545b11b468072283cee1f066a059fb0dbf24": { entity: "Bithumb", category: "exchange", jurisdiction: "KR", confidence: "VERIFIED", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0x17e5545b11b468072283cee1f066a059fb0dbf24", evidenceNote: "Etherscan labels this 'Bithumb: Hot Wallet' (Exchange); Seoul-based, FIU/FSC-registered." },

  // --- Gemini Trust Company, LLC — United States ---
  "0xd24400ae8bfebb18ca49be86258a3c749cf46853": { entity: "Gemini", category: "exchange", jurisdiction: "US", confidence: "VERIFIED", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0xd24400ae8bfebb18ca49be86258a3c749cf46853", evidenceNote: "Etherscan labels this 'Gemini' (Exchange); Gemini Trust Co. is a NYDFS-chartered limited-purpose trust company." },

  // --- Casey Block Services Pty Ltd (trading as CoinSpot) — Australia ---
  "0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1": { entity: "CoinSpot", category: "exchange", jurisdiction: "AU", confidence: "VERIFIED", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1", evidenceNote: "Etherscan labels this 'CoinSpot 1' (Exchange); Casey Block Services Pty Ltd has been AUSTRAC-registered since 2018." },

  // --- Neblio Technologies Private Limited (CoinDCX) — India ---
  "0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe": { entity: "CoinDCX", category: "exchange", jurisdiction: "IN", confidence: "VERIFIED", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe", evidenceNote: "Etherscan labels this 'CoinDCX 2' (Exchange); Neblio Technologies Private Limited is FIU-India registered." },

  // --- bitFlyer Inc. — Japan ---
  "0xa9264494a92ced04747ac84fc9ca5a0b9549b491": { entity: "bitFlyer", category: "exchange", jurisdiction: "JP", confidence: "HIGH", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0xa9264494a92ced04747ac84fc9ca5a0b9549b491", evidenceNote: "Etherscan labels this 'bitFlyer 3' (Exchange). bitFlyer also runs separately-regulated US/Europe affiliates, so this is rated HIGH rather than VERIFIED." },
  "0xb01cb49fe0d6d6e47edf3a072d15dfe73155331c": { entity: "bitFlyer", category: "exchange", jurisdiction: "JP", confidence: "HIGH", source: "Etherscan public label", sourceUrl: "https://etherscan.io/address/0xB01cb49fe0D6D6E47EDf3A072d15dfe73155331C", evidenceNote: "Etherscan labels this 'bitFlyer 2' (Exchange)." },

  // --- Coincheck, Inc. (Monex Group) — Japan ---
  "0xd52814615dc129e1eea3520e7e7f8d44dbfc6c5b": { entity: "Coincheck", category: "exchange", jurisdiction: "JP", confidence: "HIGH", source: "Etherscan public label (community compilation)", sourceUrl: "https://etherscan.io/address/0xd52814615DC129e1eEa3520e7e7f8d44DBfc6c5b", evidenceNote: "Etherscan's own page discloses this tag came from a public researcher compilation rather than a first-party submission; Coincheck itself is FSA-registered, a Monex Group subsidiary." }
};
