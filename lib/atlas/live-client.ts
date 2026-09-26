/**
 * Browser-side live data source. Runs entirely in the visitor's browser against free public endpoints,
 * with no server and no database: the same architecture as a single-file market widget. It reuses the
 * project's real classification and aggregation code (engine.ts), so totals, corridor ranking and the
 * accounting panel are computed exactly as the production backend would compute them; the only
 * difference is memory. Nothing survives a page reload, so only the 5M and 1H windows are offered and
 * baselines stay null. The pure parts — decoding, pricing, inference, retention — live in live-core.ts
 * and are covered by scripts/verify-live.cjs; this file is transport, state and subscriptions.
 *
 * ONE FEED PER CHAIN, TWO KINDS OF QUERY, and the reason for them.
 * Reading every USDC and USDT transfer costs a visitor about 23 MB an hour on Ethereum and 100 MB an
 * hour on Base (measured 2026-09-19), which is punitive on a phone and abusive to keyless public
 * endpoints. Each chain's settlement feed therefore asks the node only for transfers that touch an
 * address with evidence on THAT chain, using the two indexed address positions of the ERC-20 Transfer
 * topic. That loses nothing that can draw a route: a corridor needs an evidenced wallet at each end, and
 * the deposit sweeps that inference rests on are funded by an exchange hot wallet, so both legs still
 * match the filter. What it does lose is the honest denominator — how much is happening on chain
 * overall — so a second, deliberately small UNFILTERED sample of chain time is read periodically and
 * reported separately as a sample, never scaled up into an estimate.
 *
 * Deposit-address inference (approved 2026-09-18, clearly labelled): exchange customers do not send to
 * an exchange's hot wallet, they send to a per-customer deposit address that the exchange later sweeps
 * into its hot wallet. Within the retained buffer, an unlabelled address whose ONLY outgoing transfers
 * go to one registry entity, after receiving from somewhere else, and which forwarded most of what it
 * received, is treated as that entity's deposit address. Such evidence is marked INFERRED in its
 * category, source and note, cites the sweep transaction, and is never persisted. Inference is scoped
 * per chain and only a first-party label may anchor it; derived cross-chain evidence never does.
 */
import {CHAINS,UNKNOWN,type Chain,type Snapshot,type Transfer,type WindowKey,type Attribution,type Asset,type Totals,type UnattributedFilter,type UnattributedSummary} from './model';
import {aggregate,selectUnattributed,type TotalsInput} from './engine';
import {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog} from './evm';
import {EXPLORERS} from './geography';
import {FEEDS,type FeedConfig} from './feeds';
import {knownAttribution,isDerived,watchedAddresses,dormancyInfo,registryHealth,ENTITIES} from './known-entities';
import {addressKey,classifyRec,decodeTransferLog,inferDeposits,makeBlockTimeFn,planChunks,priceAt,pruneRecords,addSample,type Rec,type Sample} from './live-core';
import {BUCKET_MS,bucketOf,sealSpan,mergeRollups,mergeUnmapped,coverageOf,partsForChains,applyBaselines,registryVersionsOf,toStored,fromStored,type Rollup} from './rollup';
import {createHistoryStore,type HistoryStatus} from './history-store';

export interface LiveSource {
 /**
  * Windows this source can honestly serve for a chain selection. 5M and 1H come from the in-memory buffer and
  * are always available; 24H and 7D appear only once this browser's own sealed history covers enough of them
  * (see UNLOCK_SHARE). Call it per render with the current chain filter: the answer changes as history accrues.
  */
 windowsFor(chain:string):WindowKey[];
 /** How much of a window this browser has actually recorded, for explaining a window it cannot yet offer. */
 windowCoverage(window:WindowKey,chain:string):{share:number;observedMs:number;windowMs:number;needMs:number};
 defaultWindow:WindowKey;
 /** Chains this source actually reads. The UI disables the rest rather than showing an empty map. */
 chains:Chain[];
 /** How long transfers are retained in memory. */
 retentionMs:number;
 /** Raw-event replay threshold; the backend's $10M gate is unreachable for a one-hour live buffer. */
 rawEventMinUsd:number;
 /** Push snapshots for a window/chain filter until unsubscribed. Emits once immediately. */
 subscribe(window:WindowKey,chain:string,onSnapshot:(s:Snapshot)=>void):()=>void;
 /** Snapshot ending at an arbitrary time, for playback. Empty outside the retained buffer. */
 snapshotAt(window:WindowKey,chain:string,at:number):Snapshot;
 /** Adjusted, non-domestic transfers in this window that no route can show, because at least one endpoint has no admissible jurisdiction, plus the entities and unplaced counterparties behind them. `filter` narrows what is listed, never the headline `count`/`usdValue`/`reasons`. */
 unattributed(window:WindowKey,chain:string,at:number,filter?:UnattributedFilter):UnattributedSummary;
 /** Retained block-time span, for the playback slider. A long window can scrub across sealed history; 5M and 1H are bounded by the in-memory buffer, because scrubbing those outside it would only show an empty map. */
 range(window?:WindowKey):{start:number;end:number};
 /** What this browser has recorded, for the Data & coverage panel. */
 historyStatus():HistoryStatus&{spanMs:number;registryMixed:boolean};
 /** Forget this browser's recorded history. Long windows lock again until it rebuilds. */
 clearHistory():Promise<void>;
 /** Backfill progress in blocks across every chain, or null once complete. */
 progress():{done:number;total:number}|null;
 /** Number of deposit addresses currently inferred from observed sweeps. */
 inferredCount():number;
 /** Registry expiry state, so an expired map can explain itself instead of looking empty. */
 registryHealth():{total:number;expired:number;earliestExpiry:number};
 /** Stop every timer and in-flight request. */
 dispose():void;
}

