import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { HERE } from "../common.mjs";
import { verifiedDocumentSources } from "../current_rest_document_sources.mjs";
import { extractRestFields } from "../rest_fields.mjs";
import { releasedAdapterProof } from "../release_rest_named_adapters.mjs";
import { reviewRestDocuments } from "../rest_document_review.mjs";

test("releasedAdapterProof validation", () => {
    // Assert disjoint convertAddress and routes/distance return truthy proof
    const proof1 = releasedAdapterProof(["/geo/convertAddress", "/routes/distance"]);
    assert.ok(proof1, "convertAddress and routes/distance should return truthy proof");

    // Assert routes/pois/geo/reversegeocoding remain null
    assert.strictEqual(releasedAdapterProof(["/routes"]), null, "routes should return null");
    assert.strictEqual(releasedAdapterProof(["/pois"]), null, "pois should return null");
    assert.strictEqual(releasedAdapterProof(["/geo/reversegeocoding"]), null, "reversegeocoding should return null");

    // Injection returns null
    const corruptedProof = releasedAdapterProof(["/geo/convertAddress"], () => Buffer.from("different corrupted bytes"));
    assert.strictEqual(corruptedProof, null, "Corrupted injection should return null");
});

test("verifiedDocumentSources validation", async (t) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "baselines/production-2026-11-19-46fa62a7bb27.json"), "utf8"));
    const s = manifest.sources.find(s => s.url.endsWith("/convertAddress.html"));
    if (!s) {
        t.skip("source not found");
        return;
    }
    const sourceFilePath = path.join(HERE, ".cache/sources", s.sha256);
    if (!fs.existsSync(sourceFilePath)) {
        t.skip("restore source archive");
        return;
    }
    const sourceContent = fs.readFileSync(sourceFilePath, "utf8");
    const $ = cheerio.load(sourceContent, { sourceCodeLocationInfo: true });

    const { fields } = extractRestFields({...s, text: sourceContent}, $, $("table").toArray());

    const result = verifiedDocumentSources(s, fields);

    assert.ok(result, "verifiedDocumentSources should succeed");

    // Assert a copy of those fields with a corrupted first displayPath is null
    const corruptedFields = JSON.parse(JSON.stringify(fields)); // Deep copy
    if (corruptedFields.length > 0) {
        corruptedFields[0].displayPath = "corrupted";
        const corruptedResult = verifiedDocumentSources(s, corruptedFields);
        assert.strictEqual(corruptedResult, null, "Corrupted fields should return null");
    }
});

test("regression test for rest document review", async (t) => {
    if (!process.env.TMAP_AUDIT_REST_REPORT_DIR) {
        t.skip("TMAP_AUDIT_REST_REPORT_DIR not set");
        return;
    }

    const reportDir = process.env.TMAP_AUDIT_REST_REPORT_DIR;
    const report = JSON.parse(fs.readFileSync(path.join(reportDir, "report.json"), "utf8"));
    const docs = JSON.parse(fs.readFileSync(path.join(reportDir, "docs.json"), "utf8"));
    const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "baselines/production-2026-11-19-46fa62a7bb27.json"), "utf8"));

    const { rows, referenceRuntimeEvidence } = report;

    const isTarget = i => i?.code === "rest-reference-schema-review-required" && i.source?.endsWith("/convertAddress.html");
    const original = report.issues.find(isTarget) ||
                     report.resolvedIssues.map(x => x.original).find(isTarget);
    if (!original) {
        throw new Error("Could not find original issue for convertAddress.html");
    }

    // 1. Assert EXACTLY 1 resolved, proving positive.
    const result1 = reviewRestDocuments({issues:[original], manifest, docs, rows, referenceRuntimeEvidence});
    assert.strictEqual(result1.resolved.length, 1, "Should have 1 resolved");
    assert.strictEqual(result1.open.length, 0, "Should have 0 open");

    // 2. Each of changed reason, added unexpected key, and real table id duplicate appended after original must result 0 resolved.

    // Changed reason
    const corruptedReason = {...original, reason: "different reason"};
    const resultReason = reviewRestDocuments({issues:[corruptedReason], manifest, docs, rows, referenceRuntimeEvidence});
    assert.strictEqual(resultReason.resolved.length, 0, "Should have 0 resolved (reason changed)");
    assert.strictEqual(resultReason.open.length, 1, "Should have 1 open");
    assert.deepStrictEqual(resultReason.open[0], corruptedReason, "Diagnostic unchanged in open");

    // Added unexpected key
    const addedKey = {...original, unexpected: "key"};
    const resultKey = reviewRestDocuments({issues:[addedKey], manifest, docs, rows, referenceRuntimeEvidence});
    assert.strictEqual(resultKey.resolved.length, 0, "Should have 0 resolved (added key)");
    assert.strictEqual(resultKey.open.length, 1, "Should have 1 open");
    assert.deepStrictEqual(resultKey.open[0], addedKey, "Diagnostic unchanged in open");

    // Real table id duplicate appended after original
    const tableId = `rest-reference:${original.source}:table-0`;
    const existing = rows.find(r => r.id === tableId);
    const duplicatedRows = [...rows, {...existing, status:"unmapped"}];

    const resultDuplicate = reviewRestDocuments({issues:[original], manifest, docs, rows: duplicatedRows, referenceRuntimeEvidence});
    assert.strictEqual(resultDuplicate.resolved.length, 0, "Should have 0 resolved (duplicate row)");
    assert.strictEqual(resultDuplicate.open.length, 1, "Should have 1 open");
    assert.deepStrictEqual(resultDuplicate.open[0], original, "Diagnostic unchanged in open");
});
