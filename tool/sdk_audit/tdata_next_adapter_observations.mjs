import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {parsePlatformMarkerRows,platformLogPassed,platformJsonMarkers} from './platform_log_markers.mjs';
import {observeTDataResponseFailure} from './tdata_response_failure_source_probe.mjs';

const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const IMPACT={file:'docs/sdk-audit/reviews/tdata-next-combined-source-impact.json',sha256:'a790c5beee88094f37f1a75ea3d24aaa7ce529b62f650202b72a91d760bff797'};
const RAW='lib/src/services/tdata_raw_service.dart';
const SOURCES={
 'lib/src/services/tdata_protocol.dart':'cab473e185379c1ec1723ff74a332b2609b0ad79cfd88a3363efee5e855eee53',
 [RAW]:'09b3eaf30b4851aba352df7506f41b9c13e17846e27b5e096f97970dff4b024e',
 'lib/src/services/tdata_request_session.dart':'d3f37029250281de5a7ec39014c0fe25d88d56b5dab31fc80200fd36d49f45ac',
 'lib/src/services/tdata_service.dart':'1edc5214885718d4e32b980cfecfc7f04b9b29a8f3e94789f02fa9168cce0c5e',
};
const GROUPS={
 responseFailure:{field:'tdataResponseFailureResults',marker:'TDATA RESPONSE FAILURE RESULT:',review:'docs/sdk-audit/reviews/tdata-response-failure-boundary-review.json',reviewSha:'24bdc8c11122dcc23ec1a68d5f7e78a630f39ba59382470a4ec54e356bb2db7b',helper:'example/integration_test/tdata_response_failure_contracts.dart',cases:{'wrapper-failure':['failedRejected','errorRejected','rawRetained'],'payload-error':['poiRejected','autoRejected','routeRejected','rawRetained'],'success':['poiPreserved','autoPreserved','routePreserved'],'http200-object-error':['poiRejected','aroundRejected','autoRejected','routeRejected']}},
 rawQueryGuard:{field:'tdataRawQueryGuardResults',marker:'TDATA RAW QUERY GUARD RESULT:',review:'docs/sdk-audit/reviews/tdata-raw-query-guard-review.json',reviewSha:'1ce68611a0d9a98c64830e5b4fc332749507374ade0aab59cf321cbefdd3a3ca',helper:'example/integration_test/tdata_raw_query_guard_contracts.dart',cases:{'changing-map':['rejected','noSend'],'ordinary-map':['requestAndResponse','oneSend']}},
 fixedSnapshotGuard:{field:'tdataFixedSnapshotGuardResults',marker:'TDATA FIXED SNAPSHOT GUARD RESULT:',review:'docs/sdk-audit/reviews/tdata-fixed-snapshot-guard-review.json',reviewSha:'d9fe0906ec24ecdf43efd8eef653381053f12b4535347aaf5de793afb7c4b767',helper:'example/integration_test/tdata_fixed_snapshot_guard_contracts.dart',cases:{'reserved-snapshot':['allRejected','noSend'],'stable-snapshot':['originalUsed','oneSend','success']}},
 responseClose:{field:'tdataResponseCloseResults',marker:'TDATA RESPONSE CLOSE RESULT:',review:'docs/sdk-audit/reviews/tdata-response-close-review.json',reviewSha:'6f45b8f222d97cbfd333b3504e593477bf596dfeb4a1c6afb5513ffa7c919e72',helper:'example/integration_test/tdata_response_close_contracts.dart',cases:{'raw-complete':['statusAndBytes','headersAndComplete','closeOnce'],'raw-partial':['statusAndBytes','errorRetained','closeOnce'],'raw-send-error':['originalError','closeOnce'],'typed-get-post':['getRetained','postRetained','closeOnceEach']}},
};
const fail=x=>{throw Error(x)};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
function load(root,file,digest){
 if(typeof file!=='string'||path.isAbsolute(file)||!path.resolve(root,file).startsWith(path.resolve(root)+path.sep))fail('invalid evidence path');
 const full=path.resolve(root,file);if(!fs.realpathSync(full).startsWith(fs.realpathSync(root)+path.sep))fail('evidence path escapes root');
 const bytes=fs.readFileSync(full);if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(bytes)!==digest)fail(`hash mismatch: ${file}`);return bytes;
}
const replaceOnce=(text,after,before)=>{if(text.split(after).length!==2)fail('combined source hunk mismatch');return text.replace(after,before)};
const CLOSE_AFTER=`    } finally {\n      try {\n        client.close();\n      } catch (_) {\n        // Do not replace a response or original transport error with a\n        // custom client's best-effort cleanup failure.\n      }\n    }`;
const CLOSE_BEFORE=`    } finally {\n      client.close();\n    }`;
const QUERY_AFTER=`    final params = <String, String>{};\n    for (final entry in parameters.entries) {\n      // A custom Map can change between the initial keys check and this pass.\n      // Check the actual key used to construct the URL as well.\n      if (entry.key.toLowerCase() == 'appkey') {\n        throw ArgumentError('AppKey is supplied by AuthRepository');\n      }\n      final value = entry.value;\n      if (value != null) params[entry.key] = value.toString();\n    }\n    params['version'] = '1';\n    params['format'] = format.name;`;
const QUERY_BEFORE=`    final params = <String, String>{\n      for (final e in parameters.entries)\n        if (e.value != null) e.key: e.value.toString(),\n      'version': '1',\n      'format': format.name,\n    };`;

