/**
 * The history recorder (decision D8, docs/DECISIONS-2026-09.md). A Cloudflare Worker that reads the same keyless public
 * endpoints the page reads, seals the same 15-minute per-chain spans through the same pure modules (lib/atlas), and
 * publishes them as public, read-only day files, so 24H and 7D can be ready when the page opens. Every minute it:
 *  1. fetches 5-minute prices from the page's providers every fifth minute, and Bitstamp's while a backfill needs them;
 *  2. reads each chain's new blocks in the page's request shape (the live cursor);
 *  3. reads a paced slice of history backwards from where live reading started (the backfill cursor), until a week
 *     plus one seal's context has been read, so the most recent quarter hours are sealed first;
 *  4. seals every quarter hour whose 90-minute context has been read, newest first. Each transfer is priced from the
 *     first of the page's providers holding a sample near its block, and a backfilled one, failing those, from
 *     Bitstamp (D8 point 10). The record names its source either way;
 *  5. publishes each changed day to R2 under a content-hashed name, then the manifest, and prunes what is not needed.
 * GET /v1/manifest and /v1/day/<file> serve those files to any site. Nothing else is served and nothing is accepted.
 *
 * Rules from the recorder's test on Cloudflare (D8 point 10): price per record from a provider list, never from one
 * provider's whole series (CoinGecko answered about one call in ten); stamp `sealedAt` with the clock at sealing, never
 * the cron's scheduled time (some runs started hours late); send a User-Agent (CoinGecko and Coinbase refuse a request
 * without one); and pace history reads, because a burst draws 429s.
 */
import {FEEDS,type FeedConfig} from '../lib/atlas/feeds';
import {CONTRACTS,ERC20_TRANSFER_TOPIC,type EvmLog} from '../lib/atlas/evm';
import {rpcAddress} from '../lib/atlas/tron';
import {watchedAddresses,knownAttribution,isDerived,ENTITIES,registryVersion} from '../lib/atlas/known-entities';
import {EXPLORERS} from '../lib/atlas/geography';
import {decodeTransferLog,makeBlockTimeFn,nextPollRange,readInterval,type Rec,type Sample} from '../lib/atlas/live-core';
import {BUCKET_MS,STORED_SCHEMA,toStored,type StoredRollup} from '../lib/atlas/rollup';
import {CONTEXT_MS,PRICE_TOLERANCE_MS,DAY_FORMAT,MANIFEST_FORMAT,encodeDay,fromRow,priceFromFirst,sealChainBucket,toRow,type Interval,type RecordRow,type RecorderRegistry} from '../lib/atlas/recorder-core';
import type {Asset,Chain} from '../lib/atlas/model';
import {REPO_URL} from '../lib/site/links';

interface Env {DB:D1Database;HISTORY:R2Bucket}

const TIP_LAG=1;                                   // as the page (live-client.ts)
const SEAL_DELAY_MS=2*60000;                       // a quarter hour is sealed once reading is this far past its end
const BACKFILL_MS=7*86400000+CONTEXT_MS+BUCKET_MS; // a week of spans, the oldest with its whole context
const KEEP_MS=8*86400000;                          // spans are kept a week plus a margin (D8 point 9)
const RUN_BUDGET_MS=45000;                         // a run starts no new read or seal after this; the next run is a minute away
const LEASE_MS=5*60000;
const ROWS_PER_CHUNK=3000;                         // about 0.8 MB of JSON, well under D1's 2 MB row limit
const LIVE_READS=3;                                // live reads per chain per run, when behind
const BACK_READS=4;                                // backfill chunks per chain per run: paced, because bursts draw 429s
const BACKLOG_MAX=8;                               // a chain's backfill waits while this many of its quarter hours wait to be sealed
const SEAL_BATCH=8;                                // quarter hours of one chain sealed from one load of its rows
const BACK_BUDGET_MS=20000;                        // backfill reads stop this far into a run, leaving the rest for sealing and publishing
const RESEAL_MS=3600000;                           // a span left with unpriced transfers is retried for an hour
const DAYS_PER_RUN=3;
const PRICE_EVERY_MS=5*60000;
const RETIRE_MS=3600000;                           // a superseded day file outlives any manifest that still names it
const CHAINS=Object.keys(FEEDS) as Chain[];
const ASSETS:Asset[]=['USDT','USDC'];
const REGISTRY:RecorderRegistry={version:registryVersion(),known:knownAttribution,firstParty:a=>!isDerived(a),entities:ENTITIES,explorerTx:(c,h)=>EXPLORERS[c].tx(h)};
const UA=`blockchain-flow-map history recorder (+${REPO_URL})`;
const hex=(n:number)=>'0x'+n.toString(16);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const dayOf=(t:number)=>new Date(t).toISOString().slice(0,10);
const floorTo=(t:number)=>Math.floor(t/BUCKET_MS)*BUCKET_MS;

