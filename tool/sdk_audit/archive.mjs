import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { CACHE, readSources } from "./sources.mjs";
import { sha, readJSON, json } from "./common.mjs";
export async function packSources(snapshotFile, archiveFile) {
  const { manifest } = await readSources(snapshotFile);
  const blobs = {};
  for (const s of manifest.sources)
    blobs[s.sha256] = (await fs.readFile(path.join(CACHE, s.sha256))).toString(
      "base64",
    );
  const bytes = gzipSync(json({ baselineId: manifest.id, blobs }));
  await fs.mkdir(path.dirname(archiveFile), { recursive: true });
  await fs.writeFile(archiveFile, bytes, { flag: "wx", mode: 0o600 });
  return {
    baselineId: manifest.id,
    sha256: sha(bytes),
    bytes: bytes.length,
    sources: manifest.sources.length,
  };
}
export async function restoreArchive(snapshotFile, archiveFile) {
  const manifest = await readJSON(snapshotFile),
    { id, ...body } = manifest;
  if (sha(JSON.stringify(body)) !== id)
    throw new Error("Snapshot manifest fingerprint mismatch");
  const archive = JSON.parse(
    gunzipSync(await fs.readFile(archiveFile), {
      maxOutputLength: 128 * 1024 * 1024,
    }).toString("utf8"),
  );
  if (archive.baselineId !== id)
    throw new Error("Archive belongs to another snapshot");
  const pending = [];
  for (const s of manifest.sources) {
    if (
      !/^[a-f0-9]{64}$/.test(s.sha256) ||
      typeof archive.blobs?.[s.sha256] !== "string"
    )
      throw new Error("Archive source missing");
    const bytes = Buffer.from(archive.blobs[s.sha256], "base64");
    if (sha(bytes) !== s.sha256 || bytes.length !== s.bytes)
      throw new Error("Archive source fingerprint mismatch");
    pending.push([s.sha256, bytes]);
  }
  // Validate the whole archive before writing any bytes.
  await fs.mkdir(CACHE, { recursive: true });
  for (const [digest, bytes] of pending)
    await fs.writeFile(path.join(CACHE, digest), bytes);
  return readSources(snapshotFile);
}
