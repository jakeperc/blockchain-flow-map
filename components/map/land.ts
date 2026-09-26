/**
 * Land: the dot-matrix continents, hairline outlines and graticule, plus the country-index raster used for O(1)
 * hit-testing and the per-country state texture the dot shader reads. Built once from world-110m.json.
 */
import * as THREE from 'three';
import {geoEquirectangular,geoPath,geoGraticule10} from 'd3-geo';
import {feature} from 'topojson-client';
import {COUNTRIES} from '@/lib/atlas/geography';
import {fibonacciSphere,nearestAnchorDistance,splitAntimeridian,toLonLat,toSphere,type Vec3} from '@/lib/atlas/geo3d';
import {DOTS,LINES} from './shaders';
import {R,flat,type Ctx} from './frame';

export interface CountryFeature{code:string;name:string}
export interface Land{
 dots:THREE.Points;lines:THREE.LineSegments;graticule:THREE.LineSegments;
 features:CountryFeature[];
 /** Country under a lon/lat, or null over water. */
 countryAt(lon:number,lat:number):CountryFeature|null;
 /** Update the per-country state the dots read: `lit` (one-sided activity or on a route) and `selected`. */
 setState(state:Map<string,{lit:boolean;selected:boolean}>):void;
 setDotBudget(n:number):void;
 dispose():void;
}

const numericToCode=new Map(Object.entries(COUNTRIES).map(([code,c])=>[Number(c.numeric),code]));
/** One equirectangular raster serves both dot classification and hit-testing (a second, coarser one cost a full rasterise). */
const IDX_W=2048,IDX_H=1024;

/** The slice of GeoJSON this module reads; the type packages behind d3-geo/topojson are not importable by name under pnpm. */
type Ring=[number,number][];
interface Feat{id?:string|number;properties?:{name?:string}|null;geometry:{type:string;coordinates?:unknown}}
type Topo=Parameters<typeof feature>[0];type GeomColl=Parameters<typeof feature>[1];

function rasterize(features:Feat[],w:number,h:number):Uint8ClampedArray|null{
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
 const proj=geoEquirectangular().scale(w/(2*Math.PI)).translate([w/2,h/2]),path=geoPath(proj,ctx);
 ctx.clearRect(0,0,w,h);
 features.forEach((f,i)=>{const idx=i+1;ctx.fillStyle=`rgb(${idx&255},${idx>>8},0)`;ctx.beginPath();path(f as unknown as Parameters<typeof path>[0]);ctx.fill();});
 return ctx.getImageData(0,0,w,h).data;
}
const lookup=(data:Uint8ClampedArray,w:number,h:number,lon:number,lat:number):number=>{
 const x=Math.min(w-1,Math.max(0,Math.floor((lon+180)/360*w))),y=Math.min(h-1,Math.max(0,Math.floor((90-lat)/180*h)));
 const i=(y*w+x)*4;
 return data[i+3]===255?data[i]+(data[i+1]<<8):-1; // -1: edge pixel, not reliable
};

function ringsOf(g:Feat['geometry']):Ring[]{
 if(g.type==='Polygon')return g.coordinates as Ring[];
 if(g.type==='MultiPolygon')return (g.coordinates as Ring[][]).flat();
 return [];
}
function segmentsOf(lines:[number,number][][],radius:number):{sphere:number[];flat:number[]}{
 const sphere:number[]=[],fl:number[]=[];
 for(const line of lines)for(const piece of splitAntimeridian(line))for(let i=1;i<piece.length;i++){
  for(const [lon,lat] of [piece[i-1],piece[i]]){const s=toSphere(lon,lat,radius),f=flat(lon,lat);sphere.push(s[0],s[1],s[2]);fl.push(f[0],f[1],f[2]);}
 }
 return {sphere,flat:fl};
}
function lineMesh(seg:{sphere:number[];flat:number[]},color:string,opacity:number,ctx:Ctx){
 const geom=new THREE.BufferGeometry();
 geom.setAttribute('position',new THREE.Float32BufferAttribute(seg.sphere,3));
 geom.setAttribute('aFlat',new THREE.Float32BufferAttribute(seg.flat,3));
 const mat=new THREE.ShaderMaterial({vertexShader:LINES.vertex,fragmentShader:LINES.fragment,transparent:true,depthWrite:false,uniforms:{uMorph:ctx.shared.uMorph,uReveal:ctx.shared.uReveal,uR:ctx.shared.uR,uColor:{value:new THREE.Color(color)},uOpacity:{value:opacity}}});
 const mesh=new THREE.LineSegments(geom,mat);mesh.frustumCulled=false;return mesh;
}

