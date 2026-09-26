/**
 * The map's visual encodings, in one place: line width from USD, glow radius from one-sided activity, the flat
 * arc's bow, the dominant colour, route ranking and caps, label visibility. Both renderers (WebGL and the SVG
 * fallback) import these so the two paths cannot drift. These are contractual: docs/METHODOLOGY.md line 13 and
 * the methodology panel in components/atlas.tsx describe them, and scripts/verify-model.cjs asserts them.
 * Pure: imports only model and geography.
 */
import {CHAIN_COLORS,ASSET_COLORS,CONFIDENCE_COLORS,type ColorMode} from './geography';
import type {Corridor} from './model';

export const ROUTE_CAP_DESKTOP=32,ROUTE_CAP_MOBILE=24,MOBILE_MAX_WIDTH=980,INCUMBENT_BONUS=1.15,ZOOM_MIN=.5,ZOOM_MAX=4,FALLBACK_COLOR='#a9cabc';
export const routeCap=(width:number)=>width<=MOBILE_MAX_WIDTH?ROUTE_CAP_MOBILE:ROUTE_CAP_DESKTOP;
/** Bounded log10 USD → device-independent pixels. $100k and below 0.65 px, $1M 1.43, $1B 3.77, capped at 4.7. */
export const routeWidth=(usd:number)=>Math.max(.65,Math.min(4.7,.65+Math.max(0,Math.log10(usd/1e5))*.78));
/** Bounded log10 USD → glow radius in scene units (0 when nothing touched the jurisdiction). */
export const glowRadius=(usd:number)=>usd>0?Math.max(8,Math.min(34,8+6*Math.log10(usd/1e5))):0;
/** Lateral bow of the flat arc: visual separation only, no metric. */
export const flatBend=(dist:number)=>Math.min(120,dist*.22);
/** Which side a flat arc bows to, so A→B and B→A never overlap. `yUp` is the renderer's frame (WebGL y-up, SVG y-down). */
export const bendSign=(origin:string,destination:string,yUp:boolean)=>(origin<destination?1:-1)*(yUp?1:-1);
/** Control points of the flat cubic Bézier between two projected anchors, in the caller's frame. */
export function flatControls(a:[number,number],b:[number,number],origin:string,destination:string,yUp:boolean):{c1:[number,number];c2:[number,number]}{
 const dx=b[0]-a[0],dy=b[1]-a[1],dist=Math.hypot(dx,dy),norm=Math.max(1,dist),bend=flatBend(dist)*bendSign(origin,destination,yUp);
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
export const glowOpacityTarget=(country:string|null,code:string)=>country&&country!==code?.22:.5;
/** A label without `auto` is always shown; an `auto` (or unlisted) one only while its jurisdiction is active; below 650 px only `mobile` labels. */
export const labelVisible=(spec:{auto?:boolean;mobile?:boolean}|undefined,active:boolean,width:number)=>((!!spec&&!spec.auto)||active)&&(width>=650||!!spec?.mobile);
