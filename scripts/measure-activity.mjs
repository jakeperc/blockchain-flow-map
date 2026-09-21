/**
 * Diagnostic, not shipped and not shown to visitors: how much of the evidence registry is actually active?
 * Pulls ERC-20 Transfer logs for one chain and window, filtered to exactly the addresses the live feed filters on
 * (first-party rows plus DERIVED cross-chain rows, via evidencedAddresses()), and reports from real chain data:
 *   - per-entity sent/received value, active wallets against registered wallets, and idle entities
 *   - DIRECT edges where both ends are evidenced wallets of different entities, by entity and by jurisdiction
 *   - the largest unlabelled counterparties of registry wallets, overall and per entity (per entity in --out only).
 *     These are research leads, not evidence: nothing is admissible until the address's own explorer page shows a
 *     public name tag (scripts/registry/read-tag.mjs).
 * Values are token units at face value (stablecoins treated as ~USD); no price feed is applied. Deposit-address
 * inference is not modelled, so corridors on the map can exceed the direct edges reported here (measure those with
 * measure-corridors.mjs). One window is a snapshot: repeat at other times of day with --end-hours-ago.
 *
 *   node scripts/measure-activity.mjs <Ethereum|Base|Arbitrum> [hours=4] [--end-hours-ago N] [--out file.json]
 *
 * Run from the repo root.
 */
import {writeFileSync} from 'node:fs';
import {POOLS,rpcPool,sleep} from './rpc-pool.mjs';
import {loadAtlas,evidenceMap} from './atlas-modules.mjs';

const args=process.argv.slice(2);
const opt=n=>{const i=args.indexOf(n);return i>-1?args[i+1]:undefined;};
const chain=args[0];
const hours=Number(args[1]&&!args[1].startsWith('--')?args[1]:4);
const endAgo=Number(opt('--end-hours-ago')??0);
const outFile=opt('--out');
const pool=POOLS[chain];
if(!pool||!(hours>0)){console.error('usage: node scripts/measure-activity.mjs <Ethereum|Base|Arbitrum> [hours=4] [--end-hours-ago N] [--out file.json]');process.exit(1);}
// eth.drpc.org rejects a topic position with 1,024+ entries (measured 2026-09-21); 1,000 passes.
const TOPIC_CAP=1000;
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const atlas=loadAtlas();
const {ENTITIES}=atlas['known-entities'];
const {CONTRACTS}=atlas.evm;
const reg=evidenceMap(atlas,chain);
const tokens=Object.fromEntries(Object.entries(CONTRACTS[chain]).map(([a,t])=>[a.toLowerCase(),t]));
const addrs=[...reg.keys()];
const derivedCount=[...reg.values()].filter(r=>r.derived).length;
const pad=a=>'0x'+'0'.repeat(24)+a.slice(2).toLowerCase();
const hex=n=>'0x'+n.toString(16);
const meta=id=>ENTITIES[id]??{name:id,jurisdiction:'??',category:'exchange'};
console.log(`${chain}: ${addrs.length} evidenced addresses in the live filter (${addrs.length-derivedCount} first-party, ${derivedCount} derived); filter slots used ${addrs.length} of ${TOPIC_CAP}`);

const head=parseInt(await rpcPool(pool.urls,'eth_blockNumber',[]),16);
const end=head-Math.round(endAgo*3600/pool.slotSec)-5,start=end-Math.round(hours*3600/pool.slotSec)+1;
const asOf=new Date().toISOString();
console.log(`Window: blocks ${start}..${end} (~${hours} h, ending ~${endAgo} h ago) as of ${asOf}`);

/** One filtered query; on failure bisect the range down to 50 blocks so one bad chunk does not blank the window. */
async function logsFor(a,b,topics){
 try{return await rpcPool(pool.urls,'eth_getLogs',[{fromBlock:hex(a),toBlock:hex(b),address:Object.keys(tokens),topics}]);}
 catch(e){
  if(b-a<50)throw e;
  const m=Math.floor((a+b)/2);
  return [...await logsFor(a,m,topics),...await logsFor(m+1,b,topics)];
 }
}
const seen=new Set(),logs=[];let failed=0,failedBlocks=0;
for(let a=start;a<=end;a+=pool.chunk){
 const b=Math.min(a+pool.chunk-1,end);
 for(const topics of [[TRANSFER,addrs.map(pad),null],[TRANSFER,null,addrs.map(pad)]]){
  try{for(const l of await logsFor(a,b,topics)){const k=`${l.transactionHash}:${l.logIndex}`;if(!seen.has(k)){seen.add(k);logs.push(l);}}}
  catch(e){failed++;failedBlocks+=b-a+1;console.warn(`chunk ${a}..${b} failed: ${e.message}`);}
  await sleep(pool.pauseMs);
 }
}
console.log(`logs ${logs.length}, failed chunk queries ${failed}${failed?` (window incomplete by up to ${failedBlocks} blocks)`:''}`);

