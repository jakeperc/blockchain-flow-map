/**
 * Sealed history, so a browser-only build can serve windows longer than the records it still holds in memory.
 *
 * WHY THIS EXISTS. The live client keeps about 90 minutes of decoded transfers and nothing survives a reload,
 * so 24H and 7D were permanently unavailable and baselines were always null. Keeping raw transfers for a week
 * is not an option — measured feed volume puts it past 100 MB per visitor, which is abusive on a phone. So
 * every completed 15-minute span is reduced, ONCE, to the accounting it supports, and the raw records are
 * then free to expire. A week of these is a few megabytes.
 *
 * WHAT A LONG WINDOW THEREFORE MEANS. A rollup is an observation made by ONE browser during the time it was
 * actually watching, under the registry it had at the time. It is never a claim about the whole window or
 * about all chain activity: `coverage` records the measured milliseconds observed per chain, so a caller can
 * state exactly how much of a 24-hour window it really saw, and refuse to offer the window at all until that
 * share is high enough. Nothing here estimates, scales up or back-fills a gap.
 *
 * WHY THE ARITHMETIC IS EXACT, NOT APPROXIMATE.
 *  - Sealing calls aggregateSpan()/selectUnattributedSpan(), the same functions a live window uses, over a
 *    half-open span. Consecutive spans therefore tile the timeline exactly once: no gap, nothing counted
 *    twice, and no second definition of "adjusted value" to drift out of step.
 *  - Sums are sums. Ratios (`totals.coverage`, a country's `coverage`) are recomputed after summing, never
 *    averaged, because an average of ratios is not the ratio of the sums.
 *  - Merging per-span top-6 transaction lists yields the true window top 6: a transfer among the six largest
 *    in the window is necessarily among the six largest in its own span. The same argument covers the top
 *    unmapped transfers. It does NOT hold for a "largest counterparties" ranking, where an address can place
 *    13th in every span and first overall, so that list is deliberately not sealed here.
 *  - A window includes only spans that fall wholly inside it. A span straddling the window's start would
 *    otherwise contribute transfers from before it, and scaling its totals down would be inventing numbers.
 *    The cost is at most one bucket of nominal window length, and `coverageOf()` reports it.
 *
 * Pure: no fetch, no DOM, no timers, no module state. history-store.ts persists these; live-client.ts seals
 * and merges them; scripts/verify-rollup.cjs exercises the invariants above.
 */
import {WINDOWS,CHAINS,UNKNOWN,type Chain,type WindowKey,type Snapshot,type Totals,type Corridor,type CountrySummary,type Transfer,type Attribution,type UnattributedEntity,type UnattributedTransfer} from './model';
import {aggregateSpan,selectUnattributedSpan,rank,type TotalsInput,type UnattributedInput} from './engine';

/** One sealed span. Fifteen minutes is short enough to bin a sparkline and tile a 24H window closely, and long enough that a week is 672 records rather than tens of thousands. */
export const BUCKET_MS=900_000;
/** Kept per corridor per span. Six matches what aggregate() already keeps, which is what makes the merged list exact. */
export const TOP_TRANSACTIONS=6;
/** Kept per span for the unmapped list. Merging these gives the true largest few; a recency ordering cannot be reconstructed from summaries and is not offered. */
export const TOP_UNMAPPED=5;
/** Prior windows of equal length a baseline needs. The corridor panel has always promised four. */
export const BASELINE_SAMPLES=4;

/** The span a timestamp belongs to, matching the half-open `(bucket, bucket+BUCKET_MS]` rule sealing uses. */
export const bucketOf=(t:number)=>Math.floor((t-1)/BUCKET_MS)*BUCKET_MS;

