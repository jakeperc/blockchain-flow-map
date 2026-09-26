'use client';
import {MapFallback} from '../map-fallback';
import {useEffect,useLayoutEffect,useRef,useState,forwardRef,useImperativeHandle} from 'react';
import type {Engine,MapProps} from './engine';
import type {Hover} from './interaction';

export type MapHandle={zoom:(factor:number)=>void;reset:()=>void};
export type {MapProps,MapMode} from './engine';

/** three.js and the renderer live in their own chunk. The request starts when this module is evaluated, so it
 * downloads alongside the data feed instead of blocking the first paint of the chrome. */
const engineChunk=typeof window==='undefined'?null:import('./engine');

/** The interactive globe / Equal Earth map. Same props and handle as the previous renderer, plus `mode` and `onReady`. */
export const WorldMap=forwardRef<MapHandle,MapProps>(function WorldMap(props,ref){
 const el=useRef<HTMLDivElement>(null),tip=useRef<HTMLDivElement>(null),latest=useRef(props),engine=useRef<Engine|null>(null),fallback=useRef<{zoom:(f:number)=>void;reset:()=>void}|null>(null);
 const [error,setError]=useState(''),[hover,setHover]=useState<Hover|null>(null);
 useLayoutEffect(()=>{latest.current=props;});
 useImperativeHandle(ref,()=>({zoom:f=>(engine.current??fallback.current)?.zoom(f),reset:()=>(engine.current??fallback.current)?.reset()}),[]);
 useEffect(()=>{engine.current?.update();},[props.corridors,props.countries,props.country,props.selected,props.colorMode]);
 useEffect(()=>{engine.current?.setMode(props.mode);},[props.mode]);
 useEffect(()=>{
  const host=el.current!;
  let e:Engine|null=null,cancelled=false;
  const compatibility=()=>{setError('compatibility');latest.current.onQuality('Compatibility');latest.current.onReady?.();};
  if(!engineChunk||new URLSearchParams(location.search).get('fallback')==='svg'){compatibility();return;}
  engineChunk.then(({createEngine})=>{
   if(cancelled)return;
   try{e=createEngine(host,{props:()=>latest.current,setHover,setError,tooltip:()=>tip.current});}
   catch{compatibility();return;}
   engine.current=e;e.setMode(latest.current.mode);
  },()=>{if(!cancelled)compatibility();});
  return()=>{cancelled=true;e?.dispose();engine.current=null;};
 },[]);
 return <div className="world-map" ref={el}><div className="map-vignette" aria-hidden="true"/>{error==='compatibility'&&<MapFallback corridors={props.corridors} countries={props.countries} country={props.country} selected={props.selected} colorMode={props.colorMode} rawEvent={props.rawEvent} paused={props.paused} onCountry={props.onCountry} onCorridor={props.onCorridor} controls={fallback}/>}{error&&error!=='compatibility'&&<div className="map-error">{error}</div>}{hover&&<div className="map-tooltip" ref={tip}><strong>{hover.text}</strong><span>{hover.sub}</span></div>}</div>;
});
