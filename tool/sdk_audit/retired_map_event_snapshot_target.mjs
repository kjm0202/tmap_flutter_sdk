import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {currentNativeAdapterEvidence} from './native_adapter_current_scope.mjs';
import {verifiedNativeAdapterArchive} from './legacy_native_adapter_archive.mjs';
import {readTar} from './release_rest_named_adapters.mjs';

const CODE='map-event-snapshot-observations-rejected',REASON='platform evidence unavailable';
const COLLECTOR='tool/sdk_audit/map_event_snapshot_verification.mjs',COLLECTOR_SHA='d276e66fc827e7a0b075c507427894fbb7994d0454ac8d1a6a3beced6c035075';
const OLD_BASELINE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const RELEASE='tool/sdk_audit/fixtures/actual-pub-0.1.1.tar.gz',RELEASE_SHA='dae54a154deb0b979e27c18d7d49d00faedd93bc8dfff8c732f11438a7fbb056';
const RELEASE_INDEX='docs/sdk-audit/checkpoints/2026-11-19/public-331-real-scenarios.json.gz';
// Backup Git blobs of the unshipped bridge, fixture and native evidence the collector binds.
const RETIRED={'lib/src/js/js_map_event_snapshots.dart':'fe834e5994501c1477ff9fe7025555118b267a86',
 'example/integration_test/map_event_snapshot_contracts.dart':'9ad99460c5b84f03526ed97b3460bae325509fad',
 'docs/sdk-audit/reviews/event-snapshot-native-evidence.json':'0aac75576e11a7cd98e697c297efa3d9a31f75a1'};
const ALSO_ABSENT=['docs/sdk-audit/reviews/event-snapshot-native-probe.mjs','lib/src/models/map_event_snapshot.dart'];
const PATH_LITERALS=[...Object.keys(RETIRED),'example/integration_test/live_map_test.dart','example/integration_test/web_live_probe.dart'].sort();
const SYMBOLS=/MapEventSnapshot|setTmapMapEventSnapshots|\bonMapEvent\b/;
const NAMED=['TMap.onMapTap','TMap.onMapDoubleTap','TMap.onMapLongTap',
 'TMap.onDragChangeCallback','TMap.onZoomChangeCallback'];
