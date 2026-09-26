/**
 * Corridors: 64 slots, two float textures holding each slot's great-circle (globe) and Bézier (atlas) samples, one
 * ribbon geometry drawn twice (core, then a wider additive halo) and one particle system that samples the same
 * textures in its vertex shader. Per frame the CPU writes only the two per-slot uniform arrays.
 */
import * as THREE from 'three';
import {COUNTRIES} from '@/lib/atlas/geography';
import {colorOf,flatControls,routeOpacityTarget,routeWidth} from '@/lib/atlas/encoding';
import {arcHeight,angle,greatCircle,toSphere,cubicBezier2D,type Vec3} from '@/lib/atlas/geo3d';
import {Tween,damp,easeOutCubic} from '@/lib/atlas/tween';
import type {Corridor} from '@/lib/atlas/model';
import type {ColorMode} from '@/lib/atlas/geography';
import {PARTICLES,RIBBON} from './shaders';
import {R,flat,type Ctx} from './frame';

export const SLOTS=64,SAMPLES=48,MAX_PARTICLES=7;
export interface Route{
 data:Corridor;slot:number;rank:number;color:THREE.Color;
 opacity:number;opacityTarget:number;width:number;widthTarget:number;weight:number;weightTarget:number;
 progress:Tween;fade:number;
 sphere:Float32Array;flatPts:Float32Array;
 /** Great-circle angle between the anchors (radians), fixed for the route's life. */
 theta:number;
}
export interface Arcs{
 core:THREE.Mesh;halo:THREE.Mesh;particles:THREE.Points;
 routes:Map<string,Route>;
 update(corridors:Corridor[],selected:string|null,mode:ColorMode,revealReady:boolean,reduced:boolean,now:number):void;
 /** `now` is the animation clock in seconds (performance.now()/1000); `wall` is Date.now(), which raw events are stamped with.
  * Returns true while anything is still easing, so a still scene (paused, reduced motion) can skip rendering. */
 frame(dt:number,now:number,wall:number,rawEvent:{corridor:string;started:number}|null|undefined,hovered:string|null,morphing:boolean,morph:number,reduced:boolean):boolean;
 relace(now:number,reduced:boolean):void;
 setParticles(n:number):void;
 dispose():void;
}

