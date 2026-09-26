/**
 * The camera rig and the globe↔atlas morph. One perspective camera in both modes. The globe is orbited by rotating
 * the `world` group (yaw about y, pitch about x) with the camera elevated above the equator; the atlas is a long lens
 * looking straight down at the plane z=R, positioned so the 1100×530 design frame fits exactly as today.
 */
import * as THREE from 'three';
import {ZOOM_MAX,ZOOM_MIN} from '@/lib/atlas/encoding';
import {Tween,damp,easeInOutCubic,easeInOutSine,easeOutCubic,clamp01} from '@/lib/atlas/tween';
import {toLonLat,type Vec3} from '@/lib/atlas/geo3d';
import {R,viewHeight,type Ctx} from './frame';

export type MapMode='globe'|'atlas';
export type Phase='globe'|'toAtlas'|'toGlobe'|'atlas';
const DEG=Math.PI/180,GLOBE_FOV=38,ATLAS_FOV=20,HOME_LON=-40,HOME_ELEV=20,MORPH_S=1.6,PITCH_MAX=80*DEG;

export interface Rig{
 phase:Phase;morph:number;body:number;atmo:number;
 yaw:number;pitch:number;zoom:number;
 setMode(mode:MapMode,now:number,reduced:boolean):void;
 /** Orbit by a screen-space drag (px) in globe mode; pan in atlas mode. */
 drag(dx:number,dy:number):void;
 release(vx:number,vy:number):void;
 /** Multiply the zoom level, keeping the point under (px,py) fixed when given. */
 zoomBy(factor:number,px?:number,py?:number):void;
 flyTo(lon:number,lat:number,now:number,reduced:boolean):void;
 reset(now:number,reduced:boolean):void;
 /** Arrival: a slow dolly-in from slightly wide while the land reveals. No-op with reduced motion or after any input. */
 intro(now:number,reduced:boolean):void;
 /** Ray in world-group local space through a viewport pixel. */
 ray(px:number,py:number):{origin:Vec3;dir:Vec3};
 /** Lon/lat under a pixel (sphere in globe mode, plane in atlas mode), or null. */
 lonLatAt(px:number,py:number,flatInvert:(x:number,y:number)=>[number,number]|null):[number,number]|null;
 sphereRadiusPx():number;
 idle(dt:number,allowRotate:boolean):void;
 frame(dt:number,now:number):{morphing:boolean;justFinished:boolean};
 /** True while a tween, inertia or zoom easing is still moving the camera. */
 moving():boolean;
 interactive():boolean;
}

