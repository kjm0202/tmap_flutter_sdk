import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT, sha} from './common.mjs';
import {capturePlatformInputs, validatePlatformRunManifest} from './platform_run_binding.mjs';

// Run-bound observations only. No contract status is modified by this module.
const baselineId = '82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const sdkSha = '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const helper = {file:'example/integration_test/tdata_geofencing_contracts.dart', sha256:'1ad8b3b865b16ac1fb8dc5d40fe4a9a3f50381acc16270e33a18932a16654c33'};
const review = {file:'docs/sdk-audit/reviews/tdata-geofencing-source-review.json', sha256:'22be350036b6e4a3714cece4188b8b14c1c3b71fd8c060a222654d31cbead5d8'};
const sdkFile = `tool/sdk_audit/.cache/sources/${sdkSha}`;
const sourceMethods = [
  {name:'getGeofencingFromSearchJson',start:1009082,end:1009996,offsetUnit:'UTF-16 code units; end exclusive',excerptSha256:'2a60e385a05e363494d177ccaa3409f2088298284f1f025e0ecea202b40425b5'},
  {name:'getGeofencingFromIdJson',start:1010752,end:1011537,offsetUnit:'UTF-16 code units; end exclusive',excerptSha256:'dd6777bc5f9edf594211374d50e953d3d9ea5a8a4b42dbd624e157e317621a05'},
];
const references = [
  'c8f6b3c31fe4c6752e4880bf2ddf3a6f65f83f8688767c107a0e4e83c9341fd8',
  '617004fe41eb7c3349b086d1e230d3d6782183f6e4561ace2772764e9f6a2689',
];
const contract = method => `Tmapv3.extension.TData#${method}`;
const marker = 'TDATA GEOFENCING RESULT:';
const platforms = ['android','ios','web'];
const cases = ['keyword-search','coordinate-search','id-detail'];

function verifyReferences(root, manifest) {
  const load = (file, digest) => {
    const bytes = fs.readFileSync(path.join(root,file));
    if (sha(bytes) !== digest) throw Error(`reference hash mismatch: ${file}`);
    return bytes;
  };
  load(helper.file, helper.sha256);
  const document = JSON.parse(load(review.file, review.sha256));
  if (document.baselineId !== baselineId || document.status !== 'SOURCE_REVIEW_ONLY_U111_OPEN' ||
      document.sdk?.file !== sdkFile || document.sdk.sha256 !== sdkSha || !same(document.sdk.methods,sourceMethods))
    throw Error('source review binding mismatch');
  const sdk = load(sdkFile, sdkSha).toString('utf8');
  for (const entry of sourceMethods) {
    const excerpt = sdk.slice(entry.start,entry.end);
    if (!excerpt.startsWith(`A.prototype.${entry.name}=function`) || sha(excerpt) !== entry.excerptSha256)
      throw Error(`SDK source span mismatch: ${entry.name}`);
  }
  if (!Array.isArray(document.references) || document.references.length !== references.length ||
      !same(document.references.map(x=>x.sha256),references)) throw Error('REST reference review mismatch');
  for (const [i,digest] of references.entries()) {
    const item = document.references[i], file = `tool/sdk_audit/.cache/sources/${digest}`;
    if (item.file !== file || !manifest.sources.some(x=>x.kind==='reference' && x.sha256===digest))
      throw Error('REST reference manifest mismatch');
    load(file,digest);
  }
}

function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length !== cases.length) throw Error('geofencing case count');
  const byCase = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !cases.includes(row.case) || byCase.has(row.case))
      throw Error('unknown or duplicate geofencing case');
    if (row.status !== 'observed' || row.jsonKind !== 'object' || row.reason !== undefined ||
        !Array.isArray(row.responseKeys) || row.responseKeys.some(x=>typeof x!=='string') ||
        new Set(row.responseKeys).size !== row.responseKeys.length) throw Error(`invalid ${row.case} response observation`);
    byCase.set(row.case,row);
  }
  const keyword=byCase.get('keyword-search'), coordinate=byCase.get('coordinate-search'), detail=byCase.get('id-detail');
  if (!keyword.responseKeys.includes('searchRegionsInfo') || keyword.requestedSearchType !== 'KEYWORD' ||
      !coordinate.responseKeys.includes('searchRegionsInfo') || coordinate.requestedSearchType !== 'COORDINATES' ||
      coordinate.requestedReqCoordType !== 'WGS84GEO') throw Error('search observation mismatch');
  if (!detail.responseKeys.includes('type') || !detail.responseKeys.includes('features') ||
      !Number.isSafeInteger(detail.featuresCount) || detail.featuresCount < 1 || detail.detailIdFromSearch !== true)
    throw Error('detail observation mismatch');
  return byCase;
}

