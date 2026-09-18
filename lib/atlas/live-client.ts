/**
 * Browser-side live data source. Runs entirely in the visitor's browser against free public
 * endpoints, with no server and no database: the same architecture as a single-file market widget.
 * It reuses the project's real classification and aggregation code (engine.ts), so totals, corridor
 * ranking and the accounting panel are computed exactly as the production backend would compute them;
 * the only difference is memory. On load it backfills the preceding hour, then polls for new blocks.
 * Nothing survives a page reload, so only the 5M and 1H windows are offered and baselines stay null.
 */
import {CHAINS,UNKNOWN,type Snapshot,type Transfer,type WindowKey,type Attribution,type Asset} from './model';
import {aggregate,classify,type TotalsInput} from './engine';
import {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog} from './evm';
import {knownAttribution} from './known-entities';

export interface LiveSource {
 /** Windows this source can honestly serve. */
 windows:WindowKey[];
 defaultWindow:WindowKey;
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
 /** Backfill progress in blocks, or null once complete. */
 progress():{done:number;total:number}|null;
}

const RPC_ENDPOINTS=['https://eth.drpc.org','https://1rpc.io/eth'];
const COINGECKO='https://api.coingecko.com/api/v3';
const COINGECKO_IDS:Record<Asset,string>={USDT:'tether',USDC:'usd-coin'};
const POLL_MS=20000,PRICE_MS=120000,TICK_MS=8000;
const LIVE_BLOCK_RANGE=6,CATCHUP_BLOCK_RANGE=50,BACKFILL_BLOCKS=300,BACKFILL_CHUNK=50,BACKFILL_CONCURRENCY=2,TIP_LAG=1,BATCH_LIMIT=3;
const RETENTION_MS=90*60000,PRICE_TOLERANCE_MS=600000,SLOT_MS=12000;
const ZERO=/^0x0{40}$/;
type State='CONNECTING'|'BACKFILLING'|'LIVE'|'CATCHING UP'|'RECONNECTING';
type Sample={at:number;usd:number};
type Header={timestamp:string}|null;
const hex=(n:number)=>'0x'+n.toString(16);