export function buildRig(ctx:Ctx):Rig{
 const cam=ctx.camera,world=ctx.world;
 const morph=new Tween(0,easeInOutCubic),elev=new Tween(HOME_ELEV,easeInOutSine),fov=new Tween(GLOBE_FOV,easeInOutSine),dist=new Tween(0,easeInOutSine);
 const yawT=new Tween(HOME_LON*DEG*-1,easeInOutCubic),pitchT=new Tween(0,easeInOutCubic),zoomT=new Tween(1,easeOutCubic);
 let yaw=yawT.value,pitch=0,zoom=1,vYaw=0,vPitch=0,panX=0,panY=0,vPanX=0,vPanY=0,lastPhase:Phase='globe',finishedAt=-1;
 /** Scene units per canvas pixel on the atlas plane: the design frame spans the map area, not the (taller) canvas. */
 const rc=new THREE.Raycaster(),ndc=new THREE.Vector2(),inv=new THREE.Matrix4(),ro=new THREE.Vector3(),rd=new THREE.Vector3();
 const unitsPerPx=()=>viewHeight(ctx.width,ctx.areaHeight)/ctx.areaHeight/zoom;
 const rig:Rig={phase:'globe',morph:0,body:1,atmo:1,yaw,pitch,zoom,
  setMode(mode,now,reduced){
   const target=mode==='atlas'?1:0;if(morph.target===target)return;
   const d=reduced?0:MORPH_S;
   morph.retarget(target,d,now);elev.retarget(target?0:HOME_ELEV,d,now);fov.retarget(target?ATLAS_FOV:GLOBE_FOV,d,now);dist.retarget(target,d,now);
   if(target){yawT.retarget(0,d*.6,now);pitchT.retarget(0,d*.6,now);panX=panY=0;}
   else{yawT.jump(yaw);pitchT.jump(pitch);yawT.retarget(HOME_LON*DEG*-1,d,now);pitchT.retarget(0,d,now);}
   zoomT.retarget(1,d,now);vYaw=vPitch=vPanX=vPanY=0;
   rig.phase=target?'toAtlas':'toGlobe';
  },
  drag(dx,dy){
   if(rig.phase==='globe'){const r=rig.sphereRadiusPx();const dy1=dx/r,dp=dy/r;yaw+=dy1;pitch=Math.max(-PITCH_MAX,Math.min(PITCH_MAX,pitch+dp));yawT.jump(yaw);pitchT.jump(pitch);vYaw=dy1;vPitch=dp;}
   else if(rig.phase==='atlas'){const u=unitsPerPx();panX-=dx*u;panY+=dy*u;vPanX=-dx*u;vPanY=dy*u;}
  },
  release(){/* velocities were recorded by the last drag */},
  zoomBy(factor,px,py){
   const next=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoomT.target*factor)),f=next/zoomT.target;
   if(f===1)return;
   if(rig.phase==='atlas'&&px!==undefined&&py!==undefined){
    const u=unitsPerPx(),ux=(px-ctx.width/2)*u,uy=-(py-ctx.height/2)*u;
    panX+=ux*(1-1/f);panY+=uy*(1-1/f);
   }else if(rig.phase==='globe'&&px!==undefined&&py!==undefined&&f>1){
    const hit=rig.lonLatAt(px,py,()=>null);
    if(hit){const [lon,lat]=hit,centerLon=-yaw/DEG,centerLat=pitch/DEG+HOME_ELEV*0;let dl=lon-centerLon;dl=((dl+540)%360)-180;yaw-=dl*DEG*(1-1/f)*.9;pitch=Math.max(-PITCH_MAX,Math.min(PITCH_MAX,pitch+(lat-centerLat)*DEG*(1-1/f)*.9));yawT.jump(yaw);pitchT.jump(pitch);}
   }
   zoomT.jump(next);
  },
  flyTo(lon,lat,now,reduced){
   const d=reduced?0:.9;
   if(rig.phase==='globe'){const ty=-lon*DEG,cur=yaw;let dl=ty-cur;dl=((dl+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;yawT.jump(cur);yawT.retarget(cur+dl,d,now);pitchT.jump(pitch);pitchT.retarget(Math.max(-PITCH_MAX,Math.min(PITCH_MAX,(lat-HOME_ELEV)*DEG)),d,now);zoomT.retarget(Math.max(zoomT.target,1.6),d,now);vYaw=vPitch=0;}
  },
  reset(now,reduced){
   const d=reduced?0:.9;
   if(rig.phase==='globe'){yawT.jump(yaw);pitchT.jump(pitch);let dl=HOME_LON*DEG*-1-yaw;dl=((dl+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;yawT.retarget(yaw+dl,d,now);pitchT.retarget(0,d,now);}
   panX=panY=0;vYaw=vPitch=vPanX=vPanY=0;zoomT.retarget(1,d,now);
  },
  intro(now,reduced){
   if(reduced||rig.phase!=='globe'||zoomT.target!==1||zoom!==1)return;
   zoomT.jump(.84);zoom=.84;zoomT.retarget(1,2.4,now);
  },
  ray(px,py){
   ndc.set(px/ctx.width*2-1,-(py/ctx.height)*2+1);rc.setFromCamera(ndc,cam);
   inv.copy(world.matrixWorld).invert();
   const o=ro.copy(rc.ray.origin).applyMatrix4(inv),d=rd.copy(rc.ray.direction).transformDirection(inv).normalize();
   return {origin:[o.x,o.y,o.z],dir:[d.x,d.y,d.z]};
  },
  lonLatAt(px,py,flatInvert){
   const {origin:o,dir:d}=rig.ray(px,py);
   if(rig.morph<.5){
    const b=o[0]*d[0]+o[1]*d[1]+o[2]*d[2],c=o[0]*o[0]+o[1]*o[1]+o[2]*o[2]-R*R,disc=b*b-c;
    if(disc<0)return null;const t=-b-Math.sqrt(disc);if(t<0)return null;
    return toLonLat([o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t]);
   }
   if(Math.abs(d[2])<1e-6)return null;
   const t=(R-o[2])/d[2];if(t<0)return null;
   const x=o[0]+d[0]*t,y=o[1]+d[1]*t;
   const ll=flatInvert(x,-y);
   return ll&&Number.isFinite(ll[0])&&Number.isFinite(ll[1])&&Math.abs(ll[0])<=180&&Math.abs(ll[1])<=90?ll:null;
  },
  sphereRadiusPx(){return R*(ctx.height/2)/(cam.position.length()*Math.tan(cam.fov*DEG/2));},
  idle(dt,allowRotate){if(allowRotate&&rig.phase==='globe'){yaw+=.35*DEG*dt;yawT.jump(yaw);}},
  frame(dt,now){
   const m=morph.update(now);rig.morph=m;
   const e=elev.update(now),fv=fov.update(now),ds=dist.update(now);
   // Inertia (globe drags and atlas pans) with frame-rate-independent decay; tweens win when they are running.
   const kd=damp(4,dt);
   if(yawT.active||pitchT.active){yaw=yawT.update(now);pitch=pitchT.update(now);vYaw=vPitch=0;}
   else{yaw+=vYaw;pitch=Math.max(-PITCH_MAX,Math.min(PITCH_MAX,pitch+vPitch));vYaw*=1-kd;vPitch*=1-kd;yawT.jump(yaw);pitchT.jump(pitch);}
   if(Math.abs(vPanX)+Math.abs(vPanY)>1e-4&&rig.phase==='atlas'){panX+=vPanX;panY+=vPanY;vPanX*=1-kd;vPanY*=1-kd;}
   zoom=zoomT.active?zoomT.update(now):zoom+(zoomT.target-zoom)*damp(8,dt);
   rig.yaw=yaw;rig.pitch=pitch;rig.zoom=zoom;
   world.rotation.set(pitch,yaw,0,'XYZ');
   const vh=viewHeight(ctx.width,ctx.areaHeight),aspect=ctx.width/Math.max(1,ctx.height);
   // The globe fills 94% of the shorter field on wide viewports (the overlays sit beside it) and 80% on tall ones.
   const fovMin=Math.min(GLOBE_FOV,2*Math.atan(Math.tan(GLOBE_FOV*DEG/2)*aspect)/DEG),fill=aspect>=1.2?.94:.8;
   // Atlas distance makes the map area (not the whole canvas) span the design height; the frame centre is shifted to the area's centre.
   const dGlobe=R/Math.sin(fill*fovMin*DEG/2),dAtlas=(vh*ctx.height/ctx.areaHeight/2)/Math.tan(ATLAS_FOV*DEG/2);
   const D=(dGlobe+(dAtlas-dGlobe)*ds)/zoom;
   const shiftY=ctx.areaShift*vh/ctx.areaHeight;
   const tx=panX*m,ty=(panY+shiftY)*m,tz=R*m;
   cam.fov=fv;cam.position.set(tx,ty+D*Math.sin(e*DEG),tz+D*Math.cos(e*DEG));cam.lookAt(tx,ty,tz);cam.updateProjectionMatrix();
   rig.body=1-clamp01((m-.15)/.4);rig.atmo=1-clamp01((m-.1)/.5);
   if(rig.phase==='toGlobe'){rig.body=clamp01((1-m-.45)/.45);rig.atmo=clamp01((1-m-.4)/.5);}
   const morphing=morph.active;let justFinished=false;
   if(!morphing&&(rig.phase==='toAtlas'||rig.phase==='toGlobe')){rig.phase=m>.5?'atlas':'globe';justFinished=finishedAt!==now;finishedAt=now;}
   lastPhase=rig.phase;
   return {morphing,justFinished};
  },
  moving(){return morph.active||elev.active||fov.active||dist.active||yawT.active||pitchT.active||zoomT.active||Math.abs(zoomT.target-zoom)>1e-4||Math.abs(vYaw)+Math.abs(vPitch)>1e-6||Math.abs(vPanX)+Math.abs(vPanY)>1e-4;},
  interactive(){return rig.phase==='globe'||rig.phase==='atlas';}
 };
 void lastPhase;
 return rig;
}
