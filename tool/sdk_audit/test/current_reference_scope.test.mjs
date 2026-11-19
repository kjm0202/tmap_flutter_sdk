import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {reviewCurrentReferences,currentReferenceValidator} from '../current_reference_scope.mjs';
import {contractWorklist} from '../contracts.mjs';
import {generateContracts} from '../audit_artifacts.mjs';

// If TMAP_AUDIT_RAW_OUT is supplied, use it; otherwise, skip real raw dependent tests
const envOut = process.env.TMAP_AUDIT_RAW_OUT;
let out = null;
if (envOut) {
    out = path.resolve(envOut);
    if (!fs.existsSync(out)) {
        throw new Error(`TMAP_AUDIT_RAW_OUT is set to ${out} but the directory does not exist.`);
    }
    const requiredFiles = ['report.json', 'runtime.json', 'docs.json'];
    for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(out, file))) {
            throw new Error(`TMAP_AUDIT_RAW_OUT is set to ${out} but ${file} is missing.`);
        }
    }
    const sourceCache = fileURLToPath(new URL('../.cache/sources/09557bf8f7cfd14ff4ea9cca226962469fa14208ef4af1ee6b2d3567798296f1', import.meta.url));
    if (!fs.existsSync(sourceCache)) {
        throw new Error(`TMAP_AUDIT_RAW_OUT is set to ${out} but captured source cache is missing.`);
    }
}
const baseline = fileURLToPath(new URL('../baselines/production-2026-11-19-46fa62a7bb27.json', import.meta.url));
const comparison = fileURLToPath(new URL('../../../docs/sdk-audit/checkpoints/2026-11-19/release-navigation-source-comparison.json.gz', import.meta.url));
const prefixBad = () => 'Tmapv3.extension.TData#wrongMethod';
const load = f => JSON.parse(fs.readFileSync(f));
const available = !!envOut;

test('negative missing-evidence test', () => {
    const report = { rows: [] };
    const reviewedReference = {
        id: 'mock-id',
        status: 'reviewed-reference-only',
        channels: [],
        evidence: [],
        referenceScopeReview: {
            heading: { text: 'Mock' },
            table: { sha256: '0'.repeat(64) },
            headingSha256: '0'.repeat(64),
            documentUrl: 'mock-url'
        }
    };
    // Validator should return false for an empty-rows report, proving no status-only approval.
    assert.equal(currentReferenceValidator(report)(reviewedReference), false);
});

