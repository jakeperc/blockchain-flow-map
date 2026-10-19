/**
 * Globe renderer maths and policy: the pure modules the map renderer is built on. Run by scripts/verify-all.mjs
 * against the compiled scratch directory (see verify-live.cjs for the compile step).
 */
const assert=require('node:assert/strict');
const root=process.argv[2]||'/tmp/ledger-atlas-check';
const g=require(root+'/geo3d.js');
const q=require(root+'/quality-policy.js');
const tw=require(root+'/tween.js');
const close=(a,b,eps=1e-6,msg)=>assert.ok(Math.abs(a-b)<eps,msg??`${a} != ${b} (±${eps})`);
const R=265;

// toSphere / toLonLat round trip and frame orientation.
for(let lon=-170;lon<=170;lon+=10)for(let lat=-80;lat<=80;lat+=10){const [lo,la]=g.toLonLat(g.toSphere(lon,lat,R));close(lo,lon,1e-9);close(la,lat,1e-9);}
{const p=g.toSphere(0,0,R);close(p[0],0);close(p[1],0);close(p[2],R,1e-9,'lon 0 / lat 0 faces the viewer (+z)');}
{const p=g.toSphere(90,0,R);close(p[0],R,1e-9,'east is +x');const n=g.toSphere(0,90,R);close(n[1],R,1e-9,'north is +y');}

// Fibonacci sphere: unit vectors, and any prefix is near-uniform (so a draw range thins evenly).
{const pts=g.fibonacciSphere(1000);
 for(let i=0;i<1000;i++)close(Math.hypot(pts[i*3],pts[i*3+1],pts[i*3+2]),1,1e-6);
 const maxGap=k=>{let worst=0;for(let i=0;i<k;i++){let best=Infinity;for(let j=0;j<k;j++){if(i===j)continue;const d=Math.hypot(pts[i*3]-pts[j*3],pts[i*3+1]-pts[j*3+1],pts[i*3+2]-pts[j*3+2]);if(d<best)best=d;}if(best>worst)worst=best;}return worst;};
 for(const k of [100,1000])assert.ok(maxGap(k)<6/Math.sqrt(k),`prefix ${k} is not near-uniform`);}

// slerp and great circles.
{const a=g.normalize([1,0,0]),b=g.normalize([0,0,1]);
 const s0=g.slerp(a,b,0),s1=g.slerp(a,b,1),m=g.slerp(a,b,.5);
 close(s0[0],1);close(s1[2],1);close(g.angle(m,a),g.angle(m,b),1e-9,'midpoint is equidistant');
 close(g.arcHeight(0),.04);close(g.arcHeight(Math.PI),.32);
 const arc=g.greatCircle(a,b,49,R,40);
 close(arc[0],R,1e-4);close(arc[1],0,1e-4);close(arc[2],0,1e-4);close(arc[48*3+2],R,1e-4,'last point is the lifted-free endpoint');
 close(Math.hypot(arc[24*3],arc[24*3+1],arc[24*3+2]),R+40,1e-4,'apex at t=.5 is R + lift');
 const back=g.greatCircle(b,a,49,R,40);
 for(let i=0;i<49;i++)for(let k=0;k<3;k++)close(arc[i*3+k],back[(48-i)*3+k],1e-4,'reversal symmetry');}

// Antimeridian splitting.
{const pieces=g.splitAntimeridian([[170,60],[-170,60],[-170,50],[170,50]]);
 assert.equal(pieces.length,3,'a polyline crossing twice yields three pieces');
 assert.deepEqual(pieces[0][pieces[0].length-1],[180,60]);assert.deepEqual(pieces[1][0],[-180,60]);
 assert.deepEqual(pieces[1][pieces[1].length-1],[-180,50]);assert.deepEqual(pieces[2][0],[180,50]);
 assert.equal(g.splitAntimeridian([[10,10],[20,20],[30,10]]).length,1);
 assert.deepEqual(g.splitAntimeridian([[170,0],[180,0],[170,10]]),[[[170,0],[180,0],[170,10]]],'a vertex exactly at 180 is not a crossing');
 const seam=g.splitAntimeridian([[-180,10],[180,20]]);
 assert.equal(seam.length,2);for(const piece of seam)for(const [lo,la] of piece)assert.ok(Number.isFinite(lo)&&Number.isFinite(la),'a −180→180 step must not produce NaN');}

