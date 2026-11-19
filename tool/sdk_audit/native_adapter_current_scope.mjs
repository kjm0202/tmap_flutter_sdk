import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import zlib from 'node:zlib';
import { ROOT } from './common.mjs';

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

export function currentNativeAdapterEvidence({ manifest, runtime, dart, libFingerprint, root = ROOT }) {
    try {
        const baselinePath = path.join(root, 'tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json');
        const baselineBuffer = fs.readFileSync(baselinePath);
        if (sha256(baselineBuffer) !== '49db8bbc0a8bc8c824974a6f38f86473281ad9597fba81de2c616a1ec947e4cd') return null;

        const baselineManifest = JSON.parse(baselineBuffer);
        if (!isDeepStrictEqual(manifest, baselineManifest)) return null;

        if (runtime.mapReady !== true || runtime.auth !== 'script-executed' || runtime.verifiedBootstrapDigest !== '784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e') return null;

        if (runtime.networkScripts.length !== 1) return null;
        const script = runtime.networkScripts[0];

        if (script.pinned !== true) return null;
        if (script.status !== 200) return null;
        if (script.classification !== 'pinned-core') return null;
        if (script.sha256 !== '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e') return null;
        if (script.bytes !== 1281499) return null;

        const scriptSource = manifest.sources.find(s => s.url === script.url && s.sha256 === script.sha256 && s.bytes === script.bytes && (s.role === 'bootstrap-cdn-versioned-core' || s.role === 'flutter-web-fixed-cdn-versioned-core'));
        if (!scriptSource) return null;

        const checkpointPath = path.join(root, 'docs/sdk-audit/checkpoints/2026-11-19/public-331-real-scenarios.json.gz');
        const checkpointBuffer = fs.readFileSync(checkpointPath);
        if (sha256(checkpointBuffer) !== 'a27e8154174fee1d2011dd881a06be647c36cdcb01316e38745e0562a27bc31d') return null;

        const checkpointData = JSON.parse(zlib.gunzipSync(checkpointBuffer));

        const releaseIds = new Set(checkpointData.rows.map(r => r.id));
        const currentIds = new Set(dart.rows.map(r => r.id));

        const absentTypes = ['SdkHtmlNative', 'SdkUtilitiesNative', 'SdkVsmControlsNative', 'SdkVisualizationNative', 'SdkDrawingNative', 'SdkMarkerClusterNative', 'SdkNativeEvents'];

        for (const type of absentTypes) {
            if (currentIds.has(type)) return null;
            if (releaseIds.has(type)) return null;
            if (dart.rows.some(r => r.id.startsWith(`${type}.`))) return null;
            if (checkpointData.rows.some(r => r.id.startsWith(`${type}.`))) return null;
        }

        if (currentIds.has('TMapController.sdkEvents')) return null;
        if (releaseIds.has('TMapController.sdkEvents')) return null;

        if (!currentIds.has('TMapController.setZoom')) return null;
        if (!currentIds.has('TMapController.webViewController')) return null;
        if (!releaseIds.has('TMapController.setZoom')) return null;
        if (!releaseIds.has('TMapController.webViewController')) return null;

        if (dart.issues.length !== 0) return null;

        const nameEvidenceString = dart.rows.map(r => [r.id, r.kind, r.file].join('\t')).sort().join('\n');
        if (sha256(Buffer.from(nameEvidenceString)) !== '007f08242ad040381bf5a17d639b75e33d81f848bece8b025144efe8b986b865') return null;

        const pinnedPaths = ['lib/tmap_flutter_sdk.dart', 'lib/src/tmap_controller.dart'];
        const approvedShas = {
            'lib/tmap_flutter_sdk.dart': '0747c375871570528239315eb26ace78de0fca8d6f627d7a99a2f37884504bf0',
            'lib/src/tmap_controller.dart': 'bea92644449d4959bfcc46be9a31eaf038f5ea17bf43b93e294a81a022629ea7'
        };

        for (const p of pinnedPaths) {
            if (libFingerprint.files[p] !== approvedShas[p]) return null;
            if (sha256(fs.readFileSync(path.join(root, p))) !== approvedShas[p]) return null;
        }

        return {
            baselineId: manifest.id,
            coreSha256: script.sha256,
            releaseIndexSha256: 'a27e8154174fee1d2011dd881a06be647c36cdcb01316e38745e0562a27bc31d',
            currentPublicDeclarationSha256: '007f08242ad040381bf5a17d639b75e33d81f848bece8b025144efe8b986b865',
            absentAdapterNames: absentTypes,
            controllerGetter: 'TMapController.sdkEvents'
        };
    } catch (e) {
        return null;
    }
}
