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
import {CHAINS,UNKNOWN,type Chain,type Snapshot,type Transfer,type WindowKey,type Attribution,type Asset,type Totals} from './model';
import {aggregate,type TotalsInput} from './engine';
import {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog} from './evm';
import {EXPLORERS} from './geography';
import {knownAttribution,isDerived,evidencedAddresses,registryHealth,ENTITIES} from './known-entities';
import {addressKey,classifyRec,decodeTransferLog,inferDeposits,makeBlockTimeFn,planChunks,priceAt,pruneRecords,addSample,type Rec,type Sample} from './live-core';

export interface LiveSource {
 /** Windows this source can honestly serve. */
 windows:WindowKey[];
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
 /** Retained block-time span, for the playback slider. */
 range():{start:number;end:number};
 /** Backfill progress in blocks across every chain, or null once complete. */
 progress():{done:number;total:number}|null;
 /** Number of deposit addresses currently inferred from observed sweeps. */
 inferredCount():number;
 /** Registry expiry state, so an expired map can explain itself instead of looking empty. */
 registryHealth():{total:number;expired:number;earliestExpiry:number};
 /** Stop every timer and in-flight request. */
 dispose():void;
}

type Endpoint={url:string;largeBody:boolean};
/**
 * Endpoints, all keyless and browser-callable (CORS `*` confirmed 2026-09-20). `largeBody` marks the ones
 * that accept the ~55 KB request the address filter needs; the rest serve only small calls. Range caps
 * per endpoint set each chain's chunk size: 1rpc caps eth_getLogs at 50 blocks everywhere, drpc's free
 * tier rejects the filter on the L2s, publicnode's Arbitrum node refuses getLogs without a token, and the
 * official Arbitrum endpoint rate-limits above ~1,200 blocks.
 */
const ETH_ENDPOINTS:Endpoint[]=[{url:'https://eth.drpc.org',largeBody:true},{url:'https://rpc.mevblocker.io',largeBody:true},{url:'https://1rpc.io/eth',largeBody:true},{url:'https://eth-pokt.nodies.app',largeBody:false}];
const BASE_ENDPOINTS:Endpoint[]=[{url:'https://mainnet.base.org',largeBody:true},{url:'https://base-rpc.publicnode.com',largeBody:true},{url:'https://1rpc.io/base',largeBody:false}];
const ARB_ENDPOINTS:Endpoint[]=[{url:'https://arbitrum.gateway.tenderly.co',largeBody:true},{url:'https://arb1.arbitrum.io/rpc',largeBody:true},{url:'https://1rpc.io/arb',largeBody:false}];
const COINGECKO='https://api.coingecko.com/api/v3';
const COINGECKO_IDS:Record<Asset,string>={USDT:'tether',USDC:'usd-coin'};
const PRICE_SOURCE='CoinGecko public API, 5-minute market sample nearest to block time';
const POLL_MS=20000,PRICE_MS=120000,TICK_MS=8000,SAMPLE_MS=900000;
const TIP_LAG=1,BATCH_LIMIT=3,RPC_ATTEMPTS=4,RPC_STRIKES=2;
const RETENTION_MS=90*60000,PRICE_TOLERANCE_MS=600000;
const INFER_FORWARD_SHARE=.8; // a deposit address forwards (nearly) everything it received
const SAMPLE_CAP=20000;
/** Report the feed as partial rather than LIVE once this share of a backfill failed to load. */
const COVERAGE_ALARM=.1;

interface FeedConfig{
 endpoints:Endpoint[];chainId:number;
 /** Nominal block interval, for interpolated timestamps and for sizing one hour in blocks. */
 slotMs:number;
 /** Blocks in the backfilled hour. */
 blocks:number;
 /** Blocks per filtered eth_getLogs request. */
 chunk:number;
 /** Blocks per live poll when caught up, and when catching up. */
 liveRange:number;catchupRange:number;
 /** Pause between backfill requests, for endpoints that rate-limit bursts. */
 pauseMs:number;
 /** Unfiltered blocks per denominator sample. Sized to a few hundred logs on each chain. */
 sampleBlocks:number;
}
/** Chains this build reads. One hour is 300 Ethereum blocks, 1,800 Base blocks or 14,400 Arbitrum blocks. */
const CHAIN_CONFIG:Partial<Record<Chain,FeedConfig>>={
 Ethereum:{endpoints:ETH_ENDPOINTS,chainId:1,slotMs:12000,blocks:300,chunk:50,liveRange:6,catchupRange:50,pauseMs:0,sampleBlocks:2},
 Base:{endpoints:BASE_ENDPOINTS,chainId:8453,slotMs:2000,blocks:1800,chunk:1500,liveRange:30,catchupRange:1500,pauseMs:0,sampleBlocks:2},
 Arbitrum:{endpoints:ARB_ENDPOINTS,chainId:42161,slotMs:250,blocks:14400,chunk:1200,liveRange:200,catchupRange:1200,pauseMs:350,sampleBlocks:40}
};
const LIVE_CHAINS=Object.keys(CHAIN_CONFIG) as Chain[];
/** A chain's evidenced addresses as 32-byte topic values, for the indexed sender/receiver positions of Transfer. */
const topicsFor=(chain:Chain)=>evidencedAddresses(chain).map(a=>'0x'+a.slice(2).padStart(64,'0'));

