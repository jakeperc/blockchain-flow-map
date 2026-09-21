/**
 * Diagnostic replica of the live map's 1H view, for before/after comparisons. Not shipped. For each chain it reads the
 * backfilled hour of registry-filtered Transfer logs from the free public RPCs, then runs the SAME pure functions the
 * browser runs (live-core decodeTransferLog, inferDeposits, classifyRec; engine aggregate) and reports what the map
 * would show: corridors, attributed value, adjusted value and the attributed share (totals.coverage, the UI's
 * "% attributed" figure), per chain and for All chains.
 *
 * Reproducible windows: --window <file.json> records block ranges, header times and the CoinGecko price series the
 * first time it is used and reuses them afterwards. Chain history is immutable, so a later run over the same file sees
 * the same transfers and prices. Several registries can be evaluated in one run with --refs (git refs, or "worktree"):
 * logs are fetched once for the union of their filters, then each registry sees only the logs its own filter returns.
 *
 *   node scripts/measure-corridors.mjs --window w.json [--end-hours-ago N] [--refs cc97055,worktree]
 *        [--chains Ethereum,Base,Arbitrum] [--out result.json] [--explain]
 *
 * --explain lists deposit-address inferences the first registry drew and the last one no longer draws, with the
 * reason under the last registry. More evidence can remove an inference: once a newly evidenced wallet shows an
 * address also paying a second entity, it no longer looks like one exchange's deposit address, and inference
 * refuses it (out-legs to two clusters). Attributed value can then fall even as corridors rise.
 *
 * Differences from the browser, stated: prices come from the stored 5-minute CoinGecko series only (the browser also
 * adds a spot sample every two minutes); the window is exactly the backfilled hour with no live polling after it.
 * Evidence admissibility is evaluated at each transfer's block time, as the engine does, so a registry row whose
 * `checked` date is after the window is inadmissible for that window: compare registries on windows taken after the
 * newest rows were checked. Windows must end within the last ~22 hours, because only then does CoinGecko's free API
 * return the 5-minute series the live client prices with.
 */
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {POOLS,rpcPool,sleep} from './rpc-pool.mjs';
import {loadAtlas} from './atlas-modules.mjs';

const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf(n);return i>-1?args[i+1]:d;};
const windowFile=opt('--window');
const endAgo=Number(opt('--end-hours-ago',0));
const refs=opt('--refs','worktree').split(',');
const chains=opt('--chains','Ethereum,Base,Arbitrum').split(',');
const outFile=opt('--out');
const explain=args.includes('--explain');
if(!windowFile){console.error('usage: node scripts/measure-corridors.mjs --window w.json [--end-hours-ago N] [--refs a,b] [--chains ...] [--out r.json]');process.exit(1);}
// Mirrors CHAIN_CONFIG in lib/atlas/live-client.ts: blocks in the backfilled hour, and the header spacing it uses.
const LIVE={Ethereum:{blocks:300,chunk:50,slotMs:12000},Base:{blocks:1800,chunk:1500,slotMs:2000},Arbitrum:{blocks:14400,chunk:1200,slotMs:250}};
const TIP_LAG=1,PRICE_TOLERANCE_MS=600000,FORWARD_SHARE=.8;
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const COINGECKO_IDS={USDT:'tether',USDC:'usd-coin'};
const hex=n=>'0x'+n.toString(16);
const pad=a=>'0x'+'0'.repeat(24)+a.slice(2).toLowerCase();
const fm=x=>x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(2)+'M':x>=1e3?(x/1e3).toFixed(0)+'k':x.toFixed(0);
const pct=x=>x===null||x===undefined?'n/a':(100*x).toFixed(1)+'%';

