import test from "node:test";
import assert from "node:assert/strict";
import { extractDocs } from "../docs.mjs";
import { sha } from "../common.mjs";

const source = (text, kind = "reference") => ({
  text,
  kind,
  url: "https://example.invalid/ref.html",
  sha256: sha(text),
});
const run = (text) => extractDocs([source(text)], { links: [] });
const header =
  '<tr><th colspan="3">Name</th><th>Date Type</th><th>Mandatory</th><th>Example</th><th>Description</th></tr>';
const row = (name, depth = 0, type = "String") =>
  `<tr>${"<td></td>".repeat(depth)}<td colspan="${3 - depth}">${name}</td><td>${type}</td><td>Y</td><td>-</td><td>설명</td></tr>`;
const wrap = (body) =>
  `<div id="menu1"><div class="li_title">Response Parameter</div><div class="table01"><table>${body}</table></div></div>`;

test("generator retains duplicate displayed paths as separate source-bound rows", () => {
  const text = `한글\n${wrap(header + row("root", 0, "Node") + row("value", 1) + row("value", 1) + row("other"))}`;
  const docs = run(text),
    fields = docs.restReferenceFields;
  assert.deepEqual(
    fields.map((f) => f.displayPath),
    [["root"], ["root", "value"], ["root", "value"], ["other"]],
  );
  assert.equal(new Set(fields.map((f) => f.id)).size, 4);
  assert.equal(fields[1].group, "menu1");
  assert.equal(fields[1].direction, "response");
  assert.equal(fields[1].status, "unverified");
  assert.equal(fields[1].repeatedDisplayPath, true);
  assert.match(fields[1].ambiguity, /repeated/);
  for (const f of fields) {
    assert.equal(f.sourceSha256, sha(text));
    const bytes = Buffer.from(text).subarray(
      f.span.utf8StartInclusive,
      f.span.utf8EndExclusive,
    );
    assert.equal(sha(bytes), f.span.sha256RawSpan);
    assert.match(bytes.toString(), /^<tr>/);
    assert.equal(
      sha(
        Buffer.from(text).subarray(
          f.tableSpan.utf8StartInclusive,
          f.tableSpan.utf8EndExclusive,
        ),
      ),
      f.tableSpan.sha256RawSpan,
    );
  }
  assert(
    docs.issues.some((i) => i.code === "rest-reference-schema-review-required"),
  );
  assert(!docs.rows.some((r) => r.kind === "rest-reference-field"));
});

test("multi-row headers, indentation and metadata rowspans preserve origins", () => {
  const h =
    '<tr><th rowspan="2" colspan="3">Name</th><th colspan="2">Details</th><th rowspan="2">Example</th><th rowspan="2">Description</th></tr><tr><th>Date Type</th><th>Mandatory</th></tr>';
  const body =
    '<tr><td colspan="3">root</td><td>Node</td><td rowspan="2">Y</td><td>-</td><td>root</td></tr>' +
    '<tr><td></td><td colspan="2">child</td><td>String</td><td>-</td><td>child</td></tr>';
  const fields = run(wrap(h + body)).restReferenceFields;
  assert.deepEqual(
    fields.map((f) => f.displayPath),
    [["root"], ["root", "child"]],
  );
  assert.equal(fields[1].mandatory, "Y");
  assert.equal(fields[1].description, "child");
  assert.equal(fields[1].tableRow, 3);
});

test("an implicitly closed empty row preserves the preceding hierarchy", () => {
  const text = wrap(
    header +
      row("features") +
      row("properties", 1, "Node") +
      "<tr>\n  " +
      row("first", 2) +
      row("second", 2),
  );
  const docs = run(text);
  assert.deepEqual(
    docs.restReferenceFields.map((f) => f.displayPath),
    [
      ["features"],
      ["features", "properties"],
      ["features", "properties", "first"],
      ["features", "properties", "second"],
    ],
  );
  assert.deepEqual(
    docs.restReferenceFields.map((f) => f.tableRow),
    [1, 2, 4, 5],
  );
  assert(!docs.issues.some((i) => i.code === "rest-reference-ambiguous-row"));
});

