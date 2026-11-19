import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDocs } from '../docs.mjs';
import { readSources } from '../sources.mjs';
import { sha } from '../common.mjs';

const sdkText = `
Tmapv3.createNamespace("Tmapv3.base.Size",(function(){function t(){} t.prototype.width=function(){return this._width};t.prototype.height=function(){return this._height};return t})());
Tmapv3.createNamespace("Tmapv3.base.LatLng",(function(){function t(){} t.prototype.lat=function(){return this._lat};t.prototype.lng=function(){return this._lng};t.prototype.latitude=function(){return this._lat};t.prototype.longitude=function(){return this._lng};return t})());
Tmapv3.createNamespace("Tmapv3.Map",(function(){function t(){} t.prototype.screenSize=function(){return new Tmapv3.base.Size(this._status.width,this._status.height)};t.prototype.getCenter=function(){var t=this._data.vsmMap.getCamera().getCenter();return new Tmapv3.base.LatLng(t.lat,t.lng)};return t})());
Tmapv3.LatLng=Tmapv3.base.LatLng;
`;
const source = (kind,url,text) => ({kind,url,text,sha256:sha(text)});
function run(code, edit = () => {}) {
  const doc=source('document','https://example.test/example.html',`<script>${code}</script>`);
  const sdk=source('sdk','https://example.test/sdk.js',sdkText);
  const manifest={id:'test',links:[],sources:[doc,sdk].map(({kind,url,sha256})=>({kind,url,sha256}))};
  edit({doc,sdk,manifest});
  return extractDocs([doc,sdk],manifest);
}
const center = 'var map; function init(){map = new Tmapv3.Map("map")} function f(){map.getCenter().lat(); map.getCenter().lng()}';
const parameter = 'function f(o){o.point.latitude(); o.point.longitude()} const arg={point:new Tmapv3.LatLng(1,2)}; f(arg);';

test('only exact residual sites receive conditional source paths', () => {
  for (const code of [center,parameter]) {
    const out=run(code);
    assert.equal(out.conditionalSdkCalls.length,2);
    for (const item of out.conditionalSdkCalls) {
      assert.equal(item.classification,'conditional-source-attribution');
      assert.equal(item.verification,'unverified');
      assert.match(item.limitation,/Other invocations/);
      assert.ok(out.residualCalls.some(c=>c.expression===item.expression && c.evidence.codeStart===item.start));
      assert.equal(code.slice(item.start,item.end),item.expression);
      assert.ok(item.bindings.length);
      for (const proof of [item.methodDeclaration,item.methodDeclaration.registration,item.methodDeclaration.constructor,...item.aliasDeclarations, ...(item.returnDeclaration ? [item.returnDeclaration] : [])]) {
        assert.equal(sdkText.slice(proof.start,proof.end),proof.excerpt);
      }
    }
  }
  // The legacy extractor already makes a row for this receiver. Do not add another.
  assert.equal(run('const p = new Tmapv3.LatLng(1,2); p.latitude();').conditionalSdkCalls.length,0);
});

test('rejects forged source bindings, shadowing and explicit mutation', () => {
  const variants = [
    ({sdk})=>{sdk.text+=' ';},
    ({doc})=>{doc.text+=' ';},
    ({manifest})=>{manifest.sources[1].url+='?other';},
    ({sdk,manifest})=>{sdk.text=sdk.text.replace('t.prototype.lat=', 't.prototype.fake=');sdk.sha256=sha(sdk.text);manifest.sources[1].sha256=sdk.sha256;},
    ({sdk,manifest})=>{sdk.text=sdk.text.replace('t.prototype.lat=function(){return this._lat}', 'function fake(t){t.prototype.lat=function(){return this._lat}}');sdk.sha256=sha(sdk.text);manifest.sources[1].sha256=sdk.sha256;},
    ({sdk,manifest})=>{sdk.text=sdk.text.replace('function t(){} t.prototype.lat=', 'function t(){} t=evil; t.prototype.lat=');sdk.sha256=sha(sdk.text);manifest.sources[1].sha256=sdk.sha256;},
    ({sdk,manifest})=>{sdk.text=sdk.text.replace('var t=this._data.vsmMap', 'var Tmapv3=evil,t=this._data.vsmMap');sdk.sha256=sha(sdk.text);manifest.sources[1].sha256=sdk.sha256;},
  ];
  for (const [index,edit] of variants.entries()) {
    const calls=run(center,edit).conditionalSdkCalls;
    assert.equal(index === 3 || index === 4 || index === 5 ? calls.filter(c=>c.method==='lat').length : calls.length,0);
  }
  for (const replacement of ['Tmapv3.LatLng=Tmapv3.base.Size;', 'Tmapv3.LatLng=evil;']) {
    const out = run(parameter,({sdk,manifest})=>{sdk.text += replacement; sdk.sha256=sha(sdk.text); manifest.sources[1].sha256=sdk.sha256;});
    assert.equal(out.conditionalSdkCalls.length,0);
  }
  for (const code of [
    'var map; function init(Tmapv3){map = new Tmapv3.Map()} function f(){map.getCenter().lat()}',
    'var map; function init(){map = new Tmapv3.Map()} function f(map){map.getCenter().lat()}',
    'var map; function init(){map = new Tmapv3.Map()} map.getCenter = fake; function f(){map.getCenter().lat()}',
    'var map; function init(){map = new Tmapv3.Map()} Tmapv3.Map = fake; function f(){map.getCenter().lat()}',
    'var map; function init(){map = new Tmapv3.Map()} Tmapv3 = fake; function f(){map.getCenter().lat()}',
    'function f(o){o.point.latitude()} function create(Tmapv3){const arg={point:new Tmapv3.LatLng()}; f(arg)}',
    'function f(o){o.point.latitude()} const arg={point:new Tmapv3.LatLng()}; arg.point=fake; f(arg)',
    'function f(o){o.point.latitude()} const arg={point:new Tmapv3.LatLng()}; f=other; f(arg)',
  ]) assert.equal(run(code).conditionalSdkCalls.length,0,code);
});