// Sub-solar point: equinox noon near lon 0 / lat 0, June solstice at the Tropic of Cancer.
{const [lo,la]=g.toLonLat(g.sunDirection(new Date('2026-03-20T12:00:00Z')));assert.ok(Math.abs(la)<1.5,`equinox declination ${la}`);assert.ok(Math.abs(lo)<5,`equinox noon longitude ${lo}`);
 const [,la2]=g.toLonLat(g.sunDirection(new Date('2026-06-21T12:00:00Z')));close(la2,23.44,.3,'solstice declination');
 const [lo3]=g.toLonLat(g.sunDirection(new Date('2026-03-20T18:00:00Z')));close(lo3,-90,5,'18:00 UTC puts the sun over 90° W');}

// Bézier, ray/sphere, visibility, anchor distance.
{const m=g.cubicBezier2D([0,0],[10,40],[90,40],[100,0],.5);close(m[0],50);close(m[1],30,1e-9,'(p0+3c1+3c2+p1)/8');
 close(g.raySphere([0,0,1000],[0,0,-1],R),735);assert.equal(g.raySphere([1000,0,1000],[0,0,-1],R),null);close(g.raySphere([0,0,0],[0,0,1],R),R,1e-9,'from inside, the exit is the hit');
 const cam=[0,0,1000];
 assert.equal(g.sphereVis([0,0,R],cam,R),1,'front surface point');assert.equal(g.sphereVis([0,0,-R],cam,R),0,'back surface point');
 assert.ok(g.sphereVis([300,0,0],cam,R)>.5,'a lifted apex over the limb stays visible');
 close(g.nearestAnchorDistance([0,1,0],[[1,0,0],[0,1,0]]),0);close(g.nearestAnchorDistance([0,0,1],[[1,0,0],[0,1,0]]),Math.PI/2);}

// Quality profile selection: device hints only, never the user agent.
assert.equal(q.selectProfile({coarse:true,cores:8,dpr:3,width:390,height:844}).tier,'Balanced');
assert.equal(q.selectProfile({coarse:false,cores:8,dpr:2,width:1440,height:900}).tier,'High');
assert.equal(q.selectProfile({coarse:false,cores:4,dpr:2,width:1440,height:900}).tier,'Balanced');
assert.equal(q.selectProfile({coarse:false,cores:8,dpr:2,width:1440,height:900,memoryGb:2}).tier,'Balanced');

// Governor: steps down after a sustained second, locks, steps to the floor, demotes at the floor, recovers, never flip-flops.
{const dt=.025,slow=25,fast=10;let s=q.initialGovernor(q.HIGH);
 const run=(n,ms)=>{for(let i=0;i<n;i++)s=q.stepGovernor(s,ms,dt,q.HIGH);};
 run(39,slow);assert.equal(s.dpr,2,'no step before a full second of slow frames');
 run(1,slow);assert.equal(s.dpr,1.75,'first step after 1 s');assert.ok(s.lock>0,'locked after a change');
 run(80,slow);assert.equal(s.dpr,1.75,'no second step inside the 2 s lock');
 run(41,slow);assert.equal(s.dpr,1.5,'second step one second after the lock ends');
 run(400,slow);assert.equal(s.dpr,1.5,'never below the floor');assert.equal(s.demoted,true,'demoted after 3 s at the floor');
 const before=s.dpr;run(40,fast);assert.equal(s.dpr,before,'recovery needs 3 s of fast frames');
 run(200,fast);assert.equal(s.dpr,1.75,'first recovery step');run(200,fast);assert.equal(s.dpr,2,'back to the profile ceiling');run(200,fast);assert.equal(s.dpr,2,'never above the ceiling');
 assert.equal(s.demoted,true,'demotion is not reversed automatically');
 let t=q.initialGovernor(q.HIGH);for(let i=0;i<20;i++)t=q.stepGovernor(t,17.6,dt,q.HIGH);assert.equal(t.slowFor,0);assert.equal(t.fastFor,0);assert.equal(t.dpr,2,'in-band frames accumulate nothing');}

