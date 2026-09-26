/**
 * Where sealed spans live between visits: one IndexedDB store in the visitor's own browser.
 *
 * This is the only persistence the live build has, and it is per visitor, never shared and never uploaded.
 * What it holds is the accounting rollup.ts produced from public chain data this browser had already
 * downloaded — no addresses of the visitor's own, nothing identifying, nothing that leaves the machine.
 *
 * THE RULE THIS FILE FOLLOWS: storage is a convenience and the map must work without it. Private browsing,
 * disabled site data, a cleared profile, a quota refusal or an iOS eviction all end up here as `available:
 * false` with a reason a human can read, and the client carries on serving the live window from memory. Every
 * call is wrapped; nothing in this file may throw into the feed.
 *
 * Deliberately NOT pure, so it stays out of live-core.ts. The logic worth testing — what a span means, how
 * spans merge, what coverage they prove — is in rollup.ts, which has no idea this file exists.
 */
import {type StoredRollup} from './rollup';

const DB_NAME='ledger-atlas-history';
const STORE='spans';
/**
 * Bump when the stored shape changes. An upgrade DROPS the old spans rather than migrating them: a span is a
 * summary computed under a particular set of rules, and silently reinterpreting it under new ones would make
 * a number on screen mean something nobody measured. Losing a week of one visitor's history is the cheaper
 * mistake by far.
 */
const SCHEMA=1;

export interface HistoryStatus {
 available:boolean;
 /** Plain-English reason when history is unavailable or degraded, for the Data & coverage panel. */
 reason:string;
 spans:number;
 oldest:number|null;
 newest:number|null;
 /** Approximate bytes this origin is using, when the browser will say. Origin-wide, so it is reported as such. */
 bytes:number|null;
 /** Distinct registry versions among the spans held, so a mixed span can be disclosed. */
 registries:string[];
}
export interface HistoryStore {
 /** Spans inside the retention window, oldest first. Resolves to [] rather than rejecting, always. */
 load():Promise<StoredRollup[]>;
 /** Persist or overwrite spans by bucket. Fire and forget: failures land in status(), never in the caller. */
 save(spans:readonly StoredRollup[]):void;
 /** Forget everything this browser has recorded. */
 clear():Promise<void>;
 status():HistoryStatus;
 /** Ask the browser for its storage estimate, if it offers one. */
 refreshUsage():Promise<void>;
}

const promisify=<T>(req:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{
 req.onsuccess=()=>resolve(req.result);
 req.onerror=()=>reject(req.error??Error('IndexedDB request failed'));
});

