import {load} from 'cheerio';
import {parse} from 'acorn';
import {Script} from 'node:vm';
import {sha} from './common.mjs';
import profile from './document_source_reviews.json' with {type:'json'};

// The reviews describe only these occurrences in the pinned capture. A changed
// source, diagnostic, manifest, or ambiguous DOM leaves the diagnostic open.
export function createDocumentSourceDisposer(p) {
  return ({issues, manifest, sources}) => {
    const result = {open:[...issues], resolved:[]};
    if (!Array.isArray(issues) || !Array.isArray(sources) || !manifest || !Array.isArray(manifest.sources)) return result;
    const {id,...body} = manifest;
    if (id !== p.baseline || sha(JSON.stringify(body)) !== id) return result;
    const source = spec => {
      const pins = manifest.sources.filter(s => s.url === spec.url);
      const captures = sources.filter(s => s.url === spec.url);
      if (pins.length !== 1 || captures.length !== 1) return null;
      const pin = pins[0], s = captures[0];
      if (pin.kind !== 'document' || pin.role !== spec.role || pin.sha256 !== spec.sha256 ||
          s.kind !== 'document' || s.role !== spec.role || s.sha256 !== spec.sha256 ||
          typeof s.text !== 'string' || sha(s.text) !== spec.sha256 || Buffer.byteLength(s.text) !== pin.bytes) return null;
      return s;
    };
    const doc=source(p.parameterSource), guide=source(p.guideSource);
    const uniqueIssue = review => {
      const matches=issues.filter(i=>sha(JSON.stringify(i))===review.fingerprint);
      return matches.length===1 ? matches[0] : null;
    };
    const byteOffset = (text, offset) => Buffer.byteLength(text.slice(0,offset));
    const keep = (original, disposition) => {
      result.open = result.open.filter(i=>i!==original);
      result.resolved.push({...disposition,original});
    };
    if (doc) {
      const $=load(doc.text,{sourceCodeLocationInfo:true});
      const allHeading=$('h4[id]').toArray(), owners=$('h2').toArray(), allLi=$('li').toArray();
      for (const r of p.parameters) {
        const original=uniqueIssue(r), span=r.span;
        if (!original || original.code!=='document-type-unspecified' || original.id!==r.id || original.evidence?.line!==span.line || original.evidence?.source!==doc.url || original.evidence?.sha256!==doc.sha256 || issues.filter(i=>i.code==='document-type-unspecified' && i.id===r.id).length!==1) continue;
        const headings=allHeading.filter(e=>$(e).attr('id')===r.anchor);
        const h=headings[0], liMatches=allLi.filter(e=>e.sourceCodeLocation?.startOffset===span.start && e.sourceCodeLocation?.endOffset===span.end);
        const li=liMatches[0];
        if (headings.length!==1 || allHeading.filter(e=>$(e).text().trim()===r.method).length!==1 || $(h).text().trim()!==r.method || liMatches.length!==1 || !li || li.children.some(n=>n.type!=='text') ||
            doc.text.slice(span.start,span.end)!==span.excerpt || sha(span.excerpt)!==span.sliceSha256 || li.sourceCodeLocation.startLine!==span.line ||
            !new RegExp(`^\\s*-\\s*${r.name}\\s*:`).test($(li).text()) || /[{}]/.test($(li).text()) ||
            li.parent?.tagName!=='ul' || $(li.parent).prev().text().trim()!=='Parameters') continue;
        const preceding=allHeading.filter(e=>e.sourceCodeLocation.startOffset<span.start).at(-1);
        const owner=owners.filter(e=>e.sourceCodeLocation.startOffset<span.start).at(-1);
        if (preceding!==h || !owner || $(owner).text().trim()!=='Tmapv3.Tdata') continue;
        const controls=$(li.parent).children('li').toArray().filter(e=>e.sourceCodeLocation?.startOffset===r.control.start && e.sourceCodeLocation?.endOffset===r.control.end);
        if (controls.length!==1 || !$(controls[0]).text().trim().startsWith(r.control.text) || sha(doc.text.slice(r.control.start,r.control.end))!==r.control.sha256 || !/\{[^}]+\}|:\s*Object\b/.test(r.control.text)) continue;
        keep(original,{status:'SOURCE_TYPE_NOT_SPECIFIED',scope:'This parameter declaration in the pinned document only',rationale:'The exact parameter bullet omits an explicit type; its JavaScript type, semantics and validation remain unknown.',evidence:{document:{source:doc.url,kind:doc.kind,role:doc.role,sha256:doc.sha256,owner:'Tmapv3.Tdata',heading:r.method,anchor:r.anchor,span:{...span,offsetUnit:'UTF-16 code units',byteStart:byteOffset(doc.text,span.start),byteEnd:byteOffset(doc.text,span.end)},typedSibling:r.control},observedType:null,provenance:p.provenance}});
      }
    }
    if (guide) {
      const $=load(guide.text,{sourceCodeLocationInfo:true});
      for (const r of p.examples) {
        const original=uniqueIssue(r);
        if (!original || original.code!=='example-parse-failed' || original.evidence?.line!==r.line || original.evidence?.source!==guide.url || original.evidence?.sha256!==guide.sha256 || issues.filter(i=>i.code==='example-parse-failed' && i.evidence?.source===guide.url && i.evidence?.line===r.line).length!==1) continue;
        const elements=$('code,script:not([src])').toArray().filter(e=>e.sourceCodeLocation?.startLine===r.line);
        if (elements.length!==1) continue;
        const el=elements[0], loc=el.sourceCodeLocation, raw=guide.text.slice(loc.startOffset,loc.endOffset);
        const region=$('h3').toArray().filter(e=>e.sourceCodeLocation.startOffset<loc.startOffset).at(-1);
        const owner=$('h2[id]').toArray().filter(e=>e.sourceCodeLocation.startOffset<loc.startOffset).at(-1);
        if (sha(raw)!==r.outerSha256 || !region || $(region).text().trim()!==r.region || !owner || $(owner).attr('id')!=='sample2' ||
            !r.spans.every(s=>s.source===guide.url && s.sha256===guide.sha256 && s.kind==='document' && s.start>=loc.startOffset && s.end<=loc.endOffset && guide.text.slice(s.start,s.end)===s.excerpt)) continue;
        const code=$(el).text();
        const blocks=/<script[\s>]/i.test(code) ? (()=>{const inner=load(code); return inner('script:not([src])').toArray().map(e=>inner(e).text());})() : [code];
        const matching=blocks.filter(b=>sha(b)===r.scriptSha256);
        if (blocks.length!==1 || matching.length!==1) continue;
        const block=matching[0]; let error, v8error;
        try {parse(block,{ecmaVersion:'latest',allowReturnOutsideFunction:true});} catch(e) {error=e;}
        try {new Script(block);} catch(e) {v8error=e;}
        if (!error || error.message!==original.error || !v8error || v8error.name!=='SyntaxError' || r.browser.compiles!==false ||
            !r.browser.exception.startsWith('SyntaxError:') || r.browser.zeroBasedLine!==error.loc.line-1 || r.browser.zeroBasedColumn!==error.loc.column) continue;
        keep(original,{status:'CONFIRMED_UPSTREAM_INCONSISTENCY',scope:'Syntax of this exact example only',rationale:'The unmodified extracted script fails parsing; execution and runtime outcomes remain unverified.',evidence:{document:{source:guide.url,kind:guide.kind,role:guide.role,sha256:guide.sha256,owner:'sample2',region:r.region,start:loc.startOffset,end:loc.endOffset,offsetUnit:'UTF-16 code units',byteStart:byteOffset(guide.text,loc.startOffset),byteEnd:byteOffset(guide.text,loc.endOffset),raw,spans:r.spans},provenance:p.provenance,script:{text:block,sha256:r.scriptSha256,grammar:'ECMAScript script; Acorn latest with allowReturnOutsideFunction as extractor; V8 Script',error:error.message,position:error.pos,independentV8:v8error.message,recordedBrowser:r.browser}}});
      }
    }
    return result;
  };
}
export const documentSourceDispositions=createDocumentSourceDisposer(profile);
export function requiresDocumentSourceEvidence(manifest, issue) {
  return manifest?.id===profile.baseline && [...profile.parameters,...profile.examples].some(r=>r.fingerprint===sha(JSON.stringify(issue)));
}
