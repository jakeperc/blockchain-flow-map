/**
 * Registry integrity check. Compile the pure modules first, then run:
 *   node node_modules/typescript/bin/tsc lib/atlas/model.ts lib/atlas/geography.ts lib/atlas/known-addresses.ts lib/atlas/known-entities.ts --module commonjs --outDir <scratch> --target ES2020 --skipLibCheck --esModuleInterop
 *   node scripts/verify-registry.cjs <scratch> [--horizon-days N]
 *
 * The horizon is the point of this check. admissible() refuses evidence older than 180 days, so a build
 * published today with evidence checked 170 days ago goes blank ten days later with no error on screen.
 * Every attribution must therefore still be admissible N days from now (default 60), as an ERROR.
 * Do not "fix" a horizon failure by stamping future dates: admissible() also requires a non-negative
 * age, so a future date makes the evidence inadmissible immediately instead of eventually.
 */
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const {ADDRESSES,DERIVED,CODE_PROBED_AT}=require(root+'/known-addresses.js');
const {ENTITIES,knownAttribution,registryStats,registryHealth,evidencedAddresses,isDerived}=require(root+'/known-entities.js');
const {COUNTRIES,EXPLORERS}=require(root+'/geography.js');
const {admissible,CHAINS}=require(root+'/model.js');
const errors=[],warnings=[];const now=Date.now();
const hIdx=process.argv.indexOf('--horizon-days');
const HORIZON_DAYS=hIdx>-1?Number(process.argv[hIdx+1]):60;
if(!Number.isFinite(HORIZON_DAYS)||HORIZON_DAYS<0){console.error('--horizon-days must be a non-negative number');process.exit(1);}
const horizon=now+HORIZON_DAYS*86400000;
let expiringSoon=0;
const EVM=new Set(['Ethereum','Base','Arbitrum']);
const host=u=>{try{return new URL(u).host;}catch{return '';}};

/* ---------- First-party rows ---------- */
for(const [key,rec] of Object.entries(ADDRESSES)){
 const m=/^([A-Za-z]+):(.+)$/.exec(key);
 if(!m){errors.push(`${key}: key must be chain:address`);continue;}
 const [,chain,addr]=m;
 if(!CHAINS.includes(chain))errors.push(`${key}: unknown chain`);
 if(rec.chain!==chain)errors.push(`${key}: record chain '${rec.chain}' does not match the key`);
 if(EVM.has(chain)&&!/^0x[0-9a-f]{40}$/.test(addr))errors.push(`${key}: EVM address must be lowercase 0x hex`);
 if(!['eoa','delegated','contract'].includes(rec.kind))errors.push(`${key}: kind must be eoa, delegated or contract`);
 const ent=ENTITIES[rec.entity];
 if(!ent){errors.push(`${key}: unknown entity '${rec.entity}'`);continue;}
 if(!rec.label||rec.label.length<2)errors.push(`${key}: missing explorer label`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(rec.checked)||Date.parse(rec.checked)>now)errors.push(`${key}: 'checked' must be an ISO date, today or earlier`);
 const a=knownAttribution(chain,addr);
 if(!a||!admissible(a,now))errors.push(`${key}: knownAttribution() is not admissible (${a?a.confidence+'/'+a.jurisdiction+'/'+a.lastVerified:'null'})`);
 else{
  if(isDerived(a))errors.push(`${key}: a first-party row must never resolve to derived evidence`);
  if(host(a.sourceUrl)!==host(EXPLORERS[chain].address('x')))errors.push(`${key}: sourceUrl must point at ${EXPLORERS[chain].name}`);
  if(!a.evidenceNote.includes(EXPLORERS[chain].name))errors.push(`${key}: evidenceNote must name the explorer the label was read from`);
  if(!admissible(a,horizon)){expiringSoon++;if(expiringSoon<=5)errors.push(`${key}: evidence expires within ${HORIZON_DAYS} days (lastVerified ${a.lastVerified}) — re-verify before publishing`);}
 }
 if(now-Date.parse(rec.checked)>150*86400000)warnings.push(`${key}: checked ${rec.checked}, older than 150 days — re-verify before it expires at 180`);
}

