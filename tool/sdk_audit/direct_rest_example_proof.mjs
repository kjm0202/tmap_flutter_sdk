import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'cheerio';
import { HERE, sha } from './common.mjs';
import { directAjaxSource } from './direct_ajax_source.mjs';
import { releasedAdapterProof } from './release_rest_named_adapters.mjs';
import { verifiedDocumentSources } from './current_rest_document_sources.mjs';

// Scope proof for the one REST reference whose official example is a direct
// jQuery POST outside the named TData adapters. It never verifies REST wire
// behavior and never changes candidate rows: every table stays unmapped and
// every generated field stays unverified.
const docUrl = 'https://tmapapi.tmapmobility.com/webservice/docs/tmapRouteOptimization30Doc.html';
const tableCount = 8, fieldCount = 60;
const emptyKeys = ['contracts', 'observations', 'dartCandidates', 'bridgeObservations', 'boundedPlatformObservations'];

// Each table row is the single unmapped docs-only candidate whose evidence equals the actual table.
function unmappedTables(source, rows, read) {
  const bytes = read(path.join(HERE, '.cache/sources', source.sha256));
  if (sha(bytes) !== source.sha256 || bytes.length !== source.bytes) return null;
  const $ = load(bytes.toString('utf8'), { sourceCodeLocationInfo: true }), tables = $('table').toArray();
  const prefix = `rest-reference:${source.url}:`;
  if (tables.length !== tableCount || rows.filter(r => typeof r?.id === 'string' && r.id.startsWith(prefix)).length !== tableCount) return null;
  const bound = [];
  for (let i = 0; i < tableCount; i++) {
    const id = `${prefix}table-${i}`, matching = rows.filter(r => r?.id === id);
    if (matching.length !== 1) return null;
    const [row] = matching, line = tables[i].sourceCodeLocation?.startLine, anchor = $(tables[i]).attr('id') || null;
    const evidence = { channel: 'docs', source: source.url, sha256: source.sha256, anchor, line };
    if (!Number.isInteger(line) || row.status !== 'unmapped' || row.scope !== 'linked-rest-reference' || row.owner !== null || 'referenceScopeReview' in row) return null;
    if (!isDeepStrictEqual(row.kinds, ['reference-table']) || !isDeepStrictEqual(row.channels, ['docs']) || !isDeepStrictEqual(row.sourceNames, [id])) return null;
    if (!emptyKeys.every(k => Array.isArray(row[k]) && row[k].length === 0) || !isDeepStrictEqual(row.evidence, [evidence])) return null;
    bound.push({ id, line, anchor, status: row.status });
  }
  return bound;
}

export function verifiedDirectRestExample({ manifest, source, docs, docProof, rows, validateNamedRoute }, read = fs.readFileSync) {
  try {
    if (source?.url !== docUrl || typeof validateNamedRoute !== 'function' || !Array.isArray(rows) || !Array.isArray(docs?.restReferenceFields)) return null;

    // Recompute the generated-field proof rather than trusting the supplied one.
    const fields = docs.restReferenceFields.filter(f => f.source === source.url);
    if (fields.length !== fieldCount || !fields.every(f => f.status === 'unverified' && f.sourceSha256 === source.sha256)) return null;
    const expectedIds = Array.from({ length: tableCount }, (_, i) => `rest-reference:${source.url}:table-${i}`);
    const recomputed = verifiedDocumentSources(source, fields, read);
    if (!recomputed || !isDeepStrictEqual(recomputed, docProof) || docProof.fieldCount !== fieldCount || docProof.documentSha256 !== source.sha256 || !isDeepStrictEqual(docProof.tableIds, expectedIds)) return null;

    const tables = unmappedTables(source, rows, read);
    const sourceProof = directAjaxSource(manifest, source, read);
    if (!tables || !sourceProof) return null;
    const { receipt, ...example } = sourceProof;
    if (receipt.tables !== tableCount || receipt.generatedFieldRows !== fieldCount || receipt.allUnverified !== true || !isDeepStrictEqual(receipt.candidateTableStatuses, ['unmapped'])) return null;

    // The endpoint is absent from both authenticated cores and from the released named adapters.
    const namedRouteProof = validateNamedRoute(example.endpoint);
    if (namedRouteProof?.endpoint !== example.endpoint || !Array.isArray(namedRouteProof.cores) || namedRouteProof.cores.length !== receipt.officialCores.length) return null;
    if (!receipt.officialCores.every((core, i) => namedRouteProof.cores[i].sha256 === core.sha256 && namedRouteProof.cores[i].methods === core.namedMethods && core.namedMethods === 28 && core.exactMethods === 0 && core.endpointLiteralOccurrences === 0)) return null;
    const releasedAdapters = releasedAdapterProof([example.endpoint], read);
    if (!releasedAdapters || releasedAdapters.archiveSha256 !== receipt.releasedDartArchive || receipt.directPublishedDartEndpoint !== false) return null;
    if (!isDeepStrictEqual([...releasedAdapters.namedRoutes].sort(), [...receipt.sevenNamedEndpointPaths].sort())) return null;

    return {
      wireStatus: 'UNVERIFIED',
      scope: receipt.scope,
      source: source.url,
      endpoint: example.endpoint,
      verb: example.verb,
      tables,
      fieldCount,
      docProof,
      sourceProof: example,
      namedRouteProof,
      releasedAdapters
    };
  } catch {
    return null;
  }
}
