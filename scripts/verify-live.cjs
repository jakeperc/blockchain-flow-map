/**
 * Live-path integrity check: the parts of the browser client that carry methodological weight —
 * deposit-address inference, price selection, log decoding and block-time interpolation. Compile the
 * pure modules first, then run:
 *   node node_modules/typescript/bin/tsc lib/atlas/model.ts lib/atlas/geography.ts lib/atlas/engine.ts lib/atlas/evm.ts lib/atlas/live-core.ts --module commonjs --outDir <scratch> --target ES2020 --skipLibCheck --esModuleInterop
 *   node scripts/verify-live.cjs <scratch>
 * `node scripts/verify-all.mjs` does both.
 */
const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const {inferDeposits,priceAt,decodeTransferLog,formatAmount,makeBlockTimeFn,planChunks,nextPollRange,readInterval,pruneRecords,addressKey,classifyRec}=require(root+'/live-core.js');
const {aggregate}=require(root+'/engine.js');
const {UNKNOWN,admissible}=require(root+'/model.js');
const {ERC20_TRANSFER_TOPIC}=require(root+'/evm.js');

const T0=Date.parse('2026-09-19T12:00:00Z');
const HOT='0x1111111111111111111111111111111111111111';   // labelled exchange wallet
const HOT2='0x2222222222222222222222222222222222222222';  // labelled wallet, different entity
const DEP='0x3333333333333333333333333333333333333333';   // unlabelled candidate deposit address
const OUTSIDE='0x4444444444444444444444444444444444444444';
const ZEROADDR='0x'+'0'.repeat(40);

const ENTS={acme:{id:'acme',name:'Acme Exchange',jurisdiction:'KY'},zeta:{id:'zeta',name:'Zeta Exchange',jurisdiction:'US'}};
const attr=(cluster,over={})=>({entity:ENTS[cluster].name,addressCluster:cluster,category:'exchange',jurisdiction:ENTS[cluster].jurisdiction,
 confidence:'VERIFIED',score:.95,source:'Etherscan public name tag + regulator document naming the operating entity',
 sourceUrl:'https://etherscan.io/address/'+HOT,evidenceNote:"Etherscan labels this address 'Acme 1' (checked 2026-09-18). Operating entity documented.",
 lastVerified:'2026-09-18',association:'operating entity',...over});
/** Registry: HOT belongs to acme on Ethereum and on Base; HOT2 belongs to zeta on Ethereum. */
const REGISTRY={[addressKey('Ethereum',HOT)]:attr('acme'),[addressKey('Base',HOT)]:attr('acme'),[addressKey('Ethereum',HOT2)]:attr('zeta')};
const known=(chain,address)=>REGISTRY[addressKey(chain,address)]??null;
const OPTS={known,firstParty:()=>true,entities:ENTS,explorerTx:(chain,hash)=>`https://${chain==='Base'?'basescan.org':'etherscan.io'}/tx/${hash}`,forwardShare:.8};

let n=0;
const rec=(over={})=>{n++;return {id:`${over.chain??'Ethereum'}:0x${String(n).padStart(4,'0')}:0`,chain:'Ethereum',transactionId:'0x'+String(n).padStart(64,'a'),eventIndex:'0',
 blockNumber:1000+n,blockHash:'0x'+String(n).padStart(64,'b'),blockTime:T0,asset:'USDC',tokenContract:'0xtoken',amount:'100.000000',amountAtomic:'100000000',
 usdValue:100,usdPrice:1,priceTime:T0,sender:OUTSIDE,receiver:DEP,economicClass:'unknown',adjustment:'unresolved',
 senderEntity:UNKNOWN,receiverEntity:UNKNOWN,feed:'evidenced',...over};};
/** The canonical sweep: OUTSIDE funds DEP, DEP forwards to a labelled hot wallet. */
const sweep=(over={})=>[rec({sender:OUTSIDE,receiver:DEP,blockTime:T0,...over.in}),rec({sender:DEP,receiver:HOT,blockTime:T0+60000,...over.out})];