/* ---------- Window: block ranges, header times and prices, created once and reused ---------- */
let win=existsSync(windowFile)?JSON.parse(readFileSync(windowFile,'utf8')):null;
if(!win){
 if(endAgo>22){console.error('windows must end within ~22 hours so the 5-minute CoinGecko series covers them');process.exit(1);}
 win={createdAt:new Date().toISOString(),endHoursAgo:endAgo,chains:{},prices:{}};
 for(const chain of chains){
  const cfg=LIVE[chain],pool=POOLS[chain];
  const tip=parseInt(await rpcPool(pool.urls,'eth_blockNumber',[]),16);
  const end=tip-TIP_LAG-Math.round(endAgo*3600000/cfg.slotMs),start=Math.max(0,end-cfg.blocks+1);
  const bounds=[];for(let n=start;n<end;n+=cfg.chunk*2)bounds.push(n);bounds.push(end);
  const times={};
  for(const n of bounds){const h=await rpcPool(pool.urls,'eth_getBlockByNumber',[hex(n),false]);times[n]=parseInt(h.timestamp,16)*1000;await sleep(150);}
  win.chains[chain]={start,end,bounds,times};
  console.log(`${chain}: window blocks ${start}..${end}, ${new Date(times[start]).toISOString()} to ${new Date(times[end]).toISOString()}`);
 }
 const lo=Math.min(...Object.values(win.chains).map(c=>c.times[c.start]))-3600000,hi=Math.max(...Object.values(win.chains).map(c=>c.times[c.end]))+3600000;
 for(const [asset,id] of Object.entries(COINGECKO_IDS)){
  let prices=null;
  for(let attempt=0;attempt<4&&!prices;attempt++){
   try{const r=await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1`,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);prices=(await r.json()).prices;}
   catch(e){console.warn(`CoinGecko ${id}: ${e.message}; retrying`);await sleep(4000*(attempt+1));}
  }
  if(!prices){console.error(`no CoinGecko series for ${id}; without prices inference cannot run, so the window is not saved`);process.exit(1);}
  win.prices[asset]=prices.filter(([at])=>at>=lo&&at<=hi).map(([at,usd])=>({at,usd}));
  await sleep(1500);
 }
 writeFileSync(windowFile,JSON.stringify(win,null,1)+'\n');
 console.log(`saved window ${windowFile} (${win.prices.USDT.length} USDT and ${win.prices.USDC.length} USDC price samples)`);
}

/* ---------- Registries ---------- */
const atlases=Object.fromEntries(refs.map(ref=>[ref,loadAtlas(ref==='worktree'?undefined:ref)]));
const evidenced=(atlas,chain)=>new Set(atlas['known-entities'].evidencedAddresses(chain).map(a=>a.toLowerCase()));

/* ---------- Logs: one fetch per chain for the union of every registry's filter ---------- */
const logsByChain={},missing={};
for(const chain of chains){
 const w=win.chains[chain];if(!w){console.error(`${chain} is not in ${windowFile}`);process.exit(1);}
 const pool=POOLS[chain];
 const union=new Set();for(const a of Object.values(atlases))for(const x of evidenced(a,chain))union.add(x);
 const topics=[...union].map(pad);
 const tokens=Object.keys(Object.values(atlases)[0].evm.CONTRACTS[chain]);
 async function logsFor(a,b,t){
  try{return await rpcPool(pool.urls,'eth_getLogs',[{fromBlock:hex(a),toBlock:hex(b),address:tokens,topics:t}]);}
  catch(e){if(b-a<25)throw e;const m=Math.floor((a+b)/2);return [...await logsFor(a,m,t),...await logsFor(m+1,b,t)];}
 }
 const seen=new Set(),logs=[];missing[chain]=0;
 for(let a=w.start;a<=w.end;a+=pool.chunk){
  const b=Math.min(a+pool.chunk-1,w.end);
  for(const t of [[TRANSFER,topics,null],[TRANSFER,null,topics]]){
   try{for(const l of await logsFor(a,b,t)){const k=`${l.transactionHash}:${l.logIndex}`;if(!seen.has(k)){seen.add(k);logs.push(l);}}}
   catch(e){missing[chain]+=b-a+1;console.warn(`${chain} ${a}..${b} failed: ${e.message}`);}
   await sleep(pool.pauseMs);
  }
 }
 logsByChain[chain]=logs;
 console.log(`${chain}: ${logs.length} logs for ${union.size} filtered addresses${missing[chain]?`, INCOMPLETE: ${missing[chain]} block-queries failed`:''}`);
}

/* ---------- Evaluate each registry exactly as the browser would ---------- */
const at=Math.max(...chains.map(c=>win.chains[c].times[win.chains[c].end]));
const results={},detail={};
for(const [ref,A] of Object.entries(atlases)){
 const core=A['live-core'],ke=A['known-entities'],geo=A.geography,eng=A.engine,model=A.model,evm=A.evm;
 const series={USDT:win.prices.USDT,USDC:win.prices.USDC};
 const recs=[],slots={};
 for(const chain of chains){
  const w=win.chains[chain],ev=evidenced(A,chain);slots[chain]=ev.size;
  const times=new Map(Object.entries(w.times).map(([k,v])=>[Number(k),v]));
  const timeOf=core.makeBlockTimeFn(w.bounds,times,w.end,w.times[w.end],LIVE[chain].slotMs);
  const tokens=Object.fromEntries(Object.entries(evm.CONTRACTS[chain]).map(([k,v])=>[k.toLowerCase(),v]));
  const ids=new Set();
  for(const log of logsByChain[chain]){
   // The filter this registry would have sent: sender or receiver evidenced on this chain.
   if(!ev.has('0x'+log.topics[1]?.slice(26).toLowerCase())&&!ev.has('0x'+log.topics[2]?.slice(26).toLowerCase()))continue;
   const r=core.decodeTransferLog(chain,log,timeOf(parseInt(log.blockNumber,16)),a=>tokens[a]??null,(asset,t)=>core.priceAt(series[asset],t,PRICE_TOLERANCE_MS));
   if(!r||ids.has(r.id))continue;ids.add(r.id);recs.push(r);
  }
 }
 // Evidenced wallets that moved money in this hour, per chain (first-party or derived).
 const active={};
 for(const chain of chains){const s=new Set();for(const r of recs)if(r.chain===chain)for(const a of [r.sender,r.receiver])if(ke.knownAttribution(chain,a))s.add(a);active[chain]=s.size;}
 const inferred=core.inferDeposits(recs,{known:ke.knownAttribution,firstParty:a=>!ke.isDerived(a),entities:ke.ENTITIES,explorerTx:(c,h)=>geo.EXPLORERS[c].tx(h),forwardShare:FORWARD_SHARE});
 const attributionFor=(c,a)=>ke.knownAttribution(c,a)??inferred.get(core.addressKey(c,a))??model.UNKNOWN;
 for(const r of recs)core.classifyRec(r,attributionFor);
 const views={};
 for(const view of ['All chains',...chains]){
  const s=eng.aggregate(recs.filter(r=>view==='All chains'||r.chain===view).map(r=>r.tx??r),'1H',at);
  const inf=[...inferred.keys()].filter(k=>view==='All chains'||k.startsWith(view+':')).length;
  views[view]={corridors:s.corridors.length,attributed:s.totals.attributed,adjusted:s.totals.adjusted,observed:s.totals.observed,domestic:s.totals.domestic,coverage:s.totals.coverage,
   unpriced:s.totals.unpricedCount,transfers:s.totals.transactionCount,inferred:inf,
   jurisdictionsLit:s.countries.filter(c=>c.knownEndpointAdjusted>0).map(c=>c.code).sort(),
   top:s.corridors.slice(0,12).map(c=>({id:c.id,usd:c.usdValue,n:c.transactionCount,entities:c.topEntities.map(e=>e.entity)}))};
 }
 results[ref]={slots,active,views};
 detail[ref]={recs,inferred,known:ke.knownAttribution};
}

/* ---------- Report ---------- */
console.log(`\nWindow ${windowFile}: the hour ending ${new Date(at).toISOString()}. Figures are what the map's 1H view would show right after backfill.`);
for(const [ref,r] of Object.entries(results)){
 console.log(`\n== ${ref} == filter slots ${chains.map(c=>`${c} ${r.slots[c]}`).join(', ')} | wallets active this hour ${chains.map(c=>`${c} ${r.active[c]}`).join(', ')}`);
 for(const [view,v] of Object.entries(r.views))console.log(`${view.padEnd(11)} corridors ${String(v.corridors).padStart(3)} | attributed ${fm(v.attributed).padStart(7)} of adjusted ${fm(v.adjusted).padStart(7)} = ${pct(v.coverage).padStart(6)} | domestic ${fm(v.domestic).padStart(7)} | inferred deposits ${v.inferred} | unpriced ${v.unpriced} | lit ${v.jurisdictionsLit.length}`);
 console.log('top corridors (All chains):',r.views['All chains'].top.map(c=>`${c.id} ${fm(c.usd)}`).join(', ')||'none');
}
if(refs.length>1){
 const [a,b]=[results[refs[0]],results[refs[refs.length-1]]];
 console.log(`\n== change ${refs[0]} -> ${refs[refs.length-1]} ==`);
 for(const view of Object.keys(b.views)){
  const x=a.views[view],y=b.views[view];
  const added=y.top.map(c=>c.id).filter(id=>!x.top.some(c=>c.id===id));
  console.log(`${view.padEnd(11)} corridors ${x.corridors} -> ${y.corridors} | attributed ${fm(x.attributed)} -> ${fm(y.attributed)} | share ${pct(x.coverage)} -> ${pct(y.coverage)} | lit ${x.jurisdictionsLit.length} -> ${y.jurisdictionsLit.length}${added.length?` | new in top: ${added.join(', ')}`:''}`);
 }
}
if(explain&&refs.length>1){
 const first=detail[refs[0]],last=detail[refs[refs.length-1]];
 // Value of attributed transfers that ran through an inferred address under the first registry.
 const through=key=>first.recs.filter(r=>r.tx&&(`${r.chain}:${r.sender}`===key||`${r.chain}:${r.receiver}`===key)).reduce((s,r)=>s+(r.usdValue??0),0);
 const lost=[...first.inferred.keys()].filter(k=>!last.inferred.has(k)).map(k=>({k,v:through(k)})).sort((a,b)=>b.v-a.v);
 console.log(`\n== inferences lost ${refs[0]} -> ${refs[refs.length-1]}: ${lost.length}, gained: ${[...last.inferred.keys()].filter(k=>!first.inferred.has(k)).length} ==`);
 for(const {k,v} of lost.slice(0,10)){
  const [chain,address]=k.split(':');
  const outs={};
  for(const r of last.recs)if(r.chain===chain&&r.sender===address){const a=last.known(chain,r.receiver);const who=a?a.entity:'unlabelled';outs[who]=(outs[who]??0)+(r.usdValue??0);}
  const was=first.inferred.get(k).entity;
  // Inflows from outside the entity, as each registry's filtered feed sees them: the 80% forwarding test uses these.
  const inflow=d=>d.recs.filter(r=>r.chain===chain&&r.receiver===address&&d.known(chain,r.sender)?.entity!==was).reduce((s,r)=>s+(r.usdValue??0),0);
  console.log(`${k} was ${was}'s deposit, carrying ${fm(v)} attributed; now pays ${Object.entries(outs).map(([w,x])=>`${w} ${fm(x)}`).join(', ')}; visible inflow from outside ${was} ${fm(inflow(first))} -> ${fm(inflow(last))}`);
 }
}
if(Object.values(missing).some(Boolean))console.log('\nWARNING: some block queries failed, so this window is incomplete; re-run before trusting it.');
if(outFile){writeFileSync(outFile,JSON.stringify({window:windowFile,at,missing,results},null,1)+'\n');console.log('wrote',outFile);}
