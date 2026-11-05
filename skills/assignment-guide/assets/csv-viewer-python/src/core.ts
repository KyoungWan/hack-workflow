import {parse} from 'csv-parse/browser/esm/sync';
export class CsvTable {
 readonly headers:string[];
 readonly records:{number:number,values:string[]}[];
 constructor(text:string){
  const rows=parse(text,{bom:true,skip_empty_lines:true}) as string[][];
  if(!rows.length)throw Error('빈 CSV 파일입니다.');
  this.headers=rows[0];
  if(!this.headers.length||this.headers.length>1000)throw Error('열 수는 1~1000개여야 합니다.');
  this.records=rows.slice(1).map((values,i)=>({number:i+1,values}));
 }
 query(params:URLSearchParams){
  const headers=this.headers,total=this.records.length;
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

  const terms=(v:string)=>[...new Set(v.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean))];
  const searchTerms=terms(search),filterTerms=filters.map(f=>({...f,terms:terms(f.value)}));
  if(searchTerms.length>50||filterTerms.some(f=>f.terms.length>50)||searchTerms.length*headers.length+filterTerms.reduce((n,f)=>n+f.terms.length,0)>2000)throw Error('검색어가 너무 많습니다.');
  const selected=this.records.filter(row=>{
   if(searchTerms.length&&!row.values.some(v=>searchTerms.some(t=>v.toLowerCase().includes(t))))return false;
   return filterTerms.every(f=>!f.terms.length||(f.operator==='not-contains'?!f.terms.some(t=>row.values[Number(f.column)].toLowerCase().includes(t)):f.terms.some(t=>row.values[Number(f.column)].toLowerCase().includes(t))));
  });
  selected.sort((a,b)=>{
   for(const s of sorts){
    const av=a.values[Number(s.column)],bv=b.values[Number(s.column)];
    let cmp:number;
    if(s.mode==='number'){const an=parseFloat(av)||0,bn=parseFloat(bv)||0;cmp=an<bn?-1:an>bn?1:0;}
    else{const at=av.toLowerCase(),bt=bv.toLowerCase();cmp=at<bt?-1:at>bt?1:0;}
    if(cmp)return s.order==='desc'?-cmp:cmp;
   }
   return a.number-b.number;
  });
  const matched=selected.length,offsetPage=Math.min(page,Math.max(0,Math.ceil(matched/size)-1));
  return {headers,total,matched,page:offsetPage,size,rows:selected.slice(offsetPage*size,(offsetPage+1)*size)};
 }
}
