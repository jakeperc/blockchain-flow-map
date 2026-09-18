import {z} from 'zod';
import {CHAINS,UNKNOWN,type Chain,type Asset,type Transfer} from './model';
import {classify} from './engine';
import {bindings,database,persist,resolveAttribution,addressKey} from './store';
import {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog} from './evm';
export {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog};
export const intakeSchema=z.object({chain:z.enum(CHAINS),transactionId:z.string().min(10).max(150),eventIndex:z.string().min(1).max(50),blockNumber:z.number().int().nonnegative(),blockHash:z.string().min(1).max(150),blockTime:z.number().int().positive(),tokenContract:z.string().min(20).max(100),amountAtomic:z.string().regex(/^\d{1,40}$/),sender:z.string().min(10).max(100),receiver:z.string().min(10).max(100),finality:z.enum(['finalized','confirmed']),economicClass:z.enum(['payment','exchange flow','institutional settlement','treasury movement','DeFi','bridge','mint/burn','infrastructure','unknown']).default('unknown'),classificationEvidence:z.string().max(2000).default(''),price:z.object({usd:z.number().positive().finite().max(100),at:z.number().int().positive(),source:z.string().min(3).max(300)}).nullable().default(null)}).strict();
export type Intake=z.infer<typeof intakeSchema>;
export async function normalize(input:Intake):Promise<Transfer>{
 const t=intakeSchema.parse(input),contract=addressKey(t.chain,t.tokenContract),asset=CONTRACTS[t.chain]?.[contract];if(!asset)throw Error('Token contract is not allowlisted');
 if(t.blockTime>Date.now()+30000)throw Error('Future event rejected');
 const amountAtomic=BigInt(t.amountAtomic),denom=BigInt(1000000),amount=`${amountAtomic/denom}.${(amountAtomic%denom).toString().padStart(6,'0')}`;
 const sender=addressKey(t.chain,t.sender),receiver=addressKey(t.chain,t.receiver);
 const [senderEntity,receiverEntity]=await Promise.all([resolveAttribution(t.chain,sender),resolveAttribution(t.chain,receiver)]);
 const price=t.price&&Math.abs(t.price.at-t.blockTime)<=300000?t.price:null;
 const zero=(s:string)=>/^0x0{40}$/.test(s)||/^0{40,42}$/.test(s)||s==='T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
 const knownPurpose=t.economicClass!=='unknown'&&t.classificationEvidence.length>=20;
 const tx:Transfer={id:`${t.chain}:${t.transactionId}:${t.eventIndex}`,chain:t.chain,transactionId:t.transactionId,eventIndex:t.eventIndex,blockNumber:t.blockNumber,blockHash:t.blockHash,blockTime:t.blockTime,finality:t.finality,asset,tokenContract:contract,amount,amountAtomic:t.amountAtomic,usdValue:price?Number(amount)*price.usd:null,usdPrice:price?.usd??null,priceTime:price?.at??null,usdPriceSource:price?.source??'Price unavailable for this block time',sender,receiver,senderEntity,receiverEntity,economicClass:knownPurpose?t.economicClass:'unknown',adjustment:'unresolved',classificationRationale:knownPurpose?t.classificationEvidence:'Economic purpose is unverified.',classificationVersion:'1.0',flags:{mintBurn:zero(sender)||zero(receiver),bridge:knownPurpose&&t.economicClass==='bridge',internalTransfer:false,crossBorderCandidate:false,bot:false},synthetic:false};
 return classify(tx);
}
export function decodeEvmLog(chain:Chain,l:EvmLog,blockTime:number):Intake|null{
 if(l.removed||l.topics.length!==3||l.topics[0].toLowerCase()!==ERC20_TRANSFER_TOPIC||!CONTRACTS[chain]?.[l.address.toLowerCase()])return null;
 if(!/^0x[0-9a-fA-F]{64}$/.test(l.data)||!/^0x[0-9a-fA-F]{64}$/.test(l.topics[1])||!/^0x[0-9a-fA-F]{64}$/.test(l.topics[2]))throw Error('Malformed ERC20 transfer log');
 return {chain,transactionId:l.transactionHash,eventIndex:String(parseInt(l.logIndex,16)),blockNumber:parseInt(l.blockNumber,16),blockHash:l.blockHash,blockTime,tokenContract:l.address.toLowerCase(),amountAtomic:BigInt(l.data).toString(),sender:'0x'+l.topics[1].slice(-40).toLowerCase(),receiver:'0x'+l.topics[2].slice(-40).toLowerCase(),finality:'finalized',economicClass:'unknown',classificationEvidence:'',price:null};
}
async function rpc(url:string,method:string,params:unknown[]):Promise<any>{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(18000)});if(!res.ok)throw Error(`Provider HTTP ${res.status}`);const body=await res.json() as any;if(body.error)throw Error('Provider rejected the request');return body.result;}
async function priceAt(asset:Asset,at:number){const r=await database().prepare('SELECT usd,at,source FROM prices WHERE asset=? AND at BETWEEN ? AND ? ORDER BY ABS(at-?) LIMIT 1').bind(asset,at-300000,at+300000,at).first<{usd:number;at:number;source:string}>();return r??null;}
export function configured(){const e=bindings();return CHAINS.filter(c=>c==='Ethereum'?!!e.ETHEREUM_RPC_URL:c==='Base'?!!e.BASE_RPC_URL:c==='Arbitrum'?!!e.ARBITRUM_RPC_URL:c==='Tron'?!!e.TRONGRID_API_KEY:e.SOLANA_WEBHOOK_ENABLED==='true');}
export async function pollEvm(chain:'Ethereum'|'Base'|'Arbitrum'){
 const e=bindings(),url=chain==='Ethereum'?e.ETHEREUM_RPC_URL:chain==='Base'?e.BASE_RPC_URL:e.ARBITRUM_RPC_URL;if(!url)return{chain,status:'NOT CONNECTED'};
 const db=database();const feed=await db.prepare('SELECT * FROM feeds WHERE chain=?').bind(chain).first<any>();
 const chainId=await rpc(url,'eth_chainId',[]);if(parseInt(chainId,16)!==({Ethereum:1,Base:8453,Arbitrum:42161}[chain]))throw Error('RPC network mismatch');
 const finalized=await rpc(url,'eth_getBlockByNumber',['finalized',false]);if(!finalized?.number)throw Error('Provider lacks finalized-block support');
 const tip=parseInt(finalized.number,16),from=feed?.cursor?Number(feed.cursor)+1:Math.max(0,tip-8),to=Math.min(tip,from+19);
 if(from>to){await db.prepare('UPDATE feeds SET last_received=?,state=? WHERE chain=?').bind(Date.now(),'LIVE',chain).run();return{chain,status:'LIVE',events:0};}
 const logs=await rpc(url,'eth_getLogs',[{fromBlock:'0x'+from.toString(16),toBlock:'0x'+to.toString(16),address:Object.keys(CONTRACTS[chain]),topics:[ERC20_TRANSFER_TOPIC]}]) as EvmLog[];
 const blockIds=[...new Set([...logs.map(l=>l.blockNumber),'0x'+from.toString(16),'0x'+to.toString(16)])];
 const blocks=new Map<string,any>();for(let i=0;i<blockIds.length;i+=4){await Promise.all(blockIds.slice(i,i+4).map(async id=>{const b=await rpc(url,'eth_getBlockByNumber',[id,false]);if(!b)throw Error('Missing finalized block');blocks.set(id,b);}));}
 const events:Transfer[]=[];for(const log of logs){const b=blocks.get(log.blockNumber);if(log.blockHash!==b.hash)throw Error('Inconsistent finalized block hash');const raw=decodeEvmLog(chain,log,parseInt(b.timestamp,16)*1000);if(raw){raw.price=await priceAt(CONTRACTS[chain][raw.tokenContract],raw.blockTime);events.push(await normalize(raw));}}
 const inserted=await persist(events),captured=parseInt(blocks.get('0x'+to.toString(16)).timestamp,16)*1000,start=parseInt(blocks.get('0x'+from.toString(16)).timestamp,16)*1000;
 const state=to===tip?'LIVE':'DELAYED';await db.prepare('INSERT INTO feeds (chain,cursor,last_received,captured_to,coverage_start,state,error) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(chain) DO UPDATE SET cursor=excluded.cursor,last_received=excluded.last_received,captured_to=excluded.captured_to,state=excluded.state,error=NULL WHERE CAST(excluded.cursor AS INTEGER)>=CAST(feeds.cursor AS INTEGER)').bind(chain,String(to),Date.now(),captured,start,state).run();return{chain,status:state,inserted};
}
async function tronAddress(input:string){
 if(input.startsWith('T'))return input;
 let hex=input.replace(/^0x/,'');if(hex.length===40)hex='41'+hex;if(!/^41[0-9a-fA-F]{40}$/.test(hex))throw Error('Invalid Tron address');
 const bytes=Uint8Array.from(hex.match(/../g)!.map(v=>parseInt(v,16))),h1=await crypto.subtle.digest('SHA-256',bytes),h2=new Uint8Array(await crypto.subtle.digest('SHA-256',h1));
 const all=new Uint8Array(25);all.set(bytes);all.set(h2.slice(0,4),21);let n=BigInt('0x'+Array.from(all).map(v=>v.toString(16).padStart(2,'0')).join('')),out='';const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';while(n>BigInt(0)){out=alphabet[Number(n%BigInt(58))]+out;n/=BigInt(58);}for(const b of all){if(b!==0)break;out='1'+out;}return out;
}
export async function pollTron(){
 const key=bindings().TRONGRID_API_KEY;if(!key)return{chain:'Tron',status:'NOT CONNECTED'};
 const db=database(),feed=await db.prepare('SELECT * FROM feeds WHERE chain=?').bind('Tron').first<any>();
 // A bounded fixed range; pagination cursor and range are persisted together.
 const old=feed?.cursor?JSON.parse(feed.cursor):null,start=old?.start??Date.now()-120000,end=old?.end??Date.now()-60000;
 const url=new URL(`https://api.trongrid.io/v1/contracts/${Object.keys(CONTRACTS.Tron)[0]}/events`);url.searchParams.set('event_name','Transfer');url.searchParams.set('only_confirmed','true');url.searchParams.set('min_timestamp',String(start));url.searchParams.set('max_timestamp',String(end));url.searchParams.set('order_by','block_timestamp,asc');url.searchParams.set('limit','200');if(old?.fingerprint)url.searchParams.set('fingerprint',old.fingerprint);
 const response=await fetch(url,{headers:{'TRON-PRO-API-KEY':key},signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('Tron provider unavailable');const body=await response.json() as any;if(!body.success||!Array.isArray(body.data))throw Error('Invalid Tron event response');
 const events:Transfer[]=[];for(const e of body.data){if(e.event_name!=='Transfer'||!Number.isInteger(e.event_index)||!e.transaction_id)throw Error('Tron event lacks stable identity');const from=await tronAddress(e.result.from??e.result._from),to=await tronAddress(e.result.to??e.result._to);const amount=String(e.result.value??e.result._value);const raw:Intake={chain:'Tron',transactionId:e.transaction_id,eventIndex:String(e.event_index),blockNumber:e.block_number,blockHash:`confirmed-height:${e.block_number}`,blockTime:e.block_timestamp,tokenContract:Object.keys(CONTRACTS.Tron)[0],amountAtomic:amount,sender:from,receiver:to,finality:'confirmed',economicClass:'unknown',classificationEvidence:'',price:await priceAt('USDT',e.block_timestamp)};events.push(await normalize(raw));}
 const inserted=await persist(events),more=body.meta?.fingerprint&&body.data.length===200,next=more?{start,end,fingerprint:body.meta.fingerprint}:{start:end+1,end:Date.now()-60000},state=more||Date.now()-end>180000?'DELAYED':'LIVE';
 await db.prepare('INSERT INTO feeds (chain,cursor,last_received,captured_to,coverage_start,state,error) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(chain) DO UPDATE SET cursor=excluded.cursor,last_received=excluded.last_received,captured_to=excluded.captured_to,state=excluded.state,error=NULL').bind('Tron',JSON.stringify(next),Date.now(),more?(feed?.captured_to??start):end,feed?.coverage_start??start,state).run();return{chain:'Tron',status:state,inserted};
}
