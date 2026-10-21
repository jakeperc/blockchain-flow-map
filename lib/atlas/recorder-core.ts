/**
 * The recorder's pure core: what turns one chain's decoded transfers into one sealed 15-minute span. The browser
 * (live-client.ts) seals through here, and anything else that ever records spans must seal through the same
 * functions, so a span means the same thing whoever recorded it. Accounting stays in rollup.ts and engine.ts; this
 * file only decides WHICH records a span is sealed from and how they are classified at that moment. It adds no
 * arithmetic of its own. Rows, pickSpans and the bundle validator are the pieces such a second recorder needs.
 *
 * WHY SEALING CLASSIFIES ITS OWN COPY. Records arrive unclassified (decodeTransferLog) and the browser re-classifies
 * the whole buffer in a coalesced pass a moment later. Before 2026-10-21 sealing read the records as the buffer held
 * them, so a seal that landed between a poll and that pass stored the poll's transfers as unattributed and cleared
 * the span's dirty flag, and nothing re-sealed it. sealChainBuckets() now prices, infers and classifies copies of the
 * chain's records itself, so a span never depends on whether that pass has run, and the buffer is never mutated.
 *
 * WHAT A SEAL SEES. Deposit-address inference reads every transfer nearby, so a span depends on its context. The
 * context is the chain's records in `[contextEnd - CONTEXT_MS, contextEnd]`: what a browser holds in memory when it
 * seals. Inference is scoped per chain (inferDeposits keys by chain), so sealing one chain from its own records alone
 * gives the same classifications as inferring over every chain at once; scripts/verify-recorder.cjs asserts it.
 *
 * Pure: no fetch, no DOM, no timers, no module state.
 */
import {UNKNOWN,type Asset,type Attribution,type Chain} from './model';
import {BUCKET_MS,STORED_SCHEMA,sealSpan,type Rollup,type StoredRollup} from './rollup';
import {addressKey,classifyRec,inferDeposits,priceAt,type InferOptions,type Rec,type Sample} from './live-core';

/** The context a seal infers from, and how long the browser keeps raw transfers: the same 90 minutes by design. */
export const CONTEXT_MS=90*60000;
/** A deposit address forwards (nearly) everything it received. Approved 2026-09-18 with deposit inference itself. */
export const FORWARD_SHARE=.8;
/** A price sample further than this from a block's time does not price it. There is never a $1 fallback. */
export const PRICE_TOLERANCE_MS=600000;

/** A block-time range a reader actually read. */
export interface Interval {from:number;to:number}
/** Milliseconds of `[start,end]` covered by `intervals`. Overlaps are merged, so a re-read never inflates it. */
export function observedMsIn(intervals:readonly Interval[],start:number,end:number):number{
 const clipped=intervals.map(x=>({from:Math.max(x.from,start),to:Math.min(x.to,end)})).filter(x=>x.to>x.from).sort((a,b)=>a.from-b.from);
 let ms=0,cur:Interval|null=null;
 for(const x of clipped){
  if(!cur||x.from>cur.to){if(cur)ms+=cur.to-cur.from;cur={...x};}
  else cur.to=Math.max(cur.to,x.to);
 }
 if(cur)ms+=cur.to-cur.from;
 return ms;
}

/** The evidence registry as sealing needs it. `version` is what each span records (see registryVersion() in known-entities.ts). */
export interface RecorderRegistry {
 version:string;
 known:InferOptions['known'];
 /** True when an attribution rests on a published label, so it may anchor a deposit-address inference. */
 firstParty:(a:Attribution)=>boolean;
 entities:InferOptions['entities'];
 explorerTx:(chain:Chain,hash:string)=>string;
}
export const inferOptions=(registry:RecorderRegistry):InferOptions=>({
 known:registry.known,firstParty:registry.firstParty,entities:registry.entities,explorerTx:registry.explorerTx,forwardShare:FORWARD_SHARE
});

export type PriceSeries=Partial<Record<Asset,readonly Sample[]>>;
/** A copy of an unpriced record priced from `prices`, or the record itself. Same arithmetic as decoding and re-pricing. */
function priced(r:Rec,prices:PriceSeries):Rec{
 if(r.usdValue!==null)return r;
 const p=priceAt(prices[r.asset]??[],r.blockTime,PRICE_TOLERANCE_MS);
 if(!p)return r;
 const usdValue=Number(r.amount)*p.usd;
 return {...r,usdValue,usdPrice:p.usd,priceTime:p.at,priceSource:p.source}; // classifyRec() rebuilds `tx` from these
}

