/**
 * Dormancy measurement for the live filter (decision D2, 2026-09-21). For every EVM chain the live build reads, finds
 * which evidenced wallets (first-party and derived rows, the whole registry) sent or received no non-zero USDC/USDT
 * transfer in the last N days. Those are the DORMANT tier: they stay in the registry as evidence, and any transfer that
 * touches one still resolves to its entity, but the live feed stops asking the public RPCs about them.
 *
 * The result is scripts/registry/dormancy.json. gen-addresses.mjs reads it and emits the live filter (WATCHED) into
 * lib/atlas/known-addresses.ts; verify-registry.cjs fails the build when the file is older than 45 days, the same way
 * it fails on evidence about to expire. Re-run monthly, and after any research wave, then regenerate:
 *
 *   node scripts/registry/measure-dormancy.mjs                         # 90 days, all chains, writes dormancy.json
 *   node scripts/registry/measure-dormancy.mjs --days 90 --end-days-ago 30 --out scratch.json   # as of a past date
 *   node scripts/registry/measure-dormancy.mjs --chains Base --out base.json                    # one part; then:
 *   node scripts/registry/measure-dormancy.mjs --merge base.json,rest.json                    # parts -> dormancy.json
 *   node scripts/registry/gen-addresses.mjs scripts/registry/addresses.txt lib/atlas/known-addresses.ts
 *
 * Method. Scan newest to oldest with filtered eth_getLogs (Transfer, sender or receiver in the still-unseen addresses,
 * USDC and USDT contracts). An address is removed from the query the first time it shows a non-zero transfer, so the
 * busy hubs drop out of the first few requests and the long tail is scanned cheaply. Block spans start small and grow
 * while responses stay small; a refused request halves the span. Zero-value transfers (spam, address poisoning) do not
 * count as activity. A query that still fails at the smallest span aborts the run and writes nothing: an unfinished
 * scan cannot tell dormant from unread, and a falsely dormant wallet would silently leave the filter.
 *
 * Endpoint spans are measured caps for keyless nodes (2026-09-21, filtered request with 60 topics): mevblocker 10,000
 * (20,000 refused), publicnode Base 5,000 (20,000 refused), mainnet.base.org 2,000, Tenderly and arb1 2,000,000+
 * with empty results, eth.drpc.org about 100. Run from the repo root.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {POOLS,rpc,sleep} from '../rpc-pool.mjs';
import {loadAtlas,evidenceMap} from '../atlas-modules.mjs';

const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf(n);return i>-1?args[i+1]:d;};
const days=Number(opt('--days',90));
const endDaysAgo=Number(opt('--end-days-ago',0));
const outFile=opt('--out','scripts/registry/dormancy.json');
if(!(days>0)||!(endDaysAgo>=0)){console.error('usage: node scripts/registry/measure-dormancy.mjs [--days 90] [--end-days-ago 0] [--out file.json]');process.exit(1);}

const ENDPOINTS={
 Ethereum:[{url:'https://rpc.mevblocker.io',maxSpan:10000},{url:'https://eth.drpc.org',maxSpan:100}],
 // Re-measured 2026-10-21 with the whole evidenced registry, 90 days back: Tenderly's gateway took 1,001 blocks (201
 // and 238 logs per position in 0.2-0.4 s; 2,000 answers "invalid params") and Sentio 1,000 (1,001: HTTP 429 "public
 // eth_getLogs is limited to 1000 blocks"). publicnode refuses blocks older than about half a day with HTTP 403,
 // which rpc() reports without the body that ARCHIVE_LIMIT reads, and mainnet.base.org refused every eth_getLogs
 // (HTTP 429 -32011), so neither is listed. 90 days is about 7,800 queries at 1,000 blocks.
 Base:[{url:'https://base.gateway.tenderly.co',maxSpan:1000},{url:'https://rpc.sentio.xyz/base',maxSpan:1000}],
 Arbitrum:[{url:'https://arbitrum.gateway.tenderly.co',maxSpan:1000000},{url:'https://arb1.arbitrum.io/rpc',maxSpan:1000000}],
 // Measured 2026-10-01 with the real filter, 90 days back: Tenderly's gateway took 200,000 blocks (13,567 logs in
 // 0.7 s; 1,000,000 answers "invalid params") and returned the same logs as polygon.drpc.org at four depths.
 // rpc.sentio.xyz caps at 10,000. polygon-bor-rpc.publicnode.com prunes past ~37 hours and drpc serves 100
 // blocks per request, which is why Polygon was parked until Tenderly was found.
 Polygon:[{url:'https://polygon.gateway.tenderly.co',maxSpan:200000},{url:'https://rpc.sentio.xyz/matic',maxSpan:10000},{url:'https://polygon.drpc.org',maxSpan:100}],
 // Measured 2026-10-01, 90 days back: Tenderly took 1,000,000 blocks (5,556 logs in 0.6 s); mainnet.optimism.io
 // answers "limited to a 10,000 range"; optimism-rpc.publicnode.com refuses archive depth without a token.
 Optimism:[{url:'https://optimism.gateway.tenderly.co',maxSpan:1000000},{url:'https://mainnet.optimism.io',maxSpan:10000}],
 // Re-measured 2026-10-21 with the whole evidenced registry, 90 days back: Tenderly's gateway took 200,000 blocks
 // (12,951 logs in 1.7 s; 500,000 answers "invalid params"). api.avax.network, which took 500,000 on 2026-09-25,
 // now caps at 100 but still serves that depth; publicnode caps at 50,000 and prunes old blocks.
 Avalanche:[{url:'https://avalanche.gateway.tenderly.co',maxSpan:200000},{url:'https://avalanche-c-chain-rpc.publicnode.com',maxSpan:50000},{url:'https://api.avax.network/ext/bc/C/rpc',maxSpan:100}],
 // Measured 2026-10-06: both serve 90 days back and refuse any reply over 10,000 logs ("query returned more than 10000
 // results"), so the span is bounded by the busiest wallets' log count; it grows once they have been seen and drop out.
 Tron:[{url:'https://tron-evm-rpc.publicnode.com',maxSpan:200000},{url:'https://api.trongrid.io/jsonrpc',maxSpan:200000}]
};
const FIRST_SPAN={Ethereum:100,Base:500,Arbitrum:5000,Polygon:2000,Avalanche:5000,Optimism:5000,Tron:300},MIN_SPAN=50;
const SLICE=900; // addresses per topic position; eth.drpc.org and Tenderly refuse 1,024 or more
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const hex=n=>'0x'+n.toString(16);
/** Topic value for an evidenced address; Tron's base58 rows go through their 20-byte hex form (lib/atlas/tron.ts). */
const pad=(chain,a)=>'0x'+'0'.repeat(24)+(chain==='Tron'?atlas.tron.rpcAddress(chain,a):a).slice(2).toLowerCase();
const today=new Date().toISOString().slice(0,10);

