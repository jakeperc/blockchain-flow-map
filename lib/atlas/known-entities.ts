/**
 * Known operating-entity evidence for Ethereum addresses. Pure data; safe to ship to the browser.
 *
 * RULES (these are the whole point of the project — do not relax them):
 *  - Only add an address you can cite a real, working https:// source for: an exchange's own published
 *    disclosure, a regulator or court filing, or a blockchain explorer's own public label feature.
 *    Never guess or infer an address-to-entity mapping.
 *  - `jurisdiction` is the ISO-2 code of the SPECIFIC operating entity the source documents, not
 *    "where the brand is famous for being based". It must exist in lib/atlas/geography.ts.
 *  - `confidence` is VERIFIED (documented primary evidence) or HIGH (strong corroborated evidence).
 *    Anything weaker is left out entirely rather than marked HIGH. MEDIUM never draws a route.
 *  - Re-verify periodically and bump `lastVerified`: the model refuses evidence older than 180 days,
 *    and exchanges do rotate hot wallets.
 *
 * Researched 2026-09-18 by checking each address's own Etherscan label page directly, cross-checked
 * against regulatory/court filings for the jurisdiction claim. Deliberately excluded because the
 * controlling legal entity or its jurisdiction is genuinely disputed in public sources: Bybit,
 * Crypto.com, Bitstamp, Luno, WazirX, HTX/Huobi. Circle's and Tether's issuer/treasury addresses are
 * also excluded on purpose: a transfer from an issuer treasury is issuance, not bilateral settlement,
 * which is exactly what the mint/burn and treasury exclusions in engine.ts exist to keep out.
 */
