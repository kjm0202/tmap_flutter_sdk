import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  captureSourceRevision,
  validateSourceRevision,
  verifySourceSnapshot,
} from "../source_revision.mjs";

async function repository(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "audit-revision-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], {
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
      stdio: "pipe",
    })
      .toString()
      .trim();
  git("init", "-q");
  git("config", "user.name", "Audit test");
  git("config", "user.email", "audit-test@example.invalid");
  await fs.writeFile(path.join(root, "source"), "source\n");
  await fs.writeFile(path.join(root, "docs"), "first\n");
  git("add", ".");
  git("commit", "-qm", "fixture");
  return { root, git };
}

test("clean revision is captured and required commit is bound to this checkout", async (t) => {
  const { root, git } = await repository(t);
  const start = await captureSourceRevision(root);
  const commit = git("rev-parse", "HEAD");
  assert.deepEqual(start.revision, {
    available: true,
    commit,
    trackedClean: true,
  });
  await fs.writeFile(path.join(root, "untracked"), "ignored by tracked status");
  verifySourceSnapshot(start, await captureSourceRevision(root));
  await validateSourceRevision(start.revision, {
    root,
    requiredCommit: commit,
  });
  await assert.rejects(
    validateSourceRevision(
      { ...start.revision, commit: "0".repeat(commit.length) },
      { root, requiredCommit: commit },
    ),
    /mismatch/,
  );
  await assert.rejects(
    validateSourceRevision(
      { ...start.revision, trackedClean: false },
      { root, requiredCommit: commit },
    ),
    /mismatch/,
  );
  await fs.writeFile(path.join(root, "source"), "changed\n");
  await assert.rejects(
    validateSourceRevision(start.revision, { root, requiredCommit: commit }),
    /mismatch/,
  );
});

test("a docs-only commit changes the revision even with the same source", async (t) => {
  const { root, git } = await repository(t);
  const start = await captureSourceRevision(root);
  await fs.writeFile(path.join(root, "docs"), "second\n");
  git("add", "docs");
  git("commit", "-qm", "docs");
  assert.equal(
    await fs.readFile(path.join(root, "source"), "utf8"),
    "source\n",
  );
  const finish = await captureSourceRevision(root);
  assert.notEqual(start.revision.commit, finish.revision.commit);
  assert.throws(() => verifySourceSnapshot(start, finish), /changed/);
  // Fingerprint-based checks may inspect an older receipt without requiring HEAD.
  await validateSourceRevision(start.revision, { root });
  await assert.rejects(
    validateSourceRevision(start.revision, {
      root,
      requiredCommit: finish.revision.commit,
    }),
    /mismatch/,
  );
  await assert.rejects(
    validateSourceRevision(start.revision, {
      root,
      requiredCommit: start.revision.commit,
    }),
    /mismatch/,
  );
});

test("dirty tracked content and staged changes cannot change during collection", async (t) => {
  const { root, git } = await repository(t);
  const clean = await captureSourceRevision(root);
  await fs.writeFile(path.join(root, "source"), "dirty one\n");
  const dirty = await captureSourceRevision(root);
  assert.equal(dirty.revision.trackedClean, false);
  assert.throws(() => verifySourceSnapshot(clean, dirty), /changed/);
  await assert.rejects(
    validateSourceRevision(dirty.revision, {
      root,
      requiredCommit: clean.revision.commit,
    }),
    /mismatch/,
  );
  await fs.writeFile(path.join(root, "source"), "dirty two\n");
  const dirtyAgain = await captureSourceRevision(root);
  assert.throws(() => verifySourceSnapshot(dirty, dirtyAgain), /changed/);
  git("add", "source");
  const staged = await captureSourceRevision(root);
  await fs.writeFile(path.join(root, "source"), "source\n");
  git("add", "source");
  const restored = await captureSourceRevision(root);
  assert.throws(() => verifySourceSnapshot(staged, restored), /changed/);
});

test("archive, missing Git and old receipts never invent a commit", async (t) => {
  const { root } = await repository(t);
  const archive = path.join(root, "archive");
  await fs.mkdir(archive);
  assert.deepEqual((await captureSourceRevision(archive)).revision, {
    available: false,
  });
  assert.deepEqual(
    (
      await captureSourceRevision(root, {
        gitBin: path.join(root, "missing-git"),
      })
    ).revision,
    { available: false },
  );
  await assert.rejects(
    validateSourceRevision(
      { available: false },
      { root, requiredCommit: "0".repeat(40) },
    ),
    /mismatch/,
  );
  await validateSourceRevision(undefined, { root: archive });
  await validateSourceRevision({ available: false }, { root: archive });
  await assert.rejects(
    validateSourceRevision(undefined, {
      root: archive,
      requiredCommit: "0".repeat(40),
    }),
    /mismatch/,
  );
  await assert.rejects(
    validateSourceRevision(
      { available: false, commit: "0".repeat(40) },
      { root },
    ),
    /Invalid sourceRevision/,
  );
  await assert.rejects(
    validateSourceRevision(null, { root }),
    /Invalid sourceRevision/,
  );
});

