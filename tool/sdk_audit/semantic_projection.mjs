import { isDeepStrictEqual } from "node:util";

function normalizedDescriptors(items) {
  return [...new Set(items.map((item) => JSON.stringify(item)))]
    .sort()
    .map((item) => JSON.parse(item));
}

export function projectSurface(report, { docs, ast, runtime }) {
  // Build indexed (multiple per ID) docs/ast/runtime declarations
  const docMap = new Map();
  for (const r of docs.rows) {
    if (!docMap.has(r.id)) docMap.set(r.id, []);
    docMap.get(r.id).push(r);
  }
  const astMap = new Map();
  for (const r of ast.rows) {
    if (!astMap.has(r.id)) astMap.set(r.id, []);
    astMap.get(r.id).push(r);
  }
  const runtimeMap = new Map();
  for (const r of runtime.rows) {
    if (!runtimeMap.has(r.id)) runtimeMap.set(r.id, []);
    runtimeMap.get(r.id).push(r);
  }

  const result = [];
  const processedIds = new Set();

  // Use sorted ID for canonical ordering
  const sortedReportRows = [...report.rows].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const row of sortedReportRows) {
    if (!row.id || processedIds.has(row.id)) continue;

    // Exclude VSM engine, prototype noise/AST internal
    if (
      row.kinds &&
      (row.kinds.includes("VSM engine adapter") ||
        row.kinds.includes("internal") ||
        row.kinds.includes("prototype"))
    )
      continue;
    if (row.scope === "linked-rest-reference") continue;

    // Reconciled row.sourceNames: lookup using id OR any of sourceNames
    const lookupIds = new Set([row.id, ...(row.sourceNames || [])]);

    const docsForId = [];
    for (const id of lookupIds) {
      if (docMap.has(id)) docsForId.push(...docMap.get(id));
    }

    const astForId = [];
    for (const id of lookupIds) {
      if (astMap.has(id)) astForId.push(...astMap.get(id));
    }

    const runtimeForId = [];
    for (const id of lookupIds) {
      if (runtimeMap.has(id)) runtimeForId.push(...runtimeMap.get(id));
    }

    // Keep every row with scope documented or example-used even if NO runtime
    const isDocumented = row.scope === "documented";
    const isExampleUsed = row.scope === "example-used";

    // plus runtime-exposed direct id if undocumented-review-required
    const needsReview = row.scope === "undocumented-review-required";
    const hasRuntime = runtimeForId.length > 0;

    if (!isDocumented && !isExampleUsed && !(needsReview && hasRuntime))
      continue;

    // Canonical signature
    const signature = {
      id: row.id,
      sourceNames: [...new Set(row.sourceNames || [])].sort(),
      kinds: [...new Set(row.kinds || [])].sort(),
      // Project docs fields actually found in input
      declaration: normalizedDescriptors(
        docsForId.map((d) => ({
          type: d.type,
          name: d.name,
          parentId: d.parentId,
          default: d.default,
          enum: d.enum,
          enumValues: d.enumValues,
          access: d.access,
          event: d.event,
          contract: d.contract, // semantic available contract text/types
        })),
      ),
      // AST .static, parameters count
      astData: normalizedDescriptors(
        astForId.map((a) => ({
          isStatic: a.static,
          parameterCount: Array.isArray(a.parameters)
            ? a.parameters.length
            : null,
        })),
      ),
      // Runtime kind/valueType/enumerable/writable
      runtimeData: normalizedDescriptors(
        runtimeForId.map((r) => ({
          kind: r.kind,
          valueType: r.valueType,
          enumerable: r.enumerable,
          writable: r.writable,
        })),
      ),
    };

    result.push(signature);
    processedIds.add(row.id);
  }
  return result.sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
}

export function compareSurfaces(prevRows, currRows) {
  const prevMap = new Map(prevRows.map((r) => [r.id, r]));
  const currMap = new Map(currRows.map((r) => [r.id, r]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const id of currMap.keys()) {
    if (!prevMap.has(id)) {
      added.push(id);
    } else {
      // Compare signatures
      if (!isDeepStrictEqual(prevMap.get(id), currMap.get(id))) {
        changed.push(id);
      }
    }
  }

  for (const id of prevMap.keys()) {
    if (!currMap.has(id)) {
      removed.push(id);
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
  };
}
