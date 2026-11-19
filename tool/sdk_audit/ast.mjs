import { parse } from "acorn";
import * as walk from "acorn-walk";
import { sha, issue } from "./common.mjs";
import { constructorOptions } from "./constructor_options.mjs";

export function memberPath(n) {
  if (!n) return null;
  if (n.type === "Identifier") return n.name;
  if (n.type === "ThisExpression") return "this";
  if (n.type === "MemberExpression") {
    const p = memberPath(n.object),
      k = n.computed
        ? n.property.type === "Literal"
          ? String(n.property.value)
          : null
        : n.property.name;
    return p && k !== null ? `${p}.${k}` : null;
  }
  return null;
}

const isFunction = (n) =>
  n &&
  [
    "FunctionExpression",
    "ArrowFunctionExpression",
    "FunctionDeclaration",
  ].includes(n.type);

function extractSingleAST(source) {
  const rows = [],
    issues = [],
    aliases = {},
    classes = [],
    references = [],
    dependencies = [],
    calls = [];
  const evidence = (n) => {
    const loc = n.loc
      ? `${n.loc.start.line}:${n.loc.start.column}`
      : `${n.start}`;
    const file = source.url || source.file || "sdk";
    const hash = source.sha256;
    return {
      channel: "ast",
      source: file,
      file,
      sha256: hash,
      hash,
      start: n.start,
      end: n.end,
      line: n.loc?.start?.line ?? 1,
      column: n.loc?.start?.column ?? 0,
      loc,
      provenance: `${file}:${hash}:${loc}`,
    };
  };

  if (!source || !source.text) {
    return {
      rows,
      issues: [issue("sdk-source-empty", { source: source?.url })],
      aliases,
      classes,
      references,
      dependencies,
      parsedBytes: 0,
      registrations: 0,
    };
  }

  let tree;
  try {
    tree = parse(source.text, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
    });
  } catch (e) {
    return {
      rows,
      issues: [
        issue("sdk-parse-failed", {
          message: e.message,
          source: source.url,
          sha256: source.sha256,
        }),
      ],
      aliases,
      classes,
      references,
      dependencies,
      parsedBytes: 0,
      registrations: 0,
    };
  }
  walk.simple(tree, {
    CallExpression(n) {
      const p = memberPath(n.callee);
      if (p === "Tmapv3.createNamespace" || p === "Tmapvector.createNamespace") calls.push(n);
    },
    AssignmentExpression(n) {
      const a = memberPath(n.left),
        b = memberPath(n.right);
      if ((a?.startsWith("Tmapv3.") || a?.startsWith("Tmapvector.")) && n.right.type === "ClassExpression")
        issues.push(
          issue("class-expression-analysis-required", {
            id: a,
            evidence: evidence(n),
          }),
        );
      if ((a?.startsWith("Tmapv3.") || a?.startsWith("Tmapvector.")) && (b?.startsWith("Tmapv3.") || b?.startsWith("Tmapvector."))) aliases[a] = b;
    },
    Literal(n) {
      if (
        typeof n.value === "string" &&
        /^https?:\/\//.test(n.value) &&
        /\.js(?:\?|$)/.test(n.value)
      )
        dependencies.push({ url: n.value, evidence: evidence(n) });
    },
  });
  
  const add = (id, kind, n, extra = {}) =>
    rows.push({ id, kind, evidence: [evidence(n)], ...extra });

  const objectFields = (id, obj, owner, namespace) => {
    if (obj.type === "ObjectExpression") {
      for (const p of obj.properties) {
        const key = p.computed ? p.key?.value : (p.key?.name ?? p.key?.value);
        if (key == null) {
          issues.push(
            issue("unresolved-object-field", {
              owner: owner,
              evidence: evidence(p),
            }),
          );
          continue;
        }
        add(id + "." + key, "instance-field", p, { owner: owner });
        if (p.value) objectFields(id + "." + key, p.value, owner, namespace);
        if (namespace && id.endsWith(".eventListeners"))
          add(namespace + "!" + key, "event-candidate", p, { owner: owner });
      }
    } else if (obj.type === "ArrayExpression") {
      for (let i = 0; i < obj.elements.length; i++) {
        const el = obj.elements[i];
        if (!el) continue;
        add(id + "." + i, "instance-field", el, { owner: owner });
        objectFields(id + "." + i, el, owner, namespace);
      }
    }
  };

  // Only same-source, uniquely registered constructors with an unchanged
  // namespace binding may discharge an opaque constructor call.
  const namespaceEffects = new Map();
  const namespaceBusy = new Set();
  const externalEffect = (callee, call) => {
    const path = memberPath(callee);
    if (!path) return null;
    const defs = calls.filter((c) => c.arguments[0]?.value === path);
    if (defs.length !== 1 || defs[0].start > call.start) return null;
    let mutated = false;
    const root = path.split(".")[0];
    const check = (target) => {
      if (!target) return;
      if (target.type === "Identifier") {
        if (target.name === root) mutated = true;
      } else if (target.type === "MemberExpression") {
        let base = target;
        while (base.type === "MemberExpression") base = base.object;
        if (base.type !== "Identifier" || base.name !== root) return;
        const p = memberPath(target);
        if (!p || path === p || path.startsWith(p + ".") ||
            p === path + ".call" || p === path + ".apply") mutated = true;
      } else if (target.type === "ArrayPattern") target.elements.forEach(check);
      else if (target.type === "ObjectPattern") target.properties.forEach((p) => check(p.value || p.argument));
      else if (target.type === "AssignmentPattern") check(target.left);
      else if (target.type === "RestElement") check(target.argument);
      else if (target.type === "VariableDeclaration") target.declarations.forEach((d) => check(d.id));
    };
    walk.simple(tree, {
      AssignmentExpression(n) { check(n.left); },
      UpdateExpression(n) { check(n.argument); },
      ForOfStatement(n) { check(n.left); },
      ForInStatement(n) { check(n.left); },
      UnaryExpression(n) { if (n.operator === "delete") check(n.argument); },
      CallExpression(n) {
        const method = memberPath(n.callee);
        if (["Object.assign", "Object.defineProperty", "Object.defineProperties", "Reflect.set", "Reflect.defineProperty", "Reflect.deleteProperty"].includes(method)) check(n.arguments[0]);
      },
    });
    if (mutated || namespaceBusy.has(path)) return null;
    if (namespaceEffects.has(path)) return namespaceEffects.get(path);
    const value = defs[0].arguments[1];
    const f = value?.type === "CallExpression" && isFunction(value.callee) ? value.callee : null;
    if (!f || f.body.type !== "BlockStatement") return null;
    const ret = f.body.body.filter((s) => s.type === "ReturnStatement");
    const ctorName = ret.length === 1 ? ret[0].argument?.name : null;
    let ctor = null;
    for (const st of f.body.body) {
      if (st.type === "VariableDeclaration") for (const d of st.declarations)
        if (d.id.type === "Identifier" && d.id.name === ctorName && isFunction(d.init)) ctor = d.init;
      if (st.type === "FunctionDeclaration" && st.id?.name === ctorName) ctor = st;
    }
    if (!ctor) return null;
    namespaceBusy.add(path);
    const result = constructorOptions({ factory: f, ctor, ctorName, owner: path, evidence, externalEffect });
    namespaceBusy.delete(path);
    const effect = result.issues.some((i) => i.reason === "ambiguous-constructor-binding") ? null : result.argumentEffects;
    namespaceEffects.set(path, effect);
    return effect;
  };

  let registrations = calls.length;

  for (const call of calls) {
    const name = call.arguments[0]?.value,
      value = call.arguments[1];
    if (typeof name !== "string") {
      issues.push(issue("dynamic-namespace", { evidence: evidence(call) }));
      continue;
    }
    add(name, "namespace", call);
    const factory =
      value?.type === "CallExpression" && isFunction(value.callee)
        ? value.callee
        : null;
    let ctorName = null;
    if (factory?.body.type === "BlockStatement")
      for (const statement of factory.body.body)
        if (statement.type === "ReturnStatement")
          ctorName = memberPath(statement.argument);
    if (value === undefined) continue; 
    if (!factory || !ctorName) {
      issues.push(
        issue("unresolved-namespace-factory", {
          name,
          evidence: evidence(call),
        }),
      );
      continue;
    }
    let ctor;
    for (const statement of factory.body.body) {
      if (statement.type === "VariableDeclaration")
        for (const n of statement.declarations)
          if (n.id.name === ctorName && isFunction(n.init)) ctor = n.init;
      if (
        statement.type === "FunctionDeclaration" &&
        statement.id?.name === ctorName
      )
        ctor = statement;
    }
    const contract = (id, fn) => {
      const params = fn.params.map((p) => source.text.slice(p.start, p.end));
      for (let index = 0; index < params.length; index++)
        add(
          id + ":argument[" + index + "]",
          "parameter-candidate",
          fn.params[index],
          { owner: name, name: params[index], position: index },
        );
      walk.ancestor(fn.body, {
        ReturnStatement(n, ancestors) {
          if (ancestors.some((a) => a !== fn && isFunction(a))) return;
          add(id + "->return", "return-expression", n, {
            owner: name,
            expression: n.argument
              ? source.text.slice(
                  n.argument.start,
                  Math.min(n.argument.end, n.argument.start + 240),
                )
              : "undefined",
            expressionSha256: sha(source.text.slice(n.start, n.end)),
          });
        },
        MemberExpression(n, ancestors) {
          if (ancestors.some((a) => a !== fn && isFunction(a))) return;
          const p = memberPath(n);
          if (!p) return;
          const index = fn.params.findIndex(
            (param) =>
              param.type === "Identifier" && p.startsWith(param.name + "."),
          );
          if (index >= 0)
            add(
              id +
                ":argument[" +
                index +
                "]." +
                p.slice(fn.params[index].name.length + 1),
              "parameter-access-candidate",
              n,
              { owner: name },
            );
        },
      });
    };
    if (ctor) {
      classes.push(name);
      add(name + "#constructor", "constructor", ctor, {
        owner: name,
        parameters: ctor.params.map((p) => source.text.slice(p.start, p.end)),
      });
      contract(name + "#constructor", ctor);
      const flow = constructorOptions({ factory, ctor, ctorName, owner: name, evidence, externalEffect });
      rows.push(...flow.rows);
      issues.push(...flow.issues);
    }
    const bindingCache = new WeakMap();
    const localNames = (fn) => {
      if (bindingCache.has(fn)) return bindingCache.get(fn);
      const names = new Set();
      const bind = (pattern) => {
        if (!pattern) return;
        if (pattern.type === "Identifier") names.add(pattern.name);
        else if (pattern.type === "RestElement") bind(pattern.argument);
        else if (pattern.type === "AssignmentPattern") bind(pattern.left);
        else if (pattern.type === "ObjectPattern")
          for (const p of pattern.properties) bind(p.value || p.argument);
        else if (pattern.type === "ArrayPattern")
          for (const p of pattern.elements) bind(p);
      };
      for (const p of fn.params || []) bind(p);
      walk.recursive(fn.body, null, {
        ...walk.base,
        FunctionDeclaration(n) {
          bind(n.id);
        },
        FunctionExpression() {},
        ArrowFunctionExpression() {},
        VariableDeclaration(n, state, c) {
          if (n.kind === "var") for (const d of n.declarations) bind(d.id);
          for (const d of n.declarations) if (d.init) c(d.init, state);
        },
      });
      bindingCache.set(fn, names);
      return names;
    };
    const shadowed = (ancestors) =>
      ancestors.some(
        (a) => a !== factory && isFunction(a) && localNames(a).has(ctorName),
      );
    let recognized = 0;
    walk.ancestor(factory.body, {
      AssignmentExpression(n, ancestors) {
        const p = memberPath(n.left);
        let canonical;
        if (p?.startsWith(ctorName + ".prototype."))
          canonical = name + "#" + p.slice((ctorName + ".prototype.").length);
        else if (p?.startsWith(ctorName + "."))
          canonical = name + "." + p.slice(ctorName.length + 1);
        if (canonical && shadowed(ancestors)) canonical = null;
        if (canonical) {
          recognized++;
          const fn = isFunction(n.right);
          add(canonical, fn ? "method" : "property", n, {
            owner: name,
            static: !p.includes(".prototype."),
            parameters: fn
              ? n.right.params.map((p) => source.text.slice(p.start, p.end))
              : undefined,
            bodySha256: sha(source.text.slice(n.right.start, n.right.end)),
          });
          if (fn) contract(canonical, n.right);
          if (n.right.type === "ObjectExpression")
            for (const prop of n.right.properties) {
              const key = prop.computed
                ? prop.key?.value
                : (prop.key?.name ?? prop.key?.value);
              if (key != null)
                add(
                  canonical + "." + key,
                  isFunction(prop.value) ? "method" : "property",
                  prop,
                  { owner: name },
                );
              else
                issues.push(
                  issue("dynamic-object-member", {
                    owner: name,
                    evidence: evidence(prop),
                  }),
                );
            }
        }
        if (n.left.type === "MemberExpression" && !p) {
          const receiver = memberPath(n.left.object);
          if (receiver?.startsWith(ctorName) || receiver?.startsWith("this"))
            issues.push(
              issue("dynamic-property-write", {
                owner: name,
                receiver,
                evidence: evidence(n),
                keyExpression: source.text.slice(n.left.property.start, n.left.property.end),
                keyEvidence: evidence(n.left.property),
              }),
            );
        }
        if (p?.startsWith("this.") && ctor && ancestors.includes(ctor)) {
          add(name + "@" + p.slice(5), "instance-field", n, { owner: name });
          objectFields(name + "@" + p.slice(5), n.right, name, name);
        }
      },
      CallExpression(n) {
        const p = memberPath(n.callee);
        if (p === "Tmapv3.inherit" && memberPath(n.arguments[0]) === ctorName)
          add(name + "#extends", "inheritance", n, {
            owner: name,
            base: memberPath(n.arguments[1]),
          });
        if (
          [
            "Object.defineProperty",
            "Object.defineProperties",
            "Object.assign",
          ].includes(p)
        ) {
          const issueArgs = {
              owner: name,
              operation: p,
              evidence: evidence(n),
          };
          if (p === "Object.defineProperty" && n.arguments.length >= 2) {
            issueArgs.keyExpression = source.text.slice(n.arguments[1].start, n.arguments[1].end);
            issueArgs.keyEvidence = evidence(n.arguments[1]);
          }
          issues.push(
            issue("reflective-property-definition", issueArgs),
          );
        }
        if (p === "eval" || p === "Function")
          issues.push(
            issue("dynamic-code", { owner: name, evidence: evidence(n) }),
          );
        if (
          p &&
          /(?:\.on|\.off|\.addListener|\.fireEvent|\.trigger)$/.test(p)
        ) {
          const args = n.arguments.filter(
            (a) => a.type === "Literal" && typeof a.value === "string",
          );
          for (const a of args)
            add(name + "!" + a.value, "event-candidate", a, {
              owner: name,
              operation: p,
            });
        }
      },
      MemberExpression(n) {
        const p = memberPath(n);
        if (p?.startsWith("Tmapv3."))
          references.push({ path: p, owner: name, evidence: evidence(n) });
        if (p && (/options\./i.test(p) || /\.defaults\./i.test(p)))
          add(name + "?" + p, "option-access-candidate", n, { owner: name });
      },
    });
    if (!ctor && !recognized)
      issues.push(
        issue("unresolved-namespace-members", {
          owner: name,
          evidence: evidence(call),
        }),
      );
  }
  
  walk.simple(tree, {
    AssignmentExpression(n) {
      const p = memberPath(n.left);
      const isTarget = p === "Tmapvector" || p === "window.Tmapvector" || p === "Marker" || p === "window.Marker" || p === "contextMenu" || p === "window.contextMenu" || p?.startsWith("Tmapv3.") || p?.startsWith("Tmapvector.") || p?.startsWith("window.Tmapvector.");
      if (
        isTarget &&
        !aliases[p] &&
        !calls.some((c) => n.start >= c.start && n.end <= c.end)
      ) {
        add(p, isFunction(n.right) ? "method" : "property", n);
        registrations++;
        if (n.right.type === "ObjectExpression" || n.right.type === "ArrayExpression") {
           objectFields(p, n.right, p, p);
        }
      }
    },
  });

  return {
    rows,
    issues,
    aliases,
    classes,
    references,
    dependencies,
    parsedBytes: Buffer.byteLength(source.text),
    registrations,
  };
}

