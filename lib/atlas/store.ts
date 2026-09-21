import {env} from 'cloudflare:workers';
import {admissible,type Transfer,type Attribution,UNKNOWN} from './model';
export type Bindings={DB:D1Database;ETHEREUM_RPC_URL?:string;BASE_RPC_URL?:string;ARBITRUM_RPC_URL?:string;INGEST_SECRET?:string;COINGECKO_API_KEY?:string;TRONGRID_API_KEY?:string;SOLANA_WEBHOOK_ENABLED?:string;};
export const bindings=()=>env as unknown as Bindings;
export const database=()=>{const d=bindings().DB;if(!d)throw Error('Historical storage is unavailable');return d;};
export const addressKey=(chain:string,address:string)=>['Ethereum','Base','Arbitrum'].includes(chain)?address.toLowerCase():address;
export async function resolveAttribution(chain:string,address:string):Promise<Attribution>{const row=await database().prepare('SELECT evidence FROM entity_evidence WHERE id=?').bind(`${chain}:${addressKey(chain,address)}`).first<{evidence:string}>();return row?JSON.parse(row.evidence):UNKNOWN;}
export async function persist(events:Transfer[]){
 const db=database();let inserted=0;
 for(let i=0;i<events.length;i+=40){const batch=events.slice(i,i+40).map(t=>{
  const a=admissible(t.senderEntity,t.blockTime)?t.senderEntity.jurisdiction:null,b=admissible(t.receiverEntity,t.blockTime)?t.receiverEntity.jurisdiction:null;
  const mapped=t.adjustment==='included'&&a&&b&&a!==b?1:0;const confidence=mapped?(t.senderEntity.confidence==='VERIFIED'&&t.receiverEntity.confidence==='VERIFIED'?'VERIFIED':'HIGH'):null;
  return db.prepare('INSERT OR IGNORE INTO transfers (id,chain,transaction_id,block_time,asset,usd_value,adjustment,economic_class,origin,destination,confidence,mapped,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(t.id,t.chain,t.transactionId,t.blockTime,t.asset,t.usdValue,t.adjustment,t.economicClass,a,b,confidence,mapped,JSON.stringify(t));});
  const results=await db.batch(batch);inserted+=results.reduce((n,r)=>n+(r.meta.changes??0),0);
 }return inserted;
}
export async function authorized(request:Request){const secret=bindings().INGEST_SECRET;if(!secret||secret.length<24)return false;const token=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';const enc=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(secret)),crypto.subtle.digest('SHA-256',enc.encode(token))]);const aa=new Uint8Array(a),bb=new Uint8Array(b);let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];return mismatch===0;}
