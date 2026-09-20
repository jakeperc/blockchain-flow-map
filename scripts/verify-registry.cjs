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
const {ADDRESSES}=require(root+'/known-addresses.js');
const {ENTITIES,knownAttribution,registryStats,registryHealth}=require(root+'/known-entities.js');
const {COUNTRIES}=require(root+'/geography.js');
const {admissible}=require(root+'/model.js');
const errors=[],warnings=[];const now=Date.now();
const hIdx=process.argv.indexOf('--horizon-days');
const HORIZON_DAYS=hIdx>-1?Number(process.argv[hIdx+1]):60;
if(!Number.isFinite(HORIZON_DAYS)||HORIZON_DAYS<0){console.error('--horizon-days must be a non-negative number');process.exit(1);}
const horizon=now+HORIZON_DAYS*86400000;
let expiringSoon=0;
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
 else if(!admissible(a,horizon)){expiringSoon++;if(expiringSoon<=5)errors.push(`${key}: evidence expires within ${HORIZON_DAYS} days (lastVerified ${a.lastVerified}) — re-verify before publishing`);}
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
// The runtime expiry signal must actually fire. Evidence does not decay gradually: admissible() flips
// the whole registry off on one day, so the live client needs a truthful reading to explain a map that
// would otherwise just look empty.
{
 const healthy=registryHealth(now);
 if(healthy.expired!==0)errors.push(`registryHealth reports ${healthy.expired} expired addresses today; the build gate should have caught this first`);
 if(healthy.total!==Object.keys(ADDRESSES).length)errors.push('registryHealth must count every registry address');
 const past=registryHealth(healthy.earliestExpiry+86400000);
 if(past.expired===0)errors.push('registryHealth must report expiry once the 180-day horizon has passed, so the UI can explain a blank map');
}
const stats=registryStats();
console.log(JSON.stringify(stats,null,1));
for(const w of warnings)console.warn('WARN',w);
if(expiringSoon>5)errors.push(`…and ${expiringSoon-5} further address(es) expiring within ${HORIZON_DAYS} days`);
if(errors.length){for(const e of errors)console.error('ERROR',e);console.error(`${errors.length} registry error(s)`);process.exit(1);}
const earliest=Math.min(...Object.keys(ADDRESSES).map(k=>{const a=knownAttribution(k);return a?Date.parse(a.lastVerified)+180*86400000:Infinity;}));
console.log(`Registry OK: ${stats.addresses} addresses, ${stats.entities} entities, ${Object.keys(stats.byJurisdiction).length} jurisdictions. Evidence valid through ${new Date(earliest).toISOString().slice(0,10)} (${Math.round((earliest-now)/86400000)} days); build horizon ${HORIZON_DAYS} days.`);
