import * as walk from "acorn-walk";
import { issue } from "./common.mjs";

// Deliberately bounded to lexical, same-factory object-literal helpers. This is
// a source-level argument-flow observation, not a guarantee of runtime values.
export function constructorOptions({
  factory,
  ctor,
  ctorName,
  owner,
  evidence,
  externalEffect = () => null,
}) {
  const rows = [],
    issues = [],
    objects = new Map();
  const isFn = (n) =>
    n &&
    [
      "FunctionDeclaration",
      "FunctionExpression",
      "ArrowFunctionExpression",
    ].includes(n.type);
  const key = (n) =>
    n?.type === "MemberExpression" &&
    (!n.computed
      ? n.property.name
      : n.property.type === "Literal" && typeof n.property.value === "string"
        ? n.property.value
        : null);
  const bindings = (fn) => {
    const names = new Set();
    const add = (p) => {
      if (!p) return;
      if (p.type === "Identifier") names.add(p.name);
      else if (p.type === "RestElement") add(p.argument);
      else if (p.type === "AssignmentPattern") add(p.left);
      else if (p.type === "ArrayPattern") p.elements.forEach(add);
      else if (p.type === "ObjectPattern")
        p.properties.forEach((x) => add(x.value || x.argument));
    };
    fn.params.forEach(add);
    // Do not let a declaration inside a nested function shadow an outer use.
    walk.recursive(fn.body, null, {
      ...walk.base,
      FunctionDeclaration(n) {
        if (n.id) add(n.id);
      },
      FunctionExpression() {},
      ArrowFunctionExpression() {},
      VariableDeclaration(n, state, c) {
        if (n.kind === "var") n.declarations.forEach((d) => add(d.id));
        n.declarations.forEach((d) => {
          if (d.init) c(d.init, state);
        });
      },
    });
    return names;
  };
  const diagnosticKeys = new Set();
  const diag = (reason, node) => {
    const id = `${reason}:${node.start}:${node.end}`;
    if (diagnosticKeys.has(id)) return;
    diagnosticKeys.add(id);
    issues.push(
      issue("constructor-option-flow-unresolved", {
        owner,
        reason,
        evidence: evidence(node),
      }),
    );
  };
  const shadowed = (name, ancestors) =>
    ancestors.some((a) => {
      if (isFn(a) && a !== factory && bindings(a).has(name)) return true;
      if (a.type === "CatchClause" && containsBinding(a.param, name))
        return true;
      const decl =
        a.type === "ForStatement"
          ? a.init
          : a.type === "ForOfStatement" || a.type === "ForInStatement"
            ? a.left
            : null;
      if (
        decl?.type === "VariableDeclaration" &&
        decl.kind !== "var" &&
        decl.declarations.some((d) => containsBinding(d.id, name))
      )
        return true;
      if (a.type !== "BlockStatement" || a === factory.body) return false;
      return a.body.some(
        (st) =>
          (st.type === "VariableDeclaration" &&
            st.kind !== "var" &&
            st.declarations.some((d) => containsBinding(d.id, name))) ||
          ((st.type === "FunctionDeclaration" ||
            st.type === "ClassDeclaration") &&
            st.id?.name === name),
      );
    });
  for (const st of factory.body.body)
    if (st.type === "VariableDeclaration")
      for (const d of st.declarations) {
        if (d.id.type !== "Identifier") continue;
        const list = objects.get(d.id.name) || [];
        list.push(d);
        objects.set(d.id.name, list);
      }
  const returns = factory.body.body.filter((s) => s.type === "ReturnStatement");
  const returnStart = returns.length === 1 ? returns[0].start : -1;
  const factoryParams = new Set(
    factory.params.filter((p) => p.type === "Identifier").map((p) => p.name),
  );
  const objectInfo = (name) => {
    const ds = objects.get(name);
    if (
      !ds ||
      ds.length !== 1 ||
      factoryParams.has(name) ||
      ds[0].init?.type !== "ObjectExpression" ||
      returnStart < 0 ||
      ds[0].start > returnStart
    )
      return null;
    const obj = ds[0].init,
      props = new Map();
    for (const p of obj.properties) {
      const k =
        p.type === "Property" && p.kind === "init" && !p.computed
          ? (p.key.name ?? p.key.value)
          : null;
      if (typeof k !== "string" || props.has(k) || !isFn(p.value)) return null;
      props.set(k, p);
    }
    let unsafe = false;
    walk.ancestor(factory.body, {
      Identifier(n, ancestors) {
        if (n.name !== name || n === ds[0].id) return;
        if (!reachable(ancestors)) return;
        const parent = ancestors.at(-2);
        // A local declaration shadows the factory binding throughout its function.
        if (shadowed(name, ancestors)) return;
        if (
          parent?.type !== "MemberExpression" ||
          parent.object !== n ||
          key(parent) == null
        ) {
          unsafe = true;
          return;
        }
        const grand = ancestors.at(-3),
          great = ancestors.at(-4);
        // Only an immediate method call or .apply/.call invocation is safe;
        // exporting a method or assigning through it can change dispatch.
        const direct =
          grand?.type === "CallExpression" && grand.callee === parent;
        const applied =
          grand?.type === "MemberExpression" &&
          grand.object === parent &&
          ["apply", "call"].includes(key(grand)) &&
          great?.type === "CallExpression" &&
          great.callee === grand;
        if (!direct && !applied) unsafe = true;
      },
    });
    walk.ancestor(factory.body, {
      AssignmentExpression(n, ancestors) {
        if (
          reachable(ancestors) &&
          targetTouches(n.left, name) &&
          !shadowed(name, ancestors)
        )
          unsafe = true;
      },
      UpdateExpression(n, ancestors) {
        if (
          reachable(ancestors) &&
          targetTouches(n.argument, name) &&
          !shadowed(name, ancestors)
        )
          unsafe = true;
      },
      ForOfStatement(n, ancestors) {
        if (
          reachable(ancestors) &&
          targetTouches(n.left, name) &&
          !shadowed(name, ancestors)
        )
          unsafe = true;
      },
      ForInStatement(n, ancestors) {
        if (
          reachable(ancestors) &&
          targetTouches(n.left, name) &&
          !shadowed(name, ancestors)
        )
          unsafe = true;
      },
    });
    return unsafe ? null : props;
  };
  // Evaluate only syntax whose truth is independent of runtime values.
  const truth = (n) => {
    if (!n) return undefined;
    if (n.type === "Literal") return Boolean(n.value);
    if (n.type === "UnaryExpression" && n.operator === "!") {
      const v = truth(n.argument);
      return v === undefined ? undefined : !v;
    }
    if (n.type === "LogicalExpression") {
      const left = truth(n.left),
        right = truth(n.right);
      if (n.operator === "??" && n.left.type === "Literal")
        return n.left.value == null ? right : left;
      if (n.operator === "&&")
        return left === false || right === false
          ? false
          : left === true
            ? right
            : undefined;
      if (n.operator === "||")
        return left === true || right === true
          ? true
          : left === false
            ? right
            : undefined;
    }
    if (n.type === "ConditionalExpression") {
      const test = truth(n.test);
      if (test !== undefined) return truth(test ? n.consequent : n.alternate);
      const a = truth(n.consequent),
        b = truth(n.alternate);
      return a === b ? a : undefined;
    }
    return undefined;
  };
  const terminates = (n) => {
    if (!n) return false;
    if (
      [
        "ReturnStatement",
        "ThrowStatement",
        "BreakStatement",
        "ContinueStatement",
      ].includes(n.type)
    )
      return true;
    if (n.type === "BlockStatement") return n.body.some(terminates);
    if (n.type === "IfStatement") {
      const test = truth(n.test);
      return test === true
        ? terminates(n.consequent)
        : test === false
          ? terminates(n.alternate)
          : terminates(n.consequent) && terminates(n.alternate);
    }
    return false;
  };
  const reachable = (ancestors) => {
    for (let i = 0; i < ancestors.length - 1; i++) {
      const a = ancestors[i],
        child = ancestors[i + 1];
      if (a.type === "IfStatement" || a.type === "ConditionalExpression") {
        const v = truth(a.test);
        if (
          (child === a.consequent && v === false) ||
          (child === a.alternate && v === true)
        )
          return false;
      }
      if (a.type === "LogicalExpression" && child === a.right) {
        const v = truth(a.left);
        if (
          (a.operator === "&&" && v === false) ||
          (a.operator === "||" && v === true) ||
          (a.operator === "??" &&
            a.left.type === "Literal" &&
            a.left.value != null)
        )
          return false;
      }
      if (a.type === "BlockStatement") {
        const pos = a.body.indexOf(child);
        if (pos >= 0 && a.body.slice(0, pos).some(terminates)) return false;
      }
    }
    return true;
  };
  const topWalk = (fn, visitors) =>
    walk.ancestor(
      fn.body,
      Object.fromEntries(
        Object.entries(visitors).map(([type, cb]) => [
          type,
          (n, ancestors) => {
            if (ancestors.some((a) => a !== fn && isFn(a))) return;
            if (!reachable(ancestors)) return;
            cb(n, ancestors);
          },
        ]),
      ),
    );
  const containsBinding = (pattern, name) => {
    if (!pattern) return false;
    if (pattern.type === "Identifier") return pattern.name === name;
    if (pattern.type === "RestElement")
      return containsBinding(pattern.argument, name);
    if (pattern.type === "AssignmentPattern")
      return containsBinding(pattern.left, name);
    if (pattern.type === "ArrayPattern")
      return pattern.elements.some((p) => containsBinding(p, name));
    if (pattern.type === "ObjectPattern")
      return pattern.properties.some((p) =>
        containsBinding(p.value || p.argument, name),
      );
    return false;
  };
  // acorn-walk treats assignment targets as patterns and does not visit every
  // Identifier on the left side. Inspect targets explicitly instead.
  const targetTouches = (n, name, members = false) => {
    if (!n) return false;
    if (n.type === "Identifier") return n.name === name;
    if (n.type === "MemberExpression")
      return (
        members && n.object.type === "Identifier" && n.object.name === name
      );
    if (n.type === "VariableDeclaration")
      return n.declarations.some((d) => targetTouches(d.id, name, members));
    if (n.type === "RestElement")
      return targetTouches(n.argument, name, members);
    if (n.type === "AssignmentPattern")
      return targetTouches(n.left, name, members);
    if (n.type === "ArrayPattern")
      return n.elements.some((p) => targetTouches(p, name, members));
    if (n.type === "ObjectPattern")
      return n.properties.some((p) =>
        targetTouches(p.value || p.argument, name, members),
      );
    return false;
  };
  const changed = (fn, name) => {
    let bad = false;
    const visitors = {
      VariableDeclarator(n) {
        if (containsBinding(n.id, name)) bad = true;
      },
      AssignmentExpression(n) {
        if (containsBinding(n.left, name)) bad = true;
      },
      UpdateExpression(n) {
        if (targetTouches(n.argument, name)) bad = true;
      },
      ForOfStatement(n) {
        if (targetTouches(n.left, name)) bad = true;
      },
      ForInStatement(n) {
        if (targetTouches(n.left, name)) bad = true;
      },
      FunctionDeclaration(n) {
        if (n.id?.name === name) bad = true;
      },
      CatchClause(n) {
        if (n.param?.name === name) bad = true;
      },
    };
    walk.ancestor(
      fn.body,
      Object.fromEntries(
        Object.entries(visitors).map(([type, cb]) => [
          type,
          (n, ancestors) => {
            if (reachable(ancestors)) cb(n, ancestors);
          },
        ]),
      ),
    );
    return bad;
  };
  // The registration must resolve to a unique, unmodified factory binding.
  let ctorDefinitions = 0,
    ctorMutated = false;
  for (const st of factory.body.body) {
    if (st.type === "VariableDeclaration")
      ctorDefinitions += st.declarations.filter(
        (d) => d.id.type === "Identifier" && d.id.name === ctorName,
      ).length;
    if (st.type === "FunctionDeclaration" && st.id?.name === ctorName)
      ctorDefinitions++;
  }
  const checkCtorTarget = (target, ancestors) => {
    if (
      reachable(ancestors) &&
      targetTouches(target, ctorName) &&
      !shadowed(ctorName, ancestors)
    )
      ctorMutated = true;
  };
  walk.ancestor(factory.body, {
    AssignmentExpression(n, a) {
      checkCtorTarget(n.left, a);
    },
    UpdateExpression(n, a) {
      checkCtorTarget(n.argument, a);
    },
    ForOfStatement(n, a) {
      checkCtorTarget(n.left, a);
    },
    ForInStatement(n, a) {
      checkCtorTarget(n.left, a);
    },
  });
  if (
    ctorDefinitions !== 1 ||
    ctorMutated ||
    returns.length !== 1 ||
    ctor.type === "ArrowFunctionExpression" ||
    ctor.async ||
    ctor.generator
  ) {
    diag("ambiguous-constructor-binding", ctor);
    return { rows, issues };
  }
  const localDeclares = (fn, name) => {
    if (bindings(fn).has(name)) return true;
    let found = false;
    walk.recursive(fn.body, null, {
      ...walk.base,
      FunctionDeclaration() {},
      FunctionExpression() {},
      ArrowFunctionExpression() {},
      VariableDeclaration(n, state, c) {
        if (n.declarations.some((d) => containsBinding(d.id, name)))
          found = true;
        for (const d of n.declarations) if (d.init) c(d.init, state);
      },
      CatchClause(n, state, c) {
        if (containsBinding(n.param, name)) found = true;
        c(n.body, state);
      },
    });
    return found;
  };
  const shadowedExternal = (fn, callee) => {
    let n = callee;
    while (n?.type === "MemberExpression") n = n.object;
    return (
      n?.type !== "Identifier" ||
      localDeclares(fn, n.name) ||
      localDeclares(factory, n.name)
    );
  };
  const nestedCapture = (fn, name) => {
    let captured = false;
    walk.ancestor(fn.body, {
      Identifier(n, ancestors) {
        if (n.name !== name) return;
        if (!reachable(ancestors)) return;
        const nested = ancestors.find((a) => isFn(a) && a !== fn);
        if (!nested || bindings(nested).has(name)) return;
        if (nested.type === "FunctionDeclaration" && nested.id) {
          let used = false;
          topWalk(fn, {
            Identifier(ref) {
              if (ref.name === nested.id.name) used = true;
            },
          });
          if (!used) return;
        }
        captured = true;
      },
    });
    return captured;
  };
  // Summarize only effects on the flowing object. Calls which cannot be
  // resolved to an immutable helper or proven source-local constructor are
  // unknown; unrelated computations and calls on option values are ignored.
  const effects = (
    fn,
    name,
    argumentObject = false,
    seen = new Set(),
    depth = 0,
  ) => {
    const writes = new Set();
    let unknown = depth > 4 || nestedCapture(fn, name);
    const merge = (e) => {
      if (!e || e.unknown) unknown = true;
      if (e) for (const k of e.writes) writes.add(k);
    };
    const root = (n) => n?.type === "Identifier" && n.name === name;
    const option = (n) =>
      root(n) ||
      (argumentObject && n?.type === "MemberExpression" && root(n.object));
    const markTarget = (n) => {
      if (!n) return;
      if (n.type === "MemberExpression" && option(n.object)) {
        const k = key(n);
        if (k == null) unknown = true;
        else writes.add(k);
      } else if (n.type === "ArrayPattern") n.elements.forEach(markTarget);
      else if (n.type === "ObjectPattern")
        n.properties.forEach((p) => markTarget(p.value || p.argument));
      else if (n.type === "AssignmentPattern") markTarget(n.left);
      else if (n.type === "RestElement") markTarget(n.argument);
    };
    const containsOption = (n) => {
      if (!n) return false;
      if (option(n)) return true;
      if (n.type === "ArrayExpression") return n.elements.some(containsOption);
      if (n.type === "ObjectExpression")
        return n.properties.some((p) => containsOption(p.value || p.argument));
      if (n.type === "SpreadElement") return containsOption(n.argument);
      return false;
    };
    topWalk(fn, {
      AssignmentExpression(n) {
        markTarget(n.left);
        if (containsOption(n.right)) unknown = true;
      },
      UpdateExpression(n) {
        markTarget(n.argument);
      },
      UnaryExpression(n) {
        if (n.operator === "delete") markTarget(n.argument);
      },
      ForOfStatement(n) {
        markTarget(n.left);
      },
      ForInStatement(n) {
        markTarget(n.left);
      },
      VariableDeclarator(n) {
        if (containsOption(n.init)) unknown = true;
      },
      ReturnStatement(n) {
        if (containsOption(n.argument)) unknown = true;
      },
      CallExpression(n) {
        let callee = n.callee,
          args = n.arguments,
          forwarded = false;
        if (
          callee.type === "MemberExpression" &&
          ["call", "apply"].includes(key(callee))
        ) {
          const mode = key(callee);
          callee = callee.object;
          if (mode === "apply") {
            forwarded = argumentObject && root(args[1]);
            if (args[1]?.type === "ArrayExpression") args = args[1].elements;
            else if (forwarded) args = [args[1]];
            else if (containsOption(args[1])) {
              unknown = true;
              return;
            } else args = [];
          } else args = args.slice(1);
        }
        if (callee.type === "MemberExpression" && option(callee.object))
          unknown = true;
        const indexes = args
          .map((a, i) => (containsOption(a) ? i : -1))
          .filter((i) => i >= 0);
        if (!indexes.length) return;
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          objects.has(callee.object.name)
        ) {
          const props = objectInfo(callee.object.name),
            target = props?.get(key(callee));
          if (
            !target ||
            seen.has(target) ||
            bindings(fn).has(callee.object.name)
          ) {
            unknown = true;
            return;
          }
          const targetIndexes = forwarded
            ? target.value.params.map((_, i) => i)
            : indexes;
          for (const index of targetIndexes) {
            const param = target.value.params[index];
            if (!param || param.type !== "Identifier") {
              unknown = true;
              continue;
            }
            if (changed(target.value, param.name)) continue;
            merge(
              effects(
                target.value,
                param.name,
                false,
                new Set([...seen, target]),
                depth + 1,
              ),
            );
          }
        } else {
          merge(
            shadowedExternal(fn, callee) ? null : externalEffect(callee, n),
          );
        }
      },
    });
    return { writes, unknown };
  };
  const argumentEffects = effects(ctor, "arguments", true);
  for (const p of ctor.params) {
    if (p.type !== "Identifier" || changed(ctor, p.name)) {
      argumentEffects.unknown = true;
      continue;
    }
    const e = effects(ctor, p.name);
    argumentEffects.unknown ||= e.unknown;
    for (const k of e.writes) argumentEffects.writes.add(k);
  }
  const visit = (fn, origin, path, seen, depth) => {
    if (depth > 4) {
      diag("depth-limit", fn);
      return;
    }
    const name = origin.name;
    if (changed(fn, name)) {
      diag("argument-binding-reassigned-or-shadowed", fn);
      return;
    }
    {
      let altered =
        origin.arguments &&
        fn.params.some((p) => p.type !== "Identifier" || changed(fn, p.name));
      topWalk(fn, {
        AssignmentExpression(n) {
          if (targetTouches(n.left, "arguments", true)) altered = true;
        },
        UpdateExpression(n) {
          if (targetTouches(n.argument, "arguments", true)) altered = true;
        },
        ForOfStatement(n) {
          if (targetTouches(n.left, "arguments", true)) altered = true;
        },
        ForInStatement(n) {
          if (targetTouches(n.left, "arguments", true)) altered = true;
        },
        MemberExpression(n, ancestors) {
          const p = ancestors.at(-2);
          if (
            n.object.type === "Identifier" &&
            n.object.name === "arguments" &&
            ((p?.type === "AssignmentExpression" && p.left === n) ||
              (p?.type === "UpdateExpression" && p.argument === n) ||
              (p?.type === "UnaryExpression" && p.operator === "delete"))
          )
            altered = true;
        },
      });
      for (const p of origin.arguments ? fn.params : [])
        if (p.type === "Identifier")
          topWalk(fn, {
            MemberExpression(n, ancestors) {
              const parent = ancestors.at(-2);
              if (
                n.object.type === "Identifier" &&
                n.object.name === p.name &&
                ((parent?.type === "AssignmentExpression" &&
                  parent.left === n) ||
                  (parent?.type === "UpdateExpression" &&
                    parent.argument === n) ||
                  (parent?.type === "UnaryExpression" &&
                    parent.operator === "delete"))
              )
                altered = true;
            },
          });
      if (altered) {
        diag("constructor-arguments-mutated", fn);
        return;
      }
    }
    if (origin.arguments) {
      for (const p of fn.params)
        if (p.type === "Identifier") {
          const e = effects(fn, p.name);
          if (e.unknown || e.writes.size) return;
        }
      let cellWrite = false;
      const isCellProperty = (n) => {
        if (!n) return false;
        if (n.type === "MemberExpression")
          return (
            n.object.type === "MemberExpression" &&
            n.object.object.type === "Identifier" &&
            n.object.object.name === "arguments"
          );
        if (n.type === "ArrayPattern") return n.elements.some(isCellProperty);
        if (n.type === "ObjectPattern")
          return n.properties.some((p) =>
            isCellProperty(p.value || p.argument),
          );
        if (n.type === "RestElement") return isCellProperty(n.argument);
        if (n.type === "AssignmentPattern") return isCellProperty(n.left);
        return false;
      };
      topWalk(fn, {
        AssignmentExpression(n) {
          if (isCellProperty(n.left)) cellWrite = true;
        },
        UpdateExpression(n) {
          if (isCellProperty(n.argument)) cellWrite = true;
        },
        ForOfStatement(n) {
          if (isCellProperty(n.left)) cellWrite = true;
        },
        ForInStatement(n) {
          if (isCellProperty(n.left)) cellWrite = true;
        },
        UnaryExpression(n) {
          if (n.operator === "delete" && isCellProperty(n.argument))
            cellWrite = true;
        },
      });
      if (cellWrite) {
        diag("constructor-arguments-mutated", fn);
        return;
      }
    }
    // An opaque call can mutate the object before a later read. Follow only
    // statically identified private calls; leave other escapes unresolved.
    let escaped = false,
      externalEscape = false;
    if (nestedCapture(fn, name)) escaped = true;
    topWalk(fn, {
      Identifier(n, ancestors) {
        if (n.name !== name) return;
        const p = ancestors.at(-2);
        if (
          (p?.type === "VariableDeclarator" && p.init === n) ||
          (p?.type === "AssignmentExpression" && p.right === n) ||
          (p?.type === "ReturnStatement" && p.argument === n) ||
          (p?.type === "Property" && p.value === n) ||
          (p?.type === "ArrayExpression" &&
            !(
              ancestors.at(-3)?.type === "CallExpression" &&
              ancestors.at(-3).arguments[1] === p &&
              key(ancestors.at(-3).callee) === "apply"
            )) ||
          p?.type === "SpreadElement"
        )
          escaped = true;
      },
      CallExpression(n) {
        if (
          !n.arguments.some((a) => a?.type === "Identifier" && a.name === name)
        )
          return;
        let c = n.callee;
        if (c.type === "MemberExpression" && ["call", "apply"].includes(key(c)))
          c = c.object;
        if (
          c.type !== "MemberExpression" ||
          c.object.type !== "Identifier" ||
          !objects.has(c.object.name)
        ) {
          const e = shadowedExternal(fn, c) ? null : externalEffect(c, n);
          if (!e || e.unknown || e.writes.size) {
            diag("dynamic-or-external-dispatch", n);
            escaped = true;
            externalEscape = true;
          }
        }
      },
    });
    if (escaped) {
      if (!externalEscape) diag("option-object-escapes", fn);
      return;
    }
    const written = new Set();
    let dynamicWrite = false;
    const directWritten = new Set();
    // Include mutations by sibling calls before accepting reads or forwarding.
    // Per-call summaries let a helper read untouched fields even when that
    // same helper writes another field.
    const callEffects = new Map();
    topWalk(fn, {
      CallExpression(n) {
        const wrapper = {
          ...fn,
          body: {
            type: "BlockStatement",
            body: [{ type: "ExpressionStatement", expression: n }],
          },
        };
        const effect = effects(wrapper, name, origin.arguments);
        callEffects.set(n, effect);
        if (effect.unknown) {
          let c = n.callee;
          if (
            c.type === "MemberExpression" &&
            ["call", "apply"].includes(key(c))
          )
            c = c.object;
          if (
            c.type === "MemberExpression" &&
            c.object.type === "Identifier" &&
            objects.has(c.object.name)
          ) {
            if (key(c) == null || bindings(fn).has(c.object.name))
              diag("ambiguous-helper-dispatch", n);
            else {
              const target = objectInfo(c.object.name)?.get(key(c));
              if (!target) diag("unresolved-or-mutable-helper", n);
              else diag("option-object-escapes", target.value);
            }
          }
        }
      },
    });
    const inherited = origin.writes || new Set();
    for (const k of inherited) written.add(k);
    for (const e of callEffects.values()) {
      if (e.unknown) dynamicWrite = true;
      for (const k of e.writes) written.add(k);
    }
    const recordTarget = (n) => {
      if (!n) return;
      if (
        n.type === "MemberExpression" &&
        n.object.type === "Identifier" &&
        n.object.name === name
      ) {
        const k = key(n);
        if (k == null) dynamicWrite = true;
        else {
          written.add(k);
          directWritten.add(k);
        }
      } else if (n.type === "ArrayPattern") n.elements.forEach(recordTarget);
      else if (n.type === "ObjectPattern")
        n.properties.forEach((p) => recordTarget(p.value || p.argument));
      else if (n.type === "RestElement") recordTarget(n.argument);
      else if (n.type === "AssignmentPattern") recordTarget(n.left);
    };
    if (!origin.arguments)
      topWalk(fn, {
        AssignmentExpression(n) {
          recordTarget(n.left);
        },
        UpdateExpression(n) {
          recordTarget(n.argument);
        },
        ForOfStatement(n) {
          recordTarget(n.left);
        },
        ForInStatement(n) {
          recordTarget(n.left);
        },
        UnaryExpression(n) {
          if (n.operator === "delete") recordTarget(n.argument);
        },
      });
    topWalk(fn, {
      MemberExpression(n, ancestors) {
        if (
          origin.arguments ||
          n.object.type !== "Identifier" ||
          n.object.name !== name
        )
          return;
        const parent = ancestors.at(-2);
        if (
          (parent?.type === "AssignmentExpression" && parent.left === n) ||
          (parent?.type === "UpdateExpression" && parent.argument === n) ||
          (parent?.type === "UnaryExpression" && parent.operator === "delete")
        ) {
          const k = key(n);
          if (k == null) dynamicWrite = true;
          else {
            written.add(k);
            directWritten.add(k);
          }
        }
      },
    });
    if (dynamicWrite) {
      diag("dynamic-option-write", fn);
      return;
    }
    topWalk(fn, {
      MemberExpression(n, ancestors) {
        if (
          origin.arguments ||
          !path.length ||
          n.object.type !== "Identifier" ||
          n.object.name !== name
        )
          return;
        const parent = ancestors.at(-2),
          k = key(n);
        if (k == null) {
          diag("dynamic-option-read", n);
          return;
        }
        if (k.startsWith("_") || written.has(k)) return;
        if (
          (parent?.type === "AssignmentExpression" && parent.left === n) ||
          (parent?.type === "UpdateExpression" && parent.argument === n) ||
          (parent?.type === "UnaryExpression" && parent.operator === "delete")
        )
          return;
        const proof = {
          channel: "ast",
          ...evidence(n),
          flow: {
            constructor: evidence(ctor),
            argument: origin.root,
            steps: path,
            read: evidence(n),
          },
        };
        rows.push({
          id: `${owner}#constructor:${k}`,
          kind: "option-candidate",
          owner,
          evidence: [proof],
        });
      },
      CallExpression(n) {
        let callee = n.callee,
          args = n.arguments,
          receiverOK = true,
          forwardsArguments = false;
        if (
          callee.type === "MemberExpression" &&
          ["apply", "call"].includes(key(callee))
        ) {
          const mode = key(callee);
          callee = callee.object;
          receiverOK = args[0]?.type === "ThisExpression";
          if (mode === "apply") {
            const arr = args[1];
            forwardsArguments =
              arr?.type === "Identifier" &&
              arr.name === "arguments" &&
              origin.arguments;
            if (
              arr?.type === "Identifier" &&
              arr.name === name &&
              !forwardsArguments
            )
              diag("unsupported-apply-arguments", n);
            args =
              arr?.type === "ArrayExpression"
                ? arr.elements
                : forwardsArguments
                  ? [arr]
                  : [];
          } else args = args.slice(1);
        }
        if (
          args.some(
            (a) =>
              a?.type === "SpreadElement" &&
              a.argument?.type === "Identifier" &&
              a.argument.name === name,
          )
        )
          diag("unsupported-spread-arguments", n);
        const indexes = args.flatMap((a, i) =>
          a?.type === "Identifier" && a.name === name ? [i] : [],
        );
        const priorWrites = new Set([...inherited, ...directWritten]);
        for (const [call, effect] of callEffects)
          if (call !== n) for (const k of effect.writes) priorWrites.add(k);
        if (!indexes.length || (origin.arguments && !forwardsArguments)) return;
        if (priorWrites.size) diag("mutated-options-forwarded", n);
        if (callee.type === "Identifier") {
          diag("dynamic-or-external-dispatch", n);
          return;
        }
        if (
          callee.type !== "MemberExpression" ||
          callee.object.type !== "Identifier"
        )
          return;
        const objName = callee.object.name,
          method = key(callee);
        if (!objects.has(objName)) return; // External calls are outside the private-helper scope.
        if (!receiverOK || method == null || bindings(fn).has(objName)) {
          diag("ambiguous-helper-dispatch", n);
          return;
        }
        const props = objectInfo(objName),
          target = props?.get(method);
        if (!target) {
          diag("unresolved-or-mutable-helper", n);
          return;
        }
        const paramIndexes = origin.arguments
          ? target.value.params.map((_, i) => i)
          : indexes;
        for (const paramIndex of paramIndexes) {
          const param = target.value.params[paramIndex];
          if (
            !param ||
            param.type !== "Identifier" ||
            target.value.params.filter(
              (p) => p.type === "Identifier" && p.name === param.name,
            ).length !== 1
          ) {
            diag("unsupported-helper-parameter", n);
            continue;
          }
          if (seen.has(target)) {
            diag("recursive-helper", n);
            return;
          }
          const step = {
            call: evidence(n),
            target: evidence(target),
            formal: evidence(param),
            argumentIndex: paramIndex,
          };
          visit(
            target.value,
            {
              name: param.name,
              arguments: false,
              root: origin.arguments
                ? { ...origin.root, index: paramIndex }
                : origin.root,
              writes: priorWrites,
            },
            [...path, step],
            new Set([...seen, target]),
            depth + 1,
          );
        }
      },
    });
  };
  // The implicit arguments object carries every constructor argument, even for
  // minified constructors with no formal parameters.
  if (
    !ctor.params.some((p) => p.type === "Identifier" && p.name === "arguments")
  )
    visit(
      ctor,
      {
        name: "arguments",
        arguments: true,
        root: { kind: "constructor-arguments", ...evidence(ctor) },
      },
      [],
      new Set(),
      0,
    );
  ctor.params.forEach((p, index) => {
    if (p.type === "Identifier")
      visit(
        ctor,
        {
          name: p.name,
          arguments: false,
          root: { kind: "constructor-formal", index, ...evidence(p) },
        },
        [],
        new Set(),
        0,
      );
  });
  return { rows, issues, argumentEffects };
}