/** Verify immutable sources and the exact coexistence of the two raw changes. */
export function verifyTDataNextAdapterSources({root=ROOT,manifest,current}){
 if(manifest?.id!==BASE||!Array.isArray(manifest.sources)||!manifest.sources.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline mismatch');
 const impact=JSON.parse(load(root,IMPACT.file,IMPACT.sha256));
 if(impact.status!=='SOURCE_REVIEW_ONLY'||impact.baselineId!==BASE||impact.sdkSha256!==SDK)fail('impact binding');
 for(const [file,digest] of Object.entries(SOURCES)){load(root,file,digest);if(current?.libFingerprint?.files?.[file]!==digest)fail('current library source mismatch');}
 if(!same(impact.files,Object.entries(SOURCES).map(([file,sha256])=>({file,sha256}))))fail('impact final sources');
 const raw=fs.readFileSync(path.join(root,RAW),'utf8');
 const guardOnly=sha(replaceOnce(raw,CLOSE_AFTER,CLOSE_BEFORE));
 const closeOnly=sha(replaceOnce(raw,QUERY_AFTER,QUERY_BEFORE));
 if(guardOnly!==impact.rawComposition?.guardOnlySha256||closeOnly!==impact.rawComposition?.closeOnlySha256||impact.rawComposition?.finalSha256!==SOURCES[RAW])fail('raw composition');
 const historical=[];let responseReview;
 for(const [name,g] of Object.entries(GROUPS)){
  const review=JSON.parse(load(root,g.review,g.reviewSha));historical.push({file:g.review,sha256:g.reviewSha});
  if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.helper?.field!==g.field||review.helper?.marker!==g.marker||review.helper?.file!==g.helper)fail('source review binding');
  if(!current?.inputs?.some(x=>x.file===g.helper&&x.sha256===review.files[g.helper]))fail('helper input mismatch');
  for(const [file,digest] of Object.entries(review.files)){
   if(file===RAW){const expected=name==='rawQueryGuard'?guardOnly:name==='responseClose'?closeOnly:null;if(digest!==expected)fail('historical raw source mismatch');}
   else load(root,file,digest);
  }
  if(name==='responseFailure')responseReview=review;
 }
 if(!same(impact.historicalReviews,historical))fail('impact reviews');
 const sdk=load(root,`tool/sdk_audit/.cache/sources/${SDK}`,SDK).toString('utf8');
 if(sha(sdk.slice(1002754,1003491))!=='ea3d45630769b3d7f526f389c7a621b5d1d8f582ffbac73ffc22376a51ff57a4')fail('SDK request span');
 if(sha(sdk.slice(988128,988441))!=='1b1119aac762273ac8b2fc96255531430435567006f1fd357f9d9ee1ab35e772'||!same(observeTDataResponseFailure(root),responseReview.sourceFixture))fail('SDK callback fixture');
 return true;
}
/** Validate fabricated or recorded rows without claiming they ran on devices. */
export function validateTDataNextAdapterRows(name,rows){
 const group=GROUPS[name];if(!group)fail('unknown observation group');
 const expected=Object.entries(group.cases);if(!Array.isArray(rows)||rows.length!==expected.length)fail('row count');
 for(let i=0;i<expected.length;i++){const [id,checks]=expected[i],r=rows[i];if(!keys(r,['schemaVersion','id','status','scope','checks'])||r.schemaVersion!==1||r.id!==id||r.status!=='observed'||r.scope!=='synthetic-http-client-no-network'||!keys(r.checks,checks)||Object.values(r.checks).some(x=>x!==true))fail('invalid observation');}
 return true;
}
function collect(name,{runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const g=GROUPS[name],ev=runtime?.platformEvidence;if(!g)fail('unknown observation group');if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library mismatch');
  const current=capturePlatformInputs(root);if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('input drift');verifyTDataNextAdapterSources({root,manifest,current});
  if(platformJsonMarkers[g.field]!==g.marker)fail('production marker registration pending');
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[];
  if(records.length!==3||['android','ios','web'].some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration records');
  const observations={scope:'synthetic-http-client-no-network',sourceImpact:IMPACT,review:{file:g.review,sha256:g.reviewSha},platforms:{}};
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid record');
   const log=load(root,rec.file,rec.sha256).toString('utf8'),lines=log.split('\n'),run=JSON.parse(load(root,rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('run status');
   const {sanitizedLogSha256,...rawRun}=run;validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
   if(!platformLogPassed(lines,rec.platform))fail('platform failed');
   const rows=parsePlatformMarkerRows(lines,g.marker);if(!same(rows.map(x=>x.data),rec[g.field]))fail('record/log mismatch');validateTDataNextAdapterRows(name,rows.map(x=>x.data));
   observations.platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,cases:rows.map(x=>({observation:x.data,ref:{file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))}}))};
  }
  return {observations,issues:[]};
 }catch(error){return {observations:{},issues:[{code:`tdata-next-${name}-observations-rejected`,reason:String(error.message)}]};}
}
export const collectTDataResponseFailureObservations=args=>collect('responseFailure',args);
export const collectTDataRawQueryGuardObservations=args=>collect('rawQueryGuard',args);
export const collectTDataFixedSnapshotGuardObservations=args=>collect('fixedSnapshotGuard',args);
export const collectTDataResponseCloseObservations=args=>collect('responseClose',args);
