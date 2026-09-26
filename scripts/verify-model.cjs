const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const {aggregate,classify,selectUnattributed}=require(root+'/engine.js');
const {WINDOWS,UNKNOWN}=require(root+'/model.js');
const enc=require(root+'/encoding.js');
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

// One evidenced end: no corridor, but the jurisdiction records the direction and the entity.
const oneSided=transfer({receiverEntity:UNKNOWN});
const os=aggregate([oneSided],'5M',at),us=os.countries.find(c=>c.code==='US');
assert.equal(os.corridors.length,0,'One unplaced end must not draw a route');
close(us.unplacedOut,125000);assert.equal(us.unplacedIn,0);
assert.equal(us.entities.length,1);close(us.entities[0].unplacedOut,125000);assert.equal(us.entities[0].transactionCount,1);
const inbound=aggregate([transfer({senderEntity:UNKNOWN})],'5M',at).countries.find(c=>c.code==='GB');
close(inbound.unplacedIn,125000);assert.equal(inbound.unplacedOut,0);
// A drawn corridor and a domestic pair are placed at both ends, so neither is unplaced flow.
const placed=aggregate([event],'5M',at);
for(const c of placed.countries){assert.equal(c.unplacedIn+c.unplacedOut,0,'Both ends placed must not count as unplaced');assert.equal(c.entities.length,0);}
const domestic=aggregate([transfer({receiverEntity:{...receiver,jurisdiction:'US'}})],'5M',at);
for(const c of domestic.countries)assert.equal(c.unplacedIn+c.unplacedOut,0,'Domestic must not count as unplaced');
// Unplaced value is part of adjusted, and of the unattributed bucket, in both directions.
close(os.totals.unattributed,125000);close(os.totals.adjusted,125000);assert.equal(os.totals.attributed,0);

// selectUnattributed: the same selection the unmapped view lists.
const sel=selectUnattributed([oneSided],'5M',at);
assert.equal(sel.count,1);close(sel.usdValue,125000);assert.equal(sel.items.length,1);
assert.equal(sel.reasons['Receiver unknown'],125000);
assert.equal(sel.entities.length,1);assert.equal(sel.entities[0].jurisdiction,'US');close(sel.entities[0].unplacedOut,125000);
assert.equal(sel.counterparties.length,1);assert.equal(sel.counterparties[0].address,oneSided.receiver);
close(sel.counterparties[0].receivedUsd,125000);assert.deepEqual(sel.counterparties[0].entities,[sender.entity]);
assert.equal(selectUnattributed([event],'5M',at).count,0,'A drawn corridor is not unmapped');
assert.equal(selectUnattributed([transfer({adjustment:'excluded',receiverEntity:UNKNOWN})],'5M',at).count,0,'Excluded mechanics are not unmapped');
assert.equal(selectUnattributed([transfer({usdValue:null,receiverEntity:UNKNOWN})],'5M',at).count,0,'Unpriced transfers carry no USD to report');
// Both ends unplaced: counted and listed, but there is no entity to report it against.
const both=selectUnattributed([transfer({senderEntity:UNKNOWN,receiverEntity:UNKNOWN})],'5M',at);
assert.equal(both.count,1);assert.equal(both.reasons['Both unknown'],125000);
assert.equal(both.entities.length,0);assert.equal(both.counterparties.length,0);
// Filters narrow the listing and the breakdowns, never the headline figures.
const filtered=selectUnattributed([oneSided],'5M',at,{minUsd:1_000_000});
assert.equal(filtered.count,1,'minUsd must not change the headline count');close(filtered.usdValue,125000);
assert.equal(filtered.shown,0);assert.equal(filtered.items.length,0);assert.equal(filtered.counterparties.length,0);
assert.equal(selectUnattributed([oneSided],'5M',at,{search:'nothing-matches'}).shown,0);
assert.equal(selectUnattributed([oneSided],'5M',at,{search:oneSided.receiver.slice(0,12).toUpperCase()}).shown,1,'Search must be case-insensitive');
assert.equal(selectUnattributed([oneSided],'5M',at,{search:'northstar'}).shown,1,'Search must match the evidenced entity');
const many=[transfer({id:'a',usdValue:10,receiverEntity:UNKNOWN}),transfer({id:'b',usdValue:900000,blockTime:at-120_000,receiverEntity:UNKNOWN})];
assert.equal(selectUnattributed(many,'5M',at,{sort:'value'}).items[0].id,'b');
assert.equal(selectUnattributed(many,'5M',at,{sort:'recent'}).items[0].id,'a');
assert.equal(selectUnattributed(many,'5M',at,{limit:1}).items.length,1);
assert.equal(selectUnattributed([oneSided,oneSided],'5M',at).count,1,'Replays must not double count');


