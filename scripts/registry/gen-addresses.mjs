/**
 * Generate lib/atlas/known-addresses.ts from the curated list and the mechanical code probe.
 *
 *   node scripts/registry/gen-addresses.mjs scripts/registry/addresses.txt lib/atlas/known-addresses.ts
 *
 * addresses.txt rows are `chain|entity|address|label|checked|note`; `#` lines are comments. `checked`
 * is the date the address's own explorer page was read, per row — admissible() refuses evidence older
 * than 180 days, so it must be real, never a placeholder. code-probe.json (from probe-code.mjs) supplies
 * each address's kind on each chain; a row with no probe entry fails the build, so a registry can never
 * ship with an unknown wallet type.
 *
 * DERIVED rows: an Ethereum row whose address is a plain key-controlled account (eoa or delegated) on
 * Ethereum AND on the target chain is listed as derivable there, unless a first-party row already exists
 * for that chain and address (first-party always wins). Contract addresses never derive: the same
 * address on another chain may be an unrelated deployment.
 *
 * WATCHED: the live filter. dormancy.json (from measure-dormancy.mjs, decision D2) lists per chain the evidenced wallets
 * with no USDC/USDT transfer in the last 90 days; they stay in ADDRESSES/DERIVED as evidence but are left out of WATCHED,
 * so the browser does not upload or query them. Rows the measurement has not seen are watched by default.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {CHAINS as CHAIN_LIST,EVM_CHAINS} from '../chains.mjs';
const [,,src='scripts/registry/addresses.txt',dst='lib/atlas/known-addresses.ts']=process.argv;
const probePath=join(dirname(src),'code-probe.json');
const CHAINS=new Set(CHAIN_LIST);
const EVM=EVM_CHAINS;
const KINDS=new Set(['eoa','delegated','contract']);
const today=new Date().toISOString().slice(0,10);

const probe=JSON.parse(readFileSync(probePath,'utf8'));
if(!probe.probedAt||!/^\d{4}-\d{2}-\d{2}$/.test(probe.probedAt))throw Error('code-probe.json lacks a probedAt date');
const probeAge=(Date.now()-Date.parse(probe.probedAt))/86400000;
if(probeAge>150)throw Error(`code-probe.json is ${Math.round(probeAge)} days old; re-run probe-code.mjs`);

const lines=readFileSync(src,'utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'));
const seen=new Set();const groups=new Map();const byChainAddr=new Map();const orphans=[];
for(const l of lines){
 const p=l.split('|');
 if(p.length<5)throw Error('row needs chain|entity|address|label|checked|note: '+l);
 const [chain,entity,addr,label,checked,...rest]=p.map(s=>s.trim());
 const note=rest.join('|').trim();
 if(!CHAINS.has(chain))throw Error(`unknown chain '${chain}': ${l}`);
 const key=EVM.includes(chain)?addr.toLowerCase():addr;
 if(EVM.includes(chain)&&!/^0x[0-9a-f]{40}$/.test(key))throw Error('bad address '+addr);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(checked))throw Error(`'checked' must be an ISO date: ${l}`);
 if(checked>today)throw Error(`'checked' is in the future: ${l}`);
 if((Date.now()-Date.parse(checked))/86400000>150)throw Error(`'checked' ${checked} is close to the 180-day expiry; re-read the explorer page and update the date: ${l}`);
 const id=`${chain}:${key}`;
 if(seen.has(id))throw Error('duplicate '+id);
 seen.add(id);
 const kind=probe[chain]?.[key];
 if(EVM.includes(chain)&&!KINDS.has(kind))throw Error(`${id}: no code-probe entry; run scripts/registry/probe-code.mjs`);
 // An address that is a contract on Ethereum but carries no code on another chain is orphaned there:
 // the multisig or proxy that controls it on Ethereum does not exist on that chain, so nobody can spend
 // from it and inflows to it are stuck, not settlement. An explorer may still label it. Refuse it.
 if(chain!=='Ethereum'&&EVM.includes(chain)&&probe.Ethereum?.[key]==='contract'&&kind!=='contract'){orphans.push(`${id} (${label})`);continue;}
 if(!groups.has(entity))groups.set(entity,[]);
 const rec={id,chain,key,label,checked,kind:kind??'eoa',note};
 groups.get(entity).push(rec);
 byChainAddr.set(id,rec);
}

if(orphans.length)throw Error('orphaned rows, contracts on Ethereum with no code on the target chain; remove them from addresses.txt:\n  '+orphans.join('\n  '));

// Derivations: Ethereum plain accounts onto the other EVM chains.
const derived=[];
for(const target of EVM.filter(c=>c!=='Ethereum')){
 const addresses=[];
 for(const rec of byChainAddr.values()){
  if(rec.chain!=='Ethereum')continue;
  if(rec.kind==='contract')continue;
  const targetKind=probe[target]?.[rec.key];
  if(targetKind!=='eoa'&&targetKind!=='delegated')continue;
  if(byChainAddr.has(`${target}:${rec.key}`))continue; // first-party wins
  addresses.push(rec.key);
 }
 derived.push({chain:target,addresses});
}

// Dormancy tier (decision D2). dormancy.json comes from measure-dormancy.mjs: per EVM chain, the evidenced wallets with no
// USDC/USDT transfer in the window. They stay in ADDRESSES/DERIVED as evidence, and any transfer that touches one still
// resolves to its entity, but they leave the LIVE filter (WATCHED), which is what visitors' browsers send to the public
// RPCs. A row the measurement has not seen (added since) is watched by default: unmeasured is never dormant.
const dormancyPath=join(dirname(src),'dormancy.json');
let dormancy;
if(process.argv.includes('--bootstrap')){
 /**
  * Two circular cases need this, and both end with a real measurement.
  *  - known-addresses.ts does not compile at all: measure-dormancy.mjs loads it to find the evidenced addresses,
  *    so nothing can be measured until a file exists. With no dormancy.json this emits a 1970-dated one with
  *    every address watched, which verify-registry.cjs rejects as stale.
  *  - A CHAIN IS BEING ADDED: the new chain has no dormancy entry, but it also has no evidenced addresses to
  *    measure until this generator has emitted its derived rows. So the MISSING chains are filled in as
  *    unmeasured (all watched) and any real measurement for the other chains is left exactly as it is.
  * Neither can ship: verify-registry.cjs errors on a chain that has a live filter but no dormancy.json entry, so
  * the measurement is deferred, never skipped.
  */
 let existing=null;
 try{existing=JSON.parse(readFileSync(dormancyPath,'utf8'));}catch{/* no file yet */}
 const base=existing??{measuredAt:'1970-01-01',windowDays:90,chains:{}};
 const chains={...(base.chains??{})};
 const added=EVM.filter(c=>!chains[c]);
 for(const c of added)chains[c]={failedQueries:0,dormantAddresses:[],activeLastBlock:{}};
 dormancy={...base,chains};
 console.warn(`--bootstrap: ${added.length?`${added.join(', ')} treated as unmeasured (every address watched)`:'no chain was missing'}; run measure-dormancy.mjs before building`);
}else{
 try{dormancy=JSON.parse(readFileSync(dormancyPath,'utf8'));}
 catch(e){throw Error(`${dormancyPath} is required to build the live filter (run scripts/registry/measure-dormancy.mjs, or gen-addresses.mjs --bootstrap first if known-addresses.ts does not compile): ${e.message}`);}
}
if(!/^\d{4}-\d{2}-\d{2}$/.test(dormancy.measuredAt)||dormancy.measuredAt>today)throw Error('dormancy.json: measuredAt must be an ISO date, today or earlier');
if(!Number.isInteger(dormancy.windowDays)||dormancy.windowDays<90)throw Error('dormancy.json: windowDays must be an integer of at least 90; a shorter window would drop wallets that decision D2 keeps');
if(dormancy.endDaysAgo)throw Error('dormancy.json was measured as of a past date (--end-days-ago); that is a validation run, not a live filter');
const watched=[];const dormancyCounts={};const dormancyNotes=[];
const evidencedOn=chain=>{
 const out=[];
 // The same order known-entities.ts lists evidenced addresses in: first-party rows by entity group, then derived.
 for(const rows of groups.values())for(const r of rows)if(r.chain===chain)out.push(r.key);
 out.push(...(derived.find(d=>d.chain===chain)?.addresses??[]));
 return out;
};
// Only chains that actually carry evidence get a live filter. A newly added EVM chain has none until
// probe-code.mjs has probed it (which is what lets Ethereum plain accounts derive onto it), and demanding a
// dormancy entry for an empty chain would block the very first generate. verify-registry.cjs closes the gap
// from the other side: every chain in FEEDS must have a WATCHED entry, so a live chain cannot end up unfiltered.
for(const chain of EVM){
 if(!evidencedOn(chain).length){dormancyNotes.push(`${chain} no evidence yet, no live filter`);continue;}
 const c=dormancy.chains?.[chain];
 if(!c)throw Error(`dormancy.json has no ${chain} entry; run scripts/registry/measure-dormancy.mjs (--chains ${chain} to measure just this one)`);
 if(c.failedQueries!==0)throw Error(`dormancy.json: ${chain} scan had failed queries; an unread range cannot be called dormant`);
 const dormantSet=new Set(c.dormantAddresses),activeSet=new Set(Object.keys(c.activeLastBlock));
 for(const a of dormantSet){
  if(!/^0x[0-9a-f]{40}$/.test(a))throw Error(`dormancy.json: bad ${chain} address ${a}`);
  if(activeSet.has(a))throw Error(`dormancy.json: ${chain}:${a} is listed both dormant and active`);
 }
 const evidenced=evidencedOn(chain);
 const evSet=new Set(evidenced);
 const live=evidenced.filter(a=>!dormantSet.has(a));
 if(!live.length)throw Error(`${chain}: dormancy leaves an empty live filter`);
 watched.push({chain,addresses:live});
 dormancyCounts[chain]={evidenced:evidenced.length,watched:live.length,dormant:evidenced.length-live.length};
 dormancyNotes.push(`${chain} ${live.length}/${evidenced.length} watched${[...dormantSet].filter(a=>!evSet.has(a)).length?`, ${[...dormantSet].filter(a=>!evSet.has(a)).length} stale dormancy entries ignored`:''}${live.filter(a=>!activeSet.has(a)).length?`, ${live.filter(a=>!activeSet.has(a)).length} unmeasured (watched by default)`:''}`);
}