/** Measured observation inside one span: milliseconds for which this browser actually held that chain's blocks. Never assumed from a feed being "up". */
export interface BucketCoverage {chain:Chain;observedMs:number}
/**
 * A span is sealed PER CHAIN, not per bucket, because the map's chain filter has to stay exact. Totals summed
 * across chains cannot be taken apart again — a country's inbound value carries no chain breakdown — so
 * "Ethereum only" over 24 hours has to be the sum of Ethereum's own spans. Per-chain spans also make the
 * arithmetic safe by construction: a transfer belongs to exactly one (bucket, chain) pair, so no selection of
 * chains can double count it.
 */
export interface RollupCorridor {
 id:string;origin:string;destination:string;usdValue:number;transactionCount:number;
 assets:Record<string,number>;chains:Record<string,number>;confidence:Record<string,number>;
 topEntities:{entity:string;usdValue:number;attribution:Attribution}[];
 topTransactions:Transfer[];lastActivity:number;
}
/** The unmapped view's sealed aggregate. `items` are the largest few only; see TOP_UNMAPPED. */
export interface RollupUnmapped {count:number;usdValue:number;reasons:Record<string,number>;entities:UnattributedEntity[];items:UnattributedTransfer[]}
export interface Rollup {
 /** Span is `(bucket, end]`. A sealed bucket has `end = bucket + BUCKET_MS`; the un-sealed live tail ends at the moment it was built. */
 bucket:number;end:number;
 /** The one chain this span accounts for. Together with `bucket` it is the record's identity. */
 chain:Chain;
 sealedAt:number;
 /** The registry this span was accounted under, so a span sealed before a deploy is not silently presented as one sealed after it. */
 registry:string;
 coverage:BucketCoverage[];
 totals:Totals;
 classifications:Record<string,number>;
 corridors:RollupCorridor[];
 countries:CountrySummary[];
 /** Attributed USD in this span, for the window sparkline. */
 value:number;
 sample?:{totals:Totals;sampledMs:number};
 unmapped:RollupUnmapped;
}

export interface SealOptions<R> {
 chain:Chain;
 /** Measured observation for this span. One entry, for this span's own chain. */
 coverage:BucketCoverage[];
 registry:string;
 sealedAt:number;
 /**
  * The form aggregate() reads. Only doubly-admissible included transfers must be full Transfers, because
  * those surface in topTransactions; a caller holding compact records passes `r => r.tx ?? r`.
  */
 forTotals:(r:R)=>Transfer|TotalsInput;
 sample?:{totals:Totals;sampledMs:number};
}

const sumInto=(target:Record<string,number>,src:Record<string,number>|undefined)=>{for(const k in src)target[k]=(target[k]??0)+src[k];};
const zeroTotals=():Totals=>({observed:0,adjusted:0,attributed:0,domestic:0,unattributed:0,excluded:0,unresolved:0,unpricedCount:0,transactionCount:0,coverage:null});
const addTotals=(a:Totals,b:Totals)=>{
 a.observed+=b.observed;a.adjusted+=b.adjusted;a.attributed+=b.attributed;a.domestic+=b.domestic;
 a.unattributed+=b.unattributed;a.excluded+=b.excluded;a.unresolved+=b.unresolved;
 a.unpricedCount+=b.unpricedCount;a.transactionCount+=b.transactionCount;
};

