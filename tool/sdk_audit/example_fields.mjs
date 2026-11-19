import * as walk from 'acorn-walk';
import { memberPath } from './ast.mjs';

const isFunction = n => ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
const isScope = n => ['Program','BlockStatement','CatchClause','ForStatement',
  'ForInStatement','ForOfStatement','SwitchStatement','StaticBlock'].includes(n.type) || isFunction(n);
const hostRoots = new Set(['document','window','console','JSON','Math','Object','Array','Number','String','Date','navigator','location','history','performance','localStorage','sessionStorage','URL','URLSearchParams','jQuery','$']);
const windowHostObjects = new Set(['document','location','console','navigator','Math','JSON','Object','Array','Number','String','Date','localStorage','sessionStorage','performance','history']);

export function names(pattern, output = []) {
  if (!pattern) return output;
  if (pattern.type === 'Identifier') output.push(pattern.name);
  else if (pattern.type === 'RestElement') names(pattern.argument, output);
  else if (pattern.type === 'AssignmentPattern') names(pattern.left, output);
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(p => names(p, output));
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach(p => names(p.type === 'RestElement' ? p.argument : p.value, output));
  return output;
}

export function walkExampleOptions(node, {
  parent,
  owner,
  isMethod = false,
  prefix = "",
  source,
  el,
  block,
  reference,
  onIssue,
}) {
  if (!node) return;
  const baseOffset = el?.sourceCodeLocation?.startTag?.endOffset ?? el?.sourceCodeLocation?.startOffset ?? 0;
  const locOf = (n) => {
    const fileOffset = baseOffset + (n.start ?? 0);
    const fileLine = source?.text
      ? source.text.slice(0, fileOffset).split('\n').length
      : (el?.sourceCodeLocation?.startLine ?? null);
    return { fileOffset, fileLine };
  };
  const makeEvidence = (n) => {
    const { fileOffset, fileLine } = locOf(n);
    return {
      channel: "example",
      source: source?.url ?? null,
      sha256: source?.sha256 ?? null,
      anchor: null,
      line: fileLine,
      offset: fileOffset,
      codeStart: n.start,
      codeEnd: n.end,
    };
  };

  const rowKind = isMethod ? "parameter" : "option";

  if (node.type === "ObjectExpression") {
    for (const p of node.properties) {
      if (p.type === "SpreadElement") {
        const ev = makeEvidence(p);
        const detail = {
          parent,
          owner,
          prefix: prefix || null,
          expression: block ? block.slice(p.start, p.end) : null,
          evidence: ev,
        };
        onIssue?.("dynamic-example-spread", detail);
        onIssue?.("dynamic-example-option", { kind: "spread", ...detail });
        continue;
      }
      if (p.type === "Property") {
        let key = null;
        if (p.computed) {
          if (p.key.type === "Literal" && p.key.value != null) {
            key = String(p.key.value);
          } else {
            const ev = makeEvidence(p.key);
            const detail = {
              parent,
              owner,
              prefix: prefix || null,
              expression: block ? block.slice(p.key.start, p.key.end) : null,
              evidence: ev,
            };
            onIssue?.("dynamic-example-computed-key", detail);
            onIssue?.("dynamic-example-option", { kind: "computed-key", ...detail });
            continue;
          }
        } else {
          key = p.key.name ?? (p.key.value != null ? String(p.key.value) : null);
        }
        if (key != null) {
          const qualifiedName = prefix ? `${prefix}.${key}` : key;
          const val = p.value;
          if (val?.type === "ObjectExpression") {
            reference?.(parent + ":" + qualifiedName, rowKind, p, {
              owner,
              name: qualifiedName,
              evidence: [makeEvidence(p)],
            });
            walkExampleOptions(val, {
              parent,
              owner,
              isMethod,
              prefix: qualifiedName,
              source,
              el,
              block,
              reference,
              onIssue,
            });
          } else if (val?.type === "ArrayExpression") {
            reference?.(parent + ":" + qualifiedName, rowKind, p, {
              owner,
              name: qualifiedName,
              evidence: [makeEvidence(p)],
            });
            walkExampleOptions(val, {
              parent,
              owner,
              isMethod,
              prefix: qualifiedName + "[]",
              source,
              el,
              block,
              reference,
              onIssue,
            });
          } else if (val?.type === "FunctionExpression" || val?.type === "ArrowFunctionExpression") {
            reference?.(parent + ":" + qualifiedName, rowKind, p, {
              owner,
              name: qualifiedName,
              evidence: [makeEvidence(p)],
            });
            if (qualifiedName.includes("[]")) {
              const dotName = qualifiedName.replace(/\[\]/g, "");
              reference?.(parent + ":" + dotName, rowKind, p, {
                owner,
                name: dotName,
                aliasOf: qualifiedName,
                evidence: [makeEvidence(p)],
              });
            }
            for (const param of val.params) {
              for (const paramName of names(param)) {
                reference?.(parent + ":" + qualifiedName + ":" + paramName, "parameter", param, {
                  owner,
                  name: paramName,
                  callback: qualifiedName,
                  evidence: [makeEvidence(param)],
                });
                if (qualifiedName.includes("[]")) {
                  const dotName = qualifiedName.replace(/\[\]/g, "");
                  reference?.(parent + ":" + dotName + ":" + paramName, "parameter", param, {
                    owner,
                    name: paramName,
                    callback: dotName,
                    aliasOf: qualifiedName + ":" + paramName,
                    evidence: [makeEvidence(param)],
                  });
                }
              }
            }
          } else {
            const extra = {
              owner,
              name: qualifiedName,
              evidence: [makeEvidence(p)],
            };
            if (val?.type === "Literal") {
              extra.exampleValue = val.value;
            } else if (val?.type === "UnaryExpression" && val.operator === "-" && val.argument?.type === "Literal") {
              extra.exampleValue = -val.argument.value;
            } else if (val && block) {
              extra.exampleExpression = block.slice(val.start, val.end);
            }
            reference?.(parent + ":" + qualifiedName, rowKind, p, extra);
            if (qualifiedName.includes("[]")) {
              const dotName = qualifiedName.replace(/\[\]/g, "");
              reference?.(parent + ":" + dotName, rowKind, p, {
                ...extra,
                name: dotName,
                aliasOf: qualifiedName,
              });
            }
          }
        }
      }
    }
  } else if (node.type === "ArrayExpression") {
    for (const elem of node.elements) {
      if (!elem) continue;
      if (elem.type === "SpreadElement") {
        const ev = makeEvidence(elem);
        const detail = {
          parent,
          owner,
          prefix: prefix || null,
          expression: block ? block.slice(elem.start, elem.end) : null,
          evidence: ev,
        };
        onIssue?.("dynamic-example-spread", detail);
        onIssue?.("dynamic-example-option", { kind: "spread", ...detail });
        continue;
      }
      if (elem.type === "ObjectExpression") {
        walkExampleOptions(elem, {
          parent,
          owner,
          isMethod,
          prefix,
          source,
          el,
          block,
          reference,
          onIssue,
        });
      } else if (elem.type === "ArrayExpression") {
        walkExampleOptions(elem, {
          parent,
          owner,
          isMethod,
          prefix: prefix + "[]",
          source,
          el,
          block,
          reference,
          onIssue,
        });
      } else if (elem.type === "FunctionExpression" || elem.type === "ArrowFunctionExpression") {
        for (const param of elem.params) {
          for (const paramName of names(param)) {
            reference?.(parent + ":" + prefix + ":" + paramName, "parameter", param, {
              owner,
              name: paramName,
              callback: prefix,
              evidence: [makeEvidence(param)],
            });
            if (prefix.includes("[]")) {
              const dotName = prefix.replace(/\[\]/g, "");
              reference?.(parent + ":" + dotName + ":" + paramName, "parameter", param, {
                owner,
                name: paramName,
                callback: dotName,
                aliasOf: prefix + ":" + paramName,
                evidence: [makeEvidence(param)],
              });
            }
          }
        }
      }
    }
  }
}

