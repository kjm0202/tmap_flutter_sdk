import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractDocumentedClusterPayload } from '../documented_cluster_payload.mjs';

function getSha256(text) {
    return createHash('sha256').update(text).digest('hex');
}

test('documented_cluster_payload', () => {
    const htmlContent = `
<html>
    <h2>Tmapv3.extension.MarkerCluster</h2>
    <h3>Constructor</h3>
    <pre><code>new Tmapv3.extension.MarkerCluster({
        onClusterClick: function(item) {
            observe(item.center);
            observe(item.markers);
        }
    });</code></pre>
</html>
    `;
    const url = 'https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html';
    const source = {
        kind: 'document',
        text: htmlContent,
        url: url,
        sha256: getSha256(htmlContent)
    };

    const results = extractDocumentedClusterPayload([source]);
    console.log('Results:', JSON.stringify(results, null, 2));
    
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.name.includes('center')));
    assert.ok(results.some(r => r.name.includes('markers')));
});

test('shadowing check', () => {
    const htmlContent = `
<html>
    <h2>Tmapv3.extension.MarkerCluster</h2>
    <h3>Constructor</h3>
    <pre><code>new Tmapv3.extension.MarkerCluster({
        onClusterClick: function(item) {
            use(item.before);
            {
                const item = {innerOnly: 1};
                use(item.innerOnly);
            }
            use(item.after);
        }
    });</code></pre>
</html>
    `;
    const url = 'https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html';
    const source = {
        kind: 'document',
        text: htmlContent,
        url: url,
        sha256: getSha256(htmlContent)
    };

    const results = extractDocumentedClusterPayload([source]);
    
    // Should detect item.before and item.after, but NOT item.innerOnly
    assert.ok(results.some(r => r.name.includes('before')));
    assert.ok(results.some(r => r.name.includes('after')));
    assert.ok(!results.some(r => r.name.includes('innerOnly')), 'Should not detect innerOnly');
});