/** Seal an arbitrary span. `sealBucket` is this for one aligned bucket; the live tail uses it for a partial span. */
export function sealSpan<R extends UnattributedInput>(records:Iterable<R>,start:number,end:number,opts:SealOptions<R>):Rollup{
 const list=[...records];
 const snap=aggregateSpan(list.map(opts.forTotals),start,end,'1H'); // the label is discarded; the span is what counts
 const un=selectUnattributedSpan(list,start,end,{minUsd:0,sort:'value',limit:TOP_UNMAPPED});
 return {
  bucket:start,end,chain:opts.chain,sealedAt:opts.sealedAt,registry:opts.registry,
  coverage:opts.coverage.map(c=>({chain:c.chain,observedMs:c.observedMs})),
  totals:snap.totals,
  classifications:{...snap.classifications},
  corridors:snap.corridors.map(c=>({
   id:c.id,origin:c.origin,destination:c.destination,usdValue:c.usdValue,transactionCount:c.transactionCount,
   assets:{...c.assets},chains:{...c.chains},confidence:{...c.confidence},
   topEntities:c.topEntities.map(e=>({...e})),
   topTransactions:c.topTransactions.slice(0,TOP_TRANSACTIONS),lastActivity:c.lastActivity
  })),
  countries:snap.countries.map(c=>({...c,entities:c.entities.map(e=>({...e}))})),
  value:snap.totals.attributed,
  ...(opts.sample?{sample:{totals:opts.sample.totals,sampledMs:opts.sample.sampledMs}}:{}),
  unmapped:{count:un.count,usdValue:un.usdValue,reasons:{...un.reasons},entities:un.entities.map(e=>({...e})),items:un.items.slice(0,TOP_UNMAPPED)}
 };
}
export const sealBucket=<R extends UnattributedInput>(records:Iterable<R>,bucket:number,opts:SealOptions<R>)=>
 sealSpan(records,bucket,bucket+BUCKET_MS,opts);

/** Spans that fall wholly inside `(start, end]`. See the header on why a straddling span is left out. */
export const partsInWindow=(parts:readonly Rollup[],start:number,end:number)=>
 parts.filter(p=>p.bucket>=start&&p.end<=end).sort((a,b)=>a.bucket-b.bucket);
/** Spans for the chains a caller has selected. `chains` is the resolved list, never the UI's "All chains" label. */
export const partsForChains=(parts:readonly Rollup[],chains:readonly Chain[])=>
 parts.filter(p=>chains.includes(p.chain));

/**
 * One Snapshot from sealed spans. `health`, `lastReceived` and `message` are left at their defaults for the
 * caller to fill in, exactly as aggregate() leaves them.
 */