/* ---------- Inference ---------- */
{
 const m=inferDeposits(sweep(),OPTS),a=m.get(addressKey('Ethereum',DEP));
 assert.ok(a,'a funded address that forwards to one labelled wallet is an inferred deposit address');
 assert.equal(a.confidence,'HIGH');assert.equal(a.score,.8);
 assert.equal(a.jurisdiction,'KY','the deposit address inherits the exchange jurisdiction');
 for(const f of ['category','source','evidenceNote'])assert.ok(a[f].includes('INFERRED'),`${f} must be marked INFERRED`);
 assert.ok(a.sourceUrl.includes('/tx/'),'inference must cite the sweep transaction');
 assert.ok(admissible(a,T0+120000),'inferred evidence must be admissible at observation time');
}
{ // Unpriced legs make the forward share unknowable. Both directions must refuse to infer.
 assert.equal(inferDeposits(sweep({out:{usdValue:null,usdPrice:null}}),OPTS).size,0,'an unpriced out-leg must not infer');
 assert.equal(inferDeposits(sweep({in:{usdValue:null,usdPrice:null}}),OPTS).size,0,'an unpriced in-leg must not infer');
}
{ // Structural refusals.
 const twoClusters=[...sweep(),rec({sender:DEP,receiver:HOT2,blockTime:T0+90000})];
 assert.equal(inferDeposits(twoClusters,OPTS).size,0,'outflows to two entities must not infer');
 const internal=[rec({sender:HOT,receiver:DEP,blockTime:T0}),rec({sender:DEP,receiver:HOT,blockTime:T0+60000})];
 assert.equal(inferDeposits(internal,OPTS).size,0,'a hot-to-cold hop inside one entity is not a customer deposit');
 const backwards=[rec({sender:OUTSIDE,receiver:DEP,blockTime:T0+90000}),rec({sender:DEP,receiver:HOT,blockTime:T0})];
 assert.equal(inferDeposits(backwards,OPTS).size,0,'a sweep before the deposit must not infer');
 assert.equal(inferDeposits([rec({sender:DEP,receiver:HOT})],OPTS).size,0,'an outflow with no inflow must not infer');
 const zero=[rec({sender:ZEROADDR,receiver:DEP}),rec({sender:DEP,receiver:HOT,blockTime:T0+60000})];
 assert.ok(!inferDeposits(zero,OPTS).has(addressKey('Ethereum',ZEROADDR)),'the zero address is never a deposit address');
 assert.ok(!inferDeposits(sweep(),OPTS).has(addressKey('Ethereum',HOT)),'a registry address is never itself inferred');
}
{ // Forward-share boundary.
 const at=(pct)=>inferDeposits([rec({sender:OUTSIDE,receiver:DEP,usdValue:100}),rec({sender:DEP,receiver:HOT,blockTime:T0+60000,usdValue:pct})],OPTS).size;
 assert.equal(at(79),0,'forwarding 79% is below the threshold');
 assert.equal(at(80),1,'forwarding exactly 80% meets the threshold');
}
{ // Chains must not be linked: receiving on Ethereum and sweeping on Base is not one address.
 const cross=[rec({chain:'Ethereum',sender:OUTSIDE,receiver:DEP,blockTime:T0}),rec({chain:'Base',sender:DEP,receiver:HOT,blockTime:T0+60000})];
 const m=inferDeposits(cross,OPTS);
 assert.equal(m.size,0,'inference must not join legs observed on different chains');
}
{ // Derived cross-chain evidence may not anchor an inference.
 const derivedOnly={...OPTS,firstParty:a=>!a.category.includes('DERIVED')};
 const reg2={...REGISTRY};reg2[addressKey('Base',HOT)]=attr('acme',{category:'exchange wallet (DERIVED cross-chain)',confidence:'HIGH',score:.8});
 const o={...derivedOnly,known:(c,a)=>reg2[addressKey(c,a)]??null};
 const onBase=[rec({chain:'Base',sender:OUTSIDE,receiver:DEP,blockTime:T0}),rec({chain:'Base',sender:DEP,receiver:HOT,blockTime:T0+60000})];
 assert.equal(inferDeposits(onBase,o).size,0,'a derived label must not anchor a deposit-address inference');
}
{ // Inference lasts exactly as long as the evidence for it.
 const recs=sweep();
 assert.equal(inferDeposits(recs,OPTS).size,1);
 assert.equal(inferDeposits(pruneRecords(recs,T0+3600000),OPTS).size,0,'inference expires once its records age out');
 const stale=inferDeposits(recs,OPTS).get(addressKey('Ethereum',DEP));
 assert.equal(admissible(stale,T0+181*86400000),false,'inferred evidence goes inadmissible past the 180-day horizon like any other');
}
{
 // Inference must actually draw a route through the real engine. This is the whole point of it: a
 // withdrawal from one exchange lands on the other exchange's deposit address, which is then swept.
 // The withdrawal carries the corridor; the sweep itself is an internal move and must be excluded.
 const recs=[rec({sender:HOT2,receiver:DEP,blockTime:T0}),rec({sender:DEP,receiver:HOT,blockTime:T0+60000})];
 const inferred=inferDeposits(recs,OPTS);
 assert.equal(inferred.size,1,'a withdrawal into an unlabelled address swept onward is a deposit address');
 const lookup=(c,a)=>known(c,a)??inferred.get(addressKey(c,a))??UNKNOWN;
 for(const r of recs)classifyRec(r,lookup);
 const s=aggregate(recs.map(r=>r.tx??r),'1H',T0+120000,'production');
 assert.equal(s.corridors.length,1,'the withdrawal into the inferred deposit address draws one corridor');
 assert.equal(s.corridors[0].origin,'US','origin is the paying exchange jurisdiction');
 assert.equal(s.corridors[0].destination,'KY','destination is the receiving exchange jurisdiction');
 assert.equal(recs[1].adjustment,'excluded','the sweep into the same entity is an internal move, not settlement');
 assert.ok(Math.abs(s.totals.observed-(s.totals.adjusted+s.totals.excluded))<.1,'conservation holds on live records');
 assert.ok(Math.abs(s.totals.adjusted-(s.totals.attributed+s.totals.domestic+s.totals.unattributed))<.1,'adjusted decomposes');
}

