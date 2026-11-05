import 'server-only';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CsvFiles} from './files';
const state=globalThis as typeof globalThis & {csvExplorer?:{directory:string,store:CsvFiles}};
export function getStore(){
 const settings=JSON.parse(readFileSync(resolve(process.cwd(),'config.json'),'utf8'));
 const directory=process.env.CSV_DATA_DIR||settings.dataDir;
 if(typeof directory!=='string'||!directory.trim())throw Error('config.json의 dataDir 또는 CSV_DATA_DIR에 실제 CSV 폴더를 지정하세요.');
 const absolute=resolve(/* turbopackIgnore: true */ process.cwd(),directory);
 if(state.csvExplorer?.directory!==absolute)state.csvExplorer={directory:absolute,store:new CsvFiles(absolute)};
 return state.csvExplorer!.store;
}
