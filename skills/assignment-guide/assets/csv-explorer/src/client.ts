import {CsvTable} from './core';
import {rowClipboardText} from './clipboard.ts';
export function mountExplorer(){
let disposed=false;
let dataset:CsvTable|undefined,loadedFile='';
const paint=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const filesController=new AbortController();
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$(id) as HTMLInputElement|HTMLSelectElement;
function setSidebar(collapsed:boolean){
 document.body.classList.toggle('sidebar-collapsed',collapsed);
 $('sidebar-content').hidden=collapsed;
 const button=$('toggle-sidebar');button.textContent=collapsed?'›':'‹';
 button.setAttribute('aria-expanded',String(!collapsed));
 const label=collapsed?'CSV 메뉴 펼치기':'CSV 메뉴 접기';button.setAttribute('aria-label',label);button.title=label;
 try{localStorage.setItem('csv-sidebar-collapsed',String(collapsed));}catch{}
}
try{setSidebar(localStorage.getItem('csv-sidebar-collapsed')==='true');}catch{}
$('toggle-sidebar').onclick=()=>setSidebar(!document.body.classList.contains('sidebar-collapsed'));
function maximizeTable(enabled:boolean){
 document.body.classList.toggle('table-maximized',enabled);
 const button=$('maximize-table');button.textContent=enabled?'원래 화면':'표 최대화';
 button.setAttribute('aria-pressed',String(enabled));
 button.title=enabled?'메뉴와 검색 영역 다시 표시':'메뉴와 검색 영역을 숨기고 표 크게 보기';
}
$('maximize-table').onclick=()=>maximizeTable(!document.body.classList.contains('table-maximized'));
const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&document.body.classList.contains('table-maximized')){maximizeTable(false);$('maximize-table').focus();}};
document.addEventListener('keydown',onKeyDown);


let file='',page=0,total=0,size=50,ticket=0;
let queryController:AbortController|undefined;
const headers:string[]=[];
let noticeTimer:ReturnType<typeof setTimeout>;
async function copyCell(value:string,message='셀 내용이 복사되었습니다.'){
 clearTimeout(noticeTimer);
 try{await navigator.clipboard.writeText(value);if(disposed)return;$('notice').textContent=message;}
 catch{if(disposed)return;const fallback=$('copy-fallback') as HTMLTextAreaElement;fallback.hidden=false;fallback.value=value;fallback.focus();fallback.select();$('notice').textContent='아래 텍스트를 Ctrl/Cmd+C로 복사하세요.';}
 $('notice').hidden=false;noticeTimer=setTimeout(()=>{$('notice').hidden=true;},3000);
}