const q=s=>`'${String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'`;
const header=[
 '/**',
 ' * Chain-qualified addresses with public evidence of the operating entity that controls them. Pure data.',
 ' * Keys are `${chain}:${address}` (lowercase on EVM chains), matching the backend\'s evidence keys. `entity`',
 ' * is a key of ENTITIES in known-entities.ts; `label` is the exact public name tag read from the',
 ' * address\'s own explorer page on that chain; `checked` is the date it was read; `kind` is the result of',
 ' * eth_getCode on that chain. DERIVED lists Ethereum plain accounts that carry no code on the target',
 ' * chain either, so the same key holder controls the address there; known-entities.ts turns those into',
 ' * clearly-marked derived evidence at the minimum admissible score. Rules and the exclusion list live in',
 ' * known-entities.ts; read them before adding a line.',
 ' * GENERATED by scripts/registry/gen-addresses.mjs from scripts/registry/addresses.txt and',
 ' * scripts/registry/code-probe.json; edit those and regenerate.',
 ' */',
 "import type {Chain} from './model';",
 "export type AddressKind='eoa'|'delegated'|'contract';",
 'export interface AddressRecord {chain:Chain;entity:string;label:string;checked:string;kind:AddressKind;note?:string;}',
 'const a=(chain:Chain,entity:string,label:string,checked:string,kind:AddressKind,note?:string):AddressRecord=>note?{chain,entity,label,checked,kind,note}:{chain,entity,label,checked,kind};',
 'export const ADDRESSES:Record<string,AddressRecord>={'
];
const body=[];
for(const [entity,rows] of groups){
 body.push(' // '+entity);
 for(const r of rows)body.push(` ${q(r.id)}:a(${q(r.chain)},${q(entity)},${q(r.label)},${q(r.checked)},${q(r.kind)}${r.note?','+q(r.note):''}),`);
}
body[body.length-1]=body[body.length-1].replace(/,$/,'');
const tail=[
 '};',
 `/** Ethereum plain accounts with no contract code on the target chain (probed ${probe.probedAt}). Never hand-edited. */`,
 `export const CODE_PROBED_AT=${q(probe.probedAt)};`,
 'export const DERIVED:{chain:Chain;addresses:string[]}[]=[',
 ...derived.map((d,i)=>` {chain:${q(d.chain)},addresses:[${d.addresses.map(q).join(',')}]}${i<derived.length-1?',':''}`),
 '];',
 `/** Dormancy tier (decision D2): the measurement that produced WATCHED. \`dormant\` wallets are still evidence but are not queried live. */`,
 `export const DORMANCY:{measuredAt:string;windowDays:number;counts:Record<string,{evidenced:number;watched:number;dormant:number}>}={measuredAt:${q(dormancy.measuredAt)},windowDays:${dormancy.windowDays},counts:${JSON.stringify(dormancyCounts)}};`,
 '/** The live filter: evidenced addresses per chain minus the dormant tier. Never hand-edited; regenerate after measure-dormancy.mjs. */',
 'export const WATCHED:{chain:Chain;addresses:string[]}[]=[',
 ...watched.map((w,i)=>` {chain:${q(w.chain)},addresses:[${w.addresses.map(q).join(',')}]}${i<watched.length-1?',':''}`),
 '];',
 ''
];
writeFileSync(dst,[...header,...body,...tail].join('\n'));
const perChain={};for(const r of byChainAddr.values())perChain[r.chain]=(perChain[r.chain]??0)+1;
const kinds={};for(const r of byChainAddr.values())kinds[r.kind]=(kinds[r.kind]??0)+1;
console.log('addresses:',seen.size,JSON.stringify(perChain),'kinds:',JSON.stringify(kinds),'entities:',groups.size,'derived:',derived.map(d=>`${d.chain}=${d.addresses.length}`).join(' '));
console.log(`live filter (dormancy measured ${dormancy.measuredAt}, ${dormancy.windowDays} days): ${dormancyNotes.join('; ')}`);
