/**
 * Pointer, touch, wheel and keyboard → camera; hit-testing for corridors, anchors and countries; hover and click
 * dispatch. Hover is resolved at most once per frame, after the matrices are current, and the tooltip position is
 * written to the element directly so a mouse move never re-renders React.
 */
import * as THREE from 'three';
import {COUNTRIES} from '@/lib/atlas/geography';
import {money} from '@/lib/atlas/model';
import type {Ctx} from './frame';
import {projection} from './frame';
import type {Rig} from './camera';
import type {Land} from './land';
import type {Arcs,Route} from './arcs';
import {SAMPLES} from './arcs';
import type {AnchorScreen} from './labels';
import {newGesture,pointerDown,pointerMove,pointerUp,pointerCancel,type GestureAction} from '@/lib/atlas/gesture';

export interface Hover{text:string;sub:string}
export interface InteractionDeps{
 rig:Rig;land:()=>Land|null;arcs:Arcs;anchors:AnchorScreen[];
 onCountry:(code:string,name?:string)=>void;onCorridor:(id:string)=>void;
 setHover:(h:Hover|null)=>void;tooltip:()=>HTMLElement|null;
 zoom:(f:number)=>void;reset:()=>void;flyTo:(lon:number,lat:number)=>void;flyToCorridor:(c:Route)=>void;
}
export interface Interaction{
 hovered:string|null;lastInput:number;
 /** True while a pointer is down (dragging or pinching). */
 active():boolean;
 /** Resolve clicks and hover. Hover is re-tested only when the cursor moved or `viewChanged` (the scene moved under it). */
 frame(morphing:boolean,viewChanged:boolean):void;
 dispose():void;
}

