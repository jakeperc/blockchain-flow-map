/**
 * The flat map's framing: how far the atlas opens zoomed out, and how far it may be panned. Pure, checked in
 * scripts/verify-map.cjs; components/map/camera.ts measures the extent from the projection it renders with.
 *
 * Zoom keeps its meaning (1 is the design fit the renderer has always used, `viewHeight()` in components/map/frame.ts;
 * land-dot size and label visibility are tuned to it). What changes is where the atlas OPENS: at the zoom that shows
 * the whole map with a margin in the visible map area. On a wide screen that is a little below 1; on a portrait phone,
 * where the design fit showed about a third of the map's width, it is far below. Asked for 2026-10-19: "zoomed out
 * just a bit more so the whole map can be seen".
 *
 * Panning keeps the centre of the view inside the map's outline, so the map can never leave the screen: at the most
 * extreme pan, half of the view is still map.
 */
/** The flat map's outline: half-width and half-height in scene units, and the half-width at each height. */
export interface MapExtent{
 halfW:number;halfH:number;
 /** [height, half-width] pairs from the equator (0) to the pole (halfH), ascending in height. */
 edge:readonly (readonly [number,number])[];
}
/** Space left around the whole map at the home zoom, as a share of the map's size on each side. */
export const ATLAS_MARGIN=.08;
/** How far below the home zoom a pinch may go: a little, so the map can be seen floating, never further. */
export const ATLAS_MIN_SHARE=.85;

/**
 * The outline of a world map from its projection: `project(lon, lat)` returns [x, y] with y DOWN (d3's convention)
 * and the map centred on the origin. Sampled every degree of latitude along the 180th meridian.
 */
export function extentFromProjection(project:(lon:number,lat:number)=>[number,number]):MapExtent{
 const edge:[number,number][]=[];
 for(let lat=0;lat<=90;lat++)edge.push([Math.abs(project(0,lat)[1]),Math.abs(project(180,lat)[0])]);
 return {halfW:edge[0][1],halfH:edge[edge.length-1][0],edge};
}

/**
 * The zoom at which the whole map fits the map area with ATLAS_MARGIN on every side. `designViewHeight` is the scene
 * height the map area spans at zoom 1. Never above 1: the design fit is the closest the atlas ever opens.
 */
export function atlasHomeZoom(width:number,areaHeight:number,designViewHeight:number,ext:MapExtent,margin=ATLAS_MARGIN):number{
 const k=1+2*margin;
 const contain=Math.max(2*ext.halfH*k,2*ext.halfW*k*areaHeight/Math.max(1,width));
 return Math.min(1,designViewHeight/contain);
}

/** The map's half-width at scene height y (either hemisphere). */
export function edgeAt(ext:MapExtent,y:number):number{
 const ay=Math.min(Math.abs(y),ext.halfH),s=ext.edge;
 for(let i=1;i<s.length;i++){
  if(s[i][0]>=ay){const [y0,x0]=s[i-1],[y1,x1]=s[i];return x0+(x1-x0)*((ay-y0)/((y1-y0)||1));}
 }
 return s[s.length-1][1];
}

/** The nearest point inside the map's outline to (x, y), and which axes had to move. */
export function clampToMap(x:number,y:number,ext:MapExtent):{x:number;y:number;hitX:boolean;hitY:boolean}{
 const cy=Math.max(-ext.halfH,Math.min(ext.halfH,y)),e=edgeAt(ext,cy),cx=Math.max(-e,Math.min(e,x));
 return {x:cx,y:cy,hitX:cx!==x,hitY:cy!==y};
}