/* ---------- Prices ---------- */

interface Provider {name:string;url(asset:Asset):string|null;parse(j:unknown):[number,number][]}
const finite=(rows:[number,number][])=>rows.filter(([at,usd])=>Number.isFinite(at)&&Number.isFinite(usd));
/** The page's providers (live-client.ts PRICE_PROVIDERS): the same names, requests and order. Coinbase has no USDC-USD market, so it is not asked for USDC. */
const PAGE_PROVIDERS:Provider[]=[
 {name:'CoinGecko public API, 5-minute market sample nearest to block time',
  url:a=>`https://api.coingecko.com/api/v3/coins/${{USDT:'tether',USDC:'usd-coin'}[a]}/market_chart?vs_currency=usd&days=1`,
  parse:j=>finite((j as {prices?:[number,number][]}).prices??[])},
 {name:'Coinbase Exchange public API, 5-minute candle nearest to block time',
  url:a=>a==='USDT'?'https://api.exchange.coinbase.com/products/USDT-USD/candles?granularity=300':null,
  parse:j=>finite((Array.isArray(j)?j:[]).filter(r=>Array.isArray(r)&&r.length>=5).map(r=>[Number(r[0])*1000,Number(r[4])]))},
 {name:'Kraken public API, 5-minute OHLC sample nearest to block time',
  url:a=>`https://api.kraken.com/0/public/OHLC?pair=${{USDT:'USDTZUSD',USDC:'USDCUSD'}[a]}&interval=5`,
  parse:j=>{const r=(j as {result?:Record<string,unknown>}).result??{};const k=Object.keys(r).find(x=>x!=='last');return finite((k?r[k] as unknown[][]:[]).map(x=>[Number(x[0])*1000,Number(x[4])]));}}
];
/** Backfilled transfers only, after the page's providers (D8 point 10, amended 2026-10-26). 1,000 five-minute candles from `start`. */
const BITSTAMP='Bitstamp public API, 5-minute OHLC sample nearest to block time';
const bitstampUrl=(a:Asset,startMs:number)=>`https://www.bitstamp.net/api/v2/ohlc/${a.toLowerCase()}usd/?step=300&limit=1000&start=${Math.floor(startMs/1000)}`;
const parseBitstamp=(j:unknown)=>finite(((j as {data?:{ohlc?:{timestamp:string;close:string}[]}}).data?.ohlc??[]).map(o=>[Number(o.timestamp)*1000,Number(o.close)]));

async function getJson(url:string):Promise<unknown|null>{
 try{
  const res=await fetch(url,{headers:{accept:'application/json','user-agent':UA},signal:AbortSignal.timeout(15000)});
  return res.ok?await res.json():null;
 }catch{return null;}
}
async function fetchPrices(env:Env,now:number,cursors:Map<Chain,Cursor>,log:Record<string,unknown>){
 const insert=env.DB.prepare('INSERT OR IGNORE INTO prices (asset,at,usd,source) VALUES (?,?,?,?)');
 const writes:D1PreparedStatement[]=[],got:Record<string,number>={};
 const back=[...cursors.values()].filter(c=>c.back_time>c.back_goal);
 // Samples older than any transfer still to be read are not stored. A backfill reads back to its goal, so until it gets
 // there the page's providers' older samples (CoinGecko about a day, Kraken about 60 hours) are kept to price it first.
 const keepFrom=Math.min(now-3*3600000,...back.map(c=>c.back_goal-PRICE_TOLERANCE_MS));
 const latest=await env.DB.prepare(`SELECT MAX(at) AS at FROM prices WHERE source<>?`).bind(BITSTAMP).first<{at:number|null}>();
 if(new Date(now).getUTCMinutes()%5===0||!latest?.at||latest.at<now-3*PRICE_EVERY_MS){
  for(const asset of ASSETS)for(const p of PAGE_PROVIDERS){
   const url=p.url(asset),j=url?await getJson(url):null,rows=j?p.parse(j):[];
   got[`${asset} ${p.name.split(' ')[0]}`]=rows.length;
   for(const [at,usd] of rows)if(at>=keepFrom)writes.push(insert.bind(asset,at,usd,p.name));
  }
 }
 // While a backfill runs, Bitstamp's samples must reach from where it is now back past the next few hours it reads.
 if(back.length){
  const need=Math.min(...back.map(c=>c.back_time))-3*3600000,top=Math.max(...back.map(c=>c.live_since))+PRICE_TOLERANCE_MS;
  for(const asset of ASSETS){
   const have=await env.DB.prepare('SELECT MIN(at) AS at FROM prices WHERE source=? AND asset=?').bind(BITSTAMP,asset).first<{at:number|null}>();
   const anchor=have?.at??top;
   if(anchor<=need)continue;
   const j=await getJson(bitstampUrl(asset,anchor-1000*300000+PRICE_TOLERANCE_MS)),rows=j?parseBitstamp(j):[];
   got[`${asset} Bitstamp`]=rows.length;
   for(const [at,usd] of rows)if(at<=top)writes.push(insert.bind(asset,at,usd,BITSTAMP));
  }
 }
 for(let i=0;i<writes.length;i+=50)await env.DB.batch(writes.slice(i,i+50));
 if(Object.keys(got).length)log.prices=got;
}