// Visual encodings (lib/atlas/encoding.ts): contractual, shared by both renderers, described in docs/METHODOLOGY.md.
close(enc.routeWidth(0),.65);close(enc.routeWidth(1e5),.65);assert.ok(Math.abs(enc.routeWidth(1e6)-1.43)<.01);assert.equal(enc.routeWidth(1e12),4.7);
{let prev=0;for(let e=3;e<=12;e+=.5){const w=enc.routeWidth(10**e);assert.ok(w>=prev,'routeWidth must be monotonic');prev=w;}}
assert.equal(enc.glowRadius(0),0);assert.equal(enc.glowRadius(1e5),8);assert.equal(enc.glowRadius(1e10),34);
close(enc.flatBend(100),22);assert.equal(enc.flatBend(1000),120);
assert.equal(enc.bendSign('US','GB',true),-enc.bendSign('GB','US',true));assert.equal(enc.bendSign('US','GB',false),-enc.bendSign('US','GB',true));
{const up=enc.flatControls([0,0],[100,0],'A','B',true),down=enc.flatControls([0,0],[100,0],'A','B',false);
 close(up.c1[0],30);close(up.c2[0],70);close(up.c1[1],-down.c1[1]);close(up.c2[1],-down.c2[1]);close(Math.abs(up.c1[1]),22);}
assert.equal(enc.dominantKey({a:1,b:3,c:2}),'b');assert.equal(enc.dominantKey({}),undefined);
assert.equal(enc.colorOf({chains:{Ethereum:5,Base:1},assets:{},confidence:{}},'CHAIN'),'#92a9e7');
assert.equal(enc.colorOf({chains:{},assets:{USDT:1},confidence:{}},'ASSET'),'#9bc9a7');
assert.equal(enc.colorOf({chains:{Nope:1},assets:{},confidence:{}},'CHAIN'),enc.FALLBACK_COLOR);
assert.equal(enc.colorOf({chains:{},assets:{},confidence:{}},'CONFIDENCE'),enc.FALLBACK_COLOR);
{const c=(id,rankScore,origin,destination)=>({id,rankScore,origin,destination});
 const all=[c('a',1.0,'US','GB'),c('b',1.1,'KY','US'),c('c',1.2,'SG','JP'),c('d',.5,'GB','SG')];
 const ranked=enc.rankRoutes(all,null,id=>id==='a',10);
 assert.deepEqual(ranked.map(r=>r.id),['c','a','b','d'],'incumbent bonus: 1.0×1.15 beats 1.1 and loses to 1.2');
 assert.equal(ranked[1],all[0],'rankRoutes must return the input objects');
 assert.deepEqual(enc.rankRoutes(all,null,()=>false,2).map(r=>r.id),['c','b'],'cap');
 assert.deepEqual(enc.rankRoutes(all,'GB',()=>false,10).map(r=>r.id),['a','d'],'country filter keeps both directions');}
assert.equal(enc.routeCap(375),24);assert.equal(enc.routeCap(980),24);assert.equal(enc.routeCap(981),32);assert.equal(enc.routeCap(1440),32);
assert.equal(enc.routeOpacityTarget('x','y'),.18);assert.equal(enc.routeOpacityTarget('x','x'),1);assert.equal(enc.routeOpacityTarget(null,'y'),1);
assert.equal(enc.glowOpacityTarget('US','GB'),.22);assert.equal(enc.glowOpacityTarget('US','US'),.5);assert.equal(enc.glowOpacityTarget(null,'GB'),.5);
assert.equal(enc.labelVisible({},false,1200),true,'a listed label without auto is always shown');
assert.equal(enc.labelVisible({auto:true},false,1200),false);assert.equal(enc.labelVisible({auto:true},true,1200),true);
assert.equal(enc.labelVisible(undefined,true,1200),true);assert.equal(enc.labelVisible(undefined,false,1200),false);
assert.equal(enc.labelVisible({},false,640),false,'below 650 px only mobile labels survive');assert.equal(enc.labelVisible({mobile:true},false,640),true);assert.equal(enc.labelVisible({},false,650),true);

console.log('PASS: conservation, deduplication, evidence eligibility, exclusions, unpriced events, unplaced flow, unmapped selection and visual encodings');
