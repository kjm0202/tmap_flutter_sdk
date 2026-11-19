import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { HERE } from "../common.mjs";
import { extractRestFields } from "../rest_fields.mjs";
import { verifiedAmbiguousRoles } from "../rest_ambiguous_source_roles.mjs";

test("verifiedAmbiguousRoles validation", async (t) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "baselines/production-2026-11-19-46fa62a7bb27.json"), "utf8"));

    const targets = [
        { urlEnd: "/tmapMatrixDoc.html", expectedCount: 10 },
        { urlEnd: "/tmapRoutePredictionDoc.html", expectedCount: 36 },
        { urlEnd: "/tmapTruckRouteDoc.html", expectedCount: 16 },
        { urlEnd: "/tmapOilinfoPoiDetail.html", expectedCount: null }
    ];

    for (const target of targets) {
        await t.test(`Checking ${target.urlEnd}`, async () => {
            const s = manifest.sources.find(s => s.url.endsWith(target.urlEnd));
            assert.ok(s, `Source ${target.urlEnd} not found in manifest`);

            const sourceFilePath = path.join(HERE, ".cache/sources", s.sha256);
            if (!fs.existsSync(sourceFilePath)) {
                t.skip("raw cache file missing");
                return;
            }

            const bytes = fs.readFileSync(sourceFilePath);
            const sourceContent = bytes.toString("utf8");
            const $ = cheerio.load(sourceContent, { sourceCodeLocationInfo: true });

            const { fields } = extractRestFields({...s, text: sourceContent}, $, $("table").toArray());

            const result = verifiedAmbiguousRoles(s, fields, bytes);

            if (target.expectedCount === null) {
                assert.strictEqual(result, null, "Should return null for this source");
            } else {
                assert.ok(result, "Should return valid result");
                assert.strictEqual(result.count, target.expectedCount, `Expected count ${target.expectedCount}`);
            }
        });
    }
});

test("verifiedAmbiguousRoles edge cases", async (t) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "baselines/production-2026-11-19-46fa62a7bb27.json"), "utf8"));
    const s = manifest.sources.find(s => s.url.endsWith("/tmapMatrixDoc.html"));
    assert.ok(s, "Source /tmapMatrixDoc.html not found");
    const sourceFilePath = path.join(HERE, ".cache/sources", s.sha256);
    assert.ok(fs.existsSync(sourceFilePath), "raw cache file missing");

    const bytes = fs.readFileSync(sourceFilePath);
    const sourceContent = bytes.toString("utf8");
    const $ = cheerio.load(sourceContent, { sourceCodeLocationInfo: true });

    const { fields } = extractRestFields({...s, text: sourceContent}, $, $("table").toArray());

    // Find ambiguous fields
    const ambiguousFields = fields.filter(f => f.ambiguity);
    assert.ok(ambiguousFields.length > 0, "No ambiguous fields found");
    assert.notStrictEqual(fields.indexOf(ambiguousFields[0]), 0, "First array member may not be ambiguous");
    const firstAmbiguous = ambiguousFields[0];

    // 1. Change first real ambiguous field.span.utf8EndExclusive
    await t.test("Change first real ambiguous field.span.utf8EndExclusive", () => {
        const corruptedFields = JSON.parse(JSON.stringify(fields));
        const firstAmbiguousCorrupted = corruptedFields.find(f => f.id === firstAmbiguous.id);
        firstAmbiguousCorrupted.span.utf8EndExclusive += 1;
        const result = verifiedAmbiguousRoles(s, corruptedFields, bytes);
        assert.strictEqual(result, null, "Should return null after modifying span");
    });

    // 2. Change first displayPath
    await t.test("Change first displayPath", () => {
        const corruptedFields = JSON.parse(JSON.stringify(fields));
        const firstAmbiguousCorrupted = corruptedFields.find(f => f.id === firstAmbiguous.id);
        firstAmbiguousCorrupted.displayPath = "corrupted";
        const result = verifiedAmbiguousRoles(s, corruptedFields, bytes);
        assert.strictEqual(result, null, "Should return null after modifying displayPath");
    });

    // 3. Fake read corrupted bytes
    await t.test("Fake read corrupted bytes", () => {
        const corruptedBytes = Buffer.from(bytes);
        corruptedBytes[0] = 0; // Corrupt first byte
        const result = verifiedAmbiguousRoles(s, fields, corruptedBytes);
        assert.strictEqual(result, null, "Should return null after modifying bytes");
    });

    // 4. Fake read with function argument
    await t.test("Fake read function argument", () => {
        const result = verifiedAmbiguousRoles(s, fields, bytes, () => Buffer.from("corrupt"));
        assert.strictEqual(result, null, "Should return null with fake read function");
    });

    // 5. All original fields retain status unverified/ambiguity
    await t.test("All original fields retain status unverified/ambiguity", () => {
        for (const field of ambiguousFields) {
            assert.strictEqual(field.status, "unverified", `Field ${field.id} should be unverified`);
            assert.strictEqual(field.ambiguity, "display path repeated within table", `Field ${field.id} should have correct ambiguity string`);
        }
    });
});