/* ---------- JSON-RPC, rotating across a chain's endpoints ---------- */

/** One call, tried on each endpoint in turn until one answers with a result. A JSON-RPC refusal moves on as an HTTP error does. */
async function rpc<T>(urls:string[],method:string,params:unknown[]):Promise<T>{
 let last='no endpoint';
 for(const url of urls){
  try{
   const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','user-agent':UA},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(25000)});
   const j=await res.json().catch(()=>null) as {result?:T;error?:{code?:number;message?:string}}|null;
   if(res.ok&&j&&j.error===undefined&&j.result!==undefined&&j.result!==null)return j.result;
   last=`${url}: HTTP ${res.status} ${j?.error?`${j.error.code} ${String(j.error.message).slice(0,80)}`:''}`;
  }catch(e){last=`${url}: ${(e as Error).name}`;}
 }
 throw Error(`${method} failed on every endpoint; last ${last}`);
}
const tokensOf=(chain:Chain)=>Object.fromEntries(Object.entries(CONTRACTS[chain]??{}).map(([a,t])=>[rpcAddress(chain,a),t]));
const topicsOf=(chain:Chain)=>watchedAddresses(chain).map(a=>'0x'+rpcAddress(chain,a).slice(2).padStart(64,'0'));
const filterUrls=(cfg:FeedConfig)=>cfg.endpoints.filter(e=>e.largeBody).map(e=>e.url);
const allUrls=(cfg:FeedConfig)=>cfg.endpoints.map(e=>e.url);
const blockTime=async(cfg:FeedConfig,n:number)=>parseInt((await rpc<{timestamp:string}>(allUrls(cfg),'eth_getBlockByNumber',[hex(n),false])).timestamp,16)*1000;
const tipOf=async(cfg:FeedConfig)=>parseInt(await rpc<string>(allUrls(cfg),'eth_blockNumber',[]),16)-TIP_LAG;

/** The page's settlement query: transfers with a watched address as sender, then as receiver. Decoded unpriced; sealing prices them. */
async function readTransfers(chain:Chain,cfg:FeedConfig,from:number,to:number,timeOf:(n:number)=>number):Promise<Rec[]>{
 const base={fromBlock:hex(from),toBlock:hex(to),address:Object.keys(tokensOf(chain))},topics=topicsOf(chain),tokens=tokensOf(chain);
 const sent=await rpc<EvmLog[]>(filterUrls(cfg),'eth_getLogs',[{...base,topics:[ERC20_TRANSFER_TOPIC,topics,null]}]);
 if(cfg.pauseMs)await sleep(cfg.pauseMs);
 const recv=await rpc<EvmLog[]>(filterUrls(cfg),'eth_getLogs',[{...base,topics:[ERC20_TRANSFER_TOPIC,null,topics]}]);
 const ids=new Set<string>(),out:Rec[]=[];
 for(const log of [...sent,...recv]){
  const r=decodeTransferLog(chain,log,timeOf(parseInt(log.blockNumber,16)),a=>tokens[a]??null,()=>null);
  if(r&&!ids.has(r.id)){ids.add(r.id);out.push(r);}
 }
 return out;
}

