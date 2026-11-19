import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import zlib from 'node:zlib';

const CHECKPOINTS = 'docs/sdk-audit/checkpoints/2026-11-19';
const ARCHIVE = { file: `${CHECKPOINTS}/route-geometry-archived-facets.json.gz`, sha256: 'd803c511732df20e292b9a35b9ebae01cdf5505b3f75b5bc752a32b4dd9cad83' };
const BINDINGS = { file: `${CHECKPOINTS}/rejected-receipt-source-bindings.json.gz`, sha256: '64763f687b44e341a1337b28e2d408e1b6473f892e10eec930fcb9f874eb0301' };
const RELEASE = { file: `${CHECKPOINTS}/public-331-real-scenarios.json.gz`, sha256: 'a27e8154174fee1d2011dd881a06be647c36cdcb01316e38745e0562a27bc31d' };
const DECLARATIONS = { rows: 372, sha256: '007f08242ad040381bf5a17d639b75e33d81f848bece8b025144efe8b986b865' };
const FIXTURE = 'example/integration_test/tdata_route_geometry_contracts.dart';
const MODEL = 'lib/src/models/route_info.dart';
const RELEASED = 'segments-and-snapshot.legacyPath';
const PRESENT = ['RouteInfo.path', 'RouteInfo.guidePoints', 'RouteGuidePoint.point', 'RouteInfo.fromJson'];

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const gitBlob = buffer => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buffer.length}\0`), buffer])).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort());

function pinned(root, { file, sha256: digest }) {
    const bytes = fs.readFileSync(path.join(root, file));
    return sha256(bytes) === digest ? bytes : null;
}

/** Text between the braces that open at or after `from`; null when unbalanced. */
function braced(text, from) {
    const open = text.indexOf('{', from);
    if (open < 0) return null;
    for (let i = open, depth = 0; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
    }
    return null;
}

/** The ten named check literals, as `${rowId}.${check}`, from each historical row(...) call. */
function namedChecks(fixture) {
    const names = [];
    for (const call of fixture.matchAll(/\brow\('([a-z-]+)',\s*\{/g)) {
        const body = braced(fixture, call.index + call[0].length - 1);
        if (body === null) return null;
        for (const literal of body.matchAll(/^\s*'([A-Za-z]+)':/gm)) names.push(`${call[1]}.${literal[1]}`);
    }
    return names;
}

function declares(model, id) {
    const [owner, member, ...rest] = id.split('.');
    if (!owner || !member || rest.length) return false;
    const start = model.search(new RegExp(`^class ${owner} \\{`, 'm'));
    if (start < 0) return false;
    const body = braced(model, start);
    return body !== null && new RegExp(`^\\s*(?:final [^;=]+ ${member};|[^;=(]+ get ${member} =>)`, 'm').test(body);
}

/**
 * Bind the archived route-geometry receipt to its rejected collector, the
 * published 0.1.1 index and the current declarations. Only RouteInfo.path is
 * released; the other nine facets are historical backup calls, not product
 * passes. Returns null on any mismatch.
 */
export function readRouteGeometryHistoricalScope(root, dart) {
    try {
        const archiveBytes = pinned(root, ARCHIVE);
        if (!archiveBytes) return null;
        const archive = JSON.parse(zlib.gunzipSync(archiveBytes));
        if (!keys(archive, ['archivedFiles', 'collector', 'historicalCommit', 'issue', 'previousBindingsSha256', 'published331Sha256', 'releasedFacet', 'requires', 'schemaVersion'])) return null;
        if (archive.schemaVersion !== 1 || archive.previousBindingsSha256 !== BINDINGS.sha256 || archive.published331Sha256 !== RELEASE.sha256 || archive.releasedFacet !== RELEASED) return null;
        const { issue, collector, historicalCommit, archivedFiles, requires } = archive;
        if (!keys(issue, ['code', 'reason']) || issue.code !== 'tdata-route-geometry-observations-rejected' || issue.reason !== 'library mismatch') return null;
        if (!keys(collector, ['path', 'sha256']) || collector.path !== 'tool/sdk_audit/tdata_route_geometry_observations.mjs' || !/^[a-f0-9]{64}$/.test(collector.sha256)) return null;
        if (!/^[a-f0-9]{40}$/.test(historicalCommit) || !keys(archivedFiles, [FIXTURE, MODEL])) return null;

        // Archived texts: Git SHA1 from raw UTF-8 bytes, identical to the historical commit.
        const git = args => execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 });
        if (git(['cat-file', '-t', historicalCommit]).toString().trim() !== 'commit') return null;
        const archived = {};
        for (const file of [FIXTURE, MODEL]) {
            const entry = archivedFiles[file];
            if (!keys(entry, ['gitBlob', 'text']) || typeof entry.text !== 'string') return null;
            const bytes = Buffer.from(entry.text, 'utf8');
            if (gitBlob(bytes) !== entry.gitBlob || !bytes.equals(git(['cat-file', 'blob', `${historicalCommit}:${file}`]))) return null;
            archived[file] = entry;
        }

        // Actual collector bytes equal the pin and the historical commit.
        const collectorBytes = fs.readFileSync(path.join(root, collector.path));
        if (sha256(collectorBytes) !== collector.sha256 || !collectorBytes.equals(git(['cat-file', 'blob', `${historicalCommit}:${collector.path}`]))) return null;

        // Prior rejected-receipt bindings: the exact issue, collector and both backup blobs.
        const bindingsBytes = pinned(root, BINDINGS);
        if (!bindingsBytes) return null;
        const bindings = JSON.parse(zlib.gunzipSync(bindingsBytes));
        if (bindings.backupCommit !== historicalCommit) return null;
        const bound = bindings.issues.filter(x => x?.code === issue.code);
        if (bound.length !== 1) return null;
        const prior = bound[0];
        if (prior.reportedReason !== issue.reason || prior.file !== collector.path || prior.fileSha256 !== collector.sha256) return null;
        if (!object(prior.pathLiteralLineNumbers) || ![FIXTURE, MODEL].every(file => Array.isArray(prior.pathLiteralLineNumbers[file]))) return null;
        const fixtureSource = bindings.sourceFiles?.[FIXTURE], modelSource = bindings.sourceFiles?.[MODEL];
        if (!keys(fixtureSource, ['publishedPackage', 'testedGitBlob', 'backupGitBlob']) || !keys(modelSource, ['publishedPackage', 'testedGitBlob', 'backupGitBlob'])) return null;
        if (fixtureSource.backupGitBlob !== archived[FIXTURE].gitBlob || modelSource.backupGitBlob !== archived[MODEL].gitBlob) return null;

        // Prior fixture absent from published and current; model in both with a different blob.
        if (fixtureSource.publishedPackage !== null || fixtureSource.testedGitBlob !== null || fs.existsSync(path.join(root, FIXTURE))) return null;
        if (!/^[a-f0-9]{64}$/.test(modelSource.publishedPackage ?? '') || !/^[a-f0-9]{40}$/.test(modelSource.testedGitBlob ?? '') || modelSource.testedGitBlob === modelSource.backupGitBlob) return null;
        if (gitBlob(fs.readFileSync(path.join(root, MODEL))) === modelSource.backupGitBlob) return null;

        // Current declarations: complete, issue-free and the stable 372-row fingerprint.
        if (!object(dart) || !Array.isArray(dart.rows) || !Array.isArray(dart.issues) || dart.issues.length !== 0 || dart.rows.length !== DECLARATIONS.rows) return null;
        if (!dart.rows.every(r => object(r) && ['id', 'kind', 'file'].every(k => typeof r[k] === 'string' && r[k] !== ''))) return null;
        const fingerprint = dart.rows.map(r => [r.id, r.kind, r.file].join('\t')).sort();
        if (new Set(fingerprint).size !== fingerprint.length || sha256(Buffer.from(fingerprint.join('\n'))) !== DECLARATIONS.sha256) return null;

        const releaseBytes = pinned(root, RELEASE);
        if (!releaseBytes) return null;
        const release = JSON.parse(zlib.gunzipSync(releaseBytes));
        if (!Array.isArray(release.rows)) return null;
        const releaseIds = new Set(release.rows.map(r => r.id));
        const currentIds = new Set(dart.rows.map(r => r.id));
        if (!PRESENT.every(id => releaseIds.has(id) && currentIds.has(id))) return null;

        // Ten facets: one released path requirement, nine backup-only requirements.
        const facetIds = Object.keys(requires).sort();
        if (facetIds.length !== 10 || !facetIds.includes(RELEASED) || !isDeepStrictEqual(requires[RELEASED], ['RouteInfo.path'])) return null;
        if (!facetIds.every(id => Array.isArray(requires[id]) && requires[id].length > 0 && requires[id].every(x => typeof x === 'string') && new Set(requires[id]).size === requires[id].length)) return null;
        const backupOnly = facetIds.filter(id => id !== RELEASED);
        if (backupOnly.length !== 9) return null;
        for (const id of backupOnly) {
            if (requires[id].some(x => PRESENT.includes(x) || releaseIds.has(x) || currentIds.has(x))) return null;
        }

        // The historical test names exactly these ten checks; the historical model declares every requirement.
        const checks = namedChecks(archived[FIXTURE].text);
        if (!checks || checks.length !== 10 || new Set(checks).size !== 10 || !isDeepStrictEqual([...checks].sort(), facetIds)) return null;
        if (!facetIds.every(id => requires[id].every(x => declares(archived[MODEL].text, x)))) return null;

        const facets = facetIds.map(id => {
            const [row, check] = id.split('.');
            return id === RELEASED
                ? { id, row, check, requires: [...requires[id]], released: true, status: 'released-requires-live-proof', productPass: false }
                : { id, row, check, requires: [...requires[id]], released: false, status: 'historical-backup-call-only', productPass: false };
        });

        return {
            facets,
            releaseIndexSha256: RELEASE.sha256,
            historicalFixtureGitBlob: archived[FIXTURE].gitBlob,
            collectorSha256: collector.sha256,
            original: { code: issue.code, reason: issue.reason }
        };
    } catch {
        return null;
    }
}
