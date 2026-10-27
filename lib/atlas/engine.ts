import {admissible,WINDOWS,CHAINS,type Transfer,type Corridor,type Snapshot,type WindowKey,type CountrySummary,type UnattributedEntity,type UnattributedFilter,type UnattributedSummary,type UnattributedTransfer,type UnplacedCounterparty} from './model';
export function classify(t:Transfer):Transfer {
 const x={...t,flags:{...t.flags},classificationVersion:'1.0'};
 const self=t.sender===t.receiver,same=t.senderEntity.addressCluster!=='unknown'&&(t.senderEntity.addressCluster===t.receiverEntity.addressCluster||t.senderEntity.entity===t.receiverEntity.entity);
 x.flags.internalTransfer=self||same;
 if(t.flags.mintBurn){x.economicClass='mint/burn';x.adjustment='excluded';x.classificationRationale='Supply issuance or redemption; not bilateral economic settlement.';}
 else if(t.flags.bridge){x.economicClass='bridge';x.adjustment='excluded';x.classificationRationale='Identified bridge mechanism; excluded to prevent counting cross-chain legs twice.';}
 else if(self||same){x.economicClass='treasury movement';x.adjustment='excluded';x.classificationRationale='Same address or same evidenced entity cluster; internal movement.';}
 else if(t.flags.bot||t.economicClass==='infrastructure'||t.economicClass==='treasury movement'){x.adjustment='excluded';x.classificationRationale='Identified treasury, bot or infrastructure routing; separately counted.';}
 else if(t.economicClass==='unknown'||t.economicClass==='DeFi'){x.adjustment='unresolved';x.classificationRationale='Economic purpose unresolved; retained in adjusted value and separately identified, not presumed a payment.';}
 else{x.adjustment='included';}
 x.flags.crossBorderCandidate=x.adjustment==='included'&&admissible(x.senderEntity,x.blockTime)&&admissible(x.receiverEntity,x.blockTime)&&x.senderEntity.jurisdiction!==x.receiverEntity.jurisdiction;
 return x;
}
/** The subset of Transfer that totals and country summaries need. Only doubly-admissible included transfers must be full Transfers (they surface in topTransactions). */
export type TotalsInput=Pick<Transfer,'id'|'blockTime'|'usdValue'|'economicClass'|'adjustment'|'senderEntity'|'receiverEntity'>;
export function aggregate(events:Iterable<Transfer|TotalsInput>,window:WindowKey,at:number):Snapshot {
 return aggregateSpan(events,at-WINDOWS[window],at,window);
}
/**
 * The accounting, over an explicit span rather than a named window. `aggregate()` is this with the span
 * derived from a WindowKey; rollup.ts seals a 15-minute bucket with the same call, so a bucket and a live
 * window can never drift into two different definitions of "adjusted value".
 *
 * The span is half-open at the start — a transfer counts when `start < blockTime <= end` — which is what
 * makes consecutive buckets tile the timeline exactly once, with no gap and no transfer counted twice.
 * `label` is carried onto the Snapshot and its corridors for display and ranking only; the arithmetic uses
 * `start` and `end`. A caller that seals a bucket discards it.
 */
