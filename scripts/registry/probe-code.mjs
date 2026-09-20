/**
 * Mechanically classify every registry address on each EVM chain with eth_getCode:
 *   eoa        — no code; a plain key-controlled account
 *   delegated  — an EIP-7702 delegation designator (0xef0100 + 20-byte target); still key-controlled
 *   contract   — anything else
 *
 * This matters because an Ethereum label is evidence about Ethereum. A plain account's address derives
 * from its key, so the same key holder controls that address on every EVM chain, and reusing the label
 * there is a defensible (and clearly marked) derivation. A CONTRACT address does not carry: the same
 * address on Base may be an unrelated deployment or nothing at all. So the generator refuses to derive
 * from anything that is not eoa/delegated on BOTH the source and the target chain.
 *
 *   node scripts/registry/probe-code.mjs [addresses.txt] [code-probe.json]
 *
 * Re-runnable and cached: addresses already in the output file are skipped unless --refresh.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const [,,src='scripts/registry/addresses.txt',dst='scripts/registry/code-probe.json']=process.argv;
const refresh=process.argv.includes('--refresh');
const CHAINS={
 Ethereum:['https://eth.drpc.org','https://rpc.mevblocker.io','https://1rpc.io/eth','https://eth-pokt.nodies.app'],
 Base:['https://mainnet.base.org','https://base.drpc.org','https://base-rpc.publicnode.com','https://1rpc.io/base'],
 Arbitrum:['https://arb1.arbitrum.io/rpc','https://arbitrum.drpc.org','https://arbitrum-one-rpc.publicnode.com','https://1rpc.io/arb']
};
const BATCH=3,PAUSE_MS=150;
const rows=readFileSync(src,'utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'));
// Accept both the legacy 4-column and the chain-qualified 6-column format.
const addrs=[...new Set(rows.map(l=>{const p=l.split('|');return (p.length>=6?p[2]:p[1]).trim().toLowerCase();}).filter(a=>/^0x[0-9a-f]{40}$/.test(a)))];
const out=existsSync(dst)&&!refresh?JSON.parse(readFileSync(dst,'utf8')):{};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const classify=code=>code==='0x'||code===''?'eoa':/^0xef0100[0-9a-f]{40}$/i.test(code)?'delegated':'contract';
async function post(urls,body){
 let last=null;
 for(let attempt=0;attempt<urls.length*2;attempt++){
  const url=urls[attempt%urls.length];
  try{
   const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
   const t=await r.text();const j=JSON.parse(t);
   if(Array.isArray(j)&&j.every(x=>x&&!x.error))return j;
   if(!Array.isArray(j)&&j.result!==undefined)return [j];
   last=Error(JSON.stringify(j).slice(0,120));
  }catch(e){last=e;}
  await sleep(400*(attempt+1));
 }
 throw last;
}
for(const [chain,urls] of Object.entries(CHAINS)){
 out[chain]=out[chain]??{};
 const todo=addrs.filter(a=>!(a in out[chain]));
 console.log(`${chain}: ${todo.length} to probe (${addrs.length-todo.length} cached)`);
 for(let i=0;i<todo.length;i+=BATCH){
  const slice=todo.slice(i,i+BATCH);
  try{
   const res=await post(urls,slice.map((a,j)=>({jsonrpc:'2.0',id:j+1,method:'eth_getCode',params:[a,'latest']})));
   for(const r of res){const a=slice[r.id-1];if(a&&typeof r.result==='string')out[chain][a]=classify(r.result);}
  }catch(e){
   // Single-call fallback so one bad batch does not leave holes.
   for(const a of slice){try{const [r]=await post(urls,{jsonrpc:'2.0',id:1,method:'eth_getCode',params:[a,'latest']});if(typeof r.result==='string')out[chain][a]=classify(r.result);}catch{console.warn(`  ${chain} ${a}: unprobed (${String(e.message).slice(0,60)})`);}}
  }
  if((i/BATCH)%50===0)writeFileSync(dst,JSON.stringify({probedAt:new Date().toISOString().slice(0,10),...out},null,0));
  await sleep(PAUSE_MS);
 }
 const counts={eoa:0,delegated:0,contract:0};for(const k of Object.values(out[chain]))counts[k]++;
 console.log(`${chain}: eoa ${counts.eoa}, delegated ${counts.delegated}, contract ${counts.contract}, unprobed ${addrs.filter(a=>!(a in out[chain])).length}`);
}
writeFileSync(dst,JSON.stringify({probedAt:new Date().toISOString().slice(0,10),...Object.fromEntries(Object.entries(out).filter(([k])=>k!=='probedAt'))},null,0)+'\n');
console.log('wrote',dst);