/** Transient: back off and try the same endpoint again. */
const TRANSIENT=/HTTP 429|rate.?limit|too many requests|fetch failed|timeout|aborted|HTTP 5\d\d|capacity|overloaded|busy|try again/i;
/**
 * A genuine statement that the REQUEST was too big. Only these may shrink an endpoint's span, because that
 * shrink is permanent for the run: a node that refuses 10,000 blocks will refuse them again, so learning the
 * cap saves thousands of doomed requests.
 *
 * Getting this wrong is expensive, and it was: Polygon's publicnode answers sustained load with errors that
 * name no range at all, those were read as "too big", and the span ratcheted 10,000 → 100 with no way back.
 * Halving the range is also the worst possible answer to a load error, since it doubles the request count.
 * So anything not clearly about size is now treated as transient.
 */
const TOO_BIG=/range|too large|too many results|more than \d+ results|exceed|limit.*block|block.*limit|response.*(large|big)|max.*results|payload|413|entity too/i;
/**
 * A statement that the endpoint refuses to serve blocks this old at all, regardless of span. Found 2026-09-25:
 * base-rpc.publicnode.com answers instantly and correctly for roughly the most recent 5% of a 90-day range,
 * then permanently refuses every request past that depth with "Archive requests require a personal token" —
 * fast (about 50ms), not a size problem, and unrecoverable by retrying or shrinking. Misclassified as
 * "unclassified, back off and retry", every one of the scan's remaining queries (it only moves further back in
 * time) burned 20+ seconds retrying a request that could never succeed before falling through to the next
 * endpoint, turning what should be a fast scan into one that had not finished Base in over twelve hours.
 * Disables the endpoint outright — not a span shrink, since no span at this depth would have worked either.
 */
// The last alternative is Avalanche's publicnode, which answers a bare "-32000 not found" for blocks it has
// pruned (measured 2026-09-26: fine 1M blocks back, "not found" by 3.5M). Anchored, because "not found" alone
// is too generic to trust.
const ARCHIVE_LIMIT=/archive|personal token|full node|pruned|historical.*(not available|unavailable)|^RPC -32000 not found$/i;
/**
 * Per-request timeout. Used to be a literal 90000 that ignored ATLAS_RPC_TIMEOUT_MS entirely — ordinary
 * requests resolve in well under a second, and rpc()'s own watchdog (rpc-pool.mjs) is now the real backstop
 * against a hung connection, so this just bounds a genuinely slow response.
 */
