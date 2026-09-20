/**
 * Serves dist-live/ from a nested path, the way it will sit under public_html on jakepercy.com. The
 * point is to catch anything that only works at a site root: asset paths are relative, so a build that
 * loads here loads from any folder. Never used in production; this is a check, not a server.
 *
 *   node scripts/serve-dist.cjs [dir=dist-live] [prefix=/ledger-atlas-live] [port=5180]
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'dist-live');
const prefix=process.argv[3]||'/ledger-atlas-live';
const port=Number(process.argv[4]||5180);
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
if(!fs.existsSync(root)){console.error(`${root} does not exist — run "pnpm build:live" first.`);process.exit(1);}
http.createServer((req,res)=>{
 const url=decodeURIComponent((req.url||'/').split('?')[0]);
 if(url==='/'||url===prefix){res.writeHead(302,{Location:prefix+'/'});return res.end();}
 if(!url.startsWith(prefix+'/')){res.writeHead(404);return res.end('outside the deploy prefix: '+url);}
 let rel=url.slice(prefix.length);
 if(rel==='/')rel='/index.html';
 // Refuse to serve outside the build directory.
 const file=path.join(root,rel);
 if(!file.startsWith(root)){res.writeHead(403);return res.end('forbidden');}
 fs.readFile(file,(err,data)=>{
  if(err){console.log('404',url);res.writeHead(404);return res.end('not found');}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream'});
  res.end(data);
 });
}).listen(port,()=>console.log(`serving ${root} at http://localhost:${port}${prefix}/`));
