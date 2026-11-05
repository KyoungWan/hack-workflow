import {getStore} from '../../../src/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{return new Response(await getStore().read(new URL(request.url).searchParams.get('file')||''),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'CSV 읽기 실패'},{status:400});}
}
