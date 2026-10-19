/**
 * Walk the static live entry's local import graph and reject retired data paths. This is intentionally
 * source-level: `build:live` runs before Vite writes dist-live/, so a regression stops the build first.
 */
const assert=require('node:assert/strict');
const {existsSync,readFileSync}=require('node:fs');
const {dirname,extname,join,normalize,relative}=require('node:path');

const project=process.cwd();
const extensions=['.ts','.tsx','.js','.jsx'];
let seen=new Set();
const resolve=(from,specifier)=>{
 const base=specifier.startsWith('@/')?join(project,specifier.slice(2)):specifier.startsWith('.')?join(dirname(from),specifier):null;
 if(!base)return null;
 if(extname(base))return existsSync(base)?base:null;
 for(const ext of extensions)if(existsSync(base+ext))return base+ext;
 for(const ext of extensions)if(existsSync(join(base,'index'+ext)))return join(base,'index'+ext);
 return null;
};
const visit=file=>{
 const absolute=normalize(file);if(seen.has(absolute))return;
 seen.add(absolute);
 const source=readFileSync(absolute,'utf8');
 const forbidden=[
  [/\bdemo(?:Snapshot|Events)\b|\bDEMO_(?:EPOCH|SEED)\b/,'retired demo generator'],
  [/\bsynthetic\s*:|\.synthetic\b|['"]synthetic['"]/,'synthetic record field or finality'],
  [/['"]demo['"]/,'demo mode']
 ];
 for(const [pattern,label] of forbidden)assert.ok(!pattern.test(source),`${relative(project,absolute)} exposes ${label} to the static live build`);
 const imports=/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
 // Dynamic imports are code-split chunks of the same build (the globe renderer is one), so they are walked too.
 const dynamic=/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
 for(const match of [...source.matchAll(imports),...source.matchAll(dynamic)]){const target=resolve(absolute,match[1]);if(target)visit(target);}
};

// The map.
visit(join(project,'live-lite','main.tsx'));
assert.ok(seen.has(join(project,'lib','atlas','engine.ts')),'The static build must use the shared real-data aggregation engine');
assert.ok(seen.has(join(project,'components','map','engine.ts')),'The globe renderer chunk must be inside the checked graph');
const mapModules=seen.size;
// The Landmarks page: its own graph, the same forbidden patterns, and it must stay light. It reads
// the generated lib/landmarks/data.ts and never the registry, the live client or the globe renderer.
seen=new Set();
visit(join(project,'live-lite','landmarks.tsx'));
assert.ok(seen.has(join(project,'lib','landmarks','data.ts')),'The Landmarks page must read its generated data');
for(const heavy of [['lib','atlas','known-addresses.ts'],['lib','atlas','live-client.ts'],['components','map','engine.ts']])assert.ok(!seen.has(join(project,...heavy)),`The Landmarks page must not import ${heavy.join('/')}`);
for(const file of seen)assert.ok(!/from\s+['"]three['"]/.test(readFileSync(file,'utf8')),`${relative(project,file)} pulls three.js into the Landmarks page`);
console.log(`PASS: static live import graphs (map ${mapModules} local modules, Landmarks ${seen.size}) have no demo or synthetic data path`);