export function mergeRollups(parts:readonly Rollup[],window:WindowKey,at:number):Snapshot{
 const duration=WINDOWS[window],start=at-duration;
 const inWindow=partsInWindow(parts,start,at);
 const totals=zeroTotals(),classifications:Record<string,number>={};
 const corridors=new Map<string,Corridor>(),countries=new Map<string,CountrySummary>();
 const history=Array.from({length:40},(_,i)=>({at:start+(i+.5)*duration/40,value:0}));
 let sampleTotals:Totals|null=null,sampledMs=0;
 for(const p of inWindow){
  addTotals(totals,p.totals);
  sumInto(classifications,p.classifications);
  for(const rc of p.corridors){
   let c=corridors.get(rc.id);
   if(!c){
    c={id:rc.id,origin:rc.origin,destination:rc.destination,window,windowStart:start,windowEnd:at,usdValue:0,transactionCount:0,assets:{},chains:{},confidence:{},topEntities:[],topTransactions:[],baseline:null,baselineSamples:0,anomalyRatio:null,anomalyScore:null,lastActivity:0,rankScore:0};
    corridors.set(rc.id,c);
   }
   c.usdValue+=rc.usdValue;c.transactionCount+=rc.transactionCount;
   sumInto(c.assets,rc.assets);sumInto(c.chains,rc.chains);sumInto(c.confidence,rc.confidence);
   c.lastActivity=Math.max(c.lastActivity,rc.lastActivity);
   for(const e of rc.topEntities){
    const row=c.topEntities.find(x=>x.entity===e.entity);
    if(row)row.usdValue+=e.usdValue;else c.topEntities.push({...e});
   }
   c.topTransactions.push(...rc.topTransactions);
  }
  for(const rc of p.countries){
   let c=countries.get(rc.code);
   if(!c){c={code:rc.code,inbound:0,outbound:0,knownEndpointAdjusted:0,coverage:null,unplacedIn:0,unplacedOut:0,entities:[]};countries.set(rc.code,c);}
   c.inbound+=rc.inbound;c.outbound+=rc.outbound;c.knownEndpointAdjusted+=rc.knownEndpointAdjusted;
   c.unplacedIn+=rc.unplacedIn;c.unplacedOut+=rc.unplacedOut;
   for(const e of rc.entities){
    const row=c.entities.find(x=>x.entity===e.entity);
    if(row){row.unplacedIn+=e.unplacedIn;row.unplacedOut+=e.unplacedOut;row.transactionCount+=e.transactionCount;}
    else c.entities.push({...e});
   }
  }
  // A span's attributed value is spread across the bins it overlaps, in proportion to the overlap, so a
  // 15-minute span straddling two bins is not attributed wholly to one of them.
  if(p.value){
   const binMs=duration/40;
   for(let i=0;i<40;i++){
    const lo=start+i*binMs,hi=lo+binMs;
    const overlap=Math.min(p.end,hi)-Math.max(p.bucket,lo);
    if(overlap>0)history[i].value+=p.value*overlap/Math.max(1,p.end-p.bucket);
   }
  }
  if(p.sample){
   if(!sampleTotals)sampleTotals=zeroTotals();
   addTotals(sampleTotals,p.sample.totals);
   sampleTotals.coverage=sampleTotals.adjusted?sampleTotals.attributed/sampleTotals.adjusted:null;
   sampledMs+=p.sample.sampledMs;
  }
 }
 totals.coverage=totals.adjusted?totals.attributed/totals.adjusted:null;
 for(const c of corridors.values()){
  c.topTransactions.sort((x,y)=>(y.usdValue??0)-(x.usdValue??0));
  if(c.topTransactions.length>TOP_TRANSACTIONS)c.topTransactions.length=TOP_TRANSACTIONS;
  c.topEntities.sort((x,y)=>y.usdValue-x.usdValue);
 }
 for(const c of countries.values()){
  c.coverage=c.knownEndpointAdjusted?(c.inbound+c.outbound)/c.knownEndpointAdjusted:null;
  c.entities.sort((x,y)=>(y.unplacedIn+y.unplacedOut)-(x.unplacedIn+x.unplacedOut));
 }
 const result={
  window,at,health:'NOT CONNECTED',lastReceived:null,
  message:'No live provider data is available for this selection.',
  corridors:[...corridors.values()],totals,classifications,countries:[...countries.values()],history,
  chainHealth:CHAINS.map(chain=>({chain,status:'Not connected',lastReceived:null})),
  ...(sampleTotals?{sample:{totals:sampleTotals,sampledMs}}:{})
 } as Snapshot;
 rank(result);
 return result;
}

/** The unmapped view over sealed spans. `items` are the largest, not the most recent: see TOP_UNMAPPED. */
export function mergeUnmapped(parts:readonly Rollup[],window:WindowKey,at:number):RollupUnmapped{
 const start=at-WINDOWS[window];
 const reasons:Record<string,number>={},entities=new Map<string,UnattributedEntity>(),items:UnattributedTransfer[]=[];
 let count=0,usdValue=0;
 for(const p of partsInWindow(parts,start,at)){
  count+=p.unmapped.count;usdValue+=p.unmapped.usdValue;
  sumInto(reasons,p.unmapped.reasons);
  for(const e of p.unmapped.entities){
   const row=entities.get(e.entity);
   if(row){row.unplacedIn+=e.unplacedIn;row.unplacedOut+=e.unplacedOut;row.transactionCount+=e.transactionCount;}
   else entities.set(e.entity,{...e});
  }
  items.push(...p.unmapped.items);
 }
 items.sort((a,b)=>(b.usdValue??0)-(a.usdValue??0));
 return {count,usdValue,reasons,
  entities:[...entities.values()].sort((a,b)=>(b.unplacedIn+b.unplacedOut)-(a.unplacedIn+a.unplacedOut)),
  items};
}

