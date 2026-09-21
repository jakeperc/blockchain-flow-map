/**
 * Screen candidate wallets for real stablecoin activity before spending explorer requests or filter slots on them.
 * Reads USDC/USDT Transfer logs for the candidates over the last N days from the free public RPCs (the same token
 * contracts the live feed reads) and reports, per address, transfers in and out, face value, and the last block it
 * moved in. Also flags addresses that already carry evidence on that chain (first-party or derived).
 *
 * Activity is a prioritisation signal, never evidence: an active wallet is admitted only after its own explorer page
 * shows a public name tag (read-tag.mjs) and an operator document exists. Values are token units at face value.
 *
 *   node scripts/registry/screen-activity.mjs <Ethereum|Base|Arbitrum> <days> <candidates.txt | 0xaddr ...> [--chunk N] [--out f.json]
 *
 * candidates.txt: one address per line, optionally followed by `|label` or whitespace and a label; `#` comments.
 * Run from the repo root.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {POOLS,rpcPool,sleep} from '../rpc-pool.mjs';
import {loadAtlas,evidenceMap} from '../atlas-modules.mjs';

const args=process.argv.slice(2);
const opt=n=>{const i=args.indexOf(n);return i>-1?args[i+1]:undefined;};
const [chain,daysArg]=args;const days=Number(daysArg);
const pool=POOLS[chain];
const rest=args.slice(2).filter((a,i,arr)=>!a.startsWith('--')&&!['--chunk','--out'].includes(arr[i-1]));
if(!pool||!(days>0)||!rest.length){console.error('usage: node scripts/registry/screen-activity.mjs <Ethereum|Base|Arbitrum> <days> <candidates.txt | 0xaddr ...> [--chunk N] [--out f.json]');process.exit(1);}
const chunk=Number(opt('--chunk')??(chain==='Ethereum'?2000:chain==='Base'?2000:4000));
const outFile=opt('--out');
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const hex=n=>'0x'+n.toString(16);
const pad=a=>'0x'+'0'.repeat(24)+a.slice(2).toLowerCase();

const cands=new Map();
for(const src of rest){
 const lines=existsSync(src)?readFileSync(src,'utf8').split(/\r?\n/):[src];
 for(const line of lines){
  const m=line.trim().match(/^(0x[0-9a-fA-F]{40})\s*\|?\s*(.*)$/);
  if(m&&!line.trim().startsWith('#'))cands.set(m[1].toLowerCase(),m[2].trim());
 }
}
const atlas=loadAtlas();
const known=evidenceMap(atlas,chain);
const tokens=Object.fromEntries(Object.entries(atlas.evm.CONTRACTS[chain]).map(([a,t])=>[a.toLowerCase(),t]));
const list=[...cands.keys()];
const head=parseInt(await rpcPool(pool.urls,'eth_blockNumber',[]),16);
const end=head-5,start=end-Math.round(days*86400/pool.slotSec)+1;
console.log(`${chain}: screening ${list.length} candidates over ~${days} day(s), blocks ${start}..${end}, as of ${new Date().toISOString()}`);

async function logsFor(a,b,topics){
 try{return await rpcPool(pool.urls,'eth_getLogs',[{fromBlock:hex(a),toBlock:hex(b),address:Object.keys(tokens),topics}]);}
 catch(e){if(b-a<20)throw e;const m=Math.floor((a+b)/2);return [...await logsFor(a,m,topics),...await logsFor(m+1,b,topics)];}
}
const stats=new Map(list.map(a=>[a,{in:0,out:0,nIn:0,nOut:0,last:0}]));
const seen=new Set();let failed=0;
for(let i=0;i<list.length;i+=900){
 const slice=list.slice(i,i+900).map(pad);
 for(let a=start;a<=end;a+=chunk){
  const b=Math.min(a+chunk-1,end);
  for(const topics of [[TRANSFER,slice,null],[TRANSFER,null,slice]]){
   try{
    for(const l of await logsFor(a,b,topics)){
     const k=`${l.transactionHash}:${l.logIndex}`;if(seen.has(k)||l.topics.length!==3)continue;seen.add(k);
     const tk=tokens[l.address.toLowerCase()];if(!tk)continue;
     const v=Number(BigInt(l.data))/10**tk.decimals,bn=parseInt(l.blockNumber,16);
     const from='0x'+l.topics[1].slice(26).toLowerCase(),to='0x'+l.topics[2].slice(26).toLowerCase();
     const sf=stats.get(from),st=stats.get(to);
     if(sf){sf.out+=v;sf.nOut++;sf.last=Math.max(sf.last,bn);}
     if(st){st.in+=v;st.nIn++;st.last=Math.max(st.last,bn);}
    }
   }catch(e){failed++;console.warn(`blocks ${a}..${b} failed: ${e.message}`);}
   await sleep(pool.pauseMs);
  }
 }
}
const fm=x=>x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(2)+'M':x>=1e3?(x/1e3).toFixed(0)+'k':x.toFixed(0);
const rows=[...stats.entries()].map(([a,s])=>({address:a,label:cands.get(a)||'',...s,value:s.in+s.out,hoursAgo:s.last?Math.round((end-s.last)*pool.slotSec/3600):null,evidenced:known.get(a)?(known.get(a).derived?'derived':'first-party'):''}))
 .sort((x,y)=>y.value-x.value);
const active=rows.filter(r=>r.nIn+r.nOut>0);
console.log(`active ${active.length} of ${rows.length}${failed?`; ${failed} chunk queries failed, so idle results are not conclusive`:''}\n`);
for(const r of rows)console.log(`${r.address} ${(r.label||'').slice(0,34).padEnd(34)} ${r.nIn+r.nOut?`in ${fm(r.in).padStart(7)} (${r.nIn}) out ${fm(r.out).padStart(7)} (${r.nOut}) last ~${r.hoursAgo}h ago`:'idle'}${r.evidenced?`  [already ${r.evidenced}]`:''}`);
if(outFile){writeFileSync(outFile,JSON.stringify({chain,days,asOf:new Date().toISOString(),blocks:[start,end],failedChunkQueries:failed,rows},null,1)+'\n');console.log('wrote',outFile);}
