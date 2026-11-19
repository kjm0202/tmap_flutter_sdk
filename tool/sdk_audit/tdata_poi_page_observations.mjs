import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const REVIEW={file:'docs/sdk-audit/reviews/tdata-poi-page-source-review.json',sha256:"d7efe696bc74a544d68e43a214a963a10aa281b6aad317d74aab42cb91ec1200"};
const FILES=[
 ['lib/src/models/poi_item.dart','4ae50c1ce47a4f8c342d32641ce2937de7e8810b5dca5a991df3c9949f84dd2b'],
 ['lib/src/services/tdata_protocol.dart','cab473e185379c1ec1723ff74a332b2609b0ad79cfd88a3363efee5e855eee53'],
 ['lib/src/services/tdata_service.dart','1edc5214885718d4e32b980cfecfc7f04b9b29a8f3e94789f02fa9168cce0c5e'],
 ['lib/src/controller/tdata_commands.dart','d42fc6a3b0a275eb5e912f9fd2bfc2f538c60c7aa3d7fa498504ee29bece4a84'],
 ['example/integration_test/tdata_poi_page_contracts.dart','dbd965ea2023b7c0bf94395c2b6cba26f720da3e5209d097257f89a919894bf2'],
];
const METHODS=[
 {name:'getPOIDataFromSearchJson',start:1001201,end:1001983,excerptSha256:'4366fc5c53fcac99515e7be15154924b2a8a557a8f92d5f79201608ff46fcf91'},
 {name:'getPOIDataFromLonLatJson',start:1004284,end:1005105,excerptSha256:'63506d6258d7eb6fd57eb72689dd9940b0065b22d434b90147dbfec86205617e'},
];
const REFS=[
 {id:'U020',sha256:'6e58b2231b1da574dc843d728fa0c55d6ef7d3f370158f7ea86e7a4468a8a1ce',rows:[
  {field:'totalCount',start:8631,end:9130,excerptSha256:'2cb75ff4581c170bbfbe6dc23cbe1c37d56a198f448b094bf7bc8e430219922f'},
  {field:'count',start:9151,end:9629,excerptSha256:'a5cbccb07d704462f0b5524cd6663ccf2059d0f731a00055c8ca97c821dff9ee'},
  {field:'page',start:9650,end:10124,excerptSha256:'375f02515ffc919ba5da3c55658ad571dcbe34e70b387444b0ca885d56e2d6f7'}]},
 {id:'U024',sha256:'0a8a78714e6b981e930a2ba1c12bc31619992d19aef6d2f4b5b1329ba20325b6',rows:[
  {field:'totalCount',start:9976,end:10391,excerptSha256:'ce7cf0c5665c670b2f1967c1346f3ed9f619bfa47d554efed29705b7d59be954'},
  {field:'count',start:10412,end:10822,excerptSha256:'81acd396fb555c7e7bdfe91bb94f05b618d251092844ef76ee4e0c731b1851fa'},
  {field:'page',start:10843,end:11249,excerptSha256:'96c81a297cafaf19976efecef1dc7e1054aaaa0a823ff893cfa4cb9d97c59249'}]},
];
const IDS=['model-snapshot','synthetic-searches','error-and-empty'];
const CHECKS=[['metadata','items','nestedPreserved','independent','immutable'],['keywordPage','aroundPage','paths','options','noQueryCredential'],['errorIsNull','emptyIsPage','missingPageIsNull']];
const fail=x=>{throw Error(x);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const p=path.resolve(root,file);if(!fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const b=fs.readFileSync(p);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail(`hash mismatch: ${file}`);return b;
}
function sources(root,manifest,current){
 const review=JSON.parse(load(root,REVIEW.file,REVIEW.sha256));
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||!same(review.sdkMethods,METHODS)||!same(review.references,REFS))fail('review binding');
 for(const [f,d] of FILES){if(!review.files.some(x=>x.file===f&&x.sha256===d))fail('review input missing');load(root,f,d);if(f.startsWith('lib/')?current.libFingerprint.files[f]!==d:!current.inputs.some(x=>x.file===f&&x.sha256===d))fail('input mismatch');}
 for(const file of ['example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart']){const source=fs.readFileSync(path.join(root,file),'utf8');if(!source.includes("import 'tdata_poi_page_contracts.dart';")||!source.includes('await runTDataPoiPageContracts('))fail('helper not connected');}
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 for(const m of METHODS)if(!sdk.slice(m.start,m.end).startsWith(`A.prototype.${m.name}=function`)||sha(sdk.slice(m.start,m.end))!==m.excerptSha256)fail('SDK method mismatch');
 if(!same(review.sdkJsonResponse,{start:988203,end:988249,excerptSha256:'09b132b00aee035c83f5afe9e5a25350118c5aaf507e1ad58fd031b76d6e6197',behavior:'stores parsed JSON response on _responseData'})||sha(sdk.slice(988203,988249))!==review.sdkJsonResponse.excerptSha256)fail('SDK response mismatch');
 for(const ref of REFS){if(!manifest.sources.some(s=>s.kind==='reference'&&s.sha256===ref.sha256))fail('reference missing');const text=load(root,`tool/sdk_audit/.cache/sources/${ref.sha256}`,ref.sha256).toString('utf8');for(const row of ref.rows)if(sha(text.slice(row.start,row.end))!==row.excerptSha256||!text.slice(row.start,row.end).includes('>'+row.field+'<'))fail('reference span mismatch');}
}
function validate(rows){
 if(rows.length!==IDS.length)fail('row count');
 for(let i=0;i<IDS.length;i++){const r=rows[i].data;if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==IDS[i]||r.status!=='observed'||r.scope!=='synthetic-http-client-no-network'||!keys(r.checks,CHECKS[i])||Object.values(r.checks).some(x=>x!==true))fail('invalid observation');}
}
/** Synthetic HTTP observations only, with no contract status promotion. */
export function collectTDataPoiPageObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
  const ev=runtime?.platformEvidence;if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');sources(root,manifest,current);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'synthetic-http-client-no-network',review:REVIEW,platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n');const run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,'TDATA POI PAGE RESULT:');if(!same(rows.map(x=>x.data),rec.tdataPoiPageResults))fail('record/log mismatch');validate(rows);
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:'tdata-poi-page-observations-rejected',reason:String(error.message)}]};}
}
