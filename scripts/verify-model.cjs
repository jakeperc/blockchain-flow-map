const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const {aggregate,classify}=require(root+'/engine.js');
const {WINDOWS,UNKNOWN}=require(root+'/model.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<.1,`${a} != ${b}`);
const at=Date.parse('2026-09-20T12:00:00.000Z');
const evidence=(jurisdiction,entity)=>({entity,addressCluster:`${entity.toLowerCase()}-operating`,category:'exchange',jurisdiction,confidence:'HIGH',score:.8,source:'Public explorer address tag and entity evidence',sourceUrl:'https://example.com/evidence',evidenceNote:'Recorded verification fixture for aggregation invariants.',lastVerified:'2026-09-10T00:00:00.000Z',association:'operating entity'});
const sender=evidence('US','Northstar Exchange');
const receiver=evidence('GB','Harbor Exchange');
const transfer=(over={})=>({id:'Ethereum:0x6d75e7d1:0',chain:'Ethereum',transactionId:'0x6d75e7d1',eventIndex:'0',blockNumber:1,blockHash:'0x6d75e7d1',blockTime:at-60_000,finality:'finalized',asset:'USDC',tokenContract:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',amount:'125000',amountAtomic:'125000000000',usdValue:125000,usdPrice:1,usdPriceSource:'Recorded price fixture',priceTime:at-60_000,sender:'0x1111111111111111111111111111111111111111',receiver:'0x2222222222222222222222222222222222222222',senderEntity:sender,receiverEntity:receiver,economicClass:'exchange flow',adjustment:'included',classificationRationale:'Recorded aggregation fixture.',classificationVersion:'1.0',flags:{bridge:false,mintBurn:false,internalTransfer:false,crossBorderCandidate:false,bot:false},...over});

for(const window of Object.keys(WINDOWS)){
 const s=aggregate([transfer({blockTime:at-WINDOWS[window]/2})],window,at);
 close(s.totals.observed,s.totals.adjusted+s.totals.excluded);
 close(s.totals.adjusted,s.totals.attributed+s.totals.domestic+s.totals.unattributed);
 close(s.totals.attributed,s.corridors.reduce((n,c)=>n+c.usdValue,0));
 assert.equal(s.totals.coverage,1);
 assert.equal(s.corridors.length,1);
}

const event=transfer();
assert.deepEqual(aggregate([event,event],'5M',at),aggregate([event],'5M',at),'Replays must not double count');
assert.equal(aggregate([{...event,receiverEntity:UNKNOWN}],'5M',at).totals.attributed,0);
assert.equal(aggregate([{...event,receiverEntity:{...receiver,confidence:'MEDIUM',score:.65}}],'5M',at).corridors.length,0);
assert.equal(aggregate([{...event,receiverEntity:{...receiver,lastVerified:'2020-01-01T00:00:00Z'}}],'5M',at).corridors.length,0);
assert.equal(aggregate([{...event,usdValue:null}],'5M',at).totals.unpricedCount,1);
assert.equal(classify({...event,receiver:event.sender}).adjustment,'excluded');
assert.equal(classify({...event,receiverEntity:{...event.senderEntity,addressCluster:'another-cluster'}}).adjustment,'excluded');
assert.equal(classify({...event,flags:{...event.flags,bridge:true}}).adjustment,'excluded');
assert.equal(classify({...event,flags:{...event.flags,mintBurn:true}}).adjustment,'excluded');
console.log('PASS: conservation, deduplication, evidence eligibility, exclusions and unpriced events');
