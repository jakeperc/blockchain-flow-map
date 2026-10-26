/**
 * Compile the pure modules once, then run every integrity check: the aggregation model, the evidence
 * registry (including the build horizon, so a published build cannot expire on the public), the
 * live path, sealed history and how a span is sealed (on recorded real logs), and the plain-text
 * description published beside the page (llms.txt, methodology.md). Wired
 * into `pnpm build:live`, so a failing check stops the build rather than shipping.
 *
 *   node scripts/verify-all.mjs [--horizon-days N]
 */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const MODULES=['model','geography','engine','evm','known-addresses','known-entities','live-core','feeds','rollup','encoding','geo3d','quality-policy','tween','tron','gesture','atlas-view','recorder-core'].map(m=>`lib/atlas/${m}.ts`);
const CHECKS=[['verify-model.cjs',[]],['verify-map.cjs',[]],['verify-registry.cjs',[]],['verify-live.cjs',[]],['verify-rollup.cjs',[]],['verify-recorder.cjs',[]],['verify-live-build.cjs',[]],['verify-landmarks.mjs',[]],['verify-llms.mjs',[]]];

const horizonArg=process.argv.indexOf('--horizon-days');
const horizon=horizonArg>-1?process.argv[horizonArg+1]:undefined;

const out=mkdtempSync(join(tmpdir(),'ledger-atlas-verify-'));
// tsc emits ESM-free CommonJS here, but a parent package.json marked "type":"module" would still make
// node treat the .js files as ESM. Pin the scratch directory to CommonJS.
writeFileSync(join(out,'package.json'),'{"type":"commonjs"}\n');
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit',cwd:process.cwd()});
try{
 run(process.execPath,['node_modules/typescript/bin/tsc',...MODULES,'--module','commonjs','--outDir',out,'--target','ES2020','--skipLibCheck','--esModuleInterop']);
 for(const [script,extra] of CHECKS){
  const args=['scripts/'+script,out,...extra];
  if(script==='verify-registry.cjs'&&horizon)args.push('--horizon-days',horizon);
  run(process.execPath,args);
 }
 // The whole project, UI included: a type error in atlas.tsx or live-client.ts must not reach a build either.
 run(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.json']);
 // The history recorder (worker/, decision D8) runs on Cloudflare's runtime, so it is checked against its types alone.
 run(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','-p','worker/tsconfig.json']);
 console.log('All integrity checks passed.');
}finally{
 rmSync(out,{recursive:true,force:true});
}
