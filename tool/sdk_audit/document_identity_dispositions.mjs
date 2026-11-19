import { load } from 'cheerio';
import { sha } from './common.mjs';

// These are occurrences in the original evidence archive, not general rules for
// resolving similarly named diagnostics in another capture.
const DOC = 'https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html';
const INDEX = 'https://tmapapi.tmapmobility.com/main.html';
const SDK = 'https://toptmaptile1.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206';
const BOOT = 'https://apis.openapi.sk.com/tmap/vectorjs?version=1';
const DH = 'bae9de2c73bf9be412694e92f26f95007f6d46e81845bf271bd20b1e1481e214';
const IH = 'f4b2c760cda13721556edb164eb1ce577c0bce271feac60abc8b715669298b5b';
const SH = '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BH = '784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e';
const OWNER = 'Tmapv3.extension.TData';
const BASELINE = '7d936078411af8606d98ce1f06d8bb60a40c21855a2a29f3af0607003dc3f0b5';
const reviews = [
  {fingerprint:'4aeefe2285f359fb7b26031a53fb6187f924eb937ad4276a264f9961bce53b20', name:'getPOIDataFromLonLatJson', stale:'getPOIDataFromLonLatson', docStart:161007, docEnd:161071, exampleStart:161626, exampleEnd:161657, sdkStart:1004284},
  {fingerprint:'cb6593dddb88f63f0b1162c80ec1b12e410e9d199e4b87511e959ec1b9981789', name:'getPOIDataFromIdJson', stale:'getPOIDataFromIdson', docStart:163184, docEnd:163240, exampleStart:163735, exampleEnd:163762, sdkStart:1005844},
  {fingerprint:'32c8fa106c8c31d66d9ab6bda8df4549579a5dfdad32c720085f4860e3c8305f', name:'getAutoCompleteSearchV2Json', menuStart:350678, menuEnd:350773, sdkStart:1013996},
];

// The older manifest-only adjudications for these same diagnostics must not
// bypass the stronger checks when evidence is missing in the current baseline.
export function requiresDocumentIdentityEvidence(manifest, issue) {
  return manifest.id === BASELINE && reviews.some(r => r.fingerprint === sha(JSON.stringify(issue)));
}

