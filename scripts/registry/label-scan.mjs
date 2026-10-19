/**
 * Scan an explorer's own search-box autocomplete for public address name tags. Use it to (a) re-check entities
 * that were "licensed but unlabelled" (labels appear over time) and (b) find candidate wallets for an entity.
 * A hit is a LEAD only: read the address's own page (read-tag.mjs) and find a jurisdiction document before adding.
 *
 *   node scripts/registry/label-scan.mjs [--host etherscan.io|basescan.org|arbiscan.io|snowscan.xyz|polygonscan.com|optimistic.etherscan.io] [--pause 1200] [--out file.json] <term>...
 *   node scripts/registry/label-scan.mjs --file terms.txt        (one term per line, # comments)
 *
 * Facts (checked 2026-09-21): the endpoint returns a capped list (about 15 address rows), and popular words are
 * crowded out by token and NFT hits, so "kraken" returns no address rows while "kraken 1" returns them; this script
 * retries with " 1" when a full response has no address rows. `total 0` is a true miss. Searching a full address
 * never returns its tag. "cap hit" means more tags may exist: probe numbered prefixes ("Coinbase 2", ...) for the rest.
 * Requests are paced and the scan stops on any non-JSON or non-200 reply; it never works around a challenge page.
 * --out merges results, with the scan date, into a JSON file (suggested: scripts/registry/label-scan.json, which is
 *   gitignored: a bulk list of explorer tags is research material kept offline, never published).
 * --expand enumerates numbered tag families past the cap: when a term hits the cap, it is re-queried with each digit
 * appended ("coinbase prime" -> "coinbase prime 1".."9", "coinbase prime 1" -> "coinbase prime 10".."19"), up to
 * three levels. Results are merged per term family and deduplicated by address.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const args=process.argv.slice(2);
const OPTS=['--host','--pause','--out','--file'];
const opt=(n,d)=>{const i=args.indexOf(n);return i>-1?args[i+1]:d;};
const host=opt('--host','etherscan.io'),pause=Number(opt('--pause',1200)),out=opt('--out'),file=opt('--file'),expand=args.includes('--expand');
const terms=[...(file?readFileSync(file,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')):[]),...args.filter((a,i)=>!a.startsWith('--')&&!OPTS.includes(args[i-1]))];
if(!terms.length){console.error('usage: node scripts/registry/label-scan.mjs [--host H] [--pause MS] [--out file.json] <term>... | --file terms.txt');process.exit(1);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Heuristic triage only: tags that look like contracts, funders or deposit plumbing. The registry rules decide.
const NOT_A_WALLET=/\b(deployer|token|deposit|funder|forwarder|invoice|internal|avs operator|governance|exploiter)\b/i;
async function search(term){
 const res=await fetch(`https://${host}/searchHandler?term=${encodeURIComponent(term)}&filterby=0`,{headers:{'user-agent':'Mozilla/5.0'}});
 const txt=await res.text();
 if(res.status!==200||!txt.trim().startsWith('['))throw Error(`stopped: HTTP ${res.status} ${txt.slice(0,80).replace(/\s+/g,' ')}`);
 return JSON.parse(txt);
}
const today=new Date().toISOString().slice(0,10);
const results={};
const addrRows=rows=>rows.filter(r=>r.group==='Addresses'&&r.title);
/** Digit expansion for --expand: every capped query is re-asked with each digit appended, up to three levels. */
async function enumerate(term){
 const found=new Map();let queries=0;
 const queue=[{q:term,depth:0}];
 while(queue.length){
  const {q,depth}=queue.shift();
  const rows=addrRows(await search(q));queries++;
  for(const r of rows)found.set(r.address.toLowerCase(),{title:r.title,address:r.address});
  if(rows.length>=15&&depth<3){
   // "coinbase prime" -> "coinbase prime 1".."9"; "coinbase prime 1" -> "coinbase prime 10".."19"
   const numbered=/\d$/.test(q);
   for(let d=numbered?0:1;d<=9;d++)queue.push({q:numbered?`${q}${d}`:`${q} ${d}`,depth:depth+1});
  }
  await sleep(pause);
 }
 return {found:[...found.values()],queries};
}
for(const term of terms){
 if(expand){
  const {found,queries}=await enumerate(term);
  results[term]={scannedAt:today,expanded:true,queries,addresses:found};
  console.log(`${term.padEnd(24)} ${found.length} tagged addresses from ${queries} queries`);
  continue;
 }
 let rows=await search(term),used=term;
 let addr=addrRows(rows);
 if(!addr.length&&rows.length>=15){await sleep(pause);rows=await search(`${term} 1`);used=`${term} 1`;addr=addrRows(rows);}
 const clean=addr.filter(r=>!NOT_A_WALLET.test(r.title));
 results[term]={scannedAt:today,total:rows.length,retriedAs:used===term?undefined:used,addresses:addr.map(r=>({title:r.title,address:r.address}))};
 const verdict=rows.length===0?'no match':`total ${rows.length} addr ${addr.length} wallet-like ${clean.length}${addr.length>=15?' (cap hit)':''}`;
 console.log(`${term.padEnd(24)} ${verdict}${used!==term?` (retried "${used}")`:''}${addr.length?' | '+addr.slice(0,4).map(r=>r.title).join(' | '):''}`);
 await sleep(pause);
}
if(out){
 const prev=existsSync(out)?JSON.parse(readFileSync(out,'utf8')):{};
 prev[host]={...prev[host],...results};
 writeFileSync(out,JSON.stringify(prev,null,1)+'\n');
 console.log('wrote',out);
}
