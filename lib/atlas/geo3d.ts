/**
 * Sphere geometry for the globe renderer. Pure (no three, no DOM, no d3) so scripts/verify-map.cjs can test it.
 * Frame: y up, z toward the viewer at the home rotation, x east. lon 0 / lat 0 is (0,0,R), the point where the
 * flat Equal Earth map is tangent to the globe, which is what lets the two blend.
 */
export type Vec3=[number,number,number];
export const DEG=Math.PI/180;

export function toSphere(lon:number,lat:number,R:number):Vec3{
 const c=Math.cos(lat*DEG);
 return [R*c*Math.sin(lon*DEG),R*Math.sin(lat*DEG),R*c*Math.cos(lon*DEG)];
}
export function toLonLat(p:Vec3):[number,number]{
 const r=Math.hypot(p[0],p[1],p[2])||1;
 return [Math.atan2(p[0],p[2])/DEG,Math.asin(Math.max(-1,Math.min(1,p[1]/r)))/DEG];
}
export const normalize=(p:Vec3):Vec3=>{const r=Math.hypot(p[0],p[1],p[2])||1;return [p[0]/r,p[1]/r,p[2]/r];};
export const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const angle=(a:Vec3,b:Vec3)=>Math.acos(Math.max(-1,Math.min(1,dot(normalize(a),normalize(b)))));
/** Spherical interpolation between two unit vectors. */
export function slerp(a:Vec3,b:Vec3,t:number):Vec3{
 const th=angle(a,b);
 if(th<1e-6)return [a[0],a[1],a[2]];
 const s=Math.sin(th),wa=Math.sin((1-t)*th)/s,wb=Math.sin(t*th)/s;
 return [a[0]*wa+b[0]*wb,a[1]*wa+b[1]*wb,a[2]*wa+b[2]*wb];
}
/** How far a route lifts off the sphere at its apex, as a fraction of R: visual separation only, never a metric. */
export const arcHeight=(theta:number)=>Math.min(.32,.04+.28*theta/Math.PI);
/** `n` points along the great circle from unit vector `a` to `b`, lifted by `lift·sin(πt)` above radius R. */
export function greatCircle(a:Vec3,b:Vec3,n:number,R:number,lift:number):Float32Array{
 const out=new Float32Array(n*3),ua=normalize(a),ub=normalize(b);
 for(let i=0;i<n;i++){const t=n>1?i/(n-1):0,p=slerp(ua,ub,t),r=R+lift*Math.sin(Math.PI*t);out[i*3]=p[0]*r;out[i*3+1]=p[1]*r;out[i*3+2]=p[2]*r;}
 return out;
}
/** `n` near-uniform unit vectors. Any prefix of the sequence is itself near-uniform, so a draw range can thin the set evenly. */
export function fibonacciSphere(n:number):Float32Array{
 const out=new Float32Array(n*3),golden=Math.PI*(3-Math.sqrt(5));
 for(let i=0;i<n;i++){const y=1-2*(i+.5)/n,r=Math.sqrt(Math.max(0,1-y*y)),phi=i*golden;out[i*3]=r*Math.cos(phi);out[i*3+1]=y;out[i*3+2]=r*Math.sin(phi);}
 return out;
}
/** Cut a lon/lat polyline wherever it jumps across the antimeridian, so nothing streaks across the flat map. */
export function splitAntimeridian(points:[number,number][]):[number,number][][]{
 const pieces:[number,number][][]=[];let cur:[number,number][]=[];
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(i>0){
   const q=points[i-1],d=p[0]-q[0];
   if(Math.abs(d)>180){
    // A step straight from −180 to +180 is the same meridian: cut at the first point's latitude rather than divide by zero.
    const edge=q[0]>0?180:-180,denom=d-(d>0?360:-360),f=denom===0?0:(edge-q[0])/denom,lat=q[1]+(p[1]-q[1])*f;
    cur.push([edge,lat]);pieces.push(cur);cur=[[-edge,lat]];
   }
  }
  cur.push(p);
 }
 if(cur.length)pieces.push(cur);
 return pieces;
}
export function cubicBezier2D(p0:[number,number],c1:[number,number],c2:[number,number],p1:[number,number],t:number):[number,number]{
 const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
 return [a*p0[0]+b*c1[0]+c*c2[0]+d*p1[0],a*p0[1]+b*c1[1]+c*c2[1]+d*p1[1]];
}
/** Distance along a ray (origin, unit direction) to the nearest point on a sphere of radius R at the origin, or null. */
export function raySphere(o:Vec3,d:Vec3,R:number):number|null{
 const b=dot(o,d),c=dot(o,o)-R*R,disc=b*b-c;
 if(disc<0)return null;
 const s=Math.sqrt(disc),t0=-b-s,t1=-b+s;
 return t0>=0?t0:t1>=0?t1:null;
}
/** 1 when the sphere does not block the view of point `p` from `cam`, 0 when it does, soft at the limb. Works for lifted points. */
export function sphereVis(p:Vec3,cam:Vec3,R:number):number{
 const dx=p[0]-cam[0],dy=p[1]-cam[1],dz=p[2]-cam[2],len=Math.hypot(dx,dy,dz)||1;
 const d:Vec3=[dx/len,dy/len,dz/len],tc=-dot(cam,d);
 if(tc<=0||tc>=len)return 1;
 const h=Math.hypot(cam[0]+d[0]*tc,cam[1]+d[1]*tc,cam[2]+d[2]*tc);
 const t=(h-R*.97)/(R*.06);
 return t<=0?0:t>=1?1:t*t*(3-2*t);
}
/** Unit vector toward the sub-solar point at `date` (declination and hour angle; ±2° without the equation of time). Astronomy, not data. */
export function sunDirection(date:Date):Vec3{
 const start=Date.UTC(date.getUTCFullYear(),0,0),day=(date.getTime()-start)/86400000;
 const decl=-23.44*Math.cos(2*Math.PI*(day+10)/365);
 const hours=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600;
 const lon=180-hours*15;
 return toSphere(((lon+540)%360)-180,decl,1);
}
/** Angular distance in radians from a unit vector to the nearest of the given unit vectors. */
export function nearestAnchorDistance(p:Vec3,anchors:Vec3[]):number{
 let best=Math.PI;
 for(const a of anchors){const th=angle(p,a);if(th<best)best=th;}
 return best;
}