/* ---------- The two cursors ---------- */

interface Cursor {chain:Chain;live_since:number;live_block:number;live_time:number;back_block:number;back_time:number;back_goal:number}
/** What one read stores: its transfers as compact rows, the block-time range it covered, and where its cursor now stands. */
function stored(env:Env,chain:Chain,recs:Rec[],iv:Interval,cursor:D1PreparedStatement):D1PreparedStatement[]{
 const chunk=env.DB.prepare('INSERT INTO chunks (chain,min_time,max_time,n,rows) VALUES (?,?,?,?,?)'),out:D1PreparedStatement[]=[];
 for(let i=0;i<recs.length;i+=ROWS_PER_CHUNK){
  const part=recs.slice(i,i+ROWS_PER_CHUNK),times=part.map(r=>r.blockTime);
  out.push(chunk.bind(chain,Math.min(...times),Math.max(...times),part.length,JSON.stringify(part.map(toRow))));
 }
 if(iv.to>iv.from)out.push(env.DB.prepare('INSERT INTO observed (chain,from_ms,to_ms) VALUES (?,?,?)').bind(chain,iv.from,iv.to));
 return [...out,cursor];
}
/** First run for a chain: live reading starts a poll's width behind the tip, and the backfill starts at the same block, going back. */
async function startChain(env:Env,chain:Chain,cfg:FeedConfig):Promise<Cursor>{
 const s=await tipOf(cfg)-cfg.liveRange,t=await blockTime(cfg,s);
 const c:Cursor={chain,live_since:t,live_block:s,live_time:t,back_block:s+1,back_time:t,back_goal:t-BACKFILL_MS};
 await env.DB.prepare('INSERT INTO cursor (chain,live_since,live_block,live_time,back_block,back_time,back_goal) VALUES (?,?,?,?,?,?,?)')
  .bind(chain,c.live_since,c.live_block,c.live_time,c.back_block,c.back_time,c.back_goal).run();
 return c;
}
/** Forward from the live cursor, as the page polls. Behind by more than an hour (the recorder was stopped): continue from the tip, and the skipped stretch stays a gap. */
async function readLive(env:Env,c:Cursor):Promise<number>{
 const cfg=FEEDS[c.chain]!,target=await tipOf(cfg);
 let next=nextPollRange(c.live_block,target,cfg),blocks=0;
 if(next==='rejoin'){
  const s=target-cfg.liveRange;
  c.live_block=s;c.live_time=await blockTime(cfg,s);next=nextPollRange(s,target,cfg);
 }
 for(let i=0;i<LIVE_READS&&Array.isArray(next);i++){
  const [from,to]=next,t1=await blockTime(cfg,to);
  const timeOf=makeBlockTimeFn([from-1,to],new Map([[from-1,c.live_time],[to,t1]]),to,t1,cfg.slotMs);
  const recs=await readTransfers(c.chain,cfg,from,to,timeOf);
  const iv=readInterval({block:c.live_block,time:c.live_time},from,to,timeOf);
  await env.DB.batch(stored(env,c.chain,recs,iv,env.DB.prepare('UPDATE cursor SET live_block=?,live_time=? WHERE chain=?').bind(to,iv.next.time,c.chain)));
  c.live_block=to;c.live_time=iv.next.time;blocks+=to-from+1;
  next=nextPollRange(c.live_block,target,cfg);
 }
 return blocks;
}
/** Backward from the backfill cursor, one chain chunk at a time: block `back_block - 1` ends at `back_time`, already known. */
async function readBack(env:Env,c:Cursor,deadline:number):Promise<number>{
 const cfg=FEEDS[c.chain]!;let chunks=0;
 for(;chunks<BACK_READS&&c.back_time>c.back_goal&&Date.now()<deadline;chunks++){
  const to=c.back_block-1,from=Math.max(1,to-cfg.chunk+1),t0=await blockTime(cfg,from-1);
  const timeOf=makeBlockTimeFn([from-1,to],new Map([[from-1,t0],[to,c.back_time]]),to,c.back_time,cfg.slotMs);
  const recs=await readTransfers(c.chain,cfg,from,to,timeOf);
  await env.DB.batch(stored(env,c.chain,recs,{from:t0,to:c.back_time},env.DB.prepare('UPDATE cursor SET back_block=?,back_time=? WHERE chain=?').bind(from,t0,c.chain)));
  c.back_block=from;c.back_time=t0;
  if(cfg.pauseMs)await sleep(cfg.pauseMs);
 }
 return chunks;
}