export function buildArcs(ctx:Ctx):Arcs{
 const sphereData=new Float32Array(SLOTS*SAMPLES*4),flatData=new Float32Array(SLOTS*SAMPLES*4);
 const mkTex=(d:Float32Array)=>{const t=new THREE.DataTexture(d,SAMPLES,SLOTS,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;};
 const texSphere=mkTex(sphereData),texFlat=mkTex(flatData);
 const arcColor=new Float32Array(SLOTS*4),arcParam=new Float32Array(SLOTS*4);
 // Particle timing is shared with the ribbons, whose comet trails follow the same heads.
 const common={uArcSphere:{value:texSphere},uArcFlat:{value:texFlat},uSamples:{value:SAMPLES},uArcColor:{value:arcColor},uArcParam:{value:arcParam},uMorph:ctx.shared.uMorph,uPixelRatio:ctx.shared.uPixelRatio,uR:ctx.shared.uR,
  uTime:ctx.shared.uTime,uSpeed:{value:1/11.8},uCount:{value:ctx.profile.particlesPerRoute}};

 // Ribbon: (slot, sample, side) per vertex; a quad strip per slot.
 const verts=new Float32Array(SLOTS*SAMPLES*2*3),index:number[]=[];
 for(let s=0;s<SLOTS;s++)for(let i=0;i<SAMPLES;i++)for(let side=0;side<2;side++){const v=(s*SAMPLES+i)*2+side;verts[v*3]=s;verts[v*3+1]=i;verts[v*3+2]=side?1:-1;}
 for(let s=0;s<SLOTS;s++)for(let i=0;i<SAMPLES-1;i++){const a=(s*SAMPLES+i)*2,b=a+2;index.push(a,a+1,b,a+1,b+1,b);}
 const ribbonGeom=new THREE.BufferGeometry();ribbonGeom.setAttribute('position',new THREE.BufferAttribute(verts,3));ribbonGeom.setIndex(index);
 // DoubleSide: the quad strip is expanded in screen space, so its winding depends on the direction of travel.
 const ribbonMat=(halo:boolean)=>new THREE.ShaderMaterial({vertexShader:RIBBON.vertex,fragmentShader:RIBBON.fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:halo?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{...common,uHalo:{value:halo?1:0},uResolution:ctx.shared.uResolution,uTrail:{value:.085}}});
 const core=new THREE.Mesh(ribbonGeom,ribbonMat(false));core.frustumCulled=false;core.renderOrder=5;
 const halo=new THREE.Mesh(ribbonGeom,ribbonMat(true));halo.frustumCulled=false;halo.renderOrder=6;halo.visible=ctx.profile.halo;

 // Particles: (slot, k, head) per point; index 0 is the raw-event head.
 const count=SLOTS*MAX_PARTICLES+1,pPos=new Float32Array(count*3),pPhase=new Float32Array(count);
 pPos[2]=1;
 for(let s=0;s<SLOTS;s++)for(let k=0;k<MAX_PARTICLES;k++){const v=1+s*MAX_PARTICLES+k;pPos[v*3]=s;pPos[v*3+1]=k;pPhase[v]=((s*7)%11)/11;}
 const pGeom=new THREE.BufferGeometry();pGeom.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeom.setAttribute('aPhase',new THREE.BufferAttribute(pPhase,1));
 const pMat=new THREE.ShaderMaterial({vertexShader:PARTICLES.vertex,fragmentShader:PARTICLES.fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{...common,uMaxPoint:ctx.shared.uMaxPoint,
  uSize:{value:3.7},uHeadSlot:{value:-1},uHeadT:{value:0},uHeadSize:{value:9}}});
 const particles=new THREE.Points(pGeom,pMat);particles.frustumCulled=false;particles.renderOrder=7;

 const routes=new Map<string,Route>(),bySlot:(Route|null)[]=Array.from({length:SLOTS},()=>null);
 const free=()=>bySlot.findIndex(r=>r===null);
 const writeSlot=(slot:number,sphere:Float32Array,fl:Float32Array)=>{
  for(let i=0;i<SAMPLES;i++){const o=(slot*SAMPLES+i)*4;sphereData[o]=sphere[i*3];sphereData[o+1]=sphere[i*3+1];sphereData[o+2]=sphere[i*3+2];sphereData[o+3]=i/(SAMPLES-1);flatData[o]=fl[i*3];flatData[o+1]=fl[i*3+1];flatData[o+2]=fl[i*3+2];flatData[o+3]=i/(SAMPLES-1);}
  texSphere.needsUpdate=true;texFlat.needsUpdate=true;
 };
 const clearSlot=(slot:number)=>{arcParam[slot*4]=0;arcColor[slot*4+3]=0;};

 function samplesFor(c:Corridor){
  const oa=COUNTRIES[c.origin].anchor,ob=COUNTRIES[c.destination].anchor;
  const sa=toSphere(oa[0],oa[1],1),sb=toSphere(ob[0],ob[1],1),theta=angle(sa,sb);
  const sphere=greatCircle(sa,sb,SAMPLES,R,arcHeight(theta)*R);
  const fa=flat(oa[0],oa[1]),fb=flat(ob[0],ob[1]),{c1,c2}=flatControls([fa[0],fa[1]],[fb[0],fb[1]],c.origin,c.destination,true);
  const fl=new Float32Array(SAMPLES*3);
  for(let i=0;i<SAMPLES;i++){const p=cubicBezier2D([fa[0],fa[1]],c1,c2,[fb[0],fb[1]],i/(SAMPLES-1));fl[i*3]=p[0];fl[i*3+1]=p[1];fl[i*3+2]=R;}
  return {sphere,fl,theta};
 }

 let particleCount=ctx.profile.particlesPerRoute;
 return {
  core,halo,particles,routes,
  update(corridors,selected,mode,revealReady,reduced,now){
   const desired=new Set(corridors.map(c=>c.id));
   for(const r of routes.values())r.opacityTarget=desired.has(r.data.id)?routeOpacityTarget(selected,r.data.id):0;
   corridors.forEach((c,rank)=>{
    if(!COUNTRIES[c.origin]||!COUNTRIES[c.destination])return;
    let r=routes.get(c.id);
    if(!r){
     const slot=free();if(slot<0)return;
     const {sphere,fl,theta}=samplesFor(c);writeSlot(slot,sphere,fl);
     r={data:c,slot,rank,color:new THREE.Color(),opacity:0,opacityTarget:1,width:.65,widthTarget:.65,weight:1,weightTarget:1,progress:new Tween(0,easeOutCubic),fade:1,sphere,flatPts:fl,theta};
     routes.set(c.id,r);bySlot[slot]=r;
     if(reduced||!revealReady)r.progress.jump(1);else r.progress.retarget(1,.7,now+rank*.012);
    }
    r.data=c;r.rank=rank;r.color.set(colorOf(c,mode));r.opacityTarget=routeOpacityTarget(selected,c.id);r.widthTarget=routeWidth(c.usdValue);
   });
  },
  frame(dt,now,wall,rawEvent,hovered,morphing,morph,reduced){
   const k=damp(6,dt),kw=damp(4,dt);
   const bell=morphing?Math.pow(Math.sin(Math.PI*morph),2):0;
   let busy=morphing;
   for(const [id,r] of routes){
    r.weightTarget=hovered===null?1:hovered===id?1.35:.85;
    if(Math.abs(r.opacityTarget-r.opacity)>1e-3||Math.abs(r.widthTarget-r.width)>1e-3||Math.abs(r.weightTarget-r.weight)>1e-3||r.progress.active)busy=true;
    r.opacity+=(r.opacityTarget-r.opacity)*k;r.width+=(r.widthTarget-r.width)*kw;r.weight+=(r.weightTarget-r.weight)*k;
    if(r.opacityTarget===0&&r.opacity<.015){clearSlot(r.slot);bySlot[r.slot]=null;routes.delete(id);busy=true;continue;}
    const signal=!!rawEvent&&rawEvent.corridor===id&&wall-rawEvent.started<5000;
    if(signal)busy=true;
    const progress=r.progress.update(now);
    r.fade=1-.85*bell*Math.min(1,r.theta/Math.PI*1.6);
    const o=r.slot*4;
    arcColor[o]=r.color.r;arcColor[o+1]=r.color.g;arcColor[o+2]=r.color.b;arcColor[o+3]=r.opacity*(signal?.9:.54);
    arcParam[o]=r.width+(signal?.5:0);arcParam[o+1]=progress;arcParam[o+2]=r.weight;arcParam[o+3]=r.fade;
   }
   // Raw event: a bright head traverses the corridor in 3 s (wall clock, as today); the ripple lives in anchors.ts.
   const u=pMat.uniforms;const route=rawEvent?routes.get(rawEvent.corridor):null;
   const p=rawEvent?(wall-rawEvent.started)/3000:2;
   if(route&&p<=1&&!reduced){u.uHeadSlot.value=route.slot;u.uHeadT.value=Math.max(0,p);busy=true;}
   else u.uHeadSlot.value=-1;
   return busy;
  },
  relace(now,reduced){for(const r of routes.values()){if(reduced){r.progress.jump(1);continue;}r.progress.jump(0);r.progress.retarget(1,.5,now+r.rank*.012);}},
  setParticles(n){particleCount=Math.min(MAX_PARTICLES,n);common.uCount.value=particleCount;},
  dispose(){ribbonGeom.dispose();(core.material as THREE.Material).dispose();(halo.material as THREE.Material).dispose();pGeom.dispose();pMat.dispose();texSphere.dispose();texFlat.dispose();}
 };
}
/** Great-circle midpoint of a corridor, for fly-to. */
export function corridorMidpoint(c:Corridor):[number,number]{
 const a=COUNTRIES[c.origin].anchor,b=COUNTRIES[c.destination].anchor;
 const sa=toSphere(a[0],a[1],1),sb=toSphere(b[0],b[1],1);
 const m:Vec3=[sa[0]+sb[0],sa[1]+sb[1],sa[2]+sb[2]];
 const len=Math.hypot(m[0],m[1],m[2])||1;
 const [lon,lat]=[Math.atan2(m[0]/len,m[2]/len)*180/Math.PI,Math.asin(m[1]/len)*180/Math.PI];
 return [lon,lat];
}
