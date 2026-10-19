/**
 * Static build of the full Blockchain Flow Map UI with an in-browser live data source: `pnpm build:live`.
 * Output in dist-live/ is plain files (relative asset paths) that can be FTP-uploaded to any folder.
 * Deliberately separate from vite.config.ts, which builds the Cloudflare Worker + D1 backend.
 */
import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeFileSync} from 'node:fs';
const root=fileURLToPath(new URL('.',import.meta.url));

/** What scripts/llms/render.mjs hands back (it is plain ESM, loaded at build time, so it is typed here by hand). */
interface Llms{files:Record<string,string>;head:string;noscript:string;pages:Record<string,{head:string;noscript:string}>;warnings:string[]}
interface LlmsRenderer{
 renderAll:(opts:{root:string;atlas?:unknown})=>Llms;
 loadAtlasFor:(root:string)=>Promise<unknown>;
 verifyBuilt:(dir:string,root:string)=>string[];
}
/**
 * llms.txt and methodology.md for readers that run no JavaScript, plus the head tags and the <noscript> block that
 * point to them. The prose is live-lite/llms.txt.tpl; everything that moves is stamped from the code the page is built
 * from, and docs/METHODOLOGY.md is the source of the public methodology. All of it is in scripts/llms/render.mjs, which
 * scripts/verify-llms.mjs runs too, so the gate and the build cannot disagree. Build only: the dev server is untouched,
 * and the app's own bundle is not (its file names stay the same). A failed check fails the build.
 */
function llms():Plugin{
 let out:Llms|null=null,renderer:LlmsRenderer|null=null;
 return {
  name:'jp-llms',
  apply:'build',
  async buildStart(){
   renderer=await import(pathToFileURL(path.join(root,'scripts','llms','render.mjs')).href) as LlmsRenderer;
   // The atlas modules are compiled once more here (about a second) so the stamped facts come from the same code the page is built from.
   let atlas:unknown;
   try{atlas=await renderer.loadAtlasFor(root);}
   catch(e){this.warn(`llms: the atlas modules could not be compiled, so the "Current state" block is dropped (${(e as Error).message})`);}
   out=renderer.renderAll({root,atlas});
   for(const w of out.warnings)this.warn(w);
  },
  // Each page gets its own surfaces (the map: canonical, og tags and <noscript>; Landmarks: its own canonical and og
  // tags, no <noscript> because its stories are static HTML). A page render.mjs does not know fails the build.
  transformIndexHtml:{order:'post',handler(html,ctx){
   if(!out||!out.head)return html;
   const page=path.posix.basename(ctx.path)||'index.html';
   const surfaces=out.pages[page];
   if(!surfaces)throw new Error(`llms: no page surfaces for ${page}; add it to pagesOf() in scripts/llms/render.mjs`);
   if(!/\n\s*<\/head>/.test(html)||!/<body[^>]*>/.test(html))throw new Error(`llms: live-lite/${page} has no <head> and <body> to add the page surfaces to`);
   const withHead=html.replace(/\n(\s*)<\/head>/,(_,indent:string)=>`\n    ${surfaces.head}\n${indent}</head>`);
   return surfaces.noscript?withHead.replace(/<body[^>]*>/,tag=>`${tag}\n    ${surfaces.noscript}`):withHead;
  }},
  generateBundle(){
   if(out)for(const [fileName,source] of Object.entries(out.files))this.emitFile({type:'asset',fileName,source});
  },
  closeBundle(){
   // After the files are written and the public folder is copied: both files exist, the page carries the surfaces,
   // and every same-site link in llms.txt points at something in dist-live/.
   if(!out||!renderer||!Object.keys(out.files).length)return;
   const errors=renderer.verifyBuilt(path.join(root,'dist-live'),root);
   if(errors.length)throw new Error(`llms: dist-live/ is not right:\n  - ${errors.join('\n  - ')}`);
  },
 };
}
/**
 * The Landmarks page (live-lite/landmarks.html) is static HTML with its stories, field and method written in at
 * serve and build time by scripts/landmarks/page.mjs, which builds and checks the model first and throws on any
 * problem. The page's <!--lm:name--> markers name the fragments. HANDOFF section 19.
 */
interface LandmarksPage{pageFragments:(root:string)=>Record<string,string>}
function landmarksPage():Plugin{
 return {
  name:'jp-landmarks',
  transformIndexHtml:{order:'pre',async handler(html,ctx){
   if(path.posix.basename(ctx.path)!=='landmarks.html')return html;
   // The query string makes the dev server re-render after an entry changes; its imports stay cached, so a change to
   // the renderer itself needs a restart.
   const mod=await import(`${pathToFileURL(path.join(root,'scripts','landmarks','page.mjs')).href}?t=${Date.now()}`) as LandmarksPage;
   const fragments=mod.pageFragments(root);
   return html.replace(/<!--lm:(\w+)-->/g,(_,key:string)=>{
    if(!(key in fragments))throw new Error(`landmarks: live-lite/landmarks.html asks for <!--lm:${key}-->, which scripts/landmarks/html.mjs does not render`);
    return fragments[key];
   });
  }},
 };
}
/**
 * Dev only: a sink for the link-preview capture (scripts/og/capture-snippet.js). The console snippet POSTs the JPEG it
 * drew from the globe to /__capture?name=og.jpg and this writes it into public/. Only the two preview names are
 * accepted, nothing is served, and the plugin does not exist in a build.
 */
function captureSink():Plugin{
 const names=new Set(['og.jpg','og-landmarks.jpg']);
 return {
  name:'jp-capture-sink',
  apply:'serve',
  configureServer(server){
   server.middlewares.use('/__capture',(req,res)=>{
    const name=new URL(req.url??'','http://localhost').searchParams.get('name')??'';
    if(req.method!=='POST'||!names.has(name)){res.statusCode=req.method!=='POST'?405:400;res.end('refused');return;}
    const chunks:Buffer[]=[];
    req.on('data',(c:Buffer)=>chunks.push(c));
    req.on('end',()=>{
     const body=Buffer.concat(chunks);
     if(body.length<1000||body[0]!==0xff||body[1]!==0xd8){res.statusCode=400;res.end('not a JPEG');return;}
     writeFileSync(path.join(root,'public',name),body);
     res.end(`wrote public/${name} (${body.length} bytes)`);
    });
   });
  },
 };
}
export default defineConfig({
 root:path.join(root,'live-lite'),
 base:'./',
 publicDir:path.join(root,'public'),
 plugins:[react(),landmarksPage(),llms(),captureSink()],
 resolve:{alias:{'@':root}},
 css:{postcss:{plugins:[tailwindcss()]}},
 build:{outDir:path.join(root,'dist-live'),emptyOutDir:true,rolldownOptions:{input:{index:path.join(root,'live-lite','index.html'),landmarks:path.join(root,'live-lite','landmarks.html')}}},
});