export interface SealInput {
 chain:Chain;
 /** The chain's decoded transfers. Records of other chains and records outside the context are ignored, never mutated. */
 records:readonly Rec[];
 /** Block-time ranges actually read on this chain: a span's coverage. */
 observed:readonly Interval[];
 /** Price samples per asset. An unpriced record is priced from these at its block time when a sample is close enough. */
 prices:PriceSeries;
 registry:RecorderRegistry;
 /** The seal point. Inference sees this chain's records in `[contextEnd - CONTEXT_MS, contextEnd]`. */
 contextEnd:number;
 /** When the span is recorded as sealed. Defaults to `contextEnd`. */
 sealedAt?:number;
}
/**
 * Seal several 15-minute spans `(bucket, bucket + BUCKET_MS]` of one chain under one context. They share one
 * inference pass, which is the only reason this takes a list; the result is what sealChainBucket() gives per bucket.
 */
export function sealChainBuckets(input:SealInput&{buckets:readonly number[]}):Rollup[]{
 const {chain,registry,contextEnd}=input;
 const from=contextEnd-CONTEXT_MS;
 const context=input.records.filter(r=>r.chain===chain&&r.feed==='evidenced'&&r.blockTime>=from&&r.blockTime<=contextEnd).map(r=>priced(r,input.prices));
 const inferred=inferDeposits(context,inferOptions(registry));
 // The same lookup the browser classifies its buffer with: the registry first, then this context's inferences.
 const attributionFor=(c:Chain,a:string)=>registry.known(c,a)??inferred.get(addressKey(c,a))??UNKNOWN;
 return input.buckets.map(bucket=>{
  const end=bucket+BUCKET_MS;
  const recs=context.filter(r=>r.blockTime>bucket&&r.blockTime<=end).map(r=>{const c={...r};classifyRec(c,attributionFor);return c;});
  return sealSpan(recs,bucket,end,{
   chain,coverage:[{chain,observedMs:observedMsIn(input.observed,bucket,end)}],
   registry:registry.version,sealedAt:input.sealedAt??contextEnd,forTotals:r=>r.tx??r
  });
 });
}
/** Seal one chain's span `(bucket, bucket + BUCKET_MS]`: price, infer and classify from the context, then sealSpan(). */
export const sealChainBucket=(input:SealInput&{bucket:number}):Rollup=>sealChainBuckets({...input,buckets:[input.bucket]})[0];

/* ---------- Compact rows: a decoded record without its classification ---------- */

/**
 * One decoded transfer as a recorder stores it between reading and sealing. Classification and evidence are left
 * out on purpose: sealing recomputes them from the registry, so a stored row can never carry a stale attribution.
 * `usdValue` is left out because it is always `Number(amount) * usdPrice` (decoding and re-pricing both compute it so).
 */
