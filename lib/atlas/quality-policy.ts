/**
 * Rendering quality as data, not scattered ifs. A profile is chosen once from device hints (never the user agent);
 * a governor then steps the canvas resolution on smoothed frame time with hysteresis and a lock after every change,
 * so it never flip-flops. Tier changes are designed to be invisible: the dot set thins uniformly, particles per
 * route drop, beams switch off. Anti-aliasing is supersampling (render at DPR 2 and let the compositor filter down)
 * plus soft-edged shaders, never MSAA: measured on 2026-09-26 on an Intel UHD 770 (ANGLE/D3D11), 4× MSAA at DPR 2
 * cost 5.5 ms of GPU per frame against 0.6 ms without it, and cost more at DPR 1 (1.9 ms) than supersampling at 2.
 * Pure, tested by scripts/verify-map.cjs.
 */
export type Tier='High'|'Balanced'|'Compatibility';
export interface QualityProfile{tier:Tier;dpr:number;dprFloor:number;dots:number;arcSamples:number;particlesPerRoute:number;halo:boolean;terminator:boolean;antialias:boolean;beams:boolean}
export const HIGH:QualityProfile={tier:'High',dpr:2,dprFloor:1.5,dots:24000,arcSamples:48,particlesPerRoute:7,halo:true,terminator:true,antialias:false,beams:true};
export const BALANCED:QualityProfile={tier:'Balanced',dpr:2,dprFloor:1.5,dots:14000,arcSamples:48,particlesPerRoute:4,halo:true,terminator:true,antialias:false,beams:false};
export interface DeviceHints{coarse:boolean;cores:number;dpr:number;width:number;height:number;memoryGb?:number}
export function selectProfile(h:DeviceHints):QualityProfile{
 return h.coarse||h.cores<6||(h.memoryGb!==undefined&&h.memoryGb<4)?BALANCED:HIGH;
}

/**
 * Frame times are in milliseconds of a 60 Hz budget: the renderer reports max(CPU time, interval between rendered
 * frames) and targets 60 fps even on faster displays. A frame is "on time" below ON_TIME_MS (a vsync-aligned 60 Hz
 * interval is 16.7) and slow above SLOW_MS. GPU headroom cannot be observed, so recovery is a probe: after
 * `wait` seconds on time the resolution steps up; if that step is undone within PROBE_WINDOW_S the probe failed
 * and the next wait doubles, up to MAX_WAIT_S.
 */
export const SLOW_MS=18,ON_TIME_MS=17.2,STEP=.25,STEP_AFTER_S=1,DEMOTE_AFTER_S=3,RECOVER_AFTER_S=3,LOCK_S=2,PROBE_WINDOW_S=6,MAX_WAIT_S=48;
export interface GovernorState{ema:number;slowFor:number;fastFor:number;lock:number;dpr:number;demoted:boolean;wait:number;sincePromote:number}
export const initialGovernor=(p:QualityProfile):GovernorState=>({ema:0,slowFor:0,fastFor:0,lock:0,dpr:p.dpr,demoted:false,wait:RECOVER_AFTER_S,sincePromote:Infinity});
/** One frame of governor logic. `frameMs` is this frame's duration, `dt` the same in seconds. Returns a new state. */
export function stepGovernor(s:GovernorState,frameMs:number,dt:number,p:QualityProfile):GovernorState{
 const ema=s.ema?s.ema*.9+frameMs*.1:frameMs,sincePromote=s.sincePromote+dt;
 if(s.lock>0)return {...s,ema,sincePromote,lock:Math.max(0,s.lock-dt)};
 let slowFor=0,fastFor=0;
 if(ema>SLOW_MS)slowFor=s.slowFor+dt;else if(ema<ON_TIME_MS)fastFor=s.fastFor+dt;
 let {dpr,demoted,wait}=s,lock=0,promoted=sincePromote;
 if(slowFor>=STEP_AFTER_S&&dpr>p.dprFloor){
  dpr=Math.max(p.dprFloor,+(dpr-STEP).toFixed(2));lock=LOCK_S;slowFor=0;
  if(sincePromote<PROBE_WINDOW_S)wait=Math.min(MAX_WAIT_S,wait*2);
 }
 else if(slowFor>=DEMOTE_AFTER_S&&!demoted){demoted=true;lock=LOCK_S;slowFor=0;}
 else if(fastFor>=wait&&dpr<p.dpr){dpr=Math.min(p.dpr,+(dpr+STEP).toFixed(2));lock=LOCK_S;fastFor=0;promoted=0;}
 return {ema,slowFor,fastFor,lock,dpr,demoted,wait,sincePromote:promoted};
}
