import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

import {reviewXmlNamespaceWrites} from '../xml_dictionary_review.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('xml dictionary review oracle', {skip: !process.env.TMAP_AUDIT_RAW_OUT}, async (t) => {
  const base = process.env.TMAP_AUDIT_RAW_OUT;
  const work = path.resolve(__dirname, '../../..');

  const read = f=>JSON.parse(fs.readFileSync(f));

  const baselinesDir = path.join(work, 'tool/sdk_audit/baselines');
  const manifestFile = 'production-2026-11-19-46fa62a7bb27.json';
  const manifest = read(path.join(baselinesDir, manifestFile));

  const proofFile = path.resolve(work, 'docs/sdk-audit/checkpoints/2026-11-19/xml-namespace-dictionary-observation.json.gz');
  const proof = JSON.parse(gunzipSync(fs.readFileSync(proofFile)));

  const hashes = proof.samples.map(s => s.digest);
  const cacheDir = path.resolve(__dirname, '../.cache/sources');
  const sources = manifest.sources.filter(s => hashes.includes(s.sha256)).map(s => ({
    ...s,
    text: fs.readFileSync(path.join(cacheDir, s.sha256), 'utf8')
  }));

  const rawIssues = read(path.join(base, 'report.json')).issues;
  const ast = read(path.join(base, 'ast.json'));
  const runtime = read(path.join(base, 'runtime.json'));

  const issues = [...rawIssues.filter(x => !proof.issues.some(y => y.code === x.code && y.evidence.start === x.evidence?.start)), ...proof.issues];

  const raw = { issues, ast, runtime, manifest, sources };

  const result = reviewXmlNamespaceWrites(raw);

  assert.equal(result.resolved.length, 3);
  assert.deepEqual(result.resolved.map(x=>x.original).sort((a,b)=>a.evidence.start-b.evidence.start), proof.issues);
  assert.deepEqual(result.open, rawIssues.filter(x => !proof.issues.some(y => y.code === x.code && y.evidence.start === x.evidence?.start)));

  const tests = {
    nonOkNetwork(v){v.runtime.networkScripts[0].status=403},
    wrongNetworkBody(v){v.runtime.networkScripts[0].sha256='1'.repeat(64)},
    wrongNetworkSource(v){v.runtime.networkScripts[0].url='https://invalid.example/other'},
    unpinned(v){v.runtime.networkScripts[0].pinned=false},
    duplicateNetwork(v){v.runtime.networkScripts.push(v.runtime.networkScripts[0])},
    wrongProductionRole(v){v.sources.find(s=>s.role==='flutter-web-fixed-cdn-versioned-core').role='invalid'},
    missingAuth(v){v.runtime.auth='failed'},
    missingNetwork(v){v.runtime.networkScripts=[]},
    alteredBootstrap(v){v.runtime.verifiedBootstrapDigest='other'},
    alteredManifest(v){v.manifest.sources.pop()},
    missingSource(v){v.sources.pop()},
    staleBytes(v){v.sources[0].text+=' '},
    wrongRange(v){v.issues.find(i=>i.owner==='Tmapv3.extension.XML'&&i.code==='dynamic-property-write').evidence.start++},
    wrongOwner(v){v.issues.find(i=>i.owner==='Tmapv3.extension.XML'&&i.code==='dynamic-property-write').owner+='Wrong'},
    staleDescriptor(v){v.runtime.rows.find(r=>r.id===proof.runtime[0].id).kind='property'},
    duplicateDescriptor(v){v.runtime.rows.push(proof.runtime[0])},
    missingAST(v){v.ast.rows=v.ast.rows.filter(r=>r.id!==proof.ast[0].id)},
    duplicateSite(v){v.issues.push(structuredClone(proof.issues[0]))},
    duplicateRole(v){v.sources.push(v.sources[0])}
  };

  for(const [name,act] of Object.entries(tests)){
    await t.test(name, () => {
      const v = structuredClone(raw);
      act(v);
      const x = reviewXmlNamespaceWrites(v);
      assert.equal(x.resolved.length, 0, name);
      assert.deepEqual(x.open, v.issues, name);
    });
  }

  await t.test('missing manifest', () => {
    const v = structuredClone(raw);
    v.manifest = null;
    const result = reviewXmlNamespaceWrites(v);
    assert.equal(result.resolved.length, 0);
    assert.deepEqual(result.open, issues);
  });
});
