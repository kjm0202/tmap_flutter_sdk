import fs from "node:fs/promises";
import path from "node:path";
import { counts, ROOT, HERE } from "./common.mjs";
import { canonicalDimensions, allGranularStatuses } from "./contracts.mjs";
import { strictGate } from "./reconcile.mjs";

/**
 * Generate a comprehensive, machine-readable drift report and granular assessment.
 */
export function generateDriftReport({
  manifest,
  report,
  contracts,
  startInputs,
  libFingerprint,
  bridgeFingerprint,
  differentialDrift,
  createdAt,
}) {
  const sources = manifest?.sources || [];
  const verifiedSources = sources.filter((s) => s.sha256).length;

  const rows = report.rows || [];
  const items = contracts.items || [];
  const allDimensions = items.flatMap((i) => i.dimensions || []);

  const granularStatusCounts = counts(items, "granularStatus");
  for (const st of allGranularStatuses) {
    if (granularStatusCounts[st] === undefined) granularStatusCounts[st] = 0;
  }

  const dimensionStatusCounts = counts(allDimensions, "status");
  for (const st of allGranularStatuses) {
    if (dimensionStatusCounts[st] === undefined) dimensionStatusCounts[st] = 0;
  }

  const perDimensionBreakdown = {};
  for (const dim of canonicalDimensions) {
    const matching = allDimensions.filter((d) => d.dimension === dim);
    perDimensionBreakdown[dim] = {
      total: matching.length,
      applicable: matching.filter((d) => d.applicable).length,
      statuses: counts(matching, "status"),
    };
  }

  const dynamicUnresolvedSites = (report.issues || []).filter((i) =>
    [
      "dynamic-namespace",
      "dynamic-object-member",
      "dynamic-property-write",
      "dynamic-code",
      "reflective-property-definition",
    ].includes(i.code),
  );

  const gate = strictGate(report);

  if (
    differentialDrift &&
    (differentialDrift.added.length > 0 ||
      differentialDrift.removed.length > 0 ||
      differentialDrift.changed.length > 0)
  ) {
    gate.ok = false;
    gate.reasons.push("unresolved-contract-drift");
  }

  const drift = {
    schemaVersion: 1,
    generatedAt: createdAt,
    prior: differentialDrift
      ? {
          baselineId: differentialDrift.againstBaseline,
          digest: differentialDrift.priorSha256,
        }
      : null,
    baseline: {
      baselineId: manifest.id,
      totalSources: sources.length,
      verifiedSources,
      sdkSha256: sources.find((s) => s.kind === "sdk")?.sha256,
    },
    fingerprints: {
      lib: libFingerprint,
      bridge: bridgeFingerprint,
    },
    projectInputs: startInputs,
    officialSources: {
      total: sources.length,
      verified: verifiedSources,
      updatedBytes: sources.filter((s) => s.status === "updated").length,
      deletedBytes: sources.filter((s) => s.status === "deleted").length,
      addedInputs: sources.filter((s) => s.status === "added").length,
      lockVerified: verifiedSources === sources.length && sources.length > 0,
    },
    channels: {
      fullUnionCount: rows.length,
      consensus: rows.filter((r) => r.channels.length > 1).length,
      crossCheck: {
        docsOnlyCount: report.crossCheck?.docsOnly?.length || 0,
        docsOnly: report.crossCheck?.docsOnly || [],
        astOnlyCount: report.crossCheck?.astOnly?.length || 0,
        astOnly: report.crossCheck?.astOnly || [],
        runtimeOnlyCount: report.crossCheck?.runtimeOnly?.length || 0,
        runtimeOnly: report.crossCheck?.runtimeOnly || [],
      },
    },
    dynamicUnresolvedSites: {
      count: dynamicUnresolvedSites.length,
      sites: dynamicUnresolvedSites,
    },
    granularAssessment: {
      totalContracts: items.length,
      totalDimensionEntries: allDimensions.length,
      contractStatuses: granularStatusCounts,
      dimensionStatuses: dimensionStatusCounts,
      perDimensionBreakdown,
    },
    gate: {
      ok: gate.ok,
      status: gate.ok ? "COMPLETE" : "INCOMPLETE",
      reasons: gate.reasons,
      canPass: gate.ok && dynamicUnresolvedSites.length === 0,
    },
    differentialDrift,
  };

  return drift;
}

/**
 * Render the drift report as human-readable Markdown.
 */