const RPC_TIMEOUT_MS=Number(process.env.ATLAS_RPC_TIMEOUT_MS)||45000;
/** One request, trying each endpoint whose measured span covers it and which has not refused this depth outright. */
async function call(chain,method,params,span=0,valid){
 let last;
 for(const ep of ENDPOINTS[chain]){
  if(ep.archiveLimited||span>ep.maxSpan)continue;
  for(let attempt=0;attempt<4;attempt++){
   try{
    const r=await rpc(ep.url,method,params,RPC_TIMEOUT_MS);
    // An endpoint that answers but does not hold the data (see timestamp() below): next endpoint, no retry.
    if(valid&&!valid(r)){last=Error(`${ep.url} returned no ${method} result`);break;}
    return r;
   }
   catch(e){
    last=e;
    if(ARCHIVE_LIMIT.test(e.message)){
     // Permanent for the rest of the run: a scan only moves further back in time, so an endpoint that refuses
     // this depth will refuse every remaining query. No retry, no backoff — straight to the next endpoint.
     console.warn(`  ${chain}: ${ep.url} refuses blocks this old (${e.message.slice(0,80)}); not using it again this run`);
     ep.archiveLimited=true;
     break;
    }
    if(TRANSIENT.test(e.message)){await sleep(1500*(attempt+1));continue;}
    if(span>0&&TOO_BIG.test(e.message)){
     // Remember the cap, so later requests of this size go straight to another endpoint.
     ep.maxSpan=Math.min(ep.maxSpan,Math.max(MIN_SPAN-1,Math.floor(span/2)));
     break;
    }
    // Unclassified: back off rather than permanently crippling an endpoint on one bad reply.
    await sleep(2000*(attempt+1));
   }
  }
 }
 throw last??Error(`no endpoint serves a span of ${span} blocks`);
}
/**
 * A header may be null rather than an error: optimism.gateway.tenderly.co returns null for every pre-Bedrock block
 * (below about 105.2M), and blockAt's bisection starts at half the head. On 2026-10-01 that null crashed the run
 * after 45 minutes of the other chains, with nothing written. A null header now falls through to the next endpoint.
 */
const timestamp=async(chain,n)=>parseInt((await call(chain,'eth_getBlockByNumber',[hex(n),false],0,b=>!!b&&!!b.timestamp)).timestamp,16);
/** Smallest block whose header time is at or after `ts`, by bisection between block 1 and the head. */
async function blockAt(chain,ts,head){
 let lo=1,hi=head;
 while(lo<hi){const mid=Math.floor((lo+hi)/2);if(await timestamp(chain,mid)<ts)lo=mid+1;else hi=mid;}
 return lo;
}

const atlas=loadAtlas();
const {CONTRACTS}=atlas.evm;
/**
 * --merge a.json,b.json: combine part files written with --chains into one dormancy.json. Nothing is written until
 * every chain has finished, so one bad reply on the last chain used to cost the whole run (Base alone is 40
 * minutes). Chains are measured independently, so parts measured the same day over the same window are the same
 * measurement run in pieces. Refuses parts from different days or windows, and refuses to leave a live chain out.
 */
const mergeArg=opt('--merge');
if(mergeArg){
 const parts=mergeArg.split(',').map(f=>JSON.parse(readFileSync(f,'utf8')));
 const [first]=parts;
 for(const p of parts)if(p.measuredAt!==first.measuredAt||p.windowDays!==first.windowDays||p.endDaysAgo!==first.endDaysAgo)throw Error('--merge: parts differ in measuredAt, windowDays or endDaysAgo; measure them on the same day with the same window');
 const merged={...first,asOf:parts.map(p=>p.asOf).sort()[0],chains:{}};
 for(const c of Object.keys(atlas.feeds.FEEDS)){
  const p=parts.find(x=>x.chains[c]);
  if(!p)throw Error(`--merge: no part covers ${c}; dormancy.json must cover every chain the build reads`);
  merged.chains[c]=p.chains[c];
 }
 writeFileSync(outFile,JSON.stringify(merged,null,1)+'\n');
 console.log('merged',Object.keys(merged.chains).join(', '),'into',outFile);
 process.exit(0);
}
const only=opt('--chains');
if(only&&outFile==='scripts/registry/dormancy.json'){console.error('--chains measures a subset, so it needs its own --out; dormancy.json must cover every chain');process.exit(1);}
const chains=Object.keys(atlas.feeds.FEEDS).filter(c=>!only||only.split(',').includes(c));
const result={
 measuredAt:today,asOf:new Date().toISOString(),windowDays:days,endDaysAgo,
 rule:'Dormant: no non-zero USDC or USDT Transfer sent or received on that chain in the window. Dormant wallets stay in the registry as evidence and still attribute any transfer that touches them; they are only left out of the live filter.',
 script:'scripts/registry/measure-dormancy.mjs',chains:{}
};

