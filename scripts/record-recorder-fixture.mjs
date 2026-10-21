/**
 * Record real chain data for scripts/verify-recorder.cjs: the Ethereum and Tron USDC/USDT Transfer logs the live page's
 * settlement feed would have read over a recent stretch, in the page's own request shape (the feeds.ts endpoints and
 * chunk size, the watched filter in the sender position and again in the receiver position), the boundary headers its
 * backfill fetches, and the Coinbase 5-minute prices it would have priced them with. Nothing is generated or edited:
 * every log, header and price is stored as an endpoint returned it, trimmed to the fields decoding reads.
 *
 *   node scripts/record-recorder-fixture.mjs [--eth-minutes 30] [--tron-minutes 16]
 *
 * Writes scripts/fixtures/recorder-logs.json.gz. Re-record when verify-recorder.cjs says the fixture no longer
 * exercises what it checks (for example once a registry re-verification dates every piece of evidence after the
 * recording, so no route can be drawn from it). Run from the repo root.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {loadAtlas} from './atlas-modules.mjs';
import {rpc,sleep} from './rpc-pool.mjs';

const arg=(name,def)=>{const i=process.argv.indexOf(name);return i>-1?Number(process.argv[i+1]):def;};
// Short on purpose: the filtered feed carries about 115 Ethereum and 350 Tron transfers a minute (2026-10-21), and
// 30 and 16 minutes already hold over a hundred inferred deposit addresses between them, at about 600 KB gzipped.
const MINUTES={Ethereum:arg('--eth-minutes',30),Tron:arg('--tron-minutes',16)};
const TIP_LAG=1; // as live-client.ts
const hex=n=>'0x'+n.toString(16);

const atlas=loadAtlas();
const {FEEDS}=atlas.feeds;
const {CONTRACTS,ERC20_TRANSFER_TOPIC}=atlas.evm;
const {rpcAddress}=atlas.tron;
const {watchedAddresses,registryVersion}=atlas['known-entities'];
const {planChunks}=atlas['live-core'];

async function call(urls,method,params){
 let last;
 for(let round=0;round<3;round++)for(const url of urls){
  try{return await rpc(url,method,params,30000);}catch(e){last=e;await sleep(800*(round+1));}
 }
 throw last;
}

async function recordChain(chain){
 const cfg=FEEDS[chain];
 const filterUrls=cfg.endpoints.filter(e=>e.largeBody).map(e=>e.url),smallUrls=cfg.endpoints.map(e=>e.url);
 const id=parseInt(await call(smallUrls,'eth_chainId',[]),16);
 if(id!==cfg.chainId)throw Error(`${chain}: chain id ${id}, expected ${cfg.chainId}`);
 const tip=parseInt(await call(smallUrls,'eth_blockNumber',[]),16);
 const blocks=Math.round(MINUTES[chain]*60000/cfg.slotMs);
 const end=tip-TIP_LAG,start=end-blocks+1;
 // The page's backfill fetches a header every two chunks and at the end, and interpolates between them.
 const bounds=[];for(let n=start;n<end;n+=cfg.chunk*2)bounds.push(n);bounds.push(end);
 const times=[];
 for(const n of bounds){
  const h=await call(smallUrls,'eth_getBlockByNumber',[hex(n),false]);
  times.push([n,parseInt(h.timestamp,16)*1000]);
 }
 const contracts=Object.keys(CONTRACTS[chain]).map(a=>rpcAddress(chain,a));
 const topics=watchedAddresses(chain).map(a=>'0x'+rpcAddress(chain,a).slice(2).padStart(64,'0'));
 const getLogs=async(from,to)=>{
  const base={fromBlock:hex(from),toBlock:hex(to),address:contracts};
  const sent=await call(filterUrls,'eth_getLogs',[{...base,topics:[ERC20_TRANSFER_TOPIC,topics,null]}]);
  if(cfg.pauseMs)await sleep(cfg.pauseMs);
  const recv=await call(filterUrls,'eth_getLogs',[{...base,topics:[ERC20_TRANSFER_TOPIC,null,topics]}]);
  return [...sent,...recv];
 };
 const logs=new Map(),blockHashes={},chunks=[];
 for(const [from,to] of planChunks(start,end,cfg.chunk)){
  let got;
  try{got=await getLogs(from,to);}
  catch{ // the page retries a failed chunk once at half width; a chunk that still fails is a gap
   const mid=Math.floor((from+to)/2);
   try{got=[...await getLogs(from,mid),...await getLogs(mid+1,to)];}catch{got=null;}
  }
  chunks.push([from,to,got!==null]);
  for(const l of got??[]){
   // decodeTransferLog drops these too, so leaving them out changes nothing the verifier can see.
   if(l.removed||l.topics.length!==3||!/^0x[0-9a-fA-F]{64}$/.test(l.data))continue;
   const n=parseInt(l.blockNumber,16);
   blockHashes[n]=l.blockHash;
   // Trimmed to what decodeTransferLog reads; the block hash is kept once per block.
   logs.set(`${l.transactionHash}:${l.logIndex}`,[n,l.transactionHash,parseInt(l.logIndex,16),contracts.indexOf(l.address.toLowerCase()),l.topics[1].slice(-40),l.topics[2].slice(-40),BigInt(l.data).toString(16)]);
  }
  process.stdout.write(`\r${chain}: ${chunks.length} chunks, ${logs.size} logs`);
  if(cfg.pauseMs)await sleep(cfg.pauseMs);
 }
 process.stdout.write('\n');
 return {chainId:cfg.chainId,slotMs:cfg.slotMs,contracts,start,end,bounds,times,chunks,blockHashes,
  logs:[...logs.values()].sort((a,b)=>a[0]-b[0]||a[2]-b[2])};
}

/** The page's price providers in the page's order (live-client.ts PRICE_PROVIDERS), each named as the page names it. */
const PROVIDERS=[
 {name:'CoinGecko public API, 5-minute market sample nearest to block time',
  async series(asset){
   const res=await fetch(`https://api.coingecko.com/api/v3/coins/${{USDT:'tether',USDC:'usd-coin'}[asset]}/market_chart?vs_currency=usd&days=1`);
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   return ((await res.json()).prices??[]).filter(([at,usd])=>typeof at==='number'&&typeof usd==='number');
  }},
 {name:'Coinbase Exchange public API, 5-minute candle nearest to block time',
  async series(asset){
   const res=await fetch(`https://api.exchange.coinbase.com/products/${{USDT:'USDT-USD',USDC:'USDC-USD'}[asset]}/candles?granularity=300`);
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   return (await res.json()).filter(r=>Array.isArray(r)&&r.length>=5&&Number.isFinite(r[4])).map(r=>[r[0]*1000,r[4]]);
  }},
 {name:'Kraken public API, 5-minute OHLC sample nearest to block time',
  async series(asset){
   const res=await fetch(`https://api.kraken.com/0/public/OHLC?pair=${{USDT:'USDTZUSD',USDC:'USDCUSD'}[asset]}&interval=5`);
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   const j=await res.json();
   if(j.error?.length)throw Error(j.error.join(';'));
   const key=Object.keys(j.result??{}).find(k=>k!=='last');
   return (key?j.result[key]:[]).map(r=>[Number(r[0])*1000,Number(r[4])]).filter(([at,usd])=>Number.isFinite(at)&&Number.isFinite(usd));
  }},
];
async function recordPrices(){
 const out={};
 for(const asset of ['USDT','USDC']){
  for(const p of PROVIDERS){
   try{const rows=await p.series(asset);if(rows.length){out[asset]={source:p.name,samples:rows.sort((a,b)=>a[0]-b[0])};break;}}
   catch(e){console.warn(`${asset}: ${p.name.split(',')[0]} failed (${e.message}); trying the next provider, as the page does`);}
  }
  if(!out[asset])throw Error(`no provider served a ${asset} series`);
 }
 return out;
}

