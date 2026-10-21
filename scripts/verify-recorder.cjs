/**
 * Recorder invariants (lib/atlas/recorder-core.ts), checked on recorded real chain data: Ethereum and Tron USDC/USDT
 * Transfer logs as the page's settlement feed reads them, with the headers and prices it would have used
 * (scripts/fixtures/recorder-logs.json.gz, written by scripts/record-recorder-fixture.mjs). The claim to defend is
 * that a span is the same accounting whoever seals it and whenever the browser's own re-classification last ran:
 *  - a seal no longer depends on whether the buffer was classified first (the bug fixed on 2026-10-21), and it
 *    equals what the page sealed when it had been;
 *  - a seal infers from the chain's transfers in the 90 minutes before its seal point, and from nothing else;
 *  - inferring per chain gives exactly what inferring over every chain at once gives;
 *  - a record stored as a compact row and read back seals identically;
 *  - pickSpans keeps exactly one span per (bucket, chain), the better-observed one, and never adds two together;
 *  - the bundle validator accepts what the recorder publishes and refuses anything malformed.
 *
 *   node scripts/verify-recorder.cjs <compiled-module-dir>
 *
 * Run through scripts/verify-all.mjs, which compiles the modules first.
 */
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {join}=require('node:path');
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const rc=require(root+'/recorder-core.js');
const {decodeTransferLog,makeBlockTimeFn,readInterval,priceAt,inferDeposits,classifyRec,addressKey}=require(root+'/live-core.js');
const {BUCKET_MS,bucketOf,sealSpan,mergeRollups,toStored,fromStored,STORED_SCHEMA}=require(root+'/rollup.js');
const {CONTRACTS,ERC20_TRANSFER_TOPIC}=require(root+'/evm.js');
const {rpcAddress}=require(root+'/tron.js');
const {EXPLORERS}=require(root+'/geography.js');
const {CHAINS,UNKNOWN}=require(root+'/model.js');
const ke=require(root+'/known-entities.js');

const fx=JSON.parse(gunzipSync(readFileSync(join(__dirname,'fixtures','recorder-logs.json.gz'))));
const REGISTRY={version:ke.registryVersion(),known:ke.knownAttribution,firstParty:a=>!ke.isDerived(a),entities:ke.ENTITIES,explorerTx:(c,h)=>EXPLORERS[c].tx(h)};
const prices=Object.fromEntries(Object.entries(fx.prices).map(([a,p])=>[a,p.samples.map(([at,usd])=>({at,usd,source:p.source}))]));
const priceFor=(asset,at)=>priceAt(prices[asset]??[],at,rc.PRICE_TOLERANCE_MS);
const json=x=>JSON.parse(JSON.stringify(x));

/** Decode a chain's recorded logs exactly as the page's backfill does, and rebuild the intervals it would have marked observed. */
function load(chain){
 const c=fx.chains[chain];
 const tokens=Object.fromEntries(Object.entries(CONTRACTS[chain]).map(([a,t])=>[rpcAddress(chain,a),t]));
 const times=new Map(c.times);
 const timeOf=makeBlockTimeFn(c.bounds,times,c.end,times.get(c.end),c.slotMs);
 const pad=h=>'0x'+h.padStart(64,'0');
 const records=[],ids=new Set();
 for(const [n,tx,li,ci,s,r,d] of c.logs){
  const log={address:c.contracts[ci],transactionHash:tx,logIndex:'0x'+li.toString(16),blockNumber:'0x'+n.toString(16),blockHash:c.blockHashes[n],data:pad(d),topics:[ERC20_TRANSFER_TOPIC,pad(s),pad(r)]};
  const rec=decodeTransferLog(chain,log,timeOf(n),a=>tokens[a]??null,priceFor);
  if(rec&&!ids.has(rec.id)){ids.add(rec.id);records.push(rec);}
 }
 const observed=[];let prev=null;
 for(const [from,to,ok] of c.chunks){if(!ok){prev=null;continue;}const iv=readInterval(prev,from,to,timeOf);observed.push({from:iv.from,to:iv.to});prev=iv.next;}
 const t0=timeOf(c.start),t1=timeOf(c.end);
 const buckets=[];for(let b=bucketOf(t0);b<t1;b+=BUCKET_MS)buckets.push(b);
 // Sealed when the quarter hour holding the last recorded block closed, as the page would: the feed stopped there.
 const contextEnd=bucketOf(t1)+BUCKET_MS;
 return {chain,records,observed,buckets,contextEnd,timeOf,chunks:c.chunks};
}
const ETH=load('Ethereum'),TRON=load('Tron'),BOTH=[ETH,TRON];
const seal=(d,records,extra={})=>rc.sealChainBuckets({chain:d.chain,buckets:d.buckets,records,observed:d.observed,prices,registry:REGISTRY,contextEnd:d.contextEnd,...extra});

