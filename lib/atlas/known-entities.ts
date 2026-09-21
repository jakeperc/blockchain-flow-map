/**
 * Known operating-entity evidence. Entity-level records live here; the address list lives in
 * known-addresses.ts. Pure data; safe to ship to the browser.
 *
 * RULES (these are the whole point of the project — do not relax them):
 *  - Only add an address you can cite a real, working https:// source for: an exchange's own published
 *    disclosure, a regulator or court filing, or a blockchain explorer's own public label feature.
 *    Never guess or infer an address-to-entity mapping. Reject "(reported)" or user-submitted tags.
 *  - An entity's `jurisdiction` is the ISO-2 code of the SPECIFIC operating legal entity the source
 *    documents, not "where the brand is famous for being based". It must exist in geography.ts.
 *  - `confidence` is VERIFIED (explorer tag + primary jurisdiction document, or tag + the company's
 *    own published address list) or HIGH (tag + corroborated jurisdiction, but the brand runs several
 *    separately regulated affiliates). Anything weaker is left out entirely. MEDIUM never draws a route.
 *  - Hot/cold/exchange wallets only. Deposit sweepers, routers, bridges and issuer treasuries are out.
 *  - Re-verify periodically and bump the dates: the model refuses evidence older than 180 days, and
 *    exchanges rotate hot wallets. `scripts/verify-registry.cjs` checks every entry.
 *
 * Deliberately excluded because the controlling legal entity or its jurisdiction is genuinely disputed
 * in public sources: Bybit (BVI entity dissolved, same-named Seychelles successor, Dubai VARA arm —
 * which controls a given wallet is not publicly confirmable), Crypto.com, Bitstamp (UK vs Luxembourg
 * entities), Luno (Singapore vs South Africa entities), WazirX (Singapore vs India entities), HTX/Huobi
 * (Seychelles status contested). Circle's and Tether's issuer/treasury addresses are also excluded on
 * purpose: a transfer from an issuer treasury is issuance, not bilateral settlement, which is exactly
 * what the mint/burn and treasury exclusions in engine.ts exist to keep out.
 *
 * Labels appear over time, so this list is re-scanned with scripts/registry/label-scan.mjs (results and dates in
 * scripts/registry/label-scan.json; last scan 2026-09-21). Not disputed, just unlabelled: SBI VC Trade, Zaif,
 * PDAX, Buda, Foxbit, NovaDAX, Volabit, Yellow Card, Busha, Ovex, Rain, CoinMENA, BitOasis, ZebPay, Giottus,
 * Mudrex, Swissquote, BISON, Flow Traders, Fireblocks, Coinmate, Bits of Gold, Coinmotion, Safello, Belo,
 * Buenbit, SatoshiTango, Swyftx are properly licensed but have no public Etherscan wallet tag, so there is nothing
 * to attribute. OSL, Pintu, Quidax, Bit2Me, Young Platform, QCP and Keyrock are tagged only on token contracts,
 * deployers, funders, team or treasury wallets or deposit plumbing, none of which is admissible. Tagged since the
 * 2026-09-19 scan, so candidates once an operator document is read: Gopax, HashKey Exchange, Independent Reserve,
 * Lemon Cash, Ripio, M2, Bitbns, Bitcoin.de.
 * Labelled but left out on purpose: WhiteBIT and Revolut (operating entity ambiguous), zondacrypto
 * (Estonian licence revoked June 2026), Kuna and Genesis Trading (ceased operations), DWF Labs
 * (entity document unreadable), Abraxas Capital (fund vehicle, not a venue), BitMEX (winding up Sept 2026),
 * EXMO (UK-sanctioned May 2026), Blockchain.com, Deribit, BitMart, Phemex, AscendEX, Bitrue, LBank, CoinEx,
 * BingX, WOO X, XT.com, HitBTC, Wirex, Okcoin, Bakkt, MoonPay, Coinstore (multi-entity or contradicted operator).
 */
