import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

import {reviewRequestHeaderAndKmlStyleWrites, sameSite} from '../request_kml_dictionary_review.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {TMAP_AUDIT_RAW_OUT, TMAP_AUDIT_CORE, TMAP_AUDIT_EXAMPLE_CORE} = process.env;

test('request header and KML style dictionary review', {skip: !(TMAP_AUDIT_RAW_OUT && TMAP_AUDIT_CORE && TMAP_AUDIT_EXAMPLE_CORE)}, async (t) => {
  const work = path.resolve(__dirname, '../../..');
  const read = f => JSON.parse(fs.readFileSync(f));

  const manifest = read(path.join(work, 'tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json'));
  const receipt = JSON.parse(gunzipSync(fs.readFileSync(path.join(work, 'docs/sdk-audit/checkpoints/2026-11-19/request-headers-and-kml-style-dictionaries.json.gz'))));
  const texts = {'documentation-host-example-core': TMAP_AUDIT_EXAMPLE_CORE, 'flutter-web-fixed-cdn-versioned-core': TMAP_AUDIT_CORE};
  const sources = Object.entries(texts).map(([role, file]) => ({...manifest.sources.find(s => s.role === role), text: fs.readFileSync(file, 'utf8')}));

  // Rehydrate the original diagnostics from the generated report, whether still open or already resolved.
  const report = read(path.join(TMAP_AUDIT_RAW_OUT, 'report.json'));
  const candidates = [...report.issues, ...(report.resolvedIssues ?? []).map(r => r.original).filter(Boolean)];
  const sites = receipt.issues.map(expected => candidates.filter(i => sameSite(i, expected)));
  assert.deepEqual(sites.map(s => s.length), [1, 1]);
  assert.deepEqual(sites.flat(), receipt.issues);
  const others = report.issues.filter(i => !receipt.issues.some(e => sameSite(i, e)));
  const issues = [...others, ...sites.flat()];

  const raw = {
    issues,
    manifest,
    sources,
    ast: read(path.join(TMAP_AUDIT_RAW_OUT, 'ast.json')),
    runtime: read(path.join(TMAP_AUDIT_RAW_OUT, 'runtime.json')),
  };

  const result = reviewRequestHeaderAndKmlStyleWrites(raw);
  assert.equal(result.resolved.length, 2);
  assert.deepEqual(result.resolved.map(r => r.original), receipt.issues);
  assert.ok(result.resolved.every((r, k) => r.original === sites[k][0]));
  assert.deepEqual(result.open, others);

  const site = (v, k) => v.issues.find(i => sameSite(i, receipt.issues[k]));
  const pinned = v => v.runtime.networkScripts.filter(s => s.pinned === true && s.status === 200);
  const cases = {
    staleAuth(v) { v.runtime.auth = 'failed'; },
    staleBootstrap(v) { v.runtime.verifiedBootstrapDigest = 'other'; },
    staleNetworkBody(v) { for (const s of pinned(v)) s.sha256 = '1'.repeat(64); },
    unpinnedNetwork(v) { for (const s of pinned(v)) s.pinned = false; },
    duplicateNetwork(v) { v.runtime.networkScripts.push(structuredClone(pinned(v)[0])); },
    alteredManifest(v) { v.manifest.sources.pop(); },
    staleCoreText(v) { v.sources[1].text += ' '; },
    staleExampleText(v) { v.sources[0].text += ' '; },
    missingExampleCore(v) { v.sources.shift(); },
    duplicateRole(v) { v.sources.push(v.sources[0]); },
    mutatedRange(v) { site(v, 0).evidence.end++; },
    mutatedKey(v) { site(v, 1).keyExpression += 'x'; },
    mutatedOwner(v) { site(v, 0).owner += 'Wrong'; },
    duplicateSiteRow(v) { v.issues.push(structuredClone(site(v, 1))); },
    duplicateAstRow(v) { v.ast.rows.push(structuredClone(receipt.ast[0])); },
    missingAstRow(v) { v.ast.rows = v.ast.rows.filter(r => r.id !== receipt.ast.at(-1).id); },
    staleRuntimeRow(v) { v.runtime.rows.find(r => r.id === receipt.runtime[0].id).kind = 'stale'; },
    duplicateRuntimeRow(v) { v.runtime.rows.push(structuredClone(receipt.runtime[0])); },
    missingHeaderSibling(v) { v.issues = v.issues.filter(i => i !== site(v, 0)); },
    missingStyleSibling(v) { v.issues = v.issues.filter(i => i !== site(v, 1)); },
    missingManifest(v) { v.manifest = null; },
  };

  for (const [name, act] of Object.entries(cases)) {
    await t.test(name, () => {
      const v = structuredClone(raw);
      act(v);
      const x = reviewRequestHeaderAndKmlStyleWrites(v);
      assert.equal(x.resolved.length, 0, name);
      assert.equal(x.open, v.issues, name);
    });
  }
});