// Source-local, conservative lexical binding analysis. An ambiguous binding,
// mutation, unknown callback or dynamic receiver remains unresolved.
export function extractExampleFields(tree, block, { reviewedCallbacks = [], reviewedPayloads = [], reviewedHosts = [] } = {}) {
  const bindings = new Map(), fields = [], unresolved = [], responseFields = [], hostFields = [], conditionalCallbackFields = [], localArrayCalls = [];
  const declarations = [];
  let mutatedDocument = false;
  walk.simple(tree, {
    AssignmentExpression(n) {
      const path = n.left.type === 'Identifier' ? n.left.name : memberPath(n.left);
      if (['document','window.document','document.getElementById','window.document.getElementById'].includes(path)) mutatedDocument = true;
    },
    UpdateExpression(n) {
      const path = n.argument.type === 'Identifier' ? n.argument.name : memberPath(n.argument);
      if (['document','window.document','document.getElementById','window.document.getElementById'].includes(path)) mutatedDocument = true;
    },
    ForOfStatement(n) { if (n.left.type !== 'VariableDeclaration' && names(n.left).includes('document')) mutatedDocument = true; },
    ForInStatement(n) { if (n.left.type !== 'VariableDeclaration' && names(n.left).includes('document')) mutatedDocument = true; },
  });
  const calls = new Set();
  walk.simple(tree, { CallExpression(n) { calls.add(`${n.start}:${n.end}`); } });
  const scopes = ancestors => ancestors.filter(isScope);
  function lexicalArray(name, ancestors, usageNode) {
    const binding = lookup(name, ancestors);
    if (!binding || binding.ambiguous || binding.writes > 0) return null;
    const def = binding.definition;
    if (!def || def.type !== 'VariableDeclarator' || !def.init || def.init.type !== 'ArrayExpression') return null;
    if (def.end > usageNode.start) return null;

    const declParent = binding.ancestors.at(-2);
    if (!declParent || !(declParent.type === 'Program' || declParent.type === 'BlockStatement') || !ancestors.includes(declParent)) return null;

    const declFn = binding.ancestors.findLast(isFunction) || binding.ancestors[0];
    const useFn = ancestors.findLast(isFunction) || ancestors[0];
    if (declFn !== useFn) return null;
    return binding;
  }
  const table = scope => { if (!bindings.has(scope)) bindings.set(scope, new Map()); return bindings.get(scope); };
  const declare = (scope, name, value, ancestors, kind, definition = null) => {
    const t = table(scope), old = t.get(name);
    if (old) { old.ambiguous = true; return; }
    t.set(name, { value, ancestors, kind, definition, writes: 0, ambiguous: false });
  };
  const lookup = (name, ancestors) => {
    for (const scope of scopes(ancestors).reverse()) {
      const binding = bindings.get(scope)?.get(name);
      if (binding) return binding;
    }
    return null;
  };
  walk.ancestor(tree, {
    VariableDeclarator(n, ancestors) {
      declarations.push(n);
      const declaration = ancestors.at(-2), candidates = scopes(ancestors.slice(0,-1));
      const target = declaration.kind === 'var'
        ? candidates.findLast(s => s.type === 'Program' || isFunction(s))
        : candidates.at(-1);
      for (const name of names(n.id)) declare(target, name, n.id.type === 'Identifier' ? n.init : null, ancestors.slice(0,-1), 'variable', n);
    },
    FunctionDeclaration(n, ancestors) {
      if (n.id) {
        const target = scopes(ancestors.slice(0,-1)).at(-1);
        declare(target, n.id.name, null, ancestors.slice(0,-1), 'function');
      }
      for (const name of n.params.flatMap(p => names(p))) declare(n, name, null, ancestors, 'parameter');
    },
    FunctionExpression(n, ancestors) {
      if (n.id) declare(n, n.id.name, null, ancestors, 'function-name');
      for (const name of n.params.flatMap(p => names(p))) declare(n, name, null, ancestors, 'parameter');
    },
    ArrowFunctionExpression(n, ancestors) {
      for (const name of n.params.flatMap(p => names(p))) declare(n, name, null, ancestors, 'parameter');
    },
    CatchClause(n, ancestors) {
      for (const name of names(n.param)) declare(n, name, null, ancestors, 'parameter');
    },
    ClassDeclaration(n, ancestors) {
      if (n.id) declare(scopes(ancestors.slice(0,-1)).at(-1), n.id.name, null, ancestors.slice(0,-1), 'class');
    },
  });
  walk.ancestor(tree, {
    AssignmentExpression(n, ancestors) {
      for (const name of names(n.left)) { const b = lookup(name, ancestors); if (b) b.writes++; }
    },
    UpdateExpression(n, ancestors) {
      for (const name of names(n.argument)) { const b = lookup(name, ancestors); if (b) b.writes++; }
    },
    ForInStatement(n, ancestors) {
      if (n.left.type !== 'VariableDeclaration')
        for (const name of names(n.left)) { const b = lookup(name, ancestors); if (b) b.writes++; }
    },
    ForOfStatement(n, ancestors) {
      if (n.left.type !== 'VariableDeclaration')
        for (const name of names(n.left)) { const b = lookup(name, ancestors); if (b) b.writes++; }
    },
  });
  walk.ancestor(tree, {
    CallExpression(n, ancestors) {
      if (n.callee.type !== 'MemberExpression' || n.callee.property.name !== 'push' || n.callee.computed) return;
      const root = n.callee.object;
      if (root.type !== 'Identifier') return;
      const binding = lexicalArray(root.name, ancestors, n);
      if (binding) {
        localArrayCalls.push({
          start: n.start,
          end: n.end,
          declaration: {
            start: binding.definition.start,
            end: binding.definition.end,
            excerpt: block.slice(binding.definition.start, binding.definition.end)
          }
        });
      }
    }
  });
  function resolve(name, ancestors, at, seen = new Set()) {
    const b = lookup(name, ancestors);
    if (!b || b.ambiguous || b.writes || seen.has(b)) return null;
    if (b.kind === 'parameter') {
      const fn = ancestors.findLast(n => isFunction(n) && table(n).get(name) === b);
      const review = reviewedCallbacks.find(r => fn && r.callbackStart === fn.start && r.callbackEnd === fn.end && r.parameter === name && ancestors.some(n => n.type === 'CallExpression' && n.start === r.callStart && n.end === r.callEnd));
      return review ? { owner: review.owner, review } : null;
    }
    if (!b.value || b.value.end > at) return null;
    seen.add(b);
    if (b.value.type === 'NewExpression') {
      const owner = memberPath(b.value.callee);
      if (owner?.startsWith('Tmapv3.') && !lookup('Tmapv3', b.ancestors)) return { owner };
    }
    if (b.value.type === 'Identifier') return resolve(b.value.name, b.ancestors, b.value.start, seen);
    return null;
  }
  function preserveUnknown(n, root, parts, dynamic, access, ancestors) {
    const item = { expression:block.slice(n.start,n.end), receiver:root.name, dynamic, start:n.start, end:n.end };
    const binding = lookup(root.name, ancestors);
    const fn = ancestors.findLast(isFunction);
    for (const review of reviewedPayloads) {
      const region = review.regions.find(r => r.receiver === root.name && fn &&
        fn.start === r.start && fn.end === r.end && fn.type === r.functionType &&
        (!r.functionName || fn.id?.name === r.functionName) &&
        n.start >= (r.after ?? r.start) && n.end <= r.end && binding &&
        !binding.ambiguous && binding.definition?.start === r.bindingStart &&
        binding.definition?.end === r.bindingEnd && binding.writes === r.expectedWrites);
      if (!region) continue;
      responseFields.push({...item, access, classification:region.classification,
        retainUnresolved:region.retainUnresolved, reviewId:review.id,
        blockSha256:review.blockSha256, endpoint:review.endpoint, restReference:review.restReference,
        sourceEvidence:review.sourceEvidence, rationale:review.rationale});
      if (region.retainUnresolved) unresolved.push(item);
      return;
    }
    unresolved.push(item);
  }
  walk.ancestor(tree, {
    MemberExpression(n, ancestors) {
      const parent = ancestors.at(-2);
      // Calling or constructing a member records a method elsewhere; do not
      // silently invent a same-named instance field.
      if ((parent?.type === 'CallExpression' || parent?.type === 'NewExpression') && parent.callee === n) return;
      const access = parent?.type === 'AssignmentExpression' && parent.left === n
        ? (parent.operator === '=' ? 'write' : 'read-write')
        : parent?.type === 'UpdateExpression' && parent.argument === n
          ? 'read-write' : 'read';
      let root = n, parts = [], dynamic = false;
      while (root.type === 'MemberExpression') {
        const key = root.computed ? (root.property.type === 'Literal' ? root.property.value : null) : root.property.name;
        if (key === null || key === undefined) dynamic = true;
        else parts.unshift(String(key));
        root = root.object;
      }
      // A with-object can intercept identifier lookup even when an outer
      // lexical variable appeared to have a known constructor.
      if (ancestors.some(a => a.type === 'WithStatement')) {
        unresolved.push({ expression:block.slice(n.start,n.end), receiver:root.type === 'Identifier' ? root.name : null, dynamic:true, start:n.start, end:n.end });
        return;
      }
      // Host attribution is restricted to the individually pinned expression,
      // exact DOM declaration, and a straight-line local use. No API contract
      // or successful DOM lookup follows from this evidence.
      const host = reviewedHosts.find(r => r.start === n.start && r.end === n.end &&
        r.expression === block.slice(n.start,n.end));
      if (host?.kind === 'regexp-exec-result' && !dynamic && access === 'read' &&
          root.type === 'Identifier' && root.name === 'results' && parts.length === 1 && parts[0] === '1' &&
          !lookup('RegExp', ancestors) && !lookup('window', ancestors)) {
        const callback = ancestors.findLast(isFunction), binding = lookup('results', ancestors);
        const declaration = binding?.definition, init = declaration?.init;
        const regex = init?.callee?.object;
        // Exact reviewed function bytes protect its null guard and control flow.
        // This is conditional host provenance, never a successful execution claim.
        const valid = callback && callback.start === host.callback?.start && callback.end === host.callback?.end &&
          block.slice(callback.start,callback.end) === host.callback.excerpt &&
          binding && !binding.ambiguous && binding.writes === 0 &&
          declaration.start === host.declaration?.start && declaration.end === host.declaration?.end &&
          block.slice(declaration.start,declaration.end) === host.declaration.excerpt &&
          init?.type === 'CallExpression' &&
          init.callee?.type === 'MemberExpression' && !init.callee.computed && init.callee.property.name === 'exec' &&
          regex?.type === 'NewExpression' && regex.callee.type === 'Identifier' && regex.callee.name === 'RegExp' &&
          init.arguments.length === 1 && memberPath(init.arguments[0]) === 'window.location.href';
        if (valid) {
          hostFields.push({expression:block.slice(n.start,n.end),receiver:root.name,start:n.start,end:n.end,access,
            classification:'regexp-result-conditional',reviewId:host.id,blockSha256:host.blockSha256,
            declaration:host.declaration,callback:host.callback,
            condition:'Standard unshadowed RegExp.exec and window.location; successful match is guarded by a null check in the pinned function. Host monkey-patching and execution are not verified.',
            rationale:'Documentation-page URL query parsing, not an SDK object field.'});
          return;
        }
      }
      if (host && !dynamic && !lookup('document', ancestors) && !mutatedDocument) {
        const domCall = call => call?.type === 'CallExpression' &&
          call.callee?.type === 'MemberExpression' && !call.callee.computed &&
          call.callee.object?.type === 'Identifier' && call.callee.object.name === 'document' &&
          call.callee.property?.name === 'getElementById' && call.arguments.length === 1 &&
          call.arguments[0].type === 'Literal' && typeof call.arguments[0].value === 'string';
        let valid = !host.declaration && domCall(root);
        if (host.declaration && root.type === 'Identifier') {
          const declaration = declarations.find(d => d.start === host.declaration.start &&
            d.end === host.declaration.end && d.id.type === 'Identifier' && d.id.name === root.name &&
            block.slice(d.start,d.end) === host.declaration.excerpt && domCall(d.init));
          const statement = ancestors.findLast(a => a.type === 'ExpressionStatement');
          const container = ancestors.findLast(a => ['BlockStatement','Program'].includes(a.type) && a.body.includes(statement));
          const index = container?.body.indexOf(statement) ?? -1;
          const declarationIndex = container?.body.findIndex(s => s.type === 'VariableDeclaration' && s.declarations.includes(declaration)) ?? -1;
          const between = declarationIndex >= 0 && index > declarationIndex ? container.body.slice(declarationIndex+1,index) : null;
          valid = !!declaration && !!between && between.every(s => s.type === 'ExpressionStatement' &&
            s.expression.type === 'AssignmentExpression' && s.expression.operator === '=' &&
            s.expression.right.type === 'Literal' &&
            block.slice(s.expression.left.start,s.expression.left.end) === 'mapResize.style.width');
        }
        if (valid) {
          hostFields.push({expression:block.slice(n.start,n.end),receiver:root.type === 'Identifier' ? root.name : null,
            start:n.start,end:n.end,access,classification:'dom-result-conditional',reviewId:host.id,
            blockSha256:host.blockSha256,declaration:host.declaration,
            condition:'Standard unshadowed DOM API and style behavior; getElementById may return null.',
            rationale:'Source-bound DOM attribution only; example execution and SDK contracts remain unverified.'});
          return;
        }
      }
      if (root.type === 'ThisExpression' && !dynamic) {
        // `this` is only attributed in the exact, source-reviewed callback.
        // A nested function has its own receiver and remains unresolved.
        const callback = ancestors.findLast(isFunction);
        const review = reviewedCallbacks.find(r => r.binding === 'this' && callback &&
          callback.start === r.callbackStart && callback.end === r.callbackEnd &&
          callback.type === 'FunctionDeclaration' && callback.id?.name === r.callbackName &&
          calls.has(`${r.callStart}:${r.callEnd}`) &&
          block.slice(r.callStart,r.callEnd) === r.callExcerpt);
        if (review) {
          const field = {owner:review.owner,path:parts.join('.'),expression:block.slice(n.start,n.end),access,start:n.start,end:n.end,review};
          if (review.retainUnresolved) {
            // A globally callable example function can also be invoked with an
            // arbitrary receiver. Preserve its source-reviewed TData path
            // without upgrading every invocation to an SDK field contract.
            conditionalCallbackFields.push(field);
            unresolved.push({expression:field.expression,receiver:'this',dynamic:false,start:n.start,end:n.end});
          } else fields.push(field);
          return;
        }
      }
      if (root.type === 'NewExpression' && !dynamic) {
        const owner = memberPath(root.callee);
        if (owner?.startsWith('Tmapv3.') && !lookup('Tmapv3', ancestors)) {
          fields.push({ owner, path:parts.join('.'), expression:block.slice(n.start,n.end), access, start:n.start, end:n.end });
          return;
        }
      }
      if (root.type !== 'Identifier') {
        unresolved.push({ expression: block.slice(n.start,n.end), receiver:root.type === 'ThisExpression' ? 'this' : null, dynamic, start:n.start, end:n.end });
        return;
      }
      if (root.name === 'Tmapv3' && !lookup(root.name, ancestors)) return;
      const result = resolve(root.name, ancestors, n.start);
      if (result && !dynamic && parts.length) {
        fields.push({ owner:result.owner, path:parts.join('.'), expression:block.slice(n.start,n.end), access, start:n.start, end:n.end, ...(result.review ? { review:result.review } : {}) });
      } else {
        if (hostRoots.has(root.name) && !lookup(root.name, ancestors) &&
            (root.name !== 'window' || parts.length <= 1 || windowHostObjects.has(parts[0]))) return;
        preserveUnknown(n, root, parts, dynamic, access, ancestors);
      }
    },
  });
  return { fields, unresolved, responseFields, hostFields, conditionalCallbackFields, localArrayCalls };
}