export async function buildLand(ctx:Ctx,anchors:Vec3[]):Promise<Land>{
 const res=await fetch('world-110m.json');
 if(!res.ok)throw Error('World geometry unavailable');
 const topo=await res.json() as Topo&{objects:{countries:GeomColl}};
 const all=(feature(topo,topo.objects.countries) as unknown as {features:Feat[]}).features.filter(f=>String(f.id)!=='010');
 const features:CountryFeature[]=all.map(f=>({code:numericToCode.get(Number(f.id))??String(f.id),name:String(f.properties?.name??'')}));
 const index=rasterize(all,IDX_W,IDX_H);
 if(!index)throw Error('World geometry could not be rasterised');

 // Dots: Fibonacci samples that land on a continent, kept in sequence order so any prefix stays near-uniform.
 const want=ctx.profile.dots,samples=fibonacciSphere(Math.round(want/0.27)),n=samples.length/3;
 const pos:number[]=[],fl:number[]=[],country:number[]=[],order:number[]=[];
 let maxDist=0;const dists:number[]=[];
 for(let i=0;i<n&&pos.length/3<want;i++){
  const p:Vec3=[samples[i*3],samples[i*3+1],samples[i*3+2]],[lon,lat]=toLonLat(p),idx=lookup(index,IDX_W,IDX_H,lon,lat);
  if(idx<=0)continue;
  pos.push(p[0]*R,p[1]*R,p[2]*R);const f=flat(lon,lat);fl.push(f[0],f[1],f[2]);country.push(idx);
  const d=nearestAnchorDistance(p,anchors);dists.push(d);if(d>maxDist)maxDist=d;
 }
 for(const d of dists)order.push(maxDist?d/maxDist:0);
 const dotGeom=new THREE.BufferGeometry();
 dotGeom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 dotGeom.setAttribute('aFlat',new THREE.Float32BufferAttribute(fl,3));
 dotGeom.setAttribute('aCountry',new THREE.Float32BufferAttribute(country,1));
 dotGeom.setAttribute('aOrder',new THREE.Float32BufferAttribute(order,1));
 const stateData=new Uint8Array(256*4),stateTex=new THREE.DataTexture(stateData,256,1,THREE.RGBAFormat,THREE.UnsignedByteType);
 stateTex.minFilter=stateTex.magFilter=THREE.NearestFilter;stateTex.needsUpdate=true;
 const dotMat=new THREE.ShaderMaterial({vertexShader:DOTS.vertex,fragmentShader:DOTS.fragment,transparent:true,depthWrite:false,uniforms:{
  uMorph:ctx.shared.uMorph,uReveal:ctx.shared.uReveal,uPixelRatio:ctx.shared.uPixelRatio,uZoom:ctx.shared.uZoom,uMaxPoint:ctx.shared.uMaxPoint,uR:ctx.shared.uR,uSun:ctx.shared.uSun,
  uTerminator:{value:ctx.profile.terminator?1:0},uCountryTex:{value:stateTex}}});
 const dots=new THREE.Points(dotGeom,dotMat);dots.frustumCulled=false;dots.renderOrder=2;

 const outlines=lineMesh(segmentsOf(all.flatMap(f=>ringsOf(f.geometry)),R*1.002),'#68797d',.32,ctx);outlines.renderOrder=3;
 const grat=geoGraticule10();
 const graticule=lineMesh(segmentsOf(grat.coordinates as unknown as Ring[],R*1.001),'#506368',.13,ctx);graticule.renderOrder=3;

 const byCode=new Map<string,number>();features.forEach((f,i)=>{if(!byCode.has(f.code))byCode.set(f.code,i+1);});
 return {
  dots,lines:outlines,graticule,features,
  countryAt(lon,lat){
   let idx=lookup(index,IDX_W,IDX_H,lon,lat);
   if(idx<0){const step=360/IDX_W;for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){idx=lookup(index,IDX_W,IDX_H,lon+dx,lat+dy);if(idx>=0)break;}}
   return idx>0?features[idx-1]:null;
  },
  setState(state){
   stateData.fill(0);
   features.forEach((f,i)=>{const s=state.get(f.code);if(!s)return;const o=(i+1)*4;stateData[o]=s.lit?255:0;stateData[o+1]=s.selected?255:0;stateData[o+2]=255;stateData[o+3]=255;});
   stateTex.needsUpdate=true;
  },
  setDotBudget(n){dotGeom.setDrawRange(0,Math.min(n,pos.length/3));},
  dispose(){for(const m of [dots,outlines,graticule]){m.geometry.dispose();(m.material as THREE.Material).dispose();}stateTex.dispose();}
 };
}
