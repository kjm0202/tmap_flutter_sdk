import test from "node:test";
import assert from "node:assert/strict";
import { extractDocs } from "../docs.mjs";

const source = (text) => ({
  text,
  url: "https://example.invalid/sdk.js",
  sha256: "some-sha",
  kind: "document",
});

test("parameter notes are attached to the preceding parameter", () => {
  const s = source(`<h2 id="InfoWindow">Tmapv3.InfoWindow</h2><h3>Constructor</h3><div><h4>Parameters</h4><ul>
    <li>- anchor {String} : 기준지점<br>&nbsp;&nbsp;&nbsp;&nbsp;* auto- 옵션 설명</li>
    <li>- paths {Array} : 경로<br>(※ 참고 설명)</li>
    </ul></div>`);
  const d = extractDocs([s], { links: [] });
  
  // Verify anchor has the note
  const anchor = d.rows.find(r => r.id === "Tmapv3.InfoWindow#constructor:anchor");
  assert(anchor, "anchor should be parsed");
  assert(anchor.note, "anchor should have a note");
  assert.strictEqual(anchor.note[0].text, "* auto- 옵션 설명");

  // Verify paths has the note
  const paths = d.rows.find(r => r.id === "Tmapv3.InfoWindow#constructor:paths");
  assert(paths, "paths should be parsed");
  assert(paths.note, "paths should have a note");
  assert.strictEqual(paths.note[0].text, "(※ 참고 설명)");
  
  // Verify no unparsed-contract for these lines
  const unparsed = d.rows.filter(r => r.kind === "unparsed-contract" && !r.continuationOf);
  assert.strictEqual(unparsed.length, 0, `Should have no unparsed contracts, but found: ${JSON.stringify(unparsed)}`);
});

test("notes and unparsed contracts", () => {
  const s = source(`<h2 id="InfoWindow">Tmapv3.InfoWindow</h2><h3>Constructor</h3><div><h4>Parameters</h4><ul>
    <li>* leading note</li>
    <li>- anchor {String} : 기준지점<br>* attached note</li>
    <li>- paths {Array} : 경로</li>
    <li>* other {Number} : another param</li>
    <li>- ordinary unknown</li>
    </ul></div>`);
  const d = extractDocs([s], { links: [] });

  // 1. Old unparsed ID/owner/kind/evidence still exists for unparsed
  const unparsed = d.rows.filter(r => r.kind === "unparsed-contract" && !r.continuationOf);
  // There are 3 unparsed: leading note, ordinary unknown. 
  // Wait, * other {Number} should be parsed.
  assert(unparsed.some(r => r.id.endsWith('unparsed-0')), "unparsed-0 exists (leading note)");
  assert(unparsed.some(r => r.id.endsWith('unparsed-4')), "unparsed-4 exists (ordinary unknown)");
  assert(unparsed[0].owner === "Tmapv3.InfoWindow", "owner exists");
  assert(unparsed[0].evidence, "evidence exists");

  // 2. Leading unowned note emits issue
  const leadingNoteIssue = d.issues.find(i => i.code === "unparsed-document-contract");
  assert(leadingNoteIssue, "leading note should emit issue");

  // 3. Second li does not use preceding note (the note is attached to anchor, not paths)
  const anchor = d.rows.find(r => r.id === "Tmapv3.InfoWindow#constructor:anchor");
  assert(anchor.note, "anchor should have a note");
  const paths = d.rows.find(r => r.id === "Tmapv3.InfoWindow#constructor:paths");
  assert(!paths.note, "paths should not have a note");

  // 4. '* other {Number}' parsed as named declaration
  const other = d.rows.find(r => r.id === "Tmapv3.InfoWindow#constructor:other");
  assert(other, "other should be parsed");
  assert.strictEqual(other.type, "Number", "type should be Number");

  // 5. Ordinary unknown remains issue
  const ordinaryUnknownIssue = d.issues.find(i => i.code === "unparsed-document-contract" && i.contract.includes("ordinary unknown"));
  assert(ordinaryUnknownIssue, "ordinary unknown should emit issue");
});