/* ---------- Prices ---------- */
{
 const S=[{at:1000,usd:.99},{at:2000,usd:1.0},{at:3000,usd:1.01}];
 assert.equal(priceAt(S,2000,600000).usd,1.0,'exact sample');
 assert.equal(priceAt(S,2100,600000).at,2000,'nearest of two');
 assert.equal(priceAt(S,2900,600000).at,3000,'nearest of two, upper');
 assert.equal(priceAt(S,500,600000).at,1000,'before the first sample, within tolerance');
 assert.equal(priceAt([],1000,600000),null,'an empty series prices nothing');
 assert.equal(priceAt(S,3000+600001,600000),null,'a stale series must return null, never the last sample');
 assert.equal(priceAt(S,1000-600001,600000),null,'a sample too far in the future is not a price');
 assert.equal(priceAt([{at:5000,usd:1}],5100,600000).usd,1,'a single-sample series still works');
}

/* ---------- Decoding ---------- */
{
 const pad=a=>'0x'+a.slice(2).padStart(64,'0');
 const TOKEN={asset:'USDC',decimals:6};
 const tok=a=>a==='0xtoken'?TOKEN:null;
 const px=()=>({at:T0,usd:1});
 const log=(over={})=>({address:'0xtoken',transactionHash:'0x'+'a'.repeat(64),logIndex:'0x5',blockNumber:'0x10',blockHash:'0x'+'b'.repeat(64),
  data:'0x'+(1000000n).toString(16).padStart(64,'0'),topics:[ERC20_TRANSFER_TOPIC,pad(OUTSIDE),pad(HOT)],...over});
 const ok=decodeTransferLog('Ethereum',log(),T0,tok,px);
 assert.ok(ok,'a well-formed allowlisted transfer decodes');
 assert.equal(ok.sender,OUTSIDE);assert.equal(ok.receiver,HOT);
 assert.equal(ok.amount,'1.000000');assert.equal(ok.id,'Ethereum:'+log().transactionHash+':5');
 assert.equal(decodeTransferLog('Base',log(),T0,tok,px).id,'Base:'+log().transactionHash+':5','chain is part of the identity, so the same log on two chains is two events');
 assert.equal(decodeTransferLog('Ethereum',log({removed:true}),T0,tok,px),null,'reorged logs are dropped');
 assert.equal(decodeTransferLog('Ethereum',log({topics:[ERC20_TRANSFER_TOPIC,pad(OUTSIDE)]}),T0,tok,px),null,'a two-topic log is not an ERC-20 transfer');
 assert.equal(decodeTransferLog('Ethereum',log({address:'0xnotallowlisted'}),T0,tok,px),null,'non-allowlisted contracts are dropped');
 assert.equal(decodeTransferLog('Ethereum',log({data:'0x12'}),T0,tok,px),null,'malformed amount data is dropped');
 assert.equal(decodeTransferLog('Ethereum',log(),T0,tok,()=>null).usdValue,null,'an unpriced transfer keeps a null USD value, never a $1 peg');
}
{ // Tron: the RPC speaks 20-byte hex; records, registry keys and Tronscan links use base58check (lib/atlas/tron.ts).
 const {tronToHex,tronFromHex,rpcAddress,isZeroAddress,TRON_ZERO}=require(root+'/tron.js');
 const USDT_T='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',HOT_T='TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf';
 assert.equal(tronToHex(USDT_T),'a614f803b6fd780986a42c78ec9c7f77e6ded13c','USDT on Tron is the measured 20-byte contract');
 assert.equal(tronFromHex(tronToHex(HOT_T)),HOT_T,'base58check round-trips through hex');
 assert.equal(tronFromHex('0'.repeat(40)),TRON_ZERO,'the zero address has its known base58 form');
 assert.throws(()=>tronToHex('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u'),/checksum/,'a mistyped Tron address is refused, not silently converted');
 assert.equal(rpcAddress('Tron',HOT_T),'0x'+tronToHex(HOT_T));assert.equal(rpcAddress('Ethereum',HOT.toUpperCase().replace('0X','0x')),HOT,'EVM addresses only lowercase');
 const topic=h=>'0x'+h.padStart(64,'0');
 const tlog={address:'0x'+tronToHex(USDT_T),transactionHash:'0x'+'c'.repeat(64),logIndex:'0x2',blockNumber:'0x20',blockHash:'0x'+'d'.repeat(64),
  data:'0x'+(5000000n).toString(16).padStart(64,'0'),topics:[ERC20_TRANSFER_TOPIC,topic(tronToHex(HOT_T)),topic('0'.repeat(40))]};
 const tr=decodeTransferLog('Tron',tlog,T0,a=>a===tlog.address?{asset:'USDT',decimals:6}:null,()=>({at:T0,usd:1}));
 assert.ok(tr,'a Tron USDT log decodes');
 assert.equal(tr.sender,HOT_T,'Tron senders are base58, so registry lookups and Tronscan links work');
 assert.equal(tr.receiver,TRON_ZERO);assert.equal(tr.tokenContract,USDT_T);assert.equal(tr.amount,'5.000000');
 assert.ok(isZeroAddress('Tron',tr.receiver)&&!isZeroAddress('Ethereum',tr.receiver),'zero is recognised per chain');
}
{ // Decimals: the guard against the retired hard-coded 1e6 divisor.
 assert.equal(formatAmount(1n,6),'0.000001');
 assert.equal(formatAmount(1000000n,6),'1.000000');
 assert.equal(formatAmount(123456789012345678901n,18),'123.456789012345678901','18-decimal amounts above 2^53 stay exact');
 assert.equal(formatAmount(9007199254740993n,6),'9007199254.740993','atomic values beyond Number.MAX_SAFE_INTEGER are exact');
}