export interface WindowCoverage {
 windowMs:number;observedMs:number;
 /** The least-covered chain's share, because a window is only as complete as its weakest chain. 0 to 1. */
 share:number;
 perChain:{chain:Chain;observedMs:number;share:number}[];
}
/**
 * How much of a window this browser actually observed, per chain. A span overlapping the window contributes
 * its coverage in proportion to the overlap: within a 15-minute span observation is treated as even, which is
 * the only assumption in this file and is immaterial at the granularity any caller uses it for.
 */
export function coverageOf(parts:readonly Rollup[],window:WindowKey,at:number,chains:readonly Chain[]):WindowCoverage{
 const windowMs=WINDOWS[window],start=at-windowMs;
 const observed=new Map<Chain,number>(chains.map(c=>[c,0]));
 for(const p of parts){
  const span=Math.max(1,p.end-p.bucket);
  const overlap=Math.min(p.end,at)-Math.max(p.bucket,start);
  if(overlap<=0)continue;
  for(const c of p.coverage){
   if(!observed.has(c.chain))continue;
   observed.set(c.chain,observed.get(c.chain)!+c.observedMs*Math.min(1,overlap/span));
  }
 }
 const perChain=chains.map(chain=>{
  const observedMs=Math.min(windowMs,observed.get(chain)??0);
  return {chain,observedMs,share:windowMs?observedMs/windowMs:0};
 });
 const share=perChain.length?Math.min(...perChain.map(c=>c.share)):0;
 return {windowMs,observedMs:Math.min(...[windowMs,...perChain.map(c=>c.observedMs)]),share,perChain};
}

export interface Baseline {mean:number;samples:number;ratio:number|null;z:number|null}
/**
 * A corridor's baseline from this browser's own history: the mean of the four preceding windows of equal
 * length. Returns null unless all four are present AND each was observed to at least `minShare`, so a
 * baseline is never computed against a window the browser mostly missed — that would read as a collapse in
 * volume when it was really a gap in watching. A corridor absent from a covered window contributes a real
 * zero, which is why absence is not the same as a missing sample.
 */
export function baselineFor(parts:readonly Rollup[],corridorId:string,window:WindowKey,at:number,chains:readonly Chain[],minShare:number,current:number):Baseline|null{
 const duration=WINDOWS[window],values:number[]=[];
 for(let i=1;i<=BASELINE_SAMPLES;i++){
  const endOfPrior=at-i*duration;
  if(coverageOf(parts,window,endOfPrior,chains).share<minShare)return null;
  let sum=0;
  for(const p of partsInWindow(parts,endOfPrior-duration,endOfPrior))
   for(const c of p.corridors)if(c.id===corridorId)sum+=c.usdValue;
  values.push(sum);
 }
 if(values.length<BASELINE_SAMPLES)return null;
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 const variance=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
 const sd=Math.sqrt(variance);
 return {mean,samples:values.length,ratio:mean>0?current/mean:null,z:sd>0?(current-mean)/sd:null};
}

/** Attach baselines to a merged snapshot's corridors, where this browser's history supports one. */
export function applyBaselines(snapshot:Snapshot,parts:readonly Rollup[],chains:readonly Chain[],minShare:number):void{
 for(const c of snapshot.corridors){
  const b=baselineFor(parts,c.id,snapshot.window,snapshot.at,chains,minShare,c.usdValue);
  if(!b)continue;
  c.baseline=b.mean;c.baselineSamples=b.samples;c.anomalyRatio=b.ratio;c.anomalyScore=b.z;
 }
 rank(snapshot);
}

/** Distinct registry versions behind a set of spans, so a mixed span can say so rather than imply one registry. */
export const registryVersionsOf=(parts:readonly Rollup[])=>[...new Set(parts.map(p=>p.registry))];

/* ---------- The persisted projection ---------- */

