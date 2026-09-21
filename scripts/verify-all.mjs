/**
 * Compile the pure modules once, then run every integrity check: the aggregation model, the evidence
 * registry (including the build horizon, so a published build cannot expire on the public) and the
 * live path. Wired into `pnpm build:live`, so a failing check stops the build rather than shipping.
 *
 *   node scripts/verify-all.mjs [--horizon-days N]
 */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const MODULES=['model','geography','engine','evm','known-addresses','known-entities','live-core'].map(m=>`lib/atlas/${m}.ts`);
const CHECKS=[['verify-model.cjs',[]],['verify-registry.cjs',[]],['verify-live.cjs',[]],['verify-live-build.cjs',[]]];

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
 console.log('All integrity checks passed.');
}finally{
 rmSync(out,{recursive:true,force:true});
}
