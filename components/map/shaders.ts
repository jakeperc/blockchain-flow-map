/**
 * Every GLSL program of the globe renderer. All motion is evaluated here from uniforms, so the CPU writes nothing
 * per frame but a handful of numbers. three prepends the precision statement and the standard matrices/attributes.
 * Vertices carry `position` (on the sphere) and `aFlat` (on the Equal Earth plane); `uMorph` blends them.
 */

/** Soft fade for anything on the far side of the globe; off in atlas mode. `n` and `p` in model space. */
const FACING=`
float facing(vec3 n,vec3 p,float morph){
 vec3 wn=normalize((modelMatrix*vec4(n,0.0)).xyz);
 vec3 wv=normalize(cameraPosition-(modelMatrix*vec4(p,1.0)).xyz);
 return mix(smoothstep(-0.06,0.12,dot(wn,wv)),1.0,morph);
}`;

export const DOTS={
 vertex:`
uniform float uMorph,uReveal,uTerminator,uPixelRatio,uZoom,uMaxPoint,uR;
uniform vec3 uSun;
uniform mediump sampler2D uCountryTex;
attribute vec3 aFlat;attribute float aCountry;attribute float aOrder;
varying float vAlpha;varying vec3 vTint;
${FACING}
void main(){
 vec3 p=mix(position,aFlat,uMorph);
 vec3 n=position/uR;
 float night=mix(1.0,smoothstep(-0.18,0.18,dot(n,uSun)),uTerminator*(1.0-uMorph));
 vec4 st=texture2D(uCountryTex,vec2((aCountry+0.5)/256.0,0.5));
 float reveal=smoothstep(aOrder-0.16,aOrder+0.02,uReveal);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
 // Foreshortening: dots shrink and dim toward the limb, which reads as a sphere rather than a disc (globe only).
 vec3 wn=normalize((modelMatrix*vec4(n,0.0)).xyz);vec3 wv=normalize(cameraPosition-(modelMatrix*vec4(p,1.0)).xyz);
 float limb=mix(smoothstep(-0.05,0.55,dot(wn,wv)),1.0,uMorph);
 float size=(2.1+0.6*clamp(uZoom-1.0,0.0,3.0))*uPixelRatio*mix(0.62,1.0,limb);
 gl_PointSize=min(size,uMaxPoint);
 vAlpha=reveal*(0.42+0.58*st.r)*mix(0.6,1.0,night)*facing(n,p,uMorph)*mix(0.55,1.0,limb);
 vTint=mix(vec3(0.53,0.62,0.58),vec3(0.78,0.86,0.75),st.g)+vec3(-0.03,0.0,0.035)*(1.0-night);
 // Invisible dots (far hemisphere, not yet revealed) leave the clip volume: no rasterisation, no blending.
 if(vAlpha<0.004){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;}
}`,
 fragment:`
varying float vAlpha;varying vec3 vTint;
void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=smoothstep(1.0,0.55,d);gl_FragColor=vec4(vTint,a*vAlpha);}`
};

export const LINES={
 vertex:`
uniform float uMorph,uReveal,uR;
attribute vec3 aFlat;
varying float vAlpha;
${FACING}
void main(){
 vec3 p=mix(position,aFlat,uMorph);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
 vAlpha=smoothstep(0.45,1.0,uReveal)*facing(position/uR,p,uMorph);
}`,
 fragment:`
uniform vec3 uColor;uniform float uOpacity;varying float vAlpha;
void main(){gl_FragColor=vec4(uColor,uOpacity*vAlpha);}`
};