/**
 * What history-store.ts writes to disk: the accounting, without per-transfer detail.
 *
 * Every Transfer carries two Attributions, and an Attribution carries a multi-hundred-character evidence
 * note. Measured against real corridor counts, keeping six of those per corridor per span puts a week of
 * history into the hundreds of megabytes — untenable on a phone, and the reason this projection exists.
 * There is a second, better reason: a stored Attribution is frozen evidence. Re-reading it a week later
 * would quote a registry that may since have been corrected, which is precisely what integrity rule 5's
 * expiry horizon exists to prevent.
 *
 * So a long window reports exact totals, corridors, jurisdictions and classifications, and transaction-level
 * evidence stays with the live window, where the raw records and today's registry are both still in hand.
 * `topEntities` keeps names and values — a ranking, not a citation.
 */
export interface StoredCorridor {
 id:string;origin:string;destination:string;usdValue:number;transactionCount:number;
 assets:Record<string,number>;chains:Record<string,number>;confidence:Record<string,number>;
 topEntities:{entity:string;usdValue:number}[];lastActivity:number;
}
export interface StoredRollup {
 bucket:number;end:number;chain:Chain;sealedAt:number;registry:string;
 coverage:BucketCoverage[];totals:Totals;classifications:Record<string,number>;
 corridors:StoredCorridor[];countries:CountrySummary[];value:number;
 sample?:{totals:Totals;sampledMs:number};
 unmapped:{count:number;usdValue:number;reasons:Record<string,number>;entities:UnattributedEntity[]};
}
export const toStored=(r:Rollup):StoredRollup=>({
 bucket:r.bucket,end:r.end,chain:r.chain,sealedAt:r.sealedAt,registry:r.registry,
 coverage:r.coverage.map(c=>({...c})),totals:{...r.totals},classifications:{...r.classifications},
 corridors:r.corridors.map(c=>({
  id:c.id,origin:c.origin,destination:c.destination,usdValue:c.usdValue,transactionCount:c.transactionCount,
  assets:{...c.assets},chains:{...c.chains},confidence:{...c.confidence},
  topEntities:c.topEntities.map(e=>({entity:e.entity,usdValue:e.usdValue})),lastActivity:c.lastActivity
 })),
 countries:r.countries.map(c=>({...c,entities:c.entities.map(e=>({...e}))})),
 value:r.value,
 ...(r.sample?{sample:{totals:{...r.sample.totals},sampledMs:r.sample.sampledMs}}:{}),
 unmapped:{count:r.unmapped.count,usdValue:r.unmapped.usdValue,reasons:{...r.unmapped.reasons},entities:r.unmapped.entities.map(e=>({...e}))}
});
/**
 * Back to the in-memory shape. Per-transfer lists come back empty by design, never fabricated: a caller that
 * needs them is asking about a window the live buffer still covers. `hasTransactionDetail` on a merged
 * snapshot is how the UI knows which case it is in.
 */
export const fromStored=(s:StoredRollup):Rollup=>({
 bucket:s.bucket,end:s.end,chain:s.chain,sealedAt:s.sealedAt,registry:s.registry,
 coverage:s.coverage.map(c=>({...c})),totals:{...s.totals},classifications:{...s.classifications},
 corridors:s.corridors.map(c=>({
  id:c.id,origin:c.origin,destination:c.destination,usdValue:c.usdValue,transactionCount:c.transactionCount,
  assets:{...c.assets},chains:{...c.chains},confidence:{...c.confidence},
  topEntities:c.topEntities.map(e=>({entity:e.entity,usdValue:e.usdValue,attribution:UNKNOWN})),
  topTransactions:[],lastActivity:c.lastActivity
 })),
 countries:s.countries.map(c=>({...c,entities:c.entities.map(e=>({...e}))})),
 value:s.value,
 ...(s.sample?{sample:{totals:{...s.sample.totals},sampledMs:s.sample.sampledMs}}:{}),
 unmapped:{count:s.unmapped.count,usdValue:s.unmapped.usdValue,reasons:{...s.unmapped.reasons},entities:s.unmapped.entities.map(e=>({...e})),items:[]}
});
