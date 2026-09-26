/**
 * Device hints → quality profile, the frame-time governor, DPR/size application, visibility and reduced-motion.
 * The policy itself is pure (lib/atlas/quality-policy.ts); this is the DOM side.
 */
import * as THREE from 'three';
import {BALANCED,initialGovernor,selectProfile,stepGovernor,type GovernorState,type QualityProfile} from '@/lib/atlas/quality-policy';

export interface Quality{
 profile:QualityProfile;reduced:boolean;
 governor:GovernorState;
 /** Call once per rendered frame with its duration. Returns true when the applied DPR or tier changed. */
 sample(frameMs:number,dt:number):boolean;
 suspend(seconds:number):void;
 applyDpr():void;
 label():string;
 dispose():void;
}
export function pickProfile(host:HTMLElement):QualityProfile{
 const nav=navigator as Navigator&{deviceMemory?:number};
 return selectProfile({coarse:matchMedia('(pointer: coarse)').matches,cores:navigator.hardwareConcurrency??4,dpr:devicePixelRatio,width:host.clientWidth,height:host.clientHeight,memoryGb:nav.deviceMemory});
}
export function buildQuality(renderer:THREE.WebGLRenderer,profile:QualityProfile,onChange:(reduced:boolean)=>void):Quality{
 const rm=matchMedia('(prefers-reduced-motion: reduce)');
 const supersample=!matchMedia('(pointer: coarse)').matches;
 let suspended=2,lastDpr=0,lastDemoted=false;
 const q:Quality={
  profile,reduced:rm.matches,governor:initialGovernor(profile),
  sample(frameMs,dt){
   if(suspended>0){suspended-=dt;return false;}
   q.governor=stepGovernor(q.governor,frameMs,dt,profile);
   const changed=q.governor.dpr!==lastDpr||q.governor.demoted!==lastDemoted;
   if(changed){lastDpr=q.governor.dpr;lastDemoted=q.governor.demoted;q.applyDpr();}
   return changed;
  },
  suspend(s){suspended=Math.max(suspended,s);},
  // No MSAA anywhere, so on desktops the governor's DPR is the render scale even on a DPR 1 screen: rendering at 2 and
  // letting the compositor filter down is the anti-aliasing. Touch devices never render above their native density.
  applyDpr(){renderer.setPixelRatio(supersample?q.governor.dpr:Math.min(devicePixelRatio,q.governor.dpr));},
  label(){const tier=q.governor.demoted?BALANCED.tier:profile.tier;return q.governor.dpr<profile.dpr?`${tier} · ${q.governor.dpr}×`:tier;},
  dispose(){rm.removeEventListener('change',onRm);}
 };
 const onRm=()=>{q.reduced=rm.matches;onChange(q.reduced);};
 rm.addEventListener('change',onRm);
 lastDpr=q.governor.dpr;
 return q;
}