/* ---------- Block times and chunking ---------- */
{
 const bounds=[100,150,200],times=new Map([[100,1000],[150,2000],[200,3000]]);
 const f=makeBlockTimeFn(bounds,times,200,3000,12000);
 assert.equal(f(100),1000,'exact at a fetched header');
 assert.equal(f(200),3000,'exact at the final header');
 assert.equal(f(125),1500,'linear between headers');
 for(let b=100;b<200;b++)assert.ok(f(b)<=f(b+1),'block times must be monotonic across the range');
 const noHeaders=makeBlockTimeFn([],null,200,3000,250);
 assert.equal(noHeaders(100),3000-100*250,'without headers, fall back to the chain slot time');
}
{
 const c=planChunks(1,10,4);
 assert.deepEqual(c,[[1,4],[5,8],[9,10]],'chunks cover the range exactly once with the last clipped');
 assert.equal(planChunks(5,5,25).length,1,'a single-block range is one chunk');
 assert.equal(planChunks(10,1,25).length,0,'an inverted range plans nothing');
 const wide=planChunks(0,999,100);
 assert.equal(wide[0][0],0);assert.equal(wide[wide.length-1][1],999);
 for(let i=1;i<wide.length;i++)assert.equal(wide[i][0],wide[i-1][1]+1,'no gaps and no overlaps between chunks');
}