export const BODY={
 vertex:`
uniform vec3 uSun;
varying vec3 vN;varying vec3 vW;varying vec3 vS;
void main(){vN=normalize((modelMatrix*vec4(normal,0.0)).xyz);vW=(modelMatrix*vec4(position,1.0)).xyz;vS=normalize((modelMatrix*vec4(uSun,0.0)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragment:`
uniform float uBody;uniform vec3 uRim;
varying vec3 vN;varying vec3 vW;varying vec3 vS;
void main(){
 vec3 n=normalize(vN);vec3 v=normalize(cameraPosition-vW);vec3 s=normalize(vS);
 float nv=max(dot(n,v),0.0);
 float day=smoothstep(-0.25,0.55,dot(n,s));
 vec3 col=mix(vec3(0.040,0.066,0.077),vec3(0.064,0.102,0.114),day);
 // A broad, faint glint where the real sun would reflect off the ocean: astronomy, like the terminator, not data.
 float spec=pow(max(dot(n,normalize(s+v)),0.0),48.0)*day;
 col+=vec3(0.55,0.72,0.66)*spec*0.07;
 col+=uRim*pow(1.0-nv,3.2)*0.26;
 gl_FragColor=vec4(col,uBody);
}`
};

export const RIM={
 vertex:`
uniform vec3 uSun;
varying vec3 vW;varying vec3 vC;varying vec3 vS;
void main(){vW=(modelMatrix*vec4(position,1.0)).xyz;vC=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;vS=normalize((modelMatrix*vec4(uSun,0.0)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragment:`
uniform float uAtmo,uR,uOuter;uniform vec3 uRim,uLimb;
varying vec3 vW;varying vec3 vC;varying vec3 vS;
void main(){
 vec3 rd=normalize(vW-cameraPosition);vec3 oc=vC-cameraPosition;
 vec3 closest=cameraPosition+rd*dot(oc,rd)-vC;
 float h=length(closest)/uR;
 float x=clamp((h-1.0)/(uOuter-1.0),0.0,1.0);
 float haze=exp(-x*3.4)*(1.0-smoothstep(0.7,1.0,x));
 float line=exp(-x*30.0);
 float inside=h<1.0?pow(h,14.0):1.0;
 float sun=0.38+0.62*smoothstep(-0.45,0.65,dot(normalize(closest),normalize(vS)));
 vec3 col=mix(uRim,uLimb,line*0.8);
 gl_FragColor=vec4(col,(haze*0.5+line*0.42)*inside*sun*uAtmo);
}`
};

/** Fetch an arc sample from the two textures (rows = slots, columns = samples) and blend by morph. */
const ARC_FETCH=`
uniform highp sampler2D uArcSphere,uArcFlat;uniform float uSamples;
vec3 fetchArc(float slot,float s,float morph){vec2 uv=vec2((s+0.5)/uSamples,(slot+0.5)/64.0);return mix(texture2D(uArcSphere,uv).xyz,texture2D(uArcFlat,uv).xyz,morph);}`;

export const RIBBON={
 vertex:`
${ARC_FETCH}
uniform float uMorph,uPixelRatio,uHalo,uR;uniform vec2 uResolution;
uniform vec4 uArcColor[64];uniform vec4 uArcParam[64];
varying float vT;varying float vEdge;varying float vProgress;varying float vFade;varying float vPhase;varying vec4 vColor;
${FACING}
vec2 toScreen(vec4 clip){return clip.xy/max(clip.w,1e-4)*uResolution*0.5;}
void main(){
 float slot=position.x,s=position.y,side=position.z;
 int i=int(slot+0.5);
 vec4 col=uArcColor[i];vec4 par=uArcParam[i];
 vec3 p=fetchArc(slot,s,uMorph);
 vec3 pa=fetchArc(slot,max(s-1.0,0.0),uMorph);vec3 pb=fetchArc(slot,min(s+1.0,uSamples-1.0),uMorph);
 mat4 mvp=projectionMatrix*modelViewMatrix;
 vec4 clip=mvp*vec4(p,1.0);
 vec2 dir=toScreen(mvp*vec4(pb,1.0))-toScreen(mvp*vec4(pa,1.0));
 dir=normalize(dir+vec2(1e-5,0.0));
 vec2 nrm=vec2(-dir.y,dir.x);
 float w=par.x*uPixelRatio*par.z*(uHalo>0.5?2.8:1.0);
 clip.xy+=nrm*side*w/uResolution*2.0*clip.w;
 gl_Position=clip;
 vT=s/(uSamples-1.0);vEdge=side;vProgress=par.y;vColor=col;vPhase=mod(slot*7.0,11.0)/11.0;
 vFade=par.w*facing(normalize(p),p,uMorph);
}`,
 fragment:`
uniform float uHalo,uTime,uSpeed,uCount,uTrail;
varying float vT;varying float vEdge;varying float vProgress;varying float vFade;varying float vPhase;varying vec4 vColor;
void main(){
 float drawn=1.0-smoothstep(vProgress-0.05,vProgress,vT);
 float edge=1.0-abs(vEdge);
 float ramp=mix(0.55,1.0,vT);
 // Comet trails: each particle (same phase formula as the particle system) leaves a tail behind it along the arc.
 float trail=0.0;
 for(int k=0;k<7;k++){
  if(float(k)>=uCount)break;
  float head=fract(uTime*uSpeed+float(k)/uCount+vPhase);
  float d=head-vT;d+=step(d,0.0);
  trail=max(trail,pow(1.0-clamp(d/uTrail,0.0,1.0),2.2)*step(head,vProgress));
 }
 float a=uHalo>0.5?pow(edge,2.4)*0.16*(1.0+trail*1.4):smoothstep(0.0,0.4,edge)*(1.0+trail*1.9);
 vec3 col=mix(vColor.rgb,vec3(0.93,0.98,0.95),uHalo>0.5?0.0:trail*0.32);
 gl_FragColor=vec4(col,min(1.0,a*vColor.a*drawn*vFade*ramp));
}`
};

export const PARTICLES={
 vertex:`
${ARC_FETCH}
uniform float uMorph,uTime,uSpeed,uCount,uSize,uPixelRatio,uMaxPoint,uHeadSlot,uHeadT,uHeadSize,uR;
uniform vec4 uArcColor[64];uniform vec4 uArcParam[64];
attribute float aPhase;
varying vec4 vColor;
${FACING}
void main(){
 float slot=position.x,k=position.y,head=position.z;
 float t;float size;vec4 col;vec4 par;
 if(head>0.5){slot=max(uHeadSlot,0.0);int h=int(slot+0.5);par=uArcParam[h];t=uHeadT;size=uHeadSize;col=vec4(0.85,0.95,0.83,uHeadSlot<0.0?0.0:1.0);}
 else{int i=int(slot+0.5);col=uArcColor[i];par=uArcParam[i];t=fract(uTime*uSpeed+k/uCount+aPhase);size=uSize;if(k>=uCount)col.a=0.0;}
 float si=t*(uSamples-1.0);float s0=floor(si);float f=si-s0;
 vec3 p=mix(fetchArc(slot,s0,uMorph),fetchArc(slot,min(s0+1.0,uSamples-1.0),uMorph),f);
 float drawn=step(t,par.y);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
 gl_PointSize=min(size*uPixelRatio,uMaxPoint);
 float a=col.a*par.w*drawn*facing(normalize(p),p,uMorph);
 vColor=vec4(col.rgb*a,a);
}`,
 fragment:`
varying vec4 vColor;
void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=pow(max(0.0,1.0-d),1.8);float core=pow(max(0.0,1.0-d),6.0);gl_FragColor=vec4(vColor.rgb+vec3(0.8)*core*vColor.a,a);}`
};

/** Instanced anchor pieces. iState = (ringOpacity, glowOpacity, glowScale, phase); iRing = (ringScale, dotOpacity). */
const ANCHOR_FRAME=`
attribute vec3 iSphere;attribute vec3 iFlat;attribute vec4 iState;attribute vec2 iRing;
uniform float uMorph;
vec3 centerOf(){return mix(iSphere,iFlat,uMorph);}
void tangentFrame(out vec3 tx,out vec3 ty,out vec3 nn){
 vec3 n=normalize(iSphere);
 vec3 up=abs(n.y)<0.99?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0);
 vec3 t0=normalize(cross(up,n));vec3 t1=cross(n,t0);
 tx=normalize(mix(t0,vec3(1.0,0.0,0.0),uMorph));ty=normalize(mix(t1,vec3(0.0,1.0,0.0),uMorph));nn=normalize(mix(n,vec3(0.0,0.0,1.0),uMorph));
}`;

export const RING={
 vertex:`
${ANCHOR_FRAME}
attribute float aPart;
varying float vAlpha;varying float vPart;
void main(){
 vec3 tx,ty,nn;tangentFrame(tx,ty,nn);
 float s=aPart>0.5?1.0:iRing.x;
 vec3 p=centerOf()+(tx*position.x+ty*position.y)*s+nn*0.8;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
 vAlpha=aPart>0.5?iRing.y:iState.x;vPart=aPart;
}`,
 fragment:`
uniform vec3 uRingColor,uDotColor;varying float vAlpha;varying float vPart;
void main(){gl_FragColor=vec4(mix(uRingColor,uDotColor,vPart),vAlpha);}`
};

export const HALO={
 vertex:`
${ANCHOR_FRAME}
uniform float uTime;
varying vec2 vUv;varying float vAlpha;
void main(){
 float breathe=1.0+0.06*sin(uTime*1.6+iState.w);
 float s=iState.z*breathe;
 vec4 mv=modelViewMatrix*vec4(centerOf(),1.0);
 mv.xy+=position.xy*s;
 gl_Position=projectionMatrix*mv;
 vUv=position.xy;vAlpha=s<0.01?0.0:iState.y;
}`,
 fragment:`
uniform vec3 uGlowColor;varying vec2 vUv;varying float vAlpha;
void main(){
 float d=length(vUv);
 float a=d<0.35?mix(1.0,0.45,d/0.35):mix(0.45,0.0,clamp((d-0.35)/0.65,0.0,1.0));
 gl_FragColor=vec4(uGlowColor,a*vAlpha);
}`
};

export const BEAM={
 vertex:`
${ANCHOR_FRAME}
uniform float uBeams;
varying float vY;varying float vX;varying float vAlpha;
void main(){
 vec3 c=centerOf();
 vec3 nv=normalize((modelViewMatrix*vec4(normalize(iSphere),0.0)).xyz);
 vec4 cv=modelViewMatrix*vec4(c,1.0);
 vec3 view=normalize(-cv.xyz);
 vec3 side=normalize(cross(nv,view)+vec3(1e-5,0.0,0.0));
 float h=iState.z*1.5*(1.0-uMorph)*uBeams;
 vec3 p=cv.xyz+nv*position.y*h+side*position.x*1.1;
 gl_Position=projectionMatrix*vec4(p,1.0);
 vY=position.y;vX=position.x;vAlpha=iState.y*0.55*step(0.01,h);
}`,
 fragment:`
uniform vec3 uGlowColor;varying float vY;varying float vX;varying float vAlpha;
void main(){float a=pow(1.0-vY,2.2)*(1.0-abs(vX))*vAlpha;gl_FragColor=vec4(uGlowColor,a);}`
};
