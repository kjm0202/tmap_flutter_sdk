import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HERE } from "../common.mjs";
import { ajaxWitness } from "../direct_ajax_witness.mjs";
import { directAjaxSource } from "../direct_ajax_source.mjs";
import { verifiedDirectRestExample } from "../direct_rest_example_proof.mjs";
import { currentReferenceValidator } from "../current_reference_scope.mjs";
import { verifiedDocumentSources } from "../current_rest_document_sources.mjs";
import { reviewRestDocuments } from "../rest_document_review.mjs";

const docUrl = "https://tmapapi.tmapmobility.com/webservice/docs/tmapRouteOptimization30Doc.html";
const exampleUrl = "https://tmapapi.tmapmobility.com/webv3VSM/usecase/UseCaseOptimization.html";
const executableUrl = "https://apis.openapi.sk.com/tmap/routes/routeOptimization30?version=1&format=json";
const targetCode = "rest-reference-schema-review-required";
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "baselines/production-2026-11-19-46fa62a7bb27.json"), "utf8"));
const source = manifest.sources.find(s => s.url === docUrl);
const example = manifest.sources.find(s => s.url === exampleUrl);
const exampleHtml = fs.readFileSync(path.join(HERE, ".cache/sources", example.sha256), "utf8");
const replacing = name => p => String(p).endsWith(name) ? Buffer.from("changed") : fs.readFileSync(p);

test("direct ajax witness binds the executable and displayed POST", () => {
    const witness = ajaxWitness(exampleHtml, executableUrl);
    assert.ok(witness);
    assert.equal(witness.executableLine, 667);
    assert.equal(witness.displayedLine, 1051);
    assert.equal(witness.verb, "POST");
    assert.deepEqual(witness.scriptCallRange, [15404, 24861]);

    const urlAt = exampleHtml.indexOf(executableUrl), callAt = exampleHtml.lastIndexOf("$.ajax(", urlAt);
    const mutate = (from, to) => exampleHtml.slice(0, callAt) + exampleHtml.slice(callAt, urlAt + 200).replace(from, to) + exampleHtml.slice(urlAt + 200);
    assert.equal(ajaxWitness(exampleHtml, executableUrl.split("?")[0]), null, "URL without exact query");
    assert.equal(ajaxWitness(mutate('type:"POST"', 'type:"GET"'), executableUrl), null, "GET");
    assert.equal(ajaxWitness(mutate("$.ajax(", "jQuery.ajax("), executableUrl), null, "other receiver");
    assert.equal(ajaxWitness(mutate("async:false,", "async:false,type:\"POST\","), executableUrl), null, "duplicate key");
    const scriptEnd = exampleHtml.indexOf("</script>");
    const twice = exampleHtml.slice(0, scriptEnd) + "\n$.ajax({type:\"GET\"});\n" + exampleHtml.slice(scriptEnd);
    assert.equal(ajaxWitness(twice, executableUrl), null, "second executable call");
});

test("direct ajax source requires both pinned manifest roles and the receipt", () => {
    const proof = directAjaxSource(manifest, source);
    assert.ok(proof);
    assert.equal(proof.endpoint, "/routes/routeOptimization30");
    assert.equal(proof.doc.line, 43);
    assert.equal(proof.doc.method, "POST");
    assert.equal(proof.sourceReceiptSha, "736bf4408660a0bb6b2a0deed19e38346377c483220a5d5131e679ef7d1a57ca");
    assert.equal(directAjaxSource(manifest, example), null, "example is not the reference");
    assert.equal(directAjaxSource(manifest, { ...source, bytes: source.bytes + 1 }), null, "changed source record");
    assert.equal(directAjaxSource({ ...manifest, sources: [...manifest.sources, example] }, source), null, "duplicate example");
    assert.equal(directAjaxSource({ ...manifest, sources: manifest.sources.map(s => s === example ? { ...s, role: "linked-rest-reference" } : s) }, source), null, "example role");
    for (const name of [source.sha256, example.sha256, "direct_rest_example_proof.json"])
        assert.equal(directAjaxSource(manifest, source, replacing(name)), null, name);
});

