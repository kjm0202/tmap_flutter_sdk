import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { reviewProjectionInitialization } from '../projection_initialization_review.mjs';

describe('reviewProjectionInitialization', () => {
    const dataPath = new URL('../../../docs/sdk-audit/checkpoints/2026-11-19/projection-initialization.json.gz', import.meta.url);
    const data = JSON.parse(gunzipSync(readFileSync(dataPath)).toString());

    const manifest = {
        sources: [{
            kind: 'sdk',
            role: 'flutter-web-fixed-cdn-versioned-core',
            sha256: data.scriptSourceSha256,
            url: data.source
        }]
    };

    const issues = data.items.map(item => ({
        code: 'dynamic-property-write',
        owner: 'Tmapv3.util.Projection',
        receiver: 'this.' + item.table,
        evidence: {
            source: data.source,
            sha256: data.scriptSourceSha256,
            start: item.start,
            end: item.end
        },
        start: item.start,
        end: item.end,
        keyExpression: 'M.' + item.enum + '.' + item.key,
        keyEvidence: {
            source: data.source,
            sha256: data.scriptSourceSha256,
            start: item.start + ('this.' + item.table + '[').length,
            end: item.start + ('this.' + item.table + '[').length + ('M.' + item.enum + '.' + item.key).length
        }
    }));

    // Placeholder for a "real" receipt if needed. 
    // If the function takes receipt bytes, we might need to derive it from the audit data if available, 
    // but the prompt implies we shouldn't invent successful bytes.
    // I'll assume for now I can pass the data.receipt if the function supports it, or null/empty if that's what it expects.
    const receipt = data.receipt;

    it('returns 39 items for a valid manifest and issues', async () => {
        const result = await reviewProjectionInitialization(manifest, issues, receipt);
        assert.strictEqual(result.length, 39, 'Should have 39 items');
    });

    it('returns [] when manifest has wrong role', async () => {
        const badManifest = { ...manifest, sources: [{ ...manifest.sources[0], role: 'wrong-role' }] };
        const result = await reviewProjectionInitialization(badManifest, issues, receipt);
        assert.deepStrictEqual(result, [], 'Should fail closed for wrong role');
    });

    it('returns [] when receiptBytes are tampered', async () => {
        const tamperedReceipt = new Uint8Array(receipt);
        tamperedReceipt[0] = tamperedReceipt[0] === 0 ? 1 : 0; // Flip a byte

        const result = await reviewProjectionInitialization(manifest, issues, tamperedReceipt);
        assert.deepStrictEqual(result, [], 'Should fail closed for tampered bytes');
    });

    it('returns [] for missing site (if supported by manifest)', async () => {
        const badManifest = { ...manifest };
        delete badManifest.sources[0].url; // Assuming url maps to site
        const result = await reviewProjectionInitialization(badManifest, issues, receipt);
        assert.deepStrictEqual(result, [], 'Should fail closed for missing site');
    });

    it('returns [] when enum/key/receiver is wrong', async () => {
        const badIssues = JSON.parse(JSON.stringify(issues)); // Deep clone
        badIssues[0].keyExpression = 'WRONG';
        const result = await reviewProjectionInitialization(manifest, badIssues, receipt);
        assert.deepStrictEqual(result, [], 'Should fail closed for wrong keyExpression');
    });
});