/* ---------- Sealing ---------- */

/**
 * The quarter hours of one chain that can be sealed now, newest first. A quarter hour's seal point is its end plus
 * SEAL_DELAY_MS; it is due once live reading and the clock have both passed that point and the backfill has read back to
 * the start of its context (or the backfill has finished). One already sealed is sealed again only if it left
 * transfers unpriced, for an hour and while its rows are still held, in case a price has arrived since.
 */
async function dueBuckets(env:Env,c:Cursor,now:number):Promise<number[]>{
 const {results:sealed}=await env.DB.prepare('SELECT bucket,unpriced,sealed_at FROM spans WHERE chain=?').bind(c.chain).all<{bucket:number;unpriced:number;sealed_at:number}>();
 const held=await env.DB.prepare('SELECT MIN(min_time) AS t FROM chunks WHERE chain=?').bind(c.chain).first<{t:number|null}>();
 const done=new Map(sealed.map(s=>[s.bucket,s]));
 const backDone=c.back_time<=c.back_goal,out:number[]=[];
 const hi=floorTo(Math.min(c.live_time,now)-SEAL_DELAY_MS)-BUCKET_MS;
 const lo=Math.max(floorTo(c.back_goal+CONTEXT_MS-SEAL_DELAY_MS),floorTo(now-KEEP_MS)+BUCKET_MS);
 for(let b=hi;b>=lo;b-=BUCKET_MS){
  const point=b+BUCKET_MS+SEAL_DELAY_MS;
  if(!backDone&&point-CONTEXT_MS<c.back_time)break; // older quarter hours wait for the backfill
  const s=done.get(b);
  if(s&&!(s.unpriced>0&&s.sealed_at<now-PRICE_EVERY_MS&&s.sealed_at>now-RESEAL_MS&&held?.t!=null&&point-CONTEXT_MS>=held.t))continue;
  out.push(b);
 }
 return out;
}
/** Each provider's samples for one asset as a series, in the order a record is priced from them. */
async function seriesFor(env:Env,from:number,to:number):Promise<Record<string,Record<string,Sample[]>>>{
 const {results}=await env.DB.prepare('SELECT asset,at,usd,source FROM prices WHERE at>=? AND at<=? ORDER BY at').bind(from,to).all<{asset:string;at:number;usd:number;source:string}>();
 const out:Record<string,Record<string,Sample[]>>={};
 for(const r of results)((out[r.asset]??={})[r.source]??=[]).push({at:r.at,usd:r.usd,source:r.source});
 return out;
}
/**
 * Seal several quarter hours of one chain from one load of its rows, prices and read ranges. Neighbouring quarter hours
 * share most of their 90-minute contexts, so loading each context separately read the same rows up to six times over
 * D1's network round trips. Each span is still sealed by sealChainBucket at its own seal point, which keeps only the
 * records inside its own context, so the result is what sealing them one by one gives.
 */
