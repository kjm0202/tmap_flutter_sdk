import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

export function reviewProjectionInitialization(manifest, issues, receiptBytes=undefined) {
    if (!Array.isArray(manifest?.sources) || !Array.isArray(issues)) return [];
    const dataPath = fileURLToPath(new URL('../../docs/sdk-audit/checkpoints/2026-11-19/projection-initialization.json.gz', import.meta.url));
    let compressedBytes;
    try {
        compressedBytes = receiptBytes ?? readFileSync(dataPath);
    } catch (e) {
        return [];
    }

    const expectedHash = '54980f72c4c4f37251d3f332472471e3f7c2df6ebb50d78237ef56a3f20e82b1';
    const hash = createHash('sha256').update(compressedBytes).digest('hex');
    if (hash !== expectedHash) {
        return [];
    }

    const decompressed = gunzipSync(compressedBytes);
    const data = JSON.parse(decompressed.toString());

    const sourceEntries = manifest.sources.filter(s => s.kind === 'sdk' && s.role === 'flutter-web-fixed-cdn-versioned-core');
    if (sourceEntries.length !== 1) return [];
    
    const entry = sourceEntries[0];
    if (entry.sha256 !== data.scriptSourceSha256 || entry.url !== data.source) return [];

    const pinnedCore = data.scriptSourceSha256;
    const results = [];

    if (data.items.length !== 39) return [];

    // Tracking seen issues to ensure uniqueness across items
    const seenIssues = new Set();

    for (const item of data.items) {
        const keyExpression = 'M.' + item.enum + '.' + item.key;
        const keyEvidenceStart = item.start + ('this.' + item.table + '[').length;
        const keyEvidenceEnd = keyEvidenceStart + keyExpression.length;

        const matchingIssues = issues.filter(issue => {
            return issue.code === 'dynamic-property-write' &&
                   issue.owner === 'Tmapv3.util.Projection' &&
                   issue.receiver === 'this.' + item.table &&
                   issue.evidence?.source === data.source &&
                   issue.evidence?.sha256 === pinnedCore &&
                   issue.evidence?.start === item.start &&
                   issue.evidence?.end === item.end &&
                   issue.keyExpression === keyExpression &&
                   issue.keyEvidence?.source === data.source &&
                   issue.keyEvidence?.sha256 === pinnedCore &&
                   issue.keyEvidence?.start === keyEvidenceStart &&
                   issue.keyEvidence?.end === keyEvidenceEnd;
        });

        if (matchingIssues.length !== 1) return [];
        
        const issue = matchingIssues[0];
        if (seenIssues.has(issue)) return []; // Duplicate issue usage
        seenIssues.add(issue);
        
        if (item.value !== item.actualValue || !Number.isInteger(item.numericIndex)) {
            return [];
        }

        results.push({
            issue: issue,
            observation: item,
            receiptSha256: expectedHash
        });
    }

    return results;
}
