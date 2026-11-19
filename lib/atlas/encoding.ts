/**
 * The map's visual encodings, in one place: line width from USD, glow radius from one-sided activity, the flat
 * arc's bow, the dominant colour, route ranking and caps, the strands a route splits into, label visibility. Both renderers (WebGL and the SVG
 * fallback) import these so the two paths cannot drift. These are contractual: docs/METHODOLOGY.md line 13 and
 * the methodology panel in components/atlas.tsx describe them, and scripts/verify-model.cjs asserts them.
 * Pure: imports only model and geography.
 */
import {CHAIN_COLORS,ASSET_COLORS,CONFIDENCE_COLORS,type ColorMode} from './geography';
import type {Corridor,CorridorPair} from './model';

export const ROUTE_CAP_DESKTOP=72,ROUTE_CAP_MOBILE=32,MOBILE_MAX_WIDTH=980,INCUMBENT_BONUS=1.15,ZOOM_MIN=.5,ZOOM_MAX=4,FALLBACK_COLOR='#a9cabc';
export const routeCap=(width:number)=>width<=MOBILE_MAX_WIDTH?ROUTE_CAP_MOBILE:ROUTE_CAP_DESKTOP;
/** Bounded log10 USD → device-independent pixels. $100k and below 0.65 px, $1M 1.43, $1B 3.77, capped at 4.7. */
export const routeWidth=(usd:number)=>Math.max(.65,Math.min(4.7,.65+Math.max(0,Math.log10(usd/1e5))*.78));
/** Bounded log10 USD → glow radius in scene units (0 when nothing touched the jurisdiction). */
export const glowRadius=(usd:number)=>usd>0?Math.max(8,Math.min(34,8+6*Math.log10(usd/1e5))):0;
/** Lateral bow of the flat arc: visual separation only, no metric. */
export const flatBend=(dist:number)=>Math.min(120,dist*.22);
/** Which side a flat arc bows to, so A→B and B→A never overlap. `yUp` is the renderer's frame (WebGL y-up, SVG y-down). */
export const bendSign=(origin:string,destination:string,yUp:boolean)=>(origin<destination?1:-1)*(yUp?1:-1);
/** Control points of the flat cubic Bézier between two projected anchors, in the caller's frame. `extra` bows a strand further out on its route's own side (its lane). */
export function flatControls(a:[number,number],b:[number,number],origin:string,destination:string,yUp:boolean,extra=0):{c1:[number,number];c2:[number,number]}{
 const dx=b[0]-a[0],dy=b[1]-a[1],dist=Math.hypot(dx,dy),norm=Math.max(1,dist),bend=(flatBend(dist)+extra)*bendSign(origin,destination,yUp);
 const nx=-dy/norm*bend,ny=dx/norm*bend;
 return {c1:[a[0]+dx*.3+nx,a[1]+dy*.3+ny],c2:[a[0]+dx*.7+nx,a[1]+dy*.7+ny]};
}
export const dominantKey=(o:Record<string,number>)=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0]?.[0];
/** A corridor is one flat colour: its dominant value-weighted chain, asset or confidence category. */
export function colorOf(c:Pick<Corridor,'chains'|'assets'|'confidence'>,mode:ColorMode):string{
 const key=dominantKey(mode==='CHAIN'?c.chains:mode==='ASSET'?c.assets:c.confidence);
 return (key&&(mode==='CHAIN'?CHAIN_COLORS:mode==='ASSET'?ASSET_COLORS:CONFIDENCE_COLORS)[key])||FALLBACK_COLOR;
}
/** Routes to draw: filtered to a selected jurisdiction, ranked with a 15% bonus for routes already on screen (hysteresis), capped. */
export function rankRoutes<T extends {id:string;rankScore:number;origin:string;destination:string}>(corridors:T[],country:string|null,incumbent:(id:string)=>boolean,cap:number):T[]{
 const relevant=country?corridors.filter(c=>c.origin===country||c.destination===country):corridors;
 const score=(c:T)=>c.rankScore*(incumbent(c.id)?INCUMBENT_BONUS:1);
 return [...relevant].sort((a,b)=>score(b)-score(a)).slice(0,cap);
}
export const routeOpacityTarget=(selected:string|null,id:string)=>selected&&selected!==id?.18:1;

/* ---------- Strands: a route drawn as its counterparties ---------- */

