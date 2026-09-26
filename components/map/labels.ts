/**
 * Anchored DOM labels for jurisdictions and oceans: crisp at native DPR, projected each frame after the matrices are
 * current (no frame of lag), fading before the globe's limb. Also keeps every anchor's screen position for hit-testing.
 * Styles are written only when their value changes, so a still frame costs no style recalculation.
 */
import * as THREE from 'three';
import {COUNTRIES,MAP_LABELS,OCEAN_LABELS} from '@/lib/atlas/geography';
import {labelVisible} from '@/lib/atlas/encoding';
import {sphereVis,toSphere,type Vec3} from '@/lib/atlas/geo3d';
import {R,flat,type Ctx} from './frame';

export interface AnchorScreen{x:number;y:number;vis:number;code:string}
export interface Labels{
 anchors:AnchorScreen[];
 frame(morph:number,zoom:number,country:string|null,active:(code:string)=>boolean):void;
 dispose():void;
}
export function buildLabels(ctx:Ctx):Labels{
 const host=ctx.host,v=new THREE.Vector3(),cam=new THREE.Vector3();
 const mk=(cls:string,text:string)=>{const el=document.createElement('div');el.className=cls;el.textContent=text;el.style.display='none';host.appendChild(el);return el;};
 /** Last written display / opacity / transform per element. */
 interface Styled{el:HTMLElement;sd:string;so:string;st:string}
 const style=(c:Styled,display:string,opacity?:string,transform?:string)=>{
  if(c.sd!==display){c.sd=display;c.el.style.display=display;}
  if(opacity!==undefined&&c.so!==opacity){c.so=opacity;c.el.style.opacity=opacity;}
  if(transform!==undefined&&c.st!==transform){c.st=transform;c.el.style.transform=transform;}
 };
 const countries=Object.keys(COUNTRIES).map(code=>{const a=COUNTRIES[code].anchor;return {code,el:mk('map-country-label',(MAP_LABELS[code]?.text??COUNTRIES[code].name).toUpperCase()),sphere:toSphere(a[0],a[1],R) as Vec3,flat:flat(a[0],a[1]) as Vec3,spec:MAP_LABELS[code],w:0,h:0,x:0,y:0,shown:false,opacity:'',sd:'none',so:'',st:''};});
 // On the globe the flat-map offsets can push an occasional `auto` label into an always-on one; the auto label yields.
 const overlaps=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const oceans=Object.entries(OCEAN_LABELS).map(([key,o])=>({key,el:mk('ocean-label',o.text),sphere:toSphere(o.anchor[0],o.anchor[1],R) as Vec3,flat:flat(o.anchor[0],o.anchor[1]) as Vec3,sd:'none',so:'',st:''}));
 const anchors:AnchorScreen[]=countries.map(c=>({x:0,y:0,vis:0,code:c.code}));
 const p={x:0,y:0,vis:0,behind:false},world:Vec3=[0,0,0],camv:Vec3=[0,0,0];
 /** Projects into the shared `p` (no allocation per label per frame). */
 const project=(s:Vec3,f:Vec3,morph:number)=>{
  v.set(s[0]+(f[0]-s[0])*morph,s[1]+(f[1]-s[1])*morph,s[2]+(f[2]-s[2])*morph).applyMatrix4(ctx.world.matrixWorld);
  world[0]=v.x;world[1]=v.y;world[2]=v.z;
  cam.copy(ctx.camera.position);camv[0]=cam.x;camv[1]=cam.y;camv[2]=cam.z;
  p.vis=sphereVis(world,camv,R)*(1-morph)+morph;
  v.project(ctx.camera);
  p.x=(v.x+1)*ctx.width/2;p.y=(-v.y+1)*ctx.height/2;p.behind=v.z>1;
  return p;
 };
 return {
  anchors,
  frame(morph,zoom,country,active){
   const rPx=R*(ctx.height/2)/(ctx.camera.position.length()*Math.tan(ctx.camera.fov*Math.PI/360));
   const offsetScale=Math.min(1,Math.max(.6,rPx/265))*(1-morph)+morph;
   countries.forEach((c,i)=>{
    const p=project(c.sphere,c.flat,morph);anchors[i].x=p.x;anchors[i].y=p.y;anchors[i].vis=p.behind?0:p.vis;
    c.shown=labelVisible(c.spec,active(c.code),ctx.width)&&p.vis>.05&&!p.behind;
    if(!c.shown)return;
    c.x=p.x+(7+(c.spec?.dx??0))*offsetScale;c.y=p.y+(9+(c.spec?.dy??0))*offsetScale;
    c.opacity=((country&&country!==c.code?.22:.72)*Math.min(1,Math.max(0,(p.vis-.05)/.25))).toFixed(3);
   });
   for(const c of countries){
    if(!c.shown)continue;
    if(!c.w){style(c,'block');c.w=c.el.offsetWidth||60;c.h=c.el.offsetHeight||12;}
    if(c.spec?.auto&&morph<.5)for(const o of countries){if(o===c||!o.shown||o.spec?.auto||!o.w)continue;if(overlaps(c,o)){c.shown=false;break;}}
   }
   for(const c of countries){
    if(!c.shown){style(c,'none');continue;}
    style(c,'block',c.opacity,`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`);
   }
   for(const o of oceans){
    const p=project(o.sphere,o.flat,morph),show=zoom<=2.2&&p.vis>.2&&!p.behind;
    if(show)style(o,'block',(.45*Math.min(1,(p.vis-.2)/.3)).toFixed(3),`translate(-50%,-50%) translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`);
    else style(o,'none');
   }
  },
  dispose(){for(const c of countries)c.el.remove();for(const o of oceans)o.el.remove();}
 };
}