async function sealBatch(env:Env,c:Cursor,buckets:number[],sourceCount:Record<string,number>):Promise<number>{
 const points=buckets.map(b=>b+BUCKET_MS+SEAL_DELAY_MS),from=Math.min(...points)-CONTEXT_MS,to=Math.max(...points);
 const {results:chunks}=await env.DB.prepare('SELECT rows FROM chunks WHERE chain=? AND max_time>=? AND min_time<=?').bind(c.chain,from,to).all<{rows:string}>();
 const {results:obs}=await env.DB.prepare('SELECT from_ms,to_ms FROM observed WHERE chain=? AND to_ms>? AND from_ms<?').bind(c.chain,Math.min(...buckets),Math.max(...buckets)+BUCKET_MS).all<{from_ms:number;to_ms:number}>();
 const series=await seriesFor(env,from-PRICE_TOLERANCE_MS,to+PRICE_TOLERANCE_MS);
 const sources=(r:Rec)=>{
  const s=series[r.asset]??{};
  return [...PAGE_PROVIDERS.map(p=>s[p.name]??[]),...(r.blockTime<=c.live_since?[s[BITSTAMP]??[]]:[])];
 };
 const records=chunks.flatMap(ch=>(JSON.parse(ch.rows) as RecordRow[]).map(row=>{const r=fromRow(c.chain,row);return priceFromFirst(r,sources(r));}));
 const observed=obs.map(o=>({from:o.from_ms,to:o.to_ms})),writes:D1PreparedStatement[]=[],days=new Set<string>();
 for(const [i,bucket] of buckets.entries()){
  for(const r of records)if(r.blockTime>bucket&&r.blockTime<=bucket+BUCKET_MS){const k=r.priceSource?.split(' ')[0]??'unpriced';sourceCount[k]=(sourceCount[k]??0)+1;}
  const out=toStored(sealChainBucket({chain:c.chain,bucket,records,observed,prices:{},registry:REGISTRY,contextEnd:points[i],sealedAt:Date.now()}));
  writes.push(env.DB.prepare('INSERT OR REPLACE INTO spans (chain,bucket,sealed_at,unpriced,json) VALUES (?,?,?,?,?)').bind(c.chain,bucket,out.sealedAt,out.totals.unpricedCount,JSON.stringify(out)));
  days.add(dayOf(bucket));
 }
 for(const day of days)writes.push(env.DB.prepare('INSERT INTO days (day,dirty) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET dirty=1').bind(day));
 await env.DB.batch(writes);
 return buckets.length;
}

/* ---------- Publishing ---------- */