const recordedAt=new Date().toISOString();
const chains={};
for(const chain of Object.keys(MINUTES))chains[chain]=await recordChain(chain);
const prices=await recordPrices();
const from=Math.min(...Object.values(chains).map(c=>c.times[0][1]))-3600000,to=Math.max(...Object.values(chains).map(c=>c.times.at(-1)[1]))+600000;
for(const a of Object.keys(prices))prices[a].samples=prices[a].samples.filter(([at])=>at>=from&&at<=to);
const fixture={recordedAt,registryVersion:registryVersion(),
 note:'Real logs, headers and prices as public endpoints returned them; recorded by scripts/record-recorder-fixture.mjs. Logs: [block, tx hash, log index, contract index, sender hex40, receiver hex40, amount hex]. Prices: [ms, usd].',
 prices,chains};
mkdirSync('scripts/fixtures',{recursive:true});
const gz=gzipSync(JSON.stringify(fixture),{level:9});
writeFileSync('scripts/fixtures/recorder-logs.json.gz',gz);
console.log(`wrote scripts/fixtures/recorder-logs.json.gz: ${(gz.length/1024).toFixed(0)} KB; ${Object.entries(chains).map(([c,x])=>`${c} ${x.logs.length} logs over ${x.end-x.start+1} blocks, ${x.chunks.filter(k=>!k[2]).length} failed chunks`).join('; ')}; prices ${Object.entries(prices).map(([a,p])=>`${a} ${p.samples.length} from ${p.source.split(',')[0]}`).join(', ')}`);
