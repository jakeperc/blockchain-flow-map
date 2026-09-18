import {admissible,UNKNOWN,WINDOWS,CHAINS,type Transfer,type Corridor,type Snapshot,type WindowKey,type Attribution,type CountrySummary} from './model';
import {COUNTRIES} from './geography';
export const DEMO_EPOCH=Date.UTC(2026,8,18,14,30);
export const DEMO_SEED=1847;
const ROUTES:[string,string,number][]=[['US','GB',44],['US','SG',36],['GB','AE',25],['SG','HK',30],['HK','US',23],['AE','IN',19],['US','BR',17],['GB','CH',20],['JP','SG',14],['SG','AU',11],['US','MX',15],['AE','TR',10],['GB','NG',8],['DE','US',18],['US','CA',14],['KR','JP',8],['SG','PH',10],['SG','ID',9],['NG','KE',5],['BR','AR',7],['AU','US',12],['IN','SG',13],['CH','HK',18],['FR','DE',9],['ZA','GB',7],['CA','GB',11],['CO','US',7],['TR','DE',6],['HK','AE',15],['BR','US',9],['US','JP',16],['DE','AE',11],['KE','AE',5],['MX','CO',4],['SG','US',20],['GB','US',22]];
function random(seed:number){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function evidence(code:string):Attribution{return {entity:`Atlas ${code} Settlement Co.`,addressCluster:`demo:${code.toLowerCase()}:operating`,category:'settlement provider',jurisdiction:code,confidence:['US','GB','SG','CH','DE'].includes(code)?'VERIFIED':'HIGH',score:['US','GB','SG','CH','DE'].includes(code)?.97:.87,source:`Synthetic evidence register · ${code}-01`,sourceUrl:null,evidenceNote:`Fictional fixture: this cluster is assigned to a specific operating entity in ${COUNTRIES[code].name}. This is a simulation of reviewed operating-entity evidence, not a real-world attribution.`,lastVerified:'2026-07-01T00:00:00.000Z',association:'operating entity',synthetic:true};}
const EVIDENCE=Object.fromEntries(Object.keys(COUNTRIES).map(c=>[c,evidence(c)]));
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
 x.flags.crossBorderCandidate=x.adjustment==='included'&&admissible(x.senderEntity,x.blockTime,x.synthetic)&&admissible(x.receiverEntity,x.blockTime,x.synthetic)&&x.senderEntity.jurisdiction!==x.receiverEntity.jurisdiction;
 return x;
}
export function* demoEvents(start:number,end:number,seed=DEMO_SEED):Generator<Transfer>{
 for(let bucket=Math.floor(start/300000);bucket<=Math.floor(end/300000);bucket++){
  const r=random(seed^bucket), moment=bucket*300000;
  for(let i=0;i<ROUTES.length+14;i++){
   const [from,to,weight]=ROUTES[i%ROUTES.length];
   const time=moment+Math.floor(r()*300000),factor=.5+r(),chain=CHAINS[Math.floor(r()*CHAINS.length)];
   const asset=chain==='Tron'?'USDT':chain==='Base'||chain==='Arbitrum'?'USDC':r()>.45?'USDC':'USDT';
   const anomaly=i===1&&time>DEMO_EPOCH-900000&&time<DEMO_EPOCH+900000?3.2:1;
   const amount=Math.round(weight*390000*factor*anomaly);
   if(time<=start||time>end)continue;
   const kind=i<ROUTES.length?'institutional settlement':i<40?'unknown':i<43?'mint/burn':i<45?'bridge':i<47?'infrastructure':i<49?'exchange flow':'treasury movement';
   const sender=EVIDENCE[from], receiver=i>=36&&i<40?{...UNKNOWN,synthetic:true}:i===48?{...EVIDENCE[from],entity:`Atlas ${from} Payments Co.`,addressCluster:`demo:${from}:payments`}:EVIDENCE[to];
   const tx=`demo-${seed}-${bucket}-${i}`;
   yield classify({id:`${chain}:${tx}:0`,chain,transactionId:tx,eventIndex:'0',blockNumber:bucket,blockHash:`demo-block-${bucket}`,blockTime:time,finality:'synthetic',asset,tokenContract:`demo:${chain}:${asset}`,amount:String(amount),amountAtomic:String(BigInt(amount)*BigInt(1000000)),usdValue:amount,usdPrice:1,usdPriceSource:'Synthetic nominal USD fixture',priceTime:time,sender:`demo:${from}:wallet`,receiver:`demo:${i===48?from:to}:${i===48?'payments':i>=36&&i<40?'unknown':'wallet'}`,senderEntity:sender,receiverEntity:receiver,economicClass:kind,adjustment:'included',classificationRationale:'Synthetic settlement-provider fixture; fictional purpose and entities.',classificationVersion:'1.0',flags:{bridge:kind==='bridge',mintBurn:kind==='mint/burn',internalTransfer:false,crossBorderCandidate:false,bot:false},synthetic:true});
  }
 }
}
/** The subset of Transfer that totals and country summaries need. Only doubly-admissible included transfers must be full Transfers (they surface in topTransactions). */
export type TotalsInput=Pick<Transfer,'id'|'blockTime'|'usdValue'|'economicClass'|'adjustment'|'senderEntity'|'receiverEntity'|'synthetic'>;
export function aggregate(events:Iterable<Transfer|TotalsInput>,window:WindowKey,at:number,mode:'demo'|'production',seed=0):Snapshot {
 const totals={observed:0,adjusted:0,attributed:0,domestic:0,unattributed:0,excluded:0,unresolved:0,unpricedCount:0,transactionCount:0,coverage:null as number|null};
 const corridors=new Map<string,Corridor>(), countries=new Map<string,CountrySummary>(),seen=new Set<string>(),classes:Record<string,number>={},duration=WINDOWS[window];
 const history=Array.from({length:40},(_,i)=>({at:at-duration+(i+.5)*duration/40,value:0}));
 const country=(code:string)=>{if(!countries.has(code))countries.set(code,{code,inbound:0,outbound:0,knownEndpointAdjusted:0,coverage:null});return countries.get(code)!;};
 for(const t of events){
  if(t.blockTime<=at-duration||t.blockTime>at||seen.has(t.id)||(mode==='production'&&t.synthetic))continue;
  seen.add(t.id);totals.transactionCount++;
  if(t.usdValue===null){totals.unpricedCount++;continue;}
  const value=t.usdValue;totals.observed+=value;classes[t.economicClass]=(classes[t.economicClass]??0)+value;
  if(t.adjustment==='excluded'){totals.excluded+=value;continue;}
  totals.adjusted+=value;if(t.adjustment==='unresolved')totals.unresolved+=value;
  const a=admissible(t.senderEntity,t.blockTime,mode==='demo')?t.senderEntity.jurisdiction:null,b=admissible(t.receiverEntity,t.blockTime,mode==='demo')?t.receiverEntity.jurisdiction:null;
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
 const result={mode,window,at,seed,health:mode==='demo'?'DEMO DATA':'NOT CONNECTED',lastReceived:null,message:mode==='demo'?'Deterministic simulation. All values, entities and evidence are synthetic.':'No production connector configured.',corridors:[...corridors.values()],totals,classifications:classes,countries:[...countries.values()],history,chainHealth:CHAINS.map(chain=>({chain,status:mode==='demo'?'Simulated':'Not connected',lastReceived:null}))} as Snapshot;
 rank(result);return result;
}
export function rank(s:Snapshot){for(const c of s.corridors){const confidence=(c.confidence.VERIFIED??0)/c.usdValue;const recency=Math.exp(-(s.at-c.lastActivity)/WINDOWS[s.window]);c.rankScore=.65*Math.log10(1+c.usdValue)+.15*recency+.15*(.87+confidence*.1)+.05*Math.min(5,c.anomalyRatio??1);}s.corridors.sort((a,b)=>b.rankScore-a.rankScore);}
export function demoSnapshot(window:WindowKey='5M',at=DEMO_EPOCH,seed=DEMO_SEED,chainFilter='All chains'):Snapshot {
 const duration=WINDOWS[window];function* filtered(start:number,end:number){for(const t of demoEvents(start,end,seed))if(chainFilter==='All chains'||t.chain===chainFilter)yield t;}const s=aggregate(filtered(at-duration,at),window,at,'demo',seed);
 const baselines:Map<string,number>[]=[];
 for(let i=1;i<=4;i++){const values=new Map<string,number>();for(const t of filtered(at-(i+1)*duration,at-i*duration)){if(!t.flags.crossBorderCandidate||t.usdValue===null)continue;const key=`${t.senderEntity.jurisdiction}-${t.receiverEntity.jurisdiction}`;values.set(key,(values.get(key)??0)+t.usdValue);}baselines.push(values);}
 for(const c of s.corridors){const values=baselines.map(b=>b.get(c.id)??0);const mean=values.reduce((a,b)=>a+b,0)/values.length,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1);c.baseline=mean;c.baselineSamples=4;c.anomalyRatio=mean?c.usdValue/mean:null;c.anomalyScore=variance?(c.usdValue-mean)/Math.sqrt(variance):null;}
 rank(s);return s;
}