export function aggregateSpan(events:Iterable<Transfer|TotalsInput>,start:number,end:number,label:WindowKey):Snapshot {
 const window=label,at=end,duration=end-start;
 const totals={observed:0,adjusted:0,attributed:0,domestic:0,unattributed:0,excluded:0,unresolved:0,unpricedCount:0,transactionCount:0,coverage:null as number|null};
 const corridors=new Map<string,Corridor>(), countries=new Map<string,CountrySummary>(),seen=new Set<string>(),classes:Record<string,number>={};
 const history=Array.from({length:40},(_,i)=>({at:start+(i+.5)*duration/40,from:start+i*duration/40,to:start+(i+1)*duration/40,value:0}));
 const country=(code:string)=>{if(!countries.has(code))countries.set(code,{code,inbound:0,outbound:0,knownEndpointAdjusted:0,coverage:null,unplacedIn:0,unplacedOut:0,entities:[]});return countries.get(code)!;};
 const entityRow=(c:CountrySummary,entity:string,jurisdiction:string)=>{let e=c.entities.find(e=>e.entity===entity);if(!e){e={entity,jurisdiction,unplacedIn:0,unplacedOut:0,transactionCount:0};c.entities.push(e);}return e;};
 for(const t of events){
  if(t.blockTime<=start||t.blockTime>end||seen.has(t.id))continue;
  seen.add(t.id);totals.transactionCount++;
  if(t.usdValue===null){totals.unpricedCount++;continue;}
  const value=t.usdValue;totals.observed+=value;classes[t.economicClass]=(classes[t.economicClass]??0)+value;
  if(t.adjustment==='excluded'){totals.excluded+=value;continue;}
  totals.adjusted+=value;if(t.adjustment==='unresolved')totals.unresolved+=value;
  const a=admissible(t.senderEntity,t.blockTime)?t.senderEntity.jurisdiction:null,b=admissible(t.receiverEntity,t.blockTime)?t.receiverEntity.jurisdiction:null;
  if(a)country(a).knownEndpointAdjusted+=value;if(b&&b!==a)country(b).knownEndpointAdjusted+=value;
  // Exactly one evidenced end: no route, but the direction and the evidenced entity are both known.
  if(a&&!b){const c=country(a);c.unplacedOut+=value;const e=entityRow(c,t.senderEntity.entity,a);e.unplacedOut+=value;e.transactionCount++;}
  else if(b&&!a){const c=country(b);c.unplacedIn+=value;const e=entityRow(c,t.receiverEntity.entity,b);e.unplacedIn+=value;e.transactionCount++;}
  if(a&&b&&a===b){totals.domestic+=value;continue;}
  if(!a||!b||t.adjustment!=='included'){totals.unattributed+=value;continue;}
  const f=t as Transfer; // only doubly-admissible included transfers reach here; producers must store those in full
  totals.attributed+=value;country(a).outbound+=value;country(b).inbound+=value;
  // Bins are half-open at the start like the span itself, so a transfer on a bin boundary belongs to the earlier bin.
  const bin=Math.min(39,Math.max(0,Math.ceil((t.blockTime-start)/duration*40)-1));
  history[bin].value+=value;
  const id=`${a}-${b}`;
  let c=corridors.get(id);
  if(!c){c={id,origin:a,destination:b,window,windowStart:start,windowEnd:end,usdValue:0,transactionCount:0,assets:{},chains:{},confidence:{},topEntities:[],topTransactions:[],baseline:null,baselineSamples:0,anomalyRatio:null,anomalyScore:null,lastActivity:0,rankScore:0,series:{value:Array(40).fill(0),count:Array(40).fill(0)}};corridors.set(id,c);}
  c.series!.value[bin]+=value;c.series!.count[bin]++;
  c.usdValue+=value;c.transactionCount++;c.lastActivity=Math.max(c.lastActivity,t.blockTime);
  c.assets[f.asset]=(c.assets[f.asset]??0)+value;c.chains[f.chain]=(c.chains[f.chain]??0)+value;
  const conf=f.senderEntity.confidence==='VERIFIED'&&f.receiverEntity.confidence==='VERIFIED'?'VERIFIED':'HIGH';c.confidence[conf]=(c.confidence[conf]??0)+value;
  for(const attr of [f.senderEntity,f.receiverEntity]){const e=c.topEntities.find(e=>e.entity===attr.entity);if(e)e.usdValue+=value;else c.topEntities.push({entity:attr.entity,usdValue:value,attribution:attr});}
  c.topTransactions.push(f);c.topTransactions.sort((x,y)=>(y.usdValue??0)-(x.usdValue??0));if(c.topTransactions.length>6)c.topTransactions.length=6;
 }
 totals.coverage=totals.adjusted?totals.attributed/totals.adjusted:null;
 for(const c of countries.values()){c.coverage=c.knownEndpointAdjusted?(c.inbound+c.outbound)/c.knownEndpointAdjusted:null;c.entities.sort((x,y)=>(y.unplacedIn+y.unplacedOut)-(x.unplacedIn+x.unplacedOut));}
 const result={window,at,health:'NOT CONNECTED',lastReceived:null,message:'No live provider data is available for this selection.',corridors:[...corridors.values()],totals,classifications:classes,countries:[...countries.values()],history,chainHealth:CHAINS.map(chain=>({chain,status:'Not connected',lastReceived:null}))} as Snapshot;
 rank(result);return result;
}
/** What the unmapped view reads per transfer. A live `Rec` satisfies it without being a full Transfer. */
export type UnattributedInput=Pick<Transfer,'id'|'chain'|'transactionId'|'blockTime'|'asset'|'amount'|'usdValue'|'sender'|'receiver'|'senderEntity'|'receiverEntity'|'economicClass'|'adjustment'>;
/**
 * The transfers the map cannot place, and who they touched. Same economic filter as aggregate() —
 * priced, not excluded — stopped one step earlier: instead of folding everything with an unplaced end
 * into a single `unattributed` total, it keeps the transfers, the evidenced entity on the known side
 * and the unplaced counterparty addresses. Pure, so scripts/verify-model.cjs can exercise it.
 *
 * `count`, `usdValue` and `reasons` always describe the whole window; the filter narrows only what is
 * listed and the two breakdowns, so narrowing the list never moves the headline figures.
 */
