/** Easing and frame-rate-independent motion helpers for the renderer. Pure: no DOM, no three. */
export const clamp01=(t:number)=>t<0?0:t>1?1:t;
export const easeInOutCubic=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
export const easeOutCubic=(t:number)=>1-Math.pow(1-t,3);
export const easeInOutSine=(t:number)=>-(Math.cos(Math.PI*t)-1)/2;
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Fraction of the remaining distance to cover after `dt` seconds at rate `k` per second, so smoothing looks the same at 60 Hz and 144 Hz. */
export const damp=(k:number,dt:number)=>1-Math.exp(-k*dt);

/** A scalar tween that can be retargeted mid-flight without a jump: the new segment starts from the current value. */
export class Tween {
 value:number; private from:number; private to:number; private start=0; private duration=0;
 constructor(value:number,private ease:(t:number)=>number=easeInOutCubic){this.value=value;this.from=value;this.to=value;}
 get target(){return this.to;}
 get active(){return this.value!==this.to;}
 retarget(to:number,duration:number,now:number){this.from=this.value;this.to=to;this.start=now;this.duration=duration;if(duration<=0)this.value=to;}
 jump(to:number){this.from=to;this.to=to;this.value=to;this.duration=0;}
 update(now:number):number{
  if(this.value===this.to)return this.value;
  if(this.duration<=0){this.value=this.to;return this.value;}
  const t=clamp01((now-this.start)/this.duration);
  this.value=t>=1?this.to:this.from+(this.to-this.from)*this.ease(t);
  return this.value;
 }
}