// Governor at display rates: vsync-aligned 60 Hz frames (16.7 ms) count as on time, so a device that holds 60 fps
// recovers resolution; a probe that is undone within the probe window doubles the next wait, up to the cap.
{const step=(s,n,ms,dt)=>{for(let i=0;i<n;i++)s=q.stepGovernor(s,ms,dt,q.HIGH);return s;};
 let s={...q.initialGovernor(q.HIGH),dpr:1.5};
 s=step(s,170,1000/60,1/60);assert.equal(s.dpr,1.5,'not before 3 s');
 s=step(s,12,1000/60,1/60);assert.equal(s.dpr,1.75,'60 Hz on-time frames recover after 3 s');
 s=step(s,130,1000/60,1/60);s=step(s,200,1000/60,1/60);assert.equal(s.dpr,2,'and reach the ceiling');
 let b={...q.initialGovernor(q.HIGH),dpr:1.75};
 b=step(b,181,1000/60,1/60);assert.equal(b.dpr,2,'probe up');
 b=step(b,121,1000/60,1/60);b=step(b,61,33.3,1/30);assert.equal(b.dpr,1.75,'the probe is undone by slow frames');assert.equal(b.wait,6,'a failed probe doubles the wait');
 b=step(b,121,1000/60,1/60);b=step(b,190,1000/60,1/60);assert.equal(b.dpr,1.75,'no probe before the doubled wait');
 b=step(b,200,1000/60,1/60);assert.equal(b.dpr,2,'probe again after the doubled wait');
 let c={...q.initialGovernor(q.HIGH),wait:40,sincePromote:0,dpr:2};c=step(c,61,33.3,1/30);assert.equal(c.wait,q.MAX_WAIT_S,'the wait is capped');
 let d={...q.initialGovernor(q.HIGH),dpr:2};d=step(d,61,33.3,1/30);assert.equal(d.wait,q.RECOVER_AFTER_S,'a step down that follows no probe does not back off');
 assert.equal(q.HIGH.antialias,false,'no MSAA: supersampling through DPR is cheaper and smoother');assert.equal(q.BALANCED.antialias,false);}

// Tweens: eases hit their ends and are monotonic; a retarget mid-flight is continuous.
for(const ease of [tw.easeInOutCubic,tw.easeOutCubic,tw.easeInOutSine]){close(ease(0),0);close(ease(1),1);let prev=-1;for(let t=0;t<=1.0001;t+=.01){const v=ease(t);assert.ok(v>=prev-1e-12,'ease must be monotonic');prev=v;}}
close(tw.damp(3,0),0);assert.ok(tw.damp(3,1)>.9);close(tw.damp(3,.5)+(1-tw.damp(3,.5))*tw.damp(3,.5),tw.damp(3,1),1e-9,'two half steps equal one full step');
{const t=new tw.Tween(0);t.retarget(100,1,0);close(t.update(.5),50,1e-9,'easeInOutCubic(.5)=.5');
 t.retarget(0,1,.5);close(t.update(.5),50,1e-9,'retargeting does not jump');assert.ok(t.update(.75)<50);close(t.update(1.5),0);assert.equal(t.active,false);
 t.retarget(10,0,2);assert.equal(t.value,10,'zero duration is instant');}

// Gestures (lib/atlas/gesture.ts). The regression first: the fling that lost the flat map on phones (2026-10-19).
{const ge=require(root+'/gesture.js');
 const g=ge.newGesture();
 ge.pointerDown(g,1,{x:100,y:300},0);ge.pointerDown(g,2,{x:300,y:300},10);
 let a=ge.pointerMove(g,1,{x:90,y:300},20);assert.equal(a.kind,'zoom','two pointers zoom');close(a.factor,210/200,1e-9);close(a.x,195,1e-9,'about the current midpoint');
 a=ge.pointerMove(g,2,{x:310,y:300},30);assert.equal(a.kind,'zoom');close(a.factor,220/210,1e-9);
 assert.equal(ge.pointerUp(g,2,{x:310,y:300},40),null,'one finger lifting mid-pinch ends nothing yet');
 a=ge.pointerMove(g,1,{x:92,y:300},50);
 assert.equal(a.kind,'pan');close(a.dx,2,1e-9,'the remaining finger pans from ITS OWN last position, not the lifted finger (old code: -218)');close(a.dy,0,1e-9);
 a=ge.pointerUp(g,1,{x:92,y:300},55);assert.deepEqual(a,{kind:'release',inertia:false},'a gesture that pinched never flings');}
{const ge=require(root+'/gesture.js'),g=ge.newGesture();
 ge.pointerDown(g,7,{x:0,y:0},0);
 assert.equal(ge.pointerMove(g,7,{x:3,y:0},5),null,'inside the slop nothing moves');
 const a=ge.pointerMove(g,7,{x:12,y:4},10);assert.equal(a.kind,'pan');close(a.dx,9,1e-9);close(a.dy,4,1e-9);
 assert.deepEqual(ge.pointerUp(g,7,{x:12,y:4},40),{kind:'release',inertia:true},'a drag still moving when it lifts keeps its inertia');
 ge.pointerDown(g,8,{x:0,y:0},100);ge.pointerMove(g,8,{x:40,y:0},110);
 assert.deepEqual(ge.pointerUp(g,8,{x:40,y:0},110+ge.INERTIA_IDLE_MS+1),{kind:'release',inertia:false},'a drag that paused before lifting stops');
 ge.pointerDown(g,9,{x:5,y:5},300);ge.pointerMove(g,9,{x:7,y:6},305);
 assert.deepEqual(ge.pointerUp(g,9,{x:7,y:6},310),{kind:'click',x:7,y:6},'a press that never left the slop is a click');
 ge.pointerDown(g,10,{x:0,y:0},400);ge.pointerMove(g,10,{x:50,y:0},405);
 assert.deepEqual(ge.pointerCancel(g,10),{kind:'release',inertia:false},'a cancelled pointer ends the gesture without inertia');
 assert.equal(ge.pointerMove(g,99,{x:1,y:1},500),null,'a hovering pointer is not a gesture');
 assert.equal(ge.pointerUp(g,99,{x:1,y:1},500),null,'lifting an unknown pointer does nothing');}