// The factory also permits small synthetic source fixtures in unit tests. The
// maintained audit always uses the immutable, source-specific profile below.
export function createDocumentIdentityDisposer(profile) {
  const {DOC, INDEX, SDK, BOOT, DH, IH, SH, BH, OWNER, reviews} = profile;
  return function documentIdentityDispositions({issues, manifest, sources, ast, runtime}) {
  const result = {open: [...issues], resolved: []};
  if (!Array.isArray(sources) || !Array.isArray(ast?.rows) || !Array.isArray(runtime?.rows)) return result;
  const source = (url, kind, hash) => {
    const entries = sources.filter(s => s.url === url && s.kind === kind && s.sha256 === hash && typeof s.text === 'string' && sha(s.text) === hash);
    const pins = (manifest.sources || []).filter(s => s.url === url && s.kind === kind && s.sha256 === hash);
    return entries.length === 1 && pins.length === 1 ? entries[0] : null;
  };
  const doc = source(DOC, 'document', DH), index = source(INDEX, 'index', IH), sdk = source(SDK, 'sdk', SH);
  const bootstrap = (manifest.sources || []).filter(s => s.role === 'official-key-authenticated-bootstrap' && s.sha256 === BH);
  if (!doc || !index || !sdk || !source(BOOT, 'sdk-script', BH) || bootstrap.length !== 1 || runtime.auth !== 'script-executed' ||
      (ast.issues || []).some(i => ['sdk-parse-failed','sdk-source-empty','sdk-sources-missing'].includes(i.code)) ||
      runtime.verifiedBootstrapDigest !== BH || !runtime.phases?.some(p => p.phase === 'loaded' && p.rows > 0) ||
      !runtime.networkScripts?.some(s => s.sha256 === SH && s.bytes === Buffer.byteLength(sdk.text) && s.status === 200 && s.pinned === true && s.classification === 'pinned-core') ||
      (runtime.issues || []).some(i => ['runtime-capture-failed','runtime-auth-failed','runtime-auth-mismatch','runtime-sdk-missing','runtime-explicitly-skipped','runtime-script-body-unavailable','runtime-page-error','runtime-reflection-failed','runtime-depth-limit','runtime-row-limit'].includes(i.code))) return result;
  const $ = load(doc.text, {sourceCodeLocationInfo:true}), menu = load(index.text, {sourceCodeLocationInfo:true});
  const ids = id => $('[id]').toArray().filter(e => $(e).attr('id') === id);
  const prototype = runtime.rows.filter(r => r.id === `${OWNER}#prototype` && r.phase === 'loaded');
  if (prototype.length !== 1 || prototype[0].kind !== 'prototype' || prototype[0].valueType !== 'object' ||
      !prototype[0].evidence?.some(e => e.channel === 'runtime' && e.source === SDK && e.sha256 === SH && e.phase === 'loaded')) return result;
  for (const review of reviews) {
    const matches = issues.filter(i => sha(JSON.stringify(i)) === review.fingerprint);
    if (matches.length !== 1) continue;
    const original = matches[0], id = `${OWNER}#${review.name}`;
    const astRows = ast.rows.filter(r => r.id === id && r.kind === 'method' && r.static === false);
    const rtRows = runtime.rows.filter(r => r.id === id && r.phase === 'loaded');
    const prefix = `A.prototype.${review.name}=function(`;
    if (sdk.text.slice(review.sdkStart,review.sdkStart + prefix.length) !== prefix || astRows.length !== 1 ||
        !astRows[0].evidence?.some(e => e.channel === 'ast' && e.source === SDK && e.sha256 === SH && e.start === review.sdkStart && e.end > e.start && e.end <= sdk.text.length) ||
        rtRows.length !== 1 || rtRows[0].kind !== 'method' || rtRows[0].valueType !== 'function' ||
        !rtRows[0].evidence?.some(e => e.channel === 'runtime' && e.source === SDK && e.sha256 === SH && e.phase === 'loaded')) continue;
    let evidence, rationale;
    if (review.stale) {
      const anchor = `Tdata_${review.name}`, heading = ids(anchor);
      const excerpt = `id="${anchor}">${review.stale}</h4>`;
      const example = `tData.${review.name}(`;
      const nextMethod = $('h4[id]').toArray().map(e => e.sourceCodeLocation?.startOffset).filter(n => n > review.docEnd).sort((a,b) => a-b)[0] ?? doc.text.length;
      const precedingOwner = $('h2').toArray().filter(e => e.sourceCodeLocation?.startOffset < review.docStart).at(-1);
      if (heading.length !== 1 || heading[0].tagName !== 'h4' || $(heading[0]).text().trim() !== review.stale ||
          !precedingOwner || $(precedingOwner).text().trim() !== original.owner ||
          $('h4').toArray().filter(e => $(e).text().trim() === review.stale).length !== 1 ||
          heading[0].sourceCodeLocation?.startLine !== original.evidence?.line ||
          !(heading[0].sourceCodeLocation.startOffset <= review.docStart && heading[0].sourceCodeLocation.endOffset >= review.docEnd) ||
          review.exampleStart < heading[0].sourceCodeLocation.endOffset || review.exampleEnd > nextMethod ||
          doc.text.slice(review.docStart,review.docEnd) !== excerpt || doc.text.slice(review.exampleStart,review.exampleEnd) !== example ||
          sdk.text.includes(`prototype.${review.stale}`) || ast.rows.some(r => r.id === `${OWNER}#${review.stale}`) || runtime.rows.some(r => r.id === `${OWNER}#${review.stale}`)) continue;
      evidence = {document:{source:DOC,kind:'document',sha256:DH,heading:{start:review.docStart,end:review.docEnd,excerpt},example:{start:review.exampleStart,end:review.exampleEnd,excerpt:example}},sdk:{source:SDK,kind:'sdk',sha256:SH,ast:astRows[0].evidence, runtime:rtRows[0]}};
      rationale = `The unique heading says ${review.stale}; its anchor and example say ${review.name}, which is present in the captured SDK AST and authenticated runtime while ${review.stale} is absent.`;
    } else {
      const anchor = `Tdata_${review.name}`, href = `#webv3VSM/docs/WebDocs.${anchor}`;
      const links = menu('a').toArray().filter(e => menu(e).attr('href') === href);
      const excerpt = `href="${href}">${review.name}</a>`;
      const pins = (manifest.links || []).filter(l => l.url === DOC && l.anchor === anchor && l.label === review.name && l.discoveredAt === INDEX);
      if (ids(anchor).length || links.length !== 1 || menu(links[0]).text().trim() !== review.name || menu(links[0]).parent()[0]?.tagName !== 'li' ||
          menu(links[0]).attr('id') !== `webv3VSM_docs_WebDocs_${anchor}` || pins.length !== 1 ||
          !(links[0].sourceCodeLocation?.startOffset <= review.menuStart && links[0].sourceCodeLocation?.endOffset >= review.menuEnd) ||
          doc.text.includes(`id="${anchor}"`) || index.text.slice(review.menuStart,review.menuEnd) !== excerpt) continue;
      evidence = {index:{source:INDEX,kind:'index',sha256:IH,start:review.menuStart,end:review.menuEnd,excerpt},document:{source:DOC,kind:'document',sha256:DH,missingId:anchor},sdk:{source:SDK,kind:'sdk',sha256:SH,ast:astRows[0].evidence,runtime:rtRows[0]}};
      rationale = 'The unique V3 menu link points to an absent document ID. The SDK method exists; the intended navigation destination is unknown.';
    }
    result.open = result.open.filter(i => i !== original);
    evidence.capture = {
      auth: runtime.auth,
      bootstrap: {source:BOOT, kind:'sdk-script', sha256:BH},
      core: runtime.networkScripts.find(s => s.sha256 === SH && s.bytes === Buffer.byteLength(sdk.text) && s.status === 200 && s.pinned === true && s.classification === 'pinned-core'),
      phase: 'loaded',
    };
    result.resolved.push({status:'CONFIRMED_UPSTREAM_INCONSISTENCY',scope:review.stale?'Document heading identity only':'Document navigation only; target unknown',rationale,original,evidence});
  }
  return result;
  };
}

export const documentIdentityDispositions = createDocumentIdentityDisposer({DOC, INDEX, SDK, BOOT, DH, IH, SH, BH, OWNER, reviews});
