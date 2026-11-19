import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import path from 'path';

const EXPECTED_HASHES = {
    'lib/src/tmap_controller.dart': 'bea92644449d4959bfcc46be9a31eaf038f5ea17bf43b93e294a81a022629ea7',
    'lib/src/web/tmap_web_bridge.dart': 'e3e36c1b3bbac1653c64b3824521703cb7c9ab542e6a1c66a9ccea1f7223a631',
    'lib/src/bridge_assets.dart': '53df87d66cf26e1936282928e0f0474ff907bfe717dd27493c5fd532110d67dd',
    'assets/bridge/web.js': 'cb1212e1f5d70a0e9d9cbf003c8a1f9be55bd8993863f5c2e2fac94345fb5bca',
    'assets/bridge/shared.js': 'e1c85c2c1a5abecac241d1b9c174cc7cbdbb1bce028758a295910da02e1917aa',
    'tool/sdk_audit/bridge_probe.mjs': 'd01c3909b2296b47f7eac23ad48b5b883aa86d9ff9ecdfe8869b3eb588a71c3a',
    'tool/sdk_audit/dart/bin/bridges.dart': 'd601e2ceb33c5006c76a538d6f1e44cf0de61c53eff59108df2d3d8c8d50a32b',
};

const GZ_FILE_PATH = 'docs/sdk-audit/checkpoints/2026-11-19/public-331-real-scenarios.json.gz';
const GZ_FILE_HASH = 'a27e8154174fee1d2011dd881a06be647c36cdcb01316e38745e0562a27bc31d';

export function webGetterPublicSource(root, libFingerprint, bridgeFingerprint) {
    try {
        const sourceFileHashes = {};

        // Check each file
        for (const [filePath, expectedHash] of Object.entries(EXPECTED_HASHES)) {
            const absolutePath = path.join(root, filePath);
            const fileBuffer = fs.readFileSync(absolutePath);
            const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            if (actualHash !== expectedHash) return null;

            if (filePath.startsWith('lib/')) {
                if (libFingerprint?.files?.[filePath] !== expectedHash) return null;
            } else if (filePath.startsWith('assets/')) {
                if (bridgeFingerprint?.files?.[filePath] !== expectedHash) return null;
            }

            sourceFileHashes[filePath] = actualHash;
        }

        // Validate GZ file
        const gzPath = path.join(root, GZ_FILE_PATH);
        const gzBuffer = fs.readFileSync(gzPath);
        const gzHash = crypto.createHash('sha256').update(gzBuffer).digest('hex');
        if (gzHash !== GZ_FILE_HASH) return null;

        // Parse gunzip
        const jsonBuffer = zlib.gunzipSync(gzBuffer);
        const data = JSON.parse(jsonBuffer.toString());
        const rows = data.rows;
        const ids = new Set(rows.map(r => r.id));

        if (ids.size !== 331 || rows.length !== 331) return null;
        if (!ids.has('TMapController.setZoom')) return null;

        const forbidden = ['TMapController.getZoom', 'TMapController.getMinZoom', 'TMapController.getMaxZoom', 'TMapController.getPitch', 'TMapController.getBearing', 'TMapController.getCenter', 'TMapController.realToScreen'];
        for (const f of forbidden) {
            if (ids.has(f)) return null;
        }

        return {
            sourceFileHashes,
            publicDeclarationIndexSha256: gzHash
        };

    } catch (e) {
        return null;
    }
}
