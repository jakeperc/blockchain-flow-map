/**
 * Routes, drawn as strands: one line per sender-and-receiver pair where a route has several, each in its own lane.
 * 192 slots. Two float textures hold each slot's path on the globe and on the atlas, a third holds its colour, width
 * and motion, so nothing here is a uniform array and the slot count is not bounded by a GPU's uniform limit. One
 * ribbon geometry is drawn twice (core, then a wider additive halo) and one particle system samples the same textures
 * in its vertex shader: three draw calls whatever the number of strands. Per frame the CPU writes only the small
 * per-slot texture, and a slot that draws nothing leaves the clip volume in the vertex shader, so it costs no fill.
 * Only a route's leading strand (and any wide one) carries a halo and the full particle count; the rest carry two.
 */
import * as THREE from 'three';
import {COUNTRIES} from '@/lib/atlas/geography';
import {colorOf,flatControls,routeOpacityTarget,routeWidth,type Strand} from '@/lib/atlas/encoding';
import {arcHeight,angle,laneArc,toSphere,cubicBezier2D,type Vec3} from '@/lib/atlas/geo3d';
import {Tween,damp,easeOutCubic} from '@/lib/atlas/tween';
import type {Corridor,CorridorPair,Transfer} from '@/lib/atlas/model';
import type {ColorMode} from '@/lib/atlas/geography';
import {PARTICLES,RIBBON} from './shaders';
import {R,flat,type Ctx} from './frame';

export const SLOTS=192,SAMPLES=48,MAX_PARTICLES=7;
/** Rows of the per-slot state texture: colour, then (width, drawn fraction, weight, fade), then (particles, halo, phase). */
const STATE_ROWS=3;
/** A lane offset of one px at the home zoom, in radians on the globe and in atlas units on the flat map. */
const LANE_RAD=.0036,LANE_FLAT=1;
/** A route's bundle may bow out by at most this share of its own length, so a short route's strands never balloon. */
const LANE_MAX_SHARE=.3;
/** The selected route's strands fan out by this factor, which is how a dense bundle is read. */
const SPREAD=2.2;
/** Particles on a strand that is not its route's leading one. */
const MINOR_PARTICLES=2,MINOR_PARTICLES_DEMOTED=1;
export type RawEvent={corridor:string;started:number;transaction?:Transfer};
export interface Route{
 id:string;data:Corridor;pair:CorridorPair|null;lead:boolean;slot:number;rank:number;color:THREE.Color;
 /** The strand's own USD, and how many strands its route is drawn as. */
 value:number;lanes:number;
 opacity:number;opacityTarget:number;width:number;widthTarget:number;weight:number;weightTarget:number;
 progress:Tween;fade:number;
 sphere:Float32Array;flatPts:Float32Array;
 /** Great-circle angle between the anchors (radians), fixed for the route's life. */
 theta:number;
 /** Lane offset in px at the home zoom, after a short route's bundle has been scaled to fit: where the strand is drawn and where it is heading. */
 side:number;sideTarget:number;
}
export interface Arcs{
 core:THREE.Mesh;halo:THREE.Mesh;particles:THREE.Points;
 /** Every strand on screen, by strand id. */
 routes:Map<string,Route>;
 /** True while any strand of this corridor is drawn (the ranking's incumbent bonus). */
 hasCorridor(id:string):boolean;
 /** Where a drawn corridor ends, for the raw-event ripple. */
 destinationOf(id:string):string|null;
 update(strands:Strand<Corridor>[],selected:string|null,mode:ColorMode,revealReady:boolean,reduced:boolean,now:number):void;
 /** `now` is the animation clock in seconds (performance.now()/1000); `wall` is Date.now(), which raw events are stamped with.
  * Returns true while anything is still easing, so a still scene (paused, reduced motion) can skip rendering. */
 frame(dt:number,now:number,wall:number,rawEvent:RawEvent|null|undefined,hovered:string|null,morphing:boolean,morph:number,reduced:boolean):boolean;
 relace(now:number,reduced:boolean):void;
 setParticles(n:number):void;
 dispose():void;
}

