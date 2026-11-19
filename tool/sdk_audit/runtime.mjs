import {captureEventNamesAlias} from './event_names_aliases.mjs';
import {probeSdkLatLngBoundsState} from './sdk_latlngbounds_state_probe.mjs';
import {probeLatLngBoundsNorthEast} from './latlngbounds_northeast_probe.mjs';
import {probeLatLngBoundsCorners} from './latlngbounds_corner_probe.mjs';
import {probeGeographicEquals} from './geographic_equals_probe.mjs';
import {probePointSizeEquals} from './point_size_equals_probe.mjs';
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { chromium } from "playwright";
import { sha, issue } from "./common.mjs";
import { probeLatLngBoundsCenter } from './latlngbounds_center_probe.mjs';
import { probeNumericGetters } from './getter_probe.mjs';
import { probePointSizeSetters } from './point_size_setter_probe.mjs';
import { probeMapSourceContracts } from './map_source_probe.mjs';
import { probeExtensions } from "./extension_probe.mjs";
import { probeBridges } from "./bridge_probe.mjs";
import { CORE, CSS, CACHE } from "./sources.mjs";

import { probeDrawingPointers } from './drawing_pointer_probe.mjs';

// Runs in the actual browser. Never invokes getters, SDK methods, or constructors.
export function reflectNamespace(
  root,
  rootName,
  { maxDepth = 12, maxRows = 30000 } = {},
) {
  const rows = [],
    issues = [],
    aliases = {},
    seen = new WeakMap();
  function visit(value, id, depth) {
    const type = typeof value;
    if (value === null || !["object", "function"].includes(type)) return;
    if (seen.has(value)) {
      aliases[id] = seen.get(value);
      return;
    }
    seen.set(value, id);
    if (depth > maxDepth) {
      issues.push({ code: "runtime-depth-limit", id });
      return;
    }
    if (rows.length >= maxRows) {
      issues.push({ code: "runtime-row-limit", id });
      return;
    }
    let descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch (e) {
      issues.push({ code: "runtime-reflection-failed", id, error: e.name });
      return;
    }
    for (const key of Reflect.ownKeys(descriptors)) {
      if (
        type === "function" &&
        ["arguments", "caller", "length", "name"].includes(key)
      )
        continue;
      if (key === "constructor" && id.endsWith("#prototype")) continue;
      const d = descriptors[key],
        name = typeof key === "symbol" ? `[${String(key)}]` : key;
      const child =
        key === "prototype" && type === "function"
          ? id + "#prototype"
          : id.endsWith("#prototype")
            ? id.slice(0, -10) + "#" + name
            : id + "." + name;
      if (!Object.hasOwn(d, "value")) {
        rows.push({
          id: child,
          kind: "accessor",
          get: !!d.get,
          set: !!d.set,
          enumerable: d.enumerable,
        });
        continue;
      }
      const v = d.value,
        t = typeof v;
      rows.push({
        id: child,
        kind:
          key === "prototype"
            ? "prototype"
            : t === "function"
              ? "method"
              : t === "object" && v !== null
                ? "object"
                : "property",
        valueType: t,
        enumerable: d.enumerable,
        writable: d.writable,
      });
      if (Array.isArray(v)) continue; // Runtime data arrays aren't API member containers.
      if (v && ["object", "function"].includes(t)) {
        // Don't walk DOM/global/platform implementation graphs from instance fields.
        if (
          typeof Node !== "undefined" &&
          (v instanceof Node || v === globalThis)
        ) {
          issues.push({ code: "runtime-platform-boundary", id: child });
          continue;
        }
        visit(v, child, depth + 1);
      }
    }
    if (id.endsWith("#prototype")) {
      const base = Object.getPrototypeOf(value);
      if (base && base !== Object.prototype && base !== Function.prototype) {
        const ctor = Object.getOwnPropertyDescriptor(
          base,
          "constructor",
        )?.value;
        rows.push({
          id: id.slice(0, -10) + "#extends",
          kind: "inheritance",
          baseName: ctor?.name || null,
        });
      }
    }
  }
  visit(root, rootName, 0);
  return { rows, issues, aliases };
}

