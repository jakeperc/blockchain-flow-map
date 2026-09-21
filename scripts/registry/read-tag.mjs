/**
 * Read the public name tag from an address's own explorer page, which is the only admissible address evidence
 * (HANDOFF rule 1). Prints the tag verbatim and the date to put in the `checked` column.
 *
 *   node scripts/registry/read-tag.mjs <etherscan.io|basescan.org|arbiscan.io> <0xaddress>...
 *
 * Arbiscan address pages return 403 to bots, so for arbiscan.io the /txs?a= page header is read instead (the tag
 * is still shown there). Requests are paced and the script stops on any non-200 or challenge page; it never works
 * around one. "no name tag" means the page has none: do not add the address. Tags that look like deposit plumbing
 * (deposit, funder, forwarder, internal, deployer) are flagged, but HANDOFF rule 3 decides admissibility.
 */
const [host,...addrs]=process.argv.slice(2);
if(!host||!addrs.length){console.error('usage: node scripts/registry/read-tag.mjs <etherscan.io|basescan.org|arbiscan.io> <0xaddress>...');process.exit(1);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const arb=host.startsWith('arbiscan');
const today=new Date().toISOString().slice(0,10);
for(const a of addrs){
 if(!/^0x[0-9a-fA-F]{40}$/.test(a)){console.log(a,'| not an address');continue;}
 const res=await fetch(`https://${host}/${arb?`txs?a=${a}`:`address/${a}`}`,{headers:{'user-agent':'Mozilla/5.0'}});
 const html=await res.text();
 if(res.status!==200||/just a moment|cf-chl|captcha/i.test(html.slice(0,5000))){console.error(`stopped: HTTP ${res.status} (challenge or block); do not work around it`);process.exit(1);}
 // The tag sits in a tooltip attribute ending at &#10; or a closing quote; Arbiscan's header uses a span.
 const m=arb?html.match(/Public Name Tag \(viewable by anyone\)">([^<]+)<\/span>/):html.match(/Name Tag \(viewable by anyone\) <br\/> (.*?)(?:&#10;|')/);
 const tag=m?m[1].trim():null;
 console.log(`${a.toLowerCase()} | ${tag?`TAG: ${tag}${/deposit|funder|forwarder|internal|deployer/i.test(tag)?'   [looks like plumbing: check rule 3]':''}   (checked ${today})`:'no name tag'}`);
 await sleep(2500);
}