/** Collect bounded platform observations. Never promotes U111 or any contract. */
export function collectTDataGeofencingObservations({runtime, manifest, libFingerprint, root=ROOT}) {
  try {
    const fail = message => { throw Error(message); };
    if (manifest?.id !== baselineId || !Array.isArray(manifest.sources) ||
        !manifest.sources.some(x=>x.kind==='sdk' && x.sha256===sdkSha)) fail('baseline or SDK mismatch');
    verifyReferences(root,manifest);
    const evidence=runtime?.platformEvidence;
    if (!evidence || !same(evidence.libFingerprint,libFingerprint)) fail('platform evidence or library fingerprint mismatch');
    const current=capturePlatformInputs(root);
    if (!same(current,{libFingerprint,inputs:evidence.inputs}) ||
        !current.inputs.some(x=>x.file===helper.file && x.sha256===helper.sha256)) fail('current inputs or helper mismatch');
    const records=Array.isArray(evidence.records)?evidence.records.filter(x=>x.kind==='integration'):[];
    if (records.length!==3 || platforms.some(p=>records.filter(r=>r.platform===p).length!==1))
      fail('missing or duplicate integration records');
    const common = () => ({status:'observed-not-verified',baselineId,expectedSdkSha256:sdkSha,
      sdkDigestMeasurement:'not measured by helper',libFingerprintSha256:libFingerprint.sha256,
      helper,sourceReview:review,platforms:{},limitations:[
        'Requested search type and coordinate type record helper intent, not captured HTTP query bytes.',
        'Only JSON object response shape and the helper-selected search-to-detail flow are observed.',
        'No SDK response equality, scalar JSON, callback, progress, mutation, XML or full lifecycle parity is established.',
        'Device SDK bytes are not measured; bounded observations do not promote contract status.'
      ]});
    const output={
      [contract('getGeofencingFromSearchJson')]:common(),
      [contract('getGeofencingFromIdJson')]:common(),
    };
    for (const rec of records) {
      const expectedLog=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
      if (rec.passed!==true || rec.file!==expectedLog || rec.run?.file!==rec.file+'.run.json') fail('invalid integration or run record');
      const load=(file,digest)=>{
        const bytes=fs.readFileSync(path.join(root,file));
        if (!/^[a-f0-9]{64}$/.test(digest||'') || sha(bytes)!==digest) fail('log or run digest mismatch');
        return bytes.toString('utf8');
      };
      const log=load(rec.file,rec.sha256), lines=log.split('\n');
      const run=JSON.parse(load(rec.run.file,rec.run.sha256));
      if (run.sanitizedLogSha256!==rec.sha256 || run.exitCode!==0 || run.signal!==null) fail('invalid successful run binding');
      const {sanitizedLogSha256,...rawRun}=run;
      // The recorder hashes private raw logs; only sanitized bytes are available here.
      validatePlatformRunManifest(rawRun,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
      if (!platformLogPassed(log.split('\n'),rec.platform)) fail('integration completion marker');
      const found=parsePlatformMarkerRows(lines,marker);
      if (!same(found.map(x=>x.data),rec.tdataGeofencingResults)) fail('log/record geofencing observations mismatch');
      validateRows(found.map(x=>x.data));
      const refs=found.map(item=>({observation:item.data,ref:{file:rec.file,sha256:rec.sha256,line:item.line,
        logLineSha256:sha(lines[item.line-1]),observationSha256:sha(JSON.stringify(item.data))}}));
      for (const [method,selected] of [['getGeofencingFromSearchJson',['keyword-search','coordinate-search']],['getGeofencingFromIdJson',['id-detail']]]) {
        output[contract(method)].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,
          cases:refs.filter(x=>selected.includes(x.observation.case))};
      }
    }
    return {byContract:output,issues:[]};
  } catch (error) {
    return {byContract:{},issues:[{code:'tdata-geofencing-observations-rejected',reason:String(error.message)}]};
  }
}
