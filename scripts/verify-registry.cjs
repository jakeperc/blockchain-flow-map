/**
 * Registry integrity check. Compile the pure modules first, then run:
 *   node node_modules/typescript/bin/tsc lib/atlas/model.ts lib/atlas/geography.ts lib/atlas/known-addresses.ts lib/atlas/known-entities.ts lib/atlas/feeds.ts --module commonjs --outDir <scratch> --target ES2020 --skipLibCheck --esModuleInterop
 *   node scripts/verify-registry.cjs <scratch> [--horizon-days N]
 *
 * The horizon is the point of this check. admissible() refuses evidence older than 180 days, so a build
 * published today with evidence checked 170 days ago goes blank ten days later with no error on screen.
 * Every attribution must therefore still be admissible N days from now (default 60), as an ERROR.
 * Do not "fix" a horizon failure by stamping future dates: admissible() also requires a non-negative
 * age, so a future date makes the evidence inadmissible immediately instead of eventually.
 */
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const load=m=>require(`${root}/${m}.js`);
const {ADDRESSES,DERIVED,CODE_PROBED_AT,DORMANCY,WATCHED}=load('known-addresses');
const {ENTITIES,knownAttribution,registryStats,registryHealth,evidencedAddresses,watchedAddresses,isDerived}=load('known-entities');
const {readFileSync}=require('fs');
const {join}=require('path');
const {COUNTRIES,EXPLORERS,CHAIN_COLORS}=load('geography');
const {admissible,CHAINS,EVM_CHAINS}=load('model');
const {FEEDS,ENDPOINTS_MEASURED}=load('feeds');
const errors=[],warnings=[];const now=Date.now();
const hIdx=process.argv.indexOf('--horizon-days');
const HORIZON_DAYS=hIdx>-1?Number(process.argv[hIdx+1]):60;
if(!Number.isFinite(HORIZON_DAYS)||HORIZON_DAYS<0){console.error('--horizon-days must be a non-negative number');process.exit(1);}
const horizon=now+HORIZON_DAYS*86400000;
let expiringSoon=0;
const EVM=new Set(EVM_CHAINS);
/** Chains derivation may target: every EVM chain except the one the labels are read on. */
const DERIVE_TARGETS=EVM_CHAINS.filter(c=>c!=='Ethereum');
const host=u=>{try{return new URL(u).host;}catch{return '';}};

