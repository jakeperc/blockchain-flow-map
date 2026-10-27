/**
 * Sealed-history invariants (lib/atlas/rollup.ts). The claim this file has to defend is that a 24H or 7D
 * window built from sealed 15-minute spans reports exactly what one built from the raw transfers would, so
 * that serving a long window from summaries is a storage decision and not a change to the accounting.
 *
 *   node scripts/verify-rollup.cjs <compiled-module-dir>
 *
 * Run through scripts/verify-all.mjs, which compiles the modules first.
 */
const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const {aggregate,aggregateSpan,selectUnattributed}=require(root+'/engine.js');
const {WINDOWS}=require(root+'/model.js');
const {BUCKET_MS,bucketOf,sealBucket,sealSpan,mergeRollups,windowBins,mergeUnmapped,partsInWindow,coverageOf,baselineFor,applyBaselines,registryVersionsOf,partsForChains,toStored,fromStored,TOP_TRANSACTIONS,BASELINE_SAMPLES}=require(root+'/rollup.js');

const close=(a,b,what)=>assert.ok(Math.abs(a-b)<.01,`${what??''}: ${a} != ${b}`);
// A bucket boundary, so spans tile the window exactly and the arithmetic is comparable without slack.
const at=Math.floor(Date.parse('2026-09-20T12:00:00.000Z')/BUCKET_MS)*BUCKET_MS;
// Well inside the 180-day horizon admissible() enforces, measured against the fixture clock below. Evidence
// older than that is inadmissible, every corridor disappears, and the corridor assertions in this file would
// pass over an empty list — which is exactly what happened before the guards further down were added.
const evidence=(jurisdiction,entity)=>({entity,addressCluster:`${entity.toLowerCase()}-operating`,category:'exchange',jurisdiction,confidence:'HIGH',score:.8,source:'Public explorer address tag and entity evidence',sourceUrl:'https://example.com/evidence',evidenceNote:'Recorded verification fixture for sealed-history invariants.',lastVerified:'2026-09-10T00:00:00.000Z',association:'operating entity'});
const US=evidence('US','Northstar Exchange'),GB=evidence('GB','Harbor Exchange'),SG=evidence('SG','Meridian Exchange');
const UNKNOWN=require(root+'/model.js').UNKNOWN;
let seq=0;
const transfer=(over={})=>{
 const n=++seq;
 return {id:`Ethereum:0x${n.toString(16).padStart(8,'0')}:0`,chain:'Ethereum',transactionId:`0x${n.toString(16).padStart(8,'0')}`,eventIndex:'0',blockNumber:n,blockHash:`0x${n.toString(16)}`,blockTime:at-60_000,finality:'finalized',asset:'USDC',tokenContract:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',amount:'1000',amountAtomic:'1000000000',usdValue:1000,usdPrice:1,usdPriceSource:'Recorded price fixture',priceTime:at-60_000,sender:'0x1111111111111111111111111111111111111111',receiver:'0x2222222222222222222222222222222222222222',senderEntity:US,receiverEntity:GB,economicClass:'exchange flow',adjustment:'included',classificationRationale:'Recorded sealed-history fixture.',classificationVersion:'1.0',flags:{bridge:false,mintBurn:false,internalTransfer:false,crossBorderCandidate:false,bot:false},...over};
};
const opts=(coverage,registry='r1',chain='Ethereum')=>({chain,coverage,registry,sealedAt:at,forTotals:r=>r});
const fullDay=chains=>chains.map(chain=>({chain,observedMs:BUCKET_MS}));

/* ---------- The span rule: consecutive spans tile the timeline exactly once ---------- */
{
 const b=at-BUCKET_MS;
 assert.equal(bucketOf(b+1),b,'the first millisecond after a boundary belongs to that span');
 assert.equal(bucketOf(b+BUCKET_MS),b,'a timestamp exactly on the closing boundary belongs to the closing span');
 assert.equal(bucketOf(b+BUCKET_MS+1),b+BUCKET_MS,'one millisecond later starts the next span');
 // A transfer on the boundary must be sealed by exactly one of the two adjacent spans.
 const onBoundary=transfer({blockTime:b+BUCKET_MS});
 const before=sealBucket([onBoundary],b,opts(fullDay(['Ethereum'])));
 const after=sealBucket([onBoundary],b+BUCKET_MS,opts(fullDay(['Ethereum'])));
 assert.equal(before.totals.transactionCount,1);
 assert.equal(after.totals.transactionCount,0,'a boundary transfer must not be counted by both spans');
}

/* ---------- THE exactness test: sealed spans == raw aggregation over the same window ---------- */
{
 const window='24H',duration=WINDOWS[window],start=at-duration;
 // Spread traffic across the whole day, over three corridors, with unpriced, excluded, domestic and
 // one-sided transfers mixed in, so every branch of the accounting is represented in more than one span.
 const records=[];
 for(let i=0;i<96;i++){
  const t=start+i*BUCKET_MS+1000;
  records.push(transfer({blockTime:t,usdValue:1000+i}));
  records.push(transfer({blockTime:t+10,senderEntity:GB,receiverEntity:SG,usdValue:500}));
  if(i%3===0)records.push(transfer({blockTime:t+20,receiverEntity:UNKNOWN,usdValue:7000}));
  if(i%4===0)records.push(transfer({blockTime:t+30,usdValue:null}));
  if(i%5===0)records.push(transfer({blockTime:t+40,flags:{bridge:true,mintBurn:false,internalTransfer:false,crossBorderCandidate:false,bot:false},adjustment:'excluded',usdValue:9000}));
  if(i%6===0)records.push(transfer({blockTime:t+50,receiverEntity:{...US},usdValue:2500})); // domestic
  if(i%7===0)records.push(transfer({blockTime:t+60,senderEntity:SG,receiverEntity:US,usdValue:12345}));
 }
 const direct=aggregate(records,window,at);
 const parts=[];
 for(let i=0;i<96;i++){
  const b=start+i*BUCKET_MS;
  parts.push(sealBucket(records.filter(r=>r.blockTime>b&&r.blockTime<=b+BUCKET_MS),b,opts(fullDay(['Ethereum']))));
 }
 const merged=mergeRollups(parts,window,at);

 // Guards, so nothing below can ever compare two empty results and call it agreement.
 assert.ok(direct.corridors.length>=3,`the fixture must draw corridors to compare (got ${direct.corridors.length})`);
 assert.ok(direct.totals.attributed>0,'the fixture must attribute value');
 assert.ok(direct.totals.excluded>0&&direct.totals.domestic>0&&direct.totals.unpricedCount>0&&direct.totals.unattributed>0,'the fixture must exercise every accounting branch');
 assert.ok(parts.filter(p=>p.corridors.length).length>=90,'nearly every span must carry corridors, or the merge is barely tested');

 for(const k of ['observed','adjusted','attributed','domestic','unattributed','excluded','unresolved','unpricedCount','transactionCount'])
  close(merged.totals[k],direct.totals[k],`totals.${k} from sealed spans`);
 close(merged.totals.coverage,direct.totals.coverage,'totals.coverage is recomputed, not averaged');
 assert.equal(merged.corridors.length,direct.corridors.length,'same corridors');
 for(const c of direct.corridors){
  const m=merged.corridors.find(x=>x.id===c.id);
  assert.ok(m,`corridor ${c.id} survives sealing`);
  close(m.usdValue,c.usdValue,`corridor ${c.id} value`);
  assert.equal(m.transactionCount,c.transactionCount,`corridor ${c.id} count`);
  for(const a of Object.keys(c.assets))close(m.assets[a],c.assets[a],`corridor ${c.id} asset ${a}`);
  for(const ch of Object.keys(c.chains))close(m.chains[ch],c.chains[ch],`corridor ${c.id} chain ${ch}`);
  for(const f of Object.keys(c.confidence))close(m.confidence[f],c.confidence[f],`corridor ${c.id} confidence ${f}`);
  assert.equal(m.lastActivity,c.lastActivity,`corridor ${c.id} last activity`);
  // The merged top list must BE the true top list, not merely the right length.
  assert.deepEqual(m.topTransactions.map(t=>t.id),c.topTransactions.map(t=>t.id),`corridor ${c.id} top ${TOP_TRANSACTIONS} transactions are the true largest`);
  const de=[...c.topEntities].sort((x,y)=>y.usdValue-x.usdValue);
  assert.deepEqual(m.topEntities.map(e=>e.entity),de.map(e=>e.entity),`corridor ${c.id} entity ranking`);
  for(const e of de)close(m.topEntities.find(x=>x.entity===e.entity).usdValue,e.usdValue,`corridor ${c.id} entity ${e.entity}`);
 }
 assert.equal(merged.countries.length,direct.countries.length,'same jurisdictions');
 for(const c of direct.countries){
  const m=merged.countries.find(x=>x.code===c.code);
  for(const k of ['inbound','outbound','knownEndpointAdjusted','unplacedIn','unplacedOut'])close(m[k],c[k],`${c.code}.${k}`);
  close(m.coverage,c.coverage,`${c.code}.coverage is recomputed from the sums`);
  for(const e of c.entities){
   const me=m.entities.find(x=>x.entity===e.entity);
   assert.ok(me,`${c.code} entity ${e.entity} survives`);
   close(me.unplacedIn,e.unplacedIn);close(me.unplacedOut,e.unplacedOut);
   assert.equal(me.transactionCount,e.transactionCount);
  }
 }
 for(const k of Object.keys(direct.classifications))close(merged.classifications[k],direct.classifications[k],`classification ${k}`);
 close(merged.history.reduce((n,h)=>n+h.value,0),direct.history.reduce((n,h)=>n+h.value,0),'the sparkline holds the same total');

 /* ---------- Timeline bins: whole runs of spans, and each corridor's series sums to the corridor ---------- */
 assert.equal(merged.history.length,48,'24H on a quarter hour is 48 half-hour bins');
 merged.history.forEach((h,i)=>{
  assert.equal(h.from,start+i*2*BUCKET_MS,`bin ${i} starts on the grid`);
  assert.equal(h.to-h.from,2*BUCKET_MS,`bin ${i} is two spans long`);
 });
 assert.equal(merged.history.at(-1).to,at,'the last bin ends at the window end');
 merged.history.forEach((h,i)=>{
  // Each bar must be exactly the raw aggregation over its own span: nothing apportioned between bars.
  const raw=aggregateSpan(records,h.from,h.to,'1H');
  close(h.value,raw.totals.attributed,`bin ${i} value equals the raw aggregation over it`);
  for(const c of raw.corridors){
   const m=merged.corridors.find(x=>x.id===c.id);
   close(m.series.value[i],c.usdValue,`corridor ${c.id} bin ${i} value`);
   assert.equal(m.series.count[i],c.transactionCount,`corridor ${c.id} bin ${i} count`);
  }
 });
 for(const [snap,name] of [[merged,'sealed'],[direct,'raw']])for(const c of snap.corridors){
  assert.equal(c.series.value.length,snap.history.length,`${name} corridor ${c.id}: one series entry per bar`);
  close(c.series.value.reduce((n,v)=>n+v,0),c.usdValue,`${name} corridor ${c.id} series sums to its value`);
  assert.equal(c.series.count.reduce((n,v)=>n+v,0),c.transactionCount,`${name} corridor ${c.id} series sums to its count`);
 }
 // The raw path bins by block time, half-open like spans: a transfer on a bin's closing boundary is in that bin.
 const edge=aggregate([transfer({blockTime:start+WINDOWS[window]/40,usdValue:900})],window,at);
 assert.equal(edge.corridors[0].series.count[0],1,'a boundary transfer belongs to the bin it closes');
 assert.equal(merged.history[0].observed,undefined,'no observed share without the chain list');
 const withChains=mergeRollups(parts,window,at,['Ethereum']);
 assert.ok(withChains.history.every(h=>h.observed===1),'a fully read day is observed in every bin');
 const gappy=mergeRollups(parts.filter((_,i)=>i!==10),window,at,['Ethereum']);
 close(gappy.history[5].observed,.5,'a missing span halves its bin\'s observed share');
 close(mergeRollups(parts,window,at,['Ethereum','Base']).history[0].observed,.5,'a chain with no spans counts as unobserved');
 // A live tail ending mid-span, and a 7D window: the bin grid stays on quarter hours and covers the window.
 const off=at+7*60_000,offBins=windowBins(window,off).bins;
 assert.equal(offBins.length,48,'off the grid, the partial first span drops out and the last bin holds the live tail');
 assert.equal(offBins[0].from,start+BUCKET_MS,'the first bin starts at the first whole span');
 assert.equal(offBins.at(-1).to,off,'the last bin ends at the live moment');
 assert.ok(offBins.every(b=>(b.from%BUCKET_MS===0)),'every bin starts on a quarter hour');
 assert.equal(windowBins('7D',at).bins.length,56,'7D is 56 three-hour bins');

 // The unmapped headline is exact; only the listed items are a largest-few sample.
 const du=selectUnattributed(records,window,at,{minUsd:0,sort:'value'});
 const mu=mergeUnmapped(parts,window,at);
 assert.equal(mu.count,du.count,'unmapped transfer count');
 close(mu.usdValue,du.usdValue,'unmapped value');
 for(const k of Object.keys(du.reasons))close(mu.reasons[k],du.reasons[k],`unmapped reason ${k}`);
 assert.deepEqual(mu.items.slice(0,3).map(i=>i.id),du.items.slice(0,3).map(i=>i.id),'the largest unmapped transfers are the true largest');
 assert.deepEqual(mu.entities.map(e=>e.entity),du.entities.map(e=>e.entity),'unmapped entity ranking');

 /* ---------- Sealing is idempotent, so re-sealing a late-arriving record cannot double count ---------- */
 const b0=start,recs0=records.filter(r=>r.blockTime>b0&&r.blockTime<=b0+BUCKET_MS);
 const once=sealBucket(recs0,b0,opts(fullDay(['Ethereum'])));
 const twice=sealBucket(recs0,b0,opts(fullDay(['Ethereum'])));
 assert.deepEqual(twice.totals,once.totals,'re-sealing the same span yields the same totals');
 assert.equal(mergeRollups([once],'1H',b0+BUCKET_MS).totals.observed,mergeRollups([twice],'1H',b0+BUCKET_MS).totals.observed);

 /* ---------- A span straddling the window start is excluded rather than scaled ---------- */
 const straddling=sealSpan(records,start-BUCKET_MS/2,start+BUCKET_MS/2,opts(fullDay(['Ethereum'])));
 assert.equal(partsInWindow([straddling],start,at).length,0,'a span crossing the window start is left out');
 assert.equal(partsInWindow([...parts,straddling],start,at).length,parts.length);
}

/* ---------- Per-chain spans: the chain filter stays exact, and no chain is counted twice ---------- */
{
 const window='1H',duration=WINDOWS[window],start=at-duration;
 const eth=[],base=[];
 for(let i=0;i<4;i++){
  const b=start+i*BUCKET_MS,t=b+1000;
  eth.push(sealBucket([transfer({blockTime:t,chain:'Ethereum',usdValue:1000})],b,opts([{chain:'Ethereum',observedMs:BUCKET_MS}],'r1','Ethereum')));
  base.push(sealBucket([transfer({blockTime:t,chain:'Base',usdValue:250}),transfer({blockTime:t+5,chain:'Base',senderEntity:GB,receiverEntity:SG,usdValue:60})],b,opts([{chain:'Base',observedMs:BUCKET_MS}],'r1','Base')));
 }
 const all=[...eth,...base];
 assert.deepEqual(partsForChains(all,['Ethereum']).map(p=>p.chain),['Ethereum','Ethereum','Ethereum','Ethereum']);
 const onlyEth=mergeRollups(partsForChains(all,['Ethereum']),window,at);
 const onlyBase=mergeRollups(partsForChains(all,['Base']),window,at);
 const both=mergeRollups(partsForChains(all,['Ethereum','Base']),window,at);
 close(onlyEth.totals.attributed,4000,'one chain reports only its own value');
 close(onlyBase.totals.attributed,4*310,'the other chain likewise');
 close(both.totals.attributed,onlyEth.totals.attributed+onlyBase.totals.attributed,'chains sum, never overlap');
 assert.equal(onlyEth.corridors.find(c=>c.id==='GB-SG'),undefined,'a corridor seen only on Base must not appear under Ethereum');
 assert.ok(both.corridors.find(c=>c.id==='GB-SG'),'and must appear when Base is selected');
 // A chain with no spans at all is empty rather than inheriting another chain's history.
 close(mergeRollups(partsForChains(all,['Arbitrum']),window,at).totals.attributed,0);
}

/* ---------- Coverage is measured, and a missed range lowers it ---------- */
{
 const window='24H',duration=WINDOWS[window],start=at-duration;
 const full=[],partial=[];
 for(let i=0;i<96;i++){
  const b=start+i*BUCKET_MS;
  full.push(sealBucket([],b,opts([{chain:'Ethereum',observedMs:BUCKET_MS},{chain:'Base',observedMs:BUCKET_MS}])));
  // Base only managed half of each span, and nothing at all for the first quarter of the day.
  partial.push(sealBucket([],b,opts([{chain:'Ethereum',observedMs:BUCKET_MS},{chain:'Base',observedMs:i<24?0:BUCKET_MS/2}])));
 }
 const f=coverageOf(full,window,at,['Ethereum','Base']);
 close(f.share,1,'a fully observed day is complete');
 const p=coverageOf(partial,window,at,['Ethereum','Base']);
 close(p.perChain.find(c=>c.chain==='Ethereum').share,1);
 close(p.perChain.find(c=>c.chain==='Base').share,.375,'72 spans at half coverage out of 96');
 close(p.share,.375,'the window is only as complete as its least-covered chain');
 assert.equal(coverageOf(partial,window,at,[]).share,0,'no chains selected is no coverage, never full');
 // A chain the browser never watched at all drags the window to zero rather than being ignored.
 close(coverageOf(full,window,at,['Ethereum','Arbitrum']).share,0,'an unobserved chain cannot be silently dropped');
}

/* ---------- Baselines: four covered prior windows, or nothing ---------- */
{
 const window='1H',duration=WINDOWS[window];
 const mk=(from,to,value,observed)=>{
  const out=[];
  for(let b=from;b<to;b+=BUCKET_MS){
   const r=sealBucket([],b,opts([{chain:'Ethereum',observedMs:observed}]));
   r.corridors.push({id:'US-GB',origin:'US',destination:'GB',usdValue:value/(duration/BUCKET_MS),transactionCount:1,assets:{},chains:{},confidence:{},topEntities:[],topTransactions:[],lastActivity:b});
   out.push(r);
  }
  return out;
 };
 // Four complete prior hours at $1,000 each.
 let parts=[];
 for(let i=1;i<=BASELINE_SAMPLES;i++)parts=parts.concat(mk(at-(i+1)*duration,at-i*duration,1000,BUCKET_MS));
 const b=baselineFor(parts,'US-GB',window,at,['Ethereum'],.8,3000);
 assert.ok(b,'four covered prior windows give a baseline');
 close(b.mean,1000,'baseline mean');
 assert.equal(b.samples,BASELINE_SAMPLES);
 close(b.ratio,3,'the ratio is against this browser\'s own measured history');
 assert.equal(b.z,null,'four identical samples have no spread, so no z-score is claimed');
 // Three prior hours is not four.
 let short=[];
 for(let i=1;i<=BASELINE_SAMPLES-1;i++)short=short.concat(mk(at-(i+1)*duration,at-i*duration,1000,BUCKET_MS));
 assert.equal(baselineFor(short,'US-GB',window,at,['Ethereum'],.8,3000),null,'a missing prior window means no baseline');
 // Four prior hours, but one of them was mostly unwatched: a gap must not read as a volume collapse.
 let gappy=[];
 for(let i=1;i<=BASELINE_SAMPLES;i++)gappy=gappy.concat(mk(at-(i+1)*duration,at-i*duration,1000,i===2?BUCKET_MS/10:BUCKET_MS));
 assert.equal(baselineFor(gappy,'US-GB',window,at,['Ethereum'],.8,3000),null,'an under-observed prior window disqualifies the baseline');
 // A corridor that genuinely did not trade contributes a real zero.
 const quiet=baselineFor(parts,'US-SG',window,at,['Ethereum'],.8,500);
 assert.ok(quiet,'a covered window with no activity is a sample, not a gap');
 assert.equal(quiet.mean,0);
 // applyBaselines leaves a corridor untouched when history cannot support one.
 const snap=mergeRollups(short,window,at);
 applyBaselines(snap,short,['Ethereum'],.8);
 for(const c of snap.corridors)assert.equal(c.baseline,null,'no baseline is better than a guessed one');
 // An unaligned live moment: the prior windows are anchored to the last sealed quarter-hour, so each is still tiled
 // by whole spans and the mean is still 1000. Ending them at `at` itself left one span of four straddling the
 // boundary and out of the sum, a mean of 750. The gap between the last prior window and the live window is the
 // unsealed stretch since that quarter-hour, under one span.
 const later=at+7*60_000;
 const unaligned=baselineFor(parts,'US-GB',window,later,['Ethereum'],.8,3000);
 assert.ok(unaligned,'an unaligned live moment still has a baseline');
 close(unaligned.mean,1000,'prior windows are tiled by whole spans whatever the live moment');
 assert.ok(later-Math.floor(later/BUCKET_MS)*BUCKET_MS>0&&later-Math.floor(later/BUCKET_MS)*BUCKET_MS<BUCKET_MS,'the gap to the live window is under one span');
 // A window that is not a whole number of spans cannot have tiled prior windows.
 assert.equal(baselineFor(parts,'US-GB','5M',at,['Ethereum'],.8,10),null,'5M gets no baseline');
 // applyBaselines shares one coverage memo across a snapshot's corridors; it must change no result. Two corridors
 // with history, one without, over both a covered and a gappy history.
 for(const hist of [parts,gappy]){
  const multi=hist.map(p=>({...p,corridors:[...p.corridors,{...p.corridors[0],id:'SG-US',origin:'SG',destination:'US',usdValue:p.corridors[0].usdValue/2}]}));
  const snap=aggregate([],window,at);
  for(const [id,usdValue] of [['US-GB',3000],['SG-US',800],['GB-SG',10]]){
   const [origin,destination]=id.split('-');
   snap.corridors.push({id,origin,destination,window,windowStart:at-duration,windowEnd:at,usdValue,transactionCount:1,assets:{},chains:{},confidence:{},topEntities:[],topTransactions:[],baseline:null,baselineSamples:0,anomalyRatio:null,anomalyScore:null,lastActivity:at,rankScore:0});
  }
  const expected=snap.corridors.map(c=>[c.id,baselineFor(multi,c.id,window,at,['Ethereum'],.8,c.usdValue)]);
  applyBaselines(snap,multi,['Ethereum'],.8);
  for(const [id,b] of expected){
   const c=snap.corridors.find(x=>x.id===id);
   assert.equal(c.baseline,b?b.mean:null,`${id}: a shared coverage memo gives the baseline each corridor gets alone`);
   assert.equal(c.anomalyRatio,b?b.ratio:null);
  }
  assert.equal(expected.filter(([,b])=>b).length,hist===parts?3:0,'the memo is exercised with and without a baseline');
 }
 // The live hour, aggregated from raw records rather than merged from spans, takes a baseline from sealed history.
 const live=aggregate([transfer({blockTime:at-60_000,usdValue:3000,senderEntity:US,receiverEntity:GB})],window,at);
 assert.equal(live.corridors[0].baseline,null,'aggregate() alone has no baseline');
 applyBaselines(live,parts,['Ethereum'],.8);
 close(live.corridors[0].baseline,1000,'the live 1H window is compared with four sealed prior hours');
 close(live.corridors[0].anomalyRatio,3,'and the ratio is against that history');
}

/* ---------- The persisted projection keeps the accounting and drops per-transfer detail ---------- */
{
 const window='1H',duration=WINDOWS[window],start=at-duration;
 const records=[];
 for(let i=0;i<4;i++){
  const t=start+i*BUCKET_MS+1000;
  records.push(transfer({blockTime:t,usdValue:4000+i}));
  records.push(transfer({blockTime:t+10,senderEntity:GB,receiverEntity:SG,usdValue:900}));
  records.push(transfer({blockTime:t+20,receiverEntity:UNKNOWN,usdValue:5000}));
 }
 const parts=[];
 for(let i=0;i<4;i++){
  const b=start+i*BUCKET_MS;
  parts.push(sealBucket(records.filter(r=>r.blockTime>b&&r.blockTime<=b+BUCKET_MS),b,opts(fullDay(['Ethereum']))));
 }
 const roundTripped=parts.map(p=>fromStored(toStored(p)));
 const before=mergeRollups(parts,window,at),after=mergeRollups(roundTripped,window,at);
 for(const k of ['observed','adjusted','attributed','domestic','unattributed','excluded','unresolved','unpricedCount','transactionCount','coverage'])
  close(before.totals[k]??0,after.totals[k]??0,`totals.${k} survives a store round trip`);
 assert.equal(after.corridors.length,before.corridors.length);
 for(const c of before.corridors){
  const a=after.corridors.find(x=>x.id===c.id);
  close(a.usdValue,c.usdValue,`corridor ${c.id} value survives storage`);
  assert.equal(a.transactionCount,c.transactionCount);
  assert.equal(a.lastActivity,c.lastActivity);
  for(const k of Object.keys(c.assets))close(a.assets[k],c.assets[k]);
  for(const k of Object.keys(c.confidence))close(a.confidence[k],c.confidence[k]);
  assert.deepEqual(a.topEntities.map(e=>e.entity),c.topEntities.map(e=>e.entity),'the entity ranking survives');
  // Deliberate: transaction-level evidence is not stored, so it cannot come back stale or invented.
  assert.deepEqual(a.topTransactions,[],'stored history keeps no per-transfer detail');
 }
 for(const c of before.countries){
  const a=after.countries.find(x=>x.code===c.code);
  for(const k of ['inbound','outbound','knownEndpointAdjusted','unplacedIn','unplacedOut'])close(a[k],c[k],`${c.code}.${k} survives storage`);
 }
 const bu=mergeUnmapped(parts,window,at),au=mergeUnmapped(roundTripped,window,at);
 assert.equal(au.count,bu.count,'the unmapped headline survives storage');
 close(au.usdValue,bu.usdValue);
 assert.deepEqual(au.items,[],'stored history lists no unmapped transfers');
 // Coverage and baselines are computed from stored spans exactly as from live ones.
 close(coverageOf(roundTripped,window,at,['Ethereum']).share,coverageOf(parts,window,at,['Ethereum']).share,'coverage survives storage');
 // Storage must not smuggle in an Attribution: the whole point is that a week of history stays small.
 const json=JSON.stringify(parts.map(toStored));
 assert.ok(!json.includes('evidenceNote'),'a stored span must carry no evidence notes');
 assert.ok(!json.includes('lastVerified'),'a stored span must carry no attribution timestamps');
}

/* ---------- Registry versions are reported, not silently mixed ---------- */
{
 const a1=sealBucket([],at-BUCKET_MS,opts(fullDay(['Ethereum']),'registry-a'));
 const a2=sealBucket([],at-2*BUCKET_MS,opts(fullDay(['Ethereum']),'registry-b'));
 assert.deepEqual(registryVersionsOf([a1,a1]),['registry-a']);
 assert.deepEqual(registryVersionsOf([a1,a2]).sort(),['registry-a','registry-b'],'a span sealed under another registry stays visible as such');
}

console.log('PASS: sealed history (span tiling, exact totals and corridors, true top lists, timeline bins and corridor series, idempotent sealing, measured coverage, gated baselines, registry versions)');