test('host operations and unproven callback receivers stay outside conditional paths', () => {
  const code = center + ' const xs=[]; xs.push(1); const text="abc"; text.substr(0,1); function cb(point){point.lat()} cb({lat:()=>0});';
  const out = run(code);
  for (const [expression, classification, hostOrigin] of [
    ['xs.push(1)', 'platform-or-host-call', 'Array'],
    ['text.substr(0,1)', 'platform-or-host-call', 'String'],
    ['point.lat()', 'unresolved-receiver', null],
  ]) {
    const call = out.residualCalls.find(c => c.expression === expression);
    assert.ok(call, expression);
    assert.equal(call.classification, classification);
    assert.equal(call.hostOrigin, hostOrigin);
    assert.equal(code.slice(call.evidence.codeStart, call.evidence.codeEnd), expression);
    assert.ok(!out.conditionalSdkCalls.some(c => c.expression === expression));
  }
});

const sample = n => `https://tmapapi.tmapmobility.com/webv3VSM/sample/webSample${n}.html`;
const webDocs = 'https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html';
const useCase = 'https://tmapapi.tmapmobility.com/webv3VSM/usecase/UseCaseOptimization.html';
const hashes = {
  '02':'96d90f7dcf5a256ad57d8ee31822bf4d5139668e0978ffd4b5c595cebc39ae07',
  '80':'c77281ac0177d1cb07561b2254d9be11db322c814d8451a81ec23ada010a1dc3',
  '91':'a14bb112ede9d4f9dfb084b31f9fa8eb68989bcc60b6c8b34473b8670c94bc8c',
};
// Coordinates are relative to the extracted example block; line identifies the block.
const sites = [
  ['02',1,1364,1382,'screenSize.width()','Tmapv3.base.Size','width'],
  ['02',1,1395,1414,'screenSize.height()','Tmapv3.base.Size','height'],
  ['02',99,734,752,'screenSize.width()','Tmapv3.base.Size','width'],
  ['02',99,761,780,'screenSize.height()','Tmapv3.base.Size','height'],
  ['80',1,1063,1084,'map.getCenter().lat()','Tmapv3.base.LatLng','lat'],
  ['80',1,1108,1129,'map.getCenter().lng()','Tmapv3.base.LatLng','lng'],
  ['91',1,1048,1078,'lonlatoption.lonlat.latitude()','Tmapv3.base.LatLng','latitude'],
  ['91',1,1079,1110,'lonlatoption.lonlat.longitude()','Tmapv3.base.LatLng','longitude'],
  ['91',130,448,478,'lonlatoption.lonlat.latitude()','Tmapv3.base.LatLng','latitude'],
  ['91',130,479,510,'lonlatoption.lonlat.longitude()','Tmapv3.base.LatLng','longitude'],
];
const project = c => [c.evidence.source, c.evidence.sha256, c.evidence.line,
  c.evidence.codeStart, c.evidence.codeEnd, c.expression, c.owner, c.method];
const expected = site => [sample(site[0]), hashes[site[0]], ...site.slice(1)];
const byLocation = (items, source, line, start, end, expression) => items.filter(c =>
  c.expression === expression && c.evidence.source === source && c.evidence.line === line &&
  c.evidence.codeStart === start && c.evidence.codeEnd === end);

