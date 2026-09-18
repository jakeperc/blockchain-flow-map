import {aggregate,rank} from './engine';
import {CHAINS,WINDOWS,type Snapshot,type WindowKey,type Corridor,type Transfer,type CountrySummary} from './model';
import {database} from './store';
import {configured} from './connectors';
type Row=Record<string,any>;
export async function productionSnapshot(window:WindowKey,requestedAt=0,chainFilter='All chains'):Promise<Snapshot>{
 const enabled=configured().filter(c=>chainFilter==='All chains'||c===chainFilter),now=Date.now();
 const empty=aggregate([],window,requestedAt||now,'production');
 if(!enabled.length){empty.message='No provider is configured for this selection. Demo data is available separately. Production never uses synthetic values.';return empty;}
 const db=database(),feedRows=(await db.prepare('SELECT * FROM feeds').all<Row>()).results;
 const feeds:Row[]=enabled.map(chain=>({chain,...feedRows.find(f=>f.chain===chain)}));
 const allHaveCapture=feeds.every(f=>f.captured_to),asOf=allHaveCapture?Math.min(...feeds.map(f=>Number(f.captured_to))):now;
 const at=requestedAt||asOf,duration=WINDOWS[window],start=at-duration;
 const args:any[]=[start,at],filter=chainFilter==='All chains'?'':' AND chain=?';if(filter)args.push(chainFilter);
 const where='block_time>? AND block_time<=?'+filter;
 const sums=`SELECT COALESCE(SUM(usd_value),0) observed, COUNT(*) transactionCount, SUM(CASE WHEN usd_value IS NULL THEN 1 ELSE 0 END) unpricedCount,
 COALESCE(SUM(CASE WHEN adjustment='excluded' THEN usd_value ELSE 0 END),0) excluded,
 COALESCE(SUM(CASE WHEN adjustment!='excluded' THEN usd_value ELSE 0 END),0) adjusted,
 COALESCE(SUM(CASE WHEN adjustment='unresolved' THEN usd_value ELSE 0 END),0) unresolved,
 COALESCE(SUM(CASE WHEN mapped=1 THEN usd_value ELSE 0 END),0) attributed,
 COALESCE(SUM(CASE WHEN adjustment!='excluded' AND origin=destination AND origin IS NOT NULL THEN usd_value ELSE 0 END),0) domestic FROM transfers WHERE ${where}`;
 const group=`SELECT origin,destination,asset,chain,confidence,SUM(usd_value) value,COUNT(*) count,MAX(block_time) last FROM transfers WHERE ${where} AND mapped=1 AND usd_value IS NOT NULL GROUP BY origin,destination,asset,chain,confidence`;
 const results=await db.batch([db.prepare(sums).bind(...args),db.prepare(group).bind(...args),db.prepare(`SELECT economic_class,SUM(usd_value) value FROM transfers WHERE ${where} GROUP BY economic_class`).bind(...args),db.prepare(`SELECT origin,destination,mapped,SUM(usd_value) value FROM transfers WHERE ${where} AND adjustment!='excluded' GROUP BY origin,destination,mapped`).bind(...args),db.prepare(`SELECT CAST((block_time-?)/? AS INTEGER) bin,SUM(usd_value) value FROM transfers WHERE ${where} AND mapped=1 GROUP BY bin`).bind(start,duration/40,...args)]);
 const raw=results[0].results[0] as Row,totals={...empty.totals,...raw};totals.unattributed=totals.adjusted-totals.attributed-totals.domestic;totals.coverage=totals.adjusted?totals.attributed/totals.adjusted:null;totals.unpricedCount??=0;
 const corridors=new Map<string,Corridor>();for(const row of results[1].results as Row[]){const id=`${row.origin}-${row.destination}`;if(!corridors.has(id))corridors.set(id,{id,origin:row.origin,destination:row.destination,window,windowStart:start,windowEnd:at,usdValue:0,transactionCount:0,assets:{},chains:{},confidence:{},topEntities:[],topTransactions:[],baseline:null,baselineSamples:0,anomalyRatio:null,anomalyScore:null,lastActivity:0,rankScore:0});const c=corridors.get(id)!;c.usdValue+=row.value;c.transactionCount+=row.count;c.assets[row.asset]=(c.assets[row.asset]??0)+row.value;c.chains[row.chain]=(c.chains[row.chain]??0)+row.value;c.confidence[row.confidence]=(c.confidence[row.confidence]??0)+row.value;c.lastActivity=Math.max(c.lastActivity,row.last);}
 const countries=new Map<string,CountrySummary>();const country=(code:string)=>{if(!countries.has(code))countries.set(code,{code,inbound:0,outbound:0,knownEndpointAdjusted:0,coverage:null});return countries.get(code)!;};
 for(const r of results[3].results as Row[]){if(r.origin)country(r.origin).knownEndpointAdjusted+=r.value;if(r.destination&&r.destination!==r.origin)country(r.destination).knownEndpointAdjusted+=r.value;if(r.mapped){country(r.origin).outbound+=r.value;country(r.destination).inbound+=r.value;}}
 for(const c of countries.values())c.coverage=c.knownEndpointAdjusted?(c.inbound+c.outbound)/c.knownEndpointAdjusted:null;
 const fresh=feeds.every(f=>f.last_received&&now-f.last_received<60000&&f.state==='LIVE'&&f.captured_to&&now-f.captured_to<1200000);
 const s:Snapshot={...empty,at,totals,corridors:[...corridors.values()],countries:[...countries.values()],health:fresh?'LIVE':feeds.every(f=>!f.last_received)?'NOT CONNECTED':'DELAYED',lastReceived:feeds.every(f=>f.last_received)?Math.min(...feeds.map(f=>f.last_received)):null,classifications:Object.fromEntries((results[2].results as Row[]).map(r=>[r.economic_class,r.value??0])),history:Array.from({length:40},(_,i)=>({at:start+(i+.5)*duration/40,value:(results[4].results as Row[]).find(r=>r.bin===i)?.value??0})),chainHealth:CHAINS.map(chain=>{const f=feedRows.find(f=>f.chain===chain);return{chain,status:!configured().includes(chain)?'Not connected':f&&now-f.last_received<60000?f.state:'Delayed',lastReceived:f?.last_received??null};}),message:`Captured, finalized activity through ${new Date(asOf).toISOString()}. ${enabled.length} configured chain(s). Prices, classifications and entity evidence must be independently supplied. Unpriced and unknown activity never becomes a geographic route.`};
 rank(s);
 // Bounded inspection payload; all corridor values and counts remain in SQL aggregation.
 const top=s.corridors.slice(0,80);if(top.length){const txResults=await db.batch(top.map(c=>db.prepare(`SELECT payload FROM transfers WHERE ${where} AND origin=? AND destination=? AND mapped=1 ORDER BY usd_value DESC LIMIT 6`).bind(...args,c.origin,c.destination)));top.forEach((c,i)=>{c.topTransactions=(txResults[i].results as Row[]).map(r=>JSON.parse(r.payload));for(const t of c.topTransactions)for(const a of[t.senderEntity,t.receiverEntity]){const found=c.topEntities.find(e=>e.entity===a.entity);if(found)found.usdValue+=t.usdValue??0;else c.topEntities.push({entity:a.entity,usdValue:t.usdValue??0,attribution:a});}});}
 // A contiguous finalized cursor and capture start certify baseline completeness.
 if(feeds.every(f=>f.coverage_start&&f.coverage_start<=at-5*duration&&f.captured_to>=at)){
  const baseArgs:any[]=[at-5*duration,at-duration];if(filter)baseArgs.push(chainFilter);
  const rows=(await db.prepare(`SELECT origin,destination,CAST((?-block_time)/? AS INTEGER) bucket,SUM(usd_value) value FROM transfers WHERE block_time>? AND block_time<=?${filter} AND mapped=1 GROUP BY origin,destination,bucket`).bind(at-1,duration,...baseArgs).all<Row>()).results;
  for(const c of s.corridors){const values=[1,2,3,4].map(bucket=>rows.find(r=>r.origin===c.origin&&r.destination===c.destination&&r.bucket===bucket)?.value??0),mean=values.reduce((a,b)=>a+b,0)/4,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/3;c.baseline=mean;c.baselineSamples=4;c.anomalyRatio=mean?c.usdValue/mean:null;c.anomalyScore=variance?(c.usdValue-mean)/Math.sqrt(variance):null;}rank(s);
 }
 return s;
}