const per={},edges={},jedges={},unl={},cpByEntity={},active=new Map();
let touch=0,cross=0,same=0,nonExchange=0;
const E=id=>per[id]??={sent:0,recv:0,n:0,wallets:new Set(),derivedActive:new Set()};
const mark=(addr,r,x)=>{x.wallets.add(addr);if(r.derived)x.derivedActive.add(addr);active.set(addr,r.derived);};
for(const l of logs){
 if(l.removed||l.topics.length!==3||!/^0x[0-9a-fA-F]{64}$/.test(l.data))continue;
 const tk=tokens[l.address.toLowerCase()];if(!tk)continue;
 const from='0x'+l.topics[1].slice(26).toLowerCase(),to='0x'+l.topics[2].slice(26).toLowerCase();
 const v=Number(BigInt(l.data))/10**tk.decimals;
 const rf=reg.get(from),rt=reg.get(to);
 if(rf){const x=E(rf.entity);x.sent+=v;x.n++;mark(from,rf,x);}
 if(rt){const x=E(rt.entity);x.recv+=v;x.n++;mark(to,rt,x);}
 if(!rf&&!rt)continue;
 touch+=v;
 if(rf&&rt){
  if(rf.entity===rt.entity){same+=v;continue;}
  cross+=v;
  if(meta(rf.entity).category!=='exchange'||meta(rt.entity).category!=='exchange')nonExchange+=v;
  const k=`${rf.entity}>${rt.entity}`;edges[k]=(edges[k]??0)+v;
  const jk=`${rf.jurisdiction}>${rt.jurisdiction}`;jedges[jk]=(jedges[jk]??0)+v;
 }else{
  const other=rf?to:from,ent=(rf??rt).entity,dir=rf?'out':'in',side=`${rf?'from':'to'} ${ent}`;
  const u=unl[other]??={v:0,n:0,sides:{}};u.v+=v;u.n++;u.sides[side]=(u.sides[side]??0)+v;
  const c=(cpByEntity[ent]??={})[other]??={in:0,out:0,n:0};c[dir]+=v;c.n++;
 }
}
const fm=x=>x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(2)+'M':x>=1e3?(x/1e3).toFixed(0)+'k':x.toFixed(0);
const regCount={};for(const r of reg.values())regCount[r.entity]=(regCount[r.entity]??0)+1;
const entRows=Object.entries(per).sort((a,b)=>(b[1].sent+b[1].recv)-(a[1].sent+a[1].recv));
const idle=Object.keys(regCount).filter(id=>!per[id]);
const top=(o,n)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n);
const unlTop=Object.entries(unl).sort((a,b)=>b[1].v-a[1].v).slice(0,25);
const activeDerived=[...active.values()].filter(Boolean).length;

console.log(`\nvalue touching the registry: ${fm(touch)} | cross-entity, both ends evidenced: ${fm(cross)} (${touch?(100*cross/touch).toFixed(1):0}%) | same-entity (treasury): ${fm(same)}`);
console.log(`cross-entity value with a non-exchange end (market maker, broker, custodian): ${fm(nonExchange)} of ${fm(cross)}`);
console.log(`active wallets: ${active.size} of ${addrs.length} (${(100*active.size/Math.max(1,addrs.length)).toFixed(0)}%); of the active, ${activeDerived} derived`);
console.log('\n== ENTITY ACTIVITY (sent+recv counts intra-entity moves twice; d=active derived wallets) ==');
for(const [id,x] of entRows)console.log(`${id.padEnd(15)} ${meta(id).jurisdiction} ${meta(id).category.padEnd(13)} sent ${fm(x.sent).padStart(8)} recv ${fm(x.recv).padStart(8)} n ${String(x.n).padStart(5)} active ${x.wallets.size}/${regCount[id]}${x.derivedActive.size?` (d ${x.derivedActive.size})`:''}`);
console.log(`\n== IDLE ENTITIES (${idle.length} of ${Object.keys(regCount).length}, evidenced wallets in brackets) ==\n${idle.map(id=>`${id}(${regCount[id]},${meta(id).jurisdiction})`).join(' ')||'none'}`);
console.log('\n== DIRECT ENTITY EDGES =='+(Object.keys(edges).length?'':' none'));
for(const [k,v] of top(edges,20))console.log(k.padEnd(28),fm(v));
console.log('\n== DIRECT JURISDICTION EDGES (same-jurisdiction pairs are domestic and draw no route) =='+(Object.keys(jedges).length?'':' none'));
for(const [k,v] of top(jedges,20))console.log(k.padEnd(10),fm(v));
console.log('\n== TOP UNLABELLED COUNTERPARTIES (leads only; read the address page with scripts/registry/read-tag.mjs) ==');
for(const [a,x] of unlTop)console.log(a,fm(x.v).padStart(8),'n',String(x.n).padStart(4),top(x.sides,2).map(([s,v])=>`${s} ${fm(v)}`).join('; '));
console.log('\nSnapshot only: face-value units, direct edges only, one window. Repeat at other times of day.');

if(outFile){
 writeFileSync(outFile,JSON.stringify({chain,hours,endHoursAgo:endAgo,asOf,blocks:[start,end],evidencedAddresses:addrs.length,derivedAddresses:derivedCount,failedChunkQueries:failed,
  touching:touch,crossEntity:cross,crossEntityNonExchange:nonExchange,sameEntity:same,activeWallets:active.size,activeDerived,
  activeAddresses:[...active.keys()],
  entities:entRows.map(([id,x])=>({id,jurisdiction:meta(id).jurisdiction,category:meta(id).category,sent:x.sent,recv:x.recv,transfers:x.n,activeWallets:x.wallets.size,activeDerived:x.derivedActive.size,evidenced:regCount[id]})),
  idleEntities:idle,entityEdges:top(edges,50),jurisdictionEdges:top(jedges,50),
  unlabelledCounterparties:unlTop.map(([address,x])=>({address,value:x.v,transfers:x.n,sides:x.sides})),
  counterpartiesByEntity:Object.fromEntries(Object.entries(cpByEntity).map(([ent,m])=>[ent,Object.entries(m).sort((a,b)=>(b[1].in+b[1].out)-(a[1].in+a[1].out)).slice(0,25).map(([address,c])=>({address,in:c.in,out:c.out,transfers:c.n}))]))},null,1)+'\n');
 console.log('wrote',outFile);
}