import type {Attribution,Chain} from './model';
import {ADDRESSES,DERIVED,CODE_PROBED_AT} from './known-addresses';
import {EXPLORERS} from './geography';
export type EntityCategory='exchange'|'market maker'|'custodian'|'broker';
export interface EntityRecord {id:string;name:string;category:EntityCategory;jurisdiction:string;confidence:'VERIFIED'|'HIGH';source:string;sourceUrl:string;evidenceNote:string;lastVerified:string;}
const e=(id:string,name:string,jurisdiction:string,confidence:'VERIFIED'|'HIGH',source:string,sourceUrl:string,evidenceNote:string,lastVerified='2026-09-18',category:EntityCategory='exchange'):EntityRecord=>({id,name,category,jurisdiction,confidence,source,sourceUrl,evidenceNote,lastVerified});
/** Keyed by cluster id. Same id ⇒ same addressCluster ⇒ intra-entity moves are excluded as treasury movement by classify(). */
export const ENTITIES:Record<string,EntityRecord>={
 binance:e('binance','Binance','KY','VERIFIED','DOJ November 2023 plea agreement naming Binance Holdings Limited as a Cayman Islands company','https://www.justice.gov/opa/pr/binance-and-ceo-plead-guilty-federal-charges-4b-resolution','Binance Holdings Limited, d/b/a Binance.com. Distinct from the separate US entity Binance.US (BAM Trading), which is not included.'),
 okx:e('okx','OKX','SC','VERIFIED','OKX Terms of Service naming Aux Cayes FinTech Co. Ltd (Seychelles) + DOJ February 2025 guilty plea','https://www.justice.gov/opa/pr/okx-pleads-guilty-violating-us-anti-money-laundering-laws','Aux Cayes FinTech Co. Ltd, the Seychelles operator named in OKX\'s own terms and in the DOJ case.'),
 coinbase:e('coinbase','Coinbase','US','VERIFIED','Coinbase Global, Inc. SEC Form 10-K (Delaware corporation)','https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001679788&type=10-K','Coinbase, Inc., the retail/exchange platform. Coinbase Custody Trust Company wallets are not separately identifiable from public labels and are not included.'),
 kraken:e('kraken','Kraken','US','VERIFIED','Payward, Inc. regulatory filings (Delaware corporation, San Francisco)','https://www.sec.gov/newsroom/press-releases/2023-237','Payward, Inc. / Payward Ventures, Inc.'),
 gemini:e('gemini','Gemini','US','VERIFIED','NYDFS limited-purpose trust charter for Gemini Trust Company, LLC','https://www.dfs.ny.gov/virtual_currency_businesses','Gemini Trust Company, LLC, a NYDFS-chartered limited-purpose trust company.'),
 bitfinex:e('bitfinex','Bitfinex','VG','VERIFIED','2021 New York Attorney General settlement naming iFinex Inc. as a British Virgin Islands company','https://ag.ny.gov/press-release/2021/attorney-general-james-ends-virtual-currency-trading-platform-bitfinexs-illegal','iFinex Inc., the BVI-incorporated operator of Bitfinex named in the NY AG settlement.'),
 upbit:e('upbit','Upbit','KR','VERIFIED','Dunamu Inc., Seoul, FSC/FIU-licensed virtual asset service provider','https://www.fsc.go.kr/eng/','Dunamu Inc., the first FSC-licensed exchange in Korea.'),
 bithumb:e('bithumb','Bithumb','KR','VERIFIED','Bithumb Korea Co., Ltd., Seoul, FSC/FIU-registered','https://www.fsc.go.kr/eng/','Bithumb Korea Co., Ltd.'),
 coinspot:e('coinspot','CoinSpot','AU','VERIFIED','AUSTRAC digital currency exchange registration of Casey Block Services Pty Ltd','https://www.austrac.gov.au/business/core-guidance/digital-currency-exchange-providers','Casey Block Services Pty Ltd, trading as CoinSpot; AUSTRAC-registered since 2018.'),
 coindcx:e('coindcx','CoinDCX','IN','VERIFIED','FIU-India registration of Neblio Technologies Private Limited','https://fiuindia.gov.in/','Neblio Technologies Private Limited.'),
 bitflyer:e('bitflyer','bitFlyer','JP','HIGH','Japan FSA crypto-asset exchange service provider register (bitFlyer, Inc.)','https://www.fsa.go.jp/en/regulated/licensed/index.html','bitFlyer, Inc., Tokyo. Rated HIGH rather than VERIFIED because bitFlyer also runs separately regulated US and EU affiliates and the numbered core wallets cannot be tied to one of them from public labels alone.'),
 coincheck:e('coincheck','Coincheck','JP','HIGH','Japan FSA register (Coincheck, Inc., Monex Group)','https://www.fsa.go.jp/en/regulated/licensed/index.html','Coincheck, Inc., a Monex Group subsidiary.'),
 // Europe, UK, Türkiye
 wintermute:e('wintermute','Wintermute','GB','VERIFIED','Companies House record for Wintermute Trading Ltd (company 10882520, London)','https://find-and-update.company-information.service.gov.uk/company/10882520','Wintermute Trading Ltd, London, an algorithmic market maker. Wintermute 1 is the firm\'s verified trading contract; the others are EOAs.','2026-09-18','market maker'),
 bitvavo:e('bitvavo','Bitvavo','NL','VERIFIED','AMF CASP white-list entry for Bitvavo B.V. (home authority AFM, Netherlands; MiCA-authorised)','https://www.amf-france.org/en/warnings/white-lists/casp/bitvavo-bv','Bitvavo B.V., Amsterdam. Etherscan tags are Etherscan-applied from a public compilation rather than first-party submissions.'),
 bitcoinsuisse:e('bitcoinsuisse','Bitcoin Suisse','CH','VERIFIED','FINMA statement on Bitcoin Suisse AG (Zug; SRO-supervised financial intermediary) + company legal page','https://www.finma.ch/en/news/2021/03/20210317-mm-btcs/','Bitcoin Suisse AG, Zug, an SRO-supervised crypto broker and custodian rather than a FINMA-licensed bank.','2026-09-18','broker'),
 paribu:e('paribu','Paribu','TR','VERIFIED','Capital Markets Board of Türkiye (SPK) list of crypto-asset service providers in operation','https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/faaliyette-bulunanlar-listesi','Paribu Kripto Varlık Alım Satım Platformu AŞ. The SPK list is marked provisional.'),
 btcturk:e('btcturk','BtcTurk','TR','VERIFIED','Capital Markets Board of Türkiye (SPK) list of crypto-asset service providers in operation','https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/faaliyette-bulunanlar-listesi','Btcturk Kripto Varlık Alım Satım Platformu AŞ. The SPK list is marked provisional.'),
 coinmetro:e('coinmetro','Coinmetro','EE','HIGH','Coinmetro Terms of Use (Coinmetro OÜ, Tallinn, company 14448371, Estonian FIU licence FVT000126)','https://www.coinmetro.com/terms-of-use','Coinmetro OÜ, Tallinn. Rated HIGH: an Estonian registry mirror shows the company\'s registration as lapsed with overdue filings, so re-check periodically. Several wallets are the exchange\'s own multisig custody contracts.'),
 copper:e('copper','Copper','CH','HIGH','Copper Terms and Conditions (Copper Markets (Switzerland) AG, Zug, VQF member)','https://copper.co/en/terms','Copper Markets (Switzerland) AG is the contracting entity in Copper\'s terms, but the group has separately regulated affiliates (UK, ADGM, Liechtenstein, US), so the wallet-controlling entity is not documented.','2026-09-18','custodian'),
 // Australia
 coinjar:e('coinjar','CoinJar','AU','HIGH','CoinJar legal page (CoinJar Australia Pty Ltd, AUSTRAC-registered; CoinJar UK Limited, FCA-registered)','https://www.coinjar.com/au/legal','Brand-level tags cannot distinguish the Australian from the UK affiliate.'),
 digitalsurge:e('digitalsurge','Digital Surge','AU','VERIFIED','Digital Surge terms (Digital Surge Pty Ltd, AUSTRAC 100576214)','https://digitalsurge.com.au/terms','Digital Surge Pty Ltd, Brisbane. The tagged wallet has been inactive for over a year.'),
 btcmarkets:e('btcmarkets','BTC Markets','AU','HIGH','BTC Markets regulation page (BTC Markets Pty Ltd, AUSTRAC-registered)','https://www.btcmarkets.net/regulation','BTC Markets Pty Ltd, Melbourne. The company page could not be read directly during research, so HIGH.'),
 // Canada
 coinsquare:e('coinsquare','Coinsquare','CA','VERIFIED','Coinsquare regulation page (Coinsquare Capital Markets Ltd., CIRO investment dealer, FINTRAC MSB)','https://www.coinsquare.com/en-ca/regulation','Coinsquare Capital Markets Ltd., Toronto, which also operates the Bitbuy brand. Wallets are custodied addresses; several are lightly used.'),
 shakepay:e('shakepay','Shakepay','CA','VERIFIED','Shakepay help centre (FINTRAC MSB M17065696; CIRO investment dealer)','https://help.shakepay.com/en/articles/1873664-is-my-information-and-money-safe-and-secure-in-shakepay','Shakepay Inc., Montréal. Shakepay 10 is a multisig custody contract.'),
 newton:e('newton','Newton','CA','HIGH','OSC decision for Newton Crypto Ltd. (restricted dealer)','https://www.osc.ca/en/securities-law/orders-rulings-decisions/newton-crypto-ltd-2','Newton Crypto Ltd., Toronto. Primary documents could not be read directly during research, so HIGH.'),
 wealthsimple:e('wealthsimple','Wealthsimple Crypto','CA','VERIFIED','Wealthsimple crypto product risk disclosure (Wealthsimple Investments Inc., CIRO dealer, FINTRAC MSB)','https://www.wealthsimple.com/en-ca/legal/crypto-product-risk-disclosure','Wealthsimple Investments Inc., Toronto. The wallet may be retired (last activity April 2025).','2026-09-18','broker'),
 // Large offshore exchanges
 kucoin:e('kucoin','KuCoin','SC','HIGH','DOJ SDNY guilty plea (January 2025) naming Peken Global Limited, a Seychelles-based entity operating KuCoin; CFTC March 2024 release naming Mek Global Limited, PhoenixFin Pte Ltd, Flashdot Limited and Peken Global Limited','https://www.justice.gov/usao-sdny/pr/kucoin-pleads-guilty-unlicensed-money-transmission-charge-and-agrees-pay-penalties','Peken Global Limited. Rated HIGH: a March 2026 CFTC release describes the same company as incorporated in the Turks and Caicos Islands, so the domicile may have moved; multi-affiliate group.'),
 bitget:e('bitget','Bitget','SC','VERIFIED','Bitget Terms of Use naming BTG Technology Holdings Limited (Seychelles registration 242948) as platform operator','https://www.bitget.com/support/articles/360014944032-terms-of-use','BTG Technology Holdings Limited, Mahé, Seychelles, per the company\'s own terms.'),
 mexc:e('mexc','MEXC','SC','VERIFIED','Seychelles FSA press release (May 2026) identifying MX Global Ltd (IBC 238047) as the entity operating the MEXC platform','https://fsaseychelles.sc/news/press-releases/fsa-takes-enforcement-action-against-mx-global-ltd-for-unlicensed-virtual-asset-services-operations','MX Global Ltd, a Seychelles IBC, identified by the regulator in an enforcement action for operating without a Seychelles VASP licence.'),
 // US institutions and market makers
 robinhood:e('robinhood','Robinhood Crypto','US','VERIFIED','NYDFS register of regulated virtual currency entities (Robinhood Crypto, LLC, BitLicence 2019)','https://www.dfs.ny.gov/apps_and_licensing/virtual_currency_businesses','Robinhood Crypto, LLC.'),
 cumberland:e('cumberland','Cumberland DRW','US','HIGH','NYDFS register (Cumberland New York LLC) + cumberland.io policy page (Cumberland DRW LLC, FinCEN-registered MSB)','https://www.dfs.ny.gov/apps_and_licensing/virtual_currency_businesses','Two US affiliates (Cumberland DRW LLC, Chicago; Cumberland New York LLC) plus non-US affiliates; the brand-level tag does not say which controls the wallet.','2026-09-18','market maker'),
 jump:e('jump','Jump Trading','US','HIGH','federal court filing describing Jump Trading, LLC as a Delaware LLC based in Chicago; SEC order on Jump Crypto subsidiary Tai Mo Shan Limited (Cayman Islands)','https://business.cch.com/srd/20251218_Snyder-v-JumpTrading_complaint.pdf','Jump Trading, LLC (Chicago) is the documented parent; the crypto trading affiliate Tai Mo Shan Limited is Cayman-incorporated, and the tag does not identify which controls the wallet.','2026-09-18','market maker'),
 galaxy:e('galaxy','Galaxy Digital','US','HIGH','Galaxy Digital Inc. Form 10-K subsidiaries exhibit (Galaxy Digital LLC, Delaware; Galaxy Digital Trading Cayman LLC) + NYDFS register (GalaxyOne Prime NY LLC)','https://www.sec.gov/Archives/edgar/data/1859392/000185939226000016/exhibit211-subsidiariesofg.htm','Galaxy Digital Inc. (Delaware); the tags do not identify whether the Delaware or Cayman trading subsidiary controls a given wallet.','2026-09-18','market maker'),
 falconx:e('falconx','FalconX','US','HIGH','FalconX disclosures page (FalconX Bravo, Inc. CFTC swap dealer; Solios, Inc. and FalconX Delta, Inc. FinCEN MSBs; FalconX Limited, Malta)','https://www.falconx.io/disclaimers','Prime broker with US, Maltese and Singaporean entities; the generic tag does not identify which controls the wallet.','2026-09-18','broker'),
 bitgo:e('bitgo','BitGo','US','HIGH','NYDFS register (BitGo New York Trust Company, LLC) + bitgo.com legal page listing US, Singapore, EU and MENA entities','https://www.dfs.ny.gov/apps_and_licensing/virtual_currency_businesses','Multi-entity custodian; only BitGo\'s own omnibus wallet is included, never client multisig contracts.','2026-09-18','custodian'),
 paxos:e('paxos','Paxos / itBit','US','HIGH','NYDFS press release: Paxos Trust Company, LLC holds the limited-purpose trust charter and operates the itBit exchange','https://www.dfs.ny.gov/reports_and_publications/press_releases/pr1809101','Paxos Trust Company, LLC (New York). Issuer treasury addresses for USDP/PYUSD are deliberately excluded; the brand also has non-US affiliates, so HIGH.'),
 // Latin America and Africa
 bitso:e('bitso','Bitso','GI','HIGH','Bitso trust page and Gibraltar Government press release 729/2019 (The Badger Technology Company Limited, GFSC DLT licence)','https://bitso.com/mx/trust','The exchange and custody operator is Gibraltar-licensed The Badger Technology Company Limited; Mexico\'s CNBV licenses only the fiat affiliate. Multi-affiliate group, so HIGH.'),
 mercadobitcoin:e('mercadobitcoin','Mercado Bitcoin','BR','HIGH','Brazilian company registry (Mercado Bitcoin Serviços Digitais Ltda., CNPJ 18.213.434/0001-35) + Banco Central do Brasil payment-institution authorisation','https://empresas.serasaexperian.com.br/consulta-gratis/MERCADO-BITCOIN-SERVICOS-DIGITAIS-LTDA-18213434000135','Mercado Bitcoin Serviços Digitais Ltda., São Paulo. Registry mirrors and press only; company pages could not be read directly, so HIGH.'),
 valr:e('valr','VALR','ZA','VERIFIED','VALR announcement of its FSCA crypto-asset service provider licence (VALR (Pty) Ltd, FSP 53308)','https://blog.valr.com/blog/valr-receives-regulatory-license-as-crypto-asset-service-provider-casp','VALR (Pty) Ltd, Johannesburg.'),
 // Northeast Asia (wave D, 2026-09-19)
 coinone:e('coinone','Coinone','KR','VERIFIED','FSC/KoFIU press releases naming (주)코인원 as a registered virtual asset service provider (registration accepted 2021-11-12; renewal 2026)','https://www.fsc.go.kr/no010101/86695','Coinone Inc. ((주)코인원), Seoul; KoFIU-registered VASP.','2026-09-19'),
 korbit:e('korbit','Korbit','KR','HIGH','FSC/KoFIU press release (2021-10-06) on acceptance of 주식회사 코빗\'s VASP registration','https://www.fsc.go.kr/no010101/76638','Korbit Co., Ltd. (주식회사 코빗), Seoul. Rated HIGH: press reports the same corporation was acquired by Mirae Asset and renamed Digital X in 2026 while Etherscan tags still read Korbit; the rename was not yet confirmed in a regulator document. Korbit 1 is a BitGo multisig custody contract.','2026-09-19'),
 gmocoin:e('gmocoin','GMO Coin','JP','VERIFIED','Japan FSA register of crypto-asset exchange service providers (GMOコイン株式会社, Kanto Local Finance Bureau no. 00006, registered 2017-09-29)','https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf','GMO Coin, Inc. (GMOコイン株式会社), Tokyo. Etherscan tags are disclosed as sourced from a public researcher compilation.','2026-09-19'),
 bitbank:e('bitbank','bitbank','JP','VERIFIED','Japan FSA register of crypto-asset exchange service providers (ビットバンク株式会社, Kanto Local Finance Bureau no. 00004, registered 2017-09-29)','https://www.fsa.go.jp/menkyo/menkyoj/kasoutuka.pdf','Bitbank, Inc. (ビットバンク株式会社), Tokyo. Etherscan tags are disclosed as sourced from a public researcher compilation.','2026-09-19'),
 // Singapore, Southeast Asia, Taiwan (wave D, 2026-09-19)
 coinhako:e('coinhako','Coinhako','SG','VERIFIED','MAS Financial Institutions Directory entry (Major Payment Institution, digital payment token service)','https://eservices.mas.gov.sg/fid/institution/detail/220377-HAKO-TECHNOLOGY-PTE-LTD','SBI Coinhako Technology Pte. Ltd. (formerly Hako Technology Pte. Ltd.), Singapore; a single MAS-licensed operating entity. Several tagged wallets are historical and near-empty.','2026-09-19'),
 indodax:e('indodax','Indodax','ID','VERIFIED','OJK press release (December 2025) publishing the whitelist of licensed crypto-asset traders (PT Indodax Nasional Indonesia, licence S-18/D.07/2025)','https://ojk.go.id/id/berita-dan-kegiatan/siaran-pers/Pages/OJK-Terbitkan-Whitelist-Penyelenggara-Perdagangan-Aset-Keuangan-Digital-Dan-Aset-Kripto-Berizin.aspx','PT Indodax Nasional Indonesia, Jakarta; OJK-licensed crypto-asset trader.','2026-09-19'),
 tokocrypto:e('tokocrypto','Tokocrypto','ID','VERIFIED','OJK press release (December 2025) publishing the whitelist of licensed crypto-asset traders (PT Aset Digital Berkat, licence S-14/D.07/2025)','https://ojk.go.id/id/berita-dan-kegiatan/siaran-pers/Pages/OJK-Terbitkan-Whitelist-Penyelenggara-Perdagangan-Aset-Keuangan-Digital-Dan-Aset-Kripto-Berizin.aspx','PT Aset Digital Berkat, Jakarta; Binance-majority-owned but separately licensed in Indonesia. Its treasury wallet is deliberately excluded.','2026-09-19'),
 bitkub:e('bitkub','Bitkub','TH','VERIFIED','SEC Thailand licence check, digital asset exchange licensee table (Bitkub Online Company Limited)','https://market.sec.or.th/LicenseCheck/views/DABusiness?exchange/en','Bitkub Online Company Limited, Bangkok; SEC-licensed digital asset exchange. Multisig 1 is the reserve wallet contract that funds the numbered hot wallets.','2026-09-19'),
 coinsph:e('coinsph','Coins.ph','PH','VERIFIED','Bangko Sentral ng Pilipinas list of virtual asset service providers (Betur Inc., doing business as Coins.ph)','https://www.bsp.gov.ph/Lists/Directories/Attachments/19/VASP.pdf','Betur Inc., Taguig City; BSP-registered virtual asset service provider.','2026-09-19'),
 bitopro:e('bitopro','BitoPro','TW','VERIFIED','Taiwan FSC Securities and Futures Bureau list of enterprises that completed VASP anti-money-laundering registration (BitoPro Technology Co., Ltd.)','https://www.sfb.gov.tw/en/home.jsp?id=286&parentpath=0,117','BitoPro Technology Co., Ltd. (幣託科技股份有限公司), Taipei. Its tagged deposit addresses are deliberately excluded.','2026-09-19'),
 maicoin:e('maicoin','MaiCoin','TW','HIGH','Taiwan FSC Securities and Futures Bureau list of enterprises that completed VASP anti-money-laundering registration (Modernity Financial Technologies, Ltd.)','https://www.sfb.gov.tw/en/home.jsp?id=286&parentpath=0,117','Modernity Financial Technologies, Ltd. (現代財富科技股份有限公司), Taipei, which runs both the MaiCoin brokerage and the MAX exchange; the tag names only the MaiCoin brand, so HIGH.','2026-09-19'),
 // wave-mena (2026-09-19)
 altcointrader:e('altcointrader','AltCoinTrader','ZA','VERIFIED','FSCA published list of authorised crypto-asset service providers (December 2024; AltCoin Trader (Pty) Ltd, FSP 53614) + company FAIS disclosure','https://www2.fsca.co.za/Regulatory%20Frameworks/Documents/Published%20list%20of%20Authorised%20CASPs_18%20December%202024.pdf','AltCoin Trader (Pty) Ltd, Johannesburg; FSCA-licensed crypto-asset service provider with no separately regulated affiliates. Most tags are disclosed by Etherscan as sourced from a public researcher compilation.','2026-09-19'),
 // wave-europe (2026-09-19)
 bitpanda:e('bitpanda','Bitpanda','AT','HIGH','AMF CASP white-list entry for Bitpanda GmbH (MiCA authorisation granted by FMA Austria, April 2025)','https://www.amf-france.org/en/warnings/white-lists/casp/bitpanda-gmbh','Bitpanda GmbH, Vienna (FN 569240v); MiCA-authorised by the Austrian FMA. Rated HIGH: every tag is disclosed as sourced from a public researcher compilation and the group runs separately regulated affiliates in Germany and Malta.','2026-09-19'),
 // wave-americas (2026-09-19)
 uphold:e('uphold','Uphold','US','HIGH','Uphold important-disclosures page naming Uphold HQ Inc. (Charleston, South Carolina; FinCEN-registered MSB, NMLS 1269875)','https://uphold.com/en-us/legal/important-disclosures','Uphold HQ Inc., Charleston, South Carolina. Rated HIGH: the tags name only the brand and Uphold runs separately regulated affiliates in the UK, Portugal and the Bahamas.','2026-09-19'),
 ndax:e('ndax','NDAX','CA','VERIFIED','Ndax Canada Inc. relationship disclosure document (CIRO investment dealer, Alberta Securities Commission principal regulator, FINTRAC MSB)','https://ndax.io/en/legal/account-agreements/relationship-disclosure-document','Ndax Canada Inc., Calgary, Alberta; CIRO member since December 2024. The tag is disclosed by Etherscan as sourced from a public researcher compilation.','2026-09-19'),
 netcoins:e('netcoins','Netcoins','CA','VERIFIED','Netcoins legal page (Netcoins Inc., BCSC-registered restricted dealer, FINTRAC MSB M15560893)','https://www.netcoins.com/legal','Netcoins Inc., Vancouver, British Columbia; registered restricted dealer in all provinces, subsidiary of Surge Digital Inc. Tags are disclosed by Etherscan as sourced from a public researcher compilation.','2026-09-19'),
 // wave-mm (2026-09-19)
 b2c2:e('b2c2','B2C2','GB','HIGH','B2C2 regulatory permissions page (B2C2 Ltd, Companies House 07995888, London; B2C2 OTC Ltd, FCA FRN 810834) + Companies House record','https://find-and-update.company-information.service.gov.uk/company/07995888','B2C2 Ltd, London. Rated HIGH: the tag is group-level and the firm runs separately regulated affiliates in the UK, Cayman Islands, US, Luxembourg, Singapore and France.','2026-09-19','market maker'),
 gsr:e('gsr','GSR','HK','HIGH','GSR general trading terms of business naming GSR Markets Limited (Hong Kong company 67897929) as the trading entity','https://www.gsr.io/general-trading-terms-of-business','GSR Markets Limited, Hong Kong, the contracting entity in GSR\'s own trading terms. Rated HIGH: the tag is brand-level and GSR also operates MAS-, FCA- and NMLS-regulated affiliates.','2026-09-19','market maker'),
 ambergroup:e('ambergroup','Amber Group','KY','HIGH','SEC merger-agreement exhibit (November 2024) describing Amber Global Limited as a Cayman Islands exempted company, the entity Amber International\'s Form 20-F defines as Amber Group','https://www.sec.gov/Archives/edgar/data/1697818/000110465924124155/tm2429824d1_ex99-2.htm','Amber Global Limited, Cayman Islands. Rated HIGH: the tag is brand-level; the separately licensed Singapore and Hong Kong affiliates sit under Nasdaq-listed Amber International, a different legal entity.','2026-09-19','market maker'),
 anchorage:e('anchorage','Anchorage Digital','US','HIGH','OCC news release NR 2021-6 conditionally approving Anchorage Digital Bank, National Association','https://www.occ.gov/news-issuances/news-releases/2021/nr-occ-2021-6.html','Anchorage Digital Bank, National Association, Sioux Falls, South Dakota; OCC-chartered national trust bank. Rated HIGH: the tag is brand-level, the group has non-US affiliates, and the tag is disclosed by Etherscan as sourced from a public researcher compilation.','2026-09-19','custodian'),
 // wave-usaff (2026-09-19)
 binanceus:e('binanceus','Binance.US','US','VERIFIED','SEC press release 2023-101 (June 2023) naming BAM Trading Services Inc. as the US affiliate operating Binance.US + Binance.US terms of use','https://www.sec.gov/newsroom/press-releases/2023-101-sec-files-13-charges-against-binance-entities-founder-changpeng-zhao','BAM Trading Services Inc., doing business as Binance.US, Miami, Florida; a separate US legal entity from Binance Holdings Limited (Cayman Islands), which has its own record.','2026-09-19'),
 zerohash:e('zerohash','Zero Hash','US','HIGH','NYDFS register of virtual currency businesses listing Zero Hash LLC and Zero Hash Liquidity Services LLC (licensed July 2019)','https://www.dfs.ny.gov/virtual_currency_businesses','Zero Hash LLC, Chicago, Illinois. Rated HIGH: the group runs several separately licensed affiliates and the only tag is disclosed by Etherscan as sourced from a public researcher compilation.','2026-09-19','broker'),
 fidelity:e('fidelity','Fidelity Digital Assets','US','HIGH','OCC news release NR 2025-125 (December 2025) conditionally approving Fidelity Digital Assets, National Association, and the company page describing the NYDFS charter of Fidelity Digital Asset Services, LLC','https://www.occ.gov/news-issuances/news-releases/2025/nr-occ-2025-125.html','Fidelity Digital Asset Services, LLC and Fidelity Digital Assets, National Association, Boston, Massachusetts. Rated HIGH: the tag says only Fidelity and the brand also has a UK affiliate.','2026-09-19','custodian'),
 // wave-apac2 (2026-09-19)
 bullish:e('bullish','Bullish','GI','HIGH','Bullish announcement of its Gibraltar Financial Services Commission DLT licence (Bullish (GI) Limited, November 2021) + SEC prospectus (August 2025) confirming the GFSC licence','https://www.bullish.com/us/news-insights/bullish-obtains-regulatory-license-from-gibraltar-financial-services-commission','Bullish (GI) Limited, Gibraltar. Rated HIGH: the tag is brand-level, the group also runs SFC-licensed Bullish HK Markets Limited (licensed 2025, after these wallets were created) and a German affiliate, and every tag is disclosed by Etherscan as sourced from a public researcher compilation.','2026-09-19'),
 // wave-europe2 (2026-09-19)
 firi:e('firi','Firi','NO','VERIFIED','Firi regulatory page naming Firi AS (org. nr 919 932 465), MiCA CASP authorised by Finanstilsynet on 22 May 2026 (register id 199160)','https://firi.com/about/financial-supervisory-authority','Firi AS, Oslo; MiCA-authorised crypto-asset service provider and e-money institution.','2026-09-19'),
 nbx:e('nbx','NBX','NO','VERIFIED','Finanstilsynet supervision report on Norwegian Block Exchange AS (registered exchange and custody provider since June 2019)','https://www.finanstilsynet.no/nyhetsarkiv/tilsynsrapporter/2024/tilsynsrapport---norwegian-block-exchange-as/','Norwegian Block Exchange AS (org. nr 920 245 676), Lysaker; registered with Finanstilsynet, MiCA application pending.','2026-09-19'),
 lcx:e('lcx','LCX','LI','VERIFIED','LCX AG imprint (Vaduz, commercial register FL-0002.580.678-2, supervised by the FMA Liechtenstein)','https://www.lcx.com/imprint/','LCX AG, Vaduz. Its earlier FMA blockchain-act registrations have lapsed and its MiCA application is under review, but the operating entity and jurisdiction are unambiguous. Token, reserve and deployer wallets are deliberately excluded.','2026-09-19'),
 cryptal:e('cryptal','Cryptal','GE','VERIFIED','Cryptal terms of use naming Digital Ledger Technologies LLC, registered in Georgia, National Bank of Georgia VASP licence 0002-9404','https://cryptal.com/en/terms-of-use','Digital Ledger Technologies LLC, Tbilisi; National Bank of Georgia licensed virtual asset service provider.','2026-09-19'),
 bitci:e('bitci','Bitci','TR','HIGH','Capital Markets Board of Türkiye (SPK) list of crypto-asset service providers in operation (Safebit Kripto Varlık Alım Satım Platformu AŞ, formerly Bitci Borsa Teknoloji AŞ)','https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/faaliyette-bulunanlar-listesi','Bitci Borsa Teknoloji AŞ, Istanbul, renamed Safebit in 2025. Rated HIGH: the tag carries the former brand and the wallet has been dormant since 2021.','2026-09-19'),
 swissborg:e('swissborg','SwissBorg','FR','HIGH','AMF white-list entry for BlockNodes SAS, trade name SwissBorg (MiCA CASP authorisation A2026-011, March 2026)','https://www.amf-france.org/en/warnings/white-lists/daspcasp/blocknodes-sas','BlockNodes SAS, Paris, the MiCA-authorised operator since user accounts migrated in June 2026. Rated HIGH: the brand also has a Swiss parent and a former Estonian contracting entity, and the tagged wallets last transacted before the migration.','2026-09-19'),
 // wave-global2 (2026-09-19)
 poloniex:e('poloniex','Poloniex','SC','HIGH','Ontario Capital Markets Tribunal statement of allegations (May 2021) describing Polo Digital Assets, Ltd. as a corporation incorporated in the Republic of Seychelles + FCA warning notice (December 2023) giving its Eden Island, Seychelles address','https://www.capitalmarketstribunal.ca/en/proceedings/polo-digital-assets-ltd-re/statement-allegations-matter-polo-digital-assets-ltd','Polo Digital Assets, Ltd., Eden Island, Seychelles. Rated HIGH: the tags name only the brand and the older wallets were created under the previous US operator before the November 2019 sale.','2026-09-19')
};
/**
 * The index is built once, eagerly, and holds only real entries. It is deliberately NOT a lazy cache:
 * the live client asks about both endpoints of every transfer it sees, tens of thousands of distinct
 * unknown addresses per hour, and a cache that memoised those misses grew without bound in a page meant
 * to stay open all day. Bounded by the registry instead.
 *
 * Two tiers live here. FIRST-PARTY rows come from ADDRESSES: a public name tag read on that chain's own
 * explorer. DERIVED rows come from DERIVED in known-addresses.ts: an Ethereum plain account whose address
 * also carries no code on the target chain, so the same private key controls it there. Derivation is a
 * clearly-marked inference at the minimum admissible score, never VERIFIED, and never from a contract.
 */
