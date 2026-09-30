/**
 * Static build of the full Blockchain Flow Map UI with an in-browser live data source: `pnpm build:live`.
 * Output in dist-live/ is plain files (relative asset paths) that can be FTP-uploaded to any folder.
 * Deliberately separate from vite.config.ts, which builds the Cloudflare Worker + D1 backend.
 */
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
 root:path.join(root,'live-lite'),
 base:'./',
 publicDir:path.join(root,'public'),
 plugins:[react()],
 resolve:{alias:{'@':root}},
 css:{postcss:{plugins:[tailwindcss()]}},
 build:{outDir:path.join(root,'dist-live'),emptyOutDir:true},
});
