/**
 * The globe's body and its atmosphere. Both fade out for the atlas, where a CSS vignette does the work for free. The
 * atmosphere is a back-face shell shaded analytically from the view ray's closest approach to the centre: a thin
 * bright limb over a soft exponential haze, brighter on the real day side.
 */
import * as THREE from 'three';
import {BODY,RIM} from './shaders';
import {R,hexToVec3,type Ctx} from './frame';

export interface Atmosphere{body:THREE.Mesh;rim:THREE.Mesh;set(body:number,atmo:number):void;dispose():void}
export function buildAtmosphere(ctx:Ctx):Atmosphere{
 const rimColor=hexToVec3('#8fc7a8');
 const OUTER=1.14;
 const bodyMat=new THREE.ShaderMaterial({vertexShader:BODY.vertex,fragmentShader:BODY.fragment,transparent:true,uniforms:{uBody:{value:1},uSun:ctx.shared.uSun,uRim:{value:rimColor}}});
 const body=new THREE.Mesh(new THREE.SphereGeometry(R*.994,96,64),bodyMat);body.renderOrder=1;
 const rimMat=new THREE.ShaderMaterial({vertexShader:RIM.vertex,fragmentShader:RIM.fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,
  uniforms:{uAtmo:{value:1},uRim:{value:hexToVec3('#6fae93')},uLimb:{value:hexToVec3('#d4eadf')},uSun:ctx.shared.uSun,uR:ctx.shared.uR,uOuter:{value:OUTER}}});
 const rim=new THREE.Mesh(new THREE.SphereGeometry(R*OUTER,96,64),rimMat);rim.renderOrder=9;
 return {
  body,rim,
  set(b,a){bodyMat.uniforms.uBody.value=b;body.visible=b>.01;bodyMat.depthWrite=b>.5;rimMat.uniforms.uAtmo.value=a;rim.visible=a>.01;},
  dispose(){body.geometry.dispose();bodyMat.dispose();rim.geometry.dispose();rimMat.dispose();}
 };
}