const DERIVED_MARK='DERIVED';
const INDEX=new Map<string,Attribution>();
const evidencedByChain=new Map<string,string[]>();
const keyOf=(chain:string,address:string)=>`${chain}:${chain==='Tron'||chain==='Solana'?address:address.toLowerCase()}`;
const listOn=(chain:string,address:string)=>{let l=evidencedByChain.get(chain);if(!l){l=[];evidencedByChain.set(chain,l);}l.push(address);};
for(const [key,rec] of Object.entries(ADDRESSES)){
 const ent=ENTITIES[rec.entity];if(!ent)continue;
 const addr=key.slice(rec.chain.length+1);
 const ex=EXPLORERS[rec.chain];
 const verified=new Date(Math.min(Date.parse(ent.lastVerified),Date.parse(rec.checked))).toISOString();
 INDEX.set(key,{entity:ent.name,addressCluster:ent.id,category:ent.category,jurisdiction:ent.jurisdiction,confidence:ent.confidence,score:ent.confidence==='VERIFIED'?.95:.85,
  source:`${ex.name} public name tag + ${ent.source}`,sourceUrl:ex.address(addr),
  evidenceNote:`${ex.name} labels this address '${rec.label}' (checked ${rec.checked}).${rec.note?` ${rec.note}`:''} ${ent.evidenceNote} Jurisdiction source: ${ent.sourceUrl}`,
  lastVerified:verified,association:'operating entity'});
 listOn(rec.chain,addr);
}
for(const d of DERIVED){
 const ex=EXPLORERS[d.chain];
 for(const addr of d.addresses){
  const key=`${d.chain}:${addr}`;
  if(INDEX.has(key))continue; // a first-party label on that chain always wins
  const src=ADDRESSES[`Ethereum:${addr}`];
  if(!src||src.kind==='contract')continue;
  const ent=ENTITIES[src.entity];if(!ent)continue;
  const verified=new Date(Math.min(Date.parse(ent.lastVerified),Date.parse(src.checked),Date.parse(CODE_PROBED_AT))).toISOString();
  INDEX.set(key,{entity:ent.name,addressCluster:ent.id,category:`${ent.category} (${DERIVED_MARK} cross-chain)`,jurisdiction:ent.jurisdiction,confidence:'HIGH',score:.8,
   source:`${DERIVED_MARK}, not a published ${ex.name} name tag: Etherscan labels this address '${src.label}', and it is a plain key-controlled account on both Ethereum and ${d.chain}, so the same key holder controls it here. ${ent.source}`,
   sourceUrl:ex.address(addr),
   evidenceNote:`${DERIVED_MARK} cross-chain. Etherscan labels this address '${src.label}' (checked ${src.checked}). eth_getCode returns no contract code for it on Ethereum or on ${d.chain} (probed ${CODE_PROBED_AT}), so it is a plain account whose control follows its private key across EVM chains. This is inference from key derivation, not a published ${ex.name} label; anyone can send to the address here without the owner's cooperation, so it is weaker evidence as a receiver than as a sender. ${ent.evidenceNote} Jurisdiction source: ${ent.sourceUrl}`,
   lastVerified:verified,association:'operating entity'});
  listOn(d.chain,addr);
 }
}
/** Evidence in the model's Attribution shape for an address on a chain, or null when there is no admissible public evidence. One shared object per address. */
export function knownAttribution(chain:Chain|string,address:string):Attribution|null{
 return INDEX.get(keyOf(chain,address))??null;
}
/** True when the attribution rests on a cross-chain derivation rather than a label read on that chain's explorer. */
export const isDerived=(a:Attribution)=>a.category.includes(DERIVED_MARK);
/** Every address with evidence on a chain, first-party or derived. Drives the live client's log filter. */
export function evidencedAddresses(chain:Chain|string):string[]{
 return evidencedByChain.get(chain)??[];
}
/**
 * Whether the registry is still usable, and until when. `admissible()` refuses evidence older than 180
 * days, so evidence does not decay gradually — the whole registry stops drawing routes on one day. The
 * live client surfaces this so an expired map explains itself instead of looking empty.
 */
export function registryHealth(at=Date.now()):{total:number;expired:number;earliestExpiry:number}{
 let expired=0,earliest=Infinity;
 for(const a of INDEX.values()){
  const expiry=Date.parse(a.lastVerified)+180*86400000;
  if(expiry<earliest)earliest=expiry;
  if(at>expiry)expired++;
 }
 return {total:INDEX.size,expired,earliestExpiry:earliest};
}
/** Counts for documentation and the registry verifier. */
export function registryStats(){
 const byEntity:Record<string,number>={},byJurisdiction:Record<string,number>={},byChain:Record<string,number>={};
 for(const rec of Object.values(ADDRESSES)){
  const ent=ENTITIES[rec.entity];if(!ent)continue;
  byEntity[ent.name]=(byEntity[ent.name]??0)+1;byJurisdiction[ent.jurisdiction]=(byJurisdiction[ent.jurisdiction]??0)+1;byChain[rec.chain]=(byChain[rec.chain]??0)+1;
 }
 const derived=DERIVED.reduce((n,d)=>n+d.addresses.length,0);
 return {addresses:Object.keys(ADDRESSES).length,derived,entities:Object.keys(ENTITIES).length,byEntity,byJurisdiction,byChain};
}
