import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {CsvStore} from './core.ts';
test('BOM, quoted commas/newlines, duplicate headers, blanks, global search, numeric ordering and reload',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'csv-core-'));try{writeFileSync(join(dir,'edge.csv'),'\uFEFF이름,값,값\r\n"가,나","여러\n줄",10\r\n<script>,,2\r\n');const store=new CsvStore(dir);const result=await store.query('edge.csv',new URLSearchParams());assert.equal(result.total,2);assert.deepEqual(result.headers,['이름','값','값']);assert.deepEqual(result.rows[0].values,['가,나','여러\n줄','10']);assert.equal((await store.query('edge.csv',new URLSearchParams({search:'줄'}))).matched,1);assert.equal((await store.query('edge.csv',new URLSearchParams({sort:'2',mode:'number',size:'1'}))).rows[0].values[2],'2');assert.equal((await store.query('edge.csv',new URLSearchParams({column:'0',filter:'<script>'}))).matched,1);await assert.rejects(()=>store.query('../secret',new URLSearchParams()));await assert.rejects(()=>store.query('edge.csv',new URLSearchParams({sort:'0;DROP'})));writeFileSync(join(dir,'edge.csv'),'a,b\nnew,record\n');assert.equal((await store.query('edge.csv',new URLSearchParams())).total,1);writeFileSync(join(dir,'bad.csv'),'a,b\n1,2,3\n');await assert.rejects(()=>store.query('bad.csv',new URLSearchParams()));}finally{rmSync(dir,{recursive:true,force:true});}
});
test('multiple filters combine with AND and sorting honors three priorities',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'csv-multi-'));try{
 writeFileSync(join(dir,'multi.csv'),'group,score,name\nA,10,z\nA,10,b\nA,2,a\nB,10,c\nA,10,a\n');const store=new CsvStore(dir);
 const params=new URLSearchParams({filters:JSON.stringify([{column:'0',value:'A'},{column:'1',value:'10'}]),sorts:JSON.stringify([{column:'0',mode:'text',order:'asc'},{column:'1',mode:'number',order:'desc'},{column:'2',mode:'text',order:'asc'}]),size:'2'});
 const result=await store.query('multi.csv',params);assert.equal(result.matched,3);assert.deepEqual(result.rows.map(r=>r.values[2]),['a','b']);params.set('page','1');assert.deepEqual((await store.query('multi.csv',params)).rows.map(r=>r.values[2]),['z']);
 params.set('filters','[]');params.set('page','0');params.set('size','50');assert.deepEqual((await store.query('multi.csv',params)).rows.map(r=>r.values[2]),['a','b','z','a','c']);
 params.set('sorts',JSON.stringify(Array(4).fill({column:'0',mode:'text',order:'asc'})));await assert.rejects(()=>store.query('multi.csv',params));
 params.set('sorts','[]');params.set('filters','[{"column":"0 OR 1","value":"a"}]');await assert.rejects(()=>store.query('multi.csv',params));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('comma search and column filter are OR within a condition and AND across conditions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'csv-or-'));try{writeFileSync(join(dir,'ids.csv'),'id,site\nL037,A\nL043,A\nL050,B\nL043,B\n');const store=new CsvStore(dir);
 const query=(values:Record<string,string>)=>store.query('ids.csv',new URLSearchParams(values));
 assert.equal((await query({search:' L037, L043,, '})).matched,3);
 assert.equal((await query({search:'L037, A'})).matched,2);
 assert.equal((await query({search:' , , '})).matched,4);
 assert.equal((await query({search:'L037,L043',filters:JSON.stringify([{column:'0',value:'L037, L043'},{column:'1',value:'A'}])})).matched,2);
 assert.equal((await query({filters:JSON.stringify([{column:'0',value:'L037,L043'},{column:'1',value:'B'}])})).matched,1);
 await assert.rejects(()=>query({search:Array.from({length:51},(_,i)=>'id'+i).join(',')}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
