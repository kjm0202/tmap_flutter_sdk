import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../..");
export const sha = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export async function readJSON(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}
export async function writeJSON(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, json(value));
}
export async function filesUnder(dir) {
  const out = [];
  for (const e of (await fs.readdir(dir, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (["node_modules", ".dart_tool", ".cache"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await filesUnder(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
export async function fingerprint(dir) {
  const result = {};
  for (const file of await filesUnder(dir))
    result[path.relative(ROOT, file)] = sha(await fs.readFile(file));
  return { sha256: sha(JSON.stringify(result)), files: result };
}
export function counts(rows, key) {
  const out = {};
  for (const row of rows) out[row[key]] = (out[row[key]] || 0) + 1;
  return out;
}
export function issue(code, details = {}) {
  return { code, ...details };
}