test("incomplete rows diagnose and break hierarchy even with blank cells", () => {
  const malformed = [
    '<tr><td></td><td colspan="2"></td><td>String</td><td>Y</td><td>-</td><td>metadata without a name</td></tr>',
    '<tr><td colspan="3"></td><td></td><td></td><td></td><td></td></tr>',
  ];
  for (const badRow of malformed) {
    const docs = run(
      wrap(
        header +
          row("features") +
          row("properties", 1, "Node") +
          badRow +
          row("child", 2),
      ),
    );
    assert.equal(docs.restReferenceFields.at(-1).displayPath, null);
    assert.match(docs.restReferenceFields.at(-1).ambiguity, /parent/);
    assert(
      docs.issues.some(
        (i) =>
          i.code === "rest-reference-ambiguous-row" &&
          i.tableRow === 3 &&
          /missing/.test(i.reason),
      ),
    );
  }
});

test("a cell-free row with inherited metadata is not an empty separator", () => {
  const parent =
    '<tr><td colspan="3">features</td><td>Node</td><td rowspan="2">Y</td><td>-</td><td>description</td></tr>';
  const docs = run(wrap(header + parent + "<tr></tr>" + row("child", 1)));
  assert.equal(docs.restReferenceFields.at(-1).displayPath, null);
  assert(
    docs.issues.some(
      (i) => i.code === "rest-reference-ambiguous-row" && i.tableRow === 2,
    ),
  );
});

test("variable indentation also rejects empty-cell metadata rows", () => {
  const h =
    "<tr><th>Name</th><th>Date Type</th><th>Mandatory</th><th>Example</th><th>Description</th></tr>";
  const root =
    "<tr><td>root</td><td>Node</td><td>Y</td><td>-</td><td>root</td></tr>";
  const bad = "<tr><td></td><td></td><td></td><td></td><td></td></tr>";
  const child =
    "<tr><td></td><td>child</td><td>String</td><td>Y</td><td>-</td><td>child</td></tr>";
  const docs = run(wrap(h + root + bad + child));
  assert.equal(docs.restReferenceFields.at(-1).displayPath, null);
  assert(
    docs.issues.some(
      (i) =>
        i.code === "rest-reference-ambiguous-row" &&
        i.tableRow === 2 &&
        i.reason === "missing or multiple name cells",
    ),
  );
});

test("header-only references may have no field-specific diagnostic", () => {
  for (const h of [header, "<tr><th>Name</th><th>Mandatory</th></tr>"]) {
    const docs = run(wrap(h));
    assert.deepEqual(docs.restReferenceFields, []);
    assert(
      !docs.issues.some(
        (i) =>
          i.code === "rest-reference-ambiguous-header" ||
          i.code === "rest-reference-ambiguous-row",
      ),
    );
    assert(
      docs.issues.some(
        (i) => i.code === "rest-reference-schema-review-required",
      ),
    );
  }
});

test("ambiguous and invalid tables remain visible without fabricating fields", () => {
  const duplicate =
    "<tr><th>Name</th><th>Date Type</th><th>Mandatory</th><th>Example</th><th>Description</th><th>Description</th></tr><tr><td>x</td><td>String</td><td>Y</td><td>-</td><td>a</td><td>b</td></tr>";
  const navigation =
    "<table><tr><th>Name</th><th>Link</th></tr><tr><td>go</td><td>URL</td></tr></table>";
  const badJump = header + row("root") + row("orphan", 2);
  const docs = run(wrap(duplicate) + navigation + wrap(badJump));
  assert.equal(docs.restReferenceFields.length, 2);
  assert.equal(docs.restReferenceFields[1].displayPath, null);
  assert.match(docs.restReferenceFields[1].ambiguity, /parent/);
  assert(docs.issues.some((i) => i.code === "rest-reference-ambiguous-header"));
  assert(docs.issues.some((i) => i.code === "rest-reference-ambiguous-row"));
});