/* ---------- Guards: the fixture must exercise what is checked ---------- */
const globalInferred=inferDeposits([...ETH.records,...TRON.records],rc.inferOptions(REGISTRY));
for(const d of BOTH){
 assert.ok(d.records.length>1000,`${d.chain}: the fixture must hold real traffic (decoded ${d.records.length})`);
 assert.ok(d.records.every(r=>r.usdValue!==null),`${d.chain}: every recorded transfer must be priced by the recorded series, or pricing is not what is tested`);
 assert.ok(d.records[0].blockTime>=d.contextEnd-rc.CONTEXT_MS,`${d.chain}: the whole recording must sit inside one seal's context`);
 const n=[...globalInferred.keys()].filter(k=>k.startsWith(d.chain+':')).length;
 assert.ok(n>=10,`${d.chain}: the fixture must infer deposit addresses (got ${n}); re-record with scripts/record-recorder-fixture.mjs`);
}
assert.ok(ETH.buckets.some(b=>rc.observedMsIn(ETH.observed,b,b+BUCKET_MS)===BUCKET_MS),'Ethereum: at least one quarter hour must be fully observed');

/* ---------- observedMsIn: merged, clipped, never inflated ---------- */
for(const d of BOTH){
 const whole=rc.observedMsIn(d.observed,-Infinity,Infinity);
 const tiled=d.buckets.reduce((n,b)=>n+rc.observedMsIn(d.observed,b,b+BUCKET_MS),0);
 assert.equal(tiled,whole,`${d.chain}: quarter hours tile the observed time exactly`);
 assert.equal(rc.observedMsIn([...d.observed,...d.observed],-Infinity,Infinity),whole,`${d.chain}: re-reading a range never adds observed time`);
 assert.ok(whole>0&&whole<=d.timeOf(d.chunks.at(-1)[1])-d.timeOf(d.chunks[0][0]-1),`${d.chain}: observed time is what was read`);
}
assert.equal(rc.observedMsIn([{from:0,to:10},{from:5,to:20},{from:30,to:40}],0,35),25,'overlaps merge and the range clips');

/* ---------- The bug: a seal before the buffer's re-classification ---------- */
// What the page sealed before 2026-10-21, given records the coalesced pass had already classified (global inference
// over every chain's buffer), and given records it had not reached yet.
const lookup=(c,a)=>ke.knownAttribution(c,a)??globalInferred.get(addressKey(c,a))??UNKNOWN;
const classified=d=>d.records.map(r=>{const x={...r};classifyRec(x,lookup);return x;});
const oldSeal=(d,records)=>d.buckets.map(b=>sealSpan(records.filter(r=>r.blockTime>b&&r.blockTime<=b+BUCKET_MS),b,b+BUCKET_MS,{
 chain:d.chain,coverage:[{chain:d.chain,observedMs:rc.observedMsIn(d.observed,b,b+BUCKET_MS)}],registry:REGISTRY.version,sealedAt:d.contextEnd,forTotals:r=>r.tx??r}));
