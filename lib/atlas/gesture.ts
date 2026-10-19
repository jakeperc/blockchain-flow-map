/**
 * Pointer gestures for the map, as a pure reducer, so the rules are checked in plain Node (scripts/verify-map.cjs)
 * rather than only by hand on a phone. components/map/interaction.ts feeds it pointer events and applies what comes
 * back: a pan by a pixel delta, a zoom about a point, a click, or the end of a gesture with or without inertia.
 *
 * The rules, each from a real fault:
 *  - A pan delta is measured from THE SAME pointer's previous position. The old handler kept one "previous point"
 *    for every pointer; during a pinch that was whichever finger moved last, so when one finger lifted, the other
 *    finger's next move was measured against the finger that had gone and became a pan of hundreds of pixels, which
 *    inertia then carried off the screen. On phones the flat map "flew into oblivion" and only the reset button
 *    brought it back (reported 2026-10-19).
 *  - A gesture that included a pinch ends with no inertia: a pinch is a zoom, and two fingers leaving the glass a
 *    moment apart is not a fling.
 *  - Inertia follows only a pointer that was still moving when it lifted: a drag that paused, then lifted, stops.
 *  - A pointer the browser cancels (it took the gesture over) ends the gesture with no inertia.
 */
export interface Point{x:number;y:number}
export type GestureAction=
 |{kind:'pan';dx:number;dy:number}
 |{kind:'zoom';factor:number;x:number;y:number}
 |{kind:'click';x:number;y:number}
 |{kind:'release';inertia:boolean};
export interface Gesture{
 /** Each pointer's last known position, by pointer id. */
 pointers:Map<number,Point>;
 /** Where the first pointer of this gesture went down. */
 start:Point;
 /** Moved past the slop, or pinched: the gesture is not a click. */
 dragged:boolean;
 /** Two or more pointers were down at some point in this gesture. */
 pinched:boolean;
 /** The browser cancelled a pointer of this gesture. */
 cancelled:boolean;
 /** Distance between the first two pointers at the last pinch step; 0 when not pinching. */
 pinch:number;
 lastMoveAt:number;
}
/** Movement in px before a press becomes a drag rather than a click. */
export const SLOP_PX=5;
/** A pointer that sat still for longer than this before lifting releases with no inertia. */
export const INERTIA_IDLE_MS=80;

export const newGesture=():Gesture=>({pointers:new Map(),start:{x:0,y:0},dragged:false,pinched:false,cancelled:false,pinch:0,lastMoveAt:0});

const pairOf=(g:Gesture)=>{
 const [a,b]=[...g.pointers.values()];
 return {d:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
};

export function pointerDown(g:Gesture,id:number,p:Point,t:number):void{
 if(g.pointers.size===0){g.start={...p};g.dragged=false;g.pinched=false;g.cancelled=false;g.pinch=0;}
 g.pointers.set(id,{...p});g.lastMoveAt=t;
 if(g.pointers.size>=2){g.pinched=true;g.dragged=true;g.pinch=pairOf(g).d;}
}

/** A move of a pointer that is not down (a hovering mouse) is not a gesture and returns null. */
export function pointerMove(g:Gesture,id:number,p:Point,t:number):GestureAction|null{
 const last=g.pointers.get(id);
 if(!last)return null;
 g.pointers.set(id,{...p});g.lastMoveAt=t;
 if(g.pointers.size>=2){
  const {d,mid}=pairOf(g),prev=g.pinch;
  g.pinch=d;
  return prev>0&&d>0?{kind:'zoom',factor:d/prev,x:mid.x,y:mid.y}:null;
 }
 if(!g.dragged&&Math.hypot(p.x-g.start.x,p.y-g.start.y)>SLOP_PX)g.dragged=true;
 return g.dragged?{kind:'pan',dx:p.x-last.x,dy:p.y-last.y}:null;
}

export function pointerUp(g:Gesture,id:number,p:Point,t:number):GestureAction|null{
 if(!g.pointers.delete(id))return null;
 // Fingers still down: the gesture goes on. One finger left after a pinch pans from its own position.
 if(g.pointers.size>=2){g.pinch=pairOf(g).d;return null;}
 if(g.pointers.size===1){g.pinch=0;return null;}
 if(!g.dragged)return {kind:'click',x:p.x,y:p.y};
 return {kind:'release',inertia:!g.pinched&&!g.cancelled&&t-g.lastMoveAt<=INERTIA_IDLE_MS};
}

export function pointerCancel(g:Gesture,id:number):GestureAction|null{
 if(!g.pointers.delete(id))return null;
 g.dragged=true;g.cancelled=true;
 if(g.pointers.size>=2){g.pinch=pairOf(g).d;return null;}
 g.pinch=0;
 return g.pointers.size===0?{kind:'release',inertia:false}:null;
}
