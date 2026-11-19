import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';
import {observeTDataResponseCallbacks} from './tdata_response_callback_source_probe.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER=['example/integration_test/tdata_response_callback_contracts.dart','139d9294189de841d17e510c1e3b7e6a7a8c0e50c935d32b229074d96844b469'];
const REVIEW=['docs/sdk-audit/reviews/tdata-response-callback-source-review.json',"aca37af5fb1f0ddd1baf726e83b15ae33982da3f453e36d3458bfb048d144343"];
const fail=x=>{throw Error(x);};
const keys=(x,list)=>x&&typeof x==='object'&&!Array.isArray(x)&&same(Object.keys(x).sort(),[...list].sort());
function read(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const f=path.resolve(root,file);if(!fs.realpathSync(f).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const b=fs.readFileSync(f);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('evidence digest: '+file);return b.toString('utf8');
}
/** These checks cover bounded mock rows, not SDK runtime equivalence. */
export function compareTDataResponseCallbackRows(rows){
 if(!Array.isArray(rows)||rows.length!==2)fail('missing or duplicate callback observations');
 for(const [i,id,parser,checks] of [[0,'json-branches','none',['classification','headersBeforeChunks','uncached']],[1,'xml-first-child','local-browser-dom-parser',['classification']]]){
  const row=rows[i];if(!keys(row,['schemaVersion','id','scope','parser','status','checks'])||row.schemaVersion!==1||row.id!==id||row.scope!=='in-memory HTTP transport; no external request or SDK runtime'||row.parser!==parser||row.status!=='observed'||!keys(row.checks,checks)||!Object.values(row.checks).every(x=>x===true))fail('invalid callback case: '+id);
 }
 return true;
}
export function collectTDataResponseCallbackObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const ev=runtime?.platformEvidence;if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('platform fingerprint mismatch');const current=capturePlatformInputs(root);
  if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current inputs mismatch');
  const review=JSON.parse(read(root,...REVIEW));read(root,...HELPER);
  if(review.status!=='SOURCE_AND_MOCK_TESTED_LIVE_PENDING_OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!same(observeTDataResponseCallbacks(root),review.originalExecutableProbe))fail('pinned callback source mismatch');
  for(const e of review.files){read(root,e.file,e.sha256);if(e.file.startsWith('lib/')&&current.libFingerprint.files[e.file]!==e.sha256)fail('library source mismatch');}
  if(!review.files.some(e=>same(e,{file:HELPER[0],sha256:HELPER[1]}))||!current.inputs.some(e=>same(e,{file:HELPER[0],sha256:HELPER[1]})))fail('helper not bound to run');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('missing or duplicate platform runs');
  const out=Object.fromEntries(['getPOICategoryJson','getPOICategory'].map(name=>['Tmapv3.extension.TData#'+name,{status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER[0],sha256:HELPER[1]},sourceReview:{file:REVIEW[0],sha256:REVIEW[1]},scope:'Mock HTTP response classification and local XML parser, not a live request or SDK callback runtime.',limitations:['Source callbacks were separately executed in fake XHR and parser fixtures.','Native XHR readyState, responseXML, DOM identity and full SDK callback behavior remain unverified.','HTTP Future state and callback disposition are distinct; no API status is promoted.'],platforms:{}}]));
  for(const rec of records){
   const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const log=read(root,rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(read(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run binding mismatch');const {sanitizedLogSha256,...raw}=run;
   validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});const complete=parsePlatformTextResults(lines);
   if(rec.platform==='web'?!complete.webPassed:!complete.mobilePassed)fail('successful completion missing');
   const found=[];lines.forEach((line,i)=>{const row=decodePlatformLogLine(line);if(row?.kind==='json'&&row.field==='tdataResponseCallbackResults')found.push({data:JSON.parse(row.payload),line:i+1});});
   if(!same(found.map(x=>x.data),rec.tdataResponseCallbackResults))fail('record/log mismatch');compareTDataResponseCallbackRows(rec.tdataResponseCallbackResults);
   for(const [id,index] of [['Tmapv3.extension.TData#getPOICategoryJson',0],['Tmapv3.extension.TData#getPOICategory',1]]){const row=found[index];out[id].platforms[rec.platform]={observation:row.data,log:{file:rec.file,sha256:rec.sha256,line:row.line,logLineSha256:sha(lines[row.line-1]),observationSha256:sha(JSON.stringify(row.data))},run:rec.run};}
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'tdata-response-callback-observations-rejected',reason:String(error.message)}]};}
}
