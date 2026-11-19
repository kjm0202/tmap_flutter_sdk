import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'acorn';
import { matchReviewedHostFields, matchReviewedFieldCallbacks, matchReviewedPayloads } from '../docs.mjs';
import { extractExampleFields } from '../example_fields.mjs';
import { sha } from '../common.mjs';

const url = 'https://example.test/sample.html';
const block = 'const result = document.getElementById("result"); result.innerHTML = "ok";';
const text = `<html>\n<script>${block}</script>\n</html>`;
const source = { url, kind:'document', text, sha256:sha(text) };
const manifest = { id:'original', sources:[{url, kind:source.kind, sha256:source.sha256}] };
const declaration = 'result = document.getElementById("result")';
const expression = 'result.innerHTML';
const span = excerpt => ({start:block.indexOf(excerpt), end:block.indexOf(excerpt) + excerpt.length, excerpt});
const review = {
  id:'reviewed', source:url, sourceSha256:source.sha256, line:2, blockSha256:sha(block),
  start:span(expression).start, end:span(expression).end, expression, declaration:span(declaration),
};
const reviews = {baselineId:manifest.id, items:[review]};
const match = (m = manifest, s = source, r = reviews, l = 2, b = block) =>
  matchReviewedHostFields(r, m, s, l, b);

describe('reviewed host field source binding', () => {
  it('retains the exact same reviewed candidate and conditional classification under an expanded manifest', () => {
    const expanded = {id:'expanded', sources:[...manifest.sources, {url:'https://example.test/extra', kind:'document', sha256:'extra'}]};
    assert.deepEqual(match(), [review]);
    assert.deepEqual(match(expanded), match());
    for (const m of [manifest, expanded]) {
      const result = extractExampleFields(parse(block, {ecmaVersion:'latest'}), block, {reviewedHosts:match(m)});
      assert.equal(result.hostFields.length, 1);
      assert.equal(result.hostFields[0].classification, 'dom-result-conditional');
      assert.equal(result.hostFields[0].reviewId, review.id);
    }
  });

  it('rejects missing, retargeted, wrong-kind and replaced documents', () => {
    assert.deepEqual(match({...manifest, sources:[]}), []);
    assert.deepEqual(match({...manifest, sources:[{...manifest.sources[0], url:url + '?other'}]}), []);
    assert.deepEqual(match({...manifest, sources:[{...manifest.sources[0], kind:'sdk'}]}), []);
    assert.deepEqual(match(manifest, {...source, kind:'sdk'}), []);
    assert.deepEqual(match(manifest, {...source, text:text.replace('"ok"', '"no"')}), []);
    const changed = {...source, text:text.replace('"ok"', '"no"')};
    changed.sha256 = sha(changed.text);
    assert.deepEqual(match({...manifest, sources:[{...manifest.sources[0], sha256:changed.sha256}]}, changed), []);
  });

  it('requires the actual outer line and block, including when they are nested in code', () => {
    assert.deepEqual(match(manifest, source, reviews, 1), []);
    assert.deepEqual(match(manifest, source, reviews, 2, block + ' '), []);
    const forgedText = `<html>\n<script>unrelated.value</script>\n</html>`;
    const forgedSource = {...source, text:forgedText, sha256:sha(forgedText)};
    const forgedManifest = {...manifest, sources:[{...manifest.sources[0], sha256:forgedSource.sha256}]};
    const forgedReviews = {...reviews, items:[{...review, sourceSha256:forgedSource.sha256}]};
    assert.deepEqual(match(forgedManifest, forgedSource, forgedReviews), []);
    const nestedText = `<code>&lt;script&gt;${block}&lt;/script&gt;</code>`;
    const nestedSource = {...source, text:nestedText, sha256:sha(nestedText)};
    const nestedManifest = {...manifest, sources:[{...manifest.sources[0], sha256:nestedSource.sha256}]};
    const nestedReview = {...review, sourceSha256:nestedSource.sha256, line:1};
    assert.deepEqual(match(nestedManifest, nestedSource, {...reviews, items:[nestedReview]}, 1), [nestedReview]);
  });

  it('preserves conditional reference-page RegExp attribution across manifests', () => {
    const code = `var get = function(name){ var results = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.href); if (results==null) { return null; } else { return results[1]; } };`;
    const contents = `<script>${code}</script>`;
    const ref = {url:'https://example.test/reference.html', kind:'reference', text:contents, sha256:sha(contents)};
    const refManifest = {id:'expanded', sources:[{url:ref.url, kind:ref.kind, sha256:ref.sha256}]};
    const refSpan = excerpt => ({start:code.indexOf(excerpt), end:code.indexOf(excerpt) + excerpt.length, excerpt});
    const fn = code.slice(code.indexOf('function'), code.lastIndexOf('}') + 1);
    const decl = "results = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.href)";
    const expr = refSpan('results[1]');
    const item = {id:'regexp', kind:'regexp-exec-result', source:ref.url, sourceSha256:ref.sha256,
      line:1, blockSha256:sha(code), start:expr.start, end:expr.end, expression:expr.excerpt,
      declaration:refSpan(decl), callback:refSpan(fn)};
    const matched = matchReviewedHostFields({baselineId:'original', items:[item]}, refManifest, ref, 1, code);
    assert.deepEqual(matched, [item]);
    const result = extractExampleFields(parse(code, {ecmaVersion:'latest'}), code, {reviewedHosts:matched});
    assert.equal(result.hostFields.length, 1);
    assert.equal(result.hostFields[0].classification, 'regexp-result-conditional');
    const {declaration: _declaration, ...withoutDeclaration} = item;
    for (const invalid of [{...item, declaration:null}, withoutDeclaration])
      assert.deepEqual(matchReviewedHostFields({baselineId:'original', items:[invalid]}, refManifest, ref, 1, code), []);
  });

  it('accepts an explicitly null declaration for a direct DOM receiver', () => {
    const code = 'document.getElementById("result").innerHTML = "ok";';
    const contents = `<script>${code}</script>`;
    const directSource = {...source, text:contents, sha256:sha(contents)};
    const directManifest = {...manifest, sources:[{url, kind:source.kind, sha256:directSource.sha256}]};
    const directExpression = 'document.getElementById("result").innerHTML';
    const directReview = {...review, sourceSha256:directSource.sha256, line:1, blockSha256:sha(code),
      start:0, end:directExpression.length, expression:directExpression, declaration:null};
    for (const m of [directManifest, {...directManifest, id:'expanded'}]) {
      const matched = matchReviewedHostFields({baselineId:manifest.id, items:[directReview]}, m, directSource, 1, code);
      assert.deepEqual(matched, [directReview]);
      const result = extractExampleFields(parse(code, {ecmaVersion:'latest'}), code, {reviewedHosts:matched});
      assert.equal(result.hostFields.length, 1);
      assert.equal(result.hostFields[0].classification, 'dom-result-conditional');
      assert.equal(result.hostFields[0].reviewId, directReview.id);
      assert.equal(result.hostFields[0].declaration, null);
    }
  });

  it('rejects altered expression, declaration, callback and invalid spans', () => {
    const {declaration: _declaration, ...withoutDeclaration} = review;
    for (const altered of [
      {...review, expression:'result.outerHTML'},
      {...review, start:review.start + 1},
      {...review, start:-1},
      {...review, declaration:{...review.declaration, excerpt:'different'}},
      {...review, declaration:null},
      withoutDeclaration,
      {...review, callback:{...span(block), excerpt:'different'}},
      {...review, kind:'regexp-exec-result'},
    ]) assert.deepEqual(match(manifest, source, {...reviews, items:[altered]}), []);
    const withCallback = {...review, callback:span(block)};
    assert.deepEqual(match(manifest, source, {...reviews, items:[withCallback]}), [withCallback]);
  });

  it('does not relax callback or payload baseline gates', () => {
    const sdk = {text:'SDK callback', sha256:sha('SDK callback')};
    const ref = {url:'https://example.test/api', kind:'reference', text:'API reference', sha256:sha('API reference')};
    const original = {...manifest, sources:[...manifest.sources, {kind:'sdk', sha256:sdk.sha256},
      {url:ref.url, kind:ref.kind, sha256:ref.sha256}]};
    const expanded = {...original, id:'expanded'};
    const callback = {...review, sdkSha256:sdk.sha256, sdkEvidence:[{start:0,end:sdk.text.length,excerpt:sdk.text}]};
    const callbackReviews = {baselineId:original.id, items:[callback]};
    assert.deepEqual(matchReviewedFieldCallbacks(callbackReviews, original, source, sdk, 2, block), [callback]);
    assert.deepEqual(matchReviewedFieldCallbacks(callbackReviews, expanded, source, sdk, 2, block), []);
    const payload = {...review, restReference:{url:ref.url, sha256:ref.sha256}, endpoint:'result',
      rationale:'fixture', sourceEvidence:[span(declaration)],
      regions:[{receiver:'result', start:0, end:1, bindingStart:0, bindingEnd:1,
        expectedWrites:0, retainUnresolved:false, classification:'rest-response-field'}]};
    const payloadReviews = {baselineId:original.id, items:[payload]};
    assert.deepEqual(matchReviewedPayloads(payloadReviews, original, source, [ref], 2, block), [payload]);
    assert.deepEqual(matchReviewedPayloads(payloadReviews, expanded, source, [ref], 2, block), []);
  });
});
