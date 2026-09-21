import {productionSnapshot} from '@/lib/atlas/production';
import {CHAINS,WINDOWS,type WindowKey} from '@/lib/atlas/model';

/** Historical snapshots contain only captured provider data; an unavailable feed returns an honest error. */
export async function GET(request:Request){
 try{
  const url=new URL(request.url),w=url.searchParams.get('window') as WindowKey,window=w in WINDOWS?w:'5M',filter=url.searchParams.get('chain')??'All chains';
  if(filter!=='All chains'&&!CHAINS.includes(filter as never))return Response.json({error:'Invalid chain'},{status:400});
  const at=Number(url.searchParams.get('at'))||0;
  if(at>Date.now()||at<0)return Response.json({error:'Invalid historical time'},{status:400});
  return Response.json(await productionSnapshot(window,at,filter),{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Historical data unavailable. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
