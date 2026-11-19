import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'cheerio';
import { HERE, sha } from './common.mjs';
import { ajaxWitness } from './direct_ajax_witness.mjs';

// Binds the official REST reference document and its separately published
// use-case example to the byte-pinned receipt, then derives the endpoint from
// the reference resource table and the example's single executable POST.
const receiptPath = path.join(HERE, 'direct_rest_example_proof.json');
const receiptSha256 = '736bf4408660a0bb6b2a0deed19e38346377c483220a5d5131e679ef7d1a57ca';
const docUrl = 'https://tmapapi.tmapmobility.com/webservice/docs/tmapRouteOptimization30Doc.html';
const exampleUrl = 'https://tmapapi.tmapmobility.com/webv3VSM/usecase/UseCaseOptimization.html';
const executableUrl = 'https://apis.openapi.sk.com/tmap/routes/routeOptimization30?version=1&format=json';

const byteAt = (text, offset) => Buffer.byteLength(text.slice(0, offset));

// One manifest record per role, with cached bytes matching digest, size and receipt.
function pinnedSource(manifest, read, entry, kind, role) {
  const records = manifest.sources.filter(s => s.url === entry.url || s.sha256 === entry.sha256);
  if (records.length !== 1) return null;
  const [record] = records;
  if (record.url !== entry.url || record.finalURL !== entry.url || record.sha256 !== entry.sha256 || record.kind !== kind || record.role !== role || record.bytes !== entry.bytes) return null;
  const bytes = read(path.join(HERE, '.cache/sources', record.sha256));
  if (!Buffer.isBuffer(bytes) || bytes.length !== record.bytes || sha(bytes) !== record.sha256) return null;
  const text = bytes.toString('utf8');
  if (Buffer.byteLength(text) !== bytes.length) return null;
  return { record, bytes, text };
}

// Each receipt span must be in bounds and hash to the recorded digest.
function spansMatch(bytes, matchingLines, count) {
  return Array.isArray(matchingLines) && matchingLines.length === count && matchingLines.every(({ line, span }) =>
    Number.isInteger(line) && Array.isArray(span) && span.length === 3 && Number.isInteger(span[0]) && Number.isInteger(span[1]) &&
    span[0] >= 0 && span[0] < span[1] && span[1] <= bytes.length && sha(bytes.subarray(span[0], span[1])) === span[2]);
}
const within = (span, offset) => offset >= span[0] && offset < span[1];

// The first reference table states the resource URI and POST method.
function resourceTable(text, receiptLine) {
  const $ = load(text, { sourceCodeLocationInfo: true });
  const table = $('table').first();
  const cells = new Map();
  for (const tr of table.find('tr').toArray()) {
    const th = $(tr).children('th'), td = $(tr).children('td');
    if (th.length !== 1 || td.length !== 1) return null;
    const label = th.text().replace(/\s+/g, ' ').trim();
    if (cells.has(label)) return null;
    cells.set(label, td[0]);
  }
  const uri = cells.get('Resource URI'), method = cells.get('Protocol /HTTP Method');
  if (!uri || !method || $(method).text().trim() !== 'REST / Post Method') return null;
  const resourceUri = $(uri).text().trim(), loc = uri.sourceCodeLocation, tableLoc = table[0].sourceCodeLocation;
  if (loc.startLine !== receiptLine || text.slice(loc.startTag.endOffset, loc.endTag.startOffset) !== resourceUri) return null;
  return {
    resourceUri,
    method: 'POST',
    line: loc.startLine,
    uriUtf8: byteAt(text, loc.startOffset),
    tableUtf8: [byteAt(text, tableLoc.startOffset), byteAt(text, tableLoc.endOffset)]
  };
}

export function directAjaxSource(manifest, source, read = fs.readFileSync) {
  try {
    const rawReceipt = read(receiptPath);
    if (sha(rawReceipt) !== receiptSha256) return null;
    const receipt = JSON.parse(rawReceipt.toString('utf8'));
    if (receipt.doc?.url !== docUrl || receipt.example?.url !== exampleUrl || receipt.doc.sha256 === receipt.example.sha256) return null;

    const doc = pinnedSource(manifest, read, receipt.doc, 'reference', 'linked-rest-reference');
    const example = pinnedSource(manifest, read, receipt.example, 'document', 'official-usecase-document');
    if (!doc || !example || !isDeepStrictEqual(source, doc.record)) return null;
    if (!spansMatch(doc.bytes, receipt.doc.matchingLines, 1) || !spansMatch(example.bytes, receipt.example.matchingLines, 2)) return null;

    const table = resourceTable(doc.text, receipt.doc.matchingLines[0].line);
    const docSpan = receipt.doc.matchingLines[0].span;
    if (!table || !within(docSpan, table.uriUtf8) || docSpan[0] < table.tableUtf8[0] || docSpan[1] > table.tableUtf8[1]) return null;
    const documented = new URL(table.resourceUri), executable = new URL(executableUrl);
    if (documented.origin !== executable.origin || documented.pathname !== executable.pathname || !executable.pathname.startsWith('/tmap/')) return null;

    const witness = ajaxWitness(example.text, executableUrl);
    const [run, shown] = receipt.example.matchingLines;
    if (!witness || run.line !== witness.executableLine || shown.line !== witness.displayedLine) return null;
    if (!within(run.span, witness.executable.urlUtf8) || !within(shown.span, witness.displayed.urlUtf8)) return null;

    return {
      ...witness,
      endpoint: executable.pathname.slice('/tmap'.length),
      sourceReceiptSha: receiptSha256,
      receipt,
      doc: { url: doc.record.url, sha256: doc.record.sha256, bytes: doc.bytes.length, ...table, span: docSpan },
      example: { url: example.record.url, sha256: example.record.sha256, bytes: example.bytes.length, spans: [run.span, shown.span] }
    };
  } catch {
    return null;
  }
}
