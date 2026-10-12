/**
 * Pure core of the browser live client: decoding, pricing, block-time interpolation, chunk planning,
 * retention and deposit-address inference. No fetch, no DOM, no timers, no module-level state — every
 * dependency arrives as an argument, so `scripts/verify-live.cjs` can exercise the parts of the live
 * path that carry methodological weight. `live-client.ts` keeps transport, the state machine and
 * subscriptions and calls into here.
 */
import {UNKNOWN,type Attribution,type Asset,type Chain,type Transfer} from './model';
import {classify,type TotalsInput} from './engine';
import {ERC20_TRANSFER_TOPIC,type EvmLog} from './evm';
import {isZeroAddress,recordAddress} from './tron';

export type Sample={at:number;usd:number;source:string};
/** Compact per-event record: enough to rebuild a Transfer when evidence changes, plus the TotalsInput fields aggregate() reads. */
export interface Rec extends TotalsInput {
 chain:Chain;transactionId:string;eventIndex:string;blockNumber:number;blockHash:string;
 asset:Asset;tokenContract:string;amount:string;amountAtomic:string;
 usdPrice:number|null;priceTime:number|null;priceSource:string|null;sender:string;receiver:string;
 /** Which feed produced this record: the registry-filtered settlement feed, or the unfiltered denominator sample. */
 feed:'evidenced'|'sample';
 tx?:Transfer;
}
/** Token metadata a decoder needs, independent of how evm.ts happens to store it. */
export interface TokenInfo {asset:Asset;decimals:number}
export type Lookup=(chain:Chain,address:string)=>Attribution|null;

export const addressKey=(chain:Chain,address:string)=>`${chain}:${chain==='Tron'||chain==='Solana'?address:address.toLowerCase()}`;

/** Exact decimal string from an atomic integer. BigInt throughout: amounts routinely exceed 2^53. */
export function formatAmount(atomic:bigint,decimals:number):string{
 if(decimals<=0)return atomic.toString();
 const denom=BigInt(10)**BigInt(decimals); // literal form needs ES2020; this project targets ES2017

 const whole=atomic/denom,frac=(atomic%denom).toString().padStart(decimals,'0');
 return `${whole}.${frac}`;
}

/** Nearest sample within tolerance, or null. Never falls back to an assumed $1 peg, and never returns a stale sample. */
export function priceAt(series:Sample[],t:number,toleranceMs:number):Sample|null{
 if(!series.length)return null;
 let lo=0,hi=series.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(series[mid].at<t)lo=mid+1;else hi=mid;}
 const cands=[series[lo],series[lo-1]].filter(Boolean) as Sample[];
 const best=cands.sort((a,b)=>Math.abs(a.at-t)-Math.abs(b.at-t))[0];
 return best&&Math.abs(best.at-t)<=toleranceMs?best:null;
}

/** Insert a sample keeping the series sorted and bounded. Mutates and returns the array. */
export function addSample(series:Sample[],s:Sample,cutoff:number):Sample[]{
 series.push(s);
 if(series.length>1&&series[series.length-2].at>s.at)series.sort((a,b)=>a.at-b.at);
 let i=0;while(i<series.length&&series[i].at<cutoff)i++;
 if(i)series.splice(0,i);
 return series;
}

/**
 * Block-time function over a backfilled range. Exact at fetched boundary headers, linearly interpolated
 * between them, and falling back to the chain's slot time when no header was obtained.
 */
export function makeBlockTimeFn(bounds:number[],times:Map<number,number>|null,end:number,endTime:number,slotMs:number):(n:number)=>number{
 return (n:number)=>{
  if(times){
   for(let i=0;i<bounds.length-1;i++){
    const lo=bounds[i],hi=bounds[i+1];
    if(n>=lo&&n<=hi){
     const a=times.get(lo),b=times.get(hi);
     if(a!==undefined&&b!==undefined&&hi>lo)return Math.round(a+(b-a)*(n-lo)/(hi-lo));
     break;
    }
   }
   const exact=times.get(n);if(exact!==undefined)return exact;
  }
  return endTime-(end-n)*slotMs;
 };
}

