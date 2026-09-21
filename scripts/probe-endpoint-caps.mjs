/**
 * Measure what each keyless RPC endpoint in a chain's live pool (lib/atlas/feeds.ts) really accepts, for the facts
 * table in HANDOFF.md section 5 and the maxTopics/maxRange caps in feeds.ts:
 *   - CORS header for a browser origin, and that eth_chainId matches
 *   - maxRange: the largest filtered eth_getLogs block span that passes (50 random addresses, so the reply is empty
 *     and a response-size cap cannot masquerade as a range cap)
 *   - maxTopics: the largest address list that passes in one indexed topic position, sent in the live client's own
 *     request shape (the chain's live chunk span, every stablecoin contract, the real registry filter padded with
 *     random addresses), with the request size in KB
 * Each size is tried --tries times (default 3) and counts as passing only if every try passes, because some free
 * endpoints route each request to a different upstream with different limits; the pass rate is printed so a flaky
 * endpoint is visible rather than averaged away. Rate-limit replies are reported as such, not as caps.
 *
 *   node scripts/probe-endpoint-caps.mjs <Ethereum|Base|Arbitrum> [--tries N] [--pause MS] [--url <one endpoint>]
 */
import {sleep} from './rpc-pool.mjs';
import {loadAtlas} from './atlas-modules.mjs';
const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf(n);return i>-1?args[i+1]:d;};
const chain=args[0],tries=Number(opt("--tries",3)),only=opt("--url"),pauseMs=Number(opt("--pause",1200));
const atlas=loadAtlas();
const feed=atlas.feeds.FEEDS[chain];
if(!feed){console.error('usage: node scripts/probe-endpoint-caps.mjs <Ethereum|Base|Arbitrum> [--tries N] [--url U]');process.exit(1);}
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const pad=a=>'0x'+'0'.repeat(24)+a.slice(2).toLowerCase();
const randomAddr=()=>'0x'+Array.from({length:40},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('');
const hex=n=>'0x'+n.toString(16);
const tokens=Object.keys(atlas.evm.CONTRACTS[chain]);
const registry=atlas['known-entities'].evidencedAddresses(chain);
async function post(url,method,params){
 try{
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://jakepercy.com'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(60000)});
  const cors=res.headers.get('access-control-allow-origin');
  const text=await res.text();let j=null;try{j=JSON.parse(text);}catch{/* non-JSON reply */}
  const ok=!!j&&Array.isArray(j.result);
  const err=ok?'':j?.error?String(j.error.message??j.error.code).slice(0,60):`HTTP ${res.status} ${text.slice(0,40).replace(/\s+/g,' ')}`;
  return {ok,cors,j,err,limited:res.status===429||/rate limit|too many/i.test(err)};
 }catch(e){return {ok:false,err:e.message.slice(0,60),limited:false};}
}
const logs=(url,from,to,topics)=>post(url,'eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),address:tokens,topics}]);
console.log(`${chain}: live chunk ${feed.chunk} blocks, filter ${registry.length} addresses, ${tries} tries per size, probed ${new Date().toISOString().slice(0,10)}`);
for(const ep of feed.endpoints){
 if(only&&ep.url!==only)continue;
 const url=ep.url;
 const id=await post(url,'eth_chainId',[]);
 if(!id.j||parseInt(id.j.result,16)!==feed.chainId){console.log(`${url} | chainId check failed: ${id.err}`);continue;}
 const tipRes=await post(url,'eth_blockNumber',[]);
 const tip=parseInt(tipRes.j?.result??'0x0',16)-20;
 const few=Array.from({length:50},randomAddr).map(pad);
 let maxRange=0,rangeNote='';
 for(const r of [5000,4000,2000,1500,1200,1000,500,200,100,50]){
  const x=await logs(url,tip-r+1,tip,[TRANSFER,few,null]);
  if(x.ok){maxRange=r;break;}
  rangeNote=x.err;await sleep(800);
 }
 const sizes=[...new Set([registry.length,1000,1024,1200,1600,2400,4800])].sort((a,b)=>a-b);
 let maxTopics=0,kb=0,fail='';
 const span=Math.min(feed.chunk,maxRange||feed.chunk);
 for(const n of sizes){
  const list=[...registry,...Array.from({length:Math.max(0,n-registry.length)},randomAddr)].slice(0,n).map(pad);
  let pass=0,last='',limited=0;
  for(let t=0;t<tries;t++){const x=await logs(url,tip-span+1,tip,[TRANSFER,list,null]);if(x.ok)pass++;else{last=x.err;if(x.limited)limited++;}await sleep(pauseMs);}
  const size=Math.round(JSON.stringify(list).length/1024);
  if(pass===tries){maxTopics=n;kb=size;continue;}
  fail=`${n} entries (~${size} KB) passed ${pass}/${tries}${limited?`, ${limited} rate-limited`:''}: ${last}`;
  break;
 }
 console.log(`${url}${ep.largeBody?' [largeBody]':''} | cors ${id.cors} | maxRange ${maxRange||`none (${rangeNote})`} | maxTopics ${maxTopics}${maxTopics?` (~${kb} KB over ${span} blocks)`:''}${fail?` | first failure: ${fail}`:' | passed every size tried'}`);
 await sleep(1000);
}
