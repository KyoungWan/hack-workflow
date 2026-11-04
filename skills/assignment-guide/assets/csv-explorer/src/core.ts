import {createReadStream} from 'node:fs';
import {readdir,realpath,stat} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {parse} from 'csv-parse';
export class CsvStore {
 private db=new DatabaseSync(':memory:');
 private cache=new Map<string,{stamp:string,table:string,headers:string[],total:number}>();
 private pending=new Map<string,Promise<any>>();
 private serial=0;
 constructor(readonly root:string){}
 async files(){const root=await realpath(this.root),files:{id:string,bytes:number}[]=[];async function walk(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const p=join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(entry.isFile()&&/\.csv$/i.test(entry.name))files.push({id:relative(root,p).split('\\').join('/'),bytes:(await stat(p)).size});}}await walk(root);return files.sort((a,b)=>a.id.localeCompare(b.id));}
 private async index(id:string){
  if(this.pending.has(id))return this.pending.get(id)!;
  const task=this.load(id);this.pending.set(id,task);try{return await task;}finally{this.pending.delete(id);}
 }
 private async load(id:string){
  const files=await this.files();if(!files.some(f=>f.id===id))throw Error('선택할 수 없는 파일입니다.');
  const root=await realpath(this.root),path=await realpath(resolve(root,id));if(relative(root,path).startsWith('..'))throw Error('파일 경로 오류');
  const s=await stat(path),stamp=`${s.mtimeMs}:${s.size}`,old=this.cache.get(id);if(old?.stamp===stamp)return old;
  const table='csv_'+(++this.serial);let headers:string[]|null=null,total=0,insert:ReturnType<DatabaseSync['prepare']>|null=null;
  const source=createReadStream(path);const parser=parse({bom:true,skip_empty_lines:true});source.on('error',error=>parser.destroy(error));source.pipe(parser);
  // Each insert is a single in-memory transaction; avoid a transaction across async reads.
  try{for await(const values of parser){const row=values as string[];if(!headers){headers=row;if(!row.length||row.length>1000)throw Error('열 수는 1~1000개여야 합니다.');this.db.exec(`CREATE TABLE ${table}(rownum INTEGER PRIMARY KEY,${row.map((_,i)=>`c${i} TEXT`).join(',')})`);insert=this.db.prepare(`INSERT INTO ${table} VALUES(${new Array(row.length+1).fill('?').join(',')})`);}else{if(row.length!==headers.length)throw Error(`${total+2}번째 레코드의 열 수가 다릅니다.`);insert!.run(++total,...row);}}
   if(!headers)throw Error('빈 CSV 파일입니다.');
   if(old)this.db.exec(`DROP TABLE ${old.table}`);
   const result={stamp,table,headers,total};this.cache.set(id,result);return result;
  }catch(e){this.db.exec(`DROP TABLE IF EXISTS ${table}`);throw e;}
 }
 async query(id:string,params:URLSearchParams){
  const indexed=await this.index(id),{table,headers,total}=indexed as {table:string,headers:string[],total:number};
  const integer=(key:string,fallback:number,max:number)=>{const v=params.get(key);if(v===null||v==='')return fallback;const n=Number(v);if(!Number.isInteger(n)||n<0||n>max)throw Error(`${key} 범위 오류`);return n;};
  const page=integer('page',0,10000000),size=integer('size',50,250);if(!size)throw Error('size는 양수여야 합니다.');
  const search=params.get('search')||'';
  type Filter={column:string,value:string,operator?:'contains'|'not-contains'};type Sort={column:string,mode:string,order:string};
  function list<T>(key:string,legacy:T[],max:number):T[]{const raw=params.get(key);if(raw===null)return legacy;let value;try{value=JSON.parse(raw);}catch{throw Error(`${key} 형식 오류`);}if(!Array.isArray(value)||value.length>max)throw Error(`${key}: 최대 ${max}개 조건을 사용할 수 있습니다.`);return value;}
  const filters=list<Filter>('filters',params.get('filter')?[{column:params.get('column')||'',value:params.get('filter')!}]:[],20);
  const sorts=list<Sort>('sorts',params.get('sort')?[{column:params.get('sort')!,mode:params.get('mode')||'text',order:params.get('order')||'asc'}]:[],3);
  const valid=(v:unknown)=>typeof v==='string'&&/^\d+$/.test(v)&&Number(v)<headers.length;
  for(const f of filters)if(!f||!valid(f.column)||typeof f.value!=='string'||(f.operator!==undefined&&!['contains','not-contains'].includes(f.operator)))throw Error('필터 열 또는 값 오류');
  for(const s of sorts)if(!s||!valid(s.column)||!['text','number'].includes(s.mode)||!['asc','desc'].includes(s.order))throw Error('정렬 기준 오류');
  if(new Set(sorts.map(s=>Number(s.column))).size!==sorts.length)throw Error('정렬 열은 중복 선택할 수 없습니다.');
  const where:string[]=[],args:string[]=[];
  const terms=(value:string)=>[...new Set(value.split(',').map(s=>s.trim()).filter(Boolean))];
  const searchTerms=terms(search),filterTerms=filters.map(f=>({...f,terms:terms(f.value)}));
  const parameterCount=searchTerms.length*headers.length+filterTerms.reduce((n,f)=>n+f.terms.length,0);
  if(parameterCount>2000||searchTerms.length>50||filterTerms.some(f=>f.terms.length>50))throw Error('검색어가 너무 많습니다. 각 조건은 최대 50개, 전체 검색 조합은 2,000개까지 지원합니다.');
  if(searchTerms.length){where.push('('+searchTerms.flatMap(term=>headers.map((_,i)=>{args.push(term);return `instr(lower(c${i}),lower(?))>0`;})).join(' OR ')+')');}
  for(const f of filterTerms)if(f.terms.length){where.push((f.operator==='not-contains'?'NOT ':'')+'('+f.terms.map(term=>{args.push(term);return `instr(lower(c${Number(f.column)}),lower(?))>0`;}).join(' OR ')+')');}
  const clause=where.length?' WHERE '+where.join(' AND '):'';
  const matched=Number(this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}${clause}`).get(...args)!.n);
  const offsetPage=Math.min(page,Math.max(0,Math.ceil(matched/size)-1));
  const order=[...sorts.map(s=>`${s.mode==='number'?`CAST(c${Number(s.column)} AS REAL)`:`c${Number(s.column)} COLLATE NOCASE`} ${s.order==='desc'?'DESC':'ASC'}`),'rownum'].join(',');
  const rows=this.db.prepare(`SELECT * FROM ${table}${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,size,offsetPage*size).map(r=>({number:r.rownum,values:headers.map((_,i)=>r['c'+i])}));
  return {headers,total,matched,page:offsetPage,size,rows};
 }
}
