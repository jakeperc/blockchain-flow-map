/**
 * Compile the pure lib/atlas modules (the set verify-all.mjs checks) into a scratch directory and load them, from the
 * working tree or from any git ref. Diagnostics use this so they read exactly the registry and pipeline a build ships,
 * and so a before/after comparison can evaluate two registries over the same chain data.
 *
 *   import {loadAtlas} from './atlas-modules.mjs';
 *   const now=loadAtlas();              // working tree
 *   const then=loadAtlas('cc97055');    // as of a commit
 *   then['known-entities'].evidencedAddresses('Ethereum')
 *
 * Run from the repo root (tsc is resolved from node_modules).
 */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const MODULES=['model','geography','engine','evm','known-addresses','known-entities','live-core','feeds','rollup','encoding','geo3d','quality-policy','tween','tron','recorder-core'];
/** Modules added after the diagnostics were written; absent at older refs, and nothing in the registry needs them. */
const OPTIONAL=new Set(['feeds','rollup','encoding','geo3d','quality-policy','tween','tron','recorder-core']);

export function loadAtlas(ref){
 const tmp=mkdtempSync(join(tmpdir(),'ledger-atlas-diag-'));
 try{
  let present=MODULES;
  let files=present.map(m=>`lib/atlas/${m}.ts`);
  if(ref){
   const src=join(tmp,'src');mkdirSync(src);
   present=MODULES.filter(m=>{
    try{writeFileSync(join(src,`${m}.ts`),execFileSync('git',['show',`${ref}:lib/atlas/${m}.ts`],{maxBuffer:64*1024*1024,stdio:['ignore','pipe','ignore']}));return true;}
    catch(e){if(OPTIONAL.has(m))return false;throw e;}
   });
   files=present.map(m=>join(src,`${m}.ts`));
  }
  const out=join(tmp,'out');
  execFileSync(process.execPath,['node_modules/typescript/bin/tsc',...files,'--module','commonjs','--outDir',out,'--target','ES2020','--skipLibCheck','--esModuleInterop'],{stdio:'inherit'});
  // A parent package.json marked "type":"module" would make node treat the emitted .js as ESM; pin CommonJS.
  writeFileSync(join(out,'package.json'),'{"type":"commonjs"}\n');
  const req=createRequire(join(out,'index.js'));
  return Object.fromEntries(present.map(m=>[m,req(`./${m}.js`)]));
 }finally{
  rmSync(tmp,{recursive:true,force:true});
 }
}

/** Every evidenced address on a chain (first-party and derived, the WHOLE registry including the dormant tier), mapped to its attribution. The live filter is the smaller watchedAddresses(). Keys are lowercase on EVM chains and base58 as written on Tron (case-sensitive). */
export function evidenceMap(atlas,chain){
 const {evidencedAddresses,knownAttribution,isDerived}=atlas['known-entities'];
 return new Map(evidencedAddresses(chain).map(a=>{const at=knownAttribution(chain,a);return [chain==='Tron'?a:a.toLowerCase(),{entity:at.addressCluster,name:at.entity,jurisdiction:at.jurisdiction,derived:isDerived(at)}];}));
}