async function gzip(text:string):Promise<ArrayBuffer>{
 return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
}
const sha16=async(b:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('');
/** The newest changed days, each re-encoded whole and written under a new name; then the manifest that names them. */
async function publish(env:Env,now:number,cursors:Map<Chain,Cursor>,log:Record<string,unknown>){
 const {results:dirty}=await env.DB.prepare('SELECT day,file FROM days WHERE dirty=1 ORDER BY day DESC LIMIT ?').bind(DAYS_PER_RUN).all<{day:string;file:string|null}>();
 for(const {day,file:old} of dirty){
  const start=Date.parse(`${day}T00:00:00Z`);
  const {results}=await env.DB.prepare('SELECT json FROM spans WHERE bucket>=? AND bucket<? ORDER BY bucket,chain').bind(start,start+86400000).all<{json:string}>();
  const body=await gzip(JSON.stringify(encodeDay(day,results.map(r=>JSON.parse(r.json) as StoredRollup))));
  const file=`${day}.${await sha16(body)}.json`;
  if(file!==old)await env.HISTORY.put(`day/${file}`,body,{httpMetadata:{contentType:'application/json; charset=utf-8',contentEncoding:'gzip'}});
  await env.DB.batch([
   env.DB.prepare('UPDATE days SET file=?,spans=?,bytes=?,published_at=?,dirty=0 WHERE day=?').bind(file,results.length,body.byteLength,now,day),
   ...(old&&old!==file?[env.DB.prepare('INSERT OR REPLACE INTO retired (file,at) VALUES (?,?)').bind(old,now)]:[])
  ]);
 }
 const {results:days}=await env.DB.prepare('SELECT day,file,spans,bytes FROM days WHERE file IS NOT NULL ORDER BY day').all<{day:string;file:string;spans:number;bytes:number}>();
 if(!dirty.length&&days.length)return;
 const manifest={
  format:MANIFEST_FORMAT,dayFormat:DAY_FORMAT,schema:STORED_SCHEMA,registry:REGISTRY.version,updatedAt:now,
  // Spans of a quarter hour ending at or before `liveSince` were backfilled (D8 point 10); `backfilledTo` is how far back reading has reached.
  chains:Object.fromEntries([...cursors.values()].map(c=>[c.chain,{liveSince:c.live_since,backfilledTo:c.back_time,backfillDone:c.back_time<=c.back_goal}])),
  days:days.map(d=>({day:d.day,file:`v1/day/${d.file}`,spans:d.spans,bytes:d.bytes}))
 };
 await env.HISTORY.put('manifest.json',JSON.stringify(manifest),{httpMetadata:{contentType:'application/json; charset=utf-8'}});
 log.published=dirty.map(d=>d.day);
}

/* ---------- Pruning: raw data is held only while a seal still needs it (D8 point 6) ---------- */

async function prune(env:Env,now:number,cursors:Map<Chain,Cursor>){
 const writes:D1PreparedStatement[]=[];
 // Price samples are kept where a transfer may still be priced: the last 3 hours, every row still held, and the
 // stretch each unfinished backfill has still to read. The rest goes.
 const needed:[number,number][]=[[now-3*3600000,Infinity]];
 for(const c of cursors.values()){
  // Rows near either frontier feed quarter hours not due yet, and each quarter hour still due needs its own context.
  const contexts=(await dueBuckets(env,c,now)).map(b=>[b+BUCKET_MS+SEAL_DELAY_MS-CONTEXT_MS,b+BUCKET_MS+SEAL_DELAY_MS]);
  const liveKeep=c.live_time-CONTEXT_MS-3600000;
  const backKeep=c.back_time<=c.back_goal?-Infinity:c.back_time+CONTEXT_MS+BUCKET_MS+SEAL_DELAY_MS+600000;
  for(const t of ['chunks','observed']){
   const [a,b]=t==='chunks'?['min_time','max_time']:['from_ms','to_ms'];
   const {results}=await env.DB.prepare(`SELECT rowid AS id,${a} AS a,${b} AS b FROM ${t} WHERE chain=?`).bind(c.chain).all<{id:number;a:number;b:number}>();
   const gone=new Set(results.filter(r=>r.a>backKeep&&r.b<liveKeep&&!contexts.some(([x,y])=>r.b>=x&&r.a<=y)).map(r=>r.id)),ids=[...gone];
   for(let i=0;i<ids.length;i+=90)writes.push(env.DB.prepare(`DELETE FROM ${t} WHERE rowid IN (${ids.slice(i,i+90).map(()=>'?').join(',')})`).bind(...ids.slice(i,i+90)));
   if(t==='chunks')for(const r of results)if(!gone.has(r.id))needed.push([r.a-PRICE_TOLERANCE_MS,r.b+PRICE_TOLERANCE_MS]);
  }
  if(c.back_time>c.back_goal)needed.push([c.back_goal-PRICE_TOLERANCE_MS,c.back_time+PRICE_TOLERANCE_MS]);
 }
 const ranges=needed.sort((x,y)=>x[0]-y[0]).reduce<[number,number][]>((m,r)=>{const l=m.at(-1);if(l&&r[0]<=l[1]+PRICE_TOLERANCE_MS)l[1]=Math.max(l[1],r[1]);else m.push([...r]);return m;},[]);
 // D1 takes at most 100 bound values a statement; with more ranges than that, nothing is pruned this run.
 if(ranges.length<=45)writes.push(env.DB.prepare(`DELETE FROM prices WHERE NOT (${ranges.map(()=>'(at>=? AND at<=?)').join(' OR ')})`)
  .bind(...ranges.flatMap(([a,b])=>[a,Math.min(b,Number.MAX_SAFE_INTEGER)])));
 writes.push(env.DB.prepare('DELETE FROM spans WHERE bucket<?').bind(floorTo(now-KEEP_MS)));
 const oldDay=dayOf(now-KEEP_MS);
 writes.push(env.DB.prepare('INSERT OR REPLACE INTO retired (file,at) SELECT file,? FROM days WHERE day<? AND file IS NOT NULL').bind(now,oldDay));
 writes.push(env.DB.prepare('DELETE FROM days WHERE day<?').bind(oldDay));
 await env.DB.batch(writes);
 const {results:gone}=await env.DB.prepare('SELECT file FROM retired WHERE at<?').bind(now-RETIRE_MS).all<{file:string}>();
 if(gone.length){
  await env.HISTORY.delete(gone.map(g=>`day/${g.file}`));
  await env.DB.batch(gone.map(g=>env.DB.prepare('DELETE FROM retired WHERE file=?').bind(g.file)));
 }
}

/* ---------- The minute ---------- */

async function run(env:Env,now:number,log:Record<string,unknown>){
 const deadline=now+RUN_BUDGET_MS;
 const {results}=await env.DB.prepare('SELECT * FROM cursor').all<Cursor>();
 const cursors=new Map(results.map(c=>[c.chain,c]));
 const errors:Record<string,string>={};
 const note=(what:string)=>(e:unknown)=>{errors[what]=String(e).slice(0,160);};
 for(const chain of CHAINS)if(!cursors.has(chain))await startChain(env,chain,FEEDS[chain]!).then(c=>cursors.set(chain,c),note(`${chain} start`));
 await fetchPrices(env,now,cursors,log).catch(note('prices'));
 const live=await Promise.all([...cursors.values()].map(c=>readLive(env,c).catch(e=>{note(`${c.chain} live`)(e);return 0;})));
 // A chain's backfill pauses while its sealing lags, so raw rows never pile up faster than they are sealed and freed.
 const back=await Promise.all([...cursors.values()].map(async c=>(await dueBuckets(env,c,Date.now())).length>BACKLOG_MAX?0
  :readBack(env,c,now+BACK_BUDGET_MS).catch(e=>{note(`${c.chain} backfill`)(e);return 0;})));
 log.read=Object.fromEntries([...cursors.keys()].map((chain,i)=>[chain,{liveBlocks:live[i],backChunks:back[i]}]));
 // Each chain's due quarter hours (newest first) in batches; batches are taken newest first across chains, so a live
 // quarter hour is never kept waiting behind the backfill.
 const batches=(await Promise.all([...cursors.values()].map(async c=>{
  const due=await dueBuckets(env,c,Date.now()),out:{c:Cursor;buckets:number[]}[]=[];
  for(let i=0;i<due.length;i+=SEAL_BATCH)out.push({c,buckets:due.slice(i,i+SEAL_BATCH)});
  return out;
 }))).flat().sort((x,y)=>y.buckets[0]-x.buckets[0]);
 let sealed=0;const pricedBy:Record<string,number>={};
 for(const {c,buckets} of batches){
  if(Date.now()>deadline-5000)break;
  try{sealed+=await sealBatch(env,c,buckets,pricedBy);}catch(e){note(`${c.chain} seal ${new Date(buckets[0]).toISOString()}`)(e);}
 }
 log.sealed={spans:sealed,due:batches.reduce((n,b)=>n+b.buckets.length,0),pricedBy};
 await publish(env,Date.now(),cursors,log).catch(note('publish'));
 await prune(env,Date.now(),cursors).catch(note('prune'));
 if(Object.keys(errors).length)log.errors=errors;
}

/* ---------- The public, read-only API (D8 point 11) ---------- */

const CORS={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-max-age':'86400'};
async function serve(req:Request,env:Env):Promise<Response>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response('read-only\n',{status:405,headers:{...CORS,allow:'GET, HEAD, OPTIONS'}});
 const path=new URL(req.url).pathname,day=/^\/v1\/day\/(\d{4}-\d{2}-\d{2}\.[0-9a-f]{16}\.json)$/.exec(path);
 const key=path==='/v1/manifest'?'manifest.json':day?`day/${day[1]}`:null;
 const obj=key?await env.HISTORY.get(key):null;
 if(!obj)return new Response('not found\n',{status:404,headers:CORS});
 const headers:Record<string,string>={...CORS,'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff',etag:obj.httpEtag,
  // A day file's name is the hash of its content, so it never changes; the manifest moves every quarter hour.
  'cache-control':day?'public, max-age=31536000, immutable':'public, max-age=60'};
 if(req.method==='HEAD')return new Response(null,{headers});
 if(!day)return new Response(obj.body,{headers});
 // Day files are stored gzipped. Sent as they are to a client that accepts gzip, inflated for one that does not.
 if(/\bgzip\b/.test(req.headers.get('accept-encoding')??''))return new Response(obj.body,{headers:{...headers,'content-encoding':'gzip'},encodeBody:'manual'});
 return new Response(obj.body.pipeThrough(new DecompressionStream('gzip')),{headers});
}

export default {
 async scheduled(event:ScheduledController,env:Env){
  const now=Date.now(),holder=crypto.randomUUID(),log:Record<string,unknown>={scheduled:new Date(event.scheduledTime).toISOString(),started:new Date(now).toISOString()};
  const got=await env.DB.prepare('INSERT INTO lease (id,holder,until) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET holder=excluded.holder,until=excluded.until WHERE lease.until<?').bind(holder,now+LEASE_MS,now).run();
  if(!got.meta.changes){console.log(JSON.stringify({...log,skipped:'the previous run still holds the lease'}));return;}
  try{await run(env,now,log);}
  catch(e){log.error=String(e).slice(0,200);}
  finally{
   await env.DB.prepare('UPDATE lease SET until=0 WHERE id=1 AND holder=?').bind(holder).run();
   console.log(JSON.stringify({...log,ms:Date.now()-now}));
  }
 },
 fetch:serve
} satisfies ExportedHandler<Env>;
