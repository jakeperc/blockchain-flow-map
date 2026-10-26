/**
 * Spans sealed by the shared history recorder (decision D8, worker/), downloaded read-only so 24H and 7D can be ready
 * when the page opens instead of after a day of this browser watching.
 *
 * THE RULE THIS FILE FOLLOWS: the recorder is a bonus, never a dependency. With RECORDER_URL empty it never fetches
 * anything and the page is exactly what it was. When the recorder is slow, down or sends something this page does
 * not read, the status says so in plain words and the page carries on with this browser's own history. It sends the
 * recorder nothing: no query string, no cookies, no referrer, nothing this browser recorded. Spans stay in memory and
 * never enter IndexedDB, so a storage refusal can never cost the visitor their own history, and the two records stay
 * distinguishable (recorder-core.ts pickSpans() decides between them, one span per chain and quarter hour).
 *
 * Load order: the manifest, then the days a 24H window needs, then (unless the browser asks to save data) the rest of
 * the week. Every 15 minutes the manifest is read again and only day files whose content-hashed name changed are
 * fetched. Deliberately not pure; the checks worth testing (validateManifest, decodeDay) are in recorder-core.ts.
 */
import {fromStored,type Rollup} from './rollup';
import {decodeDay,validateManifest,type RecorderChain} from './recorder-core';
import type {Chain} from './model';

export type RemoteState='off'|'loading'|'ready'|'failed';
export interface RemoteStatus {
 state:RemoteState;
 /** Plain-English reason when the recorder could not be used, for the Data & coverage panel. */
 reason:string;
 spans:number;oldest:number|null;newest:number|null;
 /** Per chain: spans ending at or before `liveSince` were backfilled when the recorder started (D8 point 10). */
 chains:Partial<Record<Chain,RecorderChain>>;
 registry:string|null;
 checkedAt:number|null;
}
export interface RemoteHistory {
 readonly enabled:boolean;
 /** Spans inside the retention window. Changes only when a day file is added, replaced or dropped. */
 spans():readonly Rollup[];
 /** Bumped whenever spans() changes, so a caller can cache what it derives from them. */
 version():number;
 status():RemoteStatus;
 start(onChange:()=>void):void;
 dispose():void;
}

const TIMEOUT_MS=8000,REFRESH_MS=15*60000,DAY_MS=86400000;

export function createRemoteHistory(base:string,chains:readonly Chain[],opts:{retentionMs:number}):RemoteHistory{
 const enabled=base.length>0;
 const days=new Map<string,{file:string;spans:Rollup[]}>();
 let all:Rollup[]=[],version=0,state:RemoteState=enabled?'loading':'off',reason='';
 let recorded:Partial<Record<Chain,RecorderChain>>={},registry:string|null=null,checkedAt:number|null=null;
 let timer:ReturnType<typeof setInterval>|null=null,stopped=false;

 async function getJson(path:string):Promise<unknown>{
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  try{
   const res=await fetch(base+path,{signal:ctl.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'default'});
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   return await res.json();
  }finally{clearTimeout(t);}
 }
 function publish(onChange:()=>void){
  const cutoff=Date.now()-opts.retentionMs;
  all=[...days.values()].flatMap(d=>d.spans).filter(s=>s.end>cutoff);
  version++;onChange();
 }
 async function refresh(onChange:()=>void){
  try{
   const m=validateManifest(await getJson('v1/manifest'),chains);
   if(!m.ok)throw Error(m.reason);
   recorded=m.manifest.chains;registry=m.manifest.registry;checkedAt=Date.now();
   const keep=new Set(m.manifest.days.map(d=>d.day));
   let changed=false;
   for(const day of [...days.keys()])if(!keep.has(day)){days.delete(day);changed=true;}
   // Newest first: the days a 24H window needs come before the rest of the week, which waits if data is to be saved.
   const saveData=typeof navigator!=='undefined'&&(navigator as {connection?:{saveData?:boolean}}).connection?.saveData===true;
   const todo=m.manifest.days.filter(d=>days.get(d.day)?.file!==d.file).sort((a,b)=>a.day<b.day?1:-1);
   const recent=new Date(Date.now()-DAY_MS).toISOString().slice(0,10);
   for(const d of todo){
    if(stopped)return;
    if(saveData&&d.day<recent)continue;
    const check=decodeDay(await getJson(d.file),chains);
    if(!check.ok)throw Error(`${d.day}: ${check.reason}`);
    days.set(d.day,{file:d.file,spans:check.bundle.spans.map(fromStored)});
    changed=true;
    if(d.day<recent||todo.length===1)continue;
    publish(onChange); // the 24H days are usable before the rest of the week has arrived
   }
   state='ready';reason='';
   if(changed)publish(onChange);else onChange();
  }catch(err){
   // Spans already loaded stay valid: each one was checked when it arrived, and a day file never changes under its name.
   state='failed';
   reason=`The shared history recorder could not be read (${err instanceof Error?err.message:String(err)}), so the longer windows use this browser's own history${all.length?' and the recorder spans already received':''}.`;
   onChange();
  }
 }
 return {
  enabled,
  spans:()=>all,
  version:()=>version,
  status(){
   const b=all.map(s=>s.bucket),e=all.map(s=>s.end);
   return {state,reason,spans:all.length,oldest:b.length?Math.min(...b):null,newest:e.length?Math.max(...e):null,chains:recorded,registry,checkedAt};
  },
  start(onChange){
   if(!enabled||timer)return;
   void refresh(onChange);
   timer=setInterval(()=>{void refresh(onChange);},REFRESH_MS);
  },
  dispose(){stopped=true;if(timer)clearInterval(timer);timer=null;}
 };
}
