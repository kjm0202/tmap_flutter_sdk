import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import path from 'node:path';

export function verifiedNativeAdapterArchive(root) {
    try {
        const fixturePath = path.join(root, 'docs/sdk-audit/checkpoints/2026-11-19/historical-native-adapter-fixtures.json.gz');
        const priorPath = path.join(root, 'docs/sdk-audit/checkpoints/2026-11-19/rejected-receipt-source-bindings.json.gz');

        // 1. Synchronously read and check SHA256 of GZIP files
        const fixtureBuffer = fs.readFileSync(fixturePath);
        const priorBuffer = fs.readFileSync(priorPath);

        if (crypto.createHash('sha256').update(fixtureBuffer).digest('hex') !== '0005350da3abd53ed716443550fae3b8ad0ad43b38967dcd03e5dbbf0c62a5d1') return null;
        if (crypto.createHash('sha256').update(priorBuffer).digest('hex') !== '64763f687b44e341a1337b28e2d408e1b6473f892e10eec930fcb9f874eb0301') return null;

        // 2. Gunzip JSON
        const fixture = JSON.parse(zlib.gunzipSync(fixtureBuffer).toString('utf8'));
        const prior = JSON.parse(zlib.gunzipSync(priorBuffer).toString('utf8'));

        // 3. Verify commits
        const expectedCommit = '100fbc26b2dae8b410e64fc362344021ec944f08';
        if (fixture.historicalCommit !== expectedCommit || prior.backupCommit !== expectedCommit) return null;

        // 4. Verify backupFiles
        const blobIds = {};
        for (const [key, text] of Object.entries(fixture.backupFiles)) {
            // Verify SHA1 of Git blob header + UTF8 text
            const content = Buffer.from(text, 'utf8');
            const header = Buffer.from(`blob ${content.length}\0`);
            const sha1 = crypto.createHash('sha1').update(header).update(content).digest('hex');

            const priorInfo = prior.sourceFiles[key];
            if (!priorInfo ||
                priorInfo.backupGitBlob !== sha1 ||
                priorInfo.publishedPackage !== null ||
                priorInfo.testedGitBlob !== null) {
                return null;
            }
            blobIds[key] = sha1;
        }

        // 5. Verify fixture.backupFiles[fixture.entryImplementation]
        const entryText = fixture.backupFiles[fixture.entryImplementation];
        if (!entryText ||
            !entryText.includes('SdkNativeEvents get sdkEvents')) {
            return null;
        }

        return {fixture, prior, blobIds};

    } catch (err) {
        return null;
    }
}
