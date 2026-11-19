import fs from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ROOT,readJSON,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';

export async function validatePlatformEvidence(evidence, root=ROOT) {
  if (!evidence) return null;
  const current=capturePlatformInputs(root);
  if (!isDeepStrictEqual(evidence.libFingerprint,current.libFingerprint))
    throw Error('Platform evidence uses different Flutter sources; rerun device tests');
  if (evidence.bridgeFingerprint && current.bridgeFingerprint && !isDeepStrictEqual(evidence.bridgeFingerprint, current.bridgeFingerprint))
    throw Error('Platform evidence uses different bridge assets; rerun device tests');
  if (!isDeepStrictEqual(evidence.inputs,current.inputs))
    throw Error('Platform evidence/input changed: source/configuration snapshot');
  if (evidence.runBindingsVersion!==1)throw Error('Platform evidence requires per-run source and log bindings');
  for (const item of [...evidence.records, ...evidence.inputs]) {
    const file=path.resolve(root,item.file);
    if (!file.startsWith(root+path.sep) || sha(await fs.readFile(file)) !== item.sha256)
      throw Error('Platform evidence/input changed: '+item.file);
  }
  for(const record of evidence.records){
    if(record.run?.file!==record.file+'.run.json')throw Error('Platform run binding missing: '+record.file);
    const file=path.resolve(root,record.run.file);
    if(!file.startsWith(root+path.sep)||sha(await fs.readFile(file))!==record.run.sha256)
      throw Error('Platform run binding changed: '+record.file);
    const {sanitizedLogSha256,...run}=await readJSON(file);
    if(sanitizedLogSha256!==record.sha256)throw Error('Platform sanitized log binding changed: '+record.file);
    validatePlatformRunManifest(run,{platform:record.platform,kind:record.kind,inputs:current,rawLogSha256:run.rawLogSha256});
    const log=await fs.readFile(path.resolve(root,record.file),'utf8');
    const complete=record.platform==='web'?log.includes('LIVE RESULT: PASS')&&!log.includes('LIVE RESULT: FAIL'):log.includes('All tests passed!')&&!log.includes('Some tests failed.');
    if(record.passed!==(run.exitCode===0&&run.signal===null&&complete))throw Error('Platform completion claim differs from run: '+record.file);
  }
  return evidence;
}
export async function readPlatformEvidence() {
  let evidence;
  try { evidence=await readJSON(path.join(ROOT,'docs/sdk-audit/mobile-validation.json')); }
  catch(e) { if(e.code==='ENOENT') return null;throw e; }
  return validatePlatformEvidence(evidence);
}
