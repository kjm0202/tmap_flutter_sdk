import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { currentNativeAdapterEvidence } from './native_adapter_current_scope.mjs';
import { readLegacyAdapterBindings } from './legacy_native_adapter_sources.mjs';
import { ROOT } from './common.mjs';

export function reviewLegacyNativeAdapters({ issues, manifest, runtime, dart, libFingerprint, root = ROOT }) {
    const currentEvidence = currentNativeAdapterEvidence({ manifest, runtime, dart, libFingerprint, root });
    const descriptors = readLegacyAdapterBindings(root);
    const resolved = [];
    const open = [];

    if (!currentEvidence) {
        return { open: issues, resolved: [] };
    }

    for (const issue of issues) {
        if (issues.filter(other => other.code === issue.code).length !== 1) { open.push(issue); continue; }
        let matched = false;
        for (const d of descriptors) {
            if (issue.code !== d.code) continue;

            if (!isDeepStrictEqual(issue, { code: d.code, reason: d.reportedReason })) continue;

            if (!currentEvidence.absentAdapterNames.includes(d.nativeClass)) continue;

            const filesToCheck = [
                d.nativeClassFile,
                'lib/src/controller/sdk_native_event_commands.dart',
                ...d.scenarios.map(x => x.path)
            ];

            const exists = filesToCheck.some(p => fs.existsSync(path.join(root, p)) || Object.hasOwn(libFingerprint.files, p));
            if (exists) continue;

            matched = true;
            resolved.push({
                original: issue,
                backupCommit: d.backupCommit,
                status: 'HISTORICAL_ADAPTER_RECEIPT_INAPPLICABLE',
                scope: 'Historical fixture requiring a typed Flutter adapter absent from release and current source; this disposition affects only that receipt.',
                evidence: {
                    ...currentEvidence,
                    nativeClass: d.nativeClass,
                    collector: d.collector,
                    collectorSha256: d.collectorSha256,
                    scenarios: d.scenarios,
                    backupSourceBlobIds: d.backupSourceBlobIds
                }
            });
            break;
        }
        if (!matched) {
            open.push(issue);
        }
    }

    return { open, resolved };
}