export function buildArcs(ctx:Ctx):Arcs{
 const sphereData=new Float32Array(SLOTS*SAMPLES*4),flatData=new Float32Array(SLOTS*SAMPLES*4),stateData=new Float32Array(SLOTS*STATE_ROWS*4);
 const mkTex=(d:Float32Array,w:number,h:number)=>{const t=new THREE.DataTexture(d,w,h,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;};
 const texSphere=mkTex(sphereData,SAMPLES,SLOTS),texFlat=mkTex(flatData,SAMPLES,SLOTS),texState=mkTex(stateData,SLOTS,STATE_ROWS);
 // Particle timing is shared with the ribbons, whose comet trails follow the same heads.
 const common={uArcSphere:{value:texSphere},uArcFlat:{value:texFlat},uArcState:{value:texState},uSamples:{value:SAMPLES},uSlots:{value:SLOTS},uMorph:ctx.shared.uMorph,uPixelRatio:ctx.shared.uPixelRatio,uR:ctx.shared.uR,
  uTime:ctx.shared.uTime,uSpeed:{value:1/11.8}};

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
 const count=SLOTS*MAX_PARTICLES+1,pPos=new Float32Array(count*3);
 pPos[2]=1;
 for(let s=0;s<SLOTS;s++)for(let k=0;k<MAX_PARTICLES;k++){const v=1+s*MAX_PARTICLES+k;pPos[v*3]=s;pPos[v*3+1]=k;}
 const pGeom=new THREE.BufferGeometry();pGeom.setAttribute('position',new THREE.BufferAttribute(pPos,3));
 const pMat=new THREE.ShaderMaterial({vertexShader:PARTICLES.vertex,fragmentShader:PARTICLES.fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{...common,uMaxPoint:ctx.shared.uMaxPoint,
  uSize:{value:3.7},uHeadSlot:{value:-1},uHeadT:{value:0},uHeadSize:{value:9}}});
 const particles=new THREE.Points(pGeom,pMat);particles.frustumCulled=false;particles.renderOrder=7;

 const routes=new Map<string,Route>(),bySlot:(Route|null)[]=Array.from({length:SLOTS},()=>null),perCorridor=new Map<string,number>();
 const free=()=>bySlot.findIndex(r=>r===null);
 let pathsDirty=false,stateDirty=true;
 const writeSlot=(slot:number,sphere:Float32Array,fl:Float32Array)=>{
  for(let i=0;i<SAMPLES;i++){const o=(slot*SAMPLES+i)*4;sphereData[o]=sphere[i*3];sphereData[o+1]=sphere[i*3+1];sphereData[o+2]=sphere[i*3+2];sphereData[o+3]=i/(SAMPLES-1);flatData[o]=fl[i*3];flatData[o+1]=fl[i*3+1];flatData[o+2]=fl[i*3+2];flatData[o+3]=i/(SAMPLES-1);}
  pathsDirty=true;
 };
 /** One value of the state texture; the texture is uploaded only on a frame that changed something. */
 const put=(row:number,slot:number,channel:number,v:number)=>{const o=(row*SLOTS+slot)*4+channel;if(stateData[o]!==v){stateData[o]=v;stateDirty=true;}};
 const clearSlot=(slot:number)=>{put(0,slot,3,0);put(1,slot,0,0);};
 // The phase is the slot's, as before, so the strands of one route never pulse in step.
 for(let s=0;s<SLOTS;s++)put(2,s,2,((s*7)%11)/11);

 /** The strand's path on the globe and on the atlas, `side` px out from its route's centreline. */
 function samplesFor(c:Corridor,side:number){
  const oa=COUNTRIES[c.origin].anchor,ob=COUNTRIES[c.destination].anchor;
  const sa=toSphere(oa[0],oa[1],1),sb=toSphere(ob[0],ob[1],1),theta=angle(sa,sb);
  // An outer lane also rides a little higher, which keeps the bundle apart where the globe turns it edge-on.
  const sphere=laneArc(sa,sb,SAMPLES,R,arcHeight(theta)*R*(1+Math.min(.3,side*.008)),side*LANE_RAD);
  const fa=flat(oa[0],oa[1]),fb=flat(ob[0],ob[1]),{c1,c2}=flatControls([fa[0],fa[1]],[fb[0],fb[1]],c.origin,c.destination,true,side*LANE_FLAT);
  const fl=new Float32Array(SAMPLES*3);
  for(let i=0;i<SAMPLES;i++){const p=cubicBezier2D([fa[0],fa[1]],c1,c2,[fb[0],fb[1]],i/(SAMPLES-1));fl[i*3]=p[0];fl[i*3+1]=p[1];fl[i*3+2]=R;}
  return {sphere,fl,theta};
 }
 /** How far a bundle of `extent` px may spread on a route `theta` long before it is scaled down. */
 const laneScale=(theta:number,extent:number)=>Math.min(1,theta*LANE_MAX_SHARE/Math.max(1e-6,extent*LANE_RAD));
 const thetaOf=(c:Corridor)=>{const oa=COUNTRIES[c.origin].anchor,ob=COUNTRIES[c.destination].anchor;return angle(toSphere(oa[0],oa[1],1),toSphere(ob[0],ob[1],1));};

 let particleCount=ctx.profile.particlesPerRoute,minorCount=MINOR_PARTICLES;
 /** The strand a raw event's head rides: the one for its sender and receiver, else its route's leading strand. */
 let headFor:RawEvent|null=null,headRoute:Route|null=null;
 const resolveHead=(e:RawEvent|null|undefined)=>{
  if(!e){headFor=null;headRoute=null;return null;}
  if(e===headFor&&headRoute&&routes.get(headRoute.id)===headRoute)return headRoute;
  const tx=e.transaction;let lead:Route|null=null,exact:Route|null=null;
  for(const r of routes.values()){
   if(r.data.id!==e.corridor)continue;
   if(r.lead)lead=r;
   if(tx&&r.pair&&r.pair.from===tx.senderEntity.entity&&r.pair.to===tx.receiverEntity.entity)exact=r;
  }
  headFor=e;headRoute=exact??lead;return headRoute;
 };
 return {
  core,halo,particles,routes,
  hasCorridor:id=>(perCorridor.get(id)??0)>0,
  destinationOf:id=>{for(const r of routes.values())if(r.data.id===id)return r.data.destination;return null;},
  update(strands,selected,mode,revealReady,reduced,now){
   const desired=new Set(strands.map(s=>s.id));
   for(const r of routes.values())if(!desired.has(r.id))r.opacityTarget=0;
   strands.forEach((s,rank)=>{
    const c=s.corridor;
    if(!COUNTRIES[c.origin]||!COUNTRIES[c.destination])return;
    const spread=selected===c.id?SPREAD:1;
    let r=routes.get(s.id);
    if(!r){
     const slot=free();if(slot<0)return;
     const side=s.offset*spread*laneScale(thetaOf(c),s.extent*spread);
     const {sphere,fl,theta}=samplesFor(c,side);writeSlot(slot,sphere,fl);
     r={id:s.id,data:c,pair:s.pair,lead:s.lane===0,value:s.usdValue,lanes:s.lanes,slot,rank,color:new THREE.Color(),opacity:0,opacityTarget:1,width:.65,widthTarget:.65,weight:1,weightTarget:1,progress:new Tween(0,easeOutCubic),fade:1,sphere,flatPts:fl,theta,side,sideTarget:side};
     routes.set(s.id,r);bySlot[slot]=r;perCorridor.set(c.id,(perCorridor.get(c.id)??0)+1);
     if(reduced||!revealReady)r.progress.jump(1);else r.progress.retarget(1,.7,now+rank*.006);
    }
    r.data=c;r.pair=s.pair;r.lead=s.lane===0;r.value=s.usdValue;r.lanes=s.lanes;r.rank=rank;r.color.set(colorOf(c,mode));
    r.opacityTarget=routeOpacityTarget(selected,c.id);r.widthTarget=routeWidth(s.usdValue);
    r.sideTarget=s.offset*spread*laneScale(r.theta,s.extent*spread);
   });
  },
  frame(dt,now,wall,rawEvent,hovered,morphing,morph,reduced){
   const k=damp(6,dt),kw=damp(4,dt);
   const bell=morphing?Math.pow(Math.sin(Math.PI*morph),2):0;
   const head=resolveHead(rawEvent);
   let busy=morphing;
   for(const [id,r] of routes){
    r.weightTarget=hovered===null?1:hovered===r.data.id?1.35:.85;
    if(Math.abs(r.opacityTarget-r.opacity)>1e-3||Math.abs(r.widthTarget-r.width)>1e-3||Math.abs(r.weightTarget-r.weight)>1e-3||r.progress.active)busy=true;
    r.opacity+=(r.opacityTarget-r.opacity)*k;r.width+=(r.widthTarget-r.width)*kw;r.weight+=(r.weightTarget-r.weight)*k;
    if(r.opacityTarget===0&&r.opacity<.015){
     clearSlot(r.slot);bySlot[r.slot]=null;routes.delete(id);busy=true;
     const left=(perCorridor.get(r.data.id)??1)-1;if(left>0)perCorridor.set(r.data.id,left);else perCorridor.delete(r.data.id);
     continue;
    }
    // A strand changing lane (its route gained or lost a strand, or was selected) glides there; its path is rewritten only while it moves.
    if(r.side!==r.sideTarget){
     r.side=reduced||Math.abs(r.sideTarget-r.side)<.08?r.sideTarget:r.side+(r.sideTarget-r.side)*k;
     const {sphere,fl}=samplesFor(r.data,r.side);r.sphere=sphere;r.flatPts=fl;writeSlot(r.slot,sphere,fl);busy=true;
    }
    const signal=!!rawEvent&&head===r&&wall-rawEvent.started<5000;
    if(signal)busy=true;
    const progress=r.progress.update(now);
    r.fade=1-.85*bell*Math.min(1,r.theta/Math.PI*1.6);
    const s=r.slot;
    put(0,s,0,r.color.r);put(0,s,1,r.color.g);put(0,s,2,r.color.b);// A route's leading strand is as bright as a route always was; the others dim with their width, so the eye ranks a bundle.
    put(0,s,3,r.opacity*(signal?.9:r.lead?.54:.34+.2*Math.min(1,Math.max(0,(r.width-.65)/4.05))));
    put(1,s,0,r.width+(signal?.5:0));put(1,s,1,progress);put(1,s,2,r.weight);put(1,s,3,r.fade);
    put(2,s,0,r.lead?particleCount:Math.min(particleCount,minorCount));put(2,s,1,r.lead||r.width>2.4?1:0);
   }
   if(pathsDirty){pathsDirty=false;texSphere.needsUpdate=true;texFlat.needsUpdate=true;}
   if(stateDirty){stateDirty=false;texState.needsUpdate=true;}
   // Raw event: a bright head traverses its strand in 3 s (wall clock, as today); the ripple lives in anchors.ts.
   const u=pMat.uniforms;
   const p=rawEvent?(wall-rawEvent.started)/3000:2;
   if(head&&p<=1&&!reduced){u.uHeadSlot.value=head.slot;u.uHeadT.value=Math.max(0,p);busy=true;}
   else u.uHeadSlot.value=-1;
   return busy;
  },
  relace(now,reduced){for(const r of routes.values()){if(reduced){r.progress.jump(1);continue;}r.progress.jump(0);r.progress.retarget(1,.5,now+r.rank*.006);}},
  // Called when the frame-time governor demotes the tier: fewer particles on every strand.
  setParticles(n){particleCount=Math.min(MAX_PARTICLES,n);minorCount=MINOR_PARTICLES_DEMOTED;},
  dispose(){ribbonGeom.dispose();(core.material as THREE.Material).dispose();(halo.material as THREE.Material).dispose();pGeom.dispose();pMat.dispose();texSphere.dispose();texFlat.dispose();texState.dispose();}
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
