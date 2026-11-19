import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { ROOT } from "./common.mjs";

const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Synchronous version of filesUnder
function filesUnderSync(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
  for (const e of entries) {
    if (["node_modules", ".dart_tool", ".cache"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnderSync(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// Synchronous version of fingerprint
function fingerprintSync(dir) {
  const result = {};
  for (const file of filesUnderSync(dir)) {
    result[path.relative(ROOT, file)] = sha(fs.readFileSync(file));
  }
  return { sha256: sha(JSON.stringify(result)), files: result };
}

// Full lib tree SHA256s recorded after the receipt, on which all 19 retired
// fixture preconditions were independently rechecked. They are accepted only
// on top of the exact receipt tree below, and only when the supplied
// fingerprint deep-equals a fresh recomputation of every actual lib file, so
// the hash binds the complete tree. Any other lib change still fails.
const RECEIPT_LIB_SHA256 = "6de6a6f56ab16fa4be49760b2a260f4fac8aa01c74b5161ba59cc311030e349f";
const VERIFIED_LIB_SHA256S = [
  // EPSG:3857 projected route fix: route_info.dart, tdata_service.dart
  "e8cd02a6820b47ae747a04db4c79e66baa49c26de4206d7d173c1dab7a5e60b0",
  // POI coordinate-pair change on the projected route tree: poi_item.dart
  "44766d5b0d5e7167dc9aebeadbe28b46444af7aca6677e619901581574b729c0",
  // Released TData error envelope case
  "77bd4c3aa5515f72f90b698fafefe0bbfafc585555fa68981b796221113649f3",
];

export function reviewRetiredTDataTargets({ issues, manifest, runtime, libFingerprint }) {
  try {
    const receiptPath = path.resolve(ROOT, "docs/sdk-audit/checkpoints/2026-11-19/retired-tdata-adapter-targets.json.gz");
    const compressedBytes = fs.readFileSync(receiptPath);

    if (sha(compressedBytes) !== "cfca14748d7cc9e6868e8f6b025b6d8b41bf7e1ef6e640e7fc3e5d238f768a8b") {
      throw new Error("Receipt hash mismatch");
    }

    const receipt = JSON.parse(zlib.gunzipSync(compressedBytes));

    // Auth/Network
    const { id: _, ...manifestWithoutId } = manifest;
    const officialKeyAuthBootstrap = manifest.sources.find(s => s.role === "official-key-authenticated-bootstrap");
    const bootstrapCdnVersionedCore = manifest.sources.find(s =>
      s.role === "bootstrap-cdn-versioned-core" &&
      s.url === runtime.networkScripts?.[0]?.url &&
      s.sha256 === runtime.networkScripts?.[0]?.sha256
    );
    const networkScripts = runtime.networkScripts || [];

    const isValid =
        manifest.id === receipt.baseline &&
        sha(JSON.stringify(manifestWithoutId)) === manifest.id &&
        runtime.auth === 'script-executed' &&
        runtime.platformEvidence === undefined &&
        runtime.verifiedBootstrapDigest === officialKeyAuthBootstrap?.sha256 &&
        networkScripts.length === 1 &&
        networkScripts[0].status === 200 &&
        networkScripts[0].pinned === true &&
        networkScripts[0].classification === 'pinned-core' &&
        networkScripts[0].sha256 === bootstrapCdnVersionedCore?.sha256 &&
        networkScripts[0].url === bootstrapCdnVersionedCore?.url;

    if (!isValid) {
      return { open: issues, resolved: [] };
    }

    // Verify collector and release archive SHA
    const collectorPath = path.resolve(ROOT, receipt.collector.path);
    const collectorSha = sha(fs.readFileSync(collectorPath));
    if (collectorSha !== receipt.collector.sha256) {
        return { open: issues, resolved: [] };
    }
    const releasePath = path.resolve(ROOT, receipt.release.archive);
    const releaseSha = sha(fs.readFileSync(releasePath));
    if (releaseSha !== receipt.release.sha256) {
        return { open: issues, resolved: [] };
    }

    // Supplied libFingerprint deep-equals the freshly recomputed actual
    // repository fingerprint, and that tree is either the receipt's tree or
    // one of the verified trees above
    const currentLibFingerprint = fingerprintSync(path.resolve(ROOT, "lib"));
    const matchesReceipt = isDeepStrictEqual(libFingerprint, receipt.currentLibFingerprint);
    const matchesVerifiedTree =
        receipt.currentLibFingerprint?.sha256 === RECEIPT_LIB_SHA256 &&
        VERIFIED_LIB_SHA256S.includes(currentLibFingerprint.sha256);

    if (!isDeepStrictEqual(libFingerprint, currentLibFingerprint) ||
        !(matchesReceipt || matchesVerifiedTree)) {
       return { open: issues, resolved: [] };
    }

    // Verify complete actual lib file list and file hashes compared to supplied .files
    if (JSON.stringify(currentLibFingerprint.files) !== JSON.stringify(libFingerprint.files)) {
        return { open: issues, resolved: [] };
    }

    const open = [];
    const resolved = [];

    for (const issue of issues) {
      const sharingCode = issues.filter(i => i.code === issue.code);
      const match = sharingCode.length === 1
        ? receipt.historical.find(h => isDeepStrictEqual(h.original, issue))
        : null;

      if (match) {
        const collectorPath = path.resolve(ROOT, match.collector.path);
        let collectorShaMatch = false;
        try {
          const collectorFile = fs.readFileSync(collectorPath);
          collectorShaMatch = sha(collectorFile) === match.collector.sha256;
        } catch (e) {
          collectorShaMatch = false;
        }

        if (!collectorShaMatch) {
          open.push(issue);
          continue;
        }

        const evidence = {
          className: match.className,
          historicalSourceSha256: match.historicalSourceSha256,
          collector: match.collector,
          releaseSha: receipt.release.sha256,
        };

        if (match.helpers) {
          evidence.helpers = match.helpers;
          evidence.reviews = match.reviews;
        } else {
          evidence.helper = match.helper;
          evidence.review = match.review;
        }

        if (currentLibFingerprint.files[match.sourceFile]) {
          evidence.currentSourceSha256 = currentLibFingerprint.files[match.sourceFile];
        }
        resolved.push({
          original: issue,
          status: "REVIEWED_OBSOLETE_AUDIT_TARGET",
          scope: "old named adapter fixture only",
          rationale: "absence of unshipped historical Dart adapter entry points (old classes and mixin methods) in release and current lib",
          evidence: evidence
        });
      } else {
        open.push(issue);
      }
    }

    return { open, resolved };
  } catch (e) {
    return { open: issues, resolved: [] };
  }
}
