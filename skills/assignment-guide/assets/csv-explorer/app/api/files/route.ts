import {getStore} from '../../../src/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{return Response.json({files:await getStore().files()},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'CSV 폴더를 읽을 수 없습니다. config.json의 dataDir 또는 CSV_DATA_DIR를 확인하세요.'},{status:400});}
}
