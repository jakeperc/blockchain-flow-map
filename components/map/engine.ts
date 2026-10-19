/**
 * The renderer: composes the layers, owns the frame loop and turns props into targets. Draw order is opaque first
 * (body), then blended, then additive (halo, particles, glow, rim) — the order tile-based mobile GPUs want.
 */
import * as THREE from 'three';
import {COUNTRIES,type ColorMode} from '@/lib/atlas/geography';
import {rankRoutes,routeCap} from '@/lib/atlas/encoding';
import {sunDirection,toSphere,type Vec3} from '@/lib/atlas/geo3d';
import type {Corridor,CountrySummary,Transfer} from '@/lib/atlas/model';
import {makeShared,R,type Ctx} from './frame';
import {buildAtmosphere} from './atmosphere';
import {buildAnchors} from './anchors';
import {buildArcs,corridorMidpoint} from './arcs';
import {buildLand,type Land} from './land';
import {buildLabels} from './labels';
import {buildRig,type MapMode} from './camera';
import {buildInteraction,type Hover} from './interaction';
import {buildQuality,pickProfile} from './quality';

export type {MapMode};
export interface MapProps{
 corridors:Corridor[];countries?:CountrySummary[];country:string|null;selected:string|null;colorMode:ColorMode;
 rawEvent?:{corridor:string;transaction:Transfer;started:number}|null;paused:boolean;mode:MapMode;
 onCountry:(code:string,name?:string)=>void;onCorridor:(id:string)=>void;onQuality:(q:string)=>void;onReady?:()=>void;
}
export interface Engine{update():void;setMode(mode:MapMode):void;zoom(f:number):void;reset():void;dispose():void}
export interface EngineHost{props:()=>MapProps;setHover:(h:Hover|null)=>void;setError:(e:string)=>void;tooltip:()=>HTMLElement|null}

const debugFlag=()=>typeof location!=='undefined'&&new URLSearchParams(location.search).get('debug')==='map';

