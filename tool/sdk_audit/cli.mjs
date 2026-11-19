#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import {
  HERE,
  ROOT,
  sha,
  json,
  readJSON,
  writeJSON,
  fingerprint,
  issue,
} from "./common.mjs";
import {
  readPlatformEvidence,
  validatePlatformEvidence,
} from "./platforms.mjs";
import { packSources, restoreArchive } from "./archive.mjs";
import { snapshot, readSources } from "./sources.mjs";
import { extractDocs } from "./docs.mjs";
import { extractAST } from "./ast.mjs";
import { captureRuntime } from "./runtime.mjs";

import { deriveAudit, mandatoryArtifacts } from "./audit_artifacts.mjs";
import { readPinnedPrior } from "./prior_surface.mjs";
import {
  captureSourceRevision,
  verifySourceSnapshot,
  validateSourceRevision,
} from "./source_revision.mjs";

const args = process.argv.slice(2),
  command = args.shift();
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return args[i + 1];
}

// Default snapshot
const baseline = path.resolve(
  option(
    "--snapshot",
    path.join(HERE, "baselines/production-2026-11-19-46fa62a7bb27.json"),
  ),
);
const out = path.resolve(
  option("--out", path.join(ROOT, "docs/sdk-audit/latest")),
);
const dartBin = option("--dart", process.env.TMAP_DART || "dart");