let bugShown=false,attributed=0,excluded=0;
for(const d of BOTH){
 const before=JSON.stringify(d.records);
 const now=seal(d,d.records);
 assert.equal(JSON.stringify(d.records),before,`${d.chain}: sealing must never mutate the records it is given`);
 const reclassified=classified(d);
 assert.deepEqual(now,oldSeal(d,reclassified),`${d.chain}: a seal equals what the page sealed once its buffer was classified`);
 assert.deepEqual(seal(d,reclassified),now,`${d.chain}: a seal is the same whether or not the buffer was classified first`);
 const stale=oldSeal(d,d.records);
 if(stale.some((s,i)=>JSON.stringify(s.totals)!==JSON.stringify(now[i].totals)))bugShown=true;
 for(const s of now){attributed+=s.totals.attributed+s.totals.domestic;excluded+=s.totals.excluded;}
 assert.deepEqual(rc.sealChainBucket({chain:d.chain,bucket:d.buckets[0],records:d.records,observed:d.observed,prices,registry:REGISTRY,contextEnd:d.contextEnd}),now[0],'sealChainBucket is sealChainBuckets for one bucket');
 // Records of another chain, or outside the context, are ignored rather than sealed into this chain's spans.
 assert.deepEqual(seal(d,[...ETH.records,...TRON.records]),now,`${d.chain}: other chains' records do not reach its spans`);
}
assert.ok(bugShown,'the old path must seal different totals from unclassified records, or this check shows nothing');
assert.ok(excluded>0,'the recorded spans must classify transfers (exchange-internal moves are excluded)');
if(!(attributed>0))console.warn('WARN verify-recorder: no recorded transfer is placeable at both ends under the current registry (evidence dated after the recording is inadmissible for it). The checks still compare full spans; re-record with scripts/record-recorder-fixture.mjs to cover corridors again.');

/* ---------- The context is the 90 minutes before the seal point, at both ends ---------- */
for(const d of BOTH){
 const opts={chain:d.chain,observed:d.observed,prices,registry:REGISTRY};
 // Sealed as the first quarter hour closed: transfers after that moment cannot inform it.
 const b0=d.buckets[0],early=b0+BUCKET_MS;
 const firstOnly=rc.sealChainBucket({...opts,bucket:b0,records:d.records,contextEnd:early});
 assert.deepEqual(firstOnly,rc.sealChainBucket({...opts,bucket:b0,records:d.records.filter(r=>r.blockTime<=early),contextEnd:early}),`${d.chain}: records after the seal point are outside its context`);
 // Sealed so late that the context starts at the last quarter hour: earlier transfers cannot inform it.
 const bl=d.buckets.at(-1),late=bl+rc.CONTEXT_MS;
 const lastOnly=rc.sealChainBucket({...opts,bucket:bl,records:d.records,contextEnd:late});
 assert.deepEqual(lastOnly,rc.sealChainBucket({...opts,bucket:bl,records:d.records.filter(r=>r.blockTime>=bl),contextEnd:late}),`${d.chain}: records older than the context are outside it`);
 // Guards: cutting the context must change what is inferred, or the two checks above prove nothing.
 const n=recs=>inferDeposits(recs,rc.inferOptions(REGISTRY)).size,all=n(d.records);
 assert.ok(n(d.records.filter(r=>r.blockTime<=early))<all&&n(d.records.filter(r=>r.blockTime>=bl))<all,`${d.chain}: the context cut must matter to inference`);
 assert.notDeepEqual(lastOnly,rc.sealChainBucket({...opts,bucket:bl,records:d.records,contextEnd:d.contextEnd}),`${d.chain}: a narrower context seals a different span`);
}

