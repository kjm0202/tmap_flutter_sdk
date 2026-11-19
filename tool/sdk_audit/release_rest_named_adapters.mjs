import fs from "node:fs";
import crypto from "node:crypto";
import zlib from "node:zlib";
import path from "node:path";
import { ROOT } from "./common.mjs";

export function readTar(buffer) {
  const files = {};
  let offset = 0;
  while (offset < buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    const name = header.toString("utf8", 0, 100).replace(/\0/g, "");
    if (name === "") break;
    const size = parseInt(header.toString("utf8", 124, 136), 8);
    offset += 512;
    if (size > 0) {
      files[name] = buffer.subarray(offset, offset + size);
      offset += Math.ceil(size / 512) * 512;
    }
  }
  return files;
}

export function releasedAdapterProof(endpoints, read = fs.readFileSync) {
  try {
    const publishedApiFile = path.join(ROOT, "docs/sdk-audit/checkpoints/2026-11-19/published-flutter-api.json.gz");
    const publishedApiBytes = read(publishedApiFile);
    const publishedApiSha256 = crypto.createHash("sha256").update(publishedApiBytes).digest("hex");
    if (publishedApiSha256 !== "d7711758841699de9e992f49a0a6a557e8c9d80a105dc45bd26008433a168046") return null;

    const publishedApiContent = JSON.parse(zlib.gunzipSync(publishedApiBytes));
    const publishedDeclarations = publishedApiContent.officialDartdocIndex.declarationsExcludingLibrary;

    const fixturePath = path.join(ROOT, "tool/sdk_audit/fixtures/actual-pub-0.1.1.tar.gz");
    const fixtureContent = read(fixturePath);
    const archiveSha256 = crypto.createHash("sha256").update(fixtureContent).digest("hex");

    // Validate archive pin
    if (archiveSha256 !== "dae54a154deb0b979e27c18d7d49d00faedd93bc8dfff8c732f11438a7fbb056") return null;
    if (publishedApiContent.release.archiveSha256 !== archiveSha256) return null;

    const tarBuffer = zlib.gunzipSync(fixtureContent);
    const files = readTar(tarBuffer);

    const tdataService = files["lib/src/services/tdata_service.dart"]?.toString("utf8");
    const jsTdata = files["lib/src/js/js_tdata.dart"]?.toString("utf8");
    const tmapController = files["lib/src/tmap_controller.dart"]?.toString("utf8");

    if (!tdataService || !jsTdata || !tmapController) return null;

    // Extract 7 actual URI pathnames
    const uriRegex = /'(?:https:\/\/apis\.openapi\.sk\.com)?(\/tmap\/[^'?]+)/g;
    const extractedRoutes = [...tdataService.matchAll(uriRegex)].map(m => m[1]);
    const namedRoutes = extractedRoutes;

    // Extract 8 sdkMethods
    const methodRegex = /td\.(\w+)\(/g;
    const sdkMethods = [...jsTdata.matchAll(methodRegex)].map(m => m[1]);

    // Extract publicMethods
    const publicMethodsRegex = /TDataService\.(\w+)\(/g;
    const publicMethods = [...new Set([...tmapController.matchAll(publicMethodsRegex)].map(m => m[1]))];

    if (namedRoutes.length !== 7 || sdkMethods.length !== 8 || publicMethods.length !== 7) return null;

    // Verify publicMethods
    const index = publishedApiContent.officialDartdocIndex.index;
    for (const name of publicMethods) {
        if (!tdataService.includes(name)) return null;
        if (!index["TDataService." + name]) return null;
        if (!index["TMapController." + name]) return null;
    }

    // Check declaration count
    if (publishedDeclarations !== 331) return null;

    if (!Array.isArray(endpoints) || endpoints.length === 0) return null;

    // Reject malformed/empty/query inputs and actual collisions after /tmap stripping.
    for (const endpoint of endpoints) {
        if (typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.includes('?') || endpoint.includes(' ') || endpoint.includes('..')) return null;

        const checkEndpoint = endpoint.startsWith('/tmap/') ? endpoint : '/tmap' + endpoint;

        if (namedRoutes.includes(checkEndpoint)) return null;
    }

    // Source digests
    const sourceDigests = {
        'lib/src/services/tdata_service.dart': crypto.createHash("sha256").update(files['lib/src/services/tdata_service.dart']).digest("hex"),
        'lib/src/js/js_tdata.dart': crypto.createHash("sha256").update(files['lib/src/js/js_tdata.dart']).digest("hex"),
        'lib/src/tmap_controller.dart': crypto.createHash("sha256").update(files['lib/src/tmap_controller.dart']).digest("hex"),
    };

    return {
        archiveSha256,
        namedRoutes,
        sdkMethods,
        publicMethods,
        publishedDeclarations,
        sourceDigests
    };
  } catch (e) {
    return null;
  }
}

// A separate receipt for named historical routes. Keep the earlier receipt's
// shape intact: it is already part of published reference-scope resolutions.
export function releasedHistoricalNamedProof(endpoints, names, read = fs.readFileSync) {
  try {
    const base = releasedAdapterProof(endpoints.map(x => x.replace(/\{regionId\}$/, '')), read);
    if (!base || !Array.isArray(names) || names.length !== 6 || new Set(names).size !== 6) return null;
    const apiBytes = read(path.join(ROOT, 'docs/sdk-audit/checkpoints/2026-11-19/published-flutter-api.json.gz'));
    if (crypto.createHash('sha256').update(apiBytes).digest('hex') !== 'd7711758841699de9e992f49a0a6a557e8c9d80a105dc45bd26008433a168046') return null;
    const index = JSON.parse(zlib.gunzipSync(apiBytes)).officialDartdocIndex.index;
    const archive = read(path.join(ROOT, 'tool/sdk_audit/fixtures/actual-pub-0.1.1.tar.gz'));
    if (crypto.createHash('sha256').update(archive).digest('hex') !== base.archiveSha256) return null;
    const files = readTar(zlib.gunzipSync(archive));
    const relevant = ['lib/src/services/tdata_service.dart', 'lib/src/services/tdata_protocol.dart', 'lib/src/js/js_tdata.dart', 'lib/src/tmap_controller.dart'];
    if (relevant.some(p => !files[p])) return null;
    const sourceText = relevant.map(p => files[p].toString('utf8')).join('\n');
    const indexEntries = Object.entries(index).filter(([key]) => /^(TDataService|TDataResponse|TDataRequestType|TMapController)(\.|$)/.test(key));
    if (!indexEntries.length || !index.TDataService || !index.TDataResponse || !index.TDataRequestType || !index.TMapController) return null;
    if (names.some(n => new RegExp('\\b' + n + '\\b').test(sourceText) || Object.keys(index).some(k => k.split('.').at(-1) === n))) return null;
    if (endpoints.some(e => {
      const path = '/tmap' + e.replace(/\{regionId\}$/, '');
      return base.namedRoutes.some(r => r === path || (path.endsWith('/') && r.startsWith(path)) || (r.endsWith('/') && path.startsWith(r)));
    })) return null;
    return { archiveSha256: base.archiveSha256, publishedDeclarations: base.publishedDeclarations,
      namedRoutes: base.namedRoutes, sdkMethods: base.sdkMethods, publicMethods: base.publicMethods,
      sourceDigests: Object.fromEntries(relevant.map(p => [p, crypto.createHash('sha256').update(files[p]).digest('hex')])),
      httpClassEntries: Object.fromEntries(indexEntries), absentMethodNames: names };
  } catch { return null; }
}