async function json(url:string,signal?:AbortSignal){const r=await fetch(url,{signal});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
function columnSelect(label:string,first:string){const el=document.createElement('select');el.setAttribute('aria-label',label);el.append(new Option(first,''),...headers.map((h,i)=>new Option(h||`열 ${i+1}`,String(i))));return el;}
function updateConditions(){for(const kind of ['filters','sorts']){const rows=Array.from($(kind).children);rows.forEach((row,i)=>{const rank=row.querySelector('.rank');if(rank)rank.textContent=`${i+1}순위`;row.querySelectorAll('[data-field]').forEach(el=>el.setAttribute('aria-label',`${kind==='filters'?'필터':'정렬'} ${i+1} ${(el as HTMLElement).dataset.field}`));});}($('add-sort') as HTMLButtonElement).disabled=$('sorts').children.length>=3;($('add-filter') as HTMLButtonElement).disabled=$('filters').children.length>=20;}
function addCondition(kind:'filters'|'sorts'){
 if($(kind).children.length>=(kind==='filters'?20:3))return;
 const row=document.createElement('div');row.className='condition-row';
 if(kind==='sorts'){const rank=document.createElement('span');rank.className='rank';row.append(rank);}
 const col=columnSelect('','열 선택');col.dataset.field='열';row.append(col);
 if(kind==='filters'){const operator=document.createElement('select');operator.dataset.field='조건';operator.append(new Option('포함','contains'),new Option('제외 (NOT)','not-contains'));row.append(operator);const value=document.createElement('input');value.placeholder='예: L037, L043';value.title='쉼표로 여러 값 입력 · 포함: 하나라도 일치 / 제외: 모두 불일치';value.dataset.field='값';row.append(value);}
 else{for(const [field,choices] of [['방식',[['text','문자'],['number','숫자']]],['순서',[['asc','오름차순'],['desc','내림차순']]]] as [string,string[][]][]){const select=document.createElement('select');select.dataset.field=field;select.append(...choices.map(([v,t])=>new Option(t,v)));row.append(select);}}
 const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label',kind==='filters'?'필터 삭제':'정렬 기준 삭제');remove.onclick=()=>{row.remove();updateConditions();};row.append(remove);$(kind).append(row);updateConditions();
}
function conditions(){const filters=Array.from($('filters').children).map(row=>({column:(row.querySelector('select') as HTMLSelectElement).value,value:(row.querySelector('input') as HTMLInputElement).value,operator:(row.querySelector('[data-field=조건]') as HTMLSelectElement).value})).filter(f=>f.column!==''||f.value!=='');const sorts=Array.from($('sorts').children).map(row=>{const fields=row.querySelectorAll('select');return {column:fields[0].value,mode:fields[1].value,order:fields[2].value};}).filter(s=>s.column!=='');return {filters,sorts};}
$('add-filter').onclick=()=>addCondition('filters');$('add-sort').onclick=()=>addCondition('sorts');
async function load(reset=false){if(!file)return;const serial=++ticket;queryController?.abort();queryController=new AbortController();if(reset)page=0;const params=new URLSearchParams({file,page:String(page),size:String(size)});params.set('search',input('search').value);const c=conditions();params.set('filters',JSON.stringify(c.filters));params.set('sorts',JSON.stringify(c.sorts));$('status').textContent='CSV 파일 읽는 중…';$('error').textContent='';try{if(!dataset||loadedFile!==file){
 const response=await fetch('/api/file?'+new URLSearchParams({file}),{signal:queryController.signal,cache:'no-store'});
 if(!response.ok){const error=await response.json();throw Error(error.error||'CSV 읽기 실패');}
 const text=await response.text();if(serial!==ticket)return;
 $('status').textContent='CSV 해석 중…';await paint();if(serial!==ticket)return;
 dataset=new CsvTable(text);loadedFile=file;
 }
 $('status').textContent='검색·정렬 중…';await paint();if(serial!==ticket)return;
 const d=dataset.query(params);$('status').textContent='표 표시 중…';await paint();if(serial!==ticket)return;
 if(!headers.length){headers.push(...d.headers);addCondition('filters');addCondition('sorts');}
 page=d.page;total=d.matched;const table=$('table');table.replaceChildren();const head=document.createElement('thead'),hr=document.createElement('tr');for(const [i,text] of ['행 번호',...d.headers].entries()){const th=document.createElement('th');th.textContent=text||'(빈 헤더)';if(i)th.className='col-'+((i-1)%8);const grip=document.createElement('span');grip.className='grip';grip.onpointerdown=e=>{e.preventDefault();const start=e.clientX,width=th.getBoundingClientRect().width;grip.setPointerCapture(e.pointerId);grip.onpointermove=event=>{th.style.minWidth=th.style.width=Math.max(90,width+event.clientX-start)+'px';};grip.onpointerup=()=>{grip.onpointermove=null;};};th.append(grip);hr.append(th);}head.append(hr);table.append(head);
 const body=document.createElement('tbody');for(const row of d.rows){const tr=document.createElement('tr'),n=document.createElement('th');n.scope='row';const rowButton=document.createElement('button');rowButton.type='button';rowButton.className='row-copy';rowButton.textContent=String(row.number);rowButton.title='헤더와 행 번호를 포함한 행 전체 복사';rowButton.setAttribute('aria-label',`${row.number}번 행 전체 복사 (헤더 포함)`);rowButton.onclick=()=>copyCell(rowClipboardText(d.headers,row.number,row.values),'헤더와 행 전체가 복사되었습니다.');n.append(rowButton);tr.append(n);row.values.forEach((value:string,i:number)=>{const td=document.createElement('td');td.className='col-'+(i%8);const b=document.createElement('button');b.className='cell';b.textContent=value===''?'(빈 값)':value;b.title='클릭하여 전체 내용 복사';b.onclick=()=>copyCell(value);td.append(b);tr.append(td);});body.append(tr);}table.append(body);
 $('title').textContent=file;$('status').textContent=`전체 ${d.total.toLocaleString()}행 · ${headers.length}열 / 검색 결과 ${d.matched.toLocaleString()}행`;
 $('page').textContent=`${page+1} / ${Math.max(1,Math.ceil(total/size))} 페이지 · ${total?page*size+1:0}–${Math.min((page+1)*size,total)}행`;
 ($('prev') as HTMLButtonElement).disabled=page===0;($('next') as HTMLButtonElement).disabled=(page+1)*size>=total;
 }catch(e){if(serial===ticket){$('error').textContent=(e as Error).message;$('status').textContent='조회 실패';$('table').replaceChildren();}}
}
function clear(){input('search').value='';$('filters').replaceChildren();$('sorts').replaceChildren();if(headers.length){addCondition('filters');addCondition('sorts');}updateConditions();}
$('query').onsubmit=e=>{e.preventDefault();load(true);};$('reset').onclick=()=>{clear();load(true);};$('prev').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};input('size').onchange=()=>{size=Number(input('size').value);load(true);};
$('status').textContent='파일 목록 불러오는 중…';
$('files').replaceChildren();
clear();
json('/api/files',filesController.signal).then(async d=>{if(disposed)return;if(!d.files.length){$('status').textContent='CSV 파일이 없습니다.';return;}for(const f of d.files){const b=document.createElement('button');b.textContent=f.id;const small=document.createElement('small');small.textContent=`${(f.bytes/1024).toFixed(1)} KB`;b.append(small);b.onclick=()=>{document.querySelectorAll('nav button').forEach(n=>n.removeAttribute('aria-current'));b.setAttribute('aria-current','true');file=f.id;dataset=undefined;loadedFile='';headers.length=0;clear();$('table').replaceChildren();load(true);};$('files').append(b);}($('files').firstElementChild as HTMLButtonElement).click();}).catch(e=>{if(!disposed){$('status').textContent='파일 목록 조회 실패';$('error').textContent=e.message;}});

return ()=>{disposed=true;ticket++;filesController.abort();queryController?.abort();clearTimeout(noticeTimer);document.removeEventListener('keydown',onKeyDown);document.body.classList.remove('sidebar-collapsed','table-maximized');};
}