/** Price providers, tried in order. CoinGecko first (broadest free history); Coinbase and Kraken back it up
 * when CoinGecko is rate-limited or unreachable, so a stall on one exchange's public API never blanks a
 * price the others can supply. Each sample records which provider actually answered, since the source is
 * shown as evidence rather than assumed. */
const COINGECKO='https://api.coingecko.com/api/v3';
const COINGECKO_IDS:Record<Asset,string>={USDT:'tether',USDC:'usd-coin'};
const COINBASE_PRODUCT:Record<Asset,string>={USDT:'USDT-USD',USDC:'USDC-USD'};
const KRAKEN_PAIR:Record<Asset,string>={USDT:'USDTZUSD',USDC:'USDCUSD'};
interface PriceProvider{name:string;series(asset:Asset,signal:AbortSignal):Promise<{at:number;usd:number}[]>;spot(asset:Asset,signal:AbortSignal):Promise<number|null>}
const PRICE_PROVIDERS:PriceProvider[]=[
 {name:'CoinGecko public API, 5-minute market sample nearest to block time',
  async series(asset,signal){
   const res=await fetch(`${COINGECKO}/coins/${COINGECKO_IDS[asset]}/market_chart?vs_currency=usd&days=1`,{signal});
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   const j=await res.json() as {prices?:[number,number][]};
   return (j.prices??[]).filter(([at,usd])=>typeof at==='number'&&typeof usd==='number').map(([at,usd])=>({at,usd}));
  },
  async spot(asset,signal){
   const j=await (await fetch(`${COINGECKO}/simple/price?ids=${COINGECKO_IDS[asset]}&vs_currencies=usd&precision=6`,{signal})).json() as Record<string,{usd?:number}>;
   return j[COINGECKO_IDS[asset]]?.usd??null;
  }},
 {name:'Coinbase Exchange public API, 5-minute candle nearest to block time',
  async series(asset,signal){
   const res=await fetch(`https://api.exchange.coinbase.com/products/${COINBASE_PRODUCT[asset]}/candles?granularity=300`,{signal});
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   const rows=await res.json() as number[][]; // [time,low,high,open,close,volume]
   return rows.filter(r=>Array.isArray(r)&&r.length>=5&&Number.isFinite(r[4])).map(r=>({at:r[0]*1000,usd:r[4]}));
  },
  async spot(asset,signal){
   const j=await (await fetch(`https://api.coinbase.com/v2/prices/${COINBASE_PRODUCT[asset]}/spot`,{signal})).json() as {data?:{amount?:string}};
   const v=j.data?.amount?Number(j.data.amount):null;
   return v!==null&&Number.isFinite(v)?v:null;
  }},
 {name:'Kraken public API, 5-minute OHLC sample nearest to block time',
  async series(asset,signal){
   const res=await fetch(`https://api.kraken.com/0/public/OHLC?pair=${KRAKEN_PAIR[asset]}&interval=5`,{signal});
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   const j=await res.json() as {result?:Record<string,unknown>,error?:string[]};
   if(j.error?.length)throw Error(j.error.join(';'));
   const key=Object.keys(j.result??{}).find(k=>k!=='last');
   const rows=key?(j.result![key] as unknown[][]):[];
   return rows.map(r=>({at:Number(r[0])*1000,usd:Number(r[4])})).filter(s=>Number.isFinite(s.at)&&Number.isFinite(s.usd));
  },
  async spot(asset,signal){
   const j=await (await fetch(`https://api.kraken.com/0/public/Ticker?pair=${KRAKEN_PAIR[asset]}`,{signal})).json() as {result?:Record<string,{c?:string[]}>,error?:string[]};
   if(j.error?.length)throw Error(j.error.join(';'));
   const key=Object.keys(j.result??{})[0];
   const v=key?Number(j.result![key].c?.[0]):null;
   return v!==null&&Number.isFinite(v)?v:null;
  }},
];
const POLL_MS=20000,PRICE_MS=120000,TICK_MS=8000,SAMPLE_MS=900000;
const TIP_LAG=1,BATCH_LIMIT=3,RPC_ATTEMPTS=4,RPC_STRIKES=2;
const RETENTION_MS=90*60000,PRICE_TOLERANCE_MS=600000;
/**
 * Recorded history (see rollup.ts). Raw transfers still expire after RETENTION_MS; what survives is the sealed
 * accounting for each completed 15-minute span, in this browser only.
 */
const HISTORY_MS=7*86400000;
/**
 * How much of a window this browser must have actually observed before the window is offered at all. A partly
 * watched day is a real measurement of part of a day, but presenting it as "24H" would invite reading it as the
 * day's settlement, so the window stays locked with an explanation instead. Coverage accrues only while a tab is
 * open (plus the hour each session backfills), so the long windows belong to a page left running.
 */
const UNLOCK_SHARE=.8;
const LONG_WINDOWS:WindowKey[]=['24H','7D'];
const SEAL_MS=60000;
const INFER_FORWARD_SHARE=.8; // a deposit address forwards (nearly) everything it received
const SAMPLE_CAP=20000;
/** Report the feed as partial rather than LIVE once this share of a backfill failed to load. */
const COVERAGE_ALARM=.1;

/** Chains this build reads, their endpoints and chunking: measured limits live in feeds.ts. */
const CHAIN_CONFIG=FEEDS;
const LIVE_CHAINS=Object.keys(CHAIN_CONFIG) as Chain[];
/** A chain's WATCHED addresses (evidenced minus the dormant tier, decision D2) as 32-byte topic values, for the indexed sender/receiver positions of Transfer. */
const topicsFor=(chain:Chain)=>watchedAddresses(chain).map(a=>'0x'+a.slice(2).padStart(64,'0'));