/** Inclusive block ranges covering [start,end] exactly once. */
export function planChunks(start:number,end:number,size:number):[number,number][]{
 const out:[number,number][]=[];
 if(size<1||end<start)return out;
 for(let n=start;n<=end;n+=size)out.push([n,Math.min(end,n+size-1)]);
 return out;
}

/**
 * The block-time interval a successful read of blocks [from,to] observed, and where it leaves the next read. Reading block n
 * observes the chain over (time(n-1), time(n)], so a read that starts at the block after the previous read claims the time
 * since that read ended, and consecutive reads tile with no gap. Until 2026-10-12 each read claimed time(to)-time(from),
 * one block short: on Ethereum, with 12 s blocks polled every 20 s, a poll often reads a single block and claimed nothing,
 * so a tab left running recorded about 40% of the time it actually watched, and 24H, which needs 80% on its least-covered
 * chain, could never unlock. A read that does not follow the previous one (the first, or after a failed range) claims one
 * block's time before `from`, never the gap.
 */
export function readInterval(prev:{block:number;time:number}|null,from:number,to:number,timeOf:(n:number)=>number):{from:number;to:number;next:{block:number;time:number}}{
 const start=prev&&prev.block===from-1?prev.time:timeOf(from-1);
 const end=Math.max(start,timeOf(to));
 return {from:start,to:end,next:{block:to,time:end}};
}

/**
 * The inclusive range a live poll reads next, null when there is nothing new, or 'rejoin' when the feed has fallen
 * more than its backfilled hour behind. A sleeping computer, a tab the browser froze or a lost network stops every
 * poll, and on waking the feed can be days behind. Crawling forward one catch-up range per poll then takes hours on
 * Arbitrum or Ethereum, and every block it reads is older than the buffer keeps, so each transfer is pruned the
 * moment it lands and the map shows nothing until the crawl ends. Rejoining re-reads the latest hour the way a page
 * load does; the skipped stretch was never observed and recorded history counts it as the gap it was.
 */
export function nextPollRange(lastBlock:number,target:number,cfg:{blocks:number;liveRange:number;catchupRange:number}):[number,number]|'rejoin'|null{
 if(target<=lastBlock)return null;
 const behind=target-lastBlock;
 if(behind>cfg.blocks)return 'rejoin';
 const from=lastBlock+1;
 return [from,Math.min(target,from+(behind>cfg.liveRange?cfg.catchupRange:cfg.liveRange)-1)];
}

/** Records at or after the cutoff. Returns a new array: a filter rather than a head-walk, so one out-of-order insert cannot stop retention forever. */
export function pruneRecords(records:Rec[],cutoff:number):Rec[]{
 return records.filter(r=>r.blockTime>=cutoff);
}

/** Build a classified Transfer from a record using the supplied evidence lookup. */
export function makeTransfer(r:Rec,attributionFor:(chain:Chain,address:string)=>Attribution):Transfer{
 const senderEntity=attributionFor(r.chain,r.sender),receiverEntity=attributionFor(r.chain,r.receiver);
 const evidenced=[senderEntity,receiverEntity].filter(a=>a!==UNKNOWN).map(a=>a.entity);
 const known=evidenced.length>0;
 const priced=r.usdPrice!==null;
 const tx:Transfer={
  id:r.id,chain:r.chain,transactionId:r.transactionId,eventIndex:r.eventIndex,blockNumber:r.blockNumber,blockHash:r.blockHash,blockTime:r.blockTime,
  finality:'confirmed',asset:r.asset,tokenContract:r.tokenContract,amount:r.amount,amountAtomic:r.amountAtomic,
  usdValue:r.usdValue,usdPrice:r.usdPrice,priceTime:r.priceTime,
  usdPriceSource:priced?(r.priceSource??'unknown price source'):'Price unavailable for this block time',
  sender:r.sender,receiver:r.receiver,senderEntity,receiverEntity,
  economicClass:known?'exchange flow':'unknown',adjustment:'unresolved',
  classificationRationale:known?`Transfer touches a publicly documented exchange wallet (${evidenced.join(', ')}). Classified as exchange flow; the cited evidence is attached to each endpoint.`:'Economic purpose is unverified.',
  classificationVersion:'1.0',
  flags:{mintBurn:isZeroAddress(r.chain,r.sender)||isZeroAddress(r.chain,r.receiver),bridge:false,internalTransfer:false,crossBorderCandidate:false,bot:false},
 };
 return classify(tx);
}