/* ---------- Polling after a pause ---------- */
{
 // Arbitrum's measured config: an hour is 14,400 blocks, a caught-up poll reads 200 and a catch-up poll 1,200.
 const ARB={blocks:14400,liveRange:200,catchupRange:1200};
 assert.equal(nextPollRange(1000,1000,ARB),null,'nothing new at the tip');
 assert.equal(nextPollRange(1000,990,ARB),null,'a node behind our last block reads nothing');
 assert.deepEqual(nextPollRange(1000,1080,ARB),[1001,1080],'a small gap is read in one live poll');
 assert.deepEqual(nextPollRange(1000,1500,ARB),[1001,2200].map((n,i)=>i?Math.min(1500,n):n),'a gap past the live range is read in catch-up ranges, clipped to the tip');
 assert.deepEqual(nextPollRange(1000,5000,ARB),[1001,2200],'a long gap inside the hour is crawled one catch-up range at a time');
 assert.deepEqual(nextPollRange(1000,1000+14400,ARB),[1001,2200],'exactly one hour behind is still crawled');
 assert.equal(nextPollRange(1000,1000+14401,ARB),'rejoin','more than an hour behind rejoins at the latest hour');
 // A weekend asleep: 60 hours of Arbitrum is 864,000 blocks, 772 catch-up polls (over four hours at one poll per 20 s) of blocks the buffer would prune on arrival.
 assert.equal(nextPollRange(1000,1000+864000,ARB),'rejoin','a weekend asleep rejoins instead of crawling');
 const ETH={blocks:300,liveRange:6,catchupRange:50};
 assert.deepEqual(nextPollRange(100,105,ETH),[101,105]);
 assert.deepEqual(nextPollRange(100,400,ETH),[101,150]);
 assert.equal(nextPollRange(100,401,ETH),'rejoin');
}

/* ---------- Observed time: consecutive reads tile ---------- */
{
 /** Merged length of [from,to] intervals, as live-client's observedMsIn measures it. */
 const merged=xs=>{let ms=0,cur=null;for(const x of [...xs].sort((a,b)=>a.from-b.from)){if(!cur||x.from>cur.to){if(cur)ms+=cur.to-cur.from;cur={...x};}else cur.to=Math.max(cur.to,x.to);}return cur?ms+cur.to-cur.from:ms;};
 /** A tab polling every `pollMs`, reading every new block up to the tip less one, block times estimated from the poll time as poll() does. */
 const simulate=(slotMs,pollMs,hours)=>{
  const out=[];let prev=null,last=null,first=null,end=0;
  for(let t=pollMs;t<=hours*3600000;t+=pollMs){
   const target=Math.floor(t/slotMs)-1;
   if(last===null){last=target;continue;}
   if(target<=last)continue;
   const r=readInterval(prev,last+1,target,n=>t-(target-n)*slotMs);
   out.push({from:r.from,to:r.to});prev=r.next;last=target;if(first===null)first=r.from;end=r.to;
  }
  return merged(out)/(end-first);
 };
 // Ethereum is the hard case: 12 s blocks polled every 20 s, so two polls in five read a single block.
 assert.ok(simulate(12000,20000,24)>.999,'a day of Ethereum polls records the whole day, not the 40% the per-read formula recorded');
 assert.ok(simulate(12000,60000,24)>.999,'a hidden tab polled once a minute still records the whole day');
 for(const slot of [250,1200,1500,2000,3000])assert.ok(simulate(slot,20000,2)>.999,`${slot} ms blocks: polls tile`);
 const t=n=>n*1000;
 const a=readInterval(null,10,12,t);
 assert.deepEqual([a.from,a.to],[9000,12000],'a first read claims its own blocks, from the end of the block before');
 const b=readInterval(a.next,13,13,t);
 assert.deepEqual([b.from,b.to],[12000,13000],'a one-block read that follows the last one claims the time since it');
 const c=readInterval(a.next,20,22,t);
 assert.deepEqual([c.from,c.to],[19000,22000],'a read after a gap claims none of the gap');
 const d=readInterval({block:12,time:15000},13,13,t);
 assert.ok(d.to>=d.from&&d.next.time===15000,'an estimate behind the previous end never moves time backwards');
}

/* ---------- Retention ---------- */
{
 const recs=[rec({blockTime:T0-1000}),rec({blockTime:T0+1000}),rec({blockTime:T0-5000})];
 const kept=pruneRecords(recs,T0);
 assert.equal(kept.length,1,'retention drops everything before the cutoff');
 assert.equal(pruneRecords(recs,T0-10000).length,3,'an out-of-order record does not stop retention early');
}

console.log('PASS: inference (evidence, refusals, boundary, chain scoping, expiry, corridor), price selection, decoding (EVM and Tron), decimals, block times, chunking, polling after a pause, observed time, retention');
