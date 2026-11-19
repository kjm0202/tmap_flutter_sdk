import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual as same } from 'node:util';
import { ROOT, sha } from './common.mjs';
import { verifyAuthenticatedGeometryRuntime } from './route_geometry_platform_scope.mjs';

const DIR = 'docs/sdk-audit/checkpoints/2026-11-19';
const ARCHIVE = [`${DIR}/poi-coordinate-archived-facets.json.gz`, '4746736b4b5a54b0702044ec5da724ddb2ac13c64c681c38354a90e836cb0e4a'];
const PLATFORM = [`${DIR}/released-poi-coordinate-three-platform.json.gz`, 'd4c302ed459427499441adaa0a5d73c701138041afcc6e86378c63ec8049870d'];
const BINDINGS = [`${DIR}/rejected-receipt-source-bindings.json.gz`, '64763f687b44e341a1337b28e2d408e1b6473f892e10eec930fcb9f874eb0301'];
const RELEASE = [`${DIR}/public-331-real-scenarios.json.gz`, 'a27e8154174fee1d2011dd881a06be647c36cdcb01316e38745e0562a27bc31d'];
const PUBLISHED = 'tool/sdk_audit/fixtures/actual-pub-0.1.1.tar.gz';
const MODEL = 'lib/src/models/poi_item.dart';
const FIXTURE = 'example/integration_test/tdata_poi_coordinate_presence_contracts.dart';
const COLLECTOR = 'tool/sdk_audit/tdata_poi_coordinate_presence_observations.mjs';
const SAMPLES = 'example/test_driver/bridge/tdata_coordinate_samples.dart';
const DRIVER = 'example/test_driver/bridge/tdata_coordinate_poi.dart';
const CURRENT = '14890163bb8189d0167a926f68c5de8a4c6510533a31e16d969966b61424b80d';
const DECLARATIONS = '007f08242ad040381bf5a17d639b75e33d81f848bece8b025144efe8b986b865';
const TARGET = { code: 'tdata-poi-coordinate-presence-observations-rejected', reason: 'library mismatch' };
const RELEASED = 'missing-invalid.legacyFallback';
const REQUIRES = {
    'constructor.providedRetained': ['PoiItem.pointOrNull', 'PoiItem.coordinateSource', 'PoiCoordinateSource.provided'],
    [RELEASED]: ['PoiItem.point'],
    'missing-invalid.nullAccess': ['PoiItem.pointOrNull'],
    'missing-invalid.unavailableSource': ['PoiItem.coordinateSource', 'PoiCoordinateSource.unavailable'],
    'valid-and-fallback.completeFallback': ['PoiItem.pointOrNull', 'PoiItem.coordinateSource', 'PoiCoordinateSource.front'],
    'valid-and-fallback.zeroValid': ['PoiItem.pointOrNull', 'PoiItem.coordinateSource', 'PoiCoordinateSource.noor'],
};
const PLATFORMS = ['android', 'ios', 'web'];
const POI = { absentPoint: [0, 0], constructedZero: [0, 0], malformedNoorWithCompleteFront: [37.4, 127.1], noorLatFrontLonOnly: [0, 0], validZero: [0, 0] };
const ROWS = { comparedRows: 20, controlledMissingNoorCount: 20, distinctlyDifferentPairs: 11, rawRowCount: 20 };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, expected) => object(x) && same(Object.keys(x).sort(), [...expected].sort());
const check = condition => { if (!condition) throw Error('POI evidence mismatch'); };
const blob = bytes => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
const load = (root, [file, digest]) => {
    const bytes = fs.readFileSync(path.join(root, file));
    check(sha(bytes) === digest);
    return JSON.parse(gunzipSync(bytes));
};

// Read the single model from the pinned published tarball, without Git or network access.
function publishedModel(root, digest) {
    const compressed = fs.readFileSync(path.join(root, PUBLISHED));
    check(sha(compressed) === digest);
    const tar = gunzipSync(compressed);
    let found;
    for (let offset = 0; offset + 512 <= tar.length;) {
        const header = tar.subarray(offset, offset + 512);
        const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
        if (!name) break;
        const sizeText = header.toString('ascii', 124, 136).replace(/\0.*$/, '').trim();
        check(/^[0-7]+$/.test(sizeText));
        const size = parseInt(sizeText, 8);
        offset += 512;
        check(Number.isSafeInteger(size) && offset + size <= tar.length);
        if (name === MODEL) {
            check(found === undefined && (header[156] === 0 || header[156] === 48));
            found = tar.subarray(offset, offset + size);
        }
        offset += Math.ceil(size / 512) * 512;
    }
    check(found !== undefined);
    return found;
}

