import { verifiedDocumentSources } from './current_rest_document_sources.mjs';
import { releasedAdapterProof } from './release_rest_named_adapters.mjs';
import { currentReferenceValidator } from './current_reference_scope.mjs';
import { verifiedDirectRestExample } from './direct_rest_example_proof.mjs';
import { verifiedHistoricalNamedRest } from './historical_named_rest.mjs';
import { isDeepStrictEqual } from 'node:util';

export function reviewRestDocuments({issues, manifest, docs, rows, referenceRuntimeEvidence}) {
  if (!Array.isArray(docs?.restReferenceFields)) {
    return { open: issues, resolved: [] };
  }

  const resolved = [];

  const targetCode = 'rest-reference-schema-review-required';
  const isValidRow = currentReferenceValidator({
    rows,
    baselineId: manifest.id,
    sdkSha256: manifest.sources.find(s => s.kind === "sdk")?.sha256,
    referenceRuntimeEvidence
  });

  const issuesBySource = new Map();
  for (const issue of issues) {
    if (issue.code === targetCode) {
      if (!issuesBySource.has(issue.source)) {
        issuesBySource.set(issue.source, []);
      }
      issuesBySource.get(issue.source).push(issue);
    }
  }

  for (const [source, sourceIssues] of issuesBySource.entries()) {
    const sourceSources = manifest.sources.filter(s=>s.url===source && s.kind==="reference" && s.role==="linked-rest-reference");
    if (sourceIssues.length !== 1 || sourceSources.length !== 1) {
      continue;
    }

    const issue = sourceIssues[0];

    const template = { code: issue.code, source: issue.source, tables: issue.tables, reason: issue.reason };
    if (!isDeepStrictEqual(issue, template)) {
      continue;
    }

    if (issue.reason !== "Linked TData request/response tables preserved; field hierarchy and JS callback adapters not yet reconciled.") {
      continue;
    }

    if (!Number.isInteger(issue.tables) || issue.tables <= 0) {
      continue;
    }

    const docFields = docs.restReferenceFields.filter(f => f.source === source);
    const manifestSource = manifest.sources.find(s => s.url === source);
    const docProof = verifiedDocumentSources(manifestSource, docFields);

    if (!docProof) {
      continue;
    }

    const expectedIds = Array.from({ length: issue.tables }, (_, i) => `rest-reference:${source}:table-${i}`);
    if (docProof.tableIds.length !== expectedIds.length || !expectedIds.every((id, i) => docProof.tableIds[i] === id)) {
      continue;
    }

    const historicalEvidence = verifiedHistoricalNamedRest({
      manifest, source: manifestSource, docs, rows, docProof,
      validateNamedMethods: isValidRow.namedMethodsPresent
    });
    if (historicalEvidence) {
      resolved.push({
        original: issue,
        status: 'DOCUMENT_HISTORICAL_NAMED_SCHEMA_ADAPTER_SCOPE_RESOLVED',
        scope: historicalEvidence.scope,
        rationale: 'Pinned historical documents and named original JS methods are mapped to their source adapters; the published Dart named routes are absent. Source-only evidence does not verify REST wire behavior or any document field.',
        receipt: { source, proof: historicalEvidence }
      });
      continue;
    }

    const directRestEvidence = verifiedDirectRestExample({
      manifest,
      source: manifestSource,
      docs,
      docProof,
      rows,
      validateNamedRoute: isValidRow.namedRouteAbsent
    });

    if (directRestEvidence?.wireStatus === "UNVERIFIED" &&
        directRestEvidence.sourceProof &&
        directRestEvidence.namedRouteProof &&
        directRestEvidence.releasedAdapters) {
      resolved.push({
        original: issue,
        status: "DOCUMENT_DIRECT_REST_EXAMPLE_SCOPE_RESOLVED",
        scope: "original-direct-rest-example-outside-named-sdk",
        rationale: "One executable official direct jQuery POST and its displayed copy match the reference resource table; the endpoint is outside the named JS and released Dart adapters. No live request; REST behavior and all fields remain unverified.",
        receipt: {
          source: source,
          proof: directRestEvidence
        }
      });
      continue;
    }

    let isValid = true;
    let representativeRow = null;
    let sdkComparisonSha256 = null;
    let firstEndpoints = null;

    for (const tableId of docProof.tableIds) {
      const tableRows = rows.filter(r => r.id === tableId);
      if (tableRows.length !== 1) {
        isValid = false;
        break;
      }
      const row = tableRows[0];

      if (!isValidRow(row) || row.referenceScopeReview.documentUrl !== source || row.referenceScopeReview.documentSha256 !== manifestSource.sha256) {
        isValid = false;
        break;
      }

      if (!representativeRow) {
        representativeRow = row;
      }

      if (!sdkComparisonSha256) {
        sdkComparisonSha256 = row.referenceScopeReview.comparisonSha256;
      } else if (sdkComparisonSha256 !== row.referenceScopeReview.comparisonSha256) {
        isValid = false;
        break;
      }

      if (!firstEndpoints) {
        firstEndpoints = row.referenceScopeReview.endpoints;
      } else if (JSON.stringify(firstEndpoints) !== JSON.stringify(row.referenceScopeReview.endpoints)) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      continue;
    }

    const proof = releasedAdapterProof(firstEndpoints);
    if (!proof) {
      continue;
    }

    resolved.push({
      original: issue,
      status: "DOCUMENT_REFERENCE_SCOPE_RESOLVED",
      rationale: "Validated REST reference scope against verified source and runtime proof. Source display only, field wire/behavior unverified.",
      scope: representativeRow.referenceScopeReview.scope,
      receipt: {
        source: source,
        releasedAdapters: proof,
        docProof: docProof,
        sdkComparisonSha256: sdkComparisonSha256,
        endpoints: firstEndpoints
      }
    });
  }

  const resolvedOriginals = new Set(resolved.map(r => r.original));
  const open = issues.filter(issue => !resolvedOriginals.has(issue));

  return { open, resolved };
}