export function buildInteraction(ctx:Ctx,deps:InteractionDeps):Interaction{
 // Gesture rules (per-pointer deltas, no inertia after a pinch or a pause) live in lib/atlas/gesture.ts, where they are tested.
 const canvas=ctx.renderer.domElement,gesture=newGesture(),pointers=gesture.pointers;
 let cursor:{x:number;y:number}|null=null,cursorMoved=false,hoverKey='',clickAt:{x:number;y:number}|null=null,tipX=NaN,tipY=NaN,tipEl:HTMLElement|null=null;
 const coarse=matchMedia('(hover: none)').matches;
 const state:Interaction={hovered:null,lastInput:0,active:()=>pointers.size>0,frame,dispose};
 const local=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 const v=new THREE.Vector3(),cam=ctx.camera.position;
 const flatInvert=(x:number,y:number)=>projection.invert?.([x,y])??null;

 function corridorAt(px:number,py:number):Route|null{
  const rig=deps.rig,useSphere=rig.morph<.5;let best:Route|null=null,bestD=Infinity;
  for(const r of deps.arcs.routes.values()){
   if(r.opacityTarget<.2&&r.opacity<.2)continue;
   const pts=useSphere?r.sphere:r.flatPts,limit=6+r.width/2;let lx=0,ly=0,lv=false;
   for(let i=0;i<SAMPLES;i+=2){
    v.set(pts[i*3],pts[i*3+1],pts[i*3+2]).applyMatrix4(ctx.world.matrixWorld);
    let facing=true;
    if(useSphere){const ex=cam.x-v.x,ey=cam.y-v.y,ez=cam.z-v.z;facing=(v.x*ex+v.y*ey+v.z*ez)/((v.length()*Math.hypot(ex,ey,ez))||1)>-.05;}
    v.project(ctx.camera);const x=(v.x+1)*ctx.width/2,y=(-v.y+1)*ctx.height/2,ok=facing&&v.z<1;
    if(i>0&&ok&&lv){const dx=x-lx,dy=y-ly,len=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((px-lx)*dx+(py-ly)*dy)/len)),d=Math.hypot(px-(lx+dx*t),py-(ly+dy*t));if(d<limit&&d<bestD){bestD=d;best=r;}}
    lx=x;ly=y;lv=ok;
   }
  }
  return best;
 }
 function anchorAt(px:number,py:number){let best:AnchorScreen|null=null,bd=Infinity;for(const a of deps.anchors){if(a.vis<.5)continue;const d=Math.hypot(a.x-px,a.y-py);if(d<10&&d<bd){bd=d;best=a;}}return best;}
 function resolve(px:number,py:number,click:boolean){
  const route=corridorAt(px,py);
  if(route){if(click){deps.onCorridor(route.data.id);deps.flyToCorridor(route);}else setHoverState(`c:${route.data.id}`,{text:`${COUNTRIES[route.data.origin].name} → ${COUNTRIES[route.data.destination].name}`,sub:`${money(route.data.usdValue)} attributed · Click to investigate`},route.data.id);return;}
  const anchor=anchorAt(px,py);
  if(anchor){const name=COUNTRIES[anchor.code].name;if(click){deps.onCountry(anchor.code,name);const a=COUNTRIES[anchor.code].anchor;deps.flyTo(a[0],a[1]);}else setHoverState(`a:${anchor.code}`,{text:name,sub:'Explore attributed activity'},null);return;}
  const land=deps.land(),ll=deps.rig.lonLatAt(px,py,flatInvert),country=land&&ll?land.countryAt(ll[0],ll[1]):null;
  if(country){if(click){deps.onCountry(country.code,country.name);if(ll)deps.flyTo(ll[0],ll[1]);}else setHoverState(`k:${country.code}`,{text:country.name,sub:'Explore attributed activity'},null);return;}
  setHoverState('',null,null);
 }
 function setHoverState(key:string,h:Hover|null,corridor:string|null){
  state.hovered=corridor;canvas.style.cursor=h?'pointer':'grab';
  if(key!==hoverKey){hoverKey=key;deps.setHover(h);}
 }
 const apply=(a:GestureAction|null)=>{
  if(!a)return;
  if(a.kind==='pan')deps.rig.drag(a.dx,a.dy);
  else if(a.kind==='zoom')deps.rig.zoomBy(a.factor,a.x,a.y);
  else if(a.kind==='click')clickAt={x:a.x,y:a.y};
  else deps.rig.release(a.inertia);
 };
 const down=(e:PointerEvent)=>{if(!deps.rig.interactive())return;const now=performance.now();pointerDown(gesture,e.pointerId,local(e),now);canvas.setPointerCapture(e.pointerId);state.lastInput=now;};
 const move=(e:PointerEvent)=>{
  const p=local(e);
  if(pointers.has(e.pointerId)){const now=performance.now();state.lastInput=now;apply(pointerMove(gesture,e.pointerId,p,now));}
  else if(!coarse){cursor=p;cursorMoved=true;}
 };
 const up=(e:PointerEvent)=>apply(pointerUp(gesture,e.pointerId,local(e),performance.now()));
 const cancel=(e:PointerEvent)=>apply(pointerCancel(gesture,e.pointerId));
 const leave=()=>{cursor=null;setHoverState('',null,null);};
 const wheel=(e:WheelEvent)=>{e.preventDefault();if(!deps.rig.interactive())return;const p={x:e.offsetX,y:e.offsetY};state.lastInput=performance.now();deps.rig.zoomBy(Math.exp(-e.deltaY*.001),p.x,p.y);};
 const key=(e:KeyboardEvent)=>{
  if(!deps.rig.interactive())return;state.lastInput=performance.now();
  const step=deps.rig.phase==='globe'?4:40;
  switch(e.key){
   case 'ArrowLeft':deps.rig.drag(deps.rig.phase==='globe'?deps.rig.sphereRadiusPx()*4*Math.PI/180:step,0);break;
   case 'ArrowRight':deps.rig.drag(deps.rig.phase==='globe'?-deps.rig.sphereRadiusPx()*4*Math.PI/180:-step,0);break;
   case 'ArrowUp':deps.rig.drag(0,deps.rig.phase==='globe'?deps.rig.sphereRadiusPx()*4*Math.PI/180:step);break;
   case 'ArrowDown':deps.rig.drag(0,deps.rig.phase==='globe'?-deps.rig.sphereRadiusPx()*4*Math.PI/180:-step);break;
   case '+':case '=':deps.zoom(1.3);break;
   case '-':case '_':deps.zoom(.77);break;
   case 'Escape':deps.reset();break;
   default:return;
  }
  e.preventDefault();
 };
 canvas.tabIndex=0;
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key);
 function frame(morphing:boolean,viewChanged:boolean){
  if(morphing){if(hoverKey)setHoverState('',null,null);clickAt=null;return;}
  if(clickAt){const c=clickAt;clickAt=null;resolve(c.x,c.y,true);return;}
  if(!cursor||pointers.size>0)return;
  if(cursorMoved||viewChanged){cursorMoved=false;resolve(cursor.x,cursor.y,false);}
  // The tooltip element mounts a frame after the hover that creates it, so its position is checked every frame but written only on change.
  const tip=deps.tooltip();
  if(tip){const x=Math.min(cursor.x+14,ctx.width-280),y=Math.max(0,cursor.y-62);if(tip!==tipEl||x!==tipX||y!==tipY){tipEl=tip;tipX=x;tipY=y;tip.style.left=`${x}px`;tip.style.top=`${y}px`;}}
 }
 function dispose(){canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);}
 return state;
}