export type RecordRow=[transactionId:string,eventIndex:number,blockNumber:number,blockHash:string,blockTime:number,asset:Asset,tokenContract:string,amount:string,amountAtomic:string,sender:string,receiver:string,usdPrice:number|null,priceTime:number|null,priceSource:string|null];
export const toRow=(r:Rec):RecordRow=>[r.transactionId,Number(r.eventIndex),r.blockNumber,r.blockHash,r.blockTime,r.asset,r.tokenContract,r.amount,r.amountAtomic,r.sender,r.receiver,r.usdPrice,r.priceTime,r.priceSource];
const isStr=(x:unknown):x is string=>typeof x==='string'&&x.length>0;
const isNum=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
/** The record a row came from, unclassified as decoding leaves it. Throws on a malformed row rather than sealing a guess. */
export function fromRow(chain:Chain,row:RecordRow):Rec{
 if(!Array.isArray(row)||row.length!==14)throw Error(`malformed ${chain} record row: not a 14-field tuple`);
 const [transactionId,eventIndex,blockNumber,blockHash,blockTime,asset,tokenContract,amount,amountAtomic,sender,receiver,usdPrice,priceTime,priceSource]=row;
 const priceOk=usdPrice===null?priceTime===null&&priceSource===null:isNum(usdPrice)&&isNum(priceTime)&&isStr(priceSource);
 if(!isStr(transactionId)||!Number.isInteger(eventIndex)||!Number.isInteger(blockNumber)||!isStr(blockHash)||!isNum(blockTime)
  ||(asset!=='USDT'&&asset!=='USDC')||!isStr(tokenContract)||!/^\d+(\.\d+)?$/.test(amount)||!/^\d+$/.test(amountAtomic)||!isStr(sender)||!isStr(receiver)||!priceOk)
  throw Error(`malformed ${chain} record row ${JSON.stringify(row).slice(0,120)}`);
 return {
  id:`${chain}:${transactionId}:${eventIndex}`,chain,transactionId,eventIndex:String(eventIndex),blockNumber,blockHash,blockTime,
  asset,tokenContract,amount,amountAtomic,usdValue:usdPrice===null?null:Number(amount)*usdPrice,usdPrice,priceTime,priceSource,
  sender,receiver,economicClass:'unknown',adjustment:'unresolved',senderEntity:UNKNOWN,receiverEntity:UNKNOWN,feed:'evidenced'
 };
}

/* ---------- One span per chain and quarter hour ---------- */

export type SpanSource='browser'|'server';
export interface PickedSpan {span:Rollup;source:SpanSource}
/** Milliseconds of its own chain a span actually observed. */
export const spanObservedMs=(p:Rollup)=>p.coverage.reduce((n,c)=>c.chain===p.chain?n+c.observedMs:n,0);
/**
 * Exactly one span per (bucket, chain), so no transfer is counted twice when two recorders sealed the same quarter
 * hour. The span that observed more of it wins; on a tie the server's wins, and between two spans from one source the
 * later seal wins. Spans are chosen, never added together or averaged. Output is ordered by bucket, then chain.
 */
export function pickSpans(browser:readonly Rollup[],server:readonly Rollup[]):PickedSpan[]{
 const best=new Map<string,PickedSpan>();
 const rank:Record<SpanSource,number>={browser:0,server:1};
 const consider=(span:Rollup,source:SpanSource)=>{
  const key=`${span.bucket}:${span.chain}`,cur=best.get(key);
  if(cur){
   const a=spanObservedMs(span),b=spanObservedMs(cur.span);
   if(a<b)return;
   if(a===b&&(rank[source]<rank[cur.source]||(source===cur.source&&span.sealedAt<=cur.span.sealedAt)))return;
  }
  best.set(key,{span,source});
 };
 for(const s of browser)consider(s,'browser');
 for(const s of server)consider(s,'server');
 return [...best.values()].sort((x,y)=>x.span.bucket-y.span.bucket||(x.span.chain<y.span.chain?-1:x.span.chain>y.span.chain?1:0));
}

/* ---------- A published bundle of spans ---------- */

/** One UTC day of sealed spans as a recorder publishes them. `schema` is the stored-span format (STORED_SCHEMA). */
export interface SpanBundle {schema:number;day:string;spans:StoredRollup[]}
export type BundleCheck={ok:true;bundle:SpanBundle}|{ok:false;reason:string};

const isObj=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const isAmount=(x:unknown)=>isNum(x)&&x>=0;
const isCount=(x:unknown)=>Number.isInteger(x)&&(x as number)>=0;
const isAmounts=(x:unknown)=>isObj(x)&&Object.values(x).every(isAmount);
const TOTAL_AMOUNTS=['observed','adjusted','attributed','domestic','unattributed','excluded','unresolved'] as const;
const isTotals=(x:unknown)=>isObj(x)&&TOTAL_AMOUNTS.every(k=>isAmount(x[k]))&&isCount(x.unpricedCount)&&isCount(x.transactionCount)
 &&(x.coverage===null||(isNum(x.coverage)&&x.coverage>=0&&x.coverage<=1));