// The flat map's framing (lib/atlas/atlas-view.ts), against an independent Equal Earth (Savric, Patterson and Jenny's
// published formula), whose extent at scale 190 must match the d3 projection the renderer draws with.
{const av=require(root+'/atlas-view.js');
 const A1=1.340264,A2=-0.081106,A3=0.000893,A4=0.003796,M=Math.sqrt(3)/2,S=190;
 const ee=(lon,lat)=>{const l=lon*Math.PI/180,t=Math.asin(M*Math.sin(lat*Math.PI/180)),t2=t*t,t6=t2*t2*t2;
  return [S*2*Math.sqrt(3)*l*Math.cos(t)/(3*(9*A4*t6*t2+7*A3*t6+3*A2*t2+A1)),-S*t*(A4*t6*t2+A3*t6+A2*t2+A1)];};
 const ext=av.extentFromProjection(ee);
 close(ext.halfW,514.26,.01,'half-width matches d3 geoEqualEarth().scale(190) at (180, 0)');close(ext.halfH,250.30,.01,'half-height matches it at the pole');
 close(av.edgeAt(ext,0),ext.halfW,1e-9);close(av.edgeAt(ext,ext.halfH),Math.abs(ee(180,90)[0]),1e-9,'the pole line is the narrowest edge');
 assert.ok(av.edgeAt(ext,100)<av.edgeAt(ext,50)&&av.edgeAt(ext,-100)===av.edgeAt(ext,100),'the outline narrows toward each pole, symmetrically');
 // Home zoom: the whole map plus the margin fits the map area, and the atlas never opens closer than the design fit.
 const fits=(w,ah,vh)=>{const z=av.atlasHomeZoom(w,ah,vh,ext),u=vh/ah/z,k=1+2*av.ATLAS_MARGIN;
  assert.ok(z<=1,'never above the design fit');assert.ok(2*ext.halfW*k/u<=w+1e-6&&2*ext.halfH*k/u<=ah+1e-6,`whole map fits ${w}x${ah}`);return z;};
 const desk=fits(1400,533,Math.max(530,1100*533/1400));assert.ok(desk>.85&&desk<.95,`desktop opens a little wider than before (${desk})`);
 const phone=fits(375,564,530);assert.ok(phone>.25&&phone<.35,`a portrait phone opens on the whole map (${phone})`);
 fits(812,240,530);fits(2560,1100,Math.max(530,1100*1100/2560));
 // Pan clamp: the view centre stays inside the outline, so some map is always on screen.
 let c=av.clampToMap(5000,-3000,ext);assert.ok(c.hitX&&c.hitY);close(c.y,-ext.halfH,1e-9);close(c.x,av.edgeAt(ext,ext.halfH),1e-9,'a far corner clamps to the pole line, not the bounding box');
 c=av.clampToMap(100,-40,ext);assert.deepEqual(c,{x:100,y:-40,hitX:false,hitY:false},'a centre inside the map is left alone');
 c=av.clampToMap(-600,0,ext);close(c.x,-ext.halfW,1e-9);assert.ok(c.hitX&&!c.hitY);}

console.log('PASS: sphere maths, Fibonacci prefixes, great circles, antimeridian splitting, sun position, visibility, quality selection, governor hysteresis, recovery probes, tweens, gestures (the pinch-release fling) and the atlas framing');