test("unknown direction, source corruption and ordinary documents stay distinct", () => {
  const html = `<div id="menu2"><div class="li_title">Extra information</div><table>${header + row("item")}</table></div>`;
  const docs = run(html);
  assert.equal(docs.restReferenceFields[0].direction, "unknown");
  assert.match(docs.restReferenceFields[0].ambiguity, /direction/);
  const invalid = { ...source(html), sha256: "wrong" };
  const bad = extractDocs([invalid], { links: [] });
  assert.equal(bad.restReferenceFields.length, 0);
  assert(
    bad.issues.some((i) => i.code === "rest-reference-source-digest-mismatch"),
  );
  const normal = extractDocs(
    [source("<h2>Tmapv3.Map</h2><h3>Constructor</h3>", "document")],
    { links: [] },
  );
  assert(normal.rows.some((r) => r.id === "Tmapv3.Map"));
  assert.deepEqual(normal.restReferenceFields, []);
});

test("published unspanned headers allow extra blank indentation cells", () => {
  const h =
    "<tr><th>Name</th><th>Date Type</th><th>Mandatory</th><th>Example</th><th>Description</th></tr>";
  const body =
    "<tr><td></td><td>addressInfo</td><td>Node</td><td>N</td><td></td><td></td></tr>" +
    "<tr><td></td><td></td><td>fullAddress</td><td>String</td><td>Y</td><td>text</td><td>설명</td></tr>";
  const docs = run(
    `<div class="li_title">Response Parameter</div><div class="table01"><table>${h + body}</table></div>`,
  );
  assert.deepEqual(
    docs.restReferenceFields.map((f) => f.displayPath),
    [["addressInfo"], ["addressInfo", "fullAddress"]],
  );
  assert.equal(docs.restReferenceFields[1].sourceType, "String");
  assert.equal(docs.restReferenceFields[1].direction, "response");
});

test("contract generator carries fields separately without changing coverage or diagnostics", async () => {
  const { generateContracts } = await import("../audit_artifacts.mjs");
  const docs = run(wrap(header + row("item")));
  const contracts = generateContracts({ rows: [], baselineId: "test" }, docs);
  assert.equal(contracts.items.length, 0);
  assert.equal(contracts.status, "INCOMPLETE");
  assert.deepEqual(contracts.restReferenceFields, docs.restReferenceFields);
  assert.equal(contracts.restReferenceFieldSummary.status, "unverified");
  assert(
    docs.issues.some((i) => i.code === "rest-reference-schema-review-required"),
  );
});

test("incomplete headers and unsupported rowspans emit diagnostics", () => {
  const badHeader =
    "<tr><th>Name</th><th>Mandatory</th><th>Example</th><th>Description</th></tr><tr><td>item</td><td>Y</td><td>-</td><td>description</td></tr>";
  const h =
    "<tr><th>Name</th><th>Date Type</th><th>Mandatory</th><th>Example</th><th>Description</th></tr>";
  const body =
    '<tr><td>item</td><td>String</td><td rowspan="2">Y</td><td>-</td><td>description</td></tr>' +
    "<tr><td>next</td><td>String</td><td>-</td><td>description</td></tr>";
  const docs = run(wrap(badHeader) + wrap(h + body));
  assert.equal(docs.restReferenceFields.length, 0);
  assert(docs.issues.some((i) => i.code === "rest-reference-ambiguous-header"));
  assert(docs.issues.some((i) => i.code === "rest-reference-ambiguous-row"));
});

test("missing anchor diagnostics survive field extraction", () => {
  const s = source(wrap(header + row("item")));
  const docs = extractDocs([s], {
    links: [{ url: s.url, anchor: "missing", label: "missing" }],
  });
  assert(
    docs.issues.some(
      (i) => i.code === "broken-menu-anchor" && i.anchor === "missing",
    ),
  );
  assert.equal(docs.restReferenceFields.length, 1);
});

test("nested tables do not become rows or contaminate cell text", () => {
  const inner =
    "<table><tr><th>Name</th><th>Link</th></tr><tr><td>navigation</td><td>URL</td></tr></table>";
  const docs = run(
    wrap(
      header +
        row("root") +
        `<tr><td colspan="3">child</td><td>String</td><td>Y</td><td>-</td><td>description${inner}</td></tr>`,
    ),
  );
  assert.deepEqual(
    docs.restReferenceFields.map((f) => f.name),
    ["root", "child"],
  );
  assert.equal(docs.restReferenceFields[1].description, "description");
});
