/**
 * Jurisdiction anchors: ring + centre dot (surface-tangent), a breathing ground halo (billboard) and, on the globe, a
 * thin beam — three instanced draws over the same 37 instances. Instance 36 is the raw-event ripple. All three read
 * the same one-sided-activity value, so the encoding stays "glow = one-sided evidenced activity, never a route".
 */
import * as THREE from 'three';
import {COUNTRIES} from '@/lib/atlas/geography';
import {glowOpacityTarget,glowRadius} from '@/lib/atlas/encoding';
import {toSphere,type Vec3} from '@/lib/atlas/geo3d';
import {damp} from '@/lib/atlas/tween';
import type {CountrySummary,Corridor} from '@/lib/atlas/model';
import {BEAM,HALO,RING} from './shaders';
import {R,flat,hexToVec3,type Ctx} from './frame';

export const CODES=Object.keys(COUNTRIES),RIPPLE=CODES.length;
interface AnchorState{ringT:number;ring:number;dotT:number;dot:number;glowT:number;glow:number;scaleT:number;scale:number;active:boolean}
export interface Anchors{
 ring:THREE.InstancedMesh;halo:THREE.InstancedMesh;beam:THREE.InstancedMesh;
 sphere:Vec3[];flatPts:Vec3[];
 state:Map<string,AnchorState>;
 update(countries:CountrySummary[]|undefined,chosen:Corridor[],country:string|null):void;
 /** Returns true when the instance data changed this frame. */
 frame(dt:number,now:number,rawEvent:{corridor:string;started:number}|null|undefined,routeDest:(id:string)=>string|null,reduced:boolean):boolean;
 setBeams(on:boolean):void;
 dispose():void;
}

function ringDotGeometry(){
 const ring=new THREE.RingGeometry(2.3,2.8,24),dot=new THREE.CircleGeometry(1.5,12);
 const rp=ring.getAttribute('position') as THREE.BufferAttribute,dp=dot.getAttribute('position') as THREE.BufferAttribute;
 const pos=new Float32Array((rp.count+dp.count)*3),part=new Float32Array(rp.count+dp.count);
 pos.set(rp.array as Float32Array,0);pos.set(dp.array as Float32Array,rp.count*3);part.fill(1,rp.count);
 const idx:number[]=Array.from(ring.index!.array as ArrayLike<number>);const di=dot.index!.array as ArrayLike<number>;for(let i=0;i<di.length;i++)idx.push(di[i]+rp.count);
 const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aPart',new THREE.BufferAttribute(part,1));g.setIndex(idx);
 ring.dispose();dot.dispose();return g;
}
function beamGeometry(){
 const g=new THREE.InstancedBufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,1,1,0,-1,1,0],3));g.setIndex([0,1,2,0,2,3]);return g;
}
function haloGeometry(){
 const g=new THREE.InstancedBufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));g.setIndex([0,1,2,0,2,3]);return g;
}

