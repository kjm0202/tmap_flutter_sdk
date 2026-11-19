import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { isDeepStrictEqual } from 'util';

const COMPRESSED_FILE_SHA256 = 'aa816db02f412bcf5e96170ad69fd7b71fdecfa627997bbac273e9ac0b8751c0';
const VERIFIED_BOOTSTRAP_DIGEST = '784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e';

// Loads a pinned 2026-11-19 checkpoint receipt and checks it against the current manifest, both core
// source texts and the authenticated production network pin. Returns null when any check fails.
export function verifiedCoreReceipt({manifest, sources, runtime}, receiptName, receiptSha256) {
    const dataPath = fileURLToPath(new URL(`../../docs/sdk-audit/checkpoints/2026-11-19/${receiptName}`, import.meta.url));

    let compressedBytes;
    try {
        compressedBytes = readFileSync(dataPath);
    } catch (e) {
        return null;
    }

    const hash = createHash('sha256').update(compressedBytes).digest('hex');
    if (hash !== receiptSha256) {
        return null;
    }

    const decompressed = gunzipSync(compressedBytes);
    const receipt = JSON.parse(decompressed.toString());

    // Validate manifest
    const body = {...manifest};
    delete body.id;
    const manifestId = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    if (manifestId !== manifest.id || manifest.id !== receipt.manifestId) {
         return null;
    }

    // Validate sources
    const roles = ['documentation-host-example-core', 'flutter-web-fixed-cdn-versioned-core'];
    const digests = [];
    let flutterWebSha;

    for (const role of roles) {
        const manifestSources = manifest?.sources?.filter(s => s.role === role);
        const sourceMatches = sources.filter(s => s.role === role);

        if (manifestSources.length !== 1 || sourceMatches.length !== 1) {
            return null;
        }

        const manifestSource = manifestSources[0];
        const source = sourceMatches[0];

        if (typeof source.text !== 'string' || manifestSource.url !== source.url || manifestSource.sha256 !== source.sha256) {
            return null;
        }
        const textHash = createHash('sha256').update(source.text).digest('hex');
        if (textHash !== source.sha256) {
            return null;
        }

        digests.push(source.sha256);
        if (role === 'flutter-web-fixed-cdn-versioned-core') {
            flutterWebSha = source.sha256;
        }
    }

    // Validate runtime
    if (runtime.auth !== 'script-executed' || runtime.verifiedBootstrapDigest !== VERIFIED_BOOTSTRAP_DIGEST) {
        return null;
    }

    const bootstrapSources = manifest?.sources?.filter(s => s.role === 'bootstrap-cdn-versioned-core');
    const validNetworkScripts = runtime.networkScripts.filter(script =>
        script.pinned === true &&
        script.status === 200 &&
        script.sha256 === flutterWebSha &&
        bootstrapSources.filter(mSource =>
            mSource.url === script.url &&
            mSource.sha256 === script.sha256
        ).length === 1
    );

    if (validNetworkScripts.length !== 1) {
        return null;
    }

    return {receipt, digests};
}

export function reviewXmlNamespaceWrites({issues, manifest, sources, ast, runtime}) {
    if (!manifest || !runtime ||
        !Array.isArray(sources) || !Array.isArray(issues) ||
        !Array.isArray(manifest?.sources) || !Array.isArray(ast?.rows) ||
        !Array.isArray(runtime?.rows) || !Array.isArray(runtime?.networkScripts) ||
        issues.filter(i => i.code === 'dynamic-property-write' && i.owner === 'Tmapv3.extension.XML').some(i => !i.evidence?.start)) {
        return { open: issues, resolved: [] };
    }

    const receipt = verifiedCoreReceipt({manifest, sources, runtime}, 'xml-namespace-dictionary-observation.json.gz', COMPRESSED_FILE_SHA256)?.receipt;
    if (!receipt) {
        return { open: issues, resolved: [] };
    }

    // Filter and validate issues
    const candidateIssues = issues.filter(i => i.code === 'dynamic-property-write' && i.owner === 'Tmapv3.extension.XML');
    const sortedCandidateIssues = [...candidateIssues].sort((a, b) => a.evidence.start - b.evidence.start);

    if (!isDeepStrictEqual(sortedCandidateIssues, receipt.issues)) {
        return { open: issues, resolved: [] };
    }

    const astIds = new Set(receipt.ast.map(r => r.id));
    const filteredAstRows = ast?.rows?.filter(r => astIds.has(r.id));
    const filteredRuntimeRows = runtime?.rows?.filter(r => astIds.has(r.id));

    if (!isDeepStrictEqual(filteredAstRows, receipt.ast) || !isDeepStrictEqual(filteredRuntimeRows, receipt.runtime)) {
        return { open: issues, resolved: [] };
    }

    // Prepare resolved and open issues
    const resolved = candidateIssues.map(issue => ({
        status: 'RESOLVED_DIAGNOSTIC',
        original: issue,
        receiptHash: COMPRESSED_FILE_SHA256,
        scope: receipt.scope,
        rationale: "describing instance-owned XML prefix/URI dictionaries; no public SDK member registration",
        evidence: issue.evidence,
        keyExpression: issue.keyExpression,
        keyEvidence: issue.keyEvidence
    }));

    const resolvedOriginals = new Set(candidateIssues);
    const open = issues.filter(issue => !resolvedOriginals.has(issue));

    return {
        open,
        resolved
    };
}