async function runDart(script, params = []) {
  const processResult = await new Promise((resolve, reject) => {
    const p = spawn(
      dartBin,
      ["run", path.join(HERE, "dart/bin", script), ...params],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "",
      stderr = "";
    p.stdout.on("data", (b) => (stdout += b));
    p.stderr.on("data", (b) => (stderr += b));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  if (processResult.code !== 0)
    throw new Error(`Dart ${script} failed: ${processResult.stderr}`);
  return JSON.parse(processResult.stdout);
}
async function projectInputs() {
  const files = {};
  for (const name of [
    "pubspec.yaml",
    "pubspec.lock",
    "analysis_options.yaml",
  ]) {
    const p = path.join(ROOT, name);
    try {
      files[name] = sha(await fs.readFile(p));
    } catch (_) {}
  }
  const pkgLock = path.join(HERE, "package-lock.json");
  try {
    files["tool/sdk_audit/package-lock.json"] = sha(await fs.readFile(pkgLock));
  } catch (_) {}
  return files;
}

async function saveRun(
  artifacts,
  startInputs,
  prior,
  createdAt,
  baselineId,
  sourceRevision,
) {
  await fs.mkdir(out, { recursive: true });
  const artifactDigests = {};
  for (const [name, value] of Object.entries(artifacts)) {
    const bytes = name.endsWith(".md") ? value : json(value);
    await fs.writeFile(path.join(out, name), bytes);
    artifactDigests[name] = sha(bytes);
  }

  await writeJSON(path.join(out, "run.json"), {
    schemaVersion: 2,
    createdAt: createdAt,
    baselineId: baselineId,
    prior: { baselineId: prior.baselineId, sha256: prior.sha256 },
    sourceRevision,
    libFingerprint: artifacts["report.json"].libFingerprint,
    bridgeFingerprint: artifacts["report.json"].bridgeFingerprint,
    toolFingerprint: await fingerprint(HERE),
    projectInputs: startInputs,
    artifacts: artifactDigests,
  });
}

async function audit() {
  const startSource = await captureSourceRevision(ROOT);
  const previousReportPath = option("--against");
  if (!previousReportPath) {
    throw new Error("Audit requires --against <pinned previous surface>");
  }

  const keyFile = option("--key-file", process.env.TMAP_AUDIT_KEY_FILE);
  const restore = args.includes("--restore");

  const pinnedManifest = await readJSON(baseline);
  const prior = await readPinnedPrior(
    pinnedManifest,
    path.resolve(previousReportPath),
  );

  const { manifest, sources } = await readSources(baseline, {
    restore,
    keyFile,
  });

  if (manifest.id !== pinnedManifest.id)
    throw Error("Snapshot changed during prior validation");

  const startLib = await fingerprint(path.join(ROOT, "lib")),
    startBridge = await fingerprint(path.join(ROOT, "assets/bridge")),
    startTool = await fingerprint(HERE),
    startInputs = await projectInputs();

  const docs = extractDocs(sources, manifest),
    ast = extractAST(
      sources.filter(
        (s) =>
          s.kind === "sdk" ||
          s.kind === "sdk-worker" ||
          s.kind === "sdk-script",
      ),
    );
  const mappings = await readJSON(path.join(HERE, "mappings.json")),
    cases = await readJSON(path.join(HERE, "scenarios.json"));

  let dart, values;
  try {
    dart = await runDart("inventory.dart", [ROOT]);
  } catch (e) {
    dart = {
      rows: [],
      issues: [issue("dart-inventory-failed", { error: e.message })],
    };
  }
  try {
    values = await runDart("probe.dart", [path.join(HERE, "scenarios.json")]);
  } catch (e) {
    values = [];
    dart.issues.push(issue("dart-probe-failed", { error: e.message }));
  }
  let bridges;
  try {
    bridges = await runDart("bridges.dart", [ROOT]);
  } catch (e) {
    dart.issues.push(
      issue("dart-bridge-generation-failed", { error: e.message }),
    );
  }
  const runtime = args.includes("--skip-runtime")
    ? {
        rows: [],
        issues: [issue("runtime-explicitly-skipped")],
        aliases: {},
        observations: [],
        instances: [],
        platformEvidence: { records: [] },
      }
    : await captureRuntime(sources, {
        keyFile,
        scenarios: cases,
        getterInputs: await readJSON(path.join(HERE, "getter_inputs.json")),
        bridges,
      });

  if (
    startLib.sha256 !== (await fingerprint(path.join(ROOT, "lib"))).sha256 ||
    startBridge.sha256 !==
      (await fingerprint(path.join(ROOT, "assets/bridge"))).sha256 ||
    startTool.sha256 !== (await fingerprint(HERE)).sha256 ||
    JSON.stringify(startInputs) !== JSON.stringify(await projectInputs())
  )
    throw new Error(
      "Inputs changed during audit; rerun before accepting evidence",
    );

  try {
    const evidence = await readPlatformEvidence();
    if (evidence) {
      runtime.platformEvidence = evidence;
    }
  } catch (e) {
    // Do not reject null missing platform evidence (genuine red gate)
    runtime.issues.push(
      issue("stale-or-invalid-platform-evidence", { error: e.message }),
    );
  }

  for (const record of runtime.platformEvidence?.records || [])
    if (!record.passed)
      runtime.issues.push(
        issue("platform-suite-unresolved", {
          platform: record.platform,
          kind: record.kind,
          evidence: record.file,
        }),
      );

  const createdAt = new Date().toISOString();

  const { artifacts, gate } = deriveAudit({
    manifest,
    sources,
    docs,
    ast,
    runtime,
    dart,
    values,
    cases,
    mappings,
    libFingerprint: startLib,
    bridgeFingerprint: startBridge,
    startInputs,
    prior,
    createdAt,
  });

  verifySourceSnapshot(startSource, await captureSourceRevision(ROOT));
  await saveRun(
    artifacts,
    startInputs,
    prior,
    createdAt,
    manifest.id,
    startSource.revision,
  );

  console.log(
    JSON.stringify(
      {
        output: path.relative(ROOT, out),
        gate,
      },
      null,
      2,
    ),
  );
  if (!gate.ok) process.exitCode = 1;
}

async function check() {
  const pathArg = option("--against");
  if (!pathArg)
    throw Error("check requires --against <pinned previous surface>");

  const pinnedManifest = await readJSON(baseline);
  const prior = await readPinnedPrior(pinnedManifest, path.resolve(pathArg));

  const { manifest, sources } = await readSources(baseline, {
    restore: args.includes("--restore"),
    keyFile: option("--key-file", process.env.TMAP_AUDIT_KEY_FILE),
  });

  if (manifest.id !== pinnedManifest.id)
    throw Error("Snapshot changed during prior validation");

  const isIntegrityOnly = args.includes("--integrity-only");
  const run = await readJSON(path.join(out, "run.json"));
  await validateSourceRevision(run.sourceRevision, {
    requiredCommit: option("--source-commit"),
    root: ROOT,
  });

  const expected = [...mandatoryArtifacts].sort();
  if (
    !run.artifacts ||
    JSON.stringify(Object.keys(run.artifacts).sort()) !==
      JSON.stringify(expected)
  )
    throw new Error("Mandatory audit artifact set mismatch");

  if (run.schemaVersion !== 2) throw new Error("Invalid schemaVersion");
  if (run.baselineId !== manifest.id) throw new Error("baselineId mismatch");

  const sha256Regex = /^[a-f0-9]{64}$/;
  for (const file of mandatoryArtifacts) {
    const digest = run.artifacts[file];
    if (!sha256Regex.test(digest))
      throw new Error(`Invalid digest for ${file}`);
    if (sha(await fs.readFile(path.join(out, file))) !== digest)
      throw new Error(`Audit artifact changed: ${file}`);
  }

  // Validate docs & AST
  const derivedDocs = extractDocs(sources, manifest);
  if (sha(json(derivedDocs)) !== run.artifacts["docs.json"])
    throw new Error("Stale docs.json digest");

  const derivedAST = extractAST(
    sources.filter((s) => ["sdk", "sdk-worker", "sdk-script"].includes(s.kind)),
  );
  if (sha(json(derivedAST)) !== run.artifacts["ast.json"])
    throw new Error("Stale ast.json digest");

  // Validate prior binding
  if (
    run.prior.baselineId !== prior.baselineId ||
    run.prior.sha256 !== prior.sha256
  )
    throw new Error("Stale or invalid prior binding");

  // Validate createdAt
  const runDate = new Date(run.createdAt);
  const manifestDate = new Date(manifest.createdAt);
  if (!run.createdAt || isNaN(runDate.getTime()))
    throw new Error("Invalid createdAt");
  if (runDate < manifestDate)
    throw new Error("run createdAt is before manifest createdAt");
  if (runDate > Date.now()) throw new Error("run createdAt is in the future");

  // Validate fingerprints
  if (
    !isDeepStrictEqual(
      run.libFingerprint,
      await fingerprint(path.join(ROOT, "lib")),
    )
  )
    throw new Error("Stale libFingerprint");
  if (
    !isDeepStrictEqual(
      run.bridgeFingerprint,
      await fingerprint(path.join(ROOT, "assets/bridge")),
    )
  )
    throw new Error("Stale bridgeFingerprint");
  if (!isDeepStrictEqual(run.toolFingerprint, await fingerprint(HERE)))
    throw new Error("Stale toolFingerprint");

  // Validate inputs
  if (
    JSON.stringify(run.projectInputs) !== JSON.stringify(await projectInputs())
  )
    throw new Error("Project dependency inputs changed: rerun audit");

  // Rebuild
  const [docs, ast, runtime, dart, values] = await Promise.all(
    [
      "docs.json",
      "ast.json",
      "runtime.json",
      "dart.json",
      "dart-observations.json",
    ].map((f) => readJSON(path.join(out, f))),
  );

  try {
    if (runtime.platformEvidence) {
      await validatePlatformEvidence(runtime.platformEvidence);
    }
  } catch (e) {
    throw new Error("Stale or invalid platform evidence: " + e.message);
  }

  for (const record of runtime.platformEvidence?.records || [])
    if (!record.passed) throw new Error("platform-suite-unresolved");

  const cases = await readJSON(path.join(HERE, "scenarios.json")),
    mappings = await readJSON(path.join(HERE, "mappings.json"));

  const { artifacts, gate } = deriveAudit({
    manifest,
    sources,
    docs,
    ast,
    runtime,
    dart,
    values,
    cases,
    mappings,
    libFingerprint: run.libFingerprint,
    bridgeFingerprint: run.bridgeFingerprint,
    startInputs: run.projectInputs,
    prior,
    createdAt: run.createdAt,
  });

  // Compare bytes SHA for ALL expected derived artifacts
  for (const [file, content] of Object.entries(artifacts)) {
    const expectedSha = file.endsWith(".md")
      ? sha(content)
      : sha(json(content));
    if (expectedSha !== run.artifacts[file])
      throw new Error(`Drift detected in ${file}`);
  }

  if (command === "diff") {
    const delta = artifacts["drift.json"].differentialDrift;
    console.log(json(delta));
    if (delta.added.length + delta.removed.length + delta.changed.length)
      process.exitCode = 1;
    return;
  }

  if (isIntegrityOnly) {
    console.log(JSON.stringify({ integrity: "VERIFIED", gate }));
    return; // Returns 0, implicit exit code
  }

  console.log(
    JSON.stringify(
      {
        gate,
      },
      null,
      2,
    ),
  );
  if (!gate.ok) process.exitCode = 1;
}
try {
  if (command === "snapshot") {
    const destination = option("--snapshot");
    if (!destination)
      throw new Error("snapshot requires --snapshot <NEW destination>");
    try {
      await fs.access(destination);
      throw new Error("Destination already exists: " + destination);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const r = await snapshot(baseline);
    console.log(
      json({
        acquisition: "unauthenticated discovery",
        baselineId: r.id,
        sources: r.sources.length,
        issues: r.issues,
      }),
    );
    if (r.issues.length) process.exitCode = 1;
  } else if (command === "pack") {
    const archive = option("--archive");
    if (!archive) throw new Error("pack requires --archive path");
    console.log(json(await packSources(baseline, path.resolve(archive))));
  } else if (command === "restore") {
    const archive = option("--archive");
    const r = archive
      ? await restoreArchive(baseline, path.resolve(archive))
      : await readSources(baseline, {
          restore: true,
          keyFile: option("--key-file", process.env.TMAP_AUDIT_KEY_FILE),
        });
    console.log(
      json({ baselineId: r.manifest.id, verifiedSources: r.sources.length }),
    );
  } else if (command === "audit") await audit();
  else if (command === "check") await check();
  else if (command === "diff") await check();
  else
    throw new Error(
      "Usage: node tool/sdk_audit/cli.mjs snapshot --snapshot <NEW destination> | pack --archive <path> | restore [--archive <path>] | audit --against <pinned prior surface.json.gz> | check --against <pinned prior surface.json.gz> | diff --against <pinned prior surface.json.gz> [--source-commit full-sha] [--out directory] [--key-file private.json] [--dart executable] [--restore] [--skip-runtime]",
    );
} catch (e) {
  console.error(e.message);
  process.exitCode = 2;
}
