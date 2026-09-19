/**
 * Browser-side live data source. Runs entirely in the visitor's browser against free public
 * endpoints, with no server and no database: the same architecture as a single-file market widget.
 * It reuses the project's real classification and aggregation code (engine.ts), so totals, corridor
 * ranking and the accounting panel are computed exactly as the production backend would compute them;
 * the only difference is memory. On load it backfills the preceding hour, then polls for new blocks.
 * Nothing survives a page reload, so only the 5M and 1H windows are offered and baselines stay null.
 *
 * Deposit-address inference (approved 2026-09-18, clearly labelled): exchange customers do not send to
 * an exchange's hot wallet, they send to a per-customer deposit address that the exchange later sweeps
 * into its hot wallet. Within the retained buffer, an unlabelled address whose ONLY outgoing transfers
 * go to one registry entity, after receiving from somewhere else, and which forwarded most of what it
 * received, is treated as that entity's deposit address. Such evidence is marked INFERRED in its
 * category, source and note, cites the sweep transaction, and is never persisted.
 */
import {CHAINS,UNKNOWN,type Snapshot,type Transfer,type WindowKey,type Attribution,type Asset} from './model';
import {aggregate,classify,type TotalsInput} from './engine';
import {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog} from './evm';
import {knownAttribution,ENTITIES} from './known-entities';

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
 /** Number of deposit addresses currently inferred from observed sweeps. */
 inferredCount():number;
}

// Free, key-less, browser-callable (CORS) endpoints that serve 25-block eth_getLogs, probed 2026-09-18. Order = preference.
const RPC_ENDPOINTS=['https://eth-pokt.nodies.app','https://eth.drpc.org','https://rpc.mevblocker.io','https://1rpc.io/eth'];
const COINGECKO='https://api.coingecko.com/api/v3';
const COINGECKO_IDS:Record<Asset,string>={USDT:'tether',USDC:'usd-coin'};
const POLL_MS=20000,PRICE_MS=120000,TICK_MS=8000;
const LIVE_BLOCK_RANGE=6,CATCHUP_BLOCK_RANGE=25,BACKFILL_BLOCKS=300,BACKFILL_CHUNK=25,BACKFILL_CONCURRENCY=1,TIP_LAG=1,BATCH_LIMIT=3,RPC_ATTEMPTS=4,RPC_STRIKES=2;
const RETENTION_MS=90*60000,PRICE_TOLERANCE_MS=600000,SLOT_MS=12000;
const INFER_FORWARD_SHARE=.8; // a deposit address forwards (nearly) everything it received
const ZERO=/^0x0{40}$/;
const TOKEN_BY_ASSET=Object.fromEntries(Object.entries(CONTRACTS.Ethereum).map(([addr,asset])=>[asset,addr])) as Record<Asset,string>;
type State='CONNECTING'|'BACKFILLING'|'LIVE'|'CATCHING UP'|'RECONNECTING';
type Sample={at:number;usd:number};
type Header={timestamp:string}|null;
/** Compact per-event record: enough to rebuild a Transfer when evidence changes, plus the TotalsInput fields aggregate() reads. */
interface Rec extends TotalsInput {transactionId:string;eventIndex:string;blockNumber:number;blockHash:string;asset:Asset;amount:string;amountAtomic:string;usdPrice:number|null;priceTime:number|null;sender:string;receiver:string;tx?:Transfer;}
const hex=(n:number)=>'0x'+n.toString(16);