test("direct REST example closes only the original diagnostic", (t) => {
    if (!process.env.TMAP_AUDIT_REST_REPORT_DIR) {
        t.skip("TMAP_AUDIT_REST_REPORT_DIR not set");
        return;
    }

    const reportDir = process.env.TMAP_AUDIT_REST_REPORT_DIR;
    const report = JSON.parse(fs.readFileSync(path.join(reportDir, "report.json"), "utf8"));
    const docs = JSON.parse(fs.readFileSync(path.join(reportDir, "docs.json"), "utf8"));
    const { rows, referenceRuntimeEvidence } = report;
    const ctx = { manifest, docs, rows, referenceRuntimeEvidence };
    const directStatus = "DOCUMENT_DIRECT_REST_EXAMPLE_SCOPE_RESOLVED", scopeStatus = "DOCUMENT_REFERENCE_SCOPE_RESOLVED";
    const isTarget = i => i?.code === targetCode && i?.source === docUrl;
    const resolvedIssues = report.resolvedIssues ?? [];
    const openTargets = report.issues.filter(isTarget);
    const resolvedTargets = resolvedIssues.filter(x => isTarget(x.original));
    // The original is either still open (before) or already resolved by this proof (after), exactly once.
    assert.equal(openTargets.length + resolvedTargets.length, 1, "exactly one original diagnostic, open or previously resolved");
    const restored = resolvedTargets[0];
    if (restored) {
        assert.equal(restored.status, directStatus, "previously resolved by the direct REST example");
        assert.ok(!report.issues.some(i => JSON.stringify(i) === JSON.stringify(restored.original)), "resolved original is not also open");
    }
    const original = openTargets[0] ?? structuredClone(restored.original);
    const historical = i => ['convertCoord.html', 'tmapGeofencingRegionsDoc.html', 'tmapGeofencingRegionsDetailDoc.html'].some(name => i?.code === targetCode && i.source?.endsWith('/' + name));
    const issues = (restored ? [...report.issues, original] : report.issues).filter(i => !historical(i));

    const statuses = JSON.stringify(rows.map(r => [r.id, r.status]));
    const fields = JSON.stringify(docs.restReferenceFields);
    const live = reviewRestDocuments({ ...ctx, issues });
    assert.equal(live.resolved.length, 1);
    assert.deepEqual(live.resolved[0].original, original);
    assert.equal(live.resolved[0].status, directStatus);
    if (restored) assert.deepEqual(JSON.parse(JSON.stringify(live.resolved[0])), restored, "replay matches the recorded resolution");
    assert.deepEqual(live.open, issues.filter(i => i !== original));
    assert.deepEqual(live.open, report.issues.filter(i => i !== original && !historical(i)));
    assert.equal(live.open.length, issues.length - 1);
    assert.equal(live.open.filter(i => i.code === targetCode).length, issues.filter(i => i.code === targetCode).length - 1);
    assert.equal(statuses, JSON.stringify(rows.map(r => [r.id, r.status])), "candidate statuses unchanged");
    assert.equal(fields, JSON.stringify(docs.restReferenceFields), "generated fields unchanged");

    const evidence = live.resolved[0].receipt.proof;
    assert.equal(evidence.wireStatus, "UNVERIFIED");
    assert.equal(evidence.fieldCount, 60);
    assert.deepEqual(evidence.tables.map(x => [x.line, x.anchor, x.status]), [39, 76, 115, 507, 763, 1045, 2088, 3033].map(line => [line, null, "unmapped"]));
    assert.deepEqual(evidence.namedRouteProof.cores.map(c => c.methods), [28, 28]);
    assert.equal(evidence.releasedAdapters.archiveSha256, "dae54a154deb0b979e27c18d7d49d00faedd93bc8dfff8c732f11438a7fbb056");

    // Existing reference-scope resolutions still resolve identically.
    const targetDispositions = resolvedIssues.filter(x => x.original?.code === targetCode);
    for (const x of targetDispositions)
        assert.ok(x.status === scopeStatus || x.status === 'DOCUMENT_HISTORICAL_NAMED_SCHEMA_ADAPTER_SCOPE_RESOLVED' || (x.status === directStatus && x === restored), `${x.original.source}: ${x.status}`);
    const prior = targetDispositions.filter(x => x.status === scopeStatus);
    assert.ok(prior.length > 0);
    assert.ok(!prior.some(x => isTarget(x.original)));
    const replay = reviewRestDocuments({ ...ctx, issues: prior.map(x => x.original) });
    assert.equal(replay.open.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(replay.resolved)), prior);

    // Changed or duplicated diagnostics and missing runtime evidence stay open.
    for (const issues of [[{ ...original, reason: "changed" }], [{ ...original, extra: true }], [original, { ...original }]])
        assert.deepEqual(reviewRestDocuments({ ...ctx, issues }).open, issues);
    assert.deepEqual(reviewRestDocuments({ ...ctx, referenceRuntimeEvidence: null, issues: [original] }).open, [original]);

    const sdkView = currentReferenceValidator(report);
    assert.ok(sdkView.namedRouteAbsent("/routes/routeOptimization30"));
    for (const route of ["/routes", "/pois/123", "/geofencing/regions/abc", "/routes/pedestrian", "/", "/routes/../pois", "//other.host/path"])
        assert.equal(sdkView.namedRouteAbsent(route), null, route);

    const docProof = verifiedDocumentSources(source, docs.restReferenceFields.filter(f => f.source === docUrl));
    const v = { ...ctx, source, docProof, validateNamedRoute: sdkView.namedRouteAbsent };
    const direct = (over = {}, read) => verifiedDirectRestExample({ ...v, ...over }, read);
    assert.ok(direct());
    const row = rows.find(r => r.id === docProof.tableIds[3]);
    const withRow = change => rows.map(r => r === row ? { ...r, ...change } : r);
    const negatives = {
        "duplicate row": { rows: [...rows, row] },
        "extra table row": { rows: [...rows, { ...row, id: `rest-reference:${docUrl}:table-8` }] },
        "missing row": { rows: rows.filter(r => r !== row) },
        "promoted status": { rows: withRow({ status: "reviewed-reference-only" }) },
        "shifted line": { rows: withRow({ evidence: [{ ...row.evidence[0], line: row.evidence[0].line + 1 }] }) },
        "invented anchor": { rows: withRow({ evidence: [{ ...row.evidence[0], anchor: "menu1" }] }) },
        "added channel": { rows: withRow({ channels: ["docs", "runtime"] }) },
        "field count": { docProof: { ...docProof, fieldCount: 59 } },
        "verified field": { docs: { restReferenceFields: docs.restReferenceFields.map((f, i) => f.source === docUrl && i === docs.restReferenceFields.findIndex(x => x.source === docUrl) ? { ...f, status: "verified" } : f) } },
        "named route present": { validateNamedRoute: () => null },
        "no named route check": { validateNamedRoute: undefined },
        "other source": { source: example }
    };
    for (const [name, over] of Object.entries(negatives)) assert.equal(direct(over), null, name);
    for (const name of [source.sha256, example.sha256, "direct_rest_example_proof.json", "actual-pub-0.1.1.tar.gz"])
        assert.equal(direct({}, replacing(name)), null, name);
});
