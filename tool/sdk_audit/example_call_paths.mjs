import * as walk from 'acorn-walk';
import { memberPath } from './ast.mjs';
import { names } from './example_fields.mjs';
const isFunction = n => ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
const isScope = n => ['Program','BlockStatement','CatchClause','ForStatement','ForInStatement','ForOfStatement','SwitchStatement','StaticBlock'].includes(n.type) || isFunction(n);
export function extractCallPaths(tree, block, callSdk) {
  const bindings = new Map(), directSdkCalls = [], conditionalSdkCalls = [];
  const scopes = ancestors => ancestors.filter(isScope);
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
      const declaration = ancestors.at(-2), candidates = scopes(ancestors.slice(0,-1));
      const target = declaration.kind === 'var'
        ? candidates.findLast(s => s.type === 'Program' || isFunction(s))
        : candidates.at(-1);
      for (const name of names(n.id)) declare(target, name, n.id.type === 'Identifier' ? n.init : null, ancestors.slice(0,-1), 'variable', n);
    },
    FunctionDeclaration(n, ancestors) {
      if (n.id) {
        const target = scopes(ancestors.slice(0,-1)).at(-1);
        declare(target, n.id.name, null, ancestors.slice(0,-1), 'function', n);
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
  let namespaceMutated = false;
  function propertyWrite(node, ancestors) {
    if (node?.type !== 'MemberExpression') return;
    let root = node;
    while (root.type === 'MemberExpression') root = root.object;
    if (root.type !== 'Identifier') return;
    if (root.name === 'Tmapv3' && !lookup(root.name, ancestors)) namespaceMutated = true;
    const binding = lookup(root.name, ancestors);
    if (binding) binding.propertyWrites = true;
  }
  walk.ancestor(tree, {
    AssignmentExpression(n, ancestors) {
      if (names(n.left).includes('Tmapv3') && !lookup('Tmapv3', ancestors)) namespaceMutated = true;
      propertyWrite(n.left, ancestors);
      for (const name of names(n.left)) { const b = lookup(name, ancestors); if (b) { b.writes++; (b.writeNodes ||= []).push({node:n, ancestors:ancestors.slice()}); } }
    },
    UpdateExpression(n, ancestors) {
      propertyWrite(n.argument, ancestors);
      for (const name of names(n.argument)) { const b = lookup(name, ancestors); if (b) b.writes++; }
    },
    UnaryExpression(n, ancestors) { if (n.operator === 'delete') propertyWrite(n.argument, ancestors); },
    ForInStatement(n, ancestors) {
      if (n.left.type !== 'VariableDeclaration')
        for (const name of names(n.left)) { const b = lookup(name, ancestors); if (b) { b.writes++; (b.writeNodes ||= []).push({node:n, ancestors:ancestors.slice()}); } }
    },
    ForOfStatement(n, ancestors) {
      if (n.left.type !== 'VariableDeclaration')
        for (const name of names(n.left)) { const b = lookup(name, ancestors); if (b) { b.writes++; (b.writeNodes ||= []).push({node:n, ancestors:ancestors.slice()}); } }
    },
  });
  function resolve(name, ancestors, at, seen = new Set(), forCall = false) {
    const b = lookup(name, ancestors);
    if (!b || b.ambiguous || b.propertyWrites || seen.has(b)) return null;
    if (b.writes) {
      const write = b.writeNodes?.[0];
      if (!forCall || b.writes !== 1 || b.value || b.definition?.id.type !== 'Identifier' ||
          write?.node.operator !== '=' || write.node.right.type !== 'NewExpression' ||
          !memberPath(write.node.right.callee)?.startsWith('Tmapv3.') || lookup('Tmapv3', write.ancestors)) return null;
      return {owner:memberPath(write.node.right.callee), conditional:true, bindings:[
        {start:b.definition.start,end:b.definition.end,excerpt:block.slice(b.definition.start,b.definition.end)},
        {start:write.node.start,end:write.node.end,excerpt:block.slice(write.node.start,write.node.end)}]};
    }
    if (b.kind === 'parameter') return null;
    if (!b.value || b.value.end > at) return null;
    const conditionalBinding = forCall && ((b.ancestors.findLast(isFunction) || b.ancestors[0]) !== (ancestors.findLast(isFunction) || ancestors[0]) || !ancestors.includes(b.ancestors.at(-2)));
    seen.add(b);
    if (b.value.type === 'NewExpression') {
      const owner = memberPath(b.value.callee);
      if (owner?.startsWith('Tmapv3.') && !lookup('Tmapv3', b.ancestors)) return { owner, conditional:conditionalBinding, bindings:[{start:b.definition.start,end:b.definition.end,excerpt:block.slice(b.definition.start,b.definition.end)}] };
    }
    if (b.value.type === 'Identifier') {
      const result = resolve(b.value.name, b.ancestors, b.value.start, seen, forCall);
      return result && {...result, conditional:conditionalBinding || result.conditional, bindings:[{start:b.definition.start,end:b.definition.end,excerpt:block.slice(b.definition.start,b.definition.end)}, ...(result.bindings || [])]};
    }
    if (forCall && b.value.type === 'CallExpression') {
      const result = resolveReturn(b.value, b.ancestors, seen);
      if (result) return {...result, conditional:conditionalBinding || result.conditional, bindings:[{start:b.definition.start,end:b.definition.end,excerpt:block.slice(b.definition.start,b.definition.end)}, ...(result.bindings || [])]};
    }
    return null;
  }
  function resolveReturn(expr, ancestors, seen = new Set()) {
    if (!callSdk || expr.type !== 'CallExpression' || expr.arguments.length || expr.callee.type !== 'MemberExpression' ||
        expr.callee.computed || expr.callee.object.type !== 'Identifier') return null;
    const method = expr.callee.property.name;
    const expected = {screenSize:'Tmapv3.base.Size', getCenter:'Tmapv3.base.LatLng'}[method];
    if (!expected) return null;
    const base = resolve(expr.callee.object.name, ancestors, expr.start, seen, true);
    if (!base || callSdk.canonical(base.owner) !== 'Tmapv3.Map') return null;
    const declaration = callSdk.method(base.owner, method);
    if (!declaration?.returnOwner || callSdk.canonical(declaration.returnOwner) !== expected) return null;
    return {owner:declaration.returnOwner, conditional:base.conditional,
      bindings:[{start:expr.start,end:expr.end,excerpt:block.slice(expr.start,expr.end)}, ...base.bindings], returnDeclaration:declaration.proof};
  }
  const invocationSites = [];
  if (callSdk) walk.ancestor(tree, {CallExpression(n, ancestors) {
    if (n.callee.type === 'Identifier') invocationSites.push({node:n, ancestors:ancestors.slice()});
  }});
  function conditionalParameter(receiver, ancestors) {
    if (receiver.type !== 'MemberExpression' || receiver.computed || receiver.object.type !== 'Identifier') return [];
    const param = lookup(receiver.object.name, ancestors);
    const fn = ancestors.findLast(isFunction);
    if (!param || param.kind !== 'parameter' || param.ambiguous || param.writes || param.propertyWrites || fn?.type !== 'FunctionDeclaration' || !fn.id) return [];
    const index = fn.params.findIndex(p => p.type === 'Identifier' && p.name === receiver.object.name);
    if (index < 0) return [];
    const result = [];
    const span = n => ({start:n.start,end:n.end,excerpt:block.slice(n.start,n.end)});
    for (const site of invocationSites) {
      const call = site.node;
      const fnBinding = lookup(fn.id.name, site.ancestors);
      if (call.callee.name !== fn.id.name || fnBinding?.definition !== fn || fnBinding.writes) continue;
      let object = call.arguments[index], objectBinding = null, objectAncestors = site.ancestors;
      if (object?.type === 'Identifier') {
        const b = lookup(object.name, site.ancestors);
        if (!b || b.ambiguous || b.writes || b.propertyWrites || !b.value || b.value.end > call.start) continue;
        object = b.value; objectBinding = b.definition; objectAncestors = b.ancestors;
      }
      if (object?.type !== 'ObjectExpression' || object.properties.some(p => p.type !== 'Property' || p.computed || p.kind !== 'init' || p.method)) continue;
      const properties = object.properties.filter(p => (p.key.name ?? p.key.value) === receiver.property.name);
      if (properties.length !== 1 || properties[0].value.type !== 'NewExpression' || lookup('Tmapv3', objectAncestors)) continue;
      const owner = memberPath(properties[0].value.callee);
      if (!owner?.startsWith('Tmapv3.')) continue;
      result.push({owner, bindings:[span(fn.params[index]), ...(objectBinding ? [span(objectBinding)] : []), span(properties[0]), span(call)]});
    }
    return result;
  }
  if (namespaceMutated) return [];
  walk.ancestor(tree, {
    CallExpression(n, ancestors) {
      if (!callSdk || n.callee.type !== 'MemberExpression' || n.callee.computed) return;
      const receiver = n.callee.object, method = n.callee.property.name;
      let result = null;
      if (receiver.type === 'Identifier') result = resolve(receiver.name, ancestors, n.start, new Set(), true);
      else if (receiver.type === 'CallExpression') result = resolveReturn(receiver, ancestors);
      else if (receiver.type === 'NewExpression' && !lookup('Tmapv3', ancestors)) {
        const owner = memberPath(receiver.callee);
        if (owner?.startsWith('Tmapv3.')) result = {owner, bindings:[{start:receiver.start,end:receiver.end,excerpt:block.slice(receiver.start,receiver.end)}]};
      }
      if (!result) {
        for (const candidate of conditionalParameter(receiver, ancestors)) {
          const declaration = callSdk.method(candidate.owner, method);
          if (declaration) conditionalSdkCalls.push({start:n.start,end:n.end,owner:callSdk.canonical(candidate.owner),method,
            expression:block.slice(n.start,n.end),bindings:candidate.bindings,aliasDeclarations:callSdk.aliasEvidence(candidate.owner).proofs,methodDeclaration:declaration.proof});
        }
        return;
      }
      if (result.review) return;
      const declaration = callSdk.method(result.owner, method);
      if (!declaration) return;
      (result.conditional ? conditionalSdkCalls : directSdkCalls).push({start:n.start,end:n.end,owner:callSdk.canonical(result.owner),method,
        expression:block.slice(n.start,n.end),bindings:result.bindings,aliasDeclarations:callSdk.aliasEvidence(result.owner).proofs,
        methodDeclaration:declaration.proof,...(result.returnDeclaration ? {returnDeclaration:result.returnDeclaration} : {})});
    },
  });
  return [...directSdkCalls, ...conditionalSdkCalls];
}