let instance:LiveSource|null=null;
export function createLiveSource():LiveSource{
 if(instance)return instance;
 let rpcIndex=0,failures=0,lastBlock:number|null=null,tip=0,state:State='CONNECTING',lastReceived:number|null=null,polling=false;
 let backfillState:{done:number;total:number}|null=null;
 const series:Record<Asset,Sample[]>={USDT:[],USDC:[]};
 const buffer:Rec[]=[];
 const inferred=new Map<string,Attribution>();
 const listeners=new Set<{window:WindowKey;chain:string;cb:(s:Snapshot)=>void}>();

 /* ---------- JSON-RPC ---------- */
 const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
 let endpointStrikes=0;
 /** One request with retries. Free public endpoints intermittently answer "can't route" or 429; those are retried on the same endpoint with backoff, and the endpoint is rotated only after repeated failures. */
 async function post(body:unknown):Promise<unknown>{
  let lastErr:unknown=null;
  for(let attempt=0;attempt<RPC_ATTEMPTS;attempt++){
   const url=RPC_ENDPOINTS[rpcIndex];
   try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const text=await res.text();
    let json:unknown=null;try{json=JSON.parse(text);}catch{json=null;}
    const transient=res.status===429||res.status>=500||(json!==null&&!Array.isArray(json)&&typeof (json as {error?:unknown}).error==='object'&&(json as {error:{code?:number}}).error?.code===12);
    if(!res.ok&&!(json&&transient)){console.warn(`[ledger-atlas live] ${url} HTTP ${res.status} → ${text.slice(0,160)}`);throw Error(`HTTP ${res.status}`);}
    if(transient){lastErr=Error(`transient ${res.status}`);endpointStrikes++;if(endpointStrikes>=RPC_STRIKES){rpcIndex=(rpcIndex+1)%RPC_ENDPOINTS.length;endpointStrikes=0;}await sleep(400*(attempt+1));continue;}
    failures=0;endpointStrikes=0;return json;
   }catch(err){
    lastErr=err;endpointStrikes++;
    if(endpointStrikes>=RPC_STRIKES){rpcIndex=(rpcIndex+1)%RPC_ENDPOINTS.length;endpointStrikes=0;}
    await sleep(400*(attempt+1));
   }
  }
  failures++;throw lastErr??Error('RPC failed');
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
 const seriesLoaded:Record<Asset,boolean>={USDT:false,USDC:false};
 /** CoinGecko's public API rate-limits bursts (429 without CORS headers); fetch the two series sequentially with retries, and re-price anything left unpriced once a series arrives. */
 async function fetchPriceSeries(){
  for(const asset of Object.keys(COINGECKO_IDS) as Asset[]){
   if(seriesLoaded[asset])continue;
   for(let attempt=0;attempt<3&&!seriesLoaded[asset];attempt++){
    try{
     const res=await fetch(`${COINGECKO}/coins/${COINGECKO_IDS[asset]}/market_chart?vs_currency=usd&days=1`,{signal:AbortSignal.timeout(10000)});
     if(!res.ok)throw Error(`HTTP ${res.status}`);
     const j=await res.json() as {prices?:[number,number][]};
     for(const [at,usd] of j.prices??[])if(typeof at==='number'&&typeof usd==='number')addSample(asset,{at,usd});
     seriesLoaded[asset]=(j.prices?.length??0)>0;
    }catch{await sleep(1500*(attempt+1));}
   }
  }
  repriceUnpriced();
 }
 function repriceUnpriced(){
  let changed=0;
  for(const r of buffer){
   if(r.usdValue!==null)continue;
   const p=priceAt(r.asset,r.blockTime);if(!p)continue;
   r.usdValue=Number(r.amount)*p.usd;r.usdPrice=p.usd;r.priceTime=p.at;
   if(r.tx){r.tx.usdValue=r.usdValue;r.tx.usdPrice=r.usdPrice;r.tx.priceTime=r.priceTime;r.tx.usdPriceSource='CoinGecko public API, 5-minute market sample nearest to block time';}
   changed++;
  }
  if(changed&&!backfillState){inferDeposits();emit();}
 }
 async function fetchPrices(){
  try{const j=await (await fetch(`${COINGECKO}/simple/price?ids=tether,usd-coin&vs_currencies=usd&precision=6`,{signal:AbortSignal.timeout(10000)})).json() as Record<string,{usd?:number}>;const at=Date.now();
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

 /* ---------- Evidence, decoding, classification ---------- */
 const attributionFor=(address:string):Attribution=>knownAttribution(address)??inferred.get(address)??UNKNOWN;
 function makeTransfer(r:Rec):Transfer{
  const senderEntity=attributionFor(r.sender),receiverEntity=attributionFor(r.receiver);
  const evidenced=[senderEntity,receiverEntity].filter(a=>a!==UNKNOWN).map(a=>a.entity);
  const known=evidenced.length>0;
  const tx:Transfer={id:r.id,chain:'Ethereum',transactionId:r.transactionId,eventIndex:r.eventIndex,blockNumber:r.blockNumber,blockHash:r.blockHash,blockTime:r.blockTime,finality:'confirmed',asset:r.asset,tokenContract:TOKEN_BY_ASSET[r.asset],amount:r.amount,amountAtomic:r.amountAtomic,
   usdValue:r.usdValue,usdPrice:r.usdPrice,priceTime:r.priceTime,usdPriceSource:r.usdPrice!==null?'CoinGecko public API, 5-minute market sample nearest to block time':'Price unavailable for this block time',
   sender:r.sender,receiver:r.receiver,senderEntity,receiverEntity,
   economicClass:known?'exchange flow':'unknown',adjustment:'unresolved',
   classificationRationale:known?`Transfer touches a publicly documented exchange wallet (${evidenced.join(', ')}). Classified as exchange flow; the cited evidence is attached to each endpoint.`:'Economic purpose is unverified.',
   classificationVersion:'1.0',flags:{mintBurn:ZERO.test(r.sender)||ZERO.test(r.receiver),bridge:false,internalTransfer:false,crossBorderCandidate:false,bot:false},synthetic:false};
  return classify(tx);
 }
 /** (Re)derive the classification fields of a record from current evidence. */
 function classifyRec(r:Rec){
  const tx=makeTransfer(r);
  r.economicClass=tx.economicClass;r.adjustment=tx.adjustment;r.senderEntity=tx.senderEntity;r.receiverEntity=tx.receiverEntity;
  r.tx=tx.flags.crossBorderCandidate?tx:undefined;
 }
 function toRec(log:EvmLog,blockTime:number):Rec|null{
  if(log.removed||log.topics.length!==3||log.topics[0].toLowerCase()!==ERC20_TRANSFER_TOPIC)return null;
  const asset=CONTRACTS.Ethereum[log.address.toLowerCase()];if(!asset)return null;
  if(!/^0x[0-9a-fA-F]{64}$/.test(log.data))return null;
  const amountAtomic=BigInt(log.data),denom=BigInt(1000000),amount=`${amountAtomic/denom}.${(amountAtomic%denom).toString().padStart(6,'0')}`;
  const price=priceAt(asset,blockTime);
  const r:Rec={id:`Ethereum:${log.transactionHash}:${parseInt(log.logIndex,16)}`,transactionId:log.transactionHash,eventIndex:String(parseInt(log.logIndex,16)),blockNumber:parseInt(log.blockNumber,16),blockHash:log.blockHash,blockTime,asset,amount,amountAtomic:amountAtomic.toString(),
   usdValue:price?Number(amount)*price.usd:null,usdPrice:price?.usd??null,priceTime:price?.at??null,
   sender:'0x'+log.topics[1].slice(-40).toLowerCase(),receiver:'0x'+log.topics[2].slice(-40).toLowerCase(),
   economicClass:'unknown',adjustment:'unresolved',senderEntity:UNKNOWN,receiverEntity:UNKNOWN,synthetic:false};
  classifyRec(r);return r;
 }
 function prune(){const cutoff=Date.now()-RETENTION_MS;let i=0;while(i<buffer.length&&buffer[i].blockTime<cutoff)i++;if(i)buffer.splice(0,i);}
 function* events():Iterable<Transfer|TotalsInput>{for(const r of buffer)yield r.tx??r;}

 /* ---------- Deposit-address inference from observed sweeps ---------- */
 function inferDeposits(){
  type Flow={ins:Rec[];outs:Rec[]};
  const byAddr=new Map<string,Flow>();
  const touch=(a:string)=>{let f=byAddr.get(a);if(!f){f={ins:[],outs:[]};byAddr.set(a,f);}return f;};
  for(const r of buffer){
   if(!knownAttribution(r.sender)&&!inferred.has(r.sender)&&!ZERO.test(r.sender))touch(r.sender).outs.push(r);
   if(!knownAttribution(r.receiver)&&!inferred.has(r.receiver)&&!ZERO.test(r.receiver))touch(r.receiver).ins.push(r);
  }
  const changed=new Set<string>();
  for(const [addr,f] of byAddr){
   if(!f.outs.length||!f.ins.length)continue;
   let cluster:string|null=null,ok=true;
   for(const o of f.outs){const k=knownAttribution(o.receiver);if(!k){ok=false;break;}if(cluster===null)cluster=k.addressCluster;else if(cluster!==k.addressCluster){ok=false;break;}}
   if(!ok||!cluster)continue;
   const ent=ENTITIES[cluster];if(!ent)continue;
   const external=f.ins.filter(i=>knownAttribution(i.sender)?.addressCluster!==cluster);
   if(!external.length)continue;
   const firstOut=f.outs.reduce((a,b)=>a.blockTime<b.blockTime?a:b),firstIn=external.reduce((a,b)=>a.blockTime<b.blockTime?a:b);
   if(firstIn.blockTime>firstOut.blockTime)continue;
   const totalIn=external.reduce((s,i)=>s+(i.usdValue??0),0),totalOut=f.outs.reduce((s,o)=>s+(o.usdValue??0),0);
   if(!(totalIn>0)||totalOut<INFER_FORWARD_SHARE*totalIn)continue;
   const sweepLabel=knownAttribution(firstOut.receiver);
   const earliest=Math.min(firstIn.blockTime,firstOut.blockTime);
   inferred.set(addr,{entity:ent.name,addressCluster:ent.id,category:'exchange deposit address (INFERRED)',jurisdiction:ent.jurisdiction,confidence:'HIGH',score:.8,
    source:`INFERRED from an observed deposit sweep, not a published label: this address forwarded its balance to ${ent.name}'s labelled wallet (${sweepLabel?.evidenceNote.split('(')[0].replace('Etherscan labels this address ','').trim()??'registry wallet'})`,
    sourceUrl:`https://etherscan.io/tx/${firstOut.transactionId}`,
    evidenceNote:`INFERRED. Within this session the address received ${external.length} transfer(s) from outside ${ent.name} and then sent ${Math.round(totalOut/totalIn*100)}% of that value to ${ent.name}'s labelled wallet ${firstOut.receiver} in transaction ${firstOut.transactionId}. Exchange deposit addresses are exchange-controlled, so the jurisdiction is ${ent.name}'s (${ent.jurisdiction}); this is inference from on-chain behaviour and is not persisted.`,
    lastVerified:new Date(earliest).toISOString(),association:'operating entity',synthetic:false});
   changed.add(addr);
  }
  if(changed.size)for(const r of buffer)if(changed.has(r.sender)||changed.has(r.receiver))classifyRec(r);
  // Drop inferred addresses that have aged out of the buffer entirely.
  const live=new Set<string>();for(const r of buffer){live.add(r.sender);live.add(r.receiver);}
  for(const a of [...inferred.keys()])if(!live.has(a))inferred.delete(a);
 }

 /* ---------- Backfill the preceding hour, then poll ---------- */
 async function backfill(){
  tip=parseInt(await rpc<string>('eth_blockNumber',[]),16);
  const end=tip-TIP_LAG,start=Math.max(0,end-BACKFILL_BLOCKS+1);
  const bounds:number[]=[];for(let n=start;n<end;n+=BACKFILL_CHUNK*2)bounds.push(n);bounds.push(end);
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
    const mid=Math.floor((from+to)/2);if(mid<=from)throw Error('chunk failed');return [...await getLogs(from,mid),...await getLogs(mid+1,to)];
   }
  };
  const commit=()=>{
   while(next<chunks.length&&results[next]){
    for(const log of results[next]!){const r=toRec(log,timeOf(parseInt(log.blockNumber,16)));if(r)buffer.push(r);}
    backfillState={done:chunks[next][1]-start+1,total:end-start+1};next++;emit();
   }
  };
  const worker=async()=>{while(cursor<chunks.length){const i=cursor++;try{results[i]=await fetchChunk(chunks[i]);}catch{results[i]=[];}commit();}};
  await Promise.all(Array.from({length:BACKFILL_CONCURRENCY},()=>worker()));
  lastBlock=end;lastReceived=Date.now();backfillState=null;prune();inferDeposits();state='LIVE';emit();
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
   for(const log of logs){const r=toRec(log,times.get(log.blockNumber)??Date.now());if(r)buffer.push(r);}
   lastBlock=to;lastReceived=Date.now();prune();inferDeposits();state=to===target?'LIVE':'CATCHING UP';
  }catch{state=failures>3?'RECONNECTING':'CONNECTING';}
  finally{polling=false;emit();}
 }

 /* ---------- Snapshots ---------- */
 function build(window:WindowKey,chain:string,at:number):Snapshot{
  const s=aggregate(chain==='All chains'||chain==='Ethereum'?events():[],window,at,'production');
  s.health=state==='LIVE'?'LIVE':state==='RECONNECTING'?'RECONNECTING':state==='CONNECTING'?'NOT CONNECTED':'DELAYED';
  s.lastReceived=lastReceived;
  const bf=backfillState?` Loading the preceding hour: ${backfillState.done.toLocaleString()} of ${backfillState.total.toLocaleString()} blocks.`:'';
  s.message=`Live from a public Ethereum node, read directly by your browser (no server, no database).${tip?` At block ${tip.toLocaleString()}.`:''}${bf} The preceding hour is backfilled on load; block times inside it are interpolated between fetched headers (about ±12 s). Only the 5M and 1H windows are available in this build; 24H, 7D and historical baselines need the persistent backend. Routes are drawn only between evidenced wallets in different jurisdictions. ${inferred.size.toLocaleString()} exchange deposit ${inferred.size===1?'address is':'addresses are'} currently INFERRED from observed sweeps into labelled hot wallets and marked as such in the evidence panel; everything else is a published label. Single-evidenced activity lights up its jurisdiction without drawing a route.`;
  const status=state==='LIVE'?'LIVE':state==='BACKFILLING'?'Backfilling':state==='CATCHING UP'?'Delayed':state==='RECONNECTING'?'Reconnecting':'Connecting';
  s.chainHealth=CHAINS.map(c=>c==='Ethereum'?{chain:c,status,lastReceived}:{chain:c,status:'Not connected',lastReceived:null});
  return s;
 }
 function emit(){const now=Date.now();for(const l of listeners)l.cb(build(l.window,l.chain,now));}

 (async()=>{
  void fetchPriceSeries();void fetchPrices(); // run alongside the backfill; transfers are re-priced when prices land
  try{await backfill();}catch(err){console.warn('[ledger-atlas live] backfill failed',err);backfillState=null;state='CONNECTING';}
  setInterval(poll,POLL_MS);void poll();
 })();
 setInterval(()=>{void fetchPrices();if(!seriesLoaded.USDT||!seriesLoaded.USDC)void fetchPriceSeries();},PRICE_MS);setInterval(emit,TICK_MS);
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!document.hidden)emit();});

 instance={
  windows:['5M','1H'],defaultWindow:'1H',retentionMs:RETENTION_MS,rawEventMinUsd:500000,
  subscribe(window,chain,cb){const l={window,chain,cb};listeners.add(l);cb(build(window,chain,Date.now()));return()=>{listeners.delete(l);};},
  snapshotAt(window,chain,at){return build(window,chain,at);},
  range(){const now=Date.now();const earliest=buffer[0]?.blockTime??now;return{start:Math.max(now-RETENTION_MS,earliest),end:now};},
  progress(){return backfillState;},
  inferredCount(){return inferred.size;}
 };
 return instance;
}
