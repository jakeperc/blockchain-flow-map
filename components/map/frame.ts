/**
 * The renderer's coordinate frames and the uniforms every layer shares.
 *
 * Globe: a sphere of radius R at the origin of the `world` group; lon 0 / lat 0 is (0,0,R), facing the viewer at the
 * home rotation. Atlas: today's Equal Earth frame (`geoEqualEarth().scale(190)`, 1100×530 design fit, y up) laid on
 * the globe's front tangent plane z=R. Every vertex carries both positions and the shaders blend them with uMorph.
 */
import * as THREE from 'three';
import {geoEqualEarth} from 'd3-geo';
import type {QualityProfile} from '@/lib/atlas/quality-policy';

export const R=265,DESIGN_W=1100,DESIGN_H=530;
export const projection=geoEqualEarth().scale(190).translate([0,0]);
/** Equal Earth position in the flat frame (y up, z = R). */
export function flat(lon:number,lat:number):[number,number,number]{const p=projection([lon,lat])!;return [p[0],-p[1],R];}
/** Height of the design frame in scene units for a viewport: fit by width on desktop, by height on phones and tablets (today's rule). */
export const viewHeight=(width:number,height:number)=>width>980?Math.max(DESIGN_H,DESIGN_W*height/width):DESIGN_H;

export interface Shared{
 uMorph:{value:number};uTime:{value:number};uReveal:{value:number};uPixelRatio:{value:number};uZoom:{value:number};
 uResolution:{value:THREE.Vector2};uSun:{value:THREE.Vector3};uMaxPoint:{value:number};uR:{value:number};
}
export const makeShared=():Shared=>({uMorph:{value:0},uTime:{value:0},uReveal:{value:0},uPixelRatio:{value:1},uZoom:{value:1},uResolution:{value:new THREE.Vector2(1,1)},uSun:{value:new THREE.Vector3(0,0,1)},uMaxPoint:{value:64},uR:{value:R}});

export interface Ctx{
 renderer:THREE.WebGLRenderer;scene:THREE.Scene;world:THREE.Group;camera:THREE.PerspectiveCamera;host:HTMLElement;
 shared:Shared;profile:QualityProfile;reduced:boolean;width:number;height:number;
 /** The map area's height in px and the px offset of its centre below the canvas centre: on desktop the canvas
  * extends under the header and footer bands so the globe can be large, while the atlas frame stays fitted to the area. */
 areaHeight:number;areaShift:number;
}
export const hexToVec3=(hex:string)=>{const c=new THREE.Color(hex);return new THREE.Vector3(c.r,c.g,c.b);};