export function renderDriftReport(d) {
  const g = d.granularAssessment;
  const c = d.channels;
  const o = d.officialSources;
  const gateStatus = d.gate.ok ? "PASS (COMPLETE)" : "FAIL (INCOMPLETE)";

  // Prior info
  const priorInfo = d.prior
    ? `**Prior Baseline**: \`${d.prior.baselineId}\` (\`${d.prior.digest?.slice(0, 16)}...\`)`
    : "**Prior Baseline**: *None*";
  // Drift counts
  const driftCounts = d.differentialDrift
    ? `**Drift Counts**: Added: ${d.differentialDrift.added.length}, Removed: ${d.differentialDrift.removed.length}, Changed: ${d.differentialDrift.changed.length}`
    : "**Drift Counts**: *None*";

  const lines = [
    "# SDK Parity Drift & Granular Assessment Report",
    "",
    `**CI Gate Status**: ${gateStatus}`,
    `**Baseline ID**: \`${d.baseline.baselineId}\``,
    priorInfo,
    driftCounts,
    `**Generated**: ${d.generatedAt}`,
    "",
    "## 1. Current-Source Fingerprints & Official Source Verification",
    "",
    `| Component | Files | SHA-256 | Verification |`,
    `| --- | --- | --- | --- |`,
    `| \`lib/\` (Flutter) | ${Object.keys(d.fingerprints.lib?.files || {}).length} | \`${d.fingerprints.lib?.sha256 || "N/A"}\` | Verified current |`,
    `| \`assets/bridge/\` (Shipped Bridge) | ${Object.keys(d.fingerprints.bridge?.files || {}).length} | \`${d.fingerprints.bridge?.sha256 || "N/A"}\` | Verified current |`,
    `| Official Sources | ${o.verified}/${o.total} | \`${d.baseline.sdkSha256?.slice(0, 16)}...\` | ${o.lockVerified ? "Lock verified" : "Source drift detected"} |`,
    "",
    "## 2. Granular Contract Status Distribution",
    "",
    "All seven explicit audit statuses across all addressable contracts:",
    "",
    "| Status | Contracts | Description |",
    "| --- | --- | --- |",
    `| \`unimplemented\` | ${g.contractStatuses.unimplemented || 0} | No Dart counterpart found in public exports |`,
    `| \`partial\` | ${g.contractStatuses.partial || 0} | Candidate or bridge exists but dimension evidence incomplete |`,
    `| \`unverified\` | ${g.contractStatuses.unverified || 0} | Candidate exists; no verified runtime proof for current sources |`,
    `| \`verified\` | ${g.contractStatuses.verified || 0} | Full 3-platform proof matching current source hashes |`,
    `| \`intentional difference\` | ${g.contractStatuses["intentional difference"] || 0} | Documented/reviewed intentional platform adaptation |`,
    `| \`not applicable\` | ${g.contractStatuses["not applicable"] || 0} | Dimension structurally inapplicable with explicit reason |`,
    `| \`source mismatch\` | ${g.contractStatuses["source mismatch"] || 0} | Conflict between upstream docs, AST, or runtime behavior |`,
    "",
    "## 3. Smaller-Than-Method Addressable Dimension Breakdown",
    "",
    "| Dimension | Total | Applicable | Unimplemented | Partial | Unverified | Verified | Intentional Diff | N/A | Source Mismatch |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const [dim, info] of Object.entries(g.perDimensionBreakdown || {})) {
    const s = info.statuses || {};
    lines.push(
      `| \`${dim}\` | ${info.total} | ${info.applicable} | ${s.unimplemented || 0} | ${s.partial || 0} | ${s.unverified || 0} | ${s.verified || 0} | ${s["intentional difference"] || 0} | ${s["not applicable"] || 0} | ${s["source mismatch"] || 0} |`,
    );
  }

  lines.push(
    "",
    "## 4. Channel Isolation & Cross-Check (Full Union vs One-Channel-Only)",
    "",
    `| Channel Scope | Count | Status |`,
    `| --- | --- | --- |`,
    `| **Full Union Inventory** | ${c.fullUnionCount} | All symbols across docs, AST, and runtime engine |`,
    `| Multi-channel Consensus | ${c.consensus} | Confirmed by two or more independent extractors |`,
    `| Docs-Only | ${c.crossCheck.docsOnlyCount} | Documented but not in exported AST or runtime |`,
    `| AST-Only | ${c.crossCheck.astOnlyCount} | Present in AST but omitted from documentation |`,
    `| Runtime-Only | ${c.crossCheck.runtimeOnlyCount} | Dynamic/injected properties unobserved statically |`,
    "",
    "## 5. Dynamic Unresolved Sites",
    "",
    `Total blocking dynamic sites: **${d.dynamicUnresolvedSites.count}**`,
    "",
    "| Issue Code | File / Location | Identifier / Snippet |",
    "| --- | --- | --- |",
  );

  const topSites = (d.dynamicUnresolvedSites.sites || []).slice(0, 20);
  for (const site of topSites) {
    const loc = site.evidence?.line
      ? `${site.evidence.file}:${site.evidence.line}:${site.evidence.column}`
      : site.evidence?.file || site.file || "unknown";
    const snip = (site.evidence?.snippet || site.owner || site.name || "")
      .replace(/\n/g, " ")
      .slice(0, 40);
    lines.push(`| \`${site.code}\` | \`${loc}\` | \`${snip}\` |`);
  }
  if (d.dynamicUnresolvedSites.count > 20) {
    lines.push(
      `| ... | *and ${d.dynamicUnresolvedSites.count - 20} more* | *see drift.json* |`,
    );
  }

  lines.push(
    "",
    "## 6. CI Completion Gate Summary",
    "",
    `- **Gate Result**: ${d.gate.ok ? "PASS" : "FAIL (BLOCKED)"}`,
    `- **Can CI Pass**: \`${d.gate.canPass}\``,
    "- **Blocking Gate Reasons**:",
    ...(d.gate.reasons.length
      ? d.gate.reasons.map((r) => `  - \`${r}\``)
      : ["  - *(None)*"]),
    "",
  );

  return lines.join("\n");
}
