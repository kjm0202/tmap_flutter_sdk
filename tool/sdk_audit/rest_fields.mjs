import { sha, issue } from "./common.mjs";

// A display-table inventory, not a wire schema or evidence of SDK support.
const headers = [
  "name",
  "date type",
  "mandatory",
  "example",
  "default",
  "description",
];
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const label = (text) => normalize(text).toLowerCase();

function span(text, node) {
  const loc = node?.sourceCodeLocation;
  if (
    !loc ||
    !Number.isInteger(loc.startOffset) ||
    !Number.isInteger(loc.endOffset)
  )
    return null;
  const raw = text.slice(loc.startOffset, loc.endOffset);
  return {
    firstLine: loc.startLine,
    lastLine: loc.endLine,
    utf8StartInclusive: Buffer.byteLength(text.slice(0, loc.startOffset)),
    utf8EndExclusive: Buffer.byteLength(text.slice(0, loc.endOffset)),
    sha256RawSpan: sha(raw),
  };
}

function ownRows($, table) {
  return $(table)
    .find("tr")
    .toArray()
    .filter((row) => $(row).closest("table")[0] === table);
}
function ownCells($, row) {
  return $(row).children("th,td").toArray();
}
function cellText($, cell) {
  const copy = $(cell).clone();
  copy.find("table").remove();
  return normalize(copy.text());
}
function context($, table) {
  const group = $(table)
    .parents("[id]")
    .toArray()
    .find((el) => /^menu\d+$/i.test($(el).attr("id")));
  // Titles in these references precede the table wrapper, within the same menu.
  const scope = group || $.root()[0];
  const preceding = $(scope)
    .find(".li_title,h2,h3,h4,h5")
    .toArray()
    .filter(
      (el) =>
        el.sourceCodeLocation?.startOffset <
        table.sourceCodeLocation?.startOffset,
    );
  const section = preceding.length
    ? normalize($(preceding.at(-1)).text())
    : null;
  let direction = "unknown";
  if (
    /^(querystring parameters|request (payload|path parameters))$/i.test(
      section || "",
    )
  )
    direction = "request";
  else if (/^response parameter(?:\s*\(.*\))?$/i.test(section || ""))
    direction = "response";
  return { group: group ? $(group).attr("id") : null, section, direction };
}

// Place cells in a grid so metadata rowspans and multi-row headers retain their origin.
function grid($, rows) {
  const active = [];
  return rows.map((row) => {
    const slots = active.map((v) => (v && v.until > 0 ? v.cell : null));
    for (const v of active) if (v) v.until--;
    let col = 0;
    for (const cell of ownCells($, row)) {
      while (slots[col]) col++;
      const width = Number($(cell).attr("colspan") || 1);
      const height = Number($(cell).attr("rowspan") || 1);
      if (
        !Number.isInteger(width) ||
        width < 1 ||
        width > 100 ||
        !Number.isInteger(height) ||
        height < 1 ||
        height > 100
      )
        return null;
      for (let i = 0; i < width; i++) {
        if (slots[col + i]) return null;
        slots[col + i] = cell;
        if (height > 1) active[col + i] = { cell, until: height - 1 };
      }
      col += width;
    }
    return slots;
  });
}

