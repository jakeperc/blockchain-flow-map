const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const {demoSnapshot,demoEvents,aggregate,classify,DEMO_EPOCH}=require(root+'/engine.js');
const {WINDOWS,UNKNOWN}=require(root+'/model.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<.1,`${a} != ${b}`);
const a=demoSnapshot('5M',DEMO_EPOCH,1847),b=demoSnapshot('5M',DEMO_EPOCH,1847);
assert.deepEqual(a,b,'Same seed, clock and window must reproduce identical results');
assert.notEqual(a.totals.observed,demoSnapshot('5M',DEMO_EPOCH,29).totals.observed);
for(const window of Object.keys(WINDOWS)){
 const t=performance.now(),s=demoSnapshot(window,DEMO_EPOCH,1847);
 close(s.totals.observed,s.totals.adjusted+s.totals.excluded);
 close(s.totals.adjusted,s.totals.attributed+s.totals.domestic+s.totals.unattributed);
 close(s.totals.attributed,s.corridors.reduce((n,c)=>n+c.usdValue,0));
 assert.ok(s.totals.coverage>0&&s.totals.coverage<=1);
 for(const c of s.corridors){assert.notEqual(c.origin,c.destination);close(Object.values(c.assets).reduce((a,b)=>a+b,0),c.usdValue);close(Object.values(c.chains).reduce((a,b)=>a+b,0),c.usdValue);assert.ok(c.topTransactions.every(t=>t.adjustment==='included'&&!t.flags.bridge&&!t.flags.mintBurn));}
 console.log(window,`${s.totals.transactionCount} events`,`${s.corridors.length} corridors`,`${Math.round(performance.now()-t)} ms`);
}
const events=[...demoEvents(DEMO_EPOCH-300000,DEMO_EPOCH,1847)];
const base=aggregate(events,'5M',DEMO_EPOCH,'demo');
assert.deepEqual(base,aggregate([...events,...events],'5M',DEMO_EPOCH,'demo'),'Replays must not double count');
const t=events.find(t=>t.flags.crossBorderCandidate);
assert.ok(t);
const unknown={...t,receiverEntity:UNKNOWN};
assert.equal(aggregate([unknown],'5M',DEMO_EPOCH,'demo').totals.attributed,0);
const medium={...t,receiverEntity:{...t.receiverEntity,confidence:'MEDIUM',score:.65}};
assert.equal(aggregate([medium],'5M',DEMO_EPOCH,'demo').corridors.length,0);
const stale={...t,receiverEntity:{...t.receiverEntity,lastVerified:'2020-01-01T00:00:00Z'}};
assert.equal(aggregate([stale],'5M',DEMO_EPOCH,'demo').totals.attributed,0);
assert.equal(aggregate(events,'5M',DEMO_EPOCH,'production').totals.transactionCount,0);
assert.equal(classify({...t,receiver:t.sender}).adjustment,'excluded');
assert.equal(classify({...t,receiverEntity:{...t.senderEntity,addressCluster:'another-cluster'}}).adjustment,'excluded');
assert.equal(classify({...t,flags:{...t.flags,bridge:true}}).adjustment,'excluded');
assert.equal(classify({...t,flags:{...t.flags,mintBurn:true}}).adjustment,'excluded');
const unpriced=aggregate([{...t,usdValue:null}],'5M',DEMO_EPOCH,'demo');assert.equal(unpriced.totals.unpricedCount,1);assert.equal(unpriced.totals.observed,0);
const filtered=demoSnapshot('1H',DEMO_EPOCH,1847,'Tron');assert.ok(filtered.corridors.every(c=>Object.keys(c.chains).every(k=>k==='Tron')));
console.log('PASS: determinism, conservation, deduplication, unknown/medium/stale geography, production isolation, exclusions, unpriced events and chain filters');