export function buildAnchors(ctx:Ctx):Anchors{
 const n=CODES.length+1;
 const sphere:Vec3[]=[],flatPts:Vec3[]=[];
 const iSphere=new Float32Array(n*3),iFlat=new Float32Array(n*3),iState=new Float32Array(n*4),iRing=new Float32Array(n*2);
 CODES.forEach((code,i)=>{const a=COUNTRIES[code].anchor,s=toSphere(a[0],a[1],R),f=flat(a[0],a[1]);sphere.push(s);flatPts.push(f);iSphere.set(s,i*3);iFlat.set(f,i*3);iState[i*4+3]=(code.charCodeAt(0)*7+code.charCodeAt(1))%10;iRing[i*2]=1;});
 const attrs={iSphere:new THREE.InstancedBufferAttribute(iSphere,3),iFlat:new THREE.InstancedBufferAttribute(iFlat,3),iState:new THREE.InstancedBufferAttribute(iState,4),iRing:new THREE.InstancedBufferAttribute(iRing,2)};
 attrs.iState.setUsage(THREE.DynamicDrawUsage);attrs.iRing.setUsage(THREE.DynamicDrawUsage);
 const withInstances=(g:THREE.InstancedBufferGeometry)=>{for(const [k,a] of Object.entries(attrs))g.setAttribute(k,a);g.instanceCount=n;return g;};
 const glowColor=hexToVec3('#8fc7a8');
 // DoubleSide throughout: tangent frames and billboards can wind either way depending on where the anchor sits.
 const ringMat=new THREE.ShaderMaterial({vertexShader:RING.vertex,fragmentShader:RING.fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uMorph:ctx.shared.uMorph,uRingColor:{value:hexToVec3('#a3c7b5')},uDotColor:{value:hexToVec3('#b6d4c5')}}});
 const haloMat=new THREE.ShaderMaterial({vertexShader:HALO.vertex,fragmentShader:HALO.fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uMorph:ctx.shared.uMorph,uTime:ctx.shared.uTime,uGlowColor:{value:glowColor}}});
 const beamMat=new THREE.ShaderMaterial({vertexShader:BEAM.vertex,fragmentShader:BEAM.fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uMorph:ctx.shared.uMorph,uBeams:{value:ctx.profile.beams?1:0},uGlowColor:{value:glowColor}}});
 const ring=new THREE.InstancedMesh(withInstances(ringDotGeometry()),ringMat,n),halo=new THREE.InstancedMesh(withInstances(haloGeometry()),haloMat,n),beam=new THREE.InstancedMesh(withInstances(beamGeometry()),beamMat,n);
 for(const m of [ring,halo,beam]){m.frustumCulled=false;}
 ring.renderOrder=4;halo.renderOrder=8;beam.renderOrder=8;
 const state=new Map<string,AnchorState>(CODES.map(c=>[c,{ringT:.12,ring:.12,dotT:.12,dot:.12,glowT:0,glow:0,scaleT:0,scale:0,active:false}]));
 const states=CODES.map(c=>state.get(c)!);
 let dirty=true;
 return {
  ring,halo,beam,sphere,flatPts,state,
  update(countries,chosen,country){
   const byCode=new Map((countries??[]).map(c=>[c.code,c.knownEndpointAdjusted] as const));
   for(const code of CODES){
    const s=state.get(code)!,v=byCode.get(code)??0,routed=chosen.some(c=>c.origin===code||c.destination===code);
    s.scaleT=glowRadius(v);s.glowT=v>0?glowOpacityTarget(country,code):0;s.active=v>0||routed;
    const lit=s.active;s.ringT=routed?.35:lit?.22:.12;s.dotT=routed?.85:lit?.5:.12;
   }
   dirty=true;
  },
  frame(dt,now,rawEvent,routeDest,reduced){
   const k=reduced?1:damp(5,dt);let moving=false;
   const ease=(cur:number,t:number)=>{if(Math.abs(t-cur)>1e-3){moving=true;return cur+(t-cur)*k;}return t;};
   for(let i=0;i<states.length;i++){
    const s=states[i];
    s.ring=ease(s.ring,s.ringT);s.dot=ease(s.dot,s.dotT);s.glow=ease(s.glow,s.glowT);s.scale=ease(s.scale,s.scaleT);
    iState[i*4]=s.ring;iState[i*4+1]=s.glow;iState[i*4+2]=s.scale;iRing[i*2+1]=s.dot;
   }
   // Ripple: instance 36 sits on the destination anchor for 3–5 s after a raw event, growing and fading.
   const p=rawEvent?(now-rawEvent.started)/3000:2,dest=rawEvent&&p>1&&p<1.67?routeDest(rawEvent.corridor):null,di=dest?CODES.indexOf(dest):-1;
   const ro=RIPPLE*4;
   if(di>=0){const q=(p-1)/.67;iSphere.set(sphere[di],RIPPLE*3);iFlat.set(flatPts[di],RIPPLE*3);iState[ro]=.5*(1-q);iRing[RIPPLE*2]=reduced?3:1+q*8;attrs.iSphere.needsUpdate=true;attrs.iFlat.needsUpdate=true;moving=true;}
   else{iState[ro]=0;iRing[RIPPLE*2]=1;}
   iState[ro+1]=0;iState[ro+2]=0;iRing[RIPPLE*2+1]=0;
   const changed=moving||dirty;
   if(changed){attrs.iState.needsUpdate=true;attrs.iRing.needsUpdate=true;dirty=false;}
   return changed;
  },
  setBeams(on){beamMat.uniforms.uBeams.value=on?1:0;beam.visible=on;},
  dispose(){for(const m of [ring,halo,beam]){m.geometry.dispose();(m.material as THREE.Material).dispose();}}
 };
}
