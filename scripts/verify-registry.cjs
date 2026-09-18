/**
 * Registry integrity check. Compile the pure modules first, then run:
 *   node node_modules/typescript/bin/tsc lib/atlas/model.ts lib/atlas/geography.ts lib/atlas/known-addresses.ts lib/atlas/known-entities.ts --module commonjs --outDir <scratch> --target ES2020 --skipLibCheck --esModuleInterop
 *   node scripts/verify-registry.cjs <scratch>
 */
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const {ADDRESSES}=require(root+'/known-addresses.js');
const {ENTITIES,knownAttribution,registryStats}=require(root+'/known-entities.js');
const {COUNTRIES}=require(root+'/geography.js');
const {admissible}=require(root+'/model.js');
const errors=[],warnings=[];const now=Date.now();
const seen=new Set();
for(const [key,rec] of Object.entries(ADDRESSES)){
 if(!/^0x[0-9a-f]{40}$/.test(key))errors.push(`${key}: key must be a lowercase 0x address`);
 if(seen.has(key))errors.push(`${key}: duplicate`);seen.add(key);
 const ent=ENTITIES[rec.entity];
 if(!ent){errors.push(`${key}: unknown entity '${rec.entity}'`);continue;}
 if(!rec.label||rec.label.length<2)errors.push(`${key}: missing Etherscan label`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(rec.checked)||Date.parse(rec.checked)>now)errors.push(`${key}: 'checked' must be an ISO date, today or earlier`);
 const a=knownAttribution(key);
 if(!a||!admissible(a,now))errors.push(`${key}: knownAttribution() is not admissible (${a?a.confidence+'/'+a.jurisdiction+'/'+a.lastVerified:'null'})`);
 if(now-Date.parse(rec.checked)>150*86400000)warnings.push(`${key}: checked ${rec.checked}, older than 150 days — re-verify before it expires at 180`);
}
for(const [id,ent] of Object.entries(ENTITIES)){
 if(ent.id!==id)errors.push(`entity ${id}: id mismatch (${ent.id})`);
 if(!COUNTRIES[ent.jurisdiction])errors.push(`entity ${id}: jurisdiction '${ent.jurisdiction}' is not in geography.ts COUNTRIES`);
 if(!['VERIFIED','HIGH'].includes(ent.confidence))errors.push(`entity ${id}: confidence must be VERIFIED or HIGH`);
 if(!/^https:\/\//.test(ent.sourceUrl))errors.push(`entity ${id}: sourceUrl must be https`);
 if(!ent.source||ent.source.length<20||!ent.evidenceNote||ent.evidenceNote.length<20)errors.push(`entity ${id}: source and evidenceNote must be meaningful`);
 if(Date.parse(ent.lastVerified)>now)errors.push(`entity ${id}: lastVerified is in the future`);
 if(!Object.values(ADDRESSES).some(r=>r.entity===id))warnings.push(`entity ${id}: has no addresses`);
 if(now-Date.parse(ent.lastVerified)>150*86400000)warnings.push(`entity ${id}: lastVerified ${ent.lastVerified}, older than 150 days`);
}
const stats=registryStats();
console.log(JSON.stringify(stats,null,1));
for(const w of warnings)console.warn('WARN',w);
if(errors.length){for(const e of errors)console.error('ERROR',e);console.error(`${errors.length} registry error(s)`);process.exit(1);}
console.log(`Registry OK: ${stats.addresses} addresses, ${stats.entities} entities, ${Object.keys(stats.byJurisdiction).length} jurisdictions`);