let instance:LiveSource|null=null;
export function createLiveSource():LiveSource{
 if(instance)return instance;
 let rpcIndex=0,failures=0,lastBlock:number|null=null,tip=0,state:State='CONNECTING',lastReceived:number|null=null,polling=false;
 let backfillState:{done:number;total:number}|null=null;
 const series:Record<Asset,Sample[]>={USDT:[],USDC:[]};
 const full:Transfer[]=[],slim:TotalsInput[]=[];
 const listeners=new Set<{window:WindowKey;chain:string;cb:(s:Snapshot)=>void}>();

 /* ---------- JSON-RPC ---------- */
 async function post(body:unknown):Promise<unknown>{
  const url=RPC_ENDPOINTS[rpcIndex];
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   const json=await res.json();failures=0;return json;
  }catch(err){failures++;rpcIndex=(rpcIndex+1)%RPC_ENDPOINTS.length;throw err;}
 }
 async function rpc<T>(method:string,params:unknown[]):Promise<T>{
  const body=await post({jsonrpc:'2.0',id:1,method,params}) as {result?:T;error?:{message?:string}};
  if(body.error)throw Error(body.error.message??'RPC error');
  return body.result as T;
 }
 /** Free public endpoints cap batches (drpc: 3 per request); larger lists are split, and a rejected batch falls back to single calls. */
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
 const getLogs=(from:number,to:number)=>rpc<EvmLog[]>('eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),address:Object.keys(CONTRACTS.Ethereum),topics:[ERC20_TRANSFER_TOPIC]}]);

 /* ---------- Prices: a timestamped series, never an assumed peg ---------- */
 function addSample(asset:Asset,s:Sample){
  const arr=series[asset];arr.push(s);
  if(arr.length>1&&arr[arr.length-2].at>s.at)arr.sort((a,b)=>a.at-b.at);
  const cutoff=Date.now()-RETENTION_MS-3600000;let i=0;while(i<arr.length&&arr[i].at<cutoff)i++;if(i)arr.splice(0,i);
 }
 async function fetchPriceSeries(){
  await Promise.allSettled((Object.keys(COINGECKO_IDS) as Asset[]).map(async asset=>{
   const j=await (await fetch(`${COINGECKO}/coins/${COINGECKO_IDS[asset]}/market_chart?vs_currency=usd&days=1`)).json() as {prices?:[number,number][]};
   for(const [at,usd] of j.prices??[])if(typeof at==='number'&&typeof usd==='number')addSample(asset,{at,usd});
  }));
 }
 async function fetchPrices(){
  try{const j=await (await fetch(`${COINGECKO}/simple/price?ids=tether,usd-coin&vs_currencies=usd&precision=6`)).json() as Record<string,{usd?:number}>;const at=Date.now();
   if(typeof j.tether?.usd==='number')addSample('USDT',{at,usd:j.tether.usd});
   if(typeof j['usd-coin']?.usd==='number')addSample('USDC',{at,usd:j['usd-coin'].usd});
  }catch{/* keep the series we have */}
 }
 function priceAt(asset:Asset,t:number):Sample|null{
  const arr=series[asset];if(!arr.length)return null;
  let lo=0,hi=arr.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(arr[mid].at<t)lo=mid+1;else hi=mid;}
  const cands=[arr[lo],arr[lo-1]].filter(Boolean) as Sample[];
  const best=cands.sort((a,b)=>Math.abs(a.at-t)-Math.abs(b.at-t))[0];
  return best&&Math.abs(best.at-t)<=PRICE_TOLERANCE_MS?best:null;
 }

 /* ---------- Decoding + classification ---------- */
 function toTransfer(log:EvmLog,blockTime:number):Transfer|null{
  if(log.removed||log.topics.length!==3||log.topics[0].toLowerCase()!==ERC20_TRANSFER_TOPIC)return null;
  const contract=log.address.toLowerCase(),asset=CONTRACTS.Ethereum[contract];if(!asset)return null;
  if(!/^0x[0-9a-fA-F]{64}$/.test(log.data))return null;
  const amountAtomic=BigInt(log.data),denom=BigInt(1000000),amount=`${amountAtomic/denom}.${(amountAtomic%denom).toString().padStart(6,'0')}`;
  const sender='0x'+log.topics[1].slice(-40).toLowerCase(),receiver='0x'+log.topics[2].slice(-40).toLowerCase();
  const senderEntity:Attribution=knownAttribution(sender)??UNKNOWN,receiverEntity:Attribution=knownAttribution(receiver)??UNKNOWN;
  const price=priceAt(asset,blockTime);
  const evidenced=[senderEntity,receiverEntity].filter(a=>a!==UNKNOWN).map(a=>a.entity);
  const known=evidenced.length>0;
  const tx:Transfer={id:`Ethereum:${log.transactionHash}:${parseInt(log.logIndex,16)}`,chain:'Ethereum',transactionId:log.transactionHash,eventIndex:String(parseInt(log.logIndex,16)),blockNumber:parseInt(log.blockNumber,16),blockHash:log.blockHash,blockTime,finality:'confirmed',asset,tokenContract:contract,amount,amountAtomic:amountAtomic.toString(),
   usdValue:price?Number(amount)*price.usd:null,usdPrice:price?.usd??null,priceTime:price?.at??null,usdPriceSource:price?'CoinGecko public API, 5-minute market sample nearest to block time':'Price unavailable for this block time',
   sender,receiver,senderEntity,receiverEntity,
   economicClass:known?'exchange flow':'unknown',adjustment:'unresolved',
   classificationRationale:known?`Transfer touches a publicly documented exchange wallet (${evidenced.join(', ')}). Classified as exchange flow; the cited evidence is attached to each endpoint.`:'Economic purpose is unverified.',
   classificationVersion:'1.0',flags:{mintBurn:ZERO.test(sender)||ZERO.test(receiver),bridge:false,internalTransfer:false,crossBorderCandidate:false,bot:false},synthetic:false};
  return classify(tx);
 }
 function store(t:Transfer){
  if(t.flags.crossBorderCandidate)full.push(t);
  else slim.push({id:t.id,blockTime:t.blockTime,usdValue:t.usdValue,economicClass:t.economicClass,adjustment:t.adjustment,senderEntity:t.senderEntity,receiverEntity:t.receiverEntity,synthetic:false});
 }
 function dropBefore<T extends {blockTime:number}>(arr:T[],cutoff:number){let i=0;while(i<arr.length&&arr[i].blockTime<cutoff)i++;if(i)arr.splice(0,i);}
 function prune(){const cutoff=Date.now()-RETENTION_MS;dropBefore(full,cutoff);dropBefore(slim,cutoff);}
 function* events():Iterable<Transfer|TotalsInput>{yield* full;yield* slim;}

 /* ---------- Backfill the preceding hour, then poll ---------- */
 async function backfill(){
  tip=parseInt(await rpc<string>('eth_blockNumber',[]),16);
  const end=tip-TIP_LAG,start=Math.max(0,end-BACKFILL_BLOCKS+1);
  const bounds:number[]=[];for(let n=start;n<end;n+=BACKFILL_CHUNK)bounds.push(n);bounds.push(end);
  let times:Map<number,number>|null=null;
  try{const heads=await rpcBatch<Header>(bounds.map(n=>({method:'eth_getBlockByNumber',params:[hex(n),false]})));times=new Map();bounds.forEach((n,i)=>{const h=heads[i];if(h?.timestamp)times!.set(n,parseInt(h.timestamp,16)*1000);});}catch{times=null;}
  const endTime=times?.get(end)??Date.now();
  const timeOf=(n:number)=>{
   if(times){for(let i=0;i<bounds.length-1;i++){const lo=bounds[i],hi=bounds[i+1];if(n>=lo&&n<=hi){const a=times.get(lo),b=times.get(hi);if(a!==undefined&&b!==undefined&&hi>lo)return Math.round(a+(b-a)*(n-lo)/(hi-lo));break;}}}
   return endTime-(end-n)*SLOT_MS;
  };
  const chunks:[number,number][]=[];for(let n=start;n<=end;n+=BACKFILL_CHUNK)chunks.push([n,Math.min(end,n+BACKFILL_CHUNK-1)]);
  backfillState={done:0,total:end-start+1};state='BACKFILLING';emit();
  const results:(EvmLog[]|null)[]=chunks.map(()=>null);let next=0,cursor=0;
  const fetchChunk=async([from,to]:[number,number]):Promise<EvmLog[]>=>{
   try{return await getLogs(from,to);}catch{
    try{return await getLogs(from,to);}catch{const mid=Math.floor((from+to)/2);if(mid<=from)throw Error('chunk failed');return [...await getLogs(from,mid),...await getLogs(mid+1,to)];}
   }
  };
  const commit=()=>{
   while(next<chunks.length&&results[next]){
    for(const log of results[next]!){const t=toTransfer(log,timeOf(parseInt(log.blockNumber,16)));if(t)store(t);}
    backfillState={done:chunks[next][1]-start+1,total:end-start+1};next++;emit();
   }
  };
  const worker=async()=>{while(cursor<chunks.length){const i=cursor++;try{results[i]=await fetchChunk(chunks[i]);}catch{results[i]=[];}commit();}};
  await Promise.all(Array.from({length:BACKFILL_CONCURRENCY},()=>worker()));
  lastBlock=end;lastReceived=Date.now();backfillState=null;prune();state='LIVE';emit();
 }
 async function poll(){
  if(polling)return;polling=true;
  try{
   tip=parseInt(await rpc<string>('eth_blockNumber',[]),16);
   const target=tip-TIP_LAG;
   if(lastBlock===null)lastBlock=Math.max(0,target-LIVE_BLOCK_RANGE);
   if(target<=lastBlock){state='LIVE';return;}
   const from=lastBlock+1,to=Math.min(target,from+((target-lastBlock)>LIVE_BLOCK_RANGE?CATCHUP_BLOCK_RANGE:LIVE_BLOCK_RANGE)-1);
   const logs=await getLogs(from,to);
   const blockIds=[...new Set(logs.map(l=>l.blockNumber))],times=new Map<string,number>();
   if(blockIds.length){const heads=await rpcBatch<Header>(blockIds.map(id=>({method:'eth_getBlockByNumber',params:[id,false]})));blockIds.forEach((id,i)=>{const h=heads[i];times.set(id,h?.timestamp?parseInt(h.timestamp,16)*1000:Date.now());});}
   for(const log of logs){const t=toTransfer(log,times.get(log.blockNumber)??Date.now());if(t)store(t);}
   lastBlock=to;lastReceived=Date.now();prune();state=to===target?'LIVE':'CATCHING UP';
  }catch{state=failures>3?'RECONNECTING':'CONNECTING';}
  finally{polling=false;emit();}
 }

 /* ---------- Snapshots ---------- */
 function build(window:WindowKey,chain:string,at:number):Snapshot{
  const s=aggregate(chain==='All chains'||chain==='Ethereum'?events():[],window,at,'production');
  s.health=state==='LIVE'?'LIVE':state==='RECONNECTING'?'RECONNECTING':state==='CONNECTING'?'NOT CONNECTED':'DELAYED';
  s.lastReceived=lastReceived;
  const bf=backfillState?` Loading the preceding hour: ${backfillState.done.toLocaleString()} of ${backfillState.total.toLocaleString()} blocks.`:'';
  s.message=`Live from a public Ethereum node, read directly by your browser (no server, no database).${tip?` At block ${tip.toLocaleString()}.`:''}${bf} The preceding hour is backfilled on load; block times inside it are interpolated between fetched headers (about ±12 s). Only the 5M and 1H windows are available in this build; 24H, 7D and historical baselines need the persistent backend. Routes are drawn only between publicly evidenced wallets in different jurisdictions. Single-evidenced activity lights up its jurisdiction without drawing a route.`;
  const status=state==='LIVE'?'LIVE':state==='BACKFILLING'?'Backfilling':state==='CATCHING UP'?'Delayed':state==='RECONNECTING'?'Reconnecting':'Connecting';
  s.chainHealth=CHAINS.map(c=>c==='Ethereum'?{chain:c,status,lastReceived}:{chain:c,status:'Not connected',lastReceived:null});
  return s;
 }
 function emit(){if(typeof document!=='undefined'&&document.hidden)return;const now=Date.now();for(const l of listeners)l.cb(build(l.window,l.chain,now));}

 (async()=>{
  await Promise.allSettled([fetchPriceSeries(),fetchPrices()]);
  try{await backfill();}catch{backfillState=null;state='CONNECTING';}
  setInterval(poll,POLL_MS);void poll();
 })();
 setInterval(fetchPrices,PRICE_MS);setInterval(emit,TICK_MS);
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!document.hidden)emit();});

 instance={
  windows:['5M','1H'],defaultWindow:'1H',retentionMs:RETENTION_MS,rawEventMinUsd:500000,
  subscribe(window,chain,cb){const l={window,chain,cb};listeners.add(l);cb(build(window,chain,Date.now()));return()=>{listeners.delete(l);};},
  snapshotAt(window,chain,at){return build(window,chain,at);},
  range(){const now=Date.now();const earliest=Math.min(full[0]?.blockTime??now,slim[0]?.blockTime??now);return{start:Math.max(now-RETENTION_MS,earliest),end:now};},
  progress(){return backfillState;}
 };
 return instance;
}
