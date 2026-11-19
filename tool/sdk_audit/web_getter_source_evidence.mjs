import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, sha } from './common.mjs';
import { webGetterPublicSource } from './web_getter_public_source.mjs';

export function webGetterSourceEvidence({ manifest, runtime, libFingerprint, bridgeFingerprint, root = ROOT }) {
    try {
        // 1. Baseline Verification
        const baselinePath = path.join(root, 'tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json');
        const baselineBuffer = fs.readFileSync(baselinePath);
        const baselineDigest = sha(baselineBuffer);
        if (baselineDigest !== '49db8bbc0a8bc8c824974a6f38f86473281ad9597fba81de2c616a1ec947e4cd') {
            return null;
        }

        const baselineManifest = JSON.parse(baselineBuffer);
        if (!isDeepStrictEqual(manifest, baselineManifest)) {
            return null;
        }

        const thatPublicSource = webGetterPublicSource(root, libFingerprint, bridgeFingerprint);
        if (!thatPublicSource) return null;

        // 2. Bootstrap/Runtime Verification
        if (runtime.mapReady !== true || runtime.auth !== 'script-executed' || runtime.verifiedBootstrapDigest !== '784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e') {
            return null;
        }

        // 3. SDK/Network Verification
        if (runtime.networkScripts.length !== 1) return null;
        const script = runtime.networkScripts[0];
        if (script.classification !== 'pinned-core' || script.status !== 200 || script.pinned !== true || script.bytes !== 1281499 || script.sha256 !== '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e') return null;

        const allowedRoles = ['bootstrap-cdn-versioned-core', 'flutter-web-fixed-cdn-versioned-core'];
        const scriptSource = manifest.sources.find(s => s.url === script.url && allowedRoles.includes(s.role) && s.sha256 === script.sha256 && s.bytes === script.bytes);
        if (!scriptSource) return null;

        // 4. Bridge Hash Verification
        const sharedJs = fs.readFileSync(path.join(root, 'assets/bridge/shared.js'));
        const webJs = fs.readFileSync(path.join(root, 'assets/bridge/web.js'));
        const emittedWebBridgeSha256 = sha(Buffer.concat([sharedJs, Buffer.from('\n'), webJs]));

        if (runtime.bridgeSourceHashes.web !== emittedWebBridgeSha256) return null;

        // 5. Return proof
        return {
            ...thatPublicSource,
            baselineFileSha256: baselineDigest,
            emittedWebBridgeSha256,
            loadedSdkSha256: script.sha256,
            networkURL: script.url,
            baselineId: manifest.id,
            verifiedBootstrapSha256: runtime.verifiedBootstrapDiges
        };
    } catch (e) {
        return null;
    }
}