// Extract the literal check names within each historical row, not other map keys.
function historicalChecks(text) {
    const result = [];
    for (const row of text.matchAll(/\brow\('([a-z-]+)',\s*\{/g)) {
        const start = row.index + row[0].length;
        const end = text.indexOf('});', start);
        check(end !== -1);
        for (const item of text.slice(start, end).matchAll(/^\s*'([A-Za-z]+)':/gm)) result.push(`${row[1]}.${item[1]}`);
    }
    return result.sort();
}

function historicalEvidence(root, dart) {
    const archive = load(root, ARCHIVE);
    const bindings = load(root, BINDINGS);
    const release = load(root, RELEASE);
    check(archive.schemaVersion === 1 && same(archive.issue, TARGET) && archive.released === RELEASED && same(archive.requires, REQUIRES));
    check(archive.currentPoiSha256 === CURRENT && archive.platformReceiptSha256 === PLATFORM[1]);
    check(archive.historicalCommit === bindings.backupCommit && /^[a-f0-9]{40}$/.test(archive.historicalCommit));
    check(keys(archive.archivedFiles, [FIXTURE, MODEL]));
    for (const file of [FIXTURE, MODEL]) {
        const entry = archive.archivedFiles[file];
        check(keys(entry, ['gitBlob', 'text']) && typeof entry.text === 'string');
        check(blob(Buffer.from(entry.text, 'utf8')) === entry.gitBlob && bindings.sourceFiles?.[file]?.backupGitBlob === entry.gitBlob);
    }
    check(keys(archive.collector, ['path', 'sha256']) && archive.collector.path === COLLECTOR);
    check(sha(fs.readFileSync(path.join(root, COLLECTOR))) === archive.collector.sha256);
    const prior = bindings.issues.filter(i => i?.code === TARGET.code);
    check(prior.length === 1 && prior[0].reportedReason === TARGET.reason && prior[0].file === COLLECTOR && prior[0].fileSha256 === archive.collector.sha256);
    check([FIXTURE, MODEL].every(f => Array.isArray(prior[0].pathLiteralLineNumbers?.[f])));
    const fixtureSource = bindings.sourceFiles[FIXTURE], modelSource = bindings.sourceFiles[MODEL];
    check(keys(fixtureSource, ['publishedPackage', 'testedGitBlob', 'backupGitBlob']) && keys(modelSource, ['publishedPackage', 'testedGitBlob', 'backupGitBlob']));
    check(fixtureSource.publishedPackage === null && fixtureSource.testedGitBlob === null && !fs.existsSync(path.join(root, FIXTURE)));
    check(/^[a-f0-9]{64}$/.test(modelSource.publishedPackage) && /^[a-f0-9]{40}$/.test(modelSource.testedGitBlob) && modelSource.testedGitBlob !== modelSource.backupGitBlob);
    check(blob(fs.readFileSync(path.join(root, MODEL))) !== modelSource.backupGitBlob);
    check(release.published?.version === '0.1.1' && release.published.archiveSha256 === bindings.publishedArchiveSha256 && Array.isArray(release.rows) && release.rows.length === 331);
    const published = publishedModel(root, bindings.publishedArchiveSha256);
    check(sha(published) === modelSource.publishedPackage && blob(published) !== modelSource.backupGitBlob);
    check(!/\b(?:pointOrNull|coordinateSource|PoiCoordinateSource)\b/.test(published.toString('utf8')));
    check(object(dart) && Array.isArray(dart.rows) && dart.rows.length === 372 && Array.isArray(dart.issues) && dart.issues.length === 0);
    check(dart.rows.every(r => object(r) && ['id', 'kind', 'file'].every(k => typeof r[k] === 'string' && r[k].length > 0)));
    const fingerprint = dart.rows.map(r => [r.id, r.kind, r.file].join('\t')).sort();
    check(new Set(fingerprint).size === 372 && sha(fingerprint.join('\n')) === DECLARATIONS);
    const releaseIds = new Set(release.rows.map(r => r.id));
    const currentIds = new Set(dart.rows.map(r => r.id));
    for (const ids of [releaseIds, currentIds]) {
        check(['PoiItem.point', 'PoiItem.fromJson', 'PoiItem.new'].every(id => ids.has(id)));
        check(![...ids].some(id => id === 'PoiItem.pointOrNull' || id === 'PoiItem.coordinateSource' || id === 'PoiCoordinateSource' || id.startsWith('PoiCoordinateSource.')));
    }
    const fixture = archive.archivedFiles[FIXTURE].text, model = archive.archivedFiles[MODEL].text;
    check(same(historicalChecks(fixture), Object.keys(REQUIRES).sort()));
    // In particular, the archived getter selects null using the source enum.
    check(/final\s+LatLng\s+point\s*;/.test(model) && /final\s+PoiCoordinateSource\s+coordinateSource\s*;/.test(model));
    check(/LatLng\?\s+get\s+pointOrNull\s*=>\s*coordinateSource\s*==\s*PoiCoordinateSource\.unavailable\s*\?\s*null\s*:\s*point\s*;/.test(model));
    check(/enum\s+PoiCoordinateSource\s*\{\s*provided\s*,\s*noor\s*,\s*front\s*,\s*generic\s*,\s*unavailable\s*\}/.test(model));
    const facets = Object.entries(REQUIRES).map(([id, requires]) => {
        const [row, checkName] = id.split('.');
        return { id, row, check: checkName, requires: [...requires], released: id === RELEASED,
            status: id === RELEASED ? 'released-requires-live-proof' : 'historical-backup-call-only', productPass: false };
    });
    return { archive, facets, releaseIndexSha256: RELEASE[1], currentPublicDeclarationSha256: DECLARATIONS,
        historicalFixtureGitBlob: archive.archivedFiles[FIXTURE].gitBlob, historicalModelGitBlob: archive.archivedFiles[MODEL].gitBlob,
        publishedModelSha256: modelSource.publishedPackage, publishedModelGitBlob: modelSource.testedGitBlob,
        collectorSha256: archive.collector.sha256, original: { ...TARGET } };
}

/** Review only the released subset; historical backup-only checks are not verified passes. */
export function reviewReleasedPoiCoordinate({ issues, manifest, runtime, libFingerprint, dart, root = ROOT }) {
    const unchanged = { open: issues, resolved: [] };
    try {
        const matches = issues.filter(issue => issue?.code === TARGET.code);
        check(matches.length === 1 && same(matches[0], TARGET));
        const runtimeScope = verifyAuthenticatedGeometryRuntime(manifest, runtime, root);
        check(object(libFingerprint?.files) && libFingerprint.sha256 === sha(JSON.stringify(libFingerprint.files)));
        check(libFingerprint.files[MODEL] === CURRENT && sha(fs.readFileSync(path.join(root, MODEL))) === CURRENT);
        const historical = historicalEvidence(root, dart);
        const { archive, ...historicalOutput } = historical;
        check(keys(archive.driversSha256, [DRIVER, SAMPLES]));
        for (const [file, digest] of Object.entries(archive.driversSha256)) check(sha(fs.readFileSync(path.join(root, file))) === digest);
        const receipt = load(root, PLATFORM);
        check(receipt.schemaVersion === 1 && same(receipt.historicalFixtures, { file: FIXTURE, gitCommit: archive.historicalCommit }));
        check(same(receipt.sourceScope, { coordinateSource: false, point: true, pointOrNull: false }));
        check(keys(receipt.groups?.['poi-after'], PLATFORMS));
        const harnessSha256 = sha(receipt.harness);
        const platforms = {};
        for (const platform of PLATFORMS) {
            const run = receipt.groups['poi-after'][platform], obs = run?.observation;
            check(run?.platform === platform && run.phase === 'poi-after' && run.outcome === 'PASS' && typeof run.device === 'string' && run.device.length > 0);
            check(run.harnessSha256 === harnessSha256 && run.sourceHashes?.[MODEL] === CURRENT && run.sourceHashes?.[SAMPLES] === archive.driversSha256[SAMPLES]);
            check(obs?.schemaVersion === 1 && obs.scope === 'controlled-model-sample-no-network' && same(obs.failures, []) && same(obs.poi, POI));
            check(run.emptyCount === 0 && same(run.queryRows, ROWS));
            platforms[platform] = { device: run.device, phase: run.phase, outcome: run.outcome, poi: { ...obs.poi }, emptyCount: run.emptyCount, queryRows: { ...run.queryRows } };
        }
        return {
            open: issues.filter(issue => issue !== matches[0]),
            resolved: [{
                original: matches[0], status: 'REVIEWED_RELEASE_SUBSET_OF_HISTORICAL_RECEIPT',
                scope: 'One released legacy fallback and five historical backup-only conditions; the separate corrected fallback is a bounded observation, not a historical receipt or contract promotion.',
                evidence: {
                    releasedPublicObservations: 1, backupOnlyConditions: 5,
                    historical: historicalOutput,
                    platform: { sourceGroup: 'poi-after', runtime: runtimeScope, checkpoint: { file: PLATFORM[0], sha256: PLATFORM[1] },
                        model: { file: MODEL, sha256: CURRENT }, drivers: { ...archive.driversSha256 },
                        scope: 'Controlled public PoiItem model samples, plus a live empty search and 20 real POIs with 11 distinct coordinate pairs on each platform.',
                        correctedFallback: { id: 'malformedNoorWithCompleteFront', point: [37.4, 127.1], scope: 'controlled-model-sample-no-network', productPass: false }, platforms }
                }
            }]
        };
    } catch {
        return unchanged;
    }
}
