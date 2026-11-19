import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright";
import { load } from "cheerio";
import { HERE, sha, readJSON, json, issue } from "./common.mjs";

export const MAIN = "https://tmapapi.tmapmobility.com/main.html";
export const CORE =
  "https://toptmaptile1.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206";
export const CSS = "https://toptmaptile1.tmap.co.kr/scriptSDKV3/vsm.css";
export const CACHE = path.join(HERE, ".cache/sources");

export function docLinks(html, base = MAIN) {
  const $ = load(html),
    out = [];
  for (const el of $("a[href]").toArray()) {
    const href = $(el).attr("href");
    const hash = href.match(
      /^#(webv3VSM\/(guide|sample|docs|usecase)\/[^#?]+)$/i,
    );
    const related = href.match(/^#(webservice\/docs\/[^#?.]+)(?:\.(.+))?$/);
    if (related) {
      out.push({
        url: new URL("/" + related[1] + ".html", MAIN).href,
        anchor: related[2] || null,
        label: $(el).text().trim(),
        kind: "reference",
      });
      continue;
    }
    if (href.startsWith("#") && !hash) continue;
    if (hash) {
      const [stem, ...anchor] = hash[1].split(".");
      out.push({
        url: new URL("/" + stem + ".html", MAIN).href,
        anchor: anchor.join(".") || null,
        label: $(el).text().trim(),
      });
    } else {
      const u = new URL(href, base);
      if (
        u.origin === new URL(MAIN).origin &&
        /^\/webv3VSM\/(guide|sample|docs|usecase)\/[^/]+\.html$/.test(
          u.pathname,
        )
      )
        out.push({
          url: u.origin + u.pathname,
          anchor: u.hash.slice(1) || null,
          label: $(el).text().trim(),
        });
    }
  }
  return out;
}

async function fetchBytes(url) {
  // Do not print request objects: authenticated runtime requests use a different path.
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
    finalURL: response.url,
  };
}