export function createHistoryStore(opts:{retentionMs:number}):HistoryStore{
 let db:IDBDatabase|null=null;
 let opening:Promise<IDBDatabase|null>|null=null;
 let available=true,reason='';
 let oldest:number|null=null,newest:number|null=null,bytes:number|null=null,registries:string[]=[];
 /** `bucket:chain` keys known to be stored, so status() can report a count without re-reading the store. */
 const known=new Set<string>();

 const disable=(why:string)=>{available=false;reason=why;db=null;};

 function open():Promise<IDBDatabase|null>{
  if(db)return Promise.resolve(db);
  if(opening)return opening;
  if(typeof indexedDB==='undefined'){disable('This browser does not offer local storage for the page, so history is kept only for this session.');return Promise.resolve(null);}
  opening=new Promise<IDBDatabase|null>(resolve=>{
   let req:IDBOpenDBRequest;
   // Opening itself throws in some privacy modes rather than failing asynchronously.
   try{req=indexedDB.open(DB_NAME,SCHEMA);}
   catch(e){disable(`Local storage is blocked in this browser (${(e as Error).message}), so history is kept only for this session.`);resolve(null);return;}
   req.onupgradeneeded=()=>{
    const d=req.result;
    if(d.objectStoreNames.contains(STORE))d.deleteObjectStore(STORE);
    // Keyed by span and chain together: spans are sealed per chain so the map's chain filter stays exact.
    // The compound key also orders by bucket first, which is what lets pruning use a single range delete.
    d.createObjectStore(STORE,{keyPath:['bucket','chain']});
   };
   req.onsuccess=()=>{
    const d=req.result;
    // Another tab upgrading the schema closes this handle; reopen lazily rather than writing into a dead one.
    d.onversionchange=()=>{d.close();db=null;};
    d.onclose=()=>{db=null;};
    db=d;resolve(d);
   };
   req.onerror=()=>{disable('This browser refused local storage for the page, so history is kept only for this session.');resolve(null);};
   req.onblocked=()=>{disable('Another tab is holding an older version of the local history store; close it to let history resume.');resolve(null);};
  }).finally(()=>{opening=null;});
  return opening;
 }

 const tx=async(mode:IDBTransactionMode)=>{
  const d=await open();
  if(!d)return null;
  try{return d.transaction(STORE,mode).objectStore(STORE);}
  catch(e){disable(`Local history could not be opened (${(e as Error).message}); this session's figures are unaffected.`);return null;}
 };

 const idOf=(r:{bucket:number;chain:string})=>`${r.bucket}:${r.chain}`;
 const describe=(rows:StoredRollup[])=>{
  known.clear();for(const r of rows)known.add(idOf(r));
  oldest=rows.length?rows[0].bucket:null;
  newest=rows.length?Math.max(...rows.map(r=>r.end)):null;
  registries=[...new Set(rows.map(r=>r.registry))];
 };

 async function load():Promise<StoredRollup[]>{
  const store=await tx('readwrite');
  if(!store)return [];
  const cutoff=Date.now()-opts.retentionMs;
  try{
   // Prune first, so a long absence cannot make the first read of the session an expensive one.
   try{await promisify(store.delete(IDBKeyRange.upperBound(cutoff)));}catch{/* a failed prune only costs space */}
   const rows=await promisify(store.getAll() as IDBRequest<StoredRollup[]>);
   const kept=rows.filter(r=>r&&typeof r.bucket==='number'&&typeof r.end==='number'&&typeof r.chain==='string'&&r.end>cutoff&&r.totals&&Array.isArray(r.coverage))
    .sort((a,b)=>a.bucket-b.bucket);
   describe(kept);
   return kept;
  }catch(e){
   disable(`Local history could not be read (${(e as Error).message}); this session starts fresh.`);
   return [];
  }
 }

 let writing=false;
 const queue=new Map<string,StoredRollup>();
 async function flush(){
  if(writing||!queue.size)return;
  writing=true;
  const batch=[...queue.values()];queue.clear();
  try{
   const store=await tx('readwrite');
   if(!store)return;
   await Promise.all(batch.map(r=>promisify(store.put(r))));
   for(const r of batch){
    known.add(idOf(r));
    newest=Math.max(newest??0,r.end);
    oldest=oldest===null?r.bucket:Math.min(oldest,r.bucket);
    if(!registries.includes(r.registry))registries.push(r.registry);
   }
  }catch(e){
   const err=e as {name?:string;message?:string};
   if(err?.name==='QuotaExceededError'){
    // Give back the oldest half and stop writing for this session rather than fighting the browser.
    try{
     const store=await tx('readwrite');
     if(store)await promisify(store.delete(IDBKeyRange.upperBound(Date.now()-opts.retentionMs/2)));
    }catch{/* nothing more to try */}
    disable('This browser is out of space for local history, so the oldest half was dropped and recording has paused for this session.');
   }else{
    disable(`Local history could not be written (${err?.message??'unknown error'}); this session's figures are unaffected.`);
   }
  }finally{
   writing=false;
   if(queue.size)void flush();
  }
 }

 return {
  load,
  save(rows){
   if(!available)return;
   for(const r of rows)queue.set(idOf(r),r);
   void flush();
  },
  async clear(){
   queue.clear();
   const store=await tx('readwrite');
   if(!store)return;
   try{
    await promisify(store.clear());
    known.clear();oldest=null;newest=null;registries=[];
    // A quota refusal earlier disabled writing; clearing space is exactly the fix, so allow it again.
    if(!available&&/out of space/.test(reason)){available=true;reason='';}
   }catch(e){disable(`Local history could not be cleared (${(e as Error).message}).`);}
  },
  status(){return {available,reason,spans:known.size,oldest,newest,bytes,registries:[...registries]};},
  async refreshUsage(){
   try{
    const nav=typeof navigator!=='undefined'?navigator as Navigator&{storage?:{estimate?:()=>Promise<{usage?:number}>}}:null;
    const est=await nav?.storage?.estimate?.();
    bytes=typeof est?.usage==='number'?est.usage:null;
   }catch{bytes=null;}
  }
 };
}