type State='CONNECTING'|'BACKFILLING'|'LIVE'|'CATCHING UP'|'RECONNECTING';
type Header={timestamp:string}|null;
const hex=(n:number)=>'0x'+n.toString(16);
const hhmm=(t:number)=>new Date(t).toISOString().slice(11,16);

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
 /** CoinGecko's public API rate-limits bursts (429 without CORS headers); fetch the two series sequentially with retries, and re-price anything left unpriced once a series arrives. */
 async function fetchPriceSeries(){
  for(const asset of Object.keys(COINGECKO_IDS) as Asset[]){
   if(seriesLoaded[asset]||disposed)continue;
   for(let attempt=0;attempt<3&&!seriesLoaded[asset]&&!disposed;attempt++){
    try{
     const res=await fetch(`${COINGECKO}/coins/${COINGECKO_IDS[asset]}/market_chart?vs_currency=usd&days=1`,{signal:signal(10000)});
     if(!res.ok)throw Error(`HTTP ${res.status}`);
     const j=await res.json() as {prices?:[number,number][]};
     for(const [at,usd] of j.prices??[])if(typeof at==='number'&&typeof usd==='number')addSample(series[asset],{at,usd},Date.now()-RETENTION_MS-3600000);
     seriesLoaded[asset]=(j.prices?.length??0)>0;
    }catch{if(!disposed)await sleep(1500*(attempt+1));}
   }
  }
  repriceUnpriced();
 }
 async function fetchPrices(){
  try{
   const j=await (await fetch(`${COINGECKO}/simple/price?ids=tether,usd-coin&vs_currencies=usd&precision=6`,{signal:signal(10000)})).json() as Record<string,{usd?:number}>;
   const at=Date.now(),cutoff=at-RETENTION_MS-3600000;
   if(typeof j.tether?.usd==='number')addSample(series.USDT,{at,usd:j.tether.usd},cutoff);
   if(typeof j['usd-coin']?.usd==='number')addSample(series.USDC,{at,usd:j['usd-coin'].usd},cutoff);
  }catch{/* keep the series we have */}
 }
 function repriceUnpriced(){
  let changed=0;
  for(const feed of feeds.values())for(const r of feed.records()){
   if(r.usdValue!==null)continue;
   const p=priceFor(r.asset,r.blockTime);if(!p)continue;
   r.usdValue=Number(r.amount)*p.usd;r.usdPrice=p.usd;r.priceTime=p.at;
   if(r.tx){r.tx.usdValue=r.usdValue;r.tx.usdPrice=r.usdPrice;r.tx.priceTime=r.priceTime;r.tx.usdPriceSource=PRICE_SOURCE;}
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
    ids.add(r.id);buffer.push(r);
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
    }catch{
     // One retry at half width. A chunk that still fails is a real gap in the hour: it is counted and
     // reported, never silently turned into an empty result.
     const mid=Math.floor((from+to)/2);
     let recovered=false;
     if(mid>from){
      try{ingest([...await getEvidencedLogs(from,mid),...await getEvidencedLogs(mid+1,to)],timeOf);recovered=true;}catch{/* counted below */}
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
   chain,buffer,sampleBuffer,
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
   coverage:()=>({start:coverageStart,missingBlocks,plannedBlocks,tip,evidenced:topics.length})
  };
 }

 const feeds=new Map<Chain,ReturnType<typeof createFeed>>();
 for(const c of LIVE_CHAINS)feeds.set(c,createFeed(c,CHAIN_CONFIG[c]!));
 const anyBackfilling=()=>[...feeds.values()].some(f=>f.progress()!==null);

 /* ---------- Snapshots ---------- */
 function* events(chain:string):Iterable<Transfer|TotalsInput>{
  for(const [c,f] of feeds){
   if(chain!=='All chains'&&chain!==c)continue;
   for(const r of f.buffer)yield r.tx??r;
  }
 }
 function build(window:WindowKey,chain:string,at:number):Snapshot{
  const s=aggregate(events(chain),window,at);
  const active=[...feeds.values()].filter(f=>chain==='All chains'||chain===f.chain);
  const worst=active.find(f=>f.state!=='LIVE');
  s.health=!active.length?'NOT CONNECTED':!worst?'LIVE':worst.state==='RECONNECTING'?'RECONNECTING':worst.state==='CONNECTING'?'NOT CONNECTED':'DELAYED';
  s.lastReceived=Math.max(0,...active.map(f=>f.health().lastReceived??0))||null;
  s.chainHealth=CHAINS.map(c=>feeds.get(c)?.health()??{chain:c,status:'Not connected',lastReceived:null});

  const reg=registryHealth(at);
  const sampleRecs:Rec[]=[];let sampledMs=0;
  for(const f of active){sampleRecs.push(...f.sampleBuffer);sampledMs+=f.sampledMs;}
  if(sampleRecs.length){const t:Totals=aggregate(sampleRecs,'1H',at).totals;s.sample={totals:t,sampledMs};}
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
   sampledMs?`A separate unfiltered sample covering ${Math.round(sampledMs/1000).toLocaleString()} seconds of chain time is read periodically to show how small the evidenced share is; it is reported as a sample and never scaled up into an estimate.`:'',
   'Block times inside the backfilled hour are interpolated between fetched headers.',
   'Only the 5M and 1H windows are available in this build; 24H, 7D and historical baselines need the persistent backend.',
   'Routes are drawn only between evidenced wallets in different jurisdictions. On Base and Arbitrum most evidence is DERIVED from an Ethereum label on the same plain key-controlled account, is marked as such in the evidence panel, and never exceeds HIGH.',
   inferred.size?`${inferred.size} exchange deposit address${inferred.size===1?' is':'es are'} currently INFERRED from observed sweeps into labelled hot wallets and marked as such in the evidence panel.`:'',
   'Single-evidenced activity lights up its jurisdiction without drawing a route.',
   reg.expired?`WARNING: ${reg.expired} of ${reg.total} registry addresses have passed the 180-day re-verification horizon and can no longer draw routes. The evidence registry needs re-verifying.`:''
  ].filter(Boolean).join(' ');
  if(reg.expired>reg.total*.25)s.health='DELAYED';
  return s;
 }
 function emit(){if(disposed)return;const now=Date.now();for(const l of listeners)l.cb(build(l.window,l.chain,now));}

 /* ---------- Start ---------- */
 void (async()=>{
  void fetchPriceSeries();void fetchPrices(); // run alongside the backfill; transfers are re-priced when prices land
  await Promise.all([...feeds.values()].map(f=>f.start()));
  for(const f of feeds.values())void f.sample();
 })();
 timers.push(setInterval(()=>{for(const f of feeds.values())void f.poll();},POLL_MS));
 timers.push(setInterval(()=>{void fetchPrices();if(!seriesLoaded.USDT||!seriesLoaded.USDC)void fetchPriceSeries();},PRICE_MS));
 timers.push(setInterval(()=>{for(const f of feeds.values())void f.sample();},SAMPLE_MS));
 timers.push(setInterval(emit,TICK_MS));
 const onVisible=()=>{if(!document.hidden)emit();};
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',onVisible);

 instance={
  windows:['5M','1H'],defaultWindow:'1H',chains:LIVE_CHAINS,retentionMs:RETENTION_MS,rawEventMinUsd:500000,
  subscribe(window,chain,cb){const l={window,chain,cb};listeners.add(l);cb(build(window,chain,Date.now()));return()=>{listeners.delete(l);};},
  snapshotAt(window,chain,at){return build(window,chain,at);},
  range(){
   const now=Date.now();
   const starts=[...feeds.values()].map(f=>f.coverage().start).filter((n):n is number=>n!==null);
   return {start:Math.max(now-RETENTION_MS,starts.length?Math.min(...starts):now),end:now};
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