// Every chain needs an explorer and a colour. Both maps are keyed by plain string, so a chain added to CHAINS
// without them is not a type error: knownAttribution() throws on EXPLORERS[chain].address, and the chain
// composition bar silently falls back to grey.
for(const chain of CHAINS){
 if(!EXPLORERS[chain])errors.push(`geography.ts EXPLORERS has no entry for chain '${chain}'`);
 if(!CHAIN_COLORS[chain])errors.push(`geography.ts CHAIN_COLORS has no entry for chain '${chain}'`);
}

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
 if(!DERIVE_TARGETS.includes(d.chain))errors.push(`DERIVED: derivations only target an EVM chain other than Ethereum (${DERIVE_TARGETS.join(', ')}), not ${d.chain}`);
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
  for(const chain of DERIVE_TARGETS){
   const a=knownAttribution(chain,addr);
   if(a&&isDerived(a))errors.push(`${k}: a contract must not resolve on ${chain} by derivation`);
   if(a&&!ADDRESSES[`${chain}:${addr}`])errors.push(`${k}: resolves on ${chain} without a first-party row there`);
   checked++;
  }
 }
 if(!checked)errors.push('expected at least one Ethereum contract row to exercise the derivation guard');
 if(knownAttribution('Tron','0x'+'1'.repeat(40)))errors.push('derivation must never reach Tron');
}
// evidencedAddresses() drives the live client's log filter; it must agree with the registry exactly. Checked for
// every chain that actually carries evidence, so a newly added chain is covered the moment it has a row.
const CHAINS_WITH_EVIDENCE=[...new Set([...Object.values(ADDRESSES).map(r=>r.chain),...DERIVED.map(d=>d.chain)])];
if(!CHAINS_WITH_EVIDENCE.length)errors.push('the registry carries no addresses at all');
for(const chain of CHAINS_WITH_EVIDENCE){
 const fromRegistry=new Set([...Object.keys(ADDRESSES).filter(k=>k.startsWith(chain+':')).map(k=>k.slice(chain.length+1)),...(DERIVED.find(d=>d.chain===chain)?.addresses??[])]);
 const listed=new Set(evidencedAddresses(chain));
 if(listed.size!==fromRegistry.size||[...fromRegistry].some(a=>!listed.has(a)))errors.push(`evidencedAddresses('${chain}') disagrees with the registry (${listed.size} vs ${fromRegistry.size})`);
}
// Dormancy tier (decision D2). dormancy.json is the measurement (scripts/registry/measure-dormancy.mjs); WATCHED in
// known-addresses.ts is the live filter generated from it. Dormant wallets leave the filter, never the registry, and the
// measurement goes stale like evidence does: past DORMANCY_MAX_DAYS the build fails until it is re-run.
const DORMANCY_MAX_DAYS=45,DORMANCY_WARN_DAYS=30;
const unmeasured={};
{
 let dj;
 try{dj=JSON.parse(readFileSync(join(__dirname,'registry','dormancy.json'),'utf8'));}
 catch(e){errors.push(`scripts/registry/dormancy.json is unreadable (${e.message}); run scripts/registry/measure-dormancy.mjs`);}
 if(dj){
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(dj.measuredAt);
  const age=iso?(now-Date.parse(dj.measuredAt))/86400000:NaN;
  if(!iso||Date.parse(dj.measuredAt)>now)errors.push('dormancy.json: measuredAt must be an ISO date, today or earlier');
  else if(age>DORMANCY_MAX_DAYS)errors.push(`dormancy.json was measured ${Math.floor(age)} days ago (${dj.measuredAt}); the dormant tier is trusted for ${DORMANCY_MAX_DAYS} days. Run scripts/registry/measure-dormancy.mjs, then scripts/registry/gen-addresses.mjs`);
  else if(age>DORMANCY_WARN_DAYS)warnings.push(`dormancy.json was measured ${Math.floor(age)} days ago (${dj.measuredAt}); re-measure monthly (the build fails after ${DORMANCY_MAX_DAYS} days)`);
  if(!(dj.windowDays>=90)||dj.endDaysAgo)errors.push('dormancy.json: the dormant tier is defined over a window of at least 90 days ending now; a shorter or past-dated measurement would drop live wallets');
  if(DORMANCY.measuredAt!==dj.measuredAt||DORMANCY.windowDays!==dj.windowDays)errors.push(`known-addresses.ts was generated from a different dormancy.json (${DORMANCY.measuredAt}/${DORMANCY.windowDays} d vs ${dj.measuredAt}/${dj.windowDays} d); re-run gen-addresses.mjs`);
  // Validated for every chain that has a live filter. The requirement that a chain the build actually reads
  // HAS one is checked separately below, against FEEDS.
  for(const chain of WATCHED.map(w=>w.chain)){
   const c=dj.chains?.[chain];
   if(!c){errors.push(`dormancy.json has no ${chain} entry`);continue;}
   if(c.failedQueries!==0)errors.push(`dormancy.json: ${chain} scan reported failed queries, so its idle results are not conclusive`);
   const evidenced=new Set(evidencedAddresses(chain)),watched=new Set(watchedAddresses(chain));
   const dormant=new Set(c.dormantAddresses),active=new Set(Object.keys(c.activeLastBlock));
   for(const a of dormant)if(active.has(a))errors.push(`dormancy.json: ${chain}:${a} is both dormant and active`);
   for(const a of watched)if(!evidenced.has(a))errors.push(`WATCHED ${chain}:${a} is not an evidenced address`);
   for(const a of evidenced){
    if(dormant.has(a)){
     if(watched.has(a))errors.push(`${chain}:${a} is dormant but still in the live filter; re-run gen-addresses.mjs`);
     if(!knownAttribution(chain,a))errors.push(`${chain}:${a} is dormant and no longer resolves to evidence; dormancy must never remove evidence`);
    }else if(!watched.has(a))errors.push(`${chain}:${a} is neither dormant nor in the live filter; re-run gen-addresses.mjs`);
   }
   unmeasured[chain]=[...evidenced].filter(a=>!dormant.has(a)&&!active.has(a)).length;
   if(unmeasured[chain])warnings.push(`${chain}: ${unmeasured[chain]} registry address(es) were added since the dormancy measurement and are watched by default; re-run measure-dormancy.mjs`);
   const counts=DORMANCY.counts[chain];
   if(!counts||counts.evidenced!==evidenced.size||counts.watched!==watched.size||counts.dormant!==evidenced.size-watched.size)errors.push(`${chain}: DORMANCY counts in known-addresses.ts disagree with the registry`);
  }
  // A chain the live build reads must have a filter, or its browsers would send an empty address list and the
  // feed would sit silently at zero. FEEDS is the definition of "read by this build".
  const listed=new Set(WATCHED.map(w=>w.chain));
  for(const chain of Object.keys(FEEDS))if(!listed.has(chain))errors.push(`WATCHED has no ${chain} entry, but feeds.ts lists it as a live chain: run scripts/registry/probe-code.mjs then measure-dormancy.mjs and gen-addresses.mjs, or remove it from FEEDS`);
 }
}
// The filtered feed sends a chain's WATCHED list (evidenced minus dormant) in one indexed topic position. Public nodes cap
// that list and the block span, and above the smallest cap among the endpoints serving the filter every filtered request to
// that endpoint fails and the feed degrades to Partial. The caps in feeds.ts are measurements
// (scripts/probe-endpoint-caps.mjs); never raise one without re-measuring. Past a cap, shard the query or trim the filter.
const filterSlots={};
for(const [chain,cfg] of Object.entries(FEEDS)){
 const large=cfg.endpoints.filter(e=>e.largeBody);
 if(!large.length){errors.push(`${chain}: no endpoint is marked largeBody, so the filtered feed has nowhere to go`);continue;}
 for(const e of large)if(!(e.maxTopics>0)||!(e.maxRange>0))errors.push(`${chain}: ${e.url} serves the filter but has no measured maxTopics/maxRange; run scripts/probe-endpoint-caps.mjs`);
 const cap=Math.min(...large.map(e=>e.maxTopics??0)),span=Math.min(...large.map(e=>e.maxRange??0));
 const filter=watchedAddresses(chain).length,registry=evidencedAddresses(chain).length;
 if(filter>cap)errors.push(`${chain}: the live filter has ${filter} addresses (of ${registry} evidenced) but ${large.find(e=>(e.maxTopics??0)===cap).url} accepts at most ${cap} (measured ${ENDPOINTS_MEASURED}); re-measure dormancy, or shard the query`);
 else if(filter>cap*.95)warnings.push(`${chain}: live filter ${filter} is within 5% of the ${cap}-address endpoint cap`);
 if(cfg.chunk>span)errors.push(`${chain}: chunk of ${cfg.chunk} blocks exceeds the smallest measured range cap (${span}) among the filter endpoints`);
 filterSlots[chain]=`${filter}/${cap} (registry ${registry})`;
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
console.log(`Registry OK: ${stats.addresses} first-party addresses (${Object.entries(stats.byChain).map(([c,n])=>`${c} ${n}`).join(', ')}) + ${stats.derived} derived, ${stats.entities} entities, ${Object.keys(stats.byJurisdiction).length} jurisdictions. Evidence valid through ${new Date(earliest).toISOString().slice(0,10)} (${Math.round((earliest-now)/86400000)} days); build horizon ${HORIZON_DAYS} days. Live filter slots used/cap: ${Object.entries(filterSlots).map(([c,s])=>`${c} ${s}`).join(', ')}.`);
