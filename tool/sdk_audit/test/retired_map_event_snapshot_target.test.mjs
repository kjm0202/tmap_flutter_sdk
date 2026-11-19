import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {ROOT,fingerprint,sha} from '../common.mjs';
import {reviewRetiredMapEventSnapshotTarget as review} from '../retired_map_event_snapshot_target.mjs';

const SNAPSHOT={code:'map-event-snapshot-observations-rejected',reason:'platform evidence unavailable'};
const RELATION={code:'map-event-relation-source-rejected',reason:"ENOENT: no such file or directory, lstat '/checkout/docs/sdk-audit/reviews/map-event-relations-source-review.json'"};
const read=f=>JSON.parse(fs.readFileSync(f));
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/legacy_native_adapter_cases.json.gz',import.meta.url))));
const manifest=read(path.join(ROOT,'tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json'));
const libFingerprint=await fingerprint(path.join(ROOT,'lib'));
const input=()=>structuredClone({issues:[...fixture.issues,SNAPSHOT,RELATION],manifest,runtime:fixture.runtime,dart:fixture.dart,libFingerprint});

// Copies lib (walked as real files) and mirrors other trees through symlinks so
// single files can be replaced or restored.
function rootWith(files){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'retired-map-event-'));
 fs.cpSync(path.join(ROOT,'lib'),path.join(dir,'lib'),{recursive:true});
 function mirror(rel){const real=path.join(ROOT,rel),own=Object.keys(files).filter(f=>f===rel||f.startsWith(rel+'/'));
  if(!own.length)return fs.symlinkSync(real,path.join(dir,rel));
  if(own.includes(rel))return;
  fs.mkdirSync(path.join(dir,rel),{recursive:true});
  for(const name of new Set([...(fs.existsSync(real)?fs.readdirSync(real):[]),...own.map(f=>f.slice(rel.length+1).split('/')[0])]))mirror(path.join(rel,name));}
 for(const name of ['tool','docs','example'])mirror(name);
 for(const [file,bytes] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),bytes);}
 return dir;
}