/* ---------- Unpriced records are priced at seal from the same series, never assumed ---------- */
{
 const d=ETH,unpriced=d.records.map(r=>({...r,usdValue:null,usdPrice:null,priceTime:null,priceSource:null}));
 assert.deepEqual(seal(d,unpriced),seal(d,d.records),'a seal prices an unpriced record exactly as decoding would have');
 const none=seal(d,unpriced,{prices:{}});
 assert.equal(none.reduce((n,s)=>n+s.totals.observed,0),0,'with no price series nothing is valued, never at $1');
 assert.equal(none.reduce((n,s)=>n+s.totals.unpricedCount,0),seal(d,d.records).reduce((n,s)=>n+s.totals.transactionCount,0),'every transfer is counted as unpriced instead');
}

/* ---------- Per-chain inference equals global inference ---------- */
{
 let total=0;
 for(const d of BOTH){
  const own=inferDeposits(d.records,rc.inferOptions(REGISTRY));
  const fromGlobal=new Map([...globalInferred].filter(([k])=>k.startsWith(d.chain+':')));
  assert.deepEqual([...own.keys()].sort(),[...fromGlobal.keys()].sort(),`${d.chain}: the same deposit addresses are inferred from its own records alone`);
  for(const [k,a] of own)assert.deepEqual(a,fromGlobal.get(k),`${d.chain}: ${k} carries the same inferred evidence`);
  total+=own.size;
 }
 assert.equal(total,globalInferred.size,'no inference spans two chains');
}

/* ---------- Compact rows round trip and seal identically ---------- */
{
 for(const d of BOTH){
  const rows=json(d.records.map(rc.toRow));
  const back=rows.map(row=>rc.fromRow(d.chain,row));
  assert.deepEqual(back,d.records,`${d.chain}: a record read back from its row is the record decoding produced`);
  assert.deepEqual(seal(d,back),seal(d,d.records),`${d.chain}: spans sealed from stored rows equal spans sealed from the decoded records`);
  const bytes=JSON.stringify(rows).length/rows.length;
  assert.ok(bytes<600,`${d.chain}: a row stays compact (${bytes.toFixed(0)} bytes)`);
 }
 const good=rc.toRow(ETH.records[0]);
 const bad=[good.slice(0,13),[...good.slice(0,11),1,null,null],[...good.slice(0,7),'1e6',...good.slice(8)],[...good.slice(0,5),'USDX',...good.slice(6)],[good[0],1.5,...good.slice(2)]];
 for(const row of bad)assert.throws(()=>rc.fromRow('Ethereum',row),/malformed/,'a malformed row is refused, never sealed as a guess');
}