/* ---------- Derived rows ---------- */
if(!/^\d{4}-\d{2}-\d{2}$/.test(CODE_PROBED_AT)||Date.parse(CODE_PROBED_AT)>now)errors.push('CODE_PROBED_AT must be an ISO date, today or earlier');
for(const d of DERIVED){
 if(!EVM.has(d.chain)||d.chain==='Ethereum')errors.push(`DERIVED: derivations only target Base or Arbitrum, not ${d.chain}`);
 for(const addr of d.addresses){
  const src=ADDRESSES[`Ethereum:${addr}`];
  if(!src){errors.push(`DERIVED ${d.chain}:${addr}: no Ethereum first-party row to derive from`);continue;}
  if(src.kind==='contract')errors.push(`DERIVED ${d.chain}:${addr}: the Ethereum row is a contract; contracts never derive`);
  if(ADDRESSES[`${d.chain}:${addr}`])errors.push(`DERIVED ${d.chain}:${addr}: a first-party row exists on that chain and must win`);
  const a=knownAttribution(d.chain,addr);
  if(!a){errors.push(`DERIVED ${d.chain}:${addr}: knownAttribution returned null`);continue;}
  if(!isDerived(a))errors.push(`DERIVED ${d.chain}:${addr}: must resolve to derived evidence`);
  for(const f of ['category','source','evidenceNote'])if(!a[f].includes('DERIVED'))errors.push(`DERIVED ${d.chain}:${addr}: ${f} must carry the DERIVED marker`);
  if(a.confidence!=='HIGH'||a.score!==.8)errors.push(`DERIVED ${d.chain}:${addr}: derived evidence must be HIGH at the minimum admissible score`);
  if(!admissible(a,now))errors.push(`DERIVED ${d.chain}:${addr}: not admissible`);
  if(host(a.sourceUrl)!==host(EXPLORERS[d.chain].address('x')))errors.push(`DERIVED ${d.chain}:${addr}: sourceUrl must point at ${EXPLORERS[d.chain].name}`);
 }
}
// A contract address must never resolve on another chain BY DERIVATION. It may resolve there through a
// first-party label of its own (a proxy wallet deployed on both chains), never by reusing the Ethereum one.
{
 let checked=0;
 for(const [k,r] of Object.entries(ADDRESSES)){
  if(!k.startsWith('Ethereum:')||r.kind!=='contract')continue;
  const addr=k.slice(9);
  for(const chain of ['Base','Arbitrum']){
   const a=knownAttribution(chain,addr);
   if(a&&isDerived(a))errors.push(`${k}: a contract must not resolve on ${chain} by derivation`);
   if(a&&!ADDRESSES[`${chain}:${addr}`])errors.push(`${k}: resolves on ${chain} without a first-party row there`);
   checked++;
  }
 }
 if(!checked)errors.push('expected at least one Ethereum contract row to exercise the derivation guard');
 if(knownAttribution('Tron','0x'+'1'.repeat(40)))errors.push('derivation must never reach Tron');
}
// evidencedAddresses() drives the live client's log filter; it must agree with the registry exactly.
for(const chain of ['Ethereum','Base','Arbitrum']){
 const fromRegistry=new Set([...Object.keys(ADDRESSES).filter(k=>k.startsWith(chain+':')).map(k=>k.slice(chain.length+1)),...(DERIVED.find(d=>d.chain===chain)?.addresses??[])]);
 const listed=new Set(evidencedAddresses(chain));
 if(listed.size!==fromRegistry.size||[...fromRegistry].some(a=>!listed.has(a)))errors.push(`evidencedAddresses('${chain}') disagrees with the registry (${listed.size} vs ${fromRegistry.size})`);
}

/* ---------- Entities ---------- */
for(const [id,ent] of Object.entries(ENTITIES)){
 if(ent.id!==id)errors.push(`entity ${id}: id mismatch (${ent.id})`);
 if(!COUNTRIES[ent.jurisdiction])errors.push(`entity ${id}: jurisdiction '${ent.jurisdiction}' is not in geography.ts COUNTRIES`);
 if(!['VERIFIED','HIGH'].includes(ent.confidence))errors.push(`entity ${id}: confidence must be VERIFIED or HIGH`);
 if(!/^https:\/\//.test(ent.sourceUrl))errors.push(`entity ${id}: sourceUrl must be https`);
 if(!ent.source||ent.source.length<20||!ent.evidenceNote||ent.evidenceNote.length<20)errors.push(`entity ${id}: source and evidenceNote must be meaningful`);
 if(/^etherscan/i.test(ent.source))errors.push(`entity ${id}: source must not begin with an Etherscan claim; the explorer is composed per chain by knownAttribution()`);
 if(Date.parse(ent.lastVerified)>now)errors.push(`entity ${id}: lastVerified is in the future`);
 if(!Object.values(ADDRESSES).some(r=>r.entity===id))warnings.push(`entity ${id}: has no addresses`);
 if(now-Date.parse(ent.lastVerified)>150*86400000)warnings.push(`entity ${id}: lastVerified ${ent.lastVerified}, older than 150 days`);
}

/* ---------- Runtime expiry signal ---------- */
{
 const healthy=registryHealth(now);
 if(healthy.expired!==0)errors.push(`registryHealth reports ${healthy.expired} expired addresses today; the build gate should have caught this first`);
 const past=registryHealth(healthy.earliestExpiry+86400000);
 if(past.expired===0)errors.push('registryHealth must report expiry once the 180-day horizon has passed, so the UI can explain a blank map');
}

const stats=registryStats();
console.log(JSON.stringify(stats,null,1));
for(const w of warnings)console.warn('WARN',w);
if(expiringSoon>5)errors.push(`…and ${expiringSoon-5} further address(es) expiring within ${HORIZON_DAYS} days`);
if(errors.length){for(const e of errors)console.error('ERROR',e);console.error(`${errors.length} registry error(s)`);process.exit(1);}
const earliest=registryHealth(now).earliestExpiry;
console.log(`Registry OK: ${stats.addresses} first-party addresses (${Object.entries(stats.byChain).map(([c,n])=>`${c} ${n}`).join(', ')}) + ${stats.derived} derived, ${stats.entities} entities, ${Object.keys(stats.byJurisdiction).length} jurisdictions. Evidence valid through ${new Date(earliest).toISOString().slice(0,10)} (${Math.round((earliest-now)/86400000)} days); build horizon ${HORIZON_DAYS} days.`);
