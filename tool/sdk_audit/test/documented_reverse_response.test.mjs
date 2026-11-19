import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractDocumentedReverseResponse } from '../documented_reverse_response.mjs';

function getSha256(text) {
    return createHash('sha256').update(text).digest('hex');
}

test('documented_reverse_response', () => {
    const docHtml = `
<html>
    <h2 id="Tmap_Tdata">Tmapv3.Tdata</h2>
    <h4 id="Tdata_getAddressFromGeoJson"><a href="#webservice/docs/reverseGeocoding">ReverseGeocoding</a></h4>
</html>
    `;
    const refHtml = `
<html>
    <div class="li_title">Response Parameter</div>
    <div class="table01">
        <table>
            <thead><tr><th>Name</th><th>Date Type</th><th>Mandatory</th><th>Example</th><th>Description</th></tr></thead>
            <tbody>
                <tr><td></td><td>addressInfo</td><td>Node</td><td>N</td><td></td><td></td></tr>
                <tr><td></td><td></td><td>fullAddress</td><td>String</td><td>Y</td><td>"text"</td><td>Description</td></tr>
                <tr><td></td><td></td><td>mappingDistance</td><td>Number</td><td>Y</td><td>123</td><td>Description</td></tr>
            </tbody>
        </table>
    </div>

    <div class="li_title">Response Sample code</div>
    <div class="table01">
        <table>
            <thead><tr><th>Code type : application/json</th></tr></thead>
            <tbody><tr><td><pre>{"addressInfo":{"fullAddress":"text","mappingDistance":12}}</pre></td></tr></tbody>
        </table>
    </div>
</html>
    `;
    
    const docSource = {
        kind: 'document',
        text: docHtml,
        url: 'https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html',
        sha256: getSha256(docHtml)
    };
    
    const refSource = {
        kind: 'reference',
        text: refHtml,
        url: 'https://tmapapi.tmapmobility.com/webservice/docs/reverseGeocoding.html',
        sha256: getSha256(refHtml)
    };

    const results = extractDocumentedReverseResponse([docSource, refSource]);

    // Assert exact paths/types/parent IDs
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].path, 'addressInfo');
    assert.strictEqual(results[0].parentId, 'Tmapv3.Tdata#getAddressFromGeoJson');
    assert.strictEqual(results[1].path, 'addressInfo.fullAddress');
    assert.strictEqual(results[1].parentId, 'Tmapv3.Tdata#getAddressFromGeoJson->restResponse.addressInfo');
    assert.strictEqual(results[2].path, 'addressInfo.mappingDistance');
    assert.strictEqual(results[2].parentId, 'Tmapv3.Tdata#getAddressFromGeoJson->restResponse.addressInfo');
});