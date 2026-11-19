import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {parse} from 'acorn';
import {sha} from '../common.mjs';
import {createDocumentSourceDisposer,requiresDocumentSourceEvidence} from '../document_source_dispositions.mjs';
import profile from '../document_source_reviews.json' with {type:'json'};

function fixture({bullet='- lat : example', control='- zoomLevel : {Int} zoom', heading='method', owner='Tmapv3.Tdata', extra='', script='function init(){', region='지도 불러오기'}={}) {
  const url='https://example.test/doc', guideUrl='https://example.test/guide';
  const doc=`<h2>${owner}</h2><h4 id="Tdata_method">${heading}</h4><h5>Parameters</h5><ul><li>${bullet}</li><li>${control}</li></ul>${extra}`;
  const guide=`<h2 id="sample2">start</h2><h3>${region}</h3><code>${script}</code>`;
  const $=load(doc,{sourceCodeLocationInfo:true}), x=load(guide,{sourceCodeLocationInfo:true});
  const li=$('li').first()[0].sourceCodeLocation, ctl=$('li').eq(1)[0].sourceCodeLocation, el=x('code')[0].sourceCodeLocation;
  const ds={url,kind:'document',role:'official-docs-document',sha256:sha(doc),text:doc}, gs={url:guideUrl,kind:'document',role:'official-guide-document',sha256:sha(guide),text:guide};
  const evidence=(s,line)=>({channel:'docs',source:s.url,sha256:s.sha256,anchor:null,line});
  const a={code:'document-type-unspecified',id:'Tmapv3.Tdata#method:lat',evidence:evidence(ds,li.startLine)};
  let err;try {parse(script,{ecmaVersion:'latest',allowReturnOutsideFunction:true});}catch(e){err=e;}
  const b={code:'example-parse-failed',evidence:evidence(gs,el.startLine),error:err?.message || 'Unexpected token (1:0)'};
  const pin=s=>({url:s.url,kind:s.kind,role:s.role,sha256:s.sha256,bytes:Buffer.byteLength(s.text)});
  const body={sources:[pin(ds),pin(gs)],links:[],issues:[]}, manifest={...body,id:sha(JSON.stringify(body))};
  const r={id:a.id,fingerprint:sha(JSON.stringify(a)),name:'lat',method:'method',anchor:'Tdata_method',span:{start:li.startOffset,end:li.endOffset,line:li.startLine,excerpt:doc.slice(li.startOffset,li.endOffset),sliceSha256:sha(doc.slice(li.startOffset,li.endOffset))},control:{start:ctl.startOffset,end:ctl.endOffset,sha256:sha(doc.slice(ctl.startOffset,ctl.endOffset)),text:control}};
  const e={fingerprint:sha(JSON.stringify(b)),line:el.startLine,outerSha256:sha(guide.slice(el.startOffset,el.endOffset)),scriptSha256:sha(script),browser:{compiles:false,exception:'SyntaxError: fixture',zeroBasedLine:(err?.loc.line??1)-1,zeroBasedColumn:err?.loc.column??0},region:'지도 불러오기',spans:[{source:guideUrl,sha256:gs.sha256,kind:'document',start:el.startTag.endOffset,end:el.endTag.startOffset,excerpt:script}]};
  const p={baseline:manifest.id,parameterSource:{url,sha256:ds.sha256,role:ds.role},guideSource:{url:guideUrl,sha256:gs.sha256,role:gs.role},parameters:[r],examples:[e]};
  return {input:{manifest,sources:[ds,gs],issues:[a,b]},p};
}
const run=f=>createDocumentSourceDisposer(f.p)(f.input);

test('preserves diagnostics, literal bytes, unknown type and bounded syntax findings',()=>{
  const f=fixture(), before=structuredClone(f.input), r=run(f);
  assert.equal(r.open.length,0);assert.equal(r.resolved.length,2);assert.deepEqual(f.input,before);
  assert.deepEqual(r.resolved.map(x=>x.original),f.input.issues);
  assert.equal(r.resolved[0].evidence.observedType,null);
  assert.match(r.resolved[0].rationale,/unknown/);
  assert.equal(r.resolved[1].evidence.script.text,'function init(){');
  assert.equal(r.resolved[1].evidence.document.raw,'<code>function init(){</code>');
  assert.equal(r.resolved[1].evidence.script.error,f.input.issues[1].error);
});

test('changed bytes, role, source, manifest, missing body and duplicate captures fail closed',()=>{
  for(const mutate of [f=>f.input.sources[0].text+='x',f=>delete f.input.sources[0].text,f=>f.input.sources[0].role='reference',f=>f.input.sources[0].url+='x',f=>f.input.manifest.sources[0].role='reference',f=>f.input.sources.push({...f.input.sources[0]}),f=>f.input.issues.push({...f.input.issues[0]}),f=>f.input.manifest.id='wrong']) {
    const f=fixture();mutate(f);assert.ok(run(f).open.some(i=>i.code==='document-type-unspecified'));
  }
});

test('new types, wrong argument, sibling, heading, owner and duplicate heading do not resolve even in newly hashed fixtures',()=>{
  for(const opts of [{bullet:'- lat : {String} example'},{bullet:'- lng : example'},{control:'- zoomLevel : example'},{heading:'another'},{owner:'Tmapv3.Other'},{extra:'<h4 id="other">method</h4>'}]) {
    const f=fixture(opts);assert.ok(run(f).open.some(i=>i.code==='document-type-unspecified'),JSON.stringify(opts));
  }
  const f=fixture();f.p.parameters[0].control.start=f.p.parameters[0].span.start;assert.ok(run(f).open.some(i=>i.code==='document-type-unspecified'));
});

test('examples require the exact diagnostic, source span, region, independent error and actual invalid script',()=>{
  for(const mutate of [f=>f.input.sources[1].text+='x',f=>f.p.examples[0].spans[0].start++,f=>f.p.examples[0].browser.compiles=true,f=>f.p.examples[0].browser.zeroBasedColumn++,f=>f.input.issues[1].error='different',f=>f.input.issues.push({...f.input.issues[1]}),f=>f.p.examples[0].scriptSha256=sha('different')]) {
    const f=fixture();mutate(f);assert.ok(run(f).open.some(i=>i.code==='example-parse-failed'));
  }
  for(const opts of [{script:'function init(){}'},{region:'different'}]) assert.ok(run(fixture(opts)).open.some(i=>i.code==='example-parse-failed'));
});

test('only the 14 reviewed fingerprints are guarded and historical reviews are separate',()=>{
  assert.equal(profile.parameters.length,12); assert.equal(profile.examples.length,2);
  const manifest={id:profile.baseline};
  assert.equal(requiresDocumentSourceEvidence(manifest,{code:'unrelated'}),false);
  assert.ok(![...profile.parameters,...profile.examples].some(x=>['4aeefe2285f359fb7b26031a53fb6187f924eb937ad4276a264f9961bce53b20','cb6593dddb88f63f0b1162c80ec1b12e410e9d199e4b87511e959ec1b9981789','32c8fa106c8c31d66d9ab6bda8df4549579a5dfdad32c720085f4860e3c8305f'].includes(x.fingerprint)));
});

test('review profile agrees with the four tracked checkpoint receipts',async()=>{
  const {readFileSync}=await import('node:fs'); const {gunzipSync}=await import('node:zlib');
  const dir=new URL('../../../docs/sdk-audit/checkpoints/2026-11-19/',import.meta.url);
  const receipts={};for(const [name,digest] of Object.entries(profile.provenance)) {
    const bytes=readFileSync(new URL(name,dir));assert.equal(sha(bytes),digest);receipts[name]=JSON.parse(gunzipSync(bytes));
  }
  const params=receipts['official-unspecified-parameter-types.json.gz'];
  const controls=receipts['official-unspecified-parameter-type-controls.json.gz'];
  const errors=receipts['official-doc-errors-source-spans.json.gz'];
  const independent=receipts['source-diagnostic-independent.json.gz'];
  assert.equal(params.baseline,profile.baseline);assert.equal(controls.typedNeighborsPositiveControls,4);assert.equal(controls.actualTypesAbsentInSimpleTextLi,12);
  for(const r of profile.parameters) {
    const records=params.records.filter(x=>x.issueFingerprint===r.fingerprint);assert.equal(records.length,1);
    const v=records[0];assert.equal(v.issueId,r.id);assert.equal(v.guideName,r.name);assert.equal(v.docsMethod,r.method);assert.deepEqual(v.source,r.span);
    assert.equal(v.documentedJsType,null);assert.equal(v.extractorLostExplicitType,false);
  }
  for(const r of profile.examples) {
    const items=errors.items.filter(x=>x.fingerprint===r.fingerprint);assert.equal(items.length,1);assert.deepEqual(items[0].spans,r.spans);
    const observations=independent.chromeRealCoreAndCompiler.syntax.filter(x=>x.htmlElement.lines[0]===r.line);assert.equal(observations.length,1);
    const o=observations[0];assert.equal(o.htmlElement.spanSha256,r.outerSha256);assert.equal(o.scriptSha256,r.scriptSha256);assert.deepEqual(o.original,r.browser);assert.equal(o.control.compiles,true);
  }
});
