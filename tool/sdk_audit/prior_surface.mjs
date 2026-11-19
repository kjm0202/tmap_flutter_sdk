import fs from "node:fs/promises";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gunzip = promisify(zlib.gunzip);

export { projectSurface, compareSurfaces } from "./semantic_projection.mjs";

function isValidSha256(sha) {
  return /^[0-9a-f]{64}$/.test(sha);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isFinite(date.getTime()) ? date : null;
}

export async function readPinnedPrior(currentManifest, againstPath) {
  if (!againstPath) throw new Error("Missing againstPath");

  // 1. Fixed trust anchor: load lock
  const lockUrl = new URL("./baselines/predecessor.lock.json", import.meta.url);
  const lockData = JSON.parse(await fs.readFile(lockUrl, "utf-8"));

  // 2. Validate schema version
  if (lockData.schemaVersion !== 1) {
    throw new Error("Invalid or missing schemaVersion in lock file");
  }

  // 3. Validate Current Manifest Identity
  if (
    !currentManifest.id ||
    currentManifest.id !== lockData.currentBaselineId
  ) {
    throw new Error("Mismatch currentManifest.id");
  }

  // 4. Load historical manifest for date validation
  const priorManifestUrl = new URL(
    "./baselines/2026-11-17-production.json",
    import.meta.url,
  );
  const priorManifestRaw = await fs.readFile(priorManifestUrl);
  const priorManifest = JSON.parse(priorManifestRaw.toString());

  // 5. Verify Prior Manifest SHA and ID against pin
  const priorManifestSha = crypto
    .createHash("sha256")
    .update(priorManifestRaw)
    .digest("hex");
  if (priorManifestSha !== lockData.priorManifestSha256) {
    throw new Error("Prior manifest SHA mismatch");
  }
  if (priorManifest.id !== lockData.priorBaselineId) {
    throw new Error("Prior manifest ID mismatch");
  }

  // Ensure IDs differ
  if (currentManifest.id === priorManifest.id) {
    throw new Error("Current and prior baseline IDs must differ");
  }

  // 6. Date validation: prior must precede current, both must be valid
  const priorDate = parseDate(priorManifest.createdAt);
  const currentDate = parseDate(currentManifest.createdAt);

  if (!priorDate || !currentDate) {
    throw new Error("Invalid or missing createdAt date in manifests");
  }

  if (priorDate >= currentDate) {
    throw new Error("Prior date must strictly precede current");
  }

  // 7. Read and Verify againstPath bytes
  let againstBytes;
  try {
    againstBytes = await fs.readFile(againstPath);
  } catch (e) {
    throw new Error("Missing file at againstPath");
  }

  const bundleSha = crypto
    .createHash("sha256")
    .update(againstBytes)
    .digest("hex");
  if (bundleSha !== lockData.bundleSha256) {
    throw new Error("Bundle SHA mismatch");
  }

  // 8. Decompress and Parse
  let payload;
  try {
    payload = JSON.parse((await gunzip(againstBytes)).toString());
  } catch (e) {
    throw new Error("Invalid gzip/JSON");
  }

  // 9. Validate all digests format
  const requiredShas = [
    "sourceReportSha256",
    "sourceDocsSha256",
    "sourceAstSha256",
    "sourceRuntimeSha256",
  ];
  for (const key of requiredShas) {
    if (!isValidSha256(payload[key])) {
      throw new Error(`Invalid or missing ${key} format`);
    }
    if (payload[key] !== lockData[key]) {
      throw new Error(`${key} mismatch with lock file`);
    }
  }

  // 10. Validate payload
  if (payload.schemaVersion !== 1) throw new Error("Invalid schemaVersion");
  if (payload.baselineId !== priorManifest.id)
    throw new Error("Baseline ID mismatch");
  if (payload.sourceRunCreatedAt !== lockData.sourceRunCreatedAt)
    throw new Error("Source run created date mismatch");

  const payloadRunDate = parseDate(payload.sourceRunCreatedAt);
  if (!payloadRunDate || payloadRunDate < priorDate) {
    throw new Error("Invalid sourceRunCreatedAt: must be >= priorDate");
  }

  // 11. Validate rows
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("Empty or invalid rows");
  }

  const rowIds = new Set();
  for (const row of payload.rows) {
    if (typeof row.id !== "string" || row.id === "") {
      throw new Error("Invalid or empty row id");
    }
    if (rowIds.has(row.id)) {
      throw new Error("Duplicate row id");
    }
    rowIds.add(row.id);
  }

  return {
    baselineId: payload.baselineId,
    sha256: lockData.bundleSha256,
    rows: payload.rows,
  };
}