for(const chain of chains){
 if(!ENDPOINTS[chain])throw Error(`${chain}: no endpoints configured for the dormancy scan`);
 const tokens=Object.keys(CONTRACTS[chain]).map(a=>chain==='Tron'?atlas.tron.rpcAddress(chain,a):a.toLowerCase());
 const all=[...evidenceMap(atlas,chain).keys()];
 // A log names addresses as 20-byte hex; map them back to the registry's form (base58 on Tron).
 const keyOfHex=new Map(all.map(a=>[pad(chain,a).slice(-40),a]));
 const pending=new Set(all),lastBlock=new Map();
 const head=parseInt(await call(chain,'eth_blockNumber',[]),16)-10;
 const headTs=await timestamp(chain,head);
 const endTs=headTs-Math.round(endDaysAgo*86400),startTs=endTs-Math.round(days*86400);
 const end=endDaysAgo>0?await blockAt(chain,endTs,head):head,start=await blockAt(chain,startTs,head);
 const [endTime,startTime]=[new Date(endTs*1000).toISOString(),new Date(startTs*1000).toISOString()];
 console.log(`${chain}: ${all.length} evidenced addresses, ${days} days = blocks ${start}..${end} (${startTime.slice(0,16)} to ${endTime.slice(0,16)}), ${end-start+1} blocks`);
 const pauseMs=POOLS[chain].pauseMs;
 let span=FIRST_SPAN[chain],cursor=end,queries=0,halvings=0,logsSeen=0,iter=0;

 async function scan(from,to){
  const found=new Map();let n=0;
  const list=[...pending];
  for(let i=0;i<list.length;i+=SLICE){
   const topics=list.slice(i,i+SLICE).map(a=>pad(chain,a));
   for(const t of [[TRANSFER,topics,null],[TRANSFER,null,topics]]){
    const logs=await call(chain,'eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),address:tokens,topics:t}],to-from+1);
    queries++;n+=logs.length;
    for(const l of logs){
     if(l.removed||l.topics.length!==3||!/^0x[0-9a-fA-F]{64}$/.test(l.data)||BigInt(l.data)===0n)continue;
     const bn=parseInt(l.blockNumber,16);
     for(const a of [keyOfHex.get(l.topics[1].slice(26).toLowerCase()),keyOfHex.get(l.topics[2].slice(26).toLowerCase())])
      if(a&&pending.has(a))found.set(a,Math.max(found.get(a)??0,bn));
    }
    await sleep(pauseMs);
   }
  }
  return {found,n};
 }

 while(pending.size&&cursor>=start){
  const from=Math.max(start,cursor-span+1);
  let r;
  try{r=await scan(from,cursor);}
  catch(e){
   if(span<=MIN_SPAN)throw Error(`${chain}: blocks ${from}..${cursor} still fail at ${span} blocks (${e.message}); nothing written, an unread range cannot be called dormant`);
   span=Math.max(MIN_SPAN,Math.floor(span/2));halvings++;continue;
  }
  logsSeen+=r.n;
  for(const [a,b] of r.found){pending.delete(a);lastBlock.set(a,b);}
  cursor=from-1;
  if(++iter%25===0)console.log(`  ${chain}: ${(100*(end-cursor)/(end-start+1)).toFixed(0)}% of the window scanned, ${pending.size} addresses still unseen, ${queries} queries, span ${span}`);
  // Nodes refuse responses of about 10,000 logs, so grow while a response is well under that and back off well before it.
  // The growth ceiling counts only endpoints still in use. Once the fast endpoint refuses this depth (Base's
  // publicnode does, about 5% of the way back), growing towards ITS cap would overshoot the remaining endpoint's
  // cap on every other iteration: fail, halve, grow, fail.
  const usable=ENDPOINTS[chain].filter(e=>!e.archiveLimited).map(e=>e.maxSpan);
  if(r.n<1500)span=Math.min(usable.length?Math.max(...usable):span,span*2);else if(r.n>6000)span=Math.max(MIN_SPAN,Math.floor(span/2));
 }

 const dormant=[...pending].sort();
 result.chains[chain]={
  window:{startBlock:start,endBlock:end,startTime,endTime},
  checked:all.length,active:lastBlock.size,dormant:dormant.length,queries,failedQueries:0,
  dormantAddresses:dormant,
  activeLastBlock:Object.fromEntries([...lastBlock].sort((a,b)=>b[1]-a[1]))
 };
 console.log(`  active ${lastBlock.size}, dormant ${dormant.length} (${(100*dormant.length/all.length).toFixed(0)}%), ${queries} queries, ${logsSeen} logs read, ${halvings} span halvings`);
}

writeFileSync(outFile,JSON.stringify(result,null,1)+'\n');
console.log('wrote',outFile);