const isEntityRow=(x:unknown)=>isObj(x)&&isStr(x.entity)&&isAmount(x.unplacedIn)&&isAmount(x.unplacedOut)&&isCount(x.transactionCount)&&(x.jurisdiction===null||isStr(x.jurisdiction));
const isCorridor=(x:unknown)=>isObj(x)&&isStr(x.id)&&isStr(x.origin)&&isStr(x.destination)&&x.id===`${x.origin}-${x.destination}`&&isAmount(x.usdValue)&&isCount(x.transactionCount)
 &&isAmounts(x.assets)&&isAmounts(x.chains)&&isAmounts(x.confidence)&&isNum(x.lastActivity)
 &&Array.isArray(x.topEntities)&&x.topEntities.every(e=>isObj(e)&&isStr(e.entity)&&isAmount(e.usdValue));
const isCountry=(x:unknown)=>isObj(x)&&isStr(x.code)&&['inbound','outbound','knownEndpointAdjusted','unplacedIn','unplacedOut'].every(k=>isAmount(x[k]))
 &&(x.coverage===null||isAmount(x.coverage))&&Array.isArray(x.entities)&&x.entities.every(isEntityRow);

/** Why one stored span is unusable, or null when it is well formed. */
export function spanDefect(s:unknown,chains:readonly Chain[]):string|null{
 if(!isObj(s))return 'not an object';
 const {bucket,end,chain}=s;
 if(!Number.isInteger(bucket)||(bucket as number)%BUCKET_MS!==0)return 'bucket is not a quarter-hour boundary';
 if(end!==(bucket as number)+BUCKET_MS)return 'span is not exactly one bucket';
 if(!chains.includes(chain as Chain))return `unknown chain ${String(chain)}`;
 if(!isNum(s.sealedAt)||s.sealedAt<(end as number))return 'sealed before the span closed';
 if(!isStr(s.registry))return 'no registry version';
 if(!Array.isArray(s.coverage)||s.coverage.length!==1||!isObj(s.coverage[0])||s.coverage[0].chain!==chain)return 'coverage is not this chain alone';
 const observedMs=s.coverage[0].observedMs;
 if(!isNum(observedMs)||observedMs<0||observedMs>BUCKET_MS)return 'observed time outside the span';
 if(!isTotals(s.totals))return 'malformed totals';
 if(!isAmounts(s.classifications))return 'malformed classifications';
 if(!Array.isArray(s.corridors)||!s.corridors.every(isCorridor))return 'malformed corridors';
 if(!Array.isArray(s.countries)||!s.countries.every(isCountry))return 'malformed jurisdictions';
 if(!isAmount(s.value))return 'malformed value';
 if(s.sample!==undefined)return 'a sealed span never carries the unfiltered sample';
 const u=s.unmapped;
 if(!isObj(u)||!isCount(u.count)||!isAmount(u.usdValue)||!isAmounts(u.reasons)||!Array.isArray(u.entities)||!u.entities.every(isEntityRow))return 'malformed unmapped aggregate';
 return null;
}
/**
 * Check a published day of spans before any of it is used. All or nothing: one malformed span means the file is
 * not what the recorder writes, so none of it is trusted. A span from a different registry is accepted (it is
 * disclosed, as D5 requires); only a different `schema` is refused.
 */
export function validateBundle(x:unknown,chains:readonly Chain[]):BundleCheck{
 if(!isObj(x))return {ok:false,reason:'not an object'};
 if(x.schema!==STORED_SCHEMA)return {ok:false,reason:`stored-span format ${String(x.schema)}, this page reads ${STORED_SCHEMA}`};
 if(typeof x.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.day)||!Number.isFinite(Date.parse(`${x.day}T00:00:00Z`)))return {ok:false,reason:'no valid day'};
 if(!Array.isArray(x.spans))return {ok:false,reason:'no span list'};
 const dayStart=Date.parse(`${x.day}T00:00:00Z`),seen=new Set<string>();
 for(const [i,s] of x.spans.entries()){
  const defect=spanDefect(s,chains);
  if(defect)return {ok:false,reason:`span ${i}: ${defect}`};
  const {bucket,chain}=s as StoredRollup;
  if(bucket<dayStart||bucket>=dayStart+86400000)return {ok:false,reason:`span ${i} is outside ${x.day}`};
  const key=`${bucket}:${chain}`;
  if(seen.has(key))return {ok:false,reason:`span ${i} repeats ${key}`};
  seen.add(key);
 }
 return {ok:true,bundle:x as unknown as SpanBundle};
}
