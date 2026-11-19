import fs from "fs";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import { projectSurface } from "./semantic_projection.mjs";

function stableStringify(obj) {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((sorted, k) => {
            sorted[k] = value[k];
            return sorted;
          }, {});
      }
      return value;
    },
    2,
  );
}

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    options[args[i].replace("--", "")] = args[i + 1];
  }

  const {
    run: runDir,
    current: currentManifestPath,
    prior: priorManifestPath,
    lock: lockPath,
    bundle: bundlePath,
  } = options;

  // 1. Read files
  const run = JSON.parse(
    fs.readFileSync(path.join(runDir, "run.json"), "utf8"),
  );
  const report = JSON.parse(
    fs.readFileSync(path.join(runDir, "report.json"), "utf8"),
  );
  const docs = JSON.parse(
    fs.readFileSync(path.join(runDir, "docs.json"), "utf8"),
  );
  const ast = JSON.parse(
    fs.readFileSync(path.join(runDir, "ast.json"), "utf8"),
  );
  const runtime = JSON.parse(
    fs.readFileSync(path.join(runDir, "runtime.json"), "utf8"),
  );
  const currentManifest = JSON.parse(
    fs.readFileSync(currentManifestPath, "utf8"),
  );
  const priorManifest = JSON.parse(fs.readFileSync(priorManifestPath, "utf8"));

  // 2. Validate IDs
  if (
    run.baselineId !== report.baselineId ||
    run.baselineId !== priorManifest.id
  ) {
    throw new Error("BaselineId mismatch");
  }
  if (currentManifest.id === priorManifest.id) {
    throw new Error("Current and prior capture must differ");
  }

  // 3. Validate dates
  const currentCreatedAt = new Date(currentManifest.createdAt);
  const priorCreatedAt = new Date(priorManifest.createdAt);
  const runCreatedAt = new Date(run.createdAt);

  if (runCreatedAt < priorCreatedAt) {
    throw new Error("Re-extraction predates historic capture");
  }

  if (isNaN(currentCreatedAt) || isNaN(priorCreatedAt) || isNaN(runCreatedAt)) {
    throw new Error("Invalid date format");
  }
  if (priorCreatedAt >= currentCreatedAt) {
    throw new Error(
      "Prior manifest created after or same time as current manifest",
    );
  }

  // 4. Validate SHA256
  const reportSha = getSha256(path.join(runDir, "report.json"));
  const docsSha = getSha256(path.join(runDir, "docs.json"));
  const astSha = getSha256(path.join(runDir, "ast.json"));
  const runtimeSha = getSha256(path.join(runDir, "runtime.json"));

  if (
    reportSha !== run.artifacts["report.json"] ||
    docsSha !== run.artifacts["docs.json"] ||
    astSha !== run.artifacts["ast.json"] ||
    runtimeSha !== run.artifacts["runtime.json"]
  ) {
    throw new Error("SHA256 mismatch");
  }

  // 5. Project Surface
  const projectedRows = projectSurface(report, { docs, ast, runtime });
  if (projectedRows.length === 0) {
    throw new Error("Projected rows is empty");
  }
  // Check unique IDs
  const seenIds = new Set();
  for (const row of projectedRows) {
    if (seenIds.has(row.id)) {
      throw new Error(`Duplicate row ID: ${row.id}`);
    }
    seenIds.add(row.id);
  }
  // Sort by id for determinism
  projectedRows.sort((a, b) => a.id.localeCompare(b.id));

  // 6. Gzip bundle
  const bundle = {
    schemaVersion: 1,
    baselineId: run.baselineId,
    sourceReportSha256: reportSha,
    sourceDocsSha256: docsSha,
    sourceAstSha256: astSha,
    sourceRuntimeSha256: runtimeSha,
    sourceRunCreatedAt: run.createdAt,
    rows: projectedRows,
  };

  const bundleString = stableStringify(bundle);
  const gzippedBundle = zlib.gzipSync(bundleString);
  fs.writeFileSync(bundlePath, gzippedBundle);

  // 7. Write predecessor.lock.json
  const bundleSha256 = crypto
    .createHash("sha256")
    .update(gzippedBundle)
    .digest("hex");
  const lock = {
    schemaVersion: 1,
    currentBaselineId: currentManifest.id,
    priorBaselineId: priorManifest.id,
    priorManifestSha256: getSha256(priorManifestPath),
    bundleSha256: bundleSha256,
    sourceReportSha256: reportSha,
    sourceDocsSha256: docsSha,
    sourceAstSha256: astSha,
    sourceRuntimeSha256: runtimeSha,
    sourceRunCreatedAt: run.createdAt,
  };
  fs.writeFileSync(lockPath, stableStringify(lock));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