test('current evidence binds exact 187 rows, both cores and authenticated runtime', {skip:!available},()=>{
 const report=load(path.join(out,'report.json')),runtime=load(path.join(out,'runtime.json')),manifest=load(baseline),docs=load(path.join(out,'docs.json'));
 const comparisonData=JSON.parse(gunzipSync(fs.readFileSync(comparison)));
 report.referenceRuntimeEvidence=reviewCurrentReferences(report.rows,{manifest,runtime});
 const reviewed=report.rows.filter(r=>r.status==='reviewed-reference-only');
 assert.equal(reviewed.length,187);let valid=currentReferenceValidator(report);
 assert.equal(reviewed.filter(valid).length,187);
 const allRefs=report.rows.filter(r=>r.scope==='linked-rest-reference');assert.equal(allRefs.length,294);
 assert.equal(allRefs.filter(r=>!valid(r)).length,107);
 const target=reviewed[0];const stale={...report,referenceRuntimeEvidence:undefined};assert.equal(currentReferenceValidator(stale)(target),false);assert.ok(target.referenceScopeReview.heading?.text);assert.equal(target.referenceScopeReview.table.sha256.length,64);assert.equal(target.referenceScopeReview.headingSha256.length,64);
 assert.deepEqual(target.referenceScopeReview.endpoints,comparisonData.documents.find(d=>d.url===target.referenceScopeReview.documentUrl).endpoints);
 assert.equal(docs.restReferenceFields.length,2341);assert.ok(docs.restReferenceFields.every(x=>x.status?.toLowerCase()==='unverified'));
 const work=generateContracts(report,docs);assert.equal(work.items.filter(x=>x.status==='REVIEWED_REFERENCE_ONLY').length,187);
 const item=work.items.find(x=>x.api===target.id);assert.ok(item.dimensions.every(d=>!d.applicable&&Object.values(d.platforms).every(p=>p.status==='not applicable')));
 assert.equal(work.items.filter(x=>allRefs.some(r=>r.id===x.api)&&x.status==='OPEN').length,107);
 assert.equal(work.restReferenceFields.length,2341);
 const endpointReview=JSON.parse(gunzipSync(fs.readFileSync(fileURLToPath(new URL('../../../docs/sdk-audit/checkpoints/2026-11-19/rest-table-endpoints.json.gz',import.meta.url)))));
 const classifications={};for(const d of endpointReview.documents)for(const t of d.tables){classifications[t.classification]=(classifications[t.classification]||0)+1;assert.equal(work.items.find(i=>i.api===t.ledgerId)?.status,'OPEN');}
 assert.deepEqual(classifications,{'path-and-verb-match':64,'no-named-sdk-path':13,'same-path-different-http-method':30});
 // A status and stored proof do not close a row after its evidence changes.
 target.channels.push('runtime');assert.equal(contractWorklist(report).items.find(i=>i.api===target.id).status,'OPEN');target.channels.pop();
 const altered=structuredClone(target);altered.channels.push('runtime');assert.equal(valid(altered),false);
 altered.channels=['docs'];altered.evidence[0].sha256='0'.repeat(64);assert.equal(valid(altered),false);
 altered.evidence=structuredClone(target.evidence);altered.referenceScopeReview.endpoints=['/routes'];assert.equal(valid(altered),false);
 altered.referenceScopeReview=structuredClone(target.referenceScopeReview);altered.referenceScopeReview.table.sha256='0'.repeat(64);assert.equal(valid(altered),false);
 altered.referenceScopeReview=structuredClone(target.referenceScopeReview);altered.id=allRefs.find(r=>!valid(r)).id;assert.equal(valid(altered),false);
 const historical=fs.readFileSync(fileURLToPath(new URL('../baselines/2026-11-17-production.json',import.meta.url)));
 const historicRead=(p,...args)=>String(p)===baseline?historical:fs.readFileSync(p,...args);
 assert.equal(currentReferenceValidator(report,historicRead)(target),false);
 const transferred=structuredClone(target);transferred.referenceScopeReview.configSha256='dbc86a7f3ee5db89f4de178ded9dadc5fc7b6e889e527d3b70e42cf46d14618e';assert.equal(valid(transferred),false);
 const prior=report.baselineId;report.baselineId='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';assert.equal(currentReferenceValidator(report)(target),false);report.baselineId=prior;
 const mrow=report.rows.find(r=>r.id==='Tmapv3.extension.TData#getRoutePlan');let start=mrow.evidence.find(e=>e.channel==='ast');start.start++;assert.equal(currentReferenceValidator(report)(target),false);start.start--;
 mrow.channels.push('example');mrow.evidence.push({channel:'example',source:'other',sha256:'1'.repeat(64)});assert.equal(currentReferenceValidator(report)(target),false);mrow.channels.pop();mrow.evidence.pop();
 const oldSha=report.sdkSha256;report.sdkSha256='0'.repeat(64);assert.equal(currentReferenceValidator(report)(target),false);report.sdkSha256=oldSha;
 const receipt=report.referenceRuntimeEvidence;const saved=receipt.rows[0].id;receipt.rows[0].id=prefixBad();assert.equal(currentReferenceValidator(report)(target),false);receipt.rows[0].id=saved;
 receipt.rows.pop();assert.equal(currentReferenceValidator(report)(target),false);
});

test('changed pinned comparison, manifest, source bytes and runtime identity fail closed', {skip:!available},()=>{
 const report=load(path.join(out,'report.json')),runtime=load(path.join(out,'runtime.json')),manifest=load(baseline);
 report.referenceRuntimeEvidence=reviewCurrentReferences(report.rows,{manifest,runtime});const row=report.rows.find(r=>r.status==='reviewed-reference-only');
 for(const marker of ['release-navigation-source-comparison.json.gz','production-2026-11-19-46fa62a7bb27.json','current_reference_method_rows.json','09557bf8f7cfd14ff4ea9cca226962469fa14208ef4af1ee6b2d3567798296f1',row.referenceScopeReview.documentSha256,'784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e']){
  const read=(p,...args)=>{let b=fs.readFileSync(p,...args);return String(p).includes(marker)?Buffer.concat([b,Buffer.from('x')]):b;};
  assert.equal(currentReferenceValidator(report,read)(row),false,marker);
 }
 report.referenceRuntimeEvidence.verifiedBootstrapDigest='0'.repeat(64);assert.equal(currentReferenceValidator(report)(row),false);
});