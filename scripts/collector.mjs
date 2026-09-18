/** Run as a persistent server-side process; never in a browser. */
const origin=process.env.LEDGER_ATLAS_ORIGIN,secret=process.env.INGEST_SECRET;
if(!origin?.startsWith('https://')||!secret||secret.length<24)throw Error('Set HTTPS LEDGER_ATLAS_ORIGIN and server-side INGEST_SECRET');
let stopped=false;process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
let failures=0;
while(!stopped){try{const r=await fetch(new URL('/api/collect',origin),{method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error(`Collector status ${r.status}`);const data=await r.json();console.log(JSON.stringify({at:new Date().toISOString(),...data}));failures=0;}catch(e){failures++;console.error('Collection failed; backing off',e.message);}await new Promise(r=>setTimeout(r,Math.min(60000,15000*2**Math.min(failures,2))));}