const BOOTSTRAP_CORE='bootstrap-cdn-versioned-core';
const fail=x=>{throw new Error(x);};
function pinned(root,file,digest){const b=fs.readFileSync(path.join(root,file));if(sha(b)!==digest)fail('digest: '+file);return b;}
function libFiles(root){const out=[];(function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.dart_tool','.cache'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile())out.push(path.relative(root,p));}})(path.join(root,'lib'));return out.sort();}

function evidence({manifest,runtime,dart,libFingerprint,root}){
 if(runtime?.platformEvidence!==undefined)fail('platform evidence supplied');
 const current=currentNativeAdapterEvidence({manifest,runtime,dart,libFingerprint,root});if(!current)fail('current release scope');
 const script=runtime.networkScripts[0];
 const sources=manifest.sources.filter(s=>s.url===script.url);
 if(sources.length!==1||sources[0].kind!==BOOTSTRAP_CORE||sources[0].role!==BOOTSTRAP_CORE||
  sources[0].sha256!==script.sha256||sources[0].bytes!==script.bytes||script.status!==200)fail('bootstrap core identity');
 const archive=verifiedNativeAdapterArchive(root);if(!archive)fail('archived receipt');const {prior}=archive;
 if(prior.oldBaseline!==OLD_BASELINE||prior.baselineId!==manifest.id||prior.coreSha256!==current.coreSha256||prior.publishedArchiveSha256!==RELEASE_SHA)fail('receipt identity');
 const originals=prior.issues.filter(i=>i.code===CODE);
 if(originals.length!==1)fail('original count');const o=originals[0];
 if(o.reportedReason!==REASON||o.file!==COLLECTOR||o.fileSha256!==COLLECTOR_SHA||!same(Object.keys(o.pathLiteralLineNumbers??{}).sort(),PATH_LITERALS))fail('original binding');
 for(const [file,blob] of Object.entries(RETIRED))if(!same(prior.sourceFiles[file],{publishedPackage:null,testedGitBlob:null,backupGitBlob:blob}))fail('archived source: '+file);
 pinned(root,COLLECTOR,COLLECTOR_SHA);
 const release=readTar(zlib.gunzipSync(pinned(root,RELEASE,RELEASE_SHA))),dartFiles=Object.keys(release).filter(f=>/^lib\/.*\.dart$/.test(f));
 if(!release['lib/tmap_flutter_sdk.dart']||!release['lib/src/tmap.dart'])fail('release archive contents');
 for(const f of [...Object.keys(RETIRED),...ALSO_ABSENT])if(release[f])fail('released retired file: '+f);
 for(const f of dartFiles)if(SYMBOLS.test(release[f].toString('utf8')))fail('released symbol: '+f);
 const index=JSON.parse(zlib.gunzipSync(pinned(root,RELEASE_INDEX,current.releaseIndexSha256)));
 if(index.rows?.length!==331||index.rows.some(r=>SYMBOLS.test(r.id)))fail('release public list');
 if(dart.rows.some(r=>SYMBOLS.test(r.id)))fail('current public symbol');
 for(const name of NAMED){
  const field=name.slice('TMap.'.length);
  if(!index.rows.some(r=>r.id===name)||!dart.rows.some(r=>r.id===name&&r.kind==='field'&&r.file==='lib/src/tmap.dart')||
   !new RegExp(`\\bfinal\\s+\\w+\\?\\s+${field}\\s*;`).test(release['lib/src/tmap.dart'].toString('utf8')))fail('named callback: '+name);
 }
 const files=libFingerprint?.files??{};
 if(sha(JSON.stringify(files))!==libFingerprint.sha256||!same(Object.keys(files).sort(),libFiles(root)))fail('current lib set');
 for(const [file,digest] of Object.entries(files))if(SYMBOLS.test(pinned(root,file,digest).toString('utf8')))fail('current symbol: '+file);
 for(const f of [...Object.keys(RETIRED),...ALSO_ABSENT])if(Object.hasOwn(files,f)||fs.existsSync(path.join(root,f)))fail('restored retired file: '+f);
 return {...current,bootstrapCore:{url:sources[0].url,role:sources[0].role,sdkSha256:script.sha256,
  verifiedBootstrapDigest:runtime.verifiedBootstrapDigest},collector:{path:COLLECTOR,sha256:COLLECTOR_SHA},backupCommit:prior.backupCommit,retiredSourceBlobs:RETIRED,
  releaseArchive:{path:RELEASE,sha256:RELEASE_SHA,dartFiles:dartFiles.length},currentLibFingerprintSha256:libFingerprint.sha256,currentNamedCallbacks:NAMED};
}

/** Retires only the exact original snapshot receipt; no contract, row or Map.on/off group changes. */
export function reviewRetiredMapEventSnapshotTarget({issues,manifest,runtime,dart,libFingerprint,root=ROOT}){
 const targets=issues.filter(i=>i.code===CODE);
 if(targets.length!==1||!same(targets[0],{code:CODE,reason:REASON}))return {open:issues,resolved:[]};
 let proof;try{proof=evidence({manifest,runtime,dart,libFingerprint,root});}catch{return {open:issues,resolved:[]};}
 return {open:issues.filter(i=>i!==targets[0]),resolved:[{original:targets[0],status:'REVIEWED_OBSOLETE_AUDIT_TARGET',
  scope:'Only the historical MapEventSnapshot bridge, fixture and native evidence receipt were retired. Verification remains open for official Tmapv3.Map#on/off, Vsm.Event, and map-event relations. All inventory statuses are preserved.',
  rationale:'The collector is bound to an unshipped MapEventSnapshot bridge and fixture absent from the 0.1.1 archive, the 331-row release list and current lib; current TMap exposes named callbacks instead.',
  evidence:proof}]};
}