test("CLI integrity-only preserves legacy receipts and enforces an explicitly required revision", async (t) => {
  const { root, git } = await repository(t);
  const tool = path.join(root, "tool", "sdk_audit");
  const output = path.join(root, "output");
  await fs.mkdir(tool, { recursive: true });
  await fs.mkdir(output);
  for (const file of ["cli.mjs", "source_revision.mjs"])
    await fs.copyFile(
      new URL(`../${file}`, import.meta.url),
      path.join(tool, file),
    );
  const stubs = {
    "common.mjs": `import fs from 'node:fs/promises'; import path from 'node:path'; import crypto from 'node:crypto'; import {fileURLToPath} from 'node:url';
      export const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../..');
      export const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),json=x=>JSON.stringify(x,null,2)+'\\n';
      export const readJSON=async p=>JSON.parse(await fs.readFile(p,'utf8')), writeJSON=async(p,x)=>fs.writeFile(p,json(x)),fingerprint=async()=>({sha256:'fixture'}),issue=()=>({});`,
    "platforms.mjs":
      "export async function readPlatformEvidence(){}; export async function validatePlatformEvidence(){}",
    "archive.mjs":
      "export async function packSources(){}; export async function restoreArchive(){}",
    "sources.mjs":
      "export async function snapshot(){}; export async function readSources(){return {manifest:{id:'fixture',createdAt:'2020-01-01T00:00:00Z'},sources:[]}}",
    "docs.mjs": "export function extractDocs(){return {}}",
    "ast.mjs": "export function extractAST(){return {}}",
    "runtime.mjs": "export async function captureRuntime(){}",
    "prior_surface.mjs":
      "export async function readPinnedPrior(){return {baselineId:'prior',sha256:'fixture'}}",
    "audit_artifacts.mjs": `export const mandatoryArtifacts=['docs.json','ast.json','runtime.json','dart.json','dart-observations.json']; export function deriveAudit(){return {artifacts:Object.fromEntries(mandatoryArtifacts.map(x=>[x,{}])),gate:{ok:true}}}`,
  };
  for (const [name, body] of Object.entries(stubs))
    await fs.writeFile(path.join(tool, name), body);
  const { createHash } = await import("node:crypto");
  const contents = "{}\n";
  const digest = createHash("sha256").update(contents).digest("hex");
  const names = [
    "docs.json",
    "ast.json",
    "runtime.json",
    "dart.json",
    "dart-observations.json",
  ];
  for (const name of names)
    await fs.writeFile(path.join(output, name), contents);
  for (const name of ["mappings.json", "scenarios.json"])
    await fs.writeFile(path.join(tool, name), contents);
  const baseline = path.join(root, "baseline.json");
  await fs.writeFile(baseline, JSON.stringify({ id: "fixture" }));
  const receipt = {
    schemaVersion: 2,
    baselineId: "fixture",
    createdAt: "2021-01-01T00:00:00Z",
    prior: { baselineId: "prior", sha256: "fixture" },
    libFingerprint: { sha256: "fixture" },
    bridgeFingerprint: { sha256: "fixture" },
    toolFingerprint: { sha256: "fixture" },
    projectInputs: {},
    artifacts: Object.fromEntries(names.map((name) => [name, digest])),
  };
  const save = () =>
    fs.writeFile(path.join(output, "run.json"), JSON.stringify(receipt));
  const run = (...extra) => {
    try {
      return {
        status: 0,
        output: execFileSync(
          process.execPath,
          [
            path.join(tool, "cli.mjs"),
            "check",
            "--integrity-only",
            "--snapshot",
            baseline,
            "--against",
            "prior",
            "--out",
            output,
            ...extra,
          ],
          { encoding: "utf8", stdio: "pipe" },
        ),
      };
    } catch (error) {
      return { status: error.status, output: error.stderr };
    }
  };
  await save();
  assert.equal(run().status, 0);
  const commit = git("rev-parse", "HEAD");
  assert.match(run("--source-commit", commit).output, /mismatch/);
  receipt.sourceRevision = { available: true, commit, trackedClean: true };
  await save();
  assert.match(run("--source-commit", commit).output, /VERIFIED/);
  receipt.sourceRevision.commit = "0".repeat(commit.length);
  await save();
  assert.match(run("--source-commit", commit).output, /mismatch/);
  receipt.sourceRevision = { available: false };
  receipt.toolFingerprint = { sha256: "stale" };
  await save();
  assert.match(run().output, /Stale toolFingerprint/);
});
