import {readdir,realpath,stat,readFile} from 'node:fs/promises';
import {relative,resolve,join,isAbsolute} from 'node:path';
export class CsvFiles {
 constructor(readonly root:string){}
 async files(){
  const root=await realpath(this.root),files:{id:string,bytes:number}[]=[];
  async function walk(dir:string){for(const e of await readdir(dir,{withFileTypes:true})){
   if(e.isSymbolicLink())continue;
   const p=join(dir,e.name);
   if(e.isDirectory())await walk(p);
   else if(e.isFile()&&/\.csv$/i.test(e.name))files.push({id:relative(root,p).split('\\').join('/'),bytes:(await stat(p)).size});
  }}
  await walk(root);return files.sort((a,b)=>a.id.localeCompare(b.id));
 }
 async read(id:string){
  if(!(await this.files()).some(f=>f.id===id))throw Error('선택할 수 없는 파일입니다.');
  const root=await realpath(this.root),path=await realpath(resolve(root,id)),rel=relative(root,path);
  if(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')||isAbsolute(rel))throw Error('파일 경로 오류');
  return readFile(path,'utf8');
 }
}
