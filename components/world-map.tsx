'use client';
import {MapFallback} from './map-fallback';
import {useEffect,useRef,useState,forwardRef,useImperativeHandle} from 'react';
import * as THREE from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {geoEqualEarth,geoPath,geoGraticule10} from 'd3-geo';
import {feature} from 'topojson-client';
import {COUNTRIES,CHAIN_COLORS,ASSET_COLORS,CONFIDENCE_COLORS,type ColorMode} from '@/lib/atlas/geography';
import {money,type Corridor} from '@/lib/atlas/model';
export type MapHandle={zoom:(factor:number)=>void;reset:()=>void};
type Props={corridors:Corridor[];country:string|null;selected:string|null;colorMode:ColorMode;raw:boolean;rawEvent?:{corridor:string;transaction:import('@/lib/atlas/model').Transfer;started:number}|null;paused:boolean;onCountry:(code:string,name?:string)=>void;onCorridor:(id:string)=>void;onQuality:(q:string)=>void;};
type Route={data:Corridor;curve:THREE.CubicBezierCurve3;line:Line2;mat:LineMaterial;opacity:number;target:number;width:number;targetWidth:number;color:THREE.Color;};
function colorOf(c:Corridor,mode:ColorMode){const obj=mode==='CHAIN'?c.chains:mode==='ASSET'?c.assets:c.confidence;const dominant=Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]?.[0];return (mode==='CHAIN'?CHAIN_COLORS:mode==='ASSET'?ASSET_COLORS:CONFIDENCE_COLORS)[dominant]??'#a9cabc';}
export const WorldMap=forwardRef<MapHandle,Props>(function WorldMap(props,ref){
 const el=useRef<HTMLDivElement>(null),latest=useRef(props),engine=useRef<{zoom:(f:number)=>void;reset:()=>void;update:()=>void}|null>(null),[error,setError]=useState(''),[hover,setHover]=useState<{x:number;y:number;text:string;sub:string}|null>(null);
 latest.current=props;
 useImperativeHandle(ref,()=>({zoom:f=>engine.current?.zoom(f),reset:()=>engine.current?.reset()}),[]);
 useEffect(()=>{engine.current?.update();},[props.corridors,props.country,props.selected,props.colorMode,props.raw]);
 useEffect(()=>{
  const host=el.current!;let disposed=false,raf=0,width=1,height=1,zoom=1,targetZoom=1,pan=new THREE.Vector2(),targetPan=new THREE.Vector2(),last=0,elapsed=0,frames=0,frameSum=0,quality=1;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-600,600,300,-300,.1,3000);camera.position.set(0,0,1000);camera.lookAt(0,0,0);
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}catch{setError('compatibility');latest.current.onQuality('Compatibility');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x000000,0);host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Equal Earth world map of attributed stablecoin corridors');
  const world=new THREE.Group();scene.add(world);
  const projection=geoEqualEarth().scale(190).translate([0,0]),path=geoPath(projection),loader=new SVGLoader();
  const project=(coords:[number,number])=>{const p=projection(coords)!;return new THREE.Vector3(p[0],-p[1],0);};
  const countries:THREE.Mesh[]=[],countryMats=new Map<string,THREE.MeshBasicMaterial[]>(),routes=new Map<string,Route>(),anchors:THREE.Mesh[]=[];
  const geoLineMat=new THREE.LineBasicMaterial({color:0x506368,transparent:true,opacity:.13});
  const addPath=(d:string,code:string,name:string,fill:boolean)=>{
   const parsed=loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
   for(const p of parsed.paths){
    if(fill)for(const shape of SVGLoader.createShapes(p)){
     const geom=new THREE.ShapeGeometry(shape);geom.scale(1,-1,1);
     const mat=new THREE.MeshBasicMaterial({color:0x253136,side:THREE.DoubleSide,transparent:true,opacity:.9});
     const mesh=new THREE.Mesh(geom,mat);mesh.position.z=-2;mesh.userData={code,name};world.add(mesh);countries.push(mesh);
     const list=countryMats.get(code)??[];list.push(mat);countryMats.set(code,list);
    }
    const pts:number[]=[];for(const sub of p.subPaths){const points=sub.getPoints(1);for(let i=1;i<points.length;i++)pts.push(points[i-1].x,-points[i-1].y,-1,points[i].x,-points[i].y,-1);}
    const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    const mat=fill?new THREE.LineBasicMaterial({color:0x68797d,transparent:true,opacity:.32}):geoLineMat;world.add(new THREE.LineSegments(geom,mat));
   }
  };
  const grat=path(geoGraticule10());if(grat)addPath(grat,'','',false);
  const spritePositions=new Float32Array(40*10*3),spriteColors=new Float32Array(40*10*3),spriteSizes=new Float32Array(40*10);
  const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(spritePositions,3));particleGeometry.setAttribute('color',new THREE.BufferAttribute(spriteColors,3));particleGeometry.setAttribute('size',new THREE.BufferAttribute(spriteSizes,1));
  const particleMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending,vertexShader:'attribute float size; varying vec3 vColor; void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=size;}',fragmentShader:'varying vec3 vColor;void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=pow(max(0.0,1.0-d),1.8);gl_FragColor=vec4(vColor,a);}' });
  const particles=new THREE.Points(particleGeometry,particleMat);particles.frustumCulled=false;world.add(particles);
  const ripple=new THREE.Mesh(new THREE.RingGeometry(2.8,3.3,32),new THREE.MeshBasicMaterial({color:0xc4d9c7,transparent:true,opacity:0,depthTest:false}));world.add(ripple);
  const ringGeometry=new THREE.RingGeometry(2.3,2.8,24),dotGeometry=new THREE.CircleGeometry(1.5,12);
  for(const [code,c]of Object.entries(COUNTRIES)){const p=project(c.anchor);const dot=new THREE.Mesh(dotGeometry,new THREE.MeshBasicMaterial({color:0xb6d4c5,transparent:true,opacity:.6,depthTest:false}));dot.position.copy(p);dot.position.z=3;dot.userData={code,name:c.name};world.add(dot);anchors.push(dot);const ring=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:0xa3c7b5,transparent:true,opacity:.24,depthTest:false}));ring.position.copy(p);ring.position.z=2;ring.userData={code,ring:true};world.add(ring);anchors.push(ring);}
  const labels=new Map<string,HTMLDivElement>();
  for(const code of ['US','GB','BR','SG','HK','AE','JP','AU','NG','IN']){const label=document.createElement('div');label.className='map-country-label';label.textContent=code==='US'?'UNITED STATES':code==='GB'?'UNITED KINGDOM':COUNTRIES[code].name.toUpperCase();host.appendChild(label);labels.set(code,label);}
  const resize=()=>{width=host.clientWidth;height=host.clientHeight;renderer.setSize(width,height);const ratio=width/height,viewW=width<650?1120:1100,viewH=Math.max(530,viewW/ratio);camera.left=-viewH*ratio/2;camera.right=viewH*ratio/2;camera.top=viewH/2;camera.bottom=-viewH/2;camera.updateProjectionMatrix();for(const r of routes.values())r.mat.resolution.set(width,height);};
  const update=()=>{
   const p=latest.current,limit=width<650?20:32;
   const relevant=p.country?p.corridors.filter(c=>c.origin===p.country||c.destination===p.country):p.corridors;
   const ranked=[...relevant].sort((a,b)=>b.rankScore*(routes.has(b.id)?1.15:1)-a.rankScore*(routes.has(a.id)?1.15:1));
   const chosen=ranked.slice(0,limit);const desired=new Set(chosen.map(c=>c.id));
   for(const r of routes.values())r.target=desired.has(r.data.id)?1:0;
   for(const c of chosen){if(!COUNTRIES[c.origin]||!COUNTRIES[c.destination])continue;const color=new THREE.Color(colorOf(c,p.colorMode));let route=routes.get(c.id);
    if(!route){const a=project(COUNTRIES[c.origin].anchor),b=project(COUNTRIES[c.destination].anchor),dist=a.distanceTo(b),sign=c.origin<c.destination?1:-1;
     const bend=Math.min(120,dist*.22),dx=b.x-a.x,dy=b.y-a.y,norm=Math.max(1,dist),nx=-dy/norm,ny=dx/norm;
     const c1=a.clone().lerp(b,.3).add(new THREE.Vector3(nx*bend*sign,ny*bend*sign,20));const c2=a.clone().lerp(b,.7).add(new THREE.Vector3(nx*bend*sign,ny*bend*sign,20));
     a.z=4;b.z=4;const curve=new THREE.CubicBezierCurve3(a,c1,c2,b),geom=new LineGeometry();geom.setPositions(curve.getPoints(quality?56:28).flatMap(v=>[v.x,v.y,v.z]));
     const mat=new LineMaterial({color:color.getHex(),linewidth:1,transparent:true,opacity:0,depthWrite:false,depthTest:false});mat.resolution.set(width,height);const line=new Line2(geom,mat);line.userData={corridor:c.id};world.add(line);
     route={data:c,curve,line,mat,opacity:0,target:1,width:1,targetWidth:1,color};routes.set(c.id,route);
    }
    route.data=c;route.color=color;route.mat.color.copy(color);route.target=p.selected&&p.selected!==c.id?.18:1;route.targetWidth=Math.max(.65,Math.min(4.7,.65+Math.max(0,Math.log10(c.usdValue/1e5))*.78));
   }
   for(const[code,mats]of countryMats){const active=code===p.country||!!(p.selected&&chosen.some(c=>c.id===p.selected&&(c.origin===code||c.destination===code)));for(const mat of mats)mat.color.set(active?0x486157:0x253136);}
   for(const dot of anchors){const active=chosen.some(c=>c.origin===dot.userData.code||c.destination===dot.userData.code);(dot.material as THREE.MeshBasicMaterial).opacity=active?(dot.userData.ring?.35:.85):.12;}
  };
  engine.current={update,zoom:f=>{targetZoom=THREE.MathUtils.clamp(targetZoom*f,.85,4);},reset:()=>{targetZoom=1;targetPan.set(0,0);}};
  const observer=new ResizeObserver(()=>{resize();update();});observer.observe(host);resize();
  fetch('world-110m.json').then(r=>{if(!r.ok)throw Error('World geometry unavailable');return r.json() as Promise<any>;}).then(topo=>{if(disposed)return;const data=feature(topo,topo.objects.countries) as any;for(const f of data.features){if(String(f.id)==='010')continue;const known=Object.entries(COUNTRIES).find(([,c])=>Number(c.numeric)===Number(f.id));const code=known?.[0]??String(f.id);const d=path(f);if(d)addPath(d,code,f.properties.name,true);}update();}).catch(()=>{if(!disposed)setError('World geometry could not load. Refresh to retry.');});
  const ray=new THREE.Raycaster();ray.params.Line={threshold:4};const mouse=new THREE.Vector2(),pointers=new Map<number,{x:number;y:number}>();let start={x:0,y:0},prev={x:0,y:0},dragged=false,pinch=0;
  function pick(e:PointerEvent,click=false){const rect=host.getBoundingClientRect();mouse.set((e.clientX-rect.left)/width*2-1,-(e.clientY-rect.top)/height*2+1);ray.setFromCamera(mouse,camera);ray.params.Line2={threshold:5};
   const routeHits=ray.intersectObjects([...routes.values()].filter(r=>r.target>.2).map(r=>r.line));const countryHits=ray.intersectObjects([...anchors.filter(a=>!a.userData.ring),...countries]);
   if(routeHits.length){const r=routes.get(routeHits[0].object.userData.corridor);if(r){if(click)latest.current.onCorridor(r.data.id);else setHover({x:e.clientX-rect.left,y:e.clientY-rect.top,text:`${COUNTRIES[r.data.origin].name} → ${COUNTRIES[r.data.destination].name}`,sub:`${money(r.data.usdValue)} attributed · Click to investigate`});renderer.domElement.style.cursor='pointer';return;}}
   if(countryHits.length){const data=countryHits[0].object.userData;if(click)latest.current.onCountry(data.code,data.name);else setHover({x:e.clientX-rect.left,y:e.clientY-rect.top,text:data.name,sub:'Explore attributed activity'});renderer.domElement.style.cursor='pointer';return;}
   setHover(null);renderer.domElement.style.cursor='grab';
  }
  const down=(e:PointerEvent)=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});start=prev={x:e.clientX,y:e.clientY};dragged=false;renderer.domElement.setPointerCapture(e.pointerId);if(pointers.size===2){const ps=[...pointers.values()];pinch=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);}};
  const move=(e:PointerEvent)=>{if(pointers.has(e.pointerId)){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const ps=[...pointers.values()],d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(pinch)targetZoom=THREE.MathUtils.clamp(targetZoom*d/pinch,.85,4);pinch=d;dragged=true;}else if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5){dragged=true;const unit=(camera.right-camera.left)/width/zoom;targetPan.x+=(e.clientX-prev.x)*unit;targetPan.y-=(e.clientY-prev.y)*unit;}prev={x:e.clientX,y:e.clientY};}else pick(e);};
  const up=(e:PointerEvent)=>{pointers.delete(e.pointerId);if(!dragged)pick(e,true);pinch=0;};const cancel=(e:PointerEvent)=>{pointers.delete(e.pointerId);dragged=true;pinch=0;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();targetZoom=THREE.MathUtils.clamp(targetZoom*Math.exp(-e.deltaY*.001),.85,4);};const leave=()=>setHover(null);
  const canvas=renderer.domElement;canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('wheel',wheel,{passive:false});
  function draw(t:number){if(disposed)return;raf=requestAnimationFrame(draw);if(document.hidden){last=t;return;}const delta=last?Math.min(.1,(t-last)/1000):.016;last=t;if(!latest.current.paused&&!reduced)elapsed+=delta;
   zoom=THREE.MathUtils.lerp(zoom,targetZoom,.12);pan.lerp(targetPan,.12);world.scale.setScalar(zoom);world.position.set(pan.x*zoom,pan.y*zoom,0);
   let index=0;const count=quality?(width<650?3:7):2;
   for(const[id,r]of routes){r.opacity=THREE.MathUtils.lerp(r.opacity,r.target,.06);r.width=THREE.MathUtils.lerp(r.width,r.targetWidth,.06);const signal=latest.current.rawEvent?.corridor===id&&Date.now()-latest.current.rawEvent.started<5000;r.mat.opacity=r.opacity*(signal?.9:.54);r.mat.linewidth=r.width+(signal?.5:0);
    if(r.target===0&&r.opacity<.015){world.remove(r.line);r.line.geometry.dispose();r.mat.dispose();routes.delete(id);continue;}
    for(let k=0;k<count&&index<400;k++){const phase=((elapsed*.085+k/count+(id.charCodeAt(0)%7)/7)%1),v=r.curve.getPoint(phase);spritePositions.set([v.x,v.y,v.z+1],index*3);spriteColors.set([r.color.r*r.opacity,r.color.g*r.opacity,r.color.b*r.opacity],index*3);spriteSizes[index]=3.7*renderer.getPixelRatio();index++;}
   }
   const event=latest.current.rawEvent,route=event?routes.get(event.corridor):null;const progress=event?(Date.now()-event.started)/3000:2;(ripple.material as THREE.MeshBasicMaterial).opacity=0;if(event&&route&&progress<=1){const v=route.curve.getPoint(Math.max(0,progress));spritePositions.set([v.x,v.y,v.z+2],index*3);spriteColors.set([.85,.95,.83],index*3);spriteSizes[index]=9*renderer.getPixelRatio();index++;}else if(event&&route&&progress<1.67){ripple.position.copy(route.curve.v3);ripple.position.z=6;ripple.scale.setScalar(1+(progress-1)*8);(ripple.material as THREE.MeshBasicMaterial).opacity=.5*(1-(progress-1)/.67);}
   particleGeometry.setDrawRange(0,index);for(const attr of Object.values(particleGeometry.attributes))attr.needsUpdate=true;
   for(const[code,label]of labels){const v=project(COUNTRIES[code].anchor).applyMatrix4(world.matrixWorld).project(camera);label.style.transform=`translate(${(v.x+1)*width/2+7}px,${(-v.y+1)*height/2+9}px)`;label.style.opacity=latest.current.country&&latest.current.country!==code?'.22':'.72';label.style.display=width<650&&!['US','SG','BR','GB','AU'].includes(code)?'none':'block';}
   renderer.render(scene,camera);frames++;frameSum+=delta;if(frames>=180){const fps=frames/frameSum;if(fps<37&&quality){quality=0;renderer.setPixelRatio(1);for(const r of routes.values())r.line.geometry.setPositions(r.curve.getPoints(28).flatMap(v=>[v.x,v.y,v.z]));latest.current.onQuality('Adaptive');}else latest.current.onQuality(quality?'High':'Adaptive');frames=0;frameSum=0;}
  }
  raf=requestAnimationFrame(draw);
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('wheel',wheel);scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(m=>m.dispose());});renderer.dispose();host.replaceChildren();engine.current=null;};
 },[]);
 return <div className="world-map" ref={el}>{error==='compatibility'&&<MapFallback {...props} controls={engine}/>}{error&&error!=='compatibility'&&<div className="map-error">{error}</div>}{hover&&<div className="map-tooltip" style={{left:Math.min(hover.x+14,(el.current?.clientWidth??1000)-280),top:Math.max(0,hover.y-62)}}><strong>{hover.text}</strong><span>{hover.sub}</span></div>}</div>;
});