export async function discoverSDKScripts({
  coreUrl = CORE,
  coreBytes = null,
  cssUrl = CSS,
  cssBytes = null,
  timeout = 25000,
} = {}) {
  const discovered = [];
  const issues = [];
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html><head><link rel="stylesheet" href="${cssUrl}"><script>window.Tmapvector={_getScriptLocation:()=>'https://toptmaptile1.tmap.co.kr/scriptSDKV3/',VERSION_NUMBER:1};</script><script src="${coreUrl}"></script></head><body><div id="map" style="width:800px;height:600px"></div></body></html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      ...(process.env.TMAP_AUDIT_CHROME
        ? { executablePath: process.env.TMAP_AUDIT_CHROME }
        : { channel: "chrome" }),
      headless: true,
      args: ["--enable-unsafe-swiftshader"],
    });
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
    });
    const pending = [];
    page.on("response", (response) => {
      const u = response.url();
      if (
        response.request().resourceType() === "script" &&
        !u.endsWith("/auth.js") &&
        !u.includes("tmapjs3.min.js")
      ) {
        pending.push(
          (async () => {
            try {
              const bytes = await response.body();
              const digest = sha(bytes);
              await fs.mkdir(CACHE, { recursive: true });
              await fs.writeFile(path.join(CACHE, digest), bytes);
              discovered.push({
                url: u,
                kind: "sdk-script",
                sha256: digest,
                bytes: bytes.length,
                contentType:
                  response.headers()["content-type"] ||
                  "application/javascript",
                finalURL: u,
                retrievedAt: new Date().toISOString(),
                classification: "network-script",
              });
            } catch (e) {
              issues.push(
                issue("discovery-script-fetch-failed", {
                  url: u,
                  error: e.message,
                }),
              );
            }
          })(),
        );
      }
    });

    if (coreBytes) {
      await page.route("**/scriptSDKV3/tmapjs3.min.js*", (route) =>
        route.fulfill({
          body: coreBytes,
          contentType: "application/javascript",
        }),
      );
    }
    if (cssBytes) {
      await page.route("**/scriptSDKV3/vsm.css*", (route) =>
        route.fulfill({ body: cssBytes, contentType: "text/css" }),
      );
    }

    await page.addInitScript(() => {
      window.__auditWorkerBlobs = [];
      const original = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        const url = original.call(this, blob);
        if (/javascript|ecmascript/.test(blob?.type || "")) {
          window.__auditWorkerBlobs.push(
            blob.text().then((text) => ({ url, text })),
          );
        }
        return url;
      };
    });

    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(
      () => typeof window.Tmapv3?.Map === "function",
      {},
      { timeout },
    );
    await Promise.allSettled(pending);

    const workerBlobs = await page.evaluate(() =>
      Promise.all(window.__auditWorkerBlobs || []),
    );
    for (let i = 0; i < workerBlobs.length; i++) {
      const b = workerBlobs[i];
      const bytes = Buffer.from(b.text, "utf8");
      const digest = sha(bytes);
      await fs.mkdir(CACHE, { recursive: true });
      await fs.writeFile(path.join(CACHE, digest), bytes);
      discovered.push({
        url: `worker:vsm-map${workerBlobs.length > 1 ? `-${i + 1}` : ""}`,
        kind: "sdk-worker",
        sha256: digest,
        bytes: bytes.length,
        contentType: "application/javascript",
        finalURL: `worker:vsm-map${workerBlobs.length > 1 ? `-${i + 1}` : ""}`,
        retrievedAt: new Date().toISOString(),
        classification: "worker-script",
      });
    }
  } catch (e) {
    issues.push(
      issue("runtime-script-discovery-failed", { error: e.message }),
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  return { discovered, issues };
}

export const captureRealScripts = discoverSDKScripts;

export async function snapshot(
  file,
  { previousBaseline = null, discover = true } = {},
) {
  try {
    await fs.access(file);
    throw new Error("Snapshot already exists; choose a new --snapshot path.");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await fs.mkdir(CACHE, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    scope:
      "TMAP Vector JS v3 production distribution; all discovered Tmapv3 exports and Vsm runtime exports are candidates, not automatically public API.",
    auth: {
      status: "unavailable",
      reason: "isolated-unauthenticated-capture",
    },
    sources: [],
    links: [],
    issues: [],
  };
  const queue = [
      { url: MAIN, kind: "index", classification: "index" },
      { url: CORE, kind: "sdk", classification: "core-sdk" },
      { url: CSS, kind: "css", classification: "css" },
    ],
    seen = new Set();
  let coreBytes = null,
    cssBytes = null;
  while (queue.length) {
    const job = queue.shift();
    if (seen.has(job.url)) continue;
    seen.add(job.url);
    try {
      const r = await fetchBytes(job.url),
        digest = sha(r.bytes);
      await fs.writeFile(path.join(CACHE, digest), r.bytes);
      if (job.url === CORE) coreBytes = r.bytes;
      if (job.url === CSS) cssBytes = r.bytes;
      manifest.sources.push({
        url: job.url,
        kind: job.kind,
        sha256: digest,
        bytes: r.bytes.length,
        contentType: r.contentType,
        finalURL: r.finalURL,
        retrievedAt: new Date().toISOString(),
        classification:
          job.classification ||
          (["index", "document", "reference"].includes(job.kind)
            ? "document"
            : job.kind),
      });
      if (["index", "document", "reference"].includes(job.kind)) {
        const links = docLinks(r.bytes.toString("utf8"), job.url);
        manifest.links.push(
          ...links.map((l) => ({ ...l, discoveredAt: job.url })),
        );
        queue.push(
          ...links.map((l) => ({
            url: l.url,
            kind: l.kind || "document",
            classification: "document",
          })),
        );
      }
    } catch (e) {
      manifest.issues.push(
        issue("source-fetch-failed", { url: job.url, error: e.message }),
      );
    }
  }

  // Network discovery of additional loaded SDK scripts and worker script bodies
  if (discover) {
    try {
      const { discovered, issues } = await discoverSDKScripts({
        coreUrl: CORE,
        coreBytes,
        cssUrl: CSS,
        cssBytes,
      });
      for (const item of discovered) {
        if (!manifest.sources.some((s) => s.sha256 === item.sha256)) {
          manifest.sources.push(item);
        }
      }
      manifest.issues.push(...issues);
    } catch (e) {
      manifest.issues.push(issue("discovery-failed", { error: e.message }));
    }
  }

  // Check version-equal-but-byte-different against previous baseline if provided
  if (previousBaseline) {
    try {
      const prev =
        typeof previousBaseline === "string"
          ? await readJSON(previousBaseline)
          : previousBaseline;
      const prevSources = prev.sources || [];
      for (const s of manifest.sources) {
        const matchingPrev = prevSources.find(
          (p) => p.url === s.url || (p.kind === s.kind && p.kind === "sdk"),
        );
        if (matchingPrev && matchingPrev.sha256 !== s.sha256) {
          manifest.versionDrift = manifest.versionDrift || [];
          manifest.versionDrift.push({
            url: s.url,
            kind: s.kind,
            previousSha256: matchingPrev.sha256,
            newSha256: s.sha256,
            classification: "version-equal-byte-different",
          });
          manifest.issues.push(
            issue("version-equal-byte-different-baseline", {
              url: s.url,
              previousSha256: matchingPrev.sha256,
              newSha256: s.sha256,
            }),
          );
        }
      }
    } catch (e) {
      manifest.issues.push(
        issue("previous-baseline-compare-failed", { error: e.message }),
      );
    }
  }

  // Confirm the production (unversioned) endpoint matches the URL used by this port.
  try {
    const latest = await fetchBytes(CORE.split("?")[0]);
    manifest.productionEndpoint = {
      url: CORE.split("?")[0],
      sha256: sha(latest.bytes),
    };
    if (
      sha(latest.bytes) !==
      manifest.sources.find((s) => s.kind === "sdk")?.sha256
    )
      manifest.issues.push(issue("production-sdk-differs-from-port-url"));
  } catch (e) {
    manifest.issues.push(
      issue("production-sdk-check-failed", { error: e.message }),
    );
  }
  if (!manifest.links.length) manifest.issues.push(issue("no-document-links"));
  manifest.sources.sort((a, b) => a.url.localeCompare(b.url));
  manifest.id = sha(JSON.stringify(manifest));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, json(manifest), { flag: "wx" });
  return manifest;
}

export async function readSources(file, { restore = false, keyFile = null } = {}) {
  const manifest = await readJSON(file);
  const { id, ...body } = manifest;
  if (sha(JSON.stringify(body)) !== id)
    throw new Error("Snapshot manifest fingerprint mismatch");
  const sources = [];
  for (const s of manifest.sources) {
    const target = path.join(CACHE, s.sha256);
    let bytes;
    try {
      bytes = await fs.readFile(target);
    } catch (e) {
      if (!restore || e.code !== "ENOENT")
        throw new Error(
          `Missing source ${s.sha256}; run restore (or supply original cached bytes).`,
        );
      if (s.url && /^https?:\/\//.test(s.url)) {
        const u = new URL(s.url);
        if (keyFile && s.role === 'official-key-authenticated-bootstrap' && u.origin === 'https://apis.openapi.sk.com' && u.pathname === '/tmap/vectorjs') {
            const key = JSON.parse(await fs.readFile(keyFile, "utf8")).TMAP_APP_KEY;
            const response = await fetch(s.url, {
                headers: { appKey: key },
                signal: AbortSignal.timeout(30000),
                redirect: 'manual'
            });
            
            if (response.status >= 300 && response.status < 400) throw new Error("Redirects forbidden");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            bytes = Buffer.from(await response.arrayBuffer());
        } else {
            bytes = (await fetchBytes(s.url)).bytes;
        }
        if (sha(bytes) !== s.sha256)
          throw new Error(
            `Upstream changed: ${s.url}. Refusing to replace pinned bytes.`,
          );
      } else if (
        s.kind === "sdk-worker" ||
        s.kind === "sdk-script" ||
        s.kind === "documentation-example-generated-map-worker"
      ) {
        const parentRole =
          s.kind === "documentation-example-generated-map-worker"
            ? "documentation-host-example-core"
            : "sdk";
        const parent = manifest.sources.find(
          (src) => src.role === parentRole || (parentRole === "sdk" && src.kind === "sdk"),
        );
        let recovered = false;
        if (parent) {
          try {
            const parentBytes = await fs.readFile(path.join(CACHE, parent.sha256));
            const { discovered } = await discoverSDKScripts({
              coreBytes: parentBytes,
            });
            const found = discovered.find((d) => d.sha256 === s.sha256);
            if (found) {
              bytes = await fs.readFile(path.join(CACHE, found.sha256));
              recovered = true;
            }
          } catch {}
        }
        if (!recovered) {
          throw new Error(
            `Missing non-HTTP source ${s.url || s.sha256}; run restore with archive or supply original cached bytes.`,
          );
        }
      } else {
        throw new Error(
          `Missing source ${s.sha256}; run restore (or supply original cached bytes).`,
        );
      }
      await fs.mkdir(CACHE, { recursive: true });
      await fs.writeFile(target, bytes);
    }
    if (sha(bytes) !== s.sha256 || bytes.length !== s.bytes)
      throw new Error(`Source fingerprint mismatch: ${s.url}`);
    sources.push({ ...s, text: bytes.toString("utf8") });
  }
  return { manifest, sources };
}

export async function verifyBaselineSources(
  fileOrManifest,
  { failClosed = true } = {},
) {
  const manifest =
    typeof fileOrManifest === "string"
      ? await readJSON(fileOrManifest)
      : fileOrManifest;
  const { id, ...body } = manifest;
  if (sha(JSON.stringify(body)) !== id) {
    const msg = "Baseline manifest fingerprint mismatch";
    if (failClosed) throw new Error(msg);
    return { ok: false, error: msg };
  }
  const errors = [];
  for (const s of manifest.sources) {
    const target = path.join(CACHE, s.sha256);
    try {
      const bytes = await fs.readFile(target);
      if (sha(bytes) !== s.sha256 || bytes.length !== s.bytes) {
        errors.push({
          url: s.url,
          sha256: s.sha256,
          error: "fingerprint-mismatch",
        });
      }
    } catch (e) {
      errors.push({
        url: s.url,
        sha256: s.sha256,
        error: e.code || e.message,
      });
    }
  }
  if (errors.length && failClosed) {
    throw new Error(
      `Baseline source verification failed for ${errors.length} sources: ${errors.map((e) => `${e.url} (${e.error})`).join(", ")}`,
    );
  }
  return { ok: errors.length === 0, count: manifest.sources.length, errors };
}
