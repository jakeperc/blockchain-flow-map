/**
 * Keyless public RPC pools shared by the diagnostic scripts (measure-activity.mjs, probe-endpoint-caps.mjs).
 * This mirrors the endpoint lists and per-chain chunking in lib/atlas/live-client.ts; endpoint facts (CORS,
 * range caps, body caps) are recorded in HANDOFF.md section 5. Re-measure with probe-endpoint-caps.mjs before
 * changing either place. `chunk` here is what the primary endpoint tolerates for a diagnostic pull, not the
 * browser feed's chunk size.
 */
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const POOLS={
 Ethereum:{chainId:1,slotSec:12,chunk:200,pauseMs:300,probeToken:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',urls:['https://rpc.mevblocker.io','https://eth.drpc.org','https://1rpc.io/eth']},
 Base:{chainId:8453,slotSec:2,chunk:1500,pauseMs:200,probeToken:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',urls:['https://mainnet.base.org','https://base-rpc.publicnode.com']},
 Arbitrum:{chainId:42161,slotSec:0.25,chunk:1200,pauseMs:350,probeToken:'0xaf88d065e77c8cc2239327c5edb3a432268e5831',urls:['https://arbitrum.gateway.tenderly.co','https://arb1.arbitrum.io/rpc']}
};
export async function rpc(url,method,params,timeoutMs=60000){
 const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(timeoutMs)});
 if(!res.ok)throw Error(`HTTP ${res.status}`);
 const j=await res.json();
 if(j.error)throw Error(`RPC ${j.error.code} ${String(j.error.message).slice(0,80)}`);
 return j.result;
}
/** Try each endpoint in order, twice, before giving up. */
export async function rpcPool(urls,method,params){
 let last;
 for(const url of urls)for(let i=0;i<2;i++){try{return await rpc(url,method,params);}catch(e){last=e;await sleep(600);}}
 throw last;
}
