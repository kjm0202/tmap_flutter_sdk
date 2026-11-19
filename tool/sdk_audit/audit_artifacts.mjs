import {
  compareObservations,
  reconcile,
  strictGate,
  renderReport,
} from "./reconcile.mjs";
import { contractWorklist, renderContractWorklist } from "./contracts.mjs";
import { generateDriftReport, renderDriftReport } from "./drift.mjs";
import { projectSurface, compareSurfaces } from "./prior_surface.mjs";

export const mandatoryArtifacts = [
  "docs.json",
  "ast.json",
  "runtime.json",
  "dart.json",
  "dart-observations.json",
  "observations.json",
  "inventory.json",
  "contracts.json",
  "contracts.md",
  "drift.json",
  "drift.md",
  "report.json",
  "report.md",
];

export function generateContracts(report, docs) {
  const contracts = contractWorklist(report);
  contracts.restReferenceFields = docs.restReferenceFields || [];
  contracts.restReferenceFieldSummary = docs.restReferenceFieldSummary || { total: 0, status: 'unverified' };
  return contracts;
}

export function deriveAudit({
  manifest,
  sources,
  docs,
  ast,
  runtime,
  dart,
  values,
  cases,
  mappings,
  libFingerprint,
  bridgeFingerprint,
  startInputs,
  prior,
  createdAt,
}) {
  const observations = compareObservations(cases, runtime.observations, values);
  const report = reconcile({
    manifest,
    sources,
    docs,
    ast,
    runtime,
    dart,
    mappings,
    observations,
    libFingerprint,
    bridgeFingerprint,
  });

  const contracts = generateContracts(report, docs);
  const contractsMd = renderContractWorklist(contracts);
  const reportMd = renderReport(report);

  const currentRows = projectSurface(report, { docs, ast, runtime });
  const { added, removed, changed } = compareSurfaces(prior.rows, currentRows);

  const differentialDrift = {
    againstBaseline: prior.baselineId,
    priorSha256: prior.sha256,
    added,
    removed,
    changed,
    addedContractsCount: added.length,
    removedContractsCount: removed.length,
    changedContractsCount: changed.length,
  };

  const drift = generateDriftReport({
    manifest,
    report,
    contracts,
    startInputs,
    libFingerprint,
    bridgeFingerprint,
    differentialDrift,
    createdAt,
  });

  const gate = drift.gate;

  const driftMd = renderDriftReport(drift);

  const artifacts = {
    "docs.json": docs,
    "ast.json": ast,
    "runtime.json": runtime,
    "dart.json": dart,
    "dart-observations.json": values,
    "observations.json": observations,
    "inventory.json": report.rows,
    "contracts.json": contracts,
    "contracts.md": contractsMd,
    "drift.json": drift,
    "drift.md": driftMd,
    "report.json": report,
    "report.md": reportMd,
  };

  return { artifacts, gate };
}