/** (Re)derive a record's classification fields from current evidence. Mutates the record. */
export function classifyRec(r:Rec,attributionFor:(chain:Chain,address:string)=>Attribution):void{
 const tx=makeTransfer(r,attributionFor);
 r.economicClass=tx.economicClass;r.adjustment=tx.adjustment;
 r.senderEntity=tx.senderEntity;r.receiverEntity=tx.receiverEntity;
 r.tx=tx.flags.crossBorderCandidate?tx:undefined;
}

/**
 * Decode one ERC-20 Transfer log into a record, or null if it is not an allowlisted, well-formed transfer. `token` is
 * keyed by the log's own (lowercase hex) contract address. Addresses in the record take the chain's registry form:
 * lowercase 0x hex on EVM chains, base58check on Tron, so evidence lookups and Tronscan links work unchanged.
 */
export function decodeTransferLog(
 chain:Chain,log:EvmLog,blockTime:number,
 token:(address:string)=>TokenInfo|null,
 price:(asset:Asset,at:number)=>Sample|null,
 feed:Rec['feed']='evidenced'
):Rec|null{
 if(log.removed||!Array.isArray(log.topics)||log.topics.length!==3)return null;
 if(log.topics[0].toLowerCase()!==ERC20_TRANSFER_TOPIC)return null;
 const info=token(log.address.toLowerCase());if(!info)return null;
 if(!/^0x[0-9a-fA-F]{64}$/.test(log.data))return null;
 if(!/^0x[0-9a-fA-F]{64}$/.test(log.topics[1])||!/^0x[0-9a-fA-F]{64}$/.test(log.topics[2]))return null;
 const amountAtomic=BigInt(log.data);
 const amount=formatAmount(amountAtomic,info.decimals);
 const p=price(info.asset,blockTime);
 const eventIndex=parseInt(log.logIndex,16);
 if(!Number.isFinite(eventIndex))return null;
 return {
  id:`${chain}:${log.transactionHash}:${eventIndex}`,chain,transactionId:log.transactionHash,eventIndex:String(eventIndex),
  blockNumber:parseInt(log.blockNumber,16),blockHash:log.blockHash,blockTime,
  asset:info.asset,tokenContract:recordAddress(chain,log.address.slice(2)),amount,amountAtomic:amountAtomic.toString(),
  usdValue:p?Number(amount)*p.usd:null,usdPrice:p?.usd??null,priceTime:p?.at??null,priceSource:p?.source??null,
  sender:recordAddress(chain,log.topics[1].slice(-40)),receiver:recordAddress(chain,log.topics[2].slice(-40)),
  economicClass:'unknown',adjustment:'unresolved',senderEntity:UNKNOWN,receiverEntity:UNKNOWN,feed
 };
}

export interface InferOptions {
 /** First-party or derived registry evidence. Only first-party evidence may anchor a cluster. */
 known:Lookup;
 /** True when an attribution rests on a published label rather than a cross-chain derivation. */
 firstParty:(a:Attribution)=>boolean;
 entities:Record<string,{id:string;name:string;jurisdiction:string}>;
 explorerTx:(chain:Chain,hash:string)=>string;
 forwardShare:number;
}