/* ---------- pickSpans: exactly one span per key ---------- */
{
 // A browser that missed one Ethereum chunk: neither its transfers nor its time were observed.
 const miss=ETH.chunks.findIndex(([from,to])=>to-from>10&&ETH.timeOf(from)>ETH.buckets[1]);
 assert.ok(miss>0,'the fixture must have a chunk to drop');
 const [mf,mt]=ETH.chunks[miss];
 const gapped={...ETH,observed:(()=>{const out=[];let prev=null;for(const [i,[from,to]] of ETH.chunks.entries()){if(i===miss){prev=null;continue;}const iv=readInterval(prev,from,to,ETH.timeOf);out.push({from:iv.from,to:iv.to});prev=iv.next;}return out;})()};
 const gappedRecs=ETH.records.filter(r=>r.blockNumber<mf||r.blockNumber>mt);
 const server=[...seal(ETH,ETH.records),...seal(TRON,TRON.records)];
 const browser=[...seal(gapped,gappedRecs,{sealedAt:ETH.contextEnd+60000}),...seal(TRON,TRON.records,{sealedAt:TRON.contextEnd+60000})];
 const key=s=>`${s.bucket}:${s.chain}`;
 const picked=rc.pickSpans(browser,server);
 const keys=picked.map(p=>key(p.span));
 assert.equal(new Set(keys).size,keys.length,'one span per (bucket, chain)');
 assert.deepEqual([...keys].sort(),[...new Set([...browser,...server].map(key))].sort(),'every recorded key is kept');
 assert.deepEqual(picked.map(p=>p.span.bucket),[...picked.map(p=>p.span.bucket)].sort((a,b)=>a-b),'ordered by bucket');
 let lost=0;
 for(const p of picked){
  const b=browser.find(s=>key(s)===key(p.span)),s=server.find(x=>key(x)===key(p.span));
  const bo=rc.spanObservedMs(b),so=rc.spanObservedMs(s);
  if(bo<so)lost++;
  assert.equal(p.source,bo>so?'browser':'server',`${key(p.span)}: the better-observed span wins, and the server wins a tie`);
  assert.equal(p.span,p.source==='server'?s:b,'the chosen span is passed through untouched');
 }
 assert.ok(lost>0,'the dropped chunk must lower some span\'s coverage, or the choice is not tested');
 // The other way round: a server that missed the chunk loses those quarter hours to a browser that saw them.
 const reversed=rc.pickSpans(server,[...seal(gapped,gappedRecs),...seal(TRON,TRON.records)]);
 assert.equal(reversed.filter(p=>p.source==='browser').length,lost,'a browser that observed more wins over the server');
 // Chosen, never added: a window built from the picked spans equals the server's own spans exactly.
 const at=Math.max(ETH.contextEnd,TRON.contextEnd);
 assert.deepEqual(mergeRollups(picked.map(p=>p.span),'1H',at).totals,mergeRollups(server,'1H',at).totals,'picking never sums two spans of one quarter hour');
 // Within one source, a re-seal of the same quarter hour supersedes the earlier one.
 const early=seal(ETH,ETH.records)[1],late=seal(ETH,ETH.records,{sealedAt:ETH.contextEnd+120000})[1];
 assert.equal(rc.pickSpans([late,early],[])[0].span,late,'the later seal wins within one source');
 assert.equal(rc.pickSpans([early,late],[])[0].span,late,'whatever order they arrive in');
}