export function createEngine(host:HTMLElement,io:EngineHost):Engine{
 const profile=pickProfile(host);
 const renderer=new THREE.WebGLRenderer({antialias:profile.antialias,alpha:false,stencil:false,powerPreference:'high-performance'});
 const gl=renderer.getContext();
 if((gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) as number)<2)throw Error('vertex textures unavailable');
 renderer.setClearColor('#111a1e',1);
 host.appendChild(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Interactive globe and Equal Earth map of attributed stablecoin corridors');
 const quality=buildQuality(renderer,profile,r=>{ctx.reduced=r;if(r){shared.uReveal.value=1.2;}invalid=true;});
 quality.applyDpr();
 const scene=new THREE.Scene(),world=new THREE.Group(),camera=new THREE.PerspectiveCamera(38,1,1,12000);
 scene.add(world);
 const shared=makeShared();
 const ctx:Ctx={renderer,scene,world,camera,host,shared,profile,reduced:quality.reduced,width:1,height:1,areaHeight:1,areaShift:0};
 shared.uPixelRatio.value=renderer.getPixelRatio();
 shared.uMaxPoint.value=(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1]??64;

 const atmosphere=buildAtmosphere(ctx),anchors=buildAnchors(ctx),arcs=buildArcs(ctx),labels=buildLabels(ctx),rig=buildRig(ctx);
 world.add(atmosphere.body,anchors.ring,arcs.core,arcs.halo,arcs.particles,anchors.halo,anchors.beam,atmosphere.rim);
 let land:Land|null=null,ready=false,disposed=false,raf=0,last=0,time=0,chosen:Corridor[]=[],revealStart=-1;
 // Frame pacing state: `invalid` forces the next frame to draw; `rendered` says the previous tick drew.
 let invalid=true,rendered=false,capIdle=false,lastVignette='',sunAt=-1e9;
 const anchorVecs:Vec3[]=Object.values(COUNTRIES).map(c=>toSphere(c.anchor[0],c.anchor[1],1));

 const interaction=buildInteraction(ctx,{
  rig,land:()=>land,arcs,anchors:labels.anchors,
  onCountry:(c,n)=>io.props().onCountry(c,n),onCorridor:id=>io.props().onCorridor(id),
  setHover:io.setHover,tooltip:io.tooltip,
  zoom:f=>engine.zoom(f),reset:()=>engine.reset(),
  flyTo:(lon,lat)=>rig.flyTo(lon,lat,performance.now()/1000,ctx.reduced),
  flyToCorridor:r=>{const [lon,lat]=corridorMidpoint(r.data);rig.flyTo(lon,lat,performance.now()/1000,ctx.reduced);}
 });

 /**
  * Assigning a canvas's width or height empties its drawing buffer, and the empty buffer is what the compositor
  * paints if the next frame is still to come: one black frame. So an unchanged size is not re-applied (a
  * ResizeObserver can fire for layout changes that leave the map's own box alone), and a real change is drawn
  * again in the same callback, before the browser gets to paint.
  */
 let sizedW=0,sizedH=0,sizedPr=0,drawn=false;
 const redraw=()=>{if(drawn)renderer.render(scene,camera);};
 function resize(){
  const w=host.clientWidth||1,h=host.clientHeight||1,pr=renderer.getPixelRatio(),same=w===sizedW&&h===sizedH&&pr===sizedPr;
  ctx.width=w;ctx.height=h;
  const cs=getComputedStyle(host),extraTop=Math.max(0,-(parseFloat(cs.top)||0)),extraBottom=Math.max(0,-(parseFloat(cs.bottom)||0));
  ctx.areaHeight=Math.max(1,ctx.height-extraTop-extraBottom);ctx.areaShift=(extraTop-extraBottom)/2;
  if(!same){renderer.setSize(ctx.width,ctx.height);sizedW=w;sizedH=h;sizedPr=pr;}
  camera.aspect=ctx.width/ctx.height;camera.updateProjectionMatrix();
  shared.uResolution.value.set(ctx.width*renderer.getPixelRatio(),ctx.height*renderer.getPixelRatio());
  shared.uPixelRatio.value=renderer.getPixelRatio();
  quality.suspend(2);update();
  if(!same)redraw();
 }
 function update(){
  const p=io.props();
  chosen=rankRoutes(p.corridors,p.country,id=>arcs.routes.has(id),routeCap(ctx.width));
  const now=performance.now();
  arcs.update(chosen,p.selected,p.colorMode,ready&&shared.uReveal.value>.6,ctx.reduced,now/1000);
  // Routes created before the land reveal draw themselves on once it is far enough along.
  anchors.update(p.countries,chosen,p.country);
  invalid=true;
  if(land){
   const state=new Map<string,{lit:boolean;selected:boolean}>();
   for(const f of land.features){const a=anchors.state.get(f.code);const onSelected=!!p.selected&&chosen.some(c=>c.id===p.selected&&(c.origin===f.code||c.destination===f.code));state.set(f.code,{lit:!!a?.active,selected:f.code===p.country||onSelected});}
   land.setState(state);
  }
 }
 const engine:Engine={
  update,
  setMode(mode){rig.setMode(mode,performance.now()/1000,ctx.reduced);quality.suspend(2.5);},
  zoom(f){if(rig.interactive())rig.zoomBy(f);},
  reset(){rig.reset(performance.now()/1000,ctx.reduced);},
  dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);interaction.dispose();labels.dispose();arcs.dispose();anchors.dispose();atmosphere.dispose();land?.dispose();quality.dispose();renderer.dispose();renderer.domElement.remove();debugEl?.remove();}
 };
 const observer=new ResizeObserver(resize);observer.observe(host);resize();

 const landStart=performance.now();let landMs=0;
 buildLand(ctx,anchorVecs).then(l=>{
  if(disposed){l.dispose();return;}
  landMs=performance.now()-landStart;
  // Compile the land programs before they join the scene, so the reveal's first frame does not stall on shaders.
  const staging=new THREE.Group();staging.add(l.dots,l.lines,l.graticule);
  return renderer.compileAsync(staging,camera,scene).catch(()=>{}).then(()=>l);
 }).then(l=>{
  if(!l||disposed){l?.dispose();return;}
  land=l;world.add(l.dots,l.lines,l.graticule);l.setDotBudget(quality.governor.demoted?14000:profile.dots);
  ready=true;revealStart=performance.now();if(ctx.reduced)shared.uReveal.value=1.2;
  if(performance.now()-interaction.lastInput>1500)rig.intro(performance.now()/1000,ctx.reduced);
  update();io.props().onReady?.();
 }).catch(()=>{if(!disposed){io.setError('World geometry could not load. Refresh to retry.');io.props().onReady?.();}});

 const debug=debugFlag();let debugEl:HTMLDivElement|null=null;
 if(debug){debugEl=document.createElement('div');debugEl.className='map-debug';host.appendChild(debugEl);(window as unknown as {__atlasScene?:THREE.Scene}).__atlasScene=scene;(window as unknown as {__atlasView?:()=>unknown}).__atlasView=()=>({phase:rig.phase,...rig.debugView()});}
 let lastQuality='',cpuEma=0;
 const report=()=>{const l=quality.label();if(l!==lastQuality){lastQuality=l;io.props().onQuality(l);}};
 report();

 /**
  * Frame pacing. Ambient motion (particles, breathing, auto-rotation) is capped near 60 fps on faster displays: a
  * vsync-aligned tick is skipped when less than 10.5 ms has passed since the last one, which keeps 90 Hz at 90 and
  * turns 120 Hz into 60 and 144 Hz into 72. Input, camera flights and the morph run at the display rate. When nothing
  * moves (paused, reduced motion, settled camera) the frame logic still runs but nothing is drawn or restyled.
  */
 function draw(t:number){
  if(disposed)return;raf=requestAnimationFrame(draw);
  if(capIdle&&t-last<10.5)return;
  step(t,false);
 }
 function step(t:number,force:boolean){
  const frameStart=performance.now();
  const dt=last?Math.min(.1,(t-last)/1000):.016;last=t;
  const p=io.props(),now=t/1000;
  const motion=!p.paused&&!ctx.reduced;
  if(motion)time+=dt;
  shared.uTime.value=time%11764.7;
  // The terminator moves a quarter of a degree a minute: refresh the sun every 10 s, not every frame.
  if(Math.abs(now-sunAt)>10){sunAt=now;shared.uSun.value.set(...sunDirection(new Date()));invalid=true;}
  const revealing=ready&&revealStart>=0&&!ctx.reduced&&shared.uReveal.value<1.2;
  if(revealing)shared.uReveal.value=Math.min(1.2,(performance.now()-revealStart)/1000);
  const idle=motion&&!p.selected&&!p.country&&performance.now()-interaction.lastInput>8000;
  rig.idle(dt,idle);
  const {morphing,justFinished}=rig.frame(dt,now);
  // `flying`: a tween, inertia or the morph is moving the camera (full display rate); auto-rotation alone is ambient.
  const flying=rig.moving()||justFinished;
  shared.uMorph.value=rig.morph;shared.uZoom.value=rig.zoom;
  // The atmosphere arrives with the land rather than ahead of it.
  atmosphere.set(rig.body,rig.atmo*(ready?Math.min(1,.25+shared.uReveal.value/.9):.25));
  anchors.beam.visible=profile.beams&&!quality.governor.demoted&&rig.morph<.98;
  const vignette=rig.morph.toFixed(3);
  if(vignette!==lastVignette){lastVignette=vignette;host.style.setProperty('--vignette',vignette);}
  if(justFinished)arcs.relace(now,ctx.reduced);
  const arcsBusy=arcs.frame(dt,now,Date.now(),p.rawEvent,interaction.hovered,morphing,rig.morph,ctx.reduced);
  const anchorsBusy=anchors.frame(dt,Date.now(),p.rawEvent,id=>arcs.routes.get(id)?.data.destination??null,ctx.reduced);
  const render=force||motion||invalid||flying||arcsBusy||anchorsBusy||revealing;
  world.updateMatrixWorld(true);camera.updateMatrixWorld();
  if(render)labels.frame(rig.morph,rig.zoom,p.country,code=>!!anchors.state.get(code)?.active);
  interaction.frame(morphing,render);
  capIdle=motion&&!flying&&!morphing&&!interaction.active()&&performance.now()-interaction.lastInput>1000;
  if(!render){rendered=false;return;}
  invalid=false;
  renderer.render(scene,camera);drawn=true;
  const frameMs=performance.now()-frameStart;
  // Only a frame that follows a rendered frame has a meaningful interval.
  if(rendered&&quality.sample(Math.max(frameMs,dt*1000),dt)){
   // The governor's new pixel ratio resized the canvas, which emptied the frame just drawn: draw it again now.
   sizedPr=renderer.getPixelRatio();
   shared.uPixelRatio.value=renderer.getPixelRatio();shared.uResolution.value.set(ctx.width*renderer.getPixelRatio(),ctx.height*renderer.getPixelRatio());
   if(quality.governor.demoted){land?.setDotBudget(14000);arcs.setParticles(4);anchors.setBeams(false);}
   report();renderer.render(scene,camera);
  }
  rendered=true;
  if(debugEl){cpuEma=cpuEma?cpuEma*.95+frameMs*.05:frameMs;debugEl.textContent=`${renderer.info.render.calls} calls · ${quality.governor.ema.toFixed(1)} ms · cpu ${cpuEma.toFixed(2)} ms · dpr ${renderer.getPixelRatio().toFixed(2)} · ${rig.phase}${capIdle?' · 60 cap':''} · land ${landMs.toFixed(0)} ms`;}
 }
 // `?debug=map` bench: drives the frame function synchronously (works while the tab is hidden) and reports mean CPU
 // per frame plus GPU time from EXT_disjoint_timer_query_webgl2 where the driver offers it.
 if(debug)(window as unknown as {__atlasBench?:unknown}).__atlasBench=async(n=300,opt:{hover?:{x:number;y:number};dpr?:number;force?:boolean}={})=>{
  const canvas=renderer.domElement,r=canvas.getBoundingClientRect(),gl2=gl as WebGL2RenderingContext,ext=gl2.getExtension?.('EXT_disjoint_timer_query_webgl2') as {TIME_ELAPSED_EXT:number}|null;
  if(opt.dpr){renderer.setPixelRatio(opt.dpr);resize();}
  if(opt.hover)canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+opt.hover.x,clientY:r.top+opt.hover.y,pointerId:9,bubbles:true}));
  const base=last||performance.now(),queries:WebGLQuery[]=[],frames0=renderer.info.render.frame;let cpu=0;
  for(let i=1;i<=n;i++){
   const q=ext&&i%4===0?gl2.createQuery():null;if(q&&ext)gl2.beginQuery(ext.TIME_ELAPSED_EXT,q);
   const s=performance.now();step(base+i*1000/60,opt.force??true);cpu+=performance.now()-s;
   if(q&&ext){gl2.endQuery(ext.TIME_ELAPSED_EXT);queries.push(q);}
  }
  gl.finish();await new Promise(res=>setTimeout(res,50));
  let gpu=0,got=0;for(const q of queries){if(gl2.getQueryParameter(q,gl2.QUERY_RESULT_AVAILABLE)){gpu+=gl2.getQueryParameter(q,gl2.QUERY_RESULT)/1e6;got++;}gl2.deleteQuery(q);}
  if(opt.dpr){quality.applyDpr();resize();}
  last=0;rendered=false;invalid=true; // the synthetic clock ran ahead of RAF's
  return {rendered:renderer.info.render.frame-frames0,cpuMs:+(cpu/n).toFixed(3),gpuMs:got?+(gpu/got).toFixed(3):null,calls:renderer.info.render.calls,px:`${canvas.width}x${canvas.height}`};
 };
 const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!raf&&!disposed){last=0;rendered=false;invalid=true;quality.suspend(1);raf=requestAnimationFrame(draw);}};
 document.addEventListener('visibilitychange',onVisibility);
 // Programs compile before the first frame (in parallel where KHR_parallel_shader_compile exists) instead of inside it.
 renderer.compileAsync(scene,camera).catch(()=>{}).then(()=>{if(!disposed&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);});
 return engine;
}
