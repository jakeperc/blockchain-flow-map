/**
 * Keyless public RPC pools shared by the diagnostic scripts (measure-activity.mjs, probe-endpoint-caps.mjs).
 * This mirrors the endpoint lists and per-chain chunking in lib/atlas/live-client.ts; endpoint facts (CORS,
 * range caps, body caps) are recorded in HANDOFF.md section 5. Re-measure with probe-endpoint-caps.mjs before
 * changing either place. `chunk` here is what the primary endpoint tolerates for a diagnostic pull, not the
 * browser feed's chunk size. `screenChunk` is the larger range screen-activity.mjs may use, because a
 * candidate filter matches little and the reply stays small.
 */
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const POOLS={
 Ethereum:{chainId:1,slotSec:12,chunk:200,screenChunk:2000,pauseMs:300,probeToken:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',urls:['https://rpc.mevblocker.io','https://eth.drpc.org','https://1rpc.io/eth']},
 Base:{chainId:8453,slotSec:2,chunk:1500,screenChunk:2000,pauseMs:200,probeToken:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',urls:['https://mainnet.base.org','https://base-rpc.publicnode.com']},
 Arbitrum:{chainId:42161,slotSec:0.25,chunk:1200,screenChunk:4000,pauseMs:350,probeToken:'0xaf88d065e77c8cc2239327c5edb3a432268e5831',urls:['https://arbitrum.gateway.tenderly.co','https://arb1.arbitrum.io/rpc']},
 // Added 2026-09-25. Block times measured over 100 blocks; endpoint facts and the rejected candidates are in
 // docs/measurements/2026-09-25/new-chain-candidates.md.
 // Tenderly's gateway and Sentio (found 2026-10-01) serve full history, so they lead; publicnode prunes past
 // ~37 hours and drpc serves 100 blocks. 700 ms, not the usual 250, dates from when publicnode was the only
 // large-range endpoint and throttled sustained querying; it is kept because publicnode is still a fallback.
 Polygon:{chainId:137,slotSec:1.5,chunk:1200,screenChunk:5000,pauseMs:700,probeToken:'0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',urls:['https://polygon.gateway.tenderly.co','https://rpc.sentio.xyz/matic','https://polygon-bor-rpc.publicnode.com','https://polygon.drpc.org']},
 Optimism:{chainId:10,slotSec:2,chunk:1500,screenChunk:5000,pauseMs:250,probeToken:'0x0b2c639c533813f4aa9d7837caf62653d097ff85',urls:['https://optimism.gateway.tenderly.co','https://mainnet.optimism.io','https://optimism-rpc.publicnode.com']},
 Avalanche:{chainId:43114,slotSec:1.2,chunk:1500,screenChunk:2000,pauseMs:250,probeToken:'0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',urls:['https://api.avax.network/ext/bc/C/rpc','https://avalanche-c-chain-rpc.publicnode.com']}
};
/**
 * Per-request timeout. A minute is right for a dormancy scan's huge ranges, but when a public endpoint starts
 * hanging rather than refusing — Polygon's publicnode did exactly that after sustained probing on 2026-09-25 —
 * every timeout is then re-tried per endpoint and the caller's range-halving retries multiply it, so a scan
 * that should take two minutes stalls indefinitely. ATLAS_RPC_TIMEOUT_MS=12000 makes a diagnostic fail fast.
 */
const DEFAULT_TIMEOUT_MS=Number(process.env.ATLAS_RPC_TIMEOUT_MS)||60000;
/**
 * `AbortSignal.timeout()` is supposed to make `fetch` reject on its own, but on 2026-09-25 a dormancy scan
 * against Base's publicnode sat with zero progress for 14+ minutes — well past the ~12 minute worst case the
 * retry math in measure-dormancy.mjs allows for a timeout that actually fires — while a fresh request against
 * the same endpoint immediately after resolved in 300ms. The endpoint was not the problem; a connection that
 * hangs after headers (or during DNS) can apparently outlive the abort signal in this environment. `rpc()`
 * now races the fetch against its own independent timer, so a caller's timeout is a hard ceiling regardless of
 * whether the abort signal actually cancels the underlying socket.
 */
export async function rpc(url,method,params,timeoutMs=DEFAULT_TIMEOUT_MS){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 const watchdog=new Promise((_,reject)=>setTimeout(()=>reject(Error(`watchdog timeout after ${timeoutMs}ms (no response, including from AbortSignal.timeout)`)),timeoutMs+2000));
 try{
  // The watchdog races the WHOLE request, headers through body, since a connection that hangs mid-stream
  // after headers arrive is not caught by racing fetch() alone. It fires 2s after the abort so a merely slow
  // (not hung) response still gets the chance to honour the abort cleanly first.
  return await Promise.race([
   (async()=>{
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal});
    if(!res.ok)throw Error(`HTTP ${res.status}`);
    const j=await res.json();
    if(j.error)throw Error(`RPC ${j.error.code} ${String(j.error.message).slice(0,80)}`);
    return j.result;
   })(),
   watchdog
  ]);
 }finally{clearTimeout(timer);}
}
/** Try each endpoint in order, twice, before giving up. */
export async function rpcPool(urls,method,params){
 let last;
 for(const url of urls)for(let i=0;i<2;i++){try{return await rpc(url,method,params);}catch(e){last=e;await sleep(600);}}
 throw last;
}
