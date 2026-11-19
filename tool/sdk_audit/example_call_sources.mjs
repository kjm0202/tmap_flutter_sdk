import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { names } from './example_fields.mjs';
import { extractAST, memberPath } from './ast.mjs';
import { sha } from './common.mjs';

// Only captured SDK bytes named by the manifest may supply declaration proof.
export function exampleCallSdk(sdk, manifest) {
  if (!sdk || typeof sdk.text !== 'string' || !sdk.url || sha(sdk.text) !== sdk.sha256 ||
      !manifest.sources?.some(s => s.kind === 'sdk' && s.url === sdk.url && s.sha256 === sdk.sha256)) return null;
  const ast = extractAST(sdk), methods = new Map(), aliases = new Map();
  let tree;
  try { tree = parse(sdk.text, {ecmaVersion:'latest'}); } catch { return null; }
  for (const statement of tree.body) {
    const n = statement.type === 'ExpressionStatement' ? statement.expression : null;
    const left = n?.type === 'AssignmentExpression' && n.operator === '=' ? memberPath(n.left) : null;
    const right = memberPath(n?.right);
    if (!left?.startsWith('Tmapv3.')) continue;
    const list = aliases.get(left) || [];
    list.push({target:right?.startsWith('Tmapv3.') ? right : null, proof:{source:sdk.url,sha256:sdk.sha256,start:n.start,end:n.end,excerpt:sdk.text.slice(n.start,n.end)}});
    aliases.set(left,list);
  }
  if (ast.issues.some(i => i.code === 'sdk-parse-failed')) return null;
  // Bind each method to the constructor returned by its own namespace factory.
  // A similarly named local prototype in a nested function/block is not proof.
  const lexicalMethods = new Map();
  const span = n => ({source:sdk.url, sha256:sdk.sha256, start:n.start, end:n.end,
    excerpt:sdk.text.slice(n.start,n.end)});
  walk.ancestor(tree, {CallExpression(call, ancestors) {
    if (ancestors.some(n => ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))) return;
    if (memberPath(call.callee) !== 'Tmapv3.createNamespace' ||
        typeof call.arguments[0]?.value !== 'string') return;
    const value = call.arguments[1], factory = value?.type === 'CallExpression' ? value.callee : null;
    if (!factory || !['FunctionExpression','ArrowFunctionExpression'].includes(factory.type) || factory.body.type !== 'BlockStatement') return;
    const returns = factory.body.body.filter(n => n.type === 'ReturnStatement');
    const ctorName = returns.length === 1 && returns[0].argument?.type === 'Identifier' ? returns[0].argument.name : null;
    if (!ctorName) return;
    const ctors = factory.body.body.flatMap(n => n.type === 'FunctionDeclaration' && n.id?.name === ctorName ? [n] :
      n.type === 'VariableDeclaration' ? n.declarations.filter(d => names(d.id).includes(ctorName)) : []);
    if (ctors.length !== 1 || (ctors[0].type === 'VariableDeclarator' && !['FunctionExpression','ArrowFunctionExpression'].includes(ctors[0].init?.type))) return;
    let rebound = false;
    walk.ancestor(factory.body, {
      AssignmentExpression(n, ancestors) {
        if (n.left.type === 'Identifier' && n.left.name === ctorName && !ancestors.some(a => ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(a.type))) rebound = true;
      },
      UpdateExpression(n, ancestors) {
        if (n.argument.type === 'Identifier' && n.argument.name === ctorName && !ancestors.some(a => ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(a.type))) rebound = true;
      },
    });
    if (rebound) return;
    walk.ancestor(factory.body, {AssignmentExpression(n, ancestors) {
      if (ancestors.some(a => a !== factory.body && (a.type === 'BlockStatement' ||
          ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(a.type)))) return;
      const path = memberPath(n.left);
      if (!path?.startsWith(ctorName + '.prototype.')) return;
      lexicalMethods.set(n.start, {registration:span(call), constructor:span(ctors[0]), owner:call.arguments[0].value});
    }});
  }});
  for (const row of ast.rows) {
    if (row.kind !== 'method' || row.static || !row.id.includes('#')) continue;
    for (const ev of row.evidence) {
      const lexical = lexicalMethods.get(ev.start);
      if (!lexical || lexical.owner !== row.owner) continue;
      const excerpt = sdk.text.slice(ev.start, ev.end);
      try {
        const n = parse('(' + excerpt + ')', {ecmaVersion:'latest'}).body[0].expression;
        if (n.type !== 'AssignmentExpression' || n.operator !== '=' || n.right.type !== 'FunctionExpression' ||
            !memberPath(n.left)?.endsWith('.prototype.' + row.id.split('#')[1])) continue;
        const proof = {source:sdk.url, sha256:sdk.sha256, start:ev.start, end:ev.end, excerpt};
        const statements = n.right.body.body;
        const last = statements.at(-1);
        const ret = statements.slice(0,-1).every(s => s.type === 'VariableDeclaration') && last?.type === 'ReturnStatement' ? last.argument : null;
        const shadowedNamespace = n.right.params.flatMap(p => names(p)).includes('Tmapv3') ||
          statements.some(s => s.type === 'VariableDeclaration' && s.declarations.some(d => names(d.id).includes('Tmapv3')));
        const returnOwner = !shadowedNamespace && ret?.type === 'NewExpression' ? memberPath(ret.callee) : null;
        const existing = methods.get(row.id) || [];
        existing.push({proof:{...proof, registration:lexical.registration, constructor:lexical.constructor}, returnOwner}); methods.set(row.id, existing);
      } catch { /* unsupported source shape */ }
    }
  }
  const aliasEvidence = name => {
    const seen = new Set(), proofs = [];
    while (aliases.has(name)) {
      if (seen.has(name) || aliases.get(name).length !== 1) return null;
      seen.add(name);
      const entry = aliases.get(name)[0];
      if (!entry.target) return null;
      proofs.push(entry.proof); name = entry.target;
    }
    return {owner:name, proofs};
  };
  const canonical = name => aliasEvidence(name)?.owner || null;
  return { canonical, aliasEvidence, method(owner, method) {
    const entries = methods.get(canonical(owner) + '#' + method);
    return entries?.length === 1 ? entries[0] : null;
  } };
}
