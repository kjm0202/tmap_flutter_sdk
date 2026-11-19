import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { sha } from "./common.mjs";
import { verifyBinding } from "./positional_constructor_scope.mjs";

export function positionalConstructorLexicalEvidence(text, owner, start, end) {
  if (
    typeof text !== "string" ||
    sha(text) !==
      "5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e"
  ) {
    return null;
  }
  const ast = acorn.parse(text, { ecmaVersion: 2020, ranges: true });
  const allFound = {};

  walk.ancestor(ast, {
    AssignmentExpression(node, ancestors) {
      if (
        node.left.type === "MemberExpression" &&
        node.left.object.type === "Identifier" &&
        node.left.object.name === "Tmapv3" &&
        (node.left.property.name === "Point" ||
          node.left.property.name === "LatLng")
      ) {
        const ownerName = "Tmapv3.base." + node.left.property.name;

        // Verify actual alias RHS exactly equals owner
        if (
          node.right.type === "MemberExpression" &&
          node.right.object.type === "MemberExpression" &&
          node.right.object.object.type === "Identifier" &&
          node.right.object.object.name === "Tmapv3" &&
          node.right.object.property.name === "base" &&
          node.right.property.name === node.left.property.name
        ) {
          if (!allFound[ownerName]) allFound[ownerName] = {};
          allFound[ownerName].alias = { start: node.start, end: node.end };
        }
      }
    },
    CallExpression(node, ancestors) {
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.object.name === "Tmapv3" &&
        node.callee.property.name === "createNamespace"
      ) {
        const ownerName = node.arguments[0] && node.arguments[0].value;
        if (
          ownerName !== "Tmapv3.base.Point" &&
          ownerName !== "Tmapv3.base.LatLng" &&
          ownerName !== "Tmapv3.base.Object"
        )
          return;

        let factory = node.arguments[1];
        if (factory && factory.type === "CallExpression") {
          factory = factory.callee;
        }

        if (factory && factory.type === "FunctionExpression" && factory.body) {
          const ret = factory.body.body.find(
            (x) => x.type === "ReturnStatement",
          );
          if (ret && ret.argument && ret.argument.name) {
            const name = ret.argument.name;
            const decl = factory.body.body
              .filter((x) => x.type === "VariableDeclaration")
              .flatMap((x) => x.declarations)
              .find((x) => x.id.name === name);

            if (decl && decl.init && decl.init.type === "FunctionExpression") {
              const ctor = decl.init;

              const calls = [];
              const assignments = [];
              walk.ancestor(ctor.body, {
                CallExpression(node) {
                  calls.push({ start: node.start, end: node.end });
                },
                AssignmentExpression(node) {
                  assignments.push({ start: node.start, end: node.end });
                },
              });

              if (!allFound[ownerName]) allFound[ownerName] = {};

              const metadata = {
                reg: { start: node.start, end: node.end },
                ctor: { start: ctor.start, end: ctor.end },
                params: ctor.params.map((p) => ({
                  start: p.start,
                  end: p.end,
                })),
                ret: { start: ret.start, end: ret.end },
                assignments: assignments,
                calls: calls,
              };

              if (ownerName === "Tmapv3.base.Object") {
                if (ctor.params.length === 0) {
                  let argumentsUsed = false;
                  walk.simple(ctor.body, {
                    Identifier(n) {
                      if (n.name === "arguments") argumentsUsed = true;
                    },
                  });
                  if (!argumentsUsed)
                    metadata.baseIgnoresForwardedArguments = true;
                }
              } else if (ownerName === "Tmapv3.base.LatLng") {
                walk.simple(ctor.body, {
                  CallExpression(n) {
                    if (n.start === start && n.end === end) {
                      metadata.builtinBinding = verifyBinding(
                        n,
                        ctor,
                        factory,
                        ast,
                      );
                    }
                  },
                });
              }

              allFound[ownerName] = {
                ...allFound[ownerName],
                ...metadata,
              };
            }
          }
        }
      }
    },
  });

  if (owner !== "Tmapv3.base.Point" && owner !== "Tmapv3.base.LatLng")
    return null;
  if (!allFound[owner]) return null;

  const target = allFound[owner];

  // require target.alias
  if (!target.alias) return null;

  if (owner === "Tmapv3.base.Point") {
    if (
      !allFound["Tmapv3.base.Object"] ||
      allFound["Tmapv3.base.Object"].baseIgnoresForwardedArguments !== true
    )
      return null;
    if (start !== 840930 || end !== 841003) return null;
  } else if (owner === "Tmapv3.base.LatLng") {
    if (!target.builtinBinding) return null;
    const allowed = [
      [839537, 839548],
      [839549, 839562],
      [839575, 839586],
      [839587, 839600],
    ];
    if (
      !target.calls.some(
        (call) =>
          call.start === start &&
          call.end === end &&
          allowed.some(([s, e]) => start === s && end === e),
      )
    ) {
      return null;
    }
  }

  const res = { [owner]: allFound[owner] };
  if (allFound["Tmapv3.base.Object"])
    res["Tmapv3.base.Object"] = allFound["Tmapv3.base.Object"];
  return res;
}
