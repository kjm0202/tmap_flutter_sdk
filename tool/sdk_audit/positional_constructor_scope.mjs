import { recursive } from "acorn-walk";

function isAmbiguousPattern(pattern, calleeName) {
  if (!pattern) return false;
  if (pattern.type === "Identifier") {
    return pattern.name === calleeName || pattern.name === "eval";
  } else if (pattern.type === "ArrayPattern") {
    return pattern.elements.some((element) =>
      isAmbiguousPattern(element, calleeName),
    );
  } else if (pattern.type === "ObjectPattern") {
    return pattern.properties.some((property) => {
      if (property.type === "Property")
        return isAmbiguousPattern(property.value, calleeName);
      if (property.type === "RestElement")
        return isAmbiguousPattern(property.argument, calleeName);
      return true; // Conservatively reject other property types
    });
  } else if (pattern.type === "AssignmentPattern") {
    return isAmbiguousPattern(pattern.left, calleeName);
  } else if (pattern.type === "RestElement") {
    return isAmbiguousPattern(pattern.argument, calleeName);
  }
  return true; // Conservatively reject unknown patterns
}

export function verifyBinding(call, ctor, factory, program) {
  if (!call || call.type !== "CallExpression") return null;
  const callee = call.callee;
  if (
    callee.type !== "Identifier" ||
    (callee.name !== "isFinite" && callee.name !== "parseFloat")
  )
    return null;

  if (call.arguments.length !== 1 || call.arguments[0].type !== "Identifier")
    return null;
  const arg = call.arguments[0];

  const param = ctor.params.find(
    (p) => p.type === "Identifier" && p.name === arg.name,
  );
  if (!param) return null;

  if (
    ctor.params.some((p) => isAmbiguousPattern(p, callee.name)) ||
    factory.params.some((p) => isAmbiguousPattern(p, callee.name))
  )
    return null;

  const formalIndex = ctor.params.indexOf(param);

  let ambiguous = false;

  const visitor = {
    VariableDeclarator(n, st, c) {
      if (isAmbiguousPattern(n.id, callee.name)) {
        ambiguous = true;
      }
      if (n.init) c(n.init, st);
    },
    FunctionDeclaration(n, st, c) {
      if (
        n.id &&
        isAmbiguousPattern({ type: "Identifier", name: n.id.name }, callee.name)
      ) {
        ambiguous = true;
      }
      // Do not traverse into body
    },
    FunctionExpression(n, st, c) {
      if (
        n.id &&
        isAmbiguousPattern({ type: "Identifier", name: n.id.name }, callee.name)
      ) {
        ambiguous = true;
      }
      // Do not traverse into body
    },
    ArrowFunctionExpression(n, st, c) {
      // No id, no body traversal
    },
    Identifier(n, st, c) {
      if (n.name === "eval") ambiguous = true;
    },
    WithStatement(n, st, c) {
      ambiguous = true;
    },
    Function(n, st, c) {
      // Check parameters
      if (n.params.some((p) => isAmbiguousPattern(p, callee.name))) {
        ambiguous = true;
      }
      // Do not traverse body
    },
  };

  const check = (node) => {
    recursive(node, null, visitor);
  };

  [program, factory.body, ctor.body].forEach(check);

  if (ambiguous) return null;

  return {
    name: callee.name,
    formalName: arg.name,
    formalIndex,
    unshadowed: true,
    scopeRanges: [program, factory, ctor].map(({ start, end }) => ({
      start,
      end,
    })),
  };
}