/* ---------- The published bundle ---------- */
{
 const spans=[...seal(ETH,ETH.records),...seal(TRON,TRON.records)].map(toStored);
 const days=[...new Set(spans.map(s=>new Date(s.bucket).toISOString().slice(0,10)))];
 const bundles=days.map(day=>({schema:STORED_SCHEMA,day,spans:spans.filter(s=>new Date(s.bucket).toISOString().slice(0,10)===day)}));
 for(const b of bundles){
  const check=rc.validateBundle(json(b),CHAINS);
  assert.ok(check.ok,`a recorder's own day file is accepted (${check.reason??''})`);
  const text=JSON.stringify(b);
  assert.ok(!/0x[0-9a-fA-F]{40}/.test(text)&&!/T[1-9A-HJ-NP-Za-km-z]{33}/.test(text),'a published span carries no address');
  assert.ok(!/[0-9a-fA-F]{64}/.test(text),'a published span carries no transaction or block hash');
  assert.ok(!text.includes('evidenceNote')&&!text.includes('lastVerified'),'a published span carries no evidence');
 }
 const merged=mergeRollups(bundles.flatMap(b=>rc.validateBundle(json(b),CHAINS).bundle.spans).map(fromStored),'1H',Math.max(ETH.contextEnd,TRON.contextEnd));
 assert.ok(merged.totals.transactionCount>0,'validated spans merge');
 const base=bundles[0],s0=base.spans[0];
 const variants={
  'another stored-span format':{...base,schema:STORED_SCHEMA+1},
  'no day':{...base,day:'yesterday'},
  'a repeated span':{...base,spans:[s0,s0]},
  'a span outside the day':{...base,spans:[{...s0,bucket:s0.bucket+86400000,end:s0.end+86400000,sealedAt:s0.sealedAt+86400000}]},
  'an unaligned bucket':{...base,spans:[{...s0,bucket:s0.bucket+1,end:s0.end+1}]},
  'a span longer than a bucket':{...base,spans:[{...s0,end:s0.end+1}]},
  'an unknown chain':{...base,spans:[{...s0,chain:'Dogecoin'}]},
  'more observed time than the span':{...base,spans:[{...s0,coverage:[{chain:s0.chain,observedMs:BUCKET_MS+1}]}]},
  'coverage for another chain':{...base,spans:[{...s0,coverage:[{chain:s0.chain==='Tron'?'Ethereum':'Tron',observedMs:1}]}]},
  'a seal before the span closed':{...base,spans:[{...s0,sealedAt:s0.end-1}]},
  'a non-numeric total':{...base,spans:[{...s0,totals:{...s0.totals,observed:'1'}}]},
  'a negative total':{...base,spans:[{...s0,totals:{...s0.totals,adjusted:-1}}]},
  'a lost total (NaN is written as null)':json({...base,spans:[{...s0,totals:{...s0.totals,observed:NaN}}]}),
  'a fractional count':{...base,spans:[{...s0,totals:{...s0.totals,transactionCount:1.5}}]},
  'the unfiltered sample':{...base,spans:[{...s0,sample:{totals:s0.totals,sampledMs:1}}]},
  'a corridor whose id is not its ends':{...base,spans:[{...s0,corridors:[{id:'US-GB',origin:'US',destination:'SG',usdValue:1,transactionCount:1,assets:{},chains:{},confidence:{},topEntities:[],lastActivity:0}]}]},
  'no registry version':{...base,spans:[{...s0,registry:''}]},
  'no unmapped aggregate':{...base,spans:[{...s0,unmapped:undefined}]},
  'not an object':null
 };
 for(const [what,bundle] of Object.entries(variants))assert.equal(rc.validateBundle(bundle,CHAINS).ok,false,`a bundle with ${what} is refused`);
 assert.ok(rc.validateBundle({...base,spans:base.spans.map(s=>({...s,registry:'another-registry'}))},CHAINS).ok,'a span from a different registry is accepted, to be disclosed as mixed (D5)');
 assert.equal(rc.validateBundle({...base,spans:[{...s0,chain:'Tron',coverage:[{chain:'Tron',observedMs:1}]}]},['Ethereum']).ok,false,'only the chains the page reads are accepted');
}

/* ---------- registryVersion: a content hash ---------- */
{
 const v=ke.registryVersion();
 assert.match(v,/^[0-9a-f]{16}$/,'sixteen hex digits of SHA-256');
 assert.equal(ke.registryVersion(),v,'stable within a build');
 const fresh=()=>{delete require.cache[require.resolve(root+'/known-entities.js')];return require(root+'/known-entities.js');};
 assert.equal(fresh().registryVersion(),v,'the same registry hashes the same in a fresh load');
 // A change to what is requested, or to what an entity is, is a different registry.
 const ka=require(root+'/known-addresses.js');
 const w=ka.WATCHED.find(x=>x.addresses.length>1),dropped=w.addresses.pop();
 assert.notEqual(fresh().registryVersion(),v,'dropping one watched address changes the version');
 w.addresses.push(dropped);
 const k2=fresh();
 assert.equal(k2.registryVersion(),v,'restored');
 const k3=fresh(),id=Object.keys(k3.ENTITIES)[0],j=k3.ENTITIES[id].jurisdiction;
 k3.ENTITIES[id].jurisdiction='XX';
 assert.notEqual(k3.registryVersion(),v,'moving an entity to another jurisdiction changes the version');
 k3.ENTITIES[id].jurisdiction=j;
}

const ms=(()=>{const t=Date.now();seal(ETH,ETH.records);return Date.now()-t;})();
console.log(`PASS: recorder core on recorded real data (${ETH.records.length.toLocaleString()} Ethereum and ${TRON.records.length.toLocaleString()} Tron transfers, ${globalInferred.size} inferred deposit addresses; seals independent of re-classification, the 90-minute context at both ends, pricing at seal, per-chain inference, row round trip, one span per key, bundle validation, registry content hash; Ethereum seals in ${ms} ms)`);