test('pinned captures preserve source paths, reviewed calls and SDK events', async t => {
  const cases = [
    ['production-2026-11-19-46fa62a7bb27.json','7d936078411af8606d98ce1f06d8bb60a40c21855a2a29f3af0607003dc3f0b5',false],
    ['2026-11-17-production.json','82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714',true],
  ];
  for (const [file,id,reviewed] of cases) await t.test(file,async t => {
    let data;
    try { data=await readSources(new URL('../baselines/'+file,import.meta.url).pathname); }
    catch (e) { if (/Missing source /.test(e.message)) return t.skip('Pinned source cache unavailable'); throw e; }
    assert.equal(data.manifest.id,id);
    const out=extractDocs(data.sources,data.manifest);
    const paths = out.conditionalSdkCalls;
    const expectedSites = reviewed ? sites.filter(s => s[0] !== '80') : sites;
    const sort = values => values.map(v => JSON.stringify(v)).sort();
    assert.deepEqual(sort(paths.map(project)),sort(expectedSites.map(expected)));
    for (const path of paths) {
      assert.equal(path.classification,'conditional-source-attribution');
      assert.equal(path.verification,'unverified');
      assert.match(path.limitation,/Other invocations/);
      assert.equal(path.start,path.evidence.codeStart);
      assert.equal(path.end,path.evidence.codeEnd);
      const calls=byLocation(out.residualCalls,path.evidence.source,path.evidence.line,path.start,path.end,path.expression);
      assert.equal(calls.length,1,path.expression);
      assert.equal(calls[0].evidence.sha256,path.evidence.sha256);
      assert.equal(calls[0].classification,reviewed ? 'upstream-example-defect' : 'unresolved-receiver');
      if (reviewed) {
        assert.equal(path.historicConflict?.classification,'upstream-example-defect');
        assert.deepEqual(path.historicConflict.review,calls[0].review);
        assert.ok(calls[0].review?.rationale);
      } else assert.equal(path.historicConflict,undefined);
      for (const proof of [path.methodDeclaration,path.methodDeclaration.registration,path.methodDeclaration.constructor,
        ...path.aliasDeclarations,...(path.returnDeclaration ? [path.returnDeclaration,path.returnDeclaration.registration,path.returnDeclaration.constructor] : [])]) {
        const source=data.sources.find(s => s.url === proof.source && s.sha256 === proof.sha256);
        assert.ok(source,proof.source);
        assert.equal(source.text.slice(proof.start,proof.end),proof.excerpt);
      }
    }
    for (const site of sites.filter(s => s[0] === '80')) {
      const [n,line,start,end,expression,,method]=site;
      const calls=byLocation(out.residualCalls,sample(n),line,start,end,expression);
      assert.equal(calls.length,1,expression);
      assert.equal(calls[0].evidence.sha256,hashes[n]);
      assert.equal(calls[0].classification,reviewed ? 'sdk-return-chain' : 'unresolved-receiver');
      if (reviewed) {
        assert.equal(calls[0].review.target,`Tmapv3.LatLng#${method}`);
        assert.ok(calls[0].review.rationale);
        assert.ok(out.rows.some(r => r.id === `Tmapv3.LatLng#${method}` && r.evidence.some(e =>
          e.channel === 'example-reviewed' && e.source === sample(n) && e.sha256 === hashes[n] &&
          e.line === line && e.codeStart === start && e.codeEnd === end)));
      }
    }
    for (const [id,source,line,start,end] of [
      ['Tmapv3.Map!Click',sample('03'),1,1093,1290],
      ['Tmapv3.Map!ConfigLoad',sample('03'),1,919,1086],
      ['Tmapv3.Map!DragStart',sample('03'),1,1295,1521],
      ['Tmapv3.Marker!Click',sample('19'),1,1127,1229],
      ['Tmapv3.Marker!drag',useCase,1,3132,3224],
      ['Tmapv3.Marker!dragend',useCase,1,3037,3121],
    ]) {
      const pinned=data.sources.find(s => s.url === source);
      assert.ok(pinned,source);
      assert.ok(out.rows.some(r => r.id === id && r.kind === 'event' && r.evidence.some(e =>
        e.channel === 'example' && e.source === source && e.sha256 === pinned.sha256 &&
        e.line === line && e.codeStart === start && e.codeEnd === end)),id);
    }
    if (reviewed) {
      for (const [source,line,start,end,expression,classification] of [
        [webDocs,6531,85,103,'array.push(object)','host-array-operation'],
        [webDocs,6626,85,103,'array.push(object)','host-array-operation'],
        [webDocs,6730,85,103,'array.push(object)','host-array-operation'],
        [useCase,1,19385,19436,'prtcl.features[j].properties.arriveTime.substr(0,4)','host-string-operation'],
        [useCase,987,3440,3466,'routeLayer.getDataExtent()','upstream-example-defect'],
      ]) {
        const calls=byLocation(out.residualCalls,source,line,start,end,expression);
        assert.equal(calls.length,1,expression);
        assert.equal(calls[0].evidence.sha256,data.sources.find(s => s.url === source).sha256);
        assert.equal(calls[0].classification,classification);
        assert.ok(calls[0].review?.rationale);
        assert.equal(byLocation(paths,source,line,start,end,expression).length,0);
      }
    }
  });
});