import type {Attribution} from './model';
export interface KnownEntity {entity:string;cluster:string;category:string;jurisdiction:string;confidence:'VERIFIED'|'HIGH';source:string;sourceUrl:string;evidenceNote:string;lastVerified:string;}
const VERIFIED_AT='2026-09-18T00:00:00.000Z';
const e=(entity:string,cluster:string,jurisdiction:string,confidence:'VERIFIED'|'HIGH',source:string,sourceUrl:string,evidenceNote:string):KnownEntity=>({entity,cluster,category:'exchange',jurisdiction,confidence,source,sourceUrl,evidenceNote,lastVerified:VERIFIED_AT});
const BINANCE='Etherscan public label + DOJ November 2023 plea agreement naming Binance Holdings Limited as a Cayman Islands company';
const COINBASE='Etherscan public label + Coinbase Global SEC 10-K (Delaware corporation)';
const KRAKEN='Etherscan public label + Payward regulatory filings (Delaware corporation, San Francisco)';
const OKX='Etherscan public label + OKX Terms of Service naming Aux Cayes FinTech Co. Ltd (Seychelles) + DOJ February 2025 case';
const BITFINEX='Etherscan public label + 2021 NY Attorney General settlement naming iFinex Inc. as a BVI company';
/** Keys are lowercase 0x addresses. */
export const KNOWN_ENTITIES:Record<string,KnownEntity>={
 '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be':e('Binance','binance','KY','VERIFIED',BINANCE,'https://etherscan.io/address/0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',"Etherscan labels this address 'Binance' (Exchange). Distinct from the separate US entity Binance.US."),
 '0xd551234ae421e3bcba99a0da6d736074f22192ff':e('Binance','binance','KY','VERIFIED',BINANCE,'https://etherscan.io/address/0xD551234Ae421e3BCBA99A0Da6d736074f22192FF',"Etherscan labels this address 'Binance 2' (Exchange)."),
 '0xf977814e90da44bfa03b6295a0616a897441acec':e('Binance','binance','KY','VERIFIED',BINANCE,'https://etherscan.io/address/0xF977814e90dA44bFA03b6295A0616a897441aceC',"Etherscan labels this address 'Binance: Hot Wallet 20' (Exchange), one of the largest and most active exchange wallets on Ethereum."),
 '0x28c6c06298d514db089934071355e5743bf21d60':e('Binance','binance','KY','VERIFIED',BINANCE,'https://etherscan.io/address/0x28C6c06298d514Db089934071355E5743bf21d60',"Etherscan labels this address 'Binance 14' (Exchange)."),
 '0x71660c4005ba85c37ccec55d0c4493e66fe775d3':e('Coinbase','coinbase','US','VERIFIED',COINBASE,'https://etherscan.io/address/0x71660c4005ba85c37ccec55d0c4493e66fe775d3',"Etherscan labels this address 'Coinbase 1' (Exchange). Retail/exchange platform, not Coinbase Custody Trust Company."),
 '0x503828976d22510aad0201ac7ec88293211d23da':e('Coinbase','coinbase','US','VERIFIED',COINBASE,'https://etherscan.io/address/0x503828976d22510aad0201ac7ec88293211d23da',"Etherscan labels this address 'Coinbase 12' (Exchange)."),
 '0xf30ba13e4b04ce5dc4d254ae5fa95477800f0eb0':e('Kraken','kraken','US','VERIFIED',KRAKEN,'https://etherscan.io/address/0xf30ba13e4b04ce5dc4d254ae5fa95477800f0eb0',"Etherscan labels this address 'Kraken: Hot Wallet 2' (Exchange)."),
 '0x05ff6964d21e5dae3b1010d5ae0465b3c450f381':e('Kraken','kraken','US','VERIFIED',KRAKEN,'https://etherscan.io/address/0x05ff6964d21e5dae3b1010d5ae0465b3c450f381',"Etherscan labels this address 'Kraken: Hot Wallet 4' (Exchange)."),
 '0x4b4e14a3773ee558b6597070797fd51eb48606e5':e('OKX','okx','SC','VERIFIED',OKX,'https://etherscan.io/address/0x4b4e14a3773ee558b6597070797fd51eb48606e5',"Etherscan labels this address 'OKX: Hot Wallet' (Exchange)."),
 '0x4e7b110335511f662fdbb01bf958a7844118c0d4':e('OKX','okx','SC','VERIFIED',OKX,'https://etherscan.io/address/0x4e7b110335511f662fdbb01bf958a7844118c0d4',"Etherscan labels this address 'OKX: Hot Wallet 2' (Exchange)."),
 '0x1151314c646ce4e0efd76d1af4760ae66a9fe30f':e('Bitfinex','bitfinex','VG','VERIFIED',BITFINEX,'https://etherscan.io/address/0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F',"Etherscan labels this address 'Bitfinex 1' (Exchange)."),
 '0x1b29dd8ff0eb3240238bf97cafd6edea05d5ba82':e('Bitfinex','bitfinex','VG','VERIFIED',BITFINEX,'https://etherscan.io/address/0x1b29DD8fF0EB3240238bF97CaFD6edeA05D5Ba82',"Etherscan labels this address 'Bitfinex 6' (Exchange)."),
 '0xba826fec90cefdf6706858e5fbafcb27a290fbe0':e('Upbit','upbit','KR','VERIFIED','Etherscan public label; Dunamu Inc., Seoul, is FSC-licensed','https://etherscan.io/address/0xba826fec90cefdf6706858e5fbafcb27a290fbe0',"Etherscan labels this address 'Upbit 2' (Exchange)."),
 '0x5e032243d507c743b061ef021e2ec7fcc6d3ab89':e('Upbit','upbit','KR','VERIFIED','Etherscan public label; Dunamu Inc., Seoul, is FSC-licensed','https://etherscan.io/address/0x5e032243d507c743b061ef021e2ec7fcc6d3ab89',"Etherscan labels this address 'Upbit 3' (Exchange)."),
 '0x17e5545b11b468072283cee1f066a059fb0dbf24':e('Bithumb','bithumb','KR','VERIFIED','Etherscan public label; Bithumb Korea Co., Ltd. is FIU/FSC-registered','https://etherscan.io/address/0x17e5545b11b468072283cee1f066a059fb0dbf24',"Etherscan labels this address 'Bithumb: Hot Wallet' (Exchange)."),
 '0xd24400ae8bfebb18ca49be86258a3c749cf46853':e('Gemini','gemini','US','VERIFIED','Etherscan public label; Gemini Trust Company, LLC is a NYDFS-chartered trust company','https://etherscan.io/address/0xd24400ae8bfebb18ca49be86258a3c749cf46853',"Etherscan labels this address 'Gemini' (Exchange)."),
 '0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1':e('CoinSpot','coinspot','AU','VERIFIED','Etherscan public label; Casey Block Services Pty Ltd is AUSTRAC-registered','https://etherscan.io/address/0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1',"Etherscan labels this address 'CoinSpot 1' (Exchange)."),
 '0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe':e('CoinDCX','coindcx','IN','VERIFIED','Etherscan public label; Neblio Technologies Private Limited is FIU-India registered','https://etherscan.io/address/0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe',"Etherscan labels this address 'CoinDCX 2' (Exchange)."),
 '0xa9264494a92ced04747ac84fc9ca5a0b9549b491':e('bitFlyer','bitflyer','JP','HIGH','Etherscan public label; bitFlyer Inc. is FSA-registered','https://etherscan.io/address/0xa9264494a92ced04747ac84fc9ca5a0b9549b491',"Etherscan labels this address 'bitFlyer 3' (Exchange). Rated HIGH rather than VERIFIED because bitFlyer also runs separately regulated US and EU affiliates."),
 '0xb01cb49fe0d6d6e47edf3a072d15dfe73155331c':e('bitFlyer','bitflyer','JP','HIGH','Etherscan public label; bitFlyer Inc. is FSA-registered','https://etherscan.io/address/0xB01cb49fe0D6D6E47EDf3A072d15dfe73155331C',"Etherscan labels this address 'bitFlyer 2' (Exchange)."),
 '0xd52814615dc129e1eea3520e7e7f8d44dbfc6c5b':e('Coincheck','coincheck','JP','HIGH','Etherscan public label (disclosed as sourced from a public researcher compilation); Coincheck, Inc. is FSA-registered','https://etherscan.io/address/0xd52814615DC129e1eEa3520e7e7f8d44DBfc6c5b',"Etherscan labels this address 'Coincheck 2' (Exchange) and discloses the tag came from a public compilation rather than a first-party submission.")
};
/** Evidence in the model's Attribution shape, or null when the address has no admissible public evidence. */
export function knownAttribution(address:string):Attribution|null{
 const k=KNOWN_ENTITIES[address.toLowerCase()];if(!k)return null;
 return {entity:k.entity,addressCluster:k.cluster,category:k.category,jurisdiction:k.jurisdiction,confidence:k.confidence,score:k.confidence==='VERIFIED'?.95:.85,source:k.source,sourceUrl:k.sourceUrl,evidenceNote:k.evidenceNote,lastVerified:k.lastVerified,association:'operating entity',synthetic:false};
}