export function extractRestFields(source, $, tables) {
  const fields = [],
    diagnostics = [];
  const fail = (code, details) =>
    diagnostics.push(issue(code, { source: source.url, ...details }));
  if (sha(source.text) !== source.sha256) {
    fail("rest-reference-source-digest-mismatch", {
      expected: source.sha256,
      actual: sha(source.text),
    });
    return { fields, diagnostics };
  }
  tables.forEach((table, tableIndex) => {
    const tableId = `rest-reference:${source.url}:table-${tableIndex}`;
    const rows = ownRows($, table);
    let headerCount = 0;
    while (
      headerCount < rows.length &&
      ownCells($, rows[headerCount]).length &&
      ownCells($, rows[headerCount]).every((c) => c.tagName === "th")
    )
      headerCount++;
    // Some source tables use td in their single header row.
    if (
      !headerCount &&
      rows.length &&
      ownCells($, rows[0]).some((c) => label(cellText($, c)) === "name")
    )
      headerCount = 1;
    if (!headerCount) return;
    const headerRows = rows.slice(0, headerCount);
    const headerGrid = grid($, headerRows);
    const headerText = headerRows.flatMap((r) =>
      ownCells($, r).map((c) => label(cellText($, c))),
    );
    if (
      !headerText.includes("name") ||
      headerText.filter((t) =>
        [
          "date type",
          "data type",
          "mandatory",
          "example",
          "description",
        ].includes(t),
      ).length < 2
    )
      return;
    const slots = headerGrid.at(-1);
    if (!slots) {
      fail("rest-reference-ambiguous-header", {
        tableId,
        reason: "invalid header spans",
      });
      return;
    }
    // Use the deepest recognized cell at each column, preserving repeated colspan cells.
    const leaf = slots.map((_, i) => {
      for (let j = headerGrid.length - 1; j >= 0; j--) {
        const c = headerGrid[j]?.[i],
          v = c && label(cellText($, c));
        if (headers.includes(v) || v === "data type") return c;
      }
      return null;
    });
    const unique = leaf.filter((c, i) => c && leaf.indexOf(c) === i);
    const names = unique.map((c) =>
      label(cellText($, c)).replace("data type", "date type"),
    );
    const valid =
      JSON.stringify(names) === JSON.stringify(headers) ||
      JSON.stringify(names) ===
        JSON.stringify(headers.filter((h) => h !== "default"));
    if (!valid || leaf.some((c) => !c)) {
      fail("rest-reference-ambiguous-header", {
        tableId,
        header: headerText,
        reason: "unsupported or duplicate column labels",
      });
      return;
    }
    const nameCell = unique[0];
    const nameColumns = leaf
      .map((c, i) => (c === nameCell ? i : -1))
      .filter((i) => i >= 0);
    const column = (key) =>
      leaf.findIndex(
        (c) =>
          c && label(cellText($, c)).replace("data type", "date type") === key,
      );
    const body = rows.slice(headerCount),
      bodyGrid = grid($, body);
    const ctx = context($, table),
      prepared = [];
    body.forEach((row, index) => {
      const cells = ownCells($, row),
        slots = bodyGrid[index];
      if (!slots) {
        fail("rest-reference-ambiguous-row", {
          tableId,
          tableRow: headerCount + index,
          reason: "invalid cell spans",
        });
        prepared.push(null);
        return;
      }
      // A cell-free separator has no metadata, including inherited rowspans.
      // Keep its physical row number, but do not break the display hierarchy.
      if (
        !cells.length &&
        !slots.some(Boolean) &&
        row.children.every(
          (child) =>
            child.type === "comment" ||
            (child.type === "text" && !normalize(child.data)),
        )
      )
        return;
      // The published layout also uses extra leading cells without a Name colspan.
      // In that form, the final cells correspond to the remaining header labels.
      if (
        nameColumns.length === 1 &&
        cells.length >= unique.length &&
        cells.every((c) => !$(c).attr("rowspan") && !$(c).attr("colspan")) &&
        slots.every((c) => !c || cells.includes(c))
      ) {
        const metadataCount = unique.length - 1;
        const leading = cells.slice(0, cells.length - metadataCount);
        const named = leading.filter((c) => cellText($, c));
        if (named.length !== 1) {
          fail("rest-reference-ambiguous-row", {
            tableId,
            tableRow: headerCount + index,
            reason: "missing or multiple name cells",
            span: span(source.text, row),
          });
          prepared.push(null);
          return;
        }
        const name = named[0],
          metadata = cells.slice(-metadataCount);
        const get = (key) => {
          const i = names.indexOf(key);
          return i > 0 ? cellText($, metadata[i - 1]) : null;
        };
        prepared.push({
          row,
          tableRow: headerCount + index,
          name: cellText($, name),
          indent: leading.indexOf(name),
          sourceType: get("date type"),
          mandatory: get("mandatory"),
          example: get("example"),
          default: get("default"),
          description: get("description"),
        });
        return;
      }
      if (nameColumns.length === 1) {
        fail("rest-reference-ambiguous-row", {
          tableId,
          tableRow: headerCount + index,
          reason:
            "unsupported spans or missing cells with variable indentation",
          span: span(source.text, row),
        });
        prepared.push(null);
        return;
      }
      const metadataCells = unique.slice(1).map((c) => slots[leaf.indexOf(c)]);
      if (
        metadataCells.some((c) => !c) ||
        new Set(metadataCells).size !== metadataCells.length ||
        nameColumns.some((i) => metadataCells.includes(slots[i]))
      ) {
        fail("rest-reference-ambiguous-row", {
          tableId,
          tableRow: headerCount + index,
          reason: "missing or overlapping metadata cells",
          span: span(source.text, row),
        });
        prepared.push(null);
        return;
      }
      const namesInBand = [
        ...new Set(nameColumns.map((i) => slots[i]).filter(Boolean)),
      ].filter((c) => cellText($, c));
      // Layout indentation is represented by empty cells before the named cell.
      const localNames = namesInBand.filter((c) => cells.includes(c));
      if (localNames.length !== 1 || namesInBand.length !== 1) {
        fail("rest-reference-ambiguous-row", {
          tableId,
          tableRow: headerCount + index,
          reason: "missing, inherited or multiple name cells",
          span: span(source.text, row),
        });
        prepared.push(null);
        return;
      }
      const name = localNames[0],
        indent = cells.indexOf(name);
      if (cells.slice(0, indent).some((c) => cellText($, c))) {
        prepared.push(null);
        return;
      }
      const get = (key) => {
        const c = slots[column(key)];
        return c ? cellText($, c) : null;
      };
      prepared.push({
        row,
        tableRow: headerCount + index,
        name: cellText($, name),
        indent,
        sourceType: get("date type"),
        mandatory: get("mandatory"),
        example: get("example"),
        default: get("default"),
        description: get("description"),
      });
    });
    const base = Math.min(...prepared.filter(Boolean).map((r) => r.indent));
    const stack = [],
      tableFields = [];
    for (const item of prepared) {
      if (!item) {
        stack.length = 0;
        continue;
      }
      const depth = item.indent - base;
      let displayPath = null,
        ambiguity = null;
      if (depth > stack.length) {
        ambiguity = "indentation has no preceding parent";
        stack.length = 0;
      } else {
        stack.length = depth;
        stack.push(item.name);
        displayPath = [...stack];
      }
      const rowSpan = span(source.text, item.row),
        tableSpan = span(source.text, table);
      if (!rowSpan || !tableSpan) {
        fail("rest-reference-ambiguous-row", {
          tableId,
          tableRow: item.tableRow,
          reason: "source span unavailable",
        });
        continue;
      }
      if (ambiguity)
        fail("rest-reference-ambiguous-row", {
          tableId,
          tableRow: item.tableRow,
          reason: ambiguity,
          span: rowSpan,
        });
      if (ctx.direction === "unknown")
        ambiguity = [ambiguity, "direction not established by section"]
          .filter(Boolean)
          .join("; ");
      tableFields.push({
        id: `${tableId}:row-${item.tableRow}`,
        kind: "rest-reference-field",
        status: "unverified",
        source: source.url,
        sourceSha256: source.sha256,
        tableId,
        tableIndex,
        tableRow: item.tableRow,
        tableSpan,
        span: rowSpan,
        ...ctx,
        name: item.name,
        displayPath,
        depth,
        ambiguity,
        sourceType: item.sourceType,
        mandatory: item.mandatory,
        example: item.example,
        default: item.default,
        description: item.description,
      });
    }
    const pathCounts = new Map();
    for (const field of tableFields)
      if (field.displayPath) {
        const key = JSON.stringify(field.displayPath);
        pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
      }
    for (const field of tableFields) {
      field.repeatedDisplayPath =
        !!field.displayPath &&
        pathCounts.get(JSON.stringify(field.displayPath)) > 1;
      if (field.repeatedDisplayPath)
        field.ambiguity = [
          field.ambiguity,
          "display path repeated within table",
        ]
          .filter(Boolean)
          .join("; ");
      fields.push(field);
    }
  });
  return { fields, diagnostics };
}
