import {mountExplorer} from './client';
try{mountExplorer();}catch(error){const target=document.getElementById('error');if(target)target.textContent='화면 초기화 실패: '+String(error);}
