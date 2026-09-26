/** Geography is an evidenced entity jurisdiction, never a wallet's physical location. */
/**
 * Polygon is PARKED (2026-09-26, Jake's decision): measured and wired, but not live. Its only fast endpoint
 * prunes history older than ~37 hours and its only full-history endpoint caps requests at 100 blocks, so the
 * 90-day dormancy scan decision D2 requires takes ~8 hours and would recur monthly. Everything it needs is kept
 * (CONTRACTS, EXPLORERS, CHAIN_COLORS, PARKED in feeds.ts, the script pools); to switch it on, add it back here
 * and to EVM_CHAINS, move PARKED.Polygon into FEEDS, and follow HANDOFF section 12's add-a-chain order.
 */
export const CHAINS = ['Ethereum','Tron','Solana','Base','Arbitrum','Avalanche'] as const;
export type Chain = typeof CHAINS[number];
/**
 * Chains whose accounts are 20-byte EVM addresses. The single source of truth for three rules that used to be
 * repeated as literal arrays in the verifiers and the registry generator: addresses are stored lowercase, only
 * these chains may be the target of cross-chain key derivation, and Tron and Solana never derive.
 */
export const EVM_CHAINS = ['Ethereum','Base','Arbitrum','Avalanche'] as const;
export type EvmChain = typeof EVM_CHAINS[number];
export const isEvmChain = (c:string):c is EvmChain => (EVM_CHAINS as readonly string[]).includes(c);
export type Asset = 'USDT'|'USDC';
export type Confidence = 'VERIFIED'|'HIGH'|'MEDIUM'|'UNKNOWN';
export type EconomicClass = 'payment'|'exchange flow'|'institutional settlement'|'treasury movement'|'DeFi'|'bridge'|'mint/burn'|'infrastructure'|'unknown';
export type WindowKey = '5M'|'1H'|'24H'|'7D';
export const WINDOWS: Record<WindowKey,number> = {'5M':300_000,'1H':3_600_000,'24H':86_400_000,'7D':604_800_000};
export interface Attribution {
  entity:string; addressCluster:string; category:string; jurisdiction:string|null;
  confidence:Confidence; score:number; source:string; sourceUrl:string|null; evidenceNote:string;
  lastVerified:string; association:'operating entity'|'unknown';
}
export interface Transfer {
  id:string; chain:Chain; transactionId:string; eventIndex:string; blockNumber:number; blockHash:string;
  blockTime:number; finality:'finalized'|'confirmed'; asset:Asset; tokenContract:string;
  amount:string; amountAtomic:string; usdValue:number|null; usdPrice:number|null; usdPriceSource:string; priceTime:number|null;
  sender:string; receiver:string; senderEntity:Attribution; receiverEntity:Attribution;
  economicClass:EconomicClass; adjustment:'included'|'excluded'|'unresolved';
  classificationRationale:string; classificationVersion:string;
  flags:{bridge:boolean;mintBurn:boolean;internalTransfer:boolean;crossBorderCandidate:boolean;bot:boolean};
}
export interface Corridor {
  id:string; origin:string; destination:string; window:WindowKey; windowStart:number; windowEnd:number;
  usdValue:number; transactionCount:number; assets:Record<string,number>; chains:Record<string,number>; confidence:Record<string,number>;
  topEntities:{entity:string;usdValue:number;attribution:Attribution}[]; topTransactions:Transfer[];
  baseline:number|null; baselineSamples:number; anomalyRatio:number|null; anomalyScore:number|null; lastActivity:number; rankScore:number;
}
export interface CountrySummary {
  code:string; inbound:number; outbound:number; knownEndpointAdjusted:number; coverage:number|null;
  /**
   * Adjusted value moving between an evidenced wallet associated with this jurisdiction and a
   * counterparty that has no admissible jurisdiction. Direction is the evidenced side's: `unplacedIn`
   * was received here. This is not cross-border settlement and never draws a route — the other end is
   * genuinely unplaced — but the direction and the evidenced end are both known, so it is reported
   * rather than discarded. Includes transfers whose economic purpose is unresolved, like `adjusted`.
   */
  unplacedIn:number; unplacedOut:number;
  /** The evidenced entities behind this jurisdiction's unplaced flow, largest first. */
  entities:UnattributedEntity[];
}
/** An adjusted, non-domestic transfer with at least one endpoint that has no admissible jurisdiction evidence, so no route can be drawn for it. A single evidenced end still lights that jurisdiction. */
export interface UnattributedTransfer {
  id:string; chain:Chain; transactionId:string; blockTime:number; asset:Asset; amount:string;
  usdValue:number|null; sender:string; receiver:string; senderEntity:Attribution; receiverEntity:Attribution;
  economicClass:EconomicClass; adjustment:'included'|'unresolved';
}
/** The evidenced side of unplaced flow, per operating entity. Directions are the entity's own. */
export interface UnattributedEntity {entity:string; jurisdiction:string|null; unplacedIn:number; unplacedOut:number; transactionCount:number;}
/** An address with no admissible evidence, seen opposite evidenced wallets. Directions are the unplaced address's own. A research lead, never evidence. */
export interface UnplacedCounterparty {
  address:string; chain:Chain; usdValue:number; transactionCount:number;
  /** Evidenced entities seen on the other side of its transfers, largest first. */
  entities:string[]; receivedUsd:number; sentUsd:number;
}
/** How the unmapped view narrows what it lists. Filters affect `items`, `shown`, `counterparties` and `entities`; `count`, `usdValue` and `reasons` always describe the whole window. */
export interface UnattributedFilter {minUsd?:number; search?:string; sort?:'recent'|'value'; limit?:number;}
export interface UnattributedSummary {
  items:UnattributedTransfer[];
  count:number; usdValue:number; reasons:Record<string,number>;
  shown:number; shownUsd:number;
  counterparties:UnplacedCounterparty[]; entities:UnattributedEntity[];
}
export type Totals={observed:number;adjusted:number;attributed:number;domestic:number;unattributed:number;excluded:number;unresolved:number;unpricedCount:number;transactionCount:number;coverage:number|null};
export interface Snapshot {
  window:WindowKey;at:number;
  health:'LIVE'|'DELAYED'|'RECONNECTING'|'NOT CONNECTED';lastReceived:number|null;message:string;corridors:Corridor[];
  totals:Totals;
  classifications:Record<string,number>;countries:CountrySummary[];history:{at:number;value:number}[];
  chainHealth:{chain:Chain;status:string;lastReceived:number|null}[];
  /**
   * Optional unfiltered denominator sample. The client build reads only transfers touching an evidenced
   * wallet, so its `totals` describe evidenced settlement rather than all chain activity; this reports an
   * exact accounting over a stated amount of sampled chain time, so coverage can be quoted honestly
   * without extrapolating. The backend, which sees every transfer, leaves it undefined.
   */
  sample?:{totals:Totals;sampledMs:number};
}
export const UNKNOWN:Attribution={entity:'Unattributed address',addressCluster:'unknown',category:'unknown',jurisdiction:null,confidence:'UNKNOWN',score:0,source:'No admissible evidence',sourceUrl:null,evidenceNote:'No verified entity-to-jurisdiction relationship is available.',lastVerified:'',association:'unknown'};
export function admissible(a:Attribution,at:number):boolean {
  const age=at-Date.parse(a.lastVerified);
  return !!a.jurisdiction&&['VERIFIED','HIGH'].includes(a.confidence)&&a.score>=.8&&!!a.source&&!!a.evidenceNote&&a.association==='operating entity'&&Number.isFinite(age)&&age>=0&&age<=180*86400000;
}
export function money(n:number,compact=true):string {
  if(!compact)return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  const a=Math.abs(n),d=a>=1e12?1e12:a>=1e9?1e9:a>=1e6?1e6:a>=1e3?1e3:1;
  return `${n<0?'−':''}$${(a/d).toFixed(d===1?0:2)}${d===1e12?'T':d===1e9?'B':d===1e6?'M':d===1e3?'K':''}`;
}