type State='CONNECTING'|'BACKFILLING'|'LIVE'|'CATCHING UP'|'RECONNECTING';
type Header={timestamp:string}|null;
const hex=(n:number)=>'0x'+n.toString(16);
const hhmm=(t:number)=>new Date(t).toISOString().slice(11,16);
/** A duration as a human reads it: "6h 20m", "3d 4h", "12m". */
const hms=(ms:number)=>{
 const m=Math.max(0,Math.round(ms/60000)),d=Math.floor(m/1440),h=Math.floor((m%1440)/60),rest=m%60;
 return d?`${d}d ${h}h`:h?`${h}h ${rest}m`:`${rest}m`;
};

let instance:LiveSource|null=null;
export function createLiveSource():LiveSource{
 if(instance)return instance;

 /* ---------- Shared state ---------- */
 const series:Record<Asset,Sample[]>={USDT:[],USDC:[]};
 const seriesLoaded:Record<Asset,boolean>={USDT:false,USDC:false};
 let inferred=new Map<string,Attribution>();
 const listeners=new Set<{window:WindowKey;chain:string;cb:(s:Snapshot)=>void}>();
 const timers:ReturnType<typeof setInterval>[]=[];
 const abort=new AbortController();
 let disposed=false;
 const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
 /** Both signals: our own teardown, and a per-request timeout. */
 const signal=(ms:number)=>AbortSignal.any([abort.signal,AbortSignal.timeout(ms)]);

 const attributionFor=(chain:Chain,address:string):Attribution=>knownAttribution(chain,address)??inferred.get(addressKey(chain,address))??UNKNOWN;

 /* ---------- Prices: a timestamped series, never an assumed peg ---------- */
 const priceFor=(asset:Asset,at:number)=>priceAt(series[asset],at,PRICE_TOLERANCE_MS);
 /** Each provider's public API rate-limits or drops bursts of its own accord; walk the provider list in
  * order per asset, with retries on each, and move to the next provider only once the current one has
  * exhausted its retries. Re-price anything left unpriced once a series arrives. */
 async function fetchPriceSeries(){
  for(const asset of Object.keys(COINGECKO_IDS) as Asset[]){
   if(seriesLoaded[asset]||disposed)continue;
   for(const provider of PRICE_PROVIDERS){
    if(seriesLoaded[asset]||disposed)break;
    for(let attempt=0;attempt<3&&!seriesLoaded[asset]&&!disposed;attempt++){
     try{
      const rows=await provider.series(asset,signal(10000));
      for(const {at,usd} of rows)addSample(series[asset],{at,usd,source:provider.name},Date.now()-RETENTION_MS-3600000);
      seriesLoaded[asset]=rows.length>0;
     }catch{if(!disposed)await sleep(1500*(attempt+1));}
    }
   }
  }
  repriceUnpriced();
 }
 /** First provider to answer wins for this tick; the others are only consulted when it fails, so a
  * healthy CoinGecko never pays for three round trips every poll. */
 async function fetchPrices(){
  const at=Date.now(),cutoff=at-RETENTION_MS-3600000;
  for(const asset of Object.keys(COINGECKO_IDS) as Asset[]){
   for(const provider of PRICE_PROVIDERS){
    try{
     const usd=await provider.spot(asset,signal(10000));
     if(usd!==null){addSample(series[asset],{at,usd,source:provider.name},cutoff);break;}
    }catch{/* try the next provider */}
   }
  }
 }
 function repriceUnpriced(){
  let changed=0;
  for(const feed of feeds.values())for(const r of feed.records()){
   if(r.usdValue!==null)continue;
   const p=priceFor(r.asset,r.blockTime);if(!p)continue;
   r.usdValue=Number(r.amount)*p.usd;r.usdPrice=p.usd;r.priceTime=p.at;r.priceSource=p.source;
   if(r.tx){r.tx.usdValue=r.usdValue;r.tx.usdPrice=r.usdPrice;r.tx.priceTime=r.priceTime;r.tx.usdPriceSource=p.source;}
   changed++;
  }
  if(changed&&!anyBackfilling()){reinfer();emit();}
 }

 /* ---------- Inference, recomputed from whatever evidence is still buffered ---------- */
 function reinfer(){
  const all:Rec[]=[];for(const f of feeds.values())all.push(...f.buffer);
  inferred=inferDeposits(all,{known:knownAttribution,firstParty:a=>!isDerived(a),entities:ENTITIES,explorerTx:(c,h)=>EXPLORERS[c].tx(h),forwardShare:INFER_FORWARD_SHARE});
  for(const r of all)classifyRec(r,attributionFor);
 }

 /* ---------- One chain's feed ---------- */
 function createFeed(chain:Chain,cfg:FeedConfig){
  let rpcIndex=0,endpointStrikes=0,failures=0;
  let lastBlock:number|null=null,tip=0,state:State='CONNECTING',lastReceived:number|null=null,polling=false,misconfigured=false;
  let backfillState:{done:number;total:number}|null=null;
  let plannedBlocks=0,missingBlocks=0,coverageStart:number|null=null,sampledMs=0;
  const buffer:Rec[]=[];
  const sampleBuffer:Rec[]=[];
  const ids=new Set<string>();
  /**
   * Block-time ranges this feed actually read, which is what "observed" means for a sealed span. Only a
   * successful request appends: a chunk that failed after its retry is counted in missingBlocks and leaves no
   * interval, so a gap lowers the coverage of the spans it touches instead of being assumed away. Intervals
   * older than the buffer can no longer describe a sealable span and are dropped.
   */
  const observed:{from:number;to:number}[]=[];
  const noteObserved=(from:number,to:number)=>{
   if(!(to>from))return;
   observed.push({from,to});
   const cutoff=Date.now()-RETENTION_MS-BUCKET_MS;
   while(observed.length>1&&observed[0].to<cutoff)observed.shift();
  };
  /** Milliseconds of `[start,end]` this feed actually held. Overlaps are merged, so a re-read never inflates it. */
  const observedMsIn=(start:number,end:number)=>{
   const clipped=observed.map(x=>({from:Math.max(x.from,start),to:Math.min(x.to,end)})).filter(x=>x.to>x.from).sort((a,b)=>a.from-b.from);
   let ms=0,cur:{from:number;to:number}|null=null;
   for(const x of clipped){
    if(!cur||x.from>cur.to){if(cur)ms+=cur.to-cur.from;cur={...x};}
    else cur.to=Math.max(cur.to,x.to);
   }
   if(cur)ms+=cur.to-cur.from;
   return ms;
  };
  /** Spans that have taken new records since they were last sealed, so sealing re-does only what changed. */
  const dirty=new Set<number>();
  const tokens=CONTRACTS[chain]??{};
  const contracts=Object.keys(tokens);
  const topics=topicsFor(chain);

  /** One request with retries. A rate limit or "can't route" is retried on the same endpoint after a pause; an unreachable or refusing host is abandoned at once, because staying on it burns the whole attempt budget without ever reaching a healthy endpoint. The budget is at least one attempt per endpoint. `large` restricts rotation to endpoints that accept a big request body. */
  async function post(body:unknown,large=false):Promise<unknown>{
   const pool=large?cfg.endpoints.filter(e=>e.largeBody):cfg.endpoints;
   if(!pool.length)throw Error('no endpoint accepts this request');
   let lastErr:unknown=null;
   const attempts=Math.max(RPC_ATTEMPTS,pool.length+1);
   for(let attempt=0;attempt<attempts;attempt++){
    if(disposed)throw Error('disposed');
    const {url}=pool[rpcIndex%pool.length];
    try{
     const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal(25000)});
     const text=await res.text();
     let json:unknown=null;try{json=JSON.parse(text);}catch{json=null;}
     const transient=res.status===429||res.status>=500||(json!==null&&!Array.isArray(json)&&typeof (json as {error?:unknown}).error==='object'&&(json as {error:{code?:number}}).error?.code===12);
     if(!res.ok&&!(json&&transient)){
      console.warn(`[ledger-atlas live] ${chain} ${url} HTTP ${res.status} → ${text.slice(0,160)}`);
      lastErr=Error(`HTTP ${res.status}`);rpcIndex++;endpointStrikes=0;await sleep(200);continue;
     }
     if(transient){lastErr=Error(`transient ${res.status}`);endpointStrikes++;if(endpointStrikes>=RPC_STRIKES){rpcIndex++;endpointStrikes=0;}await sleep(400*(attempt+1));continue;}
     failures=0;endpointStrikes=0;return json;
    }catch(err){
     if(disposed)throw err;
     lastErr=err;rpcIndex++;endpointStrikes=0; // unreachable host: move on immediately
     await sleep(200);
    }
   }
   failures++;throw lastErr??Error('RPC failed');
  }
  async function rpc<T>(method:string,params:unknown[],large=false):Promise<T>{
   const body=await post({jsonrpc:'2.0',id:1,method,params},large) as {result?:T;error?:{message?:string}};
   if(body.error)throw Error(body.error.message??'RPC error');
   return body.result as T;
  }
  /** Free endpoints cap batches (drpc: 3 per request); larger lists are split, and a rejected batch falls back to single calls. */
  async function rpcBatch<T>(calls:{method:string;params:unknown[]}[]):Promise<(T|null)[]>{
   const out:(T|null)[]=calls.map(()=>null);
   for(let i=0;i<calls.length;i+=BATCH_LIMIT){
    const slice=calls.slice(i,i+BATCH_LIMIT);
    let done=false;
    try{
     const body=await post(slice.map((c,j)=>({jsonrpc:'2.0',id:j+1,method:c.method,params:c.params}))) as {id:number;result?:T;error?:unknown}[];
     if(Array.isArray(body)&&body.every(r=>r&&!r.error)){for(const r of body)if(typeof r.id==='number'&&r.result!==undefined)out[i+r.id-1]=r.result as T;done=true;}
    }catch{/* fall through to single calls */}
    if(!done)for(let j=0;j<slice.length;j++){try{out[i+j]=await rpc<T>(slice[j].method,slice[j].params);}catch{out[i+j]=null;}}
   }
   return out;
  }
  /** Settlement feed: only transfers with an evidenced address in one of the two indexed positions. Sequential, not parallel: the pair shares one endpoint cursor, and a parallel pair leaves the second promise rejecting unhandled when the first fails. */
  async function getEvidencedLogs(from:number,to:number):Promise<EvmLog[]>{
   const base={fromBlock:hex(from),toBlock:hex(to),address:contracts};
   const sent=await rpc<EvmLog[]>('eth_getLogs',[{...base,topics:[ERC20_TRANSFER_TOPIC,topics,null]}],true);
   if(cfg.pauseMs)await sleep(cfg.pauseMs);
   const recv=await rpc<EvmLog[]>('eth_getLogs',[{...base,topics:[ERC20_TRANSFER_TOPIC,null,topics]}],true);
   return [...sent,...recv];
  }
  /** Denominator sample: a small unfiltered slice, so the evidenced share can be stated rather than guessed. */
  const getAllLogs=(from:number,to:number)=>rpc<EvmLog[]>('eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),address:contracts,topics:[ERC20_TRANSFER_TOPIC]}]);

  const ingest=(logs:EvmLog[],timeOf:(n:number)=>number)=>{
   for(const log of logs){
    const r=decodeTransferLog(chain,log,timeOf(parseInt(log.blockNumber,16)),a=>tokens[a]??null,priceFor);
    if(!r||ids.has(r.id))continue;
    ids.add(r.id);buffer.push(r);dirty.add(bucketOf(r.blockTime));
    if(coverageStart===null||r.blockTime<coverageStart)coverageStart=r.blockTime;
   }
  };

  async function backfill(){
   // A cheap guard against an endpoint quietly serving the wrong network.
   const id=parseInt(await rpc<string>('eth_chainId',[]),16);
   if(id!==cfg.chainId){misconfigured=true;throw Error(`${chain} endpoint answered chain id ${id}, expected ${cfg.chainId}`);}
   tip=parseInt(await rpc<string>('eth_blockNumber',[]),16);
   const end=tip-TIP_LAG,start=Math.max(0,end-cfg.blocks+1);
   const bounds:number[]=[];for(let n=start;n<end;n+=cfg.chunk*2)bounds.push(n);bounds.push(end);
   let times:Map<number,number>|null=null;
   try{
    const heads=await rpcBatch<Header>(bounds.map(n=>({method:'eth_getBlockByNumber',params:[hex(n),false]})));
    times=new Map();bounds.forEach((n,i)=>{const h=heads[i];if(h?.timestamp)times!.set(n,parseInt(h.timestamp,16)*1000);});
   }catch{times=null;}
   const endTime=times?.get(end)??Date.now();
   const timeOf=makeBlockTimeFn(bounds,times,end,endTime,cfg.slotMs);
   const chunks=planChunks(start,end,cfg.chunk);
   plannedBlocks=end-start+1;missingBlocks=0;
   backfillState={done:0,total:plannedBlocks};state='BACKFILLING';emit();
   for(const [from,to] of chunks){
    if(disposed)return;
    try{
     ingest(await getEvidencedLogs(from,to),timeOf);
     noteObserved(timeOf(from),timeOf(to));
    }catch{
     // One retry at half width. A chunk that still fails is a real gap in the hour: it is counted and
     // reported, never silently turned into an empty result.
     const mid=Math.floor((from+to)/2);
     let recovered=false;
     if(mid>from){
      try{ingest([...await getEvidencedLogs(from,mid),...await getEvidencedLogs(mid+1,to)],timeOf);recovered=true;noteObserved(timeOf(from),timeOf(to));}catch{/* counted below */}
     }
     if(!recovered){missingBlocks+=to-from+1;console.warn(`[ledger-atlas live] ${chain} blocks ${from}-${to} could not be loaded; the window is short by ${to-from+1} blocks`);}
    }
    backfillState={done:to-start+1,total:plannedBlocks};emit();
    if(cfg.pauseMs)await sleep(cfg.pauseMs);
   }
   lastBlock=end;lastReceived=Date.now();backfillState=null;
   if(coverageStart===null)coverageStart=timeOf(start);
   prune();reinfer();
   state=missingBlocks/Math.max(1,plannedBlocks)>COVERAGE_ALARM?'CATCHING UP':'LIVE';
   emit();
  }

  async function poll(){
   if(polling||disposed||misconfigured)return;polling=true;
   try{
    tip=parseInt(await rpc<string>('eth_blockNumber',[]),16);
    const target=tip-TIP_LAG;
    if(lastBlock===null)lastBlock=Math.max(0,target-cfg.liveRange);
    if(target<=lastBlock){if(!missingBlocks)state='LIVE';return;}
    const from=lastBlock+1,to=Math.min(target,from+((target-lastBlock)>cfg.liveRange?cfg.catchupRange:cfg.liveRange)-1);
    const logs=await getEvidencedLogs(from,to);
    const blockIds=[...new Set(logs.map(l=>l.blockNumber))],times=new Map<string,number>();
    if(blockIds.length){
     const heads=await rpcBatch<Header>(blockIds.map(id=>({method:'eth_getBlockByNumber',params:[id,false]})));
     blockIds.forEach((id,i)=>{const h=heads[i];times.set(id,h?.timestamp?parseInt(h.timestamp,16)*1000:Date.now());});
    }
    ingest(logs,n=>times.get(hex(n))??Date.now());
    // Headers are fetched only for blocks that produced logs, so the range's own bounds are interpolated from
    // the tip and the chain's slot time — the same interpolation the backfilled hour uses.
    noteObserved(Date.now()-(target-from)*cfg.slotMs,Date.now()-(target-to)*cfg.slotMs);
    lastBlock=to;lastReceived=Date.now();prune();reinfer();
    state=to===target&&!missingBlocks?'LIVE':'CATCHING UP';
   }catch{state=failures>3?'RECONNECTING':'CONNECTING';}
   finally{polling=false;emit();}
  }

  /** Read one small unfiltered slice, so the share of chain activity that is evidenced can be stated. */
  async function sample(){
   if(disposed||misconfigured||lastBlock===null)return;
   try{
    const to=lastBlock,from=Math.max(0,to-cfg.sampleBlocks+1);
    const logs=await getAllLogs(from,to);
    const now=Date.now();
    for(const log of logs){
     const r=decodeTransferLog(chain,log,now,a=>tokens[a]??null,priceFor,'sample');
     if(r){classifyRec(r,attributionFor);sampleBuffer.push(r);}
    }
    sampledMs+=(to-from+1)*cfg.slotMs;
    if(sampleBuffer.length>SAMPLE_CAP)sampleBuffer.splice(0,sampleBuffer.length-SAMPLE_CAP);
   }catch{/* the sample is a nicety; never let it disturb the feed */}
  }

  function prune(){
   const cutoff=Date.now()-RETENTION_MS;
   const kept=pruneRecords(buffer,cutoff);
   if(kept.length===buffer.length)return;
   buffer.length=0;buffer.push(...kept);
   ids.clear();for(const r of buffer)ids.add(r.id);
   coverageStart=buffer.length?buffer.reduce((m,r)=>Math.min(m,r.blockTime),Infinity):null;
  }

  return {
   chain,buffer,sampleBuffer,observedMsIn,dirty,
   records:()=>[...buffer,...sampleBuffer],
   start:async()=>{
    try{await backfill();}
    catch(err){console.warn(`[ledger-atlas live] ${chain} backfill failed`,err);backfillState=null;state=misconfigured?'RECONNECTING':'CONNECTING';emit();}
    void poll();
   },
   poll,sample,
   progress:()=>backfillState,
   get state(){return state;},
   get sampledMs(){return sampledMs;},
   health:()=>({
    chain,
    status:misconfigured?'Misconfigured':state==='LIVE'?'LIVE':state==='BACKFILLING'?'Backfilling':state==='CATCHING UP'?(missingBlocks?'Partial':'Delayed'):state==='RECONNECTING'?'Reconnecting':'Connecting',
    lastReceived
   }),
   coverage:()=>({start:coverageStart,missingBlocks,plannedBlocks,tip,watched:topics.length})
  };
 }

 const feeds=new Map<Chain,ReturnType<typeof createFeed>>();
 for(const c of LIVE_CHAINS)feeds.set(c,createFeed(c,CHAIN_CONFIG[c]!));
 const anyBackfilling=()=>[...feeds.values()].some(f=>f.progress()!==null);

 /* ---------- Recorded history: sealed spans, per bucket per chain ---------- */
 /**
  * The registry a span was sealed under. Evidence itself expires against each transfer's own block time, so a
  * sealed span stays correct as it ages; what changes across a deploy is which wallets were evidenced at all,
  * and a span sealed under an older registry attributed less than today's would. That is a real property of the
  * observation, so such spans are kept and disclosed rather than discarded.
  */
 const REGISTRY_VERSION=`${registryHealth().total}@${dormancyInfo().measuredAt}`;
 const history=createHistoryStore({retentionMs:HISTORY_MS});
 const sealed=new Map<string,Rollup>();
 let historyLoaded=false;
 const partKey=(bucket:number,chain:Chain)=>`${bucket}:${chain}`;
 const resolvedChains=(chain:string):Chain[]=>chain==='All chains'?LIVE_CHAINS:LIVE_CHAINS.filter(c=>c===chain);

 /**
  * Seal every complete span that is still wholly inside the retained buffer, and re-seal one that has taken
  * new records since. Re-sealing overwrites by (bucket, chain), so a late-arriving log corrects its span
  * instead of being added twice, and a span becomes final when it leaves the buffer. A span with no matching
  * transfers is still sealed: zero activity over a watched quarter hour is a measurement, and baselines need
  * it to tell a quiet window from an unwatched one.
  */
 function sealDue(){
  const now=Date.now();
  const first=bucketOf(now-RETENTION_MS)+BUCKET_MS;
  const fresh:Rollup[]=[];
  for(const [chain,feed] of feeds){
   for(let b=first;b+BUCKET_MS<=now;b+=BUCKET_MS){
    const key=partKey(b,chain);
    if(sealed.has(key)&&!feed.dirty.has(b))continue;
    const part=sealSpan(feed.buffer.filter(r=>r.blockTime>b&&r.blockTime<=b+BUCKET_MS),b,b+BUCKET_MS,{
     chain,coverage:[{chain,observedMs:feed.observedMsIn(b,b+BUCKET_MS)}],
     registry:REGISTRY_VERSION,sealedAt:now,forTotals:r=>r.tx??r
    });
    sealed.set(key,part);fresh.push(part);
    feed.dirty.delete(b);
   }
  }
  // Drop spans past the retention horizon from memory; the store prunes its own copy when it next loads.
  const cutoff=now-HISTORY_MS;
  for(const [key,part] of sealed)if(part.end<=cutoff)sealed.delete(key);
  if(fresh.length)history.save(fresh.map(toStored));
 }

 /** The part of a window newer than the last sealed span, aggregated live so a long window is current to the second. */
 function liveTails(at:number,chains:readonly Chain[]):Rollup[]{
  const from=bucketOf(at);
  return chains.flatMap(chain=>{
   const feed=feeds.get(chain);
   if(!feed)return [];
   return [sealSpan(feed.buffer.filter(r=>r.blockTime>from&&r.blockTime<=at),from,at,{
    chain,coverage:[{chain,observedMs:feed.observedMsIn(from,at)}],
    registry:REGISTRY_VERSION,sealedAt:at,forTotals:r=>r.tx??r
   })];
  });
 }
 const partsFor=(chains:readonly Chain[],at:number,withTail=true)=>
  partsForChains(withTail?[...sealed.values(),...liveTails(at,chains)]:[...sealed.values()],chains);

 /* ---------- Snapshots ---------- */
 function* events(chain:string):Iterable<Transfer|TotalsInput>{
  for(const [c,f] of feeds){
   if(chain!=='All chains'&&chain!==c)continue;
   for(const r of f.buffer)yield r.tx??r;
  }
 }
 function build(window:WindowKey,chain:string,at:number):Snapshot{
  // 5M and 1H are aggregated from the raw buffer exactly as they always were. 24H and 7D are merged from this
  // browser's sealed spans plus the un-sealed tail; the two paths share no arithmetic beyond engine.ts itself.
  const long=LONG_WINDOWS.includes(window);
  const chains=resolvedChains(chain);
  let recorded:ReturnType<typeof coverageOf>|null=null,mixedRegistry=false;
  let s:Snapshot;
  if(long){
   const parts=partsFor(chains,at);
   s=mergeRollups(parts,window,at);
   applyBaselines(s,parts,chains,UNLOCK_SHARE);
   recorded=coverageOf(parts,window,at,chains);
   mixedRegistry=registryVersionsOf(parts).length>1;
  }else{
   s=aggregate(events(chain),window,at);
  }
  const active=[...feeds.values()].filter(f=>chain==='All chains'||chain===f.chain);
  const worst=active.find(f=>f.state!=='LIVE');
  s.health=!active.length?'NOT CONNECTED':!worst?'LIVE':worst.state==='RECONNECTING'?'RECONNECTING':worst.state==='CONNECTING'?'NOT CONNECTED':'DELAYED';
  s.lastReceived=Math.max(0,...active.map(f=>f.health().lastReceived??0))||null;
  s.chainHealth=CHAINS.map(c=>feeds.get(c)?.health()??{chain:c,status:'Not connected',lastReceived:null});

  const reg=registryHealth(at);
  const dorm=dormancyInfo();
  const dormant=active.reduce((n,f)=>n+(dorm.counts[f.chain]?.dormant??0),0),registered=active.reduce((n,f)=>n+(dorm.counts[f.chain]?.evidenced??0),0);
  const sampleRecs:Rec[]=[];let sampledMs=0;
  for(const f of active){sampleRecs.push(...f.sampleBuffer);sampledMs+=f.sampledMs;}
  // The unfiltered sample describes recently read chain time, so it belongs to the live windows. Attaching it
  // to a 24H or 7D figure would invite reading it as that window's denominator, which it is not.
  if(sampleRecs.length&&!long){const t:Totals=aggregate(sampleRecs,'1H',at).totals;s.sample={totals:t,sampledMs};}
  const loading=active.map(f=>f.progress()).filter((p):p is {done:number;total:number}=>!!p);
  const gaps=active.map(f=>({chain:f.chain,...f.coverage()})).filter(c=>c.missingBlocks);
  const starts=active.filter(f=>f.progress()===null).map(f=>({chain:f.chain,start:f.coverage().start})).filter((c):c is {chain:Chain;start:number}=>c.start!==null);
  const chainList=active.map(f=>f.chain).join(', ').replace(/, ([^,]*)$/,' and $1');
  const tips=active.map(f=>`${f.chain} ${f.coverage().tip.toLocaleString()}`).filter(t=>!/ 0$/.test(t));
  s.message=[
   `Live from public ${chainList} nodes, read directly by your browser (no server, no database).`,
   tips.length?`At block${tips.length>1?'s':''} ${tips.join(', ')}.`:'',
   loading.length?`Loading the preceding hour: ${loading.reduce((n,p)=>n+p.done,0).toLocaleString()} of ${loading.reduce((n,p)=>n+p.total,0).toLocaleString()} blocks.`:'',
   gaps.length?gaps.map(g=>`${g.missingBlocks.toLocaleString()} of ${g.plannedBlocks.toLocaleString()} ${g.chain} blocks could not be loaded from the public endpoints, so that window is incomplete and is reported as partial rather than live.`).join(' '):'',
   starts.length?`The window covers everything retained since ${starts.map(c=>`${hhmm(c.start)} UTC on ${c.chain}`).join(', ')}.`:'',
   'To stay affordable on free public endpoints each feed requests only transfers that touch a wallet with evidence on that chain, so these totals describe evidenced settlement rather than all on-chain activity.',
   dormant?`The filter leaves out ${dormant.toLocaleString()} of ${registered.toLocaleString()} registry addresses on these chains that moved no USDC or USDT in the ${dorm.windowDays} days to ${dorm.measuredAt}. They stay in the registry as evidence and still attribute any transfer that touches them; a wallet that wakes up after that date is picked up at the next measurement.`:'',
   sampledMs?`A separate unfiltered sample covering ${Math.round(sampledMs/1000).toLocaleString()} seconds of chain time is read periodically to show how small the evidenced share is; it is reported as a sample and never scaled up into an estimate.`:'',
   'Block times inside the backfilled hour are interpolated between fetched headers.',
   long&&recorded
    ?`This ${window} window is assembled from ${window==='7D'?'a week':'24 hours'} of history THIS BROWSER recorded: each completed 15 minutes was reduced to its exact accounting and kept locally, never uploaded and never shared. It covers ${hms(recorded.observedMs)} of the ${hms(recorded.windowMs)} window${recorded.perChain.length>1?` (least-covered chain: ${recorded.perChain.reduce((a,b)=>a.share<b.share?a:b).chain})`:''}. Transfer-level evidence and the unfiltered sample stay on the 5M and 1H windows, where the raw records are still held.`
    :'The 5M and 1H windows read the transfers still held in memory. 24H and 7D are offered once this browser has recorded enough of them itself.',
   long&&mixedRegistry?'Part of this window was recorded under an earlier version of the evidence registry, which attributed fewer wallets than the current one. The figures are what this browser could attribute at the time.':'',
   long?'Baselines compare this corridor with the four preceding windows of the same length from the same recorded history, and are shown only where each of those windows was observed too.':'',
   'Routes are drawn only between evidenced wallets in different jurisdictions. On Base and Arbitrum most evidence is DERIVED from an Ethereum label on the same plain key-controlled account, is marked as such in the evidence panel, and never exceeds HIGH.',
   inferred.size?`${inferred.size} exchange deposit address${inferred.size===1?' is':'es are'} currently INFERRED from observed sweeps into labelled hot wallets and marked as such in the evidence panel.`:'',
   'Single-evidenced activity lights up its jurisdiction without drawing a route.',
   reg.expired?`WARNING: ${reg.expired} of ${reg.total} registry addresses have passed the 180-day re-verification horizon and can no longer draw routes. The evidence registry needs re-verifying.`:''
  ].filter(Boolean).join(' ');
  if(reg.expired>reg.total*.25)s.health='DELAYED';
  return s;
 }
 function emit(){if(disposed)return;const now=Date.now();for(const l of listeners)l.cb(build(l.window,l.chain,now));}

 /** Transfers the map cannot place. The selection itself is pure and lives in engine.ts; this only picks
  * the buffers the chain filter allows. */
 function unattributed(window:WindowKey,chain:string,at:number,filter?:UnattributedFilter):UnattributedSummary{
  if(!LONG_WINDOWS.includes(window))return selectUnattributed(records(chain),window,at,filter);
  /**
   * Over a long window the headline count, value, reasons and evidenced-entity breakdown come from sealed
   * spans and are exact. The transfers themselves are not listed: sealed history keeps no per-transfer detail
   * (rollup.ts explains why), so a list here could only show the current quarter hour, which under a headline
   * counting thousands would read as the window's largest transfers. `counterparties` is empty for a related
   * reason — an address can rank 13th in every span and first overall, so merging per-span top lists would
   * produce a plausible but wrong ranking. Both lists are on the 5M and 1H windows, where the records are real.
   */
  const m=mergeUnmapped(partsFor(resolvedChains(chain),at),window,at);
  return {items:[],count:m.count,usdValue:m.usdValue,reasons:m.reasons,
   shown:0,shownUsd:0,counterparties:[],entities:m.entities};
 }
 function* records(chain:string){
  for(const [c,f] of feeds){
   if(chain!=='All chains'&&chain!==c)continue;
   yield* f.buffer;
  }
 }

 /* ---------- Start ---------- */
 void (async()=>{
  // Recorded history first: it decides which windows may be offered, and a returning visitor should not see
  // 24H flicker into existence a few seconds after the map appears.
  try{
   for(const stored of await history.load()){
    const part=fromStored(stored);
    sealed.set(partKey(part.bucket,part.chain),part);
   }
  }catch(err){console.warn('[ledger-atlas live] recorded history could not be read',err);}
  historyLoaded=true;
  void history.refreshUsage();
  emit();
 })();
 void (async()=>{
  void fetchPriceSeries();void fetchPrices(); // run alongside the backfill; transfers are re-priced when prices land
  await Promise.all([...feeds.values()].map(f=>f.start()));
  for(const f of feeds.values())void f.sample();
  sealDue(); // the backfilled hour is already several complete spans
 })();
 timers.push(setInterval(()=>{for(const f of feeds.values())void f.poll();},POLL_MS));
 timers.push(setInterval(()=>{sealDue();},SEAL_MS));
 timers.push(setInterval(()=>{void fetchPrices();if(!seriesLoaded.USDT||!seriesLoaded.USDC)void fetchPriceSeries();},PRICE_MS));
 timers.push(setInterval(()=>{for(const f of feeds.values())void f.sample();},SAMPLE_MS));
 timers.push(setInterval(emit,TICK_MS));
 const onVisible=()=>{if(!document.hidden)emit();};
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',onVisible);

 instance={
  defaultWindow:'1H',chains:LIVE_CHAINS,retentionMs:RETENTION_MS,rawEventMinUsd:500000,
  windowsFor(chain){
   const base:WindowKey[]=['5M','1H'];
   if(!historyLoaded)return base;
   const chains=resolvedChains(chain);
   if(!chains.length)return base;
   // Sealed spans only: the un-sealed tail is under fifteen minutes and cannot decide a day.
   const parts=partsFor(chains,Date.now(),false);
   const now=Date.now();
   return [...base,...LONG_WINDOWS.filter(w=>coverageOf(parts,w,now,chains).share>=UNLOCK_SHARE)];
  },
  windowCoverage(window,chain){
   const chains=resolvedChains(chain);
   const c=coverageOf(partsFor(chains,Date.now(),false),window,Date.now(),chains);
   return {share:c.share,observedMs:c.observedMs,windowMs:c.windowMs,needMs:Math.max(0,c.windowMs*UNLOCK_SHARE-c.observedMs)};
  },
  subscribe(window,chain,cb){const l={window,chain,cb};listeners.add(l);cb(build(window,chain,Date.now()));return()=>{listeners.delete(l);};},
  snapshotAt(window,chain,at){return build(window,chain,at);},
  unattributed,
  range(window){
   const now=Date.now();
   // A long window can be replayed across sealed history; the live windows are bounded by the buffer, because
   // scrubbing them further back would only show an empty map.
   if(window&&LONG_WINDOWS.includes(window)){
    const buckets=[...sealed.values()].map(p=>p.bucket);
    return {start:buckets.length?Math.max(now-HISTORY_MS,Math.min(...buckets)):now-RETENTION_MS,end:now};
   }
   const starts=[...feeds.values()].map(f=>f.coverage().start).filter((n):n is number=>n!==null);
   return {start:Math.max(now-RETENTION_MS,starts.length?Math.min(...starts):now),end:now};
  },
  historyStatus(){
   const st=history.status();
   const buckets=[...sealed.values()];
   return {...st,spans:buckets.length,
    oldest:buckets.length?Math.min(...buckets.map(p=>p.bucket)):null,
    newest:buckets.length?Math.max(...buckets.map(p=>p.end)):null,
    spanMs:buckets.length?Math.max(...buckets.map(p=>p.end))-Math.min(...buckets.map(p=>p.bucket)):0,
    registries:registryVersionsOf(buckets),
    registryMixed:registryVersionsOf(buckets).length>1};
  },
  async clearHistory(){
   sealed.clear();
   await history.clear();
   void history.refreshUsage();
   emit();
  },
  progress(){
   const ps=[...feeds.values()].map(f=>f.progress()).filter((p):p is {done:number;total:number}=>!!p);
   return ps.length?{done:ps.reduce((n,p)=>n+p.done,0),total:ps.reduce((n,p)=>n+p.total,0)}:null;
  },
  inferredCount(){return inferred.size;},
  registryHealth(){return registryHealth();},
  dispose(){
   disposed=true;
   for(const t of timers)clearInterval(t);
   timers.length=0;
   abort.abort();
   listeners.clear();
   if(typeof document!=='undefined')document.removeEventListener('visibilitychange',onVisible);
   instance=null;
  }
 };
 return instance;
}

// Vite dev HMR re-imports this module on every edit. Without this, the previous module's timers and its
// backfill keep running against rate-limited public endpoints alongside the new ones.
const hot=(import.meta as {hot?:{dispose(cb:()=>void):void}}).hot;
if(hot)hot.dispose(()=>instance?.dispose());