export function selectUnattributed(events:Iterable<UnattributedInput>,window:WindowKey,at:number,filter:UnattributedFilter={}):UnattributedSummary{
 return selectUnattributedSpan(events,at-WINDOWS[window],at,filter);
}
/** selectUnattributed() over an explicit span, for sealing a rollup bucket. Same half-open rule as aggregateSpan(). */
export function selectUnattributedSpan(events:Iterable<UnattributedInput>,start:number,end:number,filter:UnattributedFilter={}):UnattributedSummary{
 const at=end,seen=new Set<string>();
 const minUsd=filter.minUsd??0,limit=filter.limit??300,sort=filter.sort??'recent';
 const needle=(filter.search??'').trim().toLowerCase();
 const reasons:Record<string,number>={},matched:UnattributedInput[]=[];
 const counterparties=new Map<string,UnplacedCounterparty&{byEntity:Map<string,number>}>();
 const entities=new Map<string,UnattributedEntity>();
 let count=0,usdValue=0,shown=0,shownUsd=0;
 for(const t of events){
  if(t.blockTime<=start||t.blockTime>at||seen.has(t.id))continue;
  seen.add(t.id);
  if(t.usdValue===null||t.adjustment==='excluded')continue;
  const a=admissible(t.senderEntity,t.blockTime)?t.senderEntity.jurisdiction:null;
  const b=admissible(t.receiverEntity,t.blockTime)?t.receiverEntity.jurisdiction:null;
  if(a&&b)continue; // placed at both ends: domestic, or a corridor the map already draws
  const value=t.usdValue;
  count++;usdValue+=value;
  const reason=!a&&!b?'Both unknown':!a?'Sender unknown':'Receiver unknown';
  reasons[reason]=(reasons[reason]??0)+value;
  if(value<minUsd)continue;
  if(needle&&!`${t.sender} ${t.receiver} ${t.transactionId} ${t.chain} ${t.asset} ${t.senderEntity.entity} ${t.receiverEntity.entity}`.toLowerCase().includes(needle))continue;
  shown++;shownUsd+=value;matched.push(t);
  if((a===null)===(b===null))continue; // both ends unplaced: no entity to report it against
  const placedIsSender=a!==null,attr=placedIsSender?t.senderEntity:t.receiverEntity,address=placedIsSender?t.receiver:t.sender;
  let e=entities.get(attr.entity);
  if(!e){e={entity:attr.entity,jurisdiction:placedIsSender?a:b,unplacedIn:0,unplacedOut:0,transactionCount:0};entities.set(attr.entity,e);}
  if(placedIsSender)e.unplacedOut+=value;else e.unplacedIn+=value;
  e.transactionCount++;
  const key=`${t.chain}:${address}`;
  let c=counterparties.get(key);
  if(!c){c={address,chain:t.chain,usdValue:0,transactionCount:0,entities:[],receivedUsd:0,sentUsd:0,byEntity:new Map()};counterparties.set(key,c);}
  c.usdValue+=value;c.transactionCount++;
  if(placedIsSender)c.receivedUsd+=value;else c.sentUsd+=value;
  c.byEntity.set(attr.entity,(c.byEntity.get(attr.entity)??0)+value);
 }
 matched.sort(sort==='value'?(x,y)=>(y.usdValue??0)-(x.usdValue??0):(x,y)=>y.blockTime-x.blockTime);
 const items:UnattributedTransfer[]=matched.slice(0,limit).map(t=>({
  id:t.id,chain:t.chain,transactionId:t.transactionId,blockTime:t.blockTime,asset:t.asset,amount:t.amount,
  usdValue:t.usdValue,sender:t.sender,receiver:t.receiver,senderEntity:t.senderEntity,receiverEntity:t.receiverEntity,
  economicClass:t.economicClass,adjustment:t.adjustment as 'included'|'unresolved',
 }));
 const tops=[...counterparties.values()].sort((x,y)=>y.usdValue-x.usdValue).slice(0,12)
  .map(({byEntity,...c})=>({...c,entities:[...byEntity.entries()].sort((x,y)=>y[1]-x[1]).map(([name])=>name)}));
 return {items,count,usdValue,reasons,shown,shownUsd,counterparties:tops,
  entities:[...entities.values()].sort((x,y)=>(y.unplacedIn+y.unplacedOut)-(x.unplacedIn+x.unplacedOut))};
}
export function rank(s:Snapshot){for(const c of s.corridors){const confidence=(c.confidence.VERIFIED??0)/c.usdValue;const recency=Math.exp(-(s.at-c.lastActivity)/WINDOWS[s.window]);c.rankScore=.65*Math.log10(1+c.usdValue)+.15*recency+.15*(.87+confidence*.1)+.05*Math.min(5,c.anomalyRatio??1);}s.corridors.sort((a,b)=>b.rankScore-a.rankScore);}