export function extractAST(sourceOrSources) {
  const sources = (
    Array.isArray(sourceOrSources) ? sourceOrSources : [sourceOrSources]
  ).filter(Boolean);
  if (!sources.length) {
    return {
      rows: [],
      issues: [issue("sdk-sources-missing")],
      aliases: {},
      classes: [],
      references: [],
      dependencies: [],
      parsedBytes: 0,
      registrations: 0,
      scope: {
        namespace: "Tmapv3",
        engine:
          "Vsm is enumerated separately at runtime; minified engine internals are not treated as Flutter-facing API.",
        unresolvedPolicy:
          "Every unsupported reflective/dynamic write remains blocking; source locations retained.",
      },
    };
  }

  const combined = {
    rows: [],
    issues: [],
    aliases: {},
    classes: [],
    references: [],
    dependencies: [],
    parsedBytes: 0,
    registrations: 0,
    scope: {
      namespace: "Tmapv3",
      engine:
        "Vsm is enumerated separately at runtime; minified engine internals are not treated as Flutter-facing API.",
      unresolvedPolicy:
        "Every unsupported reflective/dynamic write remains blocking; source locations retained.",
    },
    scripts: [],
  };

  const rowsById = new Map();

  for (const source of sources) {
    const single = extractSingleAST(source);
    combined.issues.push(...single.issues);
    Object.assign(combined.aliases, single.aliases);
    for (const c of single.classes) {
      if (!combined.classes.includes(c)) combined.classes.push(c);
    }
    combined.references.push(...single.references);
    combined.dependencies.push(...single.dependencies);
    combined.parsedBytes += single.parsedBytes || 0;
    combined.registrations += single.registrations || 0;
    combined.scripts.push({
      url: source.url,
      sha256: source.sha256,
      bytes: source.bytes,
      kind: source.kind,
      registrations: single.registrations,
    });

    for (const r of single.rows) {
      if (rowsById.has(r.id)) {
        const existing = rowsById.get(r.id);
        if (Array.isArray(r.evidence)) {
          existing.evidence.push(...r.evidence);
        }
      } else {
        const copy = { ...r, evidence: [...(r.evidence || [])] };
        rowsById.set(r.id, copy);
        combined.rows.push(copy);
      }
    }
  }

  if (combined.registrations === 0) {
    combined.issues.push(issue("no-namespace-registrations"));
  }

  return combined;
}

export function extractSDKAST(sources) {
  const list = Array.isArray(sources) ? sources : [sources];
  const sdkSources = list.filter(
    (s) =>
      s &&
      (s.kind === "sdk" ||
        s.kind === "sdk-worker" ||
        s.kind === "sdk-script" ||
        s.kind?.startsWith("sdk")),
  );
  return extractAST(sdkSources);
}