export async function captureRuntime(
  sources,
  { keyFile, scenarios = [], bridges, getterInputs=[] } = {},
) {
  const sdkSources = sources.filter(
    (s) =>
      s.kind === "sdk" ||
      s.kind === "sdk-worker" ||
      s.kind === "sdk-script" ||
      s.kind?.startsWith("sdk"),
  );
  const sdk = sdkSources.find((s) => s.kind === "sdk") || sources.find((s) => s.kind === "sdk"),
    css = sources.find((s) => s.kind === "css");
  const rawSDK = sdk ? await fs.readFile(path.join(CACHE, sdk.sha256)) : null;
  const result = {
    rows: [],
    issues: [],
    aliases: {},
    phases: [],
    instances: [],
    observations: [],
    pointSizeSetterObservations: [],
    latLngBoundsCenterObservations: [],
    latLngBoundsCornerObservations: [],
    latLngBoundsNorthEastObservations: [],
    sdkLatLngBoundsStateObservations: [],
    geographicEqualsObservations: [],
    pointSizeEqualsObservations: [],
    pointSizeEqualsExtras: [],
    bridgeObservations: [],
    networkScripts: [],
    auth: keyFile ? "not-requested" : "unavailable",
    engine: null,
  };
  if (!sdk) {
    result.issues.push(issue("runtime-sdk-missing"));
    return result;
  }
  let key = null,
    authSource = null;
  if (keyFile) {
    try {
      key = JSON.parse(await fs.readFile(keyFile, "utf8")).TMAP_APP_KEY;
      if (!key) throw new Error("Empty credential");
      const response = await fetch(
        "https://apis.openapi.sk.com/tmap/vectorjs?version=1",
        { headers: { appKey: key }, signal: AbortSignal.timeout(30000), redirect: 'manual' },
      );
      if (response.status >= 300 && response.status < 400) throw new Error("Redirects forbidden");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      const authEntries = sources.filter(s => s.role === 'official-key-authenticated-bootstrap');
      if (authEntries.length !== 1) {
        result.auth = "failed";
        result.issues.push(issue("runtime-auth-mismatch"));
        authSource = null;
      } else {
        const authEntry = authEntries[0];
        const bootstrapDigest = sha(buffer);
        if (bootstrapDigest !== authEntry.sha256 || buffer.length !== authEntry.bytes) {
          result.auth = "failed";
          result.issues.push(issue("runtime-auth-mismatch"));
          authSource = null;
        } else {
          authSource = buffer.toString('utf8');
          result.verifiedBootstrapDigest = bootstrapDigest;
          result.auth = "response-received";
        }
      }
    } catch (e) {
      result.auth = "failed";
      result.issues.push(
        issue("runtime-auth-failed", {
          error: key
            ? String(e.message).split(key).join("[REDACTED]")
            : e.message,
        }),
      );
    }
  }
  const redact = (s) =>
    String(s)
      .replace(
        /([?&](?:appkey|key|token|access_token)=)[^&\s"']*/gi,
        "$1[REDACTED]",
      )
      .split(key || "\0")
      .join("[REDACTED]");
  const server = http.createServer((req, res) => {
    if (req.url === "/auth.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(authSource || "");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const scripts = authSource
      ? '<script src="/auth.js"></script>'
      : `<script>window.Tmapvector={_getScriptLocation:()=> 'https://toptmaptile1.tmap.co.kr/scriptSDKV3/',VERSION_NUMBER:1};</script><script src="${CORE}"></script>`;
    res.end(
      `<!doctype html><html><head><link rel="stylesheet" href="${CSS}">${scripts}</head><body><div id="map" style="width:800px;height:600px"></div></body></html>`,
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
    result.browserVersion = browser.version();
    const page = await browser.newPage({
      viewport: { width: 1000, height: 800 },
    });
    page.on("pageerror", (e) =>
      result.issues.push(
        issue("runtime-page-error", { error: redact(e.message), stack: redact(e.stack) }),
      ),
    );
    const pending = [];
    page.on("response", (response) => {
      if (
        response.request().resourceType() === "script" &&
        !response.url().endsWith("/auth.js")
      )
        pending.push(
          (async () => {
            try {
              const bytes = await response.body();
              const digest = sha(bytes);
              await fs.mkdir(CACHE, { recursive: true });
              await fs.writeFile(path.join(CACHE, digest), bytes);
              const matching = sdkSources.find((s) => s.sha256 === digest);
              const isPinned = !!matching;
              const classification = isPinned
                ? (matching.kind === "sdk" ? "pinned-core" : "pinned-script")
                : "unpinned-network-script";
              result.networkScripts.push({
                url: redact(response.url()),
                retrievedAt: new Date().toISOString(),
                time: new Date().toISOString(),
                sha256: digest,
                bytes: bytes.length,
                status: response.status(),
                pinned: isPinned,
                classification,
              });
            } catch {
              result.issues.push(
                issue("runtime-script-body-unavailable", {
                  url: redact(response.url()),
                }),
              );
            }
          })(),
        );
    });
    await page.route("**/scriptSDKV3/tmapjs3.min.js*", (route) =>
      route.fulfill({ body: rawSDK, contentType: "application/javascript" }),
    );
    if (css)
      await page.route("**/scriptSDKV3/vsm.css*", (route) =>
        route.fulfill({ body: css.text, contentType: "text/css" }),
      );
    await page.addInitScript(() => {
      window.__auditWorkerBlobs = [];
      const original = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        const url = original.call(this, blob);
        if (/javascript|ecmascript/.test(blob?.type || ""))
          window.__auditWorkerBlobs.push(
            blob.text().then((text) => ({ url, text })),
          );
        return url;
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    if (authSource) result.auth = "script-executed";
    await page.waitForFunction(
      () => typeof window.Tmapv3?.Map === "function",
      {},
      { timeout: 15000 },
    );
    await page.evaluate(
      `window.__auditReflect = (${reflectNamespace.toString()})`,
    );
    const capture = async (phase) => {
      const value = await page.evaluate(() =>
        window.__auditReflect(window.Tmapv3, "Tmapv3"),
      );
      result.phases.push({ phase, rows: value.rows.length });
      result.rows.push(
        ...value.rows.map((r) => ({
          ...r,
          phase,
          evidence: [
            { channel: "runtime", source: sdk.url, sha256: sdk.sha256, phase },
          ],
        })),
      );
      result.issues.push(
        ...value.issues
          .filter((i) => i.code !== "runtime-platform-boundary")
          .map((i) => ({ ...i, phase })),
      );
      Object.assign(result.aliases, value.aliases);
    };
    await capture("loaded");
    result.eventNamesAliasEvidence = await page.evaluate(captureEventNamesAlias);
    result.engine = await page.evaluate(() =>
      window.__auditReflect(window.Vsm, "Vsm", { maxDepth: 8, maxRows: 30000 }),
    );
    if (result.engine.issues.length)
      result.issues.push(
        issue("engine-enumeration-incomplete", {
          count: result.engine.issues.length,
        }),
      );
    const pure = await page.evaluate(() => {
      const classes = {
        Point: [1, 2],
        Size: [3, 4],
        LatLng: [37.5, 127],
        Bounds: [1, 10, 5, 4],
        LatLngBounds: [new Tmapv3.LatLng(37, 126), new Tmapv3.LatLng(38, 127)],
      };
      window.__auditInstances = {};
      const out = [];
      for (const [name, args] of Object.entries(classes))
        try {
          const obj = new Tmapv3[name](...args);
          window.__auditInstances[name] = obj;
          out.push({
            name: "Tmapv3." + name,
            status: "constructed",
            reflection: window.__auditReflect(
              obj,
              "Tmapv3." + name + "@instance",
            ),
          });
        } catch (e) {
          out.push({
            name: "Tmapv3." + name,
            status: "failed",
            error: e.message,
          });
        }
      // Constructors inspected in the pinned AST: these create local state only.
      // No network send, map attachment, getters, or arbitrary methods are invoked.
      for (const name of ['base.Object','base.Html','base.Config','event.Event',
        'util.Projection','util.Util','layer.Layer','mapobject.MapObject',
        'mapobject.LabelOptions','mapobject.InfoWindowOptions','shape.Shape',
        'network.HttpRequest','extension.Feature','extension.Format','extension.XML',
        'extension.KML','extension.Vector','extension.GeoJSON','asset.Icon','MapOptions']) {
        try {
          const C = name.split('.').reduce((v,k)=>v[k],Tmapv3);
          const obj = new C();
          out.push({name:'Tmapv3.'+name,status:'constructed',
            ownMembers:Object.entries(Object.getOwnPropertyDescriptors(obj)).map(([name,d])=>({name,type:typeof d.value,get:!!d.get,set:!!d.set}))});
        } catch(e) { out.push({name:'Tmapv3.'+name,status:'failed',error:e.message}); }
      }
      return out;
    });
    result.instances.push(...pure);
    for (const p of pure) {
      result.rows.push(
        ...(p.reflection?.rows || []).map((r) => ({
          ...r,
          id: r.id.replace("@instance.", "@"),
          phase: "instance:" + p.name,
          evidence: [
            {
              channel: "runtime-instance",
              source: sdk.url,
              sha256: sdk.sha256,
              phase: "instance:" + p.name,
            },
          ],
        })),
      );
      result.issues.push(
        ...(p.reflection?.issues || []).filter(
          (i) => i.code !== "runtime-platform-boundary",
        ),
      );
    }
    const observations = await page.evaluate((cases) => {
      const encode = (v) =>
        v === undefined
          ? { special: "undefined" }
          : typeof v === "number" && !Number.isFinite(v)
            ? { special: String(v) }
            : Object.is(v, -0)
              ? { special: "-0" }
              : v;
      return cases.map((c) => {
        try {
          const C = Tmapv3[c.class],
            obj = new C(...c.args),
            before = c.read.map((k) => obj[k]());
          const args = c.methodArgs || [];
          const value = obj[c.method](...args);
          const after = c.read.map((k) => obj[k]());
          return {
            id: c.id,
            status: "observed",
            value:
              value && typeof value === "object"
                ? c.read.map((k) => encode(value[k]()))
                : encode(value),
            before: before.map(encode),
            after: after.map(encode),
            sameIdentity: value === obj,
            returnedObject: !!value && typeof value === "object",
          };
        } catch (e) {
          return {
            id: c.id,
            status: "threw",
            errorType: e.name,
            error: e.message,
          };
        }
      });
    }, scenarios);
    result.getterObservations=await page.evaluate(probeNumericGetters,getterInputs);
    result.latLngBoundsCornerObservations=await page.evaluate(probeLatLngBoundsCorners,getterInputs);
    result.latLngBoundsNorthEastObservations=await page.evaluate(probeLatLngBoundsNorthEast,getterInputs);
    result.sdkLatLngBoundsStateObservations=await page.evaluate(probeSdkLatLngBoundsState);
    result.geographicEqualsObservations=await page.evaluate(probeGeographicEquals,getterInputs);
    const pointSizeEquals=await page.evaluate(probePointSizeEquals,getterInputs);
    result.pointSizeEqualsObservations=pointSizeEquals.numeric;
    result.pointSizeEqualsExtras=pointSizeEquals.extras;
    result.latLngBoundsCenterObservations=await page.evaluate(probeLatLngBoundsCenter,getterInputs);
    result.pointSizeSetterObservations = await page.evaluate(
      probePointSizeSetters,
      getterInputs,
    );
    result.upstreamValueDefects = await page.evaluate(() => {
      const bounds = new Tmapv3.Bounds(0, 10, 10, 10);
      return [[5, 5], [20, 5]].map(([x, y]) => {
        try {
          return { contract: 'Tmapv3.base.Bounds#contains', input: [x, y],
            bounds: [0, 10, 10, 10], result: bounds.contains(new Tmapv3.Point(x, y)),
            hasUnexpectedNeField: Object.hasOwn(bounds, '_ne') };
        } catch (error) {
          return { contract: 'Tmapv3.base.Bounds#contains', input: [x, y],
            bounds: [0, 10, 10, 10], errorName: error.name, error: String(error),
            hasUnexpectedNeField: Object.hasOwn(bounds, '_ne') };
        }
      });
    });
    result.observations = observations;
    if (authSource) {
      const outcome = await page.evaluate(async () => {
        try {
          if (!document.getElementById("map")) {
            const host = document.createElement("div");
            host.id = "map";
            host.style.cssText = "width:800px;height:600px";
            document.body.appendChild(host);
          }
          const ready = new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("ConfigLoad timeout")),
              25000,
            );
            const map = new Tmapv3.Map("map", {
              center: new Tmapv3.LatLng(37.5665, 126.978),
              zoom: 14,
              width: "800px",
              height: "600px",
            });
            window.__auditMap = map;
            map.on("ConfigLoad", () => {
              clearTimeout(timeout);
              resolve(true);
            });
          });
          await ready;
          const image = document.createElement("canvas");
          image.width = 2;
          image.height = 2;
          const pixel = image.getContext("2d");
          pixel.fillStyle = "#f00";
          pixel.fillRect(0, 0, 2, 2);
          const map = window.__auditMap,
            point = new Tmapv3.LatLng(37.5665, 126.978),
            p2 = new Tmapv3.LatLng(37.57, 126.98),
            p3 = new Tmapv3.LatLng(37.56, 126.99),
            bounds = new Tmapv3.LatLngBounds(point, p2);
          const fixtures = {
            Map: () => map,
            Marker: () => new Tmapv3.Marker({ map, position: point }),
            Label: () =>
              new Tmapv3.Label({ map, position: point, content: "audit" }),
            InfoWindow: () =>
              new Tmapv3.InfoWindow({
                map,
                position: point,
                content: "audit",
                type: 2,
              }),
            Circle: () => new Tmapv3.Circle({ map, center: point, radius: 30 }),
            Rectangle: () => new Tmapv3.Rectangle({ map, bounds }),
            Polyline: () => new Tmapv3.Polyline({ map, path: [point, p2] }),
            Polygon: () => new Tmapv3.Polygon({ map, paths: [point, p2, p3] }),
            GroundOverlay: () =>
              new Tmapv3.GroundOverlay({ map, bounds, url: image.toDataURL() }),
            "extension.MarkerCluster": () =>
              new Tmapv3.extension.MarkerCluster({ map, markers: [] }),
            "extension.Drawing": () => new Tmapv3.extension.Drawing({ map }),
            "extension.HeatMap": () =>
              new Tmapv3.extension.HeatMap({
                map,
                radius: 20,
                data: {
                  max: 10,
                  data: [{ lat: 37.5665, lng: 126.978, value: 5 }],
                },
              }),
            "extension.DotMap": () =>
              new Tmapv3.extension.DotMap({
                map,
                radius: 5,
                data: { data: [{ lat: 37.5665, lng: 126.978, value: 5 }] },
              }),
            "extension.SquareMap": () =>
              new Tmapv3.extension.SquareMap({
                map,
                size: 100,
                data: { data: [{ lat: 37.5665, lng: 126.978, value: 5 }] },
              }),
            "extension.TData": () => new Tmapv3.extension.TData(),
          };
          const instances = [];
          for (const [name, make] of Object.entries(fixtures))
            try {
              const obj = make();
              window.__auditInstances[name] = obj;
              // Enumerate own descriptors only; private engine state can contain cycles/DOM objects.
              const descriptors = Object.getOwnPropertyDescriptors(obj);
              instances.push({
                name: "Tmapv3." + name,
                status: "constructed",
                ownMembers: Reflect.ownKeys(descriptors).map((k) => ({
                  name: String(k),
                  type: typeof descriptors[k].value,
                  get: !!descriptors[k].get,
                  set: !!descriptors[k].set,
                })),
              });
            } catch (e) {
              instances.push({
                name: "Tmapv3." + name,
                status: "failed",
                error: e.message,
              });
            }
          return { ready: true, instances };
        } catch (e) {
          return { ready: false, error: e.message };
        }
      });
      result.mapReady = outcome.ready;
      if(outcome.ready) result.mapSourceObservations=await page.evaluate(probeMapSourceContracts);
      result.instances.push(...(outcome.instances || []));
      if (!outcome.ready)
        result.issues.push(
          issue("runtime-map-not-ready", { error: redact(outcome.error) }),
        );
      await capture("after-construction");
      if (outcome.ready) {
        if (bridges) {
          // Web and mobile each include shared.js; mobile scripts must run as
          // classic page scripts in their own realm to preserve their globals.
          await page.addScriptTag({ content: `(function() {\n${bridges.web}\nwindow.__auditCreateMarkerManager = typeof createTmapMarkerEventManager === 'function' ? createTmapMarkerEventManager : undefined;\nwindow.__auditGetMarkerManager = typeof getTmapMarkerEventManager === 'function' ? getTmapMarkerEventManager : undefined;\n})();` });
          result.bridgeSourceHashes = {web: sha(bridges.web), mobileHelpers: sha(bridges.mobileHelpers)};
          result.bridgeObservations = await page.evaluate(probeBridges, {lane:'web'});
          const frameHandle = await page.evaluateHandle(() => {
            const frame=document.createElement('iframe'); frame.style.display='none'; document.body.appendChild(frame);
            frame.contentWindow.Tmapv3=window.Tmapv3;
            frame.contentWindow.__auditMap=window.__auditMap;
            frame.contentWindow.__auditMapHost=document.getElementById("map");
            return frame;
          });
          try {
            const frame=await frameHandle.contentFrame();
            await frame.addScriptTag({content:`const config = {hasMarkerTapCallback:false,hasMarkerDragCallback:false};\n${bridges.mobileHelpers}`});
            result.bridgeObservations.push(...await frame.evaluate(probeBridges, {lane:'mobile'}));
          } finally {
            await frameHandle.evaluate(frame=>frame.remove());
            await frameHandle.dispose();
          }
          if (typeof bridges.extensions === 'string' && bridges.extensions.trim()) {
            await page.evaluate(`window.__auditExtension = (${bridges.extensions})`);
            result.bridgeSourceHashes.extensions = sha(bridges.extensions);
          }
        }
        result.bridgeObservations.push(...await page.evaluate(probeExtensions));
        const hasExtension = await page.evaluate(()=>typeof window.__auditExtension === 'function');
        result.bridgeObservations.push(...await probeDrawingPointers(page,hasExtension));
        for (const observation of result.bridgeObservations)
          if (!["sample-match", "official-match"].includes(observation.status))
            result.issues.push(
              issue("bridge-component-check-failed", {
                id: observation.id,
                status: observation.status,
              }),
            );
      }
      await page.waitForTimeout(500);
      const cleanup = await page.evaluate(() => {
        const out = [];
        for (const [name, obj] of Object.entries(window.__auditInstances)) {
          try {
            if (name === "Map") continue;
            if (typeof obj.setMap === "function") obj.setMap(null);
            else if (typeof obj.destroy === "function") obj.destroy();
            else continue;
            out.push({ name, status: "detached" });
          } catch (e) {
            out.push({ name, status: "failed", error: e.message });
          }
        }
        return out;
      });
      result.cleanup = cleanup;
      for (const c of cleanup)
        if (c.status === "failed")
          result.issues.push(issue("runtime-cleanup-failed", c));
      await capture("after-detachment");
    } else result.issues.push(issue("authenticated-lifecycle-not-observed"));
    const workerBlobs = await page.evaluate(() =>
      Promise.all(window.__auditWorkerBlobs || []),
    );
    result.generatedWorkers = [];
    for (const b of workerBlobs) {
      const bytes = Buffer.from(b.text, "utf8");
      const digest = sha(bytes);
      await fs.mkdir(CACHE, { recursive: true });
      await fs.writeFile(path.join(CACHE, digest), bytes);
      const matching = sdkSources.find((s) => s.sha256 === digest);
      const isPinned = !!matching;
      const classification = isPinned ? "pinned-worker" : "sdk-worker";
      result.generatedWorkers.push({
        url: redact(b.url),
        retrievedAt: new Date().toISOString(),
        time: new Date().toISOString(),
        sha256: digest,
        bytes: bytes.length,
        pinned: isPinned,
        classification,
        provenance:
          "Blob produced during pinned SDK execution; content-addressed cached locally.",
      });
    }
    await Promise.allSettled(pending);
    for (const script of result.networkScripts)
      if (!script.pinned)
        result.issues.push(
          issue("unpinned-runtime-script", {
            url: script.url,
            sha256: script.sha256,
          }),
        );
    for (const worker of result.generatedWorkers)
      if (!worker.pinned && sdkSources.some((s) => s.kind === "sdk-worker"))
        result.issues.push(
          issue("unpinned-runtime-worker", {
            url: worker.url,
            sha256: worker.sha256,
          }),
        );
    for (const item of result.instances)
      if (item.status === "failed")
        result.issues.push(
          issue("runtime-construction-failed", {
            name: item.name,
            error: redact(item.error),
          }),
        );
  } catch (e) {
    result.issues.push(
      issue("runtime-capture-failed", { error: redact(e.message) }),
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  return JSON.parse(redact(JSON.stringify(result)));
}
