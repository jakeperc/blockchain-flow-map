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
const {inferDeposits,priceAt,decodeTransferLog,formatAmount,makeBlockTimeFn,planChunks,pruneRecords,addressKey,classifyRec}=require(root+'/live-core.js');
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

/* ---------- Retention ---------- */
{
 const recs=[rec({blockTime:T0-1000}),rec({blockTime:T0+1000}),rec({blockTime:T0-5000})];
 const kept=pruneRecords(recs,T0);
 assert.equal(kept.length,1,'retention drops everything before the cutoff');
 assert.equal(pruneRecords(recs,T0-10000).length,3,'an out-of-order record does not stop retention early');
}

console.log('PASS: inference (evidence, refusals, boundary, chain scoping, expiry, corridor), price selection, decoding, decimals, block times, chunking, retention');
