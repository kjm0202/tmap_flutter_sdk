import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

// Ignore inherited Git routing variables: this must describe this worktree.
function git(root, args, { digest = false, gitBin = "git" } = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  env.GIT_OPTIONAL_LOCKS = "0";
  return new Promise((resolve, reject) => {
    const child = spawn(
      gitBin,
      ["-C", root, "-c", "core.fsmonitor=false", ...args],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const hash = createHash("sha256");
    let output = "",
      error = "";
    child.stdout.on("data", (chunk) => {
      if (digest) hash.update(chunk);
      else output += chunk;
    });
    child.stderr.on("data", (chunk) => (error += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0)
        reject(new Error(`Git ${args[0]} failed: ${error.trim()}`));
      else resolve(digest ? hash.digest("hex") : output);
    });
  });
}

// The private snapshot also detects edits to an already-dirty tracked file.
export async function captureSourceRevision(root, { gitBin = "git" } = {}) {
  try {
    await fs.lstat(path.join(root, ".git"));
  } catch (error) {
    if (error.code === "ENOENT") return { revision: { available: false } };
    throw error;
  }
  const run = (args, options = {}) => git(root, args, { ...options, gitBin });
  let top;
  try {
    top = (await run(["rev-parse", "--show-toplevel"])).trim();
  } catch (error) {
    if (error.code === "ENOENT") return { revision: { available: false } };
    throw error;
  }
  if ((await fs.realpath(top)) !== (await fs.realpath(root)))
    return { revision: { available: false } };
  const head = (await run(["rev-parse", "--verify", "HEAD^{commit}"])).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head))
    throw new Error("Invalid Git HEAD");
  const status = await run([
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=no",
    "--ignore-submodules=none",
  ]);
  const diffArgs = [
    "--no-ext-diff",
    "--no-textconv",
    "--binary",
    "--ignore-submodules=none",
  ];
  const staged = await run(["diff", "--cached", ...diffArgs, "HEAD", "--"], {
    digest: true,
  });
  const unstaged = await run(["diff", ...diffArgs, "--"], { digest: true });
  if ((await run(["rev-parse", "--verify", "HEAD^{commit}"])).trim() !== head)
    throw new Error("Source revision changed during capture");
  return {
    revision: {
      available: true,
      commit: head,
      trackedClean: status.length === 0,
    },
    status,
    staged,
    unstaged,
  };
}

export function verifySourceSnapshot(start, finish) {
  if (!isDeepStrictEqual(start, finish))
    throw new Error("Source revision or tracked files changed during audit");
}

export async function validateSourceRevision(
  revision,
  { requiredCommit, root, gitBin } = {},
) {
  // Receipts predating this field remain valid without an explicit source requirement.
  if (revision !== undefined) {
    const validUnavailable = isDeepStrictEqual(revision, { available: false });
    const validAvailable =
      revision &&
      revision.available === true &&
      isDeepStrictEqual(Object.keys(revision).sort(), [
        "available",
        "commit",
        "trackedClean",
      ]) &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision.commit) &&
      typeof revision.trackedClean === "boolean";
    if (!validUnavailable && !validAvailable)
      throw new Error("Invalid sourceRevision");
  }
  if (requiredCommit === undefined) return;
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(requiredCommit))
    throw new Error("Invalid required source commit");
  const current = (await captureSourceRevision(root, { gitBin })).revision;
  if (
    !revision?.available ||
    revision.commit !== requiredCommit ||
    revision.trackedClean !== true ||
    !current.available ||
    current.commit !== requiredCommit ||
    current.trackedClean !== true
  )
    throw new Error("Source commit or tracked worktree state mismatch");
}
