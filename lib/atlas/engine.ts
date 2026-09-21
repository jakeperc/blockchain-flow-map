import {admissible,WINDOWS,CHAINS,type Transfer,type Corridor,type Snapshot,type WindowKey,type CountrySummary} from './model';
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
 const totals={observed:0,adjusted:0,attributed:0,domestic:0,unattributed:0,excluded:0,unresolved:0,unpricedCount:0,transactionCount:0,coverage:null as number|null};
 const corridors=new Map<string,Corridor>(), countries=new Map<string,CountrySummary>(),seen=new Set<string>(),classes:Record<string,number>={},duration=WINDOWS[window];
 const history=Array.from({length:40},(_,i)=>({at:at-duration+(i+.5)*duration/40,value:0}));
 const country=(code:string)=>{if(!countries.has(code))countries.set(code,{code,inbound:0,outbound:0,knownEndpointAdjusted:0,coverage:null});return countries.get(code)!;};
 for(const t of events){
  if(t.blockTime<=at-duration||t.blockTime>at||seen.has(t.id))continue;
  seen.add(t.id);totals.transactionCount++;
  if(t.usdValue===null){totals.unpricedCount++;continue;}
  const value=t.usdValue;totals.observed+=value;classes[t.economicClass]=(classes[t.economicClass]??0)+value;
  if(t.adjustment==='excluded'){totals.excluded+=value;continue;}
  totals.adjusted+=value;if(t.adjustment==='unresolved')totals.unresolved+=value;
  const a=admissible(t.senderEntity,t.blockTime)?t.senderEntity.jurisdiction:null,b=admissible(t.receiverEntity,t.blockTime)?t.receiverEntity.jurisdiction:null;
  if(a)country(a).knownEndpointAdjusted+=value;if(b&&b!==a)country(b).knownEndpointAdjusted+=value;
  if(a&&b&&a===b){totals.domestic+=value;continue;}
  if(!a||!b||t.adjustment!=='included'){totals.unattributed+=value;continue;}
  const f=t as Transfer; // only doubly-admissible included transfers reach here; producers must store those in full
  totals.attributed+=value;country(a).outbound+=value;country(b).inbound+=value;
  history[Math.min(39,Math.floor((t.blockTime-(at-duration))/duration*40))].value+=value;
  const id=`${a}-${b}`;
  let c=corridors.get(id);
  if(!c){c={id,origin:a,destination:b,window,windowStart:at-duration,windowEnd:at,usdValue:0,transactionCount:0,assets:{},chains:{},confidence:{},topEntities:[],topTransactions:[],baseline:null,baselineSamples:0,anomalyRatio:null,anomalyScore:null,lastActivity:0,rankScore:0};corridors.set(id,c);}
  c.usdValue+=value;c.transactionCount++;c.lastActivity=Math.max(c.lastActivity,t.blockTime);
  c.assets[f.asset]=(c.assets[f.asset]??0)+value;c.chains[f.chain]=(c.chains[f.chain]??0)+value;
  const conf=f.senderEntity.confidence==='VERIFIED'&&f.receiverEntity.confidence==='VERIFIED'?'VERIFIED':'HIGH';c.confidence[conf]=(c.confidence[conf]??0)+value;
  for(const attr of [f.senderEntity,f.receiverEntity]){const e=c.topEntities.find(e=>e.entity===attr.entity);if(e)e.usdValue+=value;else c.topEntities.push({entity:attr.entity,usdValue:value,attribution:attr});}
  c.topTransactions.push(f);c.topTransactions.sort((x,y)=>(y.usdValue??0)-(x.usdValue??0));if(c.topTransactions.length>6)c.topTransactions.length=6;
 }
 totals.coverage=totals.adjusted?totals.attributed/totals.adjusted:null;
 for(const c of countries.values())c.coverage=c.knownEndpointAdjusted?(c.inbound+c.outbound)/c.knownEndpointAdjusted:null;
 const result={window,at,health:'NOT CONNECTED',lastReceived:null,message:'No live provider data is available for this selection.',corridors:[...corridors.values()],totals,classifications:classes,countries:[...countries.values()],history,chainHealth:CHAINS.map(chain=>({chain,status:'Not connected',lastReceived:null}))} as Snapshot;
 rank(result);return result;
}
export function rank(s:Snapshot){for(const c of s.corridors){const confidence=(c.confidence.VERIFIED??0)/c.usdValue;const recency=Math.exp(-(s.at-c.lastActivity)/WINDOWS[s.window]);c.rankScore=.65*Math.log10(1+c.usdValue)+.15*recency+.15*(.87+confidence*.1)+.05*Math.min(5,c.anomalyRatio??1);}s.corridors.sort((a,b)=>b.rankScore-a.rankScore);}
