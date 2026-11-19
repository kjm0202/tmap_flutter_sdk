import { ROOT, sha } from "./common.mjs";
import { webGetterSourceEvidence } from "./web_getter_source_evidence.mjs";
import { mobileGetterSourceEvidence } from "./mobile_getter_source_evidence.mjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const EXTENSION_PROBE_SHA = "a5c6dd91f964946955be8ddc21001ba0df6c40411632d0931f0e025f135bb8a4";
const DRAWING_POINTER_PROBE_SHA = "b1b08df42224731a54d6725126d51f5946021e14acd921ba3c0894e91121b79b";
const RUNTIME_REGISTRATION_SPAN_SHA256 = "e2af7b69b2cf8de5942006dcfca405915f7c099bd197ea68cb3ea4ebc2dce64a";
const TMAP_FLUTTER_SDK_SHA = "0747c375871570528239315eb26ace78de0fca8d6f627d7a99a2f37884504bf0";

export function genericDispatchSourceEvidence({manifest, runtime, libFingerprint, bridgeFingerprint, root = ROOT}) {
  try {
    const web = webGetterSourceEvidence({manifest, runtime, libFingerprint, bridgeFingerprint, root});
    const mobile = mobileGetterSourceEvidence({runtime, libFingerprint, bridgeFingerprint, root});

    if (!web || !mobile) return null;

    if (runtime.bridgeSourceHashes && Object.hasOwn(runtime.bridgeSourceHashes, 'extensions')) {
      return null;
    }

    const runtimeContent = fs.readFileSync(path.join(root, 'tool/sdk_audit/runtime.mjs'), 'utf8');
    const startMarker = '          if (typeof bridges.extensions ===';
    const endMarker = '        for (const observation of result.bridgeObservations)';
    const start = runtimeContent.indexOf(startMarker);
    if (start < 0 || start !== runtimeContent.lastIndexOf(startMarker)) return null;
    const end = runtimeContent.indexOf(endMarker, start);
    if (end <= start) return null;
    if (sha(runtimeContent.slice(start, end)) !== RUNTIME_REGISTRATION_SPAN_SHA256) return null;

    // Verification of library fingerprint match
    const libPath = path.join(root, 'lib/tmap_flutter_sdk.dart');
    const libContent = fs.readFileSync(libPath);
    if (sha(libContent) !== TMAP_FLUTTER_SDK_SHA) return null;
    if (libFingerprint.files['lib/tmap_flutter_sdk.dart'] !== TMAP_FLUTTER_SDK_SHA) return null;

    // Verification of probes
    const extProbeContent = fs.readFileSync(path.join(root, 'tool/sdk_audit/extension_probe.mjs'));
    if (sha(extProbeContent) !== EXTENSION_PROBE_SHA) return null;
    const drawProbeContent = fs.readFileSync(path.join(root, 'tool/sdk_audit/drawing_pointer_probe.mjs'));
    if (sha(drawProbeContent) !== DRAWING_POINTER_PROBE_SHA) return null;

    // Release ID verification
    const releasePath = path.join(root, 'docs/sdk-audit/checkpoints/2026-11-19/public-331-real-scenarios.json.gz');
    const releaseCompressed = fs.readFileSync(releasePath);
    const releaseJson = JSON.parse(zlib.gunzipSync(releaseCompressed).toString());

    const expectedIds = [
      'TMap.new',
      'TMapController.addInfoWindow',
      'TMapController.addLabel',
      'TMapController.addPolyline',
      'TMapController.addPolygon',
      'TMapController.addCircle',
      'TMapController.addRectangle',
      'TMapController.addMarker',
      'TMapController.addMarkerClusterer'
    ];

    const foundIds = releaseJson.rows.map(r => r.id);
    for (const id of expectedIds) {
      if (!foundIds.includes(id)) return null;
    }

    const forbidden = ['DotMap', 'SquareMap', 'GroundOverlay', 'Drawing'];
    for (const row of releaseJson.rows) {
      if (forbidden.includes(row.id)) return null;
      if (forbidden.some(f => row.id.startsWith(f + '.'))) return null;
      if (row.id === 'TMapController.runExtension') return null;
    }

    return {
      ...web,
      ...mobile,
      genericProbeHashes: { extensionProbe: EXTENSION_PROBE_SHA, drawingPointerProbe: DRAWING_POINTER_PROBE_SHA },
      runtimeRegistrationSpanSha256: RUNTIME_REGISTRATION_SPAN_SHA256,
      publicReleaseIds: expectedIds
    };
  } catch (e) {
    return null;
  }
}
