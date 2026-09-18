/**
 * Browser-side live data source. Runs entirely in the visitor's browser against free public
 * endpoints, with no server and no database: the same architecture as a single-file market widget.
 * It reuses the project's real classification and aggregation code (engine.ts), so totals, corridor
 * ranking and the accounting panel are computed exactly as the production backend would compute them;
 * the only difference is memory. Nothing is remembered beyond ~1 hour or across page loads, so only
 * the 5M and 1H windows are offered. Baselines stay null (the UI already reports that honestly).
 */
import {CHAINS,UNKNOWN,type Snapshot,type Transfer,type WindowKey,type Attribution} from './model';
import {aggregate,classify} from './engine';
import {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog} from './evm';
import {knownAttribution} from './known-entities';

export interface LiveSource {
 /** Windows this source can honestly serve. */
 windows:WindowKey[];
 /** Push snapshots for a window/chain filter until unsubscribed. Emits once immediately. */
 subscribe(window:WindowKey,chain:string,onSnapshot:(s:Snapshot)=>void):()=>void;
 /** Snapshot ending at an arbitrary time, for playback. Empty outside the retained buffer. */
 snapshotAt(window:WindowKey,chain:string,at:number):Snapshot;
}

const RPC_ENDPOINTS=['https://eth.drpc.org','https://1rpc.io/eth'];
const PRICE_URL='https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin&vs_currencies=usd&precision=6';
const POLL_MS=20000,PRICE_MS=120000,TICK_MS=4000,MAX_BLOCK_RANGE=6,RETENTION_MS=66*60000;
const ZERO=/^0x0{40}$/;
type State='CONNECTING'|'LIVE'|'CATCHING UP'|'RECONNECTING';

