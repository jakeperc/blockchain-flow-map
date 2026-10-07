/**
 * Tron addresses in two forms. The registry, the evidence links and every record key use the base58check form
 * Tronscan shows (T…, case-sensitive). Tron's EVM-style JSON-RPC speaks the 20-byte hex form inside topics and log
 * addresses. These helpers convert between the two, synchronously, because decodeTransferLog is synchronous and
 * crypto.subtle is not: hence the small SHA-256 below (base58check's checksum is the first four bytes of a double
 * SHA-256 over 0x41 + the 20 bytes). Pure, so scripts/verify-live.cjs can check round trips.
 */
import type {Chain} from './model';

const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// BigInt() calls, not literals: the project's tsconfig targets below ES2020.
const ZERO_N=BigInt(0),BASE=BigInt(58);
export const TRON_ADDRESS=/^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** base58check of 0x41 followed by twenty zero bytes. */
export const TRON_ZERO='T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';

const K=new Uint32Array([
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);

/** SHA-256 of a short message (one pass, no streaming). */
export function sha256(msg:Uint8Array):Uint8Array{
 const len=msg.length,blocks=Math.ceil((len+9)/64),buf=new Uint8Array(blocks*64);
 buf.set(msg);buf[len]=0x80;
 const bits=len*8;new DataView(buf.buffer).setUint32(buf.length-4,bits>>>0);new DataView(buf.buffer).setUint32(buf.length-8,Math.floor(bits/2**32));
 const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
 const w=new Uint32Array(64),view=new DataView(buf.buffer);
 const rotr=(x:number,n:number)=>(x>>>n)|(x<<(32-n));
 for(let b=0;b<blocks;b++){
  for(let i=0;i<16;i++)w[i]=view.getUint32(b*64+i*4);
  for(let i=16;i<64;i++){
   const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
   w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
  }
  let [a,bb,c,d,e,f,g,hh]=h;
  for(let i=0;i<64;i++){
   const t1=(hh+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
   const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&bb)^(a&c)^(bb&c)))>>>0;
   hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=bb;bb=a;a=(t1+t2)>>>0;
  }
  h[0]=(h[0]+a)>>>0;h[1]=(h[1]+bb)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+hh)>>>0;
 }
 const out=new Uint8Array(32);const ov=new DataView(out.buffer);h.forEach((x,i)=>ov.setUint32(i*4,x));
 return out;
}

const hexBytes=(hex:string)=>Uint8Array.from(hex.match(/../g)!.map(x=>parseInt(x,16)));
const bytesHex=(b:Uint8Array)=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');

/** 40 lowercase hex characters (no 0x) to the base58check T-address. */
export function tronFromHex(hex40:string):string{
 const h=hex40.replace(/^0x/i,'').toLowerCase();
 if(!/^[0-9a-f]{40}$/.test(h))throw Error(`${hex40} is not a 20-byte address`);
 const payload=hexBytes('41'+h),check=sha256(sha256(payload)).slice(0,4);
 let n=BigInt('0x'+bytesHex(payload)+bytesHex(check)),s='';
 while(n>ZERO_N){s=ALPHABET[Number(n%BASE)]+s;n/=BASE;}
 return s;
}

/** The base58check T-address to its 40 lowercase hex characters (no 0x). Throws on a bad character, prefix or checksum. */
export function tronToHex(address:string):string{
 if(!TRON_ADDRESS.test(address))throw Error(`${address} is not a Tron address`);
 let n=ZERO_N;for(const c of address)n=n*BASE+BigInt(ALPHABET.indexOf(c));
 const full=n.toString(16).padStart(50,'0');
 if(!full.startsWith('41'))throw Error(`${address} does not carry Tron's 0x41 prefix`);
 const payload=full.slice(0,42),check=full.slice(42);
 if(bytesHex(sha256(sha256(hexBytes(payload))).slice(0,4))!==check)throw Error(`${address} fails its checksum`);
 return payload.slice(2);
}

/** The 0x-prefixed 20-byte form an EVM-style RPC expects: unchanged on EVM chains, converted on Tron. */
export const rpcAddress=(chain:Chain,address:string)=>chain==='Tron'?'0x'+tronToHex(address):address.toLowerCase();
/** A 20-byte hex value from a log, in the form this chain's records and registry use. */
export const recordAddress=(chain:Chain,hex40:string)=>chain==='Tron'?tronFromHex(hex40):'0x'+hex40.replace(/^0x/i,'').toLowerCase();
export const isZeroAddress=(chain:Chain,address:string)=>chain==='Tron'?address===TRON_ZERO:/^0x0{40}$/.test(address);
