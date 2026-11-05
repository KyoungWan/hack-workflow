import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'csv-parse/sync';
import {rowClipboardText} from './clipboard.ts';

test('row copy includes headers and the original record number',()=>{
 assert.equal(rowClipboardText(['이름','값'],42,['항목 A','10']),'행 번호\t이름\t값\n42\t항목 A\t10');
});

test('row copy preserves duplicate/empty headers, empty cells and special characters',()=>{
 const headers=['이름','값','값','','줄\n제목'];
 const values=['가\t나','여러\n줄','"인용"','','<script>'];
 const copied=rowClipboardText(headers,7,values);
 assert.deepEqual(parse(copied,{delimiter:'\t'}),[['행 번호',...headers],['7',...values]]);
});