let instance:LiveSource|null=null;
export function createLiveSource():LiveSource{
 if(instance)return instance;
 let rpcIndex=0,failures=0,lastBlock:number|null=null,tip=0,state:State='CONNECTING',lastReceived:number|null=null;
 const prices:Record<string,{usd:number;at:number}|undefined>={};
 const buffer:Transfer[]=[],seen=new Set<string>();
 const listeners=new Set<{window:WindowKey;chain:string;cb:(s:Snapshot)=>void}>();

 async function rpc<T>(method:string,params:unknown[]):Promise<T>{
  const url=RPC_ENDPOINTS[rpcIndex];
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   const body=await res.json() as {result?:T;error?:{message?:string}};
   if(body.error)throw Error(body.error.message??'RPC error');
   return body.result as T;
  }catch(err){failures++;rpcIndex=(rpcIndex+1)%RPC_ENDPOINTS.length;throw err;}
 }
 async function fetchPrices(){
  try{const j=await (await fetch(PRICE_URL)).json() as Record<string,{usd?:number}>;const at=Date.now();
   if(typeof j.tether?.usd==='number')prices.USDT={usd:j.tether.usd,at};
   if(typeof j['usd-coin']?.usd==='number')prices.USDC={usd:j['usd-coin'].usd,at};
  }catch{/* keep the last known price; never assume a $1 peg */}
 }
 function toTransfer(log:EvmLog,blockTime:number):Transfer|null{
  if(log.removed||log.topics.length!==3||log.topics[0].toLowerCase()!==ERC20_TRANSFER_TOPIC)return null;
  const contract=log.address.toLowerCase(),asset=CONTRACTS.Ethereum[contract];if(!asset)return null;
  if(!/^0x[0-9a-fA-F]{64}$/.test(log.data))return null;
  const amountAtomic=BigInt(log.data),denom=BigInt(1000000),amount=`${amountAtomic/denom}.${(amountAtomic%denom).toString().padStart(6,'0')}`;
  const sender='0x'+log.topics[1].slice(-40).toLowerCase(),receiver='0x'+log.topics[2].slice(-40).toLowerCase();
  const senderEntity:Attribution=knownAttribution(sender)??UNKNOWN,receiverEntity:Attribution=knownAttribution(receiver)??UNKNOWN;
  const price=prices[asset]&&Math.abs(prices[asset]!.at-blockTime)<=600000?prices[asset]!:null;
  const evidenced=[senderEntity,receiverEntity].filter(a=>a!==UNKNOWN).map(a=>a.entity);
  const known=evidenced.length>0;
  const tx:Transfer={id:`Ethereum:${log.transactionHash}:${parseInt(log.logIndex,16)}`,chain:'Ethereum',transactionId:log.transactionHash,eventIndex:String(parseInt(log.logIndex,16)),blockNumber:parseInt(log.blockNumber,16),blockHash:log.blockHash,blockTime,finality:'confirmed',asset,tokenContract:contract,amount,amountAtomic:amountAtomic.toString(),
   usdValue:price?Number(amount)*price.usd:null,usdPrice:price?.usd??null,priceTime:price?.at??null,usdPriceSource:price?'CoinGecko public API, spot price at poll time':'Price unavailable for this block time',
   sender,receiver,senderEntity,receiverEntity,
   economicClass:known?'exchange flow':'unknown',adjustment:'unresolved',
   classificationRationale:known?`Transfer touches a publicly documented exchange wallet (${evidenced.join(', ')}). Classified as exchange flow; the cited evidence is attached to each endpoint.`:'Economic purpose is unverified.',
   classificationVersion:'1.0',flags:{mintBurn:ZERO.test(sender)||ZERO.test(receiver),bridge:false,internalTransfer:false,crossBorderCandidate:false,bot:false},synthetic:false};
  return classify(tx);
 }
 async function poll(){
  try{
   tip=parseInt(await rpc<string>('eth_blockNumber',[]),16);
   if(lastBlock===null)lastBlock=Math.max(0,tip-2);
   if(tip<=lastBlock){setState('LIVE');return;}
   const from=lastBlock+1,to=Math.min(tip,from+MAX_BLOCK_RANGE-1),hex=(n:number)=>'0x'+n.toString(16);
   const logs=await rpc<EvmLog[]>('eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),address:Object.keys(CONTRACTS.Ethereum),topics:[ERC20_TRANSFER_TOPIC]}]);
   const blockIds=[...new Set(logs.map(l=>l.blockNumber))],times=new Map<string,number>();
   await Promise.all(blockIds.map(async id=>{const b=await rpc<{timestamp:string}|null>('eth_getBlockByNumber',[id,false]);times.set(id,b?parseInt(b.timestamp,16)*1000:Date.now());}));
   for(const log of logs){const key=`${log.transactionHash}:${log.logIndex}`;if(seen.has(key))continue;seen.add(key);const t=toTransfer(log,times.get(log.blockNumber)??Date.now());if(t)buffer.push(t);}
   lastBlock=to;lastReceived=Date.now();prune();setState(to===tip?'LIVE':'CATCHING UP');
  }catch{setState(failures>3?'RECONNECTING':'CONNECTING');}
  emit();
 }
 function prune(){const cutoff=Date.now()-RETENTION_MS;while(buffer.length&&buffer[0].blockTime<cutoff)buffer.shift();if(seen.size>20000)seen.clear();}
 function setState(s:State){state=s;}
 function build(window:WindowKey,chain:string,at:number):Snapshot{
  const events=chain==='All chains'||chain==='Ethereum'?buffer:[];
  const s=aggregate(events,window,at,'production');
  s.health=state==='LIVE'?'LIVE':state==='CATCHING UP'?'DELAYED':state==='RECONNECTING'?'RECONNECTING':'NOT CONNECTED';
  s.lastReceived=lastReceived;
  s.message=`Live from a public Ethereum node, read directly by your browser (no server, no database). ${tip?`At block ${tip.toLocaleString()}. `:''}Only the 5M and 1H windows are available in this build; 24H, 7D and historical baselines need the persistent backend. Routes are drawn only between publicly evidenced wallets in different jurisdictions.`;
  s.chainHealth=CHAINS.map(c=>c==='Ethereum'?{chain:c,status:state==='LIVE'?'LIVE':state==='CATCHING UP'?'Delayed':state==='RECONNECTING'?'Reconnecting':'Connecting',lastReceived}:{chain:c,status:'Not connected',lastReceived:null});
  return s;
 }
 function emit(){const now=Date.now();for(const l of listeners)l.cb(build(l.window,l.chain,now));}

 fetchPrices();poll();
 setInterval(fetchPrices,PRICE_MS);setInterval(poll,POLL_MS);setInterval(emit,TICK_MS);

 instance={
  windows:['5M','1H'],
  subscribe(window,chain,cb){const l={window,chain,cb};listeners.add(l);cb(build(window,chain,Date.now()));return()=>{listeners.delete(l);};},
  snapshotAt(window,chain,at){return build(window,chain,at);}
 };
 return instance;
}
