import {existsSync,readFileSync,writeFileSync,mkdirSync,cpSync,statSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const targetArg=process.argv[2],dataArg=process.argv[3],referenceArg=process.argv[4];
if(!targetArg||!dataArg?.trim()||!referenceArg)throw Error('사용법: node install-csv-explorer.mjs <새 앱 폴더> <실제 CSV 폴더> <정상 동작한 Next.js 앱 폴더>. 모든 경로는 실행 위치 기준입니다.');
const reference=resolve(referenceArg);
const referencePackage=JSON.parse(readFileSync(join(reference,'package.json'),'utf8'));
const versions={};
for(const name of ['next','react','react-dom']){
 const installed=join(reference,'node_modules',name,'package.json');
 const version=existsSync(installed)?JSON.parse(readFileSync(installed,'utf8')).version:(referencePackage.dependencies?.[name]||referencePackage.devDependencies?.[name]);
 if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version))throw Error(`${name}의 확인된 정확한 버전이 필요합니다. 참조 앱의 node_modules 또는 package.json을 확인하세요.`);
 versions[name]=version;
}
console.log('현재 Node:',process.version,'참조 앱 버전:',versions);

const target=resolve(targetArg),dataDir=resolve(dataArg);
if(!existsSync(dataDir)||!statSync(dataDir).isDirectory())throw Error('CSV 데이터 폴더를 확인하세요.');
if(existsSync(target))throw Error('앱 폴더가 이미 있습니다. 덮어쓰지 않고 중단합니다. 새 폴더를 지정하세요.');
mkdirSync(target,{recursive:true});
cpSync(fileURLToPath(new URL('../assets/csv-explorer',import.meta.url)),target,{recursive:true,filter:source=>!source.split(/[\\/]/).some(part=>['node_modules','.next'].includes(part))});
writeFileSync(join(target,'config.json'),JSON.stringify({dataDir:relative(target,dataDir)||'.'},null,2)+'\n');
const packageFile=join(target,'package.json'),pkg=JSON.parse(readFileSync(packageFile,'utf8'));
pkg.dependencies={...pkg.dependencies,...versions};
// Match React type definitions to the known working runtime.
const reactMajor=versions.react.split('.')[0];
pkg.devDependencies['@types/react']='^'+reactMajor;
pkg.devDependencies['@types/react-dom']='^'+reactMajor;
writeFileSync(packageFile,JSON.stringify(pkg,null,2)+'\n');
execFileSync('npm',['install','--engine-strict'],{cwd:target,stdio:'inherit'});
console.log(`생성 완료: ${target}\n서버는 시작하지 않았습니다. 사용자가 직접 해당 폴더에서 npm run dev를 실행하고 Next.js 접속 주소의 /data를 여세요.`);
