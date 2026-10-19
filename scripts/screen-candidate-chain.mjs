/**
 * Screen a chain the build does NOT read yet. For a candidate chain, takes the registry's Ethereum plain-account
 * wallets (the set that would derive onto any EVM chain) and reports which of them moved issuer-native USDC or USDT
 * there in the last N days. This is the gate for adding a chain: rank candidates by measured
 * evidenced activity, never by chain volume. Activity is a prioritisation signal, never evidence.
 *
 *   node scripts/screen-candidate-chain.mjs <Name> <days> [--out file.json]
 *
 * Unlike registry/screen-activity.mjs it needs no entry in model.ts, evm.ts or rpc-pool.mjs, so a candidate can be
 * measured before anything is wired. Token contracts below were read from Circle's USDC registry and Tether's
 * supported-protocols page on 2026-10-01; re-read them before trusting a row. Endpoints are the keyless ones that
 * passed a filtered eth_getLogs that day (docs/measurements/2026-10-01/new-sources.md). Run from the repo root.
 */
import {readFileSync,writeFileSync} from 'node:fs';
const CFG={
 Optimism:{tokens:{'0x0b2c639c533813f4aa9d7837caf62653d097ff85':'USDC'},slot:2,span:5000,urls:['https://optimism-rpc.publicnode.com','https://optimism.gateway.tenderly.co','https://mainnet.optimism.io']},
 Polygon:{tokens:{'0x3c499c542cef5e3811e1192ce70d8cc03d5c3359':'USDC'},slot:1.5,span:20000,urls:['https://polygon.gateway.tenderly.co','https://rpc.sentio.xyz/matic']},
 Linea:{tokens:{'0x176211869ca2b568f2a7d4ee941e073a821ee1ff':'USDC'},slot:6.6,span:5000,urls:['https://linea.gateway.tenderly.co','https://rpc.linea.build']},
 Unichain:{tokens:{'0x078d782b760474a361dda0af3839290b0ef57ad6':'USDC'},slot:1,span:5000,urls:['https://unichain.gateway.tenderly.co','https://mainnet.unichain.org','https://unichain-rpc.publicnode.com']},
 WorldChain:{tokens:{'0x79a02482a880bce3f13e09da970dc34db4cd24d1':'USDC'},slot:2,span:5000,urls:['https://worldchain-mainnet.gateway.tenderly.co']},
 ZKsync:{tokens:{'0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4':'USDC'},slot:6.7,span:5000,urls:['https://mainnet.era.zksync.io']},
 Ink:{tokens:{'0x2d270e6886d130d724215a266106e6832161eaed':'USDC'},slot:1,span:5000,urls:['https://rpc-qnd.inkonchain.com','https://rpc-gel.inkonchain.com']},
 Plasma:{tokens:{'0x2d661c89d812261039af9764eceaaee884f5f67f':'USDC'},slot:1,span:5000,urls:['https://rpc.plasma.to']},
 Kaia:{tokens:{'0xd077a400968890eacc75cdc901f0356c943e4fdb':'USDT'},slot:1,span:5000,urls:['https://public-en.node.kaia.io']},
 Cronos:{tokens:{'0x3d7f2c478aafdb65542bcb44bceec05849999d2d':'USDC'},slot:0.41,span:5000,urls:['https://cronos-evm-rpc.publicnode.com','https://evm.cronos.org']},
 Sei:{tokens:{'0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392':'USDC'},slot:0.47,span:2000,urls:['https://evm-rpc.sei-apis.com']},
 Morph:{tokens:{'0xcfb1186f4e93d60e60a8bdd997427d1f33bc372b':'USDC'},slot:1.77,span:5000,urls:['https://rpc.morphl2.io','https://rpc-quicknode.morphl2.io']},
 XDC:{tokens:{'0xfa2958cb79b0491cc627c1557f441ef849ca8eb1':'USDC'},slot:2.75,span:1000,urls:['https://rpc.xdcrpc.com']},
 Sonic:{tokens:{'0x29219dd400f2bf60e5a23d13be72b486d4038894':'USDC'},slot:1.67,span:5000,slice:450,urls:['https://rpc.soniclabs.com','https://sonic-rpc.publicnode.com']},
 HyperEVM:{tokens:{'0xb88339cb7199b77e23db6e890353e22632ba630f':'USDC'},slot:0.98,span:1000,slice:900,pause:1200,urls:['https://rpc.hyperliquid.xyz/evm']},
 XLayer:{tokens:{'0xb6ceceab302e2e4948951ee7843fc24e92933061':'USDC'},slot:1,span:100,pause:150,urls:['https://rpc.xlayer.tech','https://xlayerrpc.okx.com']},
 Kava:{tokens:{'0x919c1c267bc06a7039e03fcc2ef738525769109c':'USDT'},slot:6,span:2000,urls:['https://evm.kava.io','https://kava-evm-rpc.publicnode.com']}
};
const [name,daysArg]=process.argv.slice(2);const outAt=process.argv.indexOf('--out');const c=CFG[name],days=Number(daysArg);
if(!c||!(days>0)){console.error('usage: node screen-chain.mjs <'+Object.keys(CFG).join('|')+'> <days>');process.exit(1);}
const T='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const probe=JSON.parse(readFileSync('scripts/registry/code-probe.json','utf8'));
const rows=readFileSync('scripts/registry/addresses.txt','utf8').split(/\r?\n/).filter(l=>l.startsWith('Ethereum|')).map(l=>l.split('|'));
const cands=new Map(rows.filter(r=>probe.Ethereum[r[2]]&&probe.Ethereum[r[2]]!=='contract').map(r=>[r[2],{entity:r[1],label:r[3]}]));
const list=[...cands.keys()];
const hex=n=>'0x'+n.toString(16),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function rpc1(url,method,params,ms=45000){
 const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),ms);
 try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:ctl.signal});
  const txt=await r.text();let j;try{j=JSON.parse(txt);}catch{throw Error(`HTTP ${r.status} ${txt.slice(0,60)}`);}
  if(j.error)throw Error(`${j.error.code} ${String(j.error.message).slice(0,90)}`);if(j.result==null)throw Error('no result');return j.result;
 }finally{clearTimeout(t);}
}
async function rpc(method,params){let last;for(let i=0;i<3;i++)for(const u of c.urls){try{return await rpc1(u,method,params);}catch(e){last=e;await sleep(700*(i+1));}}throw last;}
const head=parseInt(await rpc('eth_blockNumber',[]),16);
const end=head-5,start=end-Math.round(days*86400/c.slot)+1;
console.error(`${name}: ${list.length} candidates, ${days} day(s), blocks ${start}..${end}`);
async function logsFor(a,b,topics){
 try{return await rpc('eth_getLogs',[{fromBlock:hex(a),toBlock:hex(b),address:Object.keys(c.tokens),topics}]);}
 catch(e){if(b-a<20)throw e;const m=Math.floor((a+b)/2);return [...await logsFor(a,m,topics),...await logsFor(m+1,b,topics)];}
}
const stats=new Map(list.map(a=>[a,{in:0,out:0,n:0}]));const seen=new Set();let failed=0,q=0;
const SL=c.slice||900;
for(let i=0;i<list.length;i+=SL){
 const slice=list.slice(i,i+SL).map(a=>'0x'+'0'.repeat(24)+a.slice(2));
 for(let a=start;a<=end;a+=c.span){
  const b=Math.min(a+c.span-1,end);
  for(const topics of [[T,slice,null],[T,null,slice]]){
   try{for(const l of await logsFor(a,b,topics)){
    const k=l.transactionHash+':'+l.logIndex;if(seen.has(k)||l.topics.length!==3)continue;seen.add(k);
    const v=Number(BigInt(l.data))/1e6;const f='0x'+l.topics[1].slice(26),t='0x'+l.topics[2].slice(26);
    const sf=stats.get(f),st=stats.get(t);if(sf){sf.out+=v;sf.n++;}if(st){st.in+=v;st.n++;}
   }}catch(e){failed++;console.error(`blocks ${a}..${b} failed: ${e.message}`);}
   q++;if(q%50===0)console.error(`  ${name} ${q} queries, at ${(100*(a-start)/(end-start)).toFixed(0)}%`);
   await sleep(c.pause??250);
  }
 }
}
const fm=x=>x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(2)+'M':x>=1e3?(x/1e3).toFixed(0)+'k':x.toFixed(0);
const out=[...stats.entries()].map(([a,s])=>({address:a,...cands.get(a),...s,value:s.in+s.out})).filter(r=>r.n>0).sort((x,y)=>y.value-x.value);
const over=out.filter(r=>r.value>=100000);
const byEntity={};for(const r of out)byEntity[r.entity]=(byEntity[r.entity]||0)+r.value;
console.log(`== ${name}: ${days}d, active ${out.length} of ${list.length}, over $100k: ${over.length}, total face value ${fm(out.reduce((s,r)=>s+r.value,0))}${failed?`, ${failed} FAILED QUERIES (idle not conclusive)`:''}`);
console.log('   entities: '+Object.entries(byEntity).sort((a,b)=>b[1]-a[1]).map(([e,v])=>`${e} ${fm(v)}`).join(', '));
for(const r of out.slice(0,40))console.log(`   ${r.address} ${r.entity.padEnd(18)} ${r.label.padEnd(30)} in ${fm(r.in).padStart(8)} out ${fm(r.out).padStart(8)} (${r.n})`);
if(outAt>-1)writeFileSync(process.argv[outAt+1],JSON.stringify({chain:name,days,asOf:new Date().toISOString(),blocks:[start,end],failedQueries:failed,candidates:list.length,rows:out},null,1));
