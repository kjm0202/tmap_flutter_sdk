import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ROOT, sha } from "../common.mjs";
import { mobileGetterSourceEvidence } from "../mobile_getter_source_evidence.mjs";

test("mobile_getter_scope_revision", async (t) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-getter-scope-revision-"));
    t.after(() => {
        fs.rmSync(temp, { recursive: true });
    });

    const assets = [
        "assets/bridge/mobile.js",
        "assets/bridge/mobile_overlays.js",
        "assets/bridge/mobile_tdata.js",
        "assets/bridge/shared.js",
    ];
    const sourceFiles = [
        ...assets,
        "lib/src/tmap.dart",
        "tool/sdk_audit/dart/bin/bridges.dart"
    ];

    for (const f of sourceFiles) {
        const dest = path.join(temp, f);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(ROOT, f), dest);
    }

    const fixturePath = path.join(ROOT, "tool/sdk_audit/test/fixtures/related_bridge_probes.json");
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    fixture.root = temp;

    const proof = mobileGetterSourceEvidence(fixture);
    assert.ok(proof);
    assert.strictEqual(proof.mobileRealToScreenSourceSha256, 'dda3667b69759ce8c3281889180262051ea9287b75f37a98b5ef328c20ce9729');
    assert.strictEqual(proof.emitterSha256, 'd601e2ceb33c5006c76a538d6f1e44cf0de61c53eff59108df2d3d8c8d50a32b');

    // Test negative
    const originalMobileHelpers = fixture.runtime.bridgeSourceHashes.mobileHelpers;
    fixture.runtime.bridgeSourceHashes.mobileHelpers = "wrong";
    assert.strictEqual(mobileGetterSourceEvidence(fixture), null);
    fixture.runtime.bridgeSourceHashes.mobileHelpers = originalMobileHelpers;

    // Mutate mobile.js
    const mobileJsPath = path.join(temp, "assets/bridge/mobile.js");
    fs.appendFileSync(mobileJsPath, '\nfunction getZoomData(){return 15;}\n');

    // Update fingerprint
    const copiedMobile = fs.readFileSync(mobileJsPath);
    fixture.bridgeFingerprint.files['assets/bridge/mobile.js'] = sha(copiedMobile.toString());

    // Recompute
    const texts = [
        fs.readFileSync(path.join(temp, "assets/bridge/shared.js"), "utf8"),
        fs.readFileSync(mobileJsPath, "utf8"),
        fs.readFileSync(path.join(temp, "assets/bridge/mobile_overlays.js"), "utf8"),
        fs.readFileSync(path.join(temp, "assets/bridge/mobile_tdata.js"), "utf8")
    ].join('\n');
    fixture.runtime.bridgeSourceHashes.mobileHelpers = sha(texts);

    // Assert null
    assert.strictEqual(mobileGetterSourceEvidence(fixture), null);
});