test('retires only the exact original snapshot receipt', () => {
 const data=input(),before=structuredClone(data),result=review(data);
 assert.deepEqual(data,before);
 assert.deepEqual(result.resolved.map(r=>r.original),[SNAPSHOT]);
 assert.deepEqual(result.open,[...fixture.issues,RELATION]);
 const [r]=result.resolved;
 assert.equal(r.status,'REVIEWED_OBSOLETE_AUDIT_TARGET');
 assert.match(r.scope,/^Only the historical MapEventSnapshot bridge, fixture and native evidence receipt were retired\./);
 assert.match(r.scope,/Verification remains open for official Tmapv3\.Map#on\/off, Vsm\.Event, and map-event relations\./);
 assert.match(r.scope,/All inventory statuses are preserved\.$/);
 assert.equal(r.evidence.backupCommit,'100fbc26b2dae8b410e64fc362344021ec944f08');
 assert.equal(r.evidence.releaseArchive.sha256,'dae54a154deb0b979e27c18d7d49d00faedd93bc8dfff8c732f11438a7fbb056');
 assert.equal(r.evidence.releaseIndexSha256,'a27e8154174fee1d2011dd881a06be647c36cdcb01316e38745e0562a27bc31d');
 assert.equal(r.evidence.retiredSourceBlobs['lib/src/js/js_map_event_snapshots.dart'],'fe834e5994501c1477ff9fe7025555118b267a86');
 assert.deepEqual(r.evidence.currentNamedCallbacks,['TMap.onMapTap','TMap.onMapDoubleTap','TMap.onMapLongTap',
  'TMap.onDragChangeCallback','TMap.onZoomChangeCallback']);
 assert.equal(r.evidence.currentLibFingerprintSha256,libFingerprint.sha256);
 assert.deepEqual(r.evidence.bootstrapCore,{url:data.runtime.networkScripts[0].url,role:'bootstrap-cdn-versioned-core',
  sdkSha256:data.runtime.networkScripts[0].sha256,verifiedBootstrapDigest:data.runtime.verifiedBootstrapDigest});
 assert.equal(Object.hasOwn(r,'byContract'),false);
});

test('fails closed on changed originals, runtime, manifest or current symbols', () => {
 const cases={
  otherReason:x=>{x.issues[x.issues.length-2]={...SNAPSHOT,reason:'baseline or SDK mismatch'};},
  extraField:x=>{x.issues[x.issues.length-2]={...SNAPSHOT,file:'x'};},
  duplicate:x=>{x.issues.push({...SNAPSHOT});},
  platformEvidence:x=>{x.runtime.platformEvidence={records:[]};},
  auth:x=>{x.runtime.auth='failed';},
  bootstrap:x=>{x.runtime.verifiedBootstrapDigest='0'.repeat(64);},
  twoScripts:x=>{x.runtime.networkScripts.push({...x.runtime.networkScripts[0]});},
  scriptBytes:x=>{x.runtime.networkScripts[0].bytes-=1;},
  scriptHash:x=>{x.runtime.networkScripts[0].sha256='0'.repeat(64);},
  scriptStatus:x=>{x.runtime.networkScripts[0].status=404;},
  fixedWebCore:x=>{x.runtime.networkScripts[0].url=manifest.sources.find(s=>s.role==='flutter-web-fixed-cdn-versioned-core').url;},
  arbitraryCdn:x=>{x.runtime.networkScripts[0].url='https://example.com/tmapjs3.min.js?version=20231206';},
  duplicateManifestEntry:x=>{x.manifest.sources.push({...x.manifest.sources.find(s=>s.url===x.runtime.networkScripts[0].url)});},
  wrongManifestKind:x=>{x.manifest.sources.find(s=>s.url===x.runtime.networkScripts[0].url).kind='sdk';},
  wrongManifestRole:x=>{x.manifest.sources.find(s=>s.url===x.runtime.networkScripts[0].url).role='flutter-web-fixed-cdn-versioned-core';},
  manifest:x=>{x.manifest.sources.pop();},
  restoredType:x=>{x.dart.rows.push({id:'MapEventSnapshot',kind:'class',file:'lib/src/models/map_event_snapshot.dart'});},
  restoredCallback:x=>{x.dart.rows.push({id:'TMap.onMapEvent',kind:'field',file:'lib/src/tmap.dart'});},
  namedCallbackGone:x=>{x.dart.rows=x.dart.rows.filter(r=>r.id!=='TMap.onMapTap');},
  dragCallbackGone:x=>{x.dart.rows=x.dart.rows.filter(r=>r.id!=='TMap.onDragChangeCallback');},
  zoomCallbackGone:x=>{x.dart.rows=x.dart.rows.filter(r=>r.id!=='TMap.onZoomChangeCallback');},
  libBridge:x=>{x.libFingerprint.files['lib/src/js/js_map_event_snapshots.dart']='0'.repeat(64);},
  libDigest:x=>{x.libFingerprint.sha256='0'.repeat(64);},
  staleFileDigest:x=>{x.libFingerprint.files['lib/src/tmap.dart']='0'.repeat(64);x.libFingerprint.sha256=sha(JSON.stringify(x.libFingerprint.files));},
 };
 for(const [name,change] of Object.entries(cases)){
  const data=input();change(data);const result=review(data);
  assert.deepEqual(result.resolved,[],name);assert.deepEqual(result.open,data.issues,name);
 }
});

test('accepts each pinned rotating bootstrap URL', () => {
 const sources=manifest.sources.filter(s=>s.kind==='bootstrap-cdn-versioned-core'&&s.role==='bootstrap-cdn-versioned-core');
 assert.equal(sources.length,3);
 for(const source of sources){
  const data=input();data.runtime.networkScripts[0].url=source.url;
  const result=review(data);
  assert.equal(result.resolved.length,1,source.url);
  assert.equal(result.resolved[0].evidence.bootstrapCore.url,source.url);
 }
});

test('fails closed on restored retired files and changed pinned bytes', () => {
 const files={
  restoredFixture:{'example/integration_test/map_event_snapshot_contracts.dart':'// restored\n'},
  restoredModel:{'lib/src/models/map_event_snapshot.dart':'class MapEventSnapshot {}\n'},
  changedLib:{'lib/src/tmap.dart':fs.readFileSync(path.join(ROOT,'lib/src/tmap.dart'),'utf8')+'\n'},
  changedCollector:{'tool/sdk_audit/map_event_snapshot_verification.mjs':fs.readFileSync(path.join(ROOT,'tool/sdk_audit/map_event_snapshot_verification.mjs'),'utf8')+'\n'},
  changedRelease:{'tool/sdk_audit/fixtures/actual-pub-0.1.1.tar.gz':Buffer.alloc(0)},
 };
 for(const [name,override] of Object.entries(files)){
  const root=rootWith(override),data=input();
  // A restored lib file gets a self-consistent fingerprint so only its symbol rejects.
  for(const [file,bytes] of Object.entries(override))if(file.startsWith('lib/')&&name!=='changedLib')data.libFingerprint.files[file]=sha(bytes);
  data.libFingerprint.sha256=sha(JSON.stringify(data.libFingerprint.files));
  try{const result=review({...data,root});assert.deepEqual(result.resolved,[],name);assert.deepEqual(result.open,data.issues,name);}
  finally{fs.rmSync(root,{recursive:true,force:true});}
 }
 const root=rootWith({});
 try{assert.equal(review({...input(),root}).resolved.length,1);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

// A newer report may have already resolved this original. Never replay it twice.
function reportIssues(report){
 const issues=[...report.issues];
 if(!issues.some(i=>i.code===SNAPSHOT.code)){
  issues.push(...(report.resolvedIssues??[]).map(r=>r.original).filter(i=>i?.code===SNAPSHOT.code));
 }
 return issues;
}

test('replays an already resolved original only when it is not open', () => {
 const partner={code:'another-issue',reason:'pending'};
 assert.deepEqual(reportIssues({issues:[partner],resolvedIssues:[{original:SNAPSHOT}]}),[partner,SNAPSHOT]);
 assert.deepEqual(reportIssues({issues:[partner,SNAPSHOT],resolvedIssues:[{original:SNAPSHOT}]}),[partner,SNAPSHOT]);
 for(const report of [{issues:[partner],resolvedIssues:[{original:SNAPSHOT}]},
  {issues:[partner,SNAPSHOT],resolvedIssues:[{original:SNAPSHOT}]}]){
  const data=input();data.issues=reportIssues(report);
  assert.deepEqual(review(data).resolved.map(r=>r.original),[SNAPSHOT]);
  assert.deepEqual(review(data).open,[partner]);
 }
});

const raw=process.env.TMAP_AUDIT_RAW_OUT;
test('authenticated report keeps every other original open', () => {
 const report=raw?read(path.join(raw,'report.json')):{issues:[...fixture.issues,SNAPSHOT,RELATION],libFingerprint};
 const runtime=raw?read(path.join(raw,'runtime.json')):fixture.runtime;
 const dart=raw?read(path.join(raw,'dart.json')):fixture.dart;
 const issues=reportIssues(report);
 const result=review({issues,manifest,runtime,dart,libFingerprint:report.libFingerprint});
 assert.deepEqual(result.resolved.map(r=>r.original),[SNAPSHOT]);
 assert.deepEqual(result.open,issues.filter(i=>i.code!==SNAPSHOT.code));
});