/**
 * Deposit-address inference from observed sweeps, scoped per chain.
 *
 * An unlabelled address whose ONLY outgoing transfers go to one registry entity, after receiving from
 * outside that entity, and which forwarded at least `forwardShare` of what it received, is treated as
 * that entity's deposit address. Pure: takes records, returns a fresh map keyed `${chain}:${address}`.
 * Because the map is rebuilt from the supplied records, an inference lasts exactly as long as the
 * evidence for it remains in the buffer.
 */
export function inferDeposits(records:Rec[],opts:InferOptions):Map<string,Attribution>{
 type Flow={chain:Chain;address:string;ins:Rec[];outs:Rec[]};
 const byAddr=new Map<string,Flow>();
 const touch=(chain:Chain,address:string)=>{
  const k=addressKey(chain,address);
  let f=byAddr.get(k);
  if(!f){f={chain,address,ins:[],outs:[]};byAddr.set(k,f);}
  return f;
 };
 for(const r of records){
  if(!opts.known(r.chain,r.sender)&&!isZeroAddress(r.chain,r.sender))touch(r.chain,r.sender).outs.push(r);
  if(!opts.known(r.chain,r.receiver)&&!isZeroAddress(r.chain,r.receiver))touch(r.chain,r.receiver).ins.push(r);
 }
 const out=new Map<string,Attribution>();
 for(const [key,f] of byAddr){
  if(!f.outs.length||!f.ins.length)continue;
  // Every outgoing transfer must land on one first-party-labelled entity. Derived cross-chain evidence
  // may not anchor an inference: that would stack inference on inference.
  let cluster:string|null=null,ok=true;
  for(const o of f.outs){
   const k=opts.known(o.chain,o.receiver);
   if(!k||!opts.firstParty(k)){ok=false;break;}
   if(cluster===null)cluster=k.addressCluster;
   else if(cluster!==k.addressCluster){ok=false;break;}
  }
  if(!ok||!cluster)continue;
  const ent=opts.entities[cluster];if(!ent)continue;
  const external=f.ins.filter(i=>opts.known(i.chain,i.sender)?.addressCluster!==cluster);
  if(!external.length)continue;
  const firstOut=f.outs.reduce((a,b)=>a.blockTime<b.blockTime?a:b);
  const firstIn=external.reduce((a,b)=>a.blockTime<b.blockTime?a:b);
  if(firstIn.blockTime>firstOut.blockTime)continue;
  // Unpriced legs make the forward share unknowable, so no inference is drawn. Deliberate: defaulting a
  // missing USD value to the token amount would silently manufacture evidence out of a pricing outage.
  const totalIn=external.reduce((s,i)=>s+(i.usdValue??0),0);
  const totalOut=f.outs.reduce((s,o)=>s+(o.usdValue??0),0);
  if(!(totalIn>0)||totalOut<opts.forwardShare*totalIn)continue;
  const sweepLabel=opts.known(firstOut.chain,firstOut.receiver);
  const wallet=sweepLabel?.evidenceNote.split('(')[0].replace(/^\S+ labels this address /,'').trim()||'registry wallet';
  const earliest=Math.min(firstIn.blockTime,firstOut.blockTime);
  out.set(key,{
   entity:ent.name,addressCluster:ent.id,category:'exchange deposit address (INFERRED)',jurisdiction:ent.jurisdiction,
   confidence:'HIGH',score:.8,
   source:`INFERRED from an observed deposit sweep, not a published label: this address forwarded its balance to ${ent.name}'s labelled wallet (${wallet})`,
   sourceUrl:opts.explorerTx(firstOut.chain,firstOut.transactionId),
   evidenceNote:`INFERRED. Within this session the address received ${external.length} transfer(s) on ${f.chain} from outside ${ent.name} and then sent ${Math.round(totalOut/totalIn*100)}% of that value to ${ent.name}'s labelled wallet ${firstOut.receiver} in transaction ${firstOut.transactionId}. Exchange deposit addresses are exchange-controlled, so the jurisdiction is ${ent.name}'s (${ent.jurisdiction}); this is inference from on-chain behaviour and is not persisted.`,
   lastVerified:new Date(earliest).toISOString(),association:'operating entity'
  });
 }
 return out;
}
