import { isDeepStrictEqual } from 'util';
import { verifiedCoreReceipt } from './xml_dictionary_review.mjs';

const RECEIPT_SHA256 = '5f62c8020320f7abf7bb45b378c82ea90ebefe3a958a3caf386f1d97174d5a54';
// Only the setRequestHeader this._headers write and the parseStyles this._styles write. The KML StyleMap
// branch and every other dynamic site stay open. Owner/source ID pairs are as measured in the pinned receipt.
const SITES = [
    { owner: 'Tmapv3.network.HttpRequest', id: 'Tmapv3.network.HttpRequest.XMLHttpRequest' },
    { owner: 'Tmapv3.extension.KML', id: 'Tmapv3.extension.KML#parseStyles' }
];

export const sameSite = (a, b) => a.code === b.code && a.owner === b.owner &&
    a.evidence?.sha256 === b.evidence?.sha256 && a.evidence?.start === b.evidence?.start && a.evidence?.end === b.evidence?.end;

export function reviewRequestHeaderAndKmlStyleWrites({issues, manifest, sources, ast, runtime}) {
    const unchanged = { open: issues, resolved: [] };
    if (!manifest || !runtime || !Array.isArray(issues) || !Array.isArray(sources) ||
        !Array.isArray(manifest.sources) || !Array.isArray(ast?.rows) ||
        !Array.isArray(runtime.rows) || !Array.isArray(runtime.networkScripts)) {
        return unchanged;
    }

    const verified = verifiedCoreReceipt({manifest, sources, runtime}, 'request-headers-and-kml-style-dictionaries.json.gz', RECEIPT_SHA256);
    if (!verified) {
        return unchanged;
    }
    const { receipt, digests } = verified;
    if (receipt.issues?.length !== 2 || receipt.samples?.length !== 2 ||
        !Array.isArray(receipt.ast) || !Array.isArray(receipt.runtime)) {
        return unchanged;
    }

    // Both samples are the verified core texts, each measured owner has exactly one receipt site, and each
    // source ID has exactly one AST row and three runtime phase rows.
    if (!isDeepStrictEqual(receipt.samples.map(s => s.core).sort(), [...digests].sort()) ||
        !receipt.issues.every(i => digests.includes(i.evidence?.sha256)) ||
        !SITES.every(({owner}) => receipt.issues.filter(i => i.owner === owner).length === 1) ||
        !SITES.every(({id}) => receipt.ast.filter(r => r.id === id).length === 1 &&
            receipt.runtime.filter(r => r.id === id).length === 3)) {
        return unchanged;
    }

    const ids = new Set(receipt.ast.map(r => r.id));
    if (!isDeepStrictEqual(ast.rows.filter(r => ids.has(r.id)), receipt.ast) ||
        !isDeepStrictEqual(runtime.rows.filter(r => ids.has(r.id)), receipt.runtime)) {
        return unchanged;
    }

    // Exactly one complete original diagnostic per site; otherwise neither site is resolved.
    const sites = receipt.issues.map(expected => issues.filter(i => sameSite(i, expected)));
    if (!sites.every((site, k) => site.length === 1 && isDeepStrictEqual(site[0], receipt.issues[k]))) {
        return unchanged;
    }

    const originals = new Set(sites.flat());
    return {
        open: issues.filter(issue => !originals.has(issue)),
        resolved: [...originals].map(issue => ({
            status: 'RESOLVED_DIAGNOSTIC',
            original: issue,
            receiptHash: RECEIPT_SHA256,
            scope: receipt.scope,
            rationale: 'instance-owned request-header and parsed KML style dictionaries observed at the exact assignments; no public SDK member registration',
            evidence: issue.evidence,
            keyExpression: issue.keyExpression,
            keyEvidence: issue.keyEvidence
        }))
    };
}
