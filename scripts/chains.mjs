/**
 * The chain lists from lib/atlas/model.ts, for the plain-Node scripts.
 *
 * model.ts is the single source of truth for which chains exist and which of them are EVM chains, but the
 * registry generator cannot import it: it GENERATES known-addresses.ts, and compiling the atlas modules
 * (scripts/atlas-modules.mjs) needs that file to already be valid. Regenerating after a broken edit would
 * then be impossible. So model.ts is read as text instead — no compile step, no dependency on generated
 * code — and a parse failure throws rather than silently falling back to a stale copy.
 */
import {readFileSync} from 'node:fs';

const list=(src,name)=>{
 const m=new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src);
 if(!m)throw Error(`lib/atlas/model.ts: could not find 'export const ${name} = [...]'; scripts/chains.mjs parses it as text and must be updated alongside it`);
 const out=[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 if(!out.length)throw Error(`lib/atlas/model.ts: ${name} parsed as empty`);
 return out;
};

const src=readFileSync('lib/atlas/model.ts','utf8');
/** Every chain the model knows, in display order. */
export const CHAINS=list(src,'CHAINS');
/** Chains whose accounts are 20-byte EVM addresses: lowercase keys, and the only chains derivation may target. */
export const EVM_CHAINS=list(src,'EVM_CHAINS');
export const isEvmChain=c=>EVM_CHAINS.includes(c);

const unknown=EVM_CHAINS.filter(c=>!CHAINS.includes(c));
if(unknown.length)throw Error(`lib/atlas/model.ts: EVM_CHAINS has ${unknown.join(', ')} which is not in CHAINS`);