/** Lines the WebGL renderer draws in all, and how many one route may split into. The SVG fallback draws one line per route. */
export const STRAND_CAP_DESKTOP=160,STRAND_CAP_MOBILE=56,STRANDS_PER_ROUTE=6;
export const strandCap=(width:number)=>width<=MOBILE_MAX_WIDTH?STRAND_CAP_MOBILE:STRAND_CAP_DESKTOP;
/** Clear space, in px, between a route's centreline and its first strand, and between neighbouring strands. Visual separation only. */
export const LANE_INSET=1.5,LANE_GAP=2;
/**
 * One drawn line. `pair` is the sender and receiver it stands for; null means "the rest of this route": everything not
 * drawn as its own strand, which is the whole route when it has one line. `offset` is how far the strand's centre sits
 * from the route's centreline at mid-route, in px at the home zoom, and `extent` the outer edge of the route's whole
 * bundle. Every strand of a route bows to the same side, and the opposite direction bows to the other (like traffic), so
 * A to B and B to A never overlap and a strand's side alone says which way it runs.
 */
export interface Strand<T>{id:string;corridor:T;pair:CorridorPair|null;usdValue:number;lane:number;lanes:number;offset:number;extent:number}
/**
 * The lines to draw for the ranked routes, at most `cap` of them. Every route gets one line first. What is left of the
 * budget goes, largest value first, to splitting a route's next counterparty pair off into a strand of its own, up to
 * STRANDS_PER_ROUTE. A route's strands always add up to the route: a pair without its own strand stays in the route's
 * last line, as does any part of the route's value whose pairs were not recorded. Widths therefore still sum to the
 * route, and nothing is drawn that the route's accounting does not hold. Pure; scripts/verify-model.cjs asserts it.
 */
export function planStrands<T extends {id:string;usdValue:number;pairs?:readonly CorridorPair[]}>(corridors:readonly T[],cap:number):Strand<T>[]{
 const routes=corridors.slice(0,Math.max(0,cap)).map(corridor=>{
  const pairs=[...(corridor.pairs??[])].filter(p=>p.usdValue>0).sort((x,y)=>y.usdValue-x.usdValue);
  const paired=pairs.reduce((n,p)=>n+p.usdValue,0),unpaired=corridor.usdValue-paired>corridor.usdValue*1e-9;
  return {corridor,pairs,units:Math.max(1,pairs.length+(unpaired?1:0)),k:1};
 });
 // What a route's next strand would carry: the value left over once its first k pairs have their own.
 const gains:{route:typeof routes[number];k:number;gain:number}[]=[];
 for(const route of routes){
  let rest=route.corridor.usdValue;
  for(let k=1;k<Math.min(route.units,STRANDS_PER_ROUTE);k++){rest-=route.pairs[k-1]?.usdValue??0;gains.push({route,k,gain:rest});}
 }
 gains.sort((x,y)=>y.gain-x.gain);
 for(const g of gains.slice(0,Math.max(0,cap-routes.length)))g.route.k=Math.max(g.route.k,g.k+1);
 const out:Strand<T>[]=[];
 for(const {corridor,pairs,units,k} of routes){
  // With a line for every unit each pair is its own strand; otherwise the last line carries the rest.
  const own=k>=units?pairs.length:k-1,shown=pairs.slice(0,own);
  const parts:{pair:CorridorPair|null;usdValue:number}[]=shown.map(pair=>({pair,usdValue:pair.usdValue}));
  if(parts.length<k)parts.push({pair:null,usdValue:Math.max(0,corridor.usdValue-shown.reduce((n,p)=>n+p.usdValue,0))});
  let offset=0,prev=0;
  const placed=parts.map((p,lane)=>{const w=routeWidth(p.usdValue);offset=lane?offset+prev+LANE_GAP+w:LANE_INSET+w;prev=w;return {...p,lane,offset};});
  const extent=offset+prev;
  for(const p of placed)out.push({id:p.pair?`${corridor.id}|${p.pair.from}>${p.pair.to}`:`${corridor.id}|`,corridor,pair:p.pair,usdValue:p.usdValue,lane:p.lane,lanes:placed.length,offset:p.offset,extent});
 }
 return out;
}
/** A route's counterparties in words: its largest pair, how many more it has, and whether the pairs cover its whole value. Null when it has none. */
export function leadPair(c:{usdValue:number;pairs?:readonly CorridorPair[];pairedUsd?:number}):{from:string;to:string;more:number;whole:boolean}|null{
 const p=c.pairs?.[0];
 return p?{from:p.from,to:p.to,more:c.pairs!.length-1,whole:(c.pairedUsd??0)>=c.usdValue*(1-1e-9)}:null;
}
export const glowOpacityTarget=(country:string|null,code:string)=>country&&country!==code?.22:.5;
/** A label without `auto` is always shown; an `auto` (or unlisted) one only while its jurisdiction is active; below 650 px only `mobile` labels. */
export const labelVisible=(spec:{auto?:boolean;mobile?:boolean}|undefined,active:boolean,width:number)=>((!!spec&&!spec.auto)||active)&&(width>=650||!!spec?.mobile);
