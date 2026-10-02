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
const root=fileURLToPath(new URL('.',import.meta.url));

/** What scripts/llms/render.mjs hands back (it is plain ESM, loaded at build time, so it is typed here by hand). */
interface Llms{files:Record<string,string>;head:string;noscript:string;warnings:string[]}
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
  transformIndexHtml:{order:'post',handler(html){
   const surfaces=out;
   if(!surfaces||!surfaces.head)return html;
   if(!/\n\s*<\/head>/.test(html)||!/<body[^>]*>/.test(html))throw new Error('llms: live-lite/index.html has no <head> and <body> to add the page surfaces to');
   return html.replace(/\n(\s*)<\/head>/,(_,indent:string)=>`\n    ${surfaces.head}\n${indent}</head>`).replace(/<body[^>]*>/,tag=>`${tag}\n    ${surfaces.noscript}`);
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
export default defineConfig({
 root:path.join(root,'live-lite'),
 base:'./',
 publicDir:path.join(root,'public'),
 plugins:[react(),llms()],
 resolve:{alias:{'@':root}},
 css:{postcss:{plugins:[tailwindcss()]}},
 build:{outDir:path.join(root,'dist-live'),emptyOutDir:true},
});
