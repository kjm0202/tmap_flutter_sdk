import fs from 'node:fs';
import { load } from "cheerio";
import { extractDocumentedReverseResponse } from './documented_reverse_response.mjs';
import { extractRestFields } from './rest_fields.mjs';
import { extractDocumentedClusterPayload } from './documented_cluster_payload.mjs';
const exampleReviews=JSON.parse(fs.readFileSync(new URL('./example_reviews.json',import.meta.url),'utf8'));
const exampleFieldReviews=JSON.parse(fs.readFileSync(new URL('./example_field_reviews.json',import.meta.url),'utf8'));
const examplePayloadReviews=JSON.parse(fs.readFileSync(new URL('./example_payload_reviews.json',import.meta.url),'utf8'));
const exampleHostReviews=JSON.parse(fs.readFileSync(new URL('./example_host_reviews.json',import.meta.url),'utf8'));

export function getSegments(li, $) {
  const segments = [];
  let current = "";
  $(li).contents().each((_, node) => {
    if (node.type === 'text') {
      current += node.data;
    } else if (node.name === 'br') {
      segments.push(current);
      current = "";
    } else {
      current += $(node).text();
    }
  });
  segments.push(current);
  return segments.map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 0);
}

export function resolveReviewedEventRows(rows,call,review) {
  if(!['on','off','addListener','addEventListener'].includes(call.method)||
     review.category!=='sdk-example-context'||!review.target?.endsWith('#'+call.method))return;
  const owner=review.target.split('#')[0];
  for(const row of rows) {
    if(row.kind!=='event'||row.owner||!row.id.startsWith('unresolved-event-target!'))continue;
    if(!row.evidence.some(e=>['source','sha256','line','codeStart','codeEnd'].every(k=>e[k]===call.evidence[k])))continue;
    const originalId=row.id;
    row.id=owner+'!'+row.event;row.owner=owner;
    row.evidence=row.evidence.map(e=>({...e,originalId,receiverReview:{fingerprint:review.fingerprint,target:review.target,rationale:review.rationale}}));
  }
}
import { parse } from "acorn";
import * as walk from "acorn-walk";
import { memberPath } from "./ast.mjs";
import { issue, sha } from "./common.mjs";
import { extractExampleFields } from './example_fields.mjs';
import { exampleCallSdk } from './example_call_sources.mjs';
import { extractCallPaths } from './example_call_paths.mjs';
// Use the same outer element and embedded-script rules for extraction and
// review binding, including the outer element's source line.
function exampleBlocks(code) {
  if (!/<script[\s>]/i.test(code)) return [code];
  const html = load(code);
  return html('script:not([src])').toArray().map(el => html(el).text());
}
export function matchReviewedHostFields(reviews, manifest, source, line, block) {
  if (!source || typeof source.text !== 'string' || typeof block !== 'string' ||
      !['document','reference'].includes(source.kind) || sha(source.text) !== source.sha256 ||
      !manifest.sources?.some(s => s.url === source.url && s.sha256 === source.sha256 && s.kind === source.kind)) return [];
  const exactSlice = span => span && Number.isInteger(span.start) && Number.isInteger(span.end) &&
    span.start >= 0 && span.end > span.start && span.end <= block.length &&
    typeof span.excerpt === 'string' && span.excerpt.length > 0 &&
    block.slice(span.start,span.end) === span.excerpt;
  const directDomReceiver = expression => {
    try {
      const body = parse(`(${expression})`, {ecmaVersion:'latest'}).body;
      if (body.length !== 1 || body[0].type !== 'ExpressionStatement') return false;
      let node = body[0].expression;
      if (node.type !== 'MemberExpression') return false;
      while (node.type === 'MemberExpression') node = node.object;
      return node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        !node.callee.computed && node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'document' && node.callee.property.name === 'getElementById' &&
        node.arguments.length === 1 && node.arguments[0].type === 'Literal' &&
        typeof node.arguments[0].value === 'string';
    } catch { return false; }
  };
  const candidates = reviews.items.filter(r => r.source === source.url && r.sourceSha256 === source.sha256 &&
    r.line === line && r.blockSha256 === sha(block) &&
    exactSlice({start:r.start,end:r.end,excerpt:r.expression}) &&
    (!Object.hasOwn(r,'callback') || exactSlice(r.callback)) &&
    (exactSlice(r.declaration) || (r.declaration === null && r.kind !== 'regexp-exec-result' && directDomReceiver(r.expression))) &&
    (r.kind !== 'regexp-exec-result' || (exactSlice(r.callback) && exactSlice(r.declaration))));
  if (!candidates.length) return [];
  const $ = load(source.text, { sourceCodeLocationInfo: true });
  const actualBlock = $('code,script:not([src])').toArray().some(el =>
    el.sourceCodeLocation?.startLine === line && exampleBlocks($(el).text()).includes(block));
  return actualBlock ? candidates : [];
}
export function matchReviewedFieldCallbacks(reviews, manifest, source, sdk, line, block) {
  if (reviews.baselineId !== manifest.id || !sdk ||
      !manifest.sources?.some(s => s.kind === 'sdk' && s.sha256 === sdk.sha256) ||
      sha(sdk.text) !== sdk.sha256 || sha(source.text) !== source.sha256) return [];
  const exactSpans = (text, spans) => Array.isArray(spans) && spans.length > 0 &&
    spans.every(e => Number.isInteger(e.start) && Number.isInteger(e.end) &&
      e.start >= 0 && e.end > e.start && typeof e.excerpt === 'string' &&
      e.excerpt.length > 0 && text.slice(e.start,e.end) === e.excerpt);
  return reviews.items.filter(review => {
    const sdkEvidence = review.sdkEvidence ??
      [{start:review.sdkStart,end:review.sdkEnd,excerpt:review.sdkExcerpt}];
    return review.source === source.url && review.sourceSha256 === source.sha256 &&
      review.line === line && review.blockSha256 === sha(block) &&
      review.sdkSha256 === sdk.sha256 && exactSpans(sdk.text, sdkEvidence) &&
      (review.binding !== 'this' ||
        (Number.isInteger(review.callStart) && Number.isInteger(review.callEnd) &&
         typeof review.callExcerpt === 'string' && review.callExcerpt.length > 0 &&
         block.slice(review.callStart,review.callEnd) === review.callExcerpt &&
         exactSpans(block,review.sourceBindings)));
  });
}
export function matchReviewedPayloads(reviews, manifest, source, sources, line, block) {
  if (reviews.baselineId !== manifest.id || sha(source.text) !== source.sha256) return [];
  return reviews.items.filter(review => {
    const ref = sources.find(s => s.url === review.restReference?.url &&
      s.sha256 === review.restReference?.sha256 && s.kind === 'reference');
    if (review.source !== source.url || review.sourceSha256 !== source.sha256 ||
        review.line !== line || review.blockSha256 !== sha(block) || !ref ||
        !manifest.sources?.some(s => s.url === ref.url && s.sha256 === ref.sha256 && s.kind === 'reference') ||
        sha(ref.text) !== ref.sha256 || !Array.isArray(review.sourceEvidence) ||
        !review.sourceEvidence.length || !review.rationale ||
        !review.sourceEvidence.some(e => typeof review.endpoint === 'string' && e.excerpt.includes(review.endpoint))) return false;
    if (!review.sourceEvidence.every(e => Number.isInteger(e.start) && Number.isInteger(e.end) &&
      e.start >= 0 && e.end > e.start && typeof e.excerpt === 'string' &&
      block.slice(e.start,e.end) === e.excerpt)) return false;
    return Array.isArray(review.regions) && review.regions.length > 0 && review.regions.every(r =>
      typeof r.receiver === 'string' && Number.isInteger(r.start) && Number.isInteger(r.end) &&
      r.start >= 0 && r.end > r.start && Number.isInteger(r.bindingStart) &&
      Number.isInteger(r.bindingEnd) && r.bindingEnd > r.bindingStart &&
      Number.isInteger(r.expectedWrites) && typeof r.retainUnresolved === 'boolean' &&
      ['rest-response-field','rest-response-field-conditional'].includes(r.classification) &&
      (r.classification !== 'rest-response-field-conditional' || r.retainUnresolved));
  });
}
export function extractDocs(sources, manifest) {
  const rows = [],
    issues = [],
    examples = [],
    headings = [],
    scriptReferences = [],
    nonExecutableExamples = [],
    residualCalls = [],
    callPathCandidates = [],
    residualFields = [],
    responseFields = [],
    hostFields = [],
    conditionalCallbackFields = [],
    restReferenceFields = [];
  const sdk = sources.find(s => s.kind === 'sdk');
  const callSdk = exampleCallSdk(sdk, manifest);
  for (const source of sources.filter((s) =>
    ["document", "reference"].includes(s.kind),
  )) {
    const $ = load(source.text, { sourceCodeLocationInfo: true });
    const ev = (el, anchor) => ({
      channel: "docs",
      source: source.url,
      sha256: source.sha256,
      anchor: anchor || null,
      line: el?.sourceCodeLocation?.startLine ?? null,
    });
    const add = (id, kind, el, extra = {}) => {
      const row = { id, kind, evidence: [ev(el, $(el).attr("id"))], ...extra };
      rows.push(row);
      return row;
    };
    for (const link of manifest.links.filter(
      (l) => l.url === source.url && l.anchor,
    )) {
      if (
        !$("[id]")
          .toArray()
          .some((el) => $(el).attr("id") === link.anchor)
      )
        issues.push(
          issue("broken-menu-anchor", {
            source: source.url,
            anchor: link.anchor,
            label: link.label,
          }),
        );
    }
    if (source.kind === "reference") {
      const tables = $("table").toArray();
      const rest = extractRestFields(source, $, tables);
      restReferenceFields.push(...rest.fields);
      issues.push(...rest.diagnostics);
      for (let index = 0; index < tables.length; index++) {
        const el = tables[index];
        const cells = $(el)
          .find("tr")
          .toArray()
          .map((row) =>
            $(row)
              .children("th,td")
              .toArray()
              .map((cell) => $(cell).text().replace(/\s+/g, " ").trim()),
          );
        add(
          "rest-reference:" + source.url + ":table-" + index,
          "reference-table",
          el,
          { cells },
        );
      }
      issues.push(
        issue("rest-reference-schema-review-required", {
          source: source.url,
          tables: tables.length,
          reason:
            "Linked TData request/response tables preserved; field hierarchy and JS callback adapters not yet reconciled.",
        }),
      );
    }
    let owner = null,
      member = null,
      section = null,
      lastHeading = null;
    for (const el of $("h2,h3,h4,h5,ul").toArray()) {
      const tag = el.tagName,
        text = $(el).text().trim(),
        anchor = $(el).attr("id");
      if (/^h[2-5]$/.test(tag)) {
        headings.push({
          text,
          anchor: anchor || null,
          evidence: ev(el, anchor),
        });
        lastHeading = text;
        if (tag === "h2" && /^Tmapv3\./.test(text)) {
          owner = text.trim();
          member = null;
          section = null;
          add(owner, "class", el, { owner, documentAnchor: anchor });
        } else if (tag === "h3") {
          section = text;
          member = null;
          if (owner && text === "Constructor")
            add(owner + "#constructor", "constructor", el, { owner });
        } else if (tag === "h4" && anchor && owner) {
          member = text.replace(/\(.*$/, "").trim();
          add(owner + "#" + member, "method", el, {
            owner,
            name: member,
            documentAnchor: anchor,
          });
          const anchorName = anchor.split("_").at(-1);
          if (anchorName !== member)
            issues.push(
              issue("document-method-name-disagreement", {
                owner,
                title: member,
                anchorName,
                evidence: ev(el, anchor),
              }),
            );
        }
        continue;
      }
      if (
        !owner ||
        !["Parameters", "Returns", "Events", "Event", "Properties"].includes(
          lastHeading,
        )
      )
        continue;
      // Only process the list directly paired with a heading; nested lists are represented by their parent.
      const prev = $(el).prev();
      if (!/^h[345]$/.test(prev[0]?.tagName || "")) continue;
      const list = $(el).children("li").toArray();
      for (let index = 0; index < list.length; index++) {
        const li = list[index];
        const segments = getSegments(li, $);
        let formalParent = null;
        let formalParentId = null;
        let lastRowInLi = null;
        for (const [segmentIndex, raw] of segments.entries()) {
          if (/^[-–]?\s*$/.test(raw)) continue;

          const parentBase = owner + (member ? "#" + member : "#constructor");
          const formalMatches = [...raw.matchAll(/(?:^|[-\s])(?:&nbsp)?([A-Za-z_$][\w.$\[\]]*)\s*:?\s*(?:\{([^}]+)\}|(Object))/g)];
          if (formalMatches.length > 0) {
            const match = formalMatches[0];
            // Explicitly recognize 'params' or 'optionObj' even if not followed by ': Object'
            if (match[1] === 'optionObj' || match[1] === 'params' || match[2] === 'Object' || match[3] === 'Object') {
              formalParentId = parentBase + ":" + match[1];
            }
          }
          const parent = formalParentId || parentBase;
          if (lastHeading === "Returns") {
            add(parent + "->return", "return-contract", li, {
              owner,
              contract: raw,
            });
            continue;
          }
          const matches = [
            ...raw.matchAll(
              /(?:^|[-\s])(?:&nbsp)?([A-Za-z_$][\w.$\[\]]*)\s*:?\s*(?:\{([^}]+)\}|(Object))/g,
            ),
          ];
          if (!matches.length) {
            const typeFirst = raw.match(
              /^[-\s]*\{([^}]+)\}\s*([A-Za-z_$][\w.$]*)?(?:\s*:)?/,
            );
            const typeOnly = raw.match(
              /^[-\s]*(String|Number|Boolean|Object|Array|Function|Float|Integer|number|string|boolean)\b/,
            );
            if (typeFirst)
              matches.push([
                typeFirst[0],
                typeFirst[2] || `argument[${index}]`,
                typeFirst[1],
                null,
              ]);
            else if (typeOnly)
              matches.push([typeOnly[0], `argument[${index}]`, typeOnly[1], null]);
          }
          if (!matches.length) {
            const named = raw.match(/^[-\s]*([A-Za-z_$][\w.$]*)\s*:/);
            if (named) {
              matches.push([named[0], named[1], null]);
              issues.push(
                issue("document-type-unspecified", {
                  id: parent + ":" + named[1],
                  evidence: ev(li),
                }),
              );
            }
          }
          if (matches.length)
            for (const match of matches) {
              let name = match[1];
              if (raw.includes("&nbsp"))
                name =
                  "data." +
                  ({
                    data: "data",
                    lat: "data[].lat",
                    lng: "data[].lng",
                    value: "data[].value",
                    max: "max",
                  }[name] || name);
              const id = parentBase + ":" + name;
              const row = add(id, member ? "parameter" : "option", li, {
                owner,
                name,
                type: match[2] ?? match[3] ?? null,
                contract: raw,
                section,
              });
              lastRowInLi = !name.startsWith("argument[") && (match[2] || match[3]) ? row : null;
              if (formalParentId && formalParentId !== id) {
                add(formalParentId + ":" + name, member ? "parameter" : "option", li, {
                  owner,
                  name,
                  type: match[2] ?? match[3] ?? null,
                  contract: raw,
                  section,
                  parentId: formalParentId
                });
              }
              if (name === "eventName")
                for (const event of raw.matchAll(/"([A-Za-z_][\w:]*)"/g))
                  add(owner + "!" + event[1], "event", li, {
                    owner,
                    name: event[1],
                  });
            }
          else {
            add(parent + ":unparsed-" + index, "unparsed-contract", li, {
              owner,
              contract: raw,
              section,
            });
            const row = rows.at(-1);

            if (lastRowInLi && /^\s*(\*\s+|※|\(※)/.test(raw)) {
              if (!Array.isArray(lastRowInLi.note)) lastRowInLi.note = [];
              row.continuationOf = lastRowInLi.id;
              lastRowInLi.note.push({
                segmentIndex,
                text: raw.trim(),
                source: source.url,
                sha256: source.sha256,
                line: li?.sourceCodeLocation?.startLine ?? null,
              });
            } else {
              const newIssue = issue("unparsed-document-contract", {
                id: parent + ":unparsed-" + index,
                contract: raw,
                evidence: ev(li),
              });
              issues.push(newIssue);
              lastRowInLi = null;
            }
          }
        }
      }
    }
    for (const el of $("script[src]").toArray())
      scriptReferences.push({ url: $(el).attr("src"), evidence: ev(el) });
    for (const el of $("code,script:not([src])").toArray()) {
      const code = $(el).text();
      // Documentation also uses <code> for literal request/deep-link URLs.
      // Preserve those as source evidence without treating a hostname as JS.
      if (el.tagName === 'code' && /^https?:\/\/[^\s]+$/.test(code.trim())) {
        nonExecutableExamples.push({kind:'url', text:code.trim(), evidence:ev(el)});
        continue;
      }
      const legacyExample = /Tmapv3|\.on\(|addListener|\.js[?'"]/.test(code);
      if (!legacyExample && !/[A-Za-z_$][\w$]*\s*(?:\?\.|\.)\s*[A-Za-z_$]/.test(code)) continue;
      // Code blocks may contain complete HTML documents; extract their script bodies.
      const blocks = exampleBlocks(code);
      if (/<script[\s>]/i.test(code)) {
        const html = load(code);
        html("script[src]").each((_, e) =>
          scriptReferences.push({ url: html(e).attr("src"), evidence: ev(el) }),
        );
      }
      for (const block of blocks) {
        let tree;
        try {
          tree = parse(block, {
            ecmaVersion: "latest",
            allowReturnOutsideFunction: true,
          });
        } catch (e) {
          issues.push(
            issue("example-parse-failed", {
              evidence: ev(el),
              error: e.message,
            }),
          );
          continue;
        }
        const vars = new Map();
        walk.simple(tree, {
          VariableDeclarator(n) {
            if (
              n.init?.type === "NewExpression" &&
              memberPath(n.init.callee)?.startsWith("Tmapv3.")
            )
              vars.set(n.id.name, memberPath(n.init.callee));
          },
          AssignmentExpression(n) {
            if (
              n.left.type === "Identifier" &&
              n.right.type === "NewExpression" &&
              memberPath(n.right.callee)?.startsWith("Tmapv3.")
            )
              vars.set(n.left.name, memberPath(n.right.callee));
          },
        });
        // Conservative host origins. Ambiguous assignments remain unresolved.
        const origins = new Map(), assignments = [];
        walk.simple(tree, {
          VariableDeclarator(n) { if(n.id.type==='Identifier' && n.init) assignments.push([n.id.name,n.init]); },
          AssignmentExpression(n) { if(n.left.type==='Identifier') assignments.push([n.left.name,n.right]); },
        });
        const originOf = (n, depth=0) => {
          if(!n || depth>12) return null;
          if(n.type==='Identifier') return origins.get(n.name) || null;
          if(n.type==='ArrayExpression') return 'Array';
          if(n.type==='Literal' && typeof n.value==='string') return 'String';
          if(n.type==='NewExpression' && ['Date','Array','XMLHttpRequest','XMLSerializer'].includes(memberPath(n.callee))) return memberPath(n.callee);
          if(n.type==='CallExpression') {
            if(['$','jQuery'].includes(memberPath(n.callee))) return 'jQuery';
            if(n.callee.type==='MemberExpression') {
              const base=originOf(n.callee.object,depth+1), method=n.callee.property.name;
              if(base==='jQuery' && ['find','children','eq','filter','closest'].includes(method)) return 'jQuery';
              if(method==='split' && base==='String') return 'Array';
            }
          }
          return null;
        };
        for(let pass=0;pass<4;pass++) {
          const groups=new Map();
          for(const [name,expr] of assignments){ const group=groups.get(name)||new Set();group.add(originOf(expr));groups.set(name,group); }
          for(const [name,types] of groups) if(types.size===1 && !types.has(null)) origins.set(name,[...types][0]);
        }
        const ownerOf = (n) =>
          vars.get(memberPath(n)) ||
          (/^Tmapv3\./.test(memberPath(n) || "") ? memberPath(n) : null);
        const reference = (id, kind, n, extra = {}) => {
          const row = {
            id,
            kind,
            ...extra,
            evidence: [
              {
                ...ev(el),
                channel: "example",
                codeStart: n.start,
                codeEnd: n.end,
              },
            ],
          };
          rows.push(row);
          examples.push(row);
        };
        // Most blocks have no reviewed context; avoid hashing large source files
        // until an exact baseline, URL and line candidate exists.
        const reviewCandidates = exampleFieldReviews.items.some(review =>
          review.source === source.url && review.line === ev(el).line);
        const reviewedCallbacks = reviewCandidates
          ? matchReviewedFieldCallbacks(exampleFieldReviews, manifest, source, sdk, ev(el).line, block)
          : [];
        const payloadCandidates = examplePayloadReviews.items.some(review =>
          review.source === source.url && review.line === ev(el).line);
        const reviewedPayloads = payloadCandidates
          ? matchReviewedPayloads(examplePayloadReviews, manifest, source, sources, ev(el).line, block)
          : [];
        const hostCandidates = exampleHostReviews.items.some(review =>
          review.source === source.url && review.line === ev(el).line);
        const reviewedHosts = hostCandidates
          ? matchReviewedHostFields(exampleHostReviews, manifest, source, ev(el).line, block) : [];
        const fieldResults = extractExampleFields(tree, block, { reviewedCallbacks, reviewedPayloads, reviewedHosts });
        for (const field of fieldResults.fields) {
          reference(field.owner + '@' + field.path, 'instance-field', field,
            { owner: field.owner, name: field.path, access: field.access });
          rows.at(-1).evidence[0].access = field.access;
          if (field.access !== 'read') rows.at(-1).evidence[0].scope =
            'An example write can create an application-defined property; it does not establish an SDK-defined field.';
          if (field.review) rows.at(-1).evidence[0].receiverReview = {
            sourceSha256: field.review.sourceSha256,
            blockSha256: field.review.blockSha256,
            callbackStart: field.review.callbackStart,
            callbackEnd: field.review.callbackEnd,
            sdkSha256: field.review.sdkSha256,
            sdkStart: field.review.sdkStart,
            sdkEnd: field.review.sdkEnd,
            binding: field.review.binding,
            callStart: field.review.callStart,
            callEnd: field.review.callEnd,
            sourceBindings: field.review.sourceBindings,
            sdkEvidence: field.review.sdkEvidence,
            rationale: field.review.rationale,
          };
        }
        for (const field of fieldResults.unresolved) residualFields.push({
          ...field,
          classification: 'unresolved-receiver',
          evidence: { ...ev(el), codeStart: field.start, codeEnd: field.end },
        });
        for (const field of fieldResults.responseFields) responseFields.push({
          ...field,
          evidence: { ...ev(el), channel:'example', codeStart:field.start, codeEnd:field.end },
          verification: 'unverified',
          pathSemantics: 'Exact example expression; indices, length and locally grouped arrays need not be server JSON keys.',
        });
        for (const field of fieldResults.hostFields) hostFields.push({
          ...field,
          evidence: { ...ev(el), channel:'example', codeStart:field.start, codeEnd:field.end },
          verification:'unverified',
        });
        for (const field of fieldResults.conditionalCallbackFields) conditionalCallbackFields.push({
          ...field,
          evidence: { ...ev(el), channel:'example', codeStart:field.start, codeEnd:field.end },
          classification:'conditional-example-callback-receiver',
          verification:'unverified',
          limitation:'TData is the receiver on the reviewed native callback path; other invocations of the function remain unresolved. Nested paths under _responseData are response payload, not direct TData properties.',
        });
        // Newly considered field-only snippets must not create additional
        // call/event records without the existing receiver-review workflow.
        if (!legacyExample) continue;
        if (callSdk && sha(source.text) === source.sha256 &&
            manifest.sources?.some(s => s.kind === source.kind && s.url === source.url && s.sha256 === source.sha256)) {
          for (const call of extractCallPaths(tree, block, callSdk)) {
            if (!['Tmapv3.base.Size', 'Tmapv3.base.LatLng'].includes(call.owner)) continue;
            callPathCandidates.push({ ...call, blockSha256:sha(block),
              evidence:{...ev(el), codeStart:call.start, codeEnd:call.end} });
          }
        }
        walk.simple(tree, {
          NewExpression(n) {
            const name = memberPath(n.callee);
            if (name?.startsWith("Tmapv3.")) {
              reference(name, "class", n, { owner: name });
              for (const arg of n.arguments)
                if (arg.type === "ObjectExpression")
                  for (const p of arg.properties) {
                    const key = p.computed
                      ? p.key?.value
                      : (p.key?.name ?? p.key?.value);
                    if (key != null)
                      reference(name + "#constructor:" + key, "option", p, {
                        owner: name,
                        name: String(key),
                      });
                    else
                      issues.push(
                        issue("dynamic-example-option", { evidence: ev(el) }),
                      );
                  }
            }
          },
          CallExpression(n) {
            if (n.callee.type !== "MemberExpression") return;
            const owner = ownerOf(n.callee.object);
            const method = n.callee.computed
              ? n.callee.property.value
              : n.callee.property.name;
            if (owner && method)
              reference(owner + "#" + method, "method", n, {
                owner,
                name: method,
              });
            else if (method) {
              const receiver = memberPath(n.callee.object),
                knownPlatform =
                  /^(document|window|console|JSON|Math|Object|Array|Number|String|Date|navigator|hljs|\$)(\.|$)/.test(receiver || "") || !!originOf(n.callee.object);
              let classification = knownPlatform ? "platform-or-host-call" : "unresolved-receiver";
              let hostOrigin = originOf(n.callee.object);
              let declaration = null;
              if (!knownPlatform && method === 'push') {
                const localArrayCall = fieldResults.localArrayCalls.find(c => c.start === n.start && c.end === n.end);
                if (localArrayCall) {
                  classification = 'conditional-local-receiver';
                  hostOrigin = 'ArrayLiteral';
                  declaration = localArrayCall.declaration;
                }
              }
              const residualCall = {
                receiver,
                method,
                expression: block.slice(n.start,n.end),
                hostOrigin,
                classification,
                evidence: { ...ev(el), codeStart: n.start, codeEnd: n.end },
              };
              if (declaration) residualCall.declaration = declaration;
              residualCalls.push(residualCall);
            }
            if (
              ["on", "addListener", "addEventListener", "off"].includes(method)
            ) {
              const event = n.arguments.find(
                (a) => a.type === "Literal" && typeof a.value === "string",
              )?.value;
              if (event)
                reference(
                  (owner || "unresolved-event-target") + "!" + event,
                  "event",
                  n,
                  { owner, event },
                );
            }
          },
          MemberExpression(n) {
            const p = memberPath(n);
            if (p?.startsWith("Tmapv3."))
              examples.push({ path: p, evidence: ev(el) });
          },
        });
      }
    }
  }
  if (!rows.some((r) => r.kind === "class"))
    issues.push(issue("no-documented-classes"));
  for (const call of residualCalls) {
    if(call.classification!=='unresolved-receiver' || manifest.id!==exampleReviews.baselineId) continue;
    const fingerprint=sha(JSON.stringify({evidence:call.evidence,expression:call.expression}));
    const review=exampleReviews.items.find(r=>r.fingerprint===fingerprint);
    if(!review) continue;
    call.classification=review.category;
    call.review={rationale:review.rationale,target:review.target,scope:review.scope};
    if(review.target && review.category!=='upstream-example-defect') rows.push({
      id:review.target,kind:'method',owner:review.target.split('#')[0],
      name:call.method,evidence:[{...call.evidence,channel:'example-reviewed'}],
    });
    resolveReviewedEventRows(rows,call,review);
  }
  // Supplement only the exact legacy residual site; never change the historical row.
  const conditionalSdkCalls = callPathCandidates.flatMap(candidate => {
    const matches = residualCalls.filter(call => call.expression === candidate.expression &&
      ['source','sha256','line','codeStart','codeEnd'].every(k => call.evidence[k] === candidate.evidence[k]) &&
      ['unresolved-receiver','upstream-example-defect'].includes(call.classification));
    if (matches.length !== 1) return [];
    const call = matches[0];
    return [{ ...candidate, classification:'conditional-source-attribution', verification:'unverified',
      limitation:'This construction path assumes its initialization or invocation occurs and no intervening mutation or prototype replacement. Other invocations, initialization order, and runtime behavior remain unresolved.',
      ...(call.classification === 'upstream-example-defect' ? { historicConflict: {
        classification:call.classification, review:call.review,
        explanation:'The historical defect label conflicts with the recorded SDK prototype declaration and this construction path; it is retained unchanged in residualCalls.'
      }} : {}) }];
  });
  if (residualCalls.some((c) => c.classification === "unresolved-receiver"))
    issues.push(
      issue("example-receiver-dataflow-unresolved", {
        count: residualCalls.filter(
          (c) => c.classification === "unresolved-receiver",
        ).length,
        reason:
          "Every unmatched example member call is retained in residualCalls; aliases/indirect receivers need review.",
      }),
    );
  const scopedCluster = extractDocumentedClusterPayload(sources);
  for (let i = residualFields.length - 1; i >= 0; i--) {
    const rf = residualFields[i];
    if (scopedCluster.some(sc =>
      sc.evidence[0].source === rf.evidence.source &&
      sc.evidence[0].sha256 === rf.evidence.sha256 &&
      sc.blockLine === rf.evidence.line &&
      sc.start === rf.evidence.codeStart &&
      sc.end === rf.evidence.codeEnd
    )) {
      residualFields.splice(i, 1);
    }
  }
  if (residualFields.length)
    issues.push(issue('example-field-receiver-unresolved', {
      count: residualFields.length,
      reason: 'Instance member expressions with unknown or dynamic receivers are retained in residualFields; no SDK owner is inferred.',
    }));
  if (responseFields.length)
    issues.push(issue('example-rest-response-fields-unverified', {
      count: responseFields.length,
      reason: 'These source-bound REST response paths remain preserved in responseFields; provenance does not validate their schemas, runtime responses or any SDK contract.',
    }));
  rows.push(...extractDocumentedReverseResponse(sources));
  rows.push(...scopedCluster);
  return {
    rows,
    issues,
    examples,
    headings,
    scriptReferences,
    nonExecutableExamples,
    residualCalls,
    conditionalSdkCalls,
    residualFields,
    responseFields,
    restReferenceFields,
    restReferenceFieldSummary: { total: restReferenceFields.length, status: 'unverified',
      limitations: 'Display hierarchy only; unknown directions and ambiguous rows require review. No wire schema, endpoint ownership, runtime behavior, JS or Flutter support is established.' },
    hostFields,
    conditionalCallbackFields,
    hostFieldSummary: {total:hostFields.length, executionVerification:'unverified',
      condition:'Source-bound host attribution only, under each recorded standard-host condition; execution remains unverified.'},
    responseFieldSummary: {
      total: responseFields.length,
      direct: responseFields.filter(f => f.classification === 'rest-response-field').length,
      conditional: responseFields.filter(f => f.classification === 'rest-response-field-conditional').length,
      schemaVerification: 'unverified',
      referenceSources: [...new Set(responseFields.map(f => f.restReference.url))],
    },
    documentCount: sources.filter((s) =>
      ["document", "reference"].includes(s.kind),
    ).length,
  };
}
