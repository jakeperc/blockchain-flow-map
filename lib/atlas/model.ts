/** Geography is an evidenced entity jurisdiction, never a wallet's physical location. */
export const CHAINS = ['Ethereum','Tron','Solana','Base','Arbitrum'] as const;
export type Chain = typeof CHAINS[number];
export type Asset = 'USDT'|'USDC';
export type Confidence = 'VERIFIED'|'HIGH'|'MEDIUM'|'UNKNOWN';
export type EconomicClass = 'payment'|'exchange flow'|'institutional settlement'|'treasury movement'|'DeFi'|'bridge'|'mint/burn'|'infrastructure'|'unknown';
export type WindowKey = '5M'|'1H'|'24H'|'7D';
export const WINDOWS: Record<WindowKey,number> = {'5M':300_000,'1H':3_600_000,'24H':86_400_000,'7D':604_800_000};
export interface Attribution {
  entity:string; addressCluster:string; category:string; jurisdiction:string|null;
  confidence:Confidence; score:number; source:string; sourceUrl:string|null; evidenceNote:string;
  lastVerified:string; association:'operating entity'|'unknown'; synthetic:boolean;
}
export interface Transfer {
  id:string; chain:Chain; transactionId:string; eventIndex:string; blockNumber:number; blockHash:string;
  blockTime:number; finality:'finalized'|'confirmed'|'synthetic'; asset:Asset; tokenContract:string;
  amount:string; amountAtomic:string; usdValue:number|null; usdPrice:number|null; usdPriceSource:string; priceTime:number|null;
  sender:string; receiver:string; senderEntity:Attribution; receiverEntity:Attribution;
  economicClass:EconomicClass; adjustment:'included'|'excluded'|'unresolved';
  classificationRationale:string; classificationVersion:string;
  flags:{bridge:boolean;mintBurn:boolean;internalTransfer:boolean;crossBorderCandidate:boolean;bot:boolean}; synthetic:boolean;
}
export interface Corridor {
  id:string; origin:string; destination:string; window:WindowKey; windowStart:number; windowEnd:number;
  usdValue:number; transactionCount:number; assets:Record<string,number>; chains:Record<string,number>; confidence:Record<string,number>;
  topEntities:{entity:string;usdValue:number;attribution:Attribution}[]; topTransactions:Transfer[];
  baseline:number|null; baselineSamples:number; anomalyRatio:number|null; anomalyScore:number|null; lastActivity:number; rankScore:number;
}
export interface CountrySummary {code:string;inbound:number;outbound:number;knownEndpointAdjusted:number;coverage:number|null;}
export type Totals={observed:number;adjusted:number;attributed:number;domestic:number;unattributed:number;excluded:number;unresolved:number;unpricedCount:number;transactionCount:number;coverage:number|null};
export interface Snapshot {
  mode:'demo'|'production';window:WindowKey;at:number;seed:number;
  health:'DEMO DATA'|'LIVE'|'DELAYED'|'RECONNECTING'|'NOT CONNECTED';lastReceived:number|null;message:string;corridors:Corridor[];
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
export const UNKNOWN:Attribution={entity:'Unattributed address',addressCluster:'unknown',category:'unknown',jurisdiction:null,confidence:'UNKNOWN',score:0,source:'No admissible evidence',sourceUrl:null,evidenceNote:'No verified entity-to-jurisdiction relationship is available.',lastVerified:'',association:'unknown',synthetic:false};
export function admissible(a:Attribution,at:number,allowSynthetic=false):boolean {
  const age=at-Date.parse(a.lastVerified);
  return !!a.jurisdiction&&['VERIFIED','HIGH'].includes(a.confidence)&&a.score>=.8&&!!a.source&&!!a.evidenceNote&&a.association==='operating entity'&&Number.isFinite(age)&&age>=0&&age<=180*86400000&&(allowSynthetic||!a.synthetic);
}
export function money(n:number,compact=true):string {
  if(!compact)return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  const a=Math.abs(n),d=a>=1e12?1e12:a>=1e9?1e9:a>=1e6?1e6:a>=1e3?1e3:1;
  return `${n<0?'−':''}$${(a/d).toFixed(d===1?0:2)}${d===1e12?'T':d===1e9?'B':d===1e6?'M':d===1e3?'K':''}`;
}
