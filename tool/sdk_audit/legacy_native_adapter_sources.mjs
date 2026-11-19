import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { ROOT } from "./common.mjs";
import { verifiedNativeAdapterArchive } from "./legacy_native_adapter_archive.mjs";

export function readLegacyAdapterBindings(root = ROOT) {
  const archive = verifiedNativeAdapterArchive(root);
  if (!archive) return [];
  const { fixture, prior, blobIds } = archive;

  return fixture.descriptors.map(d => {
    try {
        const issuesWithSameCode = prior.issues.filter(i => i.code === d.code);
        if (issuesWithSameCode.length !== 1) throw new Error(`Non-unique or missing prior issue for ${d.code}`);
        const priorIssue = issuesWithSameCode[0];
        if (priorIssue.file !== d.collector || priorIssue.fileSha256 !== d.collectorSha256 || priorIssue.reportedReason !== d.reportedReason) {
            throw new Error(`Prior issue field mismatch for ${d.code}`);
        }

        const collectorPath = path.join(root, d.collector);
        const collectorBytes = fs.readFileSync(collectorPath);
        const collectorSha256 = crypto.createHash('sha256').update(collectorBytes).digest('hex');
        if (collectorSha256 !== d.collectorSha256) throw new Error("Collector mismatch");
        const collectorContent = collectorBytes.toString();
        if (!collectorContent.includes(prior.oldBaseline)) throw new Error("Manifest missing baseline");
        if (!collectorContent.includes(d.code)) throw new Error("Manifest missing code literal");

        const scenarios = d.scenarios.map((s) => {
            const scenarioPath = s.path;
            if (!priorIssue.pathLiteralLineNumbers[scenarioPath]) throw new Error(`Scenario path missing in prior: ${scenarioPath}`);

            const scenarioContent = fixture.backupFiles[scenarioPath];
            if (!scenarioContent.includes(s.controllerEntryLine)) throw new Error("controllerEntryLine missing");
            if (!scenarioContent.includes(s.adaptedTypeInvocationLine)) throw new Error("adaptedTypeInvocationLine missing");

            if (!s.controllerEntryLine.includes('controller.sdkEvents')) throw new Error("controllerEntryLine missing sdkEvents");

            if (d.nativeClass === 'SdkNativeEvents') {
                if (!s.methods || !Array.isArray(s.methods) || s.methods.length === 0) throw new Error("s.methods missing or empty");

                const isAlias = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s.receiver) && s.controllerEntryLine === `final ${s.receiver} = controller.sdkEvents;`;
                const isDirect = s.receiver === 'controller.sdkEvents' && s.controllerEntryLine === s.methods[0].invocationLine;
                if (!isAlias && !isDirect) throw new Error("Invalid receiver");

                s.methods.forEach(m => {
                    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(m.name)) throw new Error("Invalid method name");

                    const trimmedInvocation = m.invocationLine.trim();
                    if (!scenarioContent.split(/\r?\n/).some(line => line.trim() === trimmedInvocation)) throw new Error(`Invocation line missing: ${trimmedInvocation}`);
                    if (!trimmedInvocation.includes(`${s.receiver}.${m.name}(`)) throw new Error("Invocation mismatch");

                    const trimmedDeclaration = m.declarationLine.trim();
                    const nativeClassContent = fixture.backupFiles[d.nativeClassFile];
                    if (!nativeClassContent || !nativeClassContent.split(/\r?\n/).some(line => line.trim() === trimmedDeclaration)) throw new Error(`Declaration line missing: ${trimmedDeclaration}`);
                    if (!trimmedDeclaration.includes(`${m.name}(`)) throw new Error("Declaration mismatch");
                });

                if (s.adaptedTypeInvocationLine !== s.methods[0].invocationLine) throw new Error("adaptedTypeInvocationLine mismatch");
            } else {
                if (!s.adaptedTypeInvocationLine.includes(d.nativeClass + '.')) throw new Error("adaptedTypeInvocationLine missing nativeClass");
            }

            return { ...s, id: s.path };
        });

        const nativeClassContent = fixture.backupFiles[d.nativeClassFile];
        if (!nativeClassContent || !nativeClassContent.includes('class ' + d.nativeClass)) throw new Error("nativeClass token missing");

        const scenarioPaths = scenarios.map(s => s.path);
        const backupSourceBlobIds = Object.fromEntries(
            [fixture.entryImplementation, d.nativeClassFile, ...scenarioPaths].map(p => [p, blobIds[p]])
        );

        return {
            ...d,
            scenarios,
            backupCommit: fixture.historicalCommit,
            backupSourceBlobIds
        };
    } catch (e) {
        return null;
    }
  }).filter(Boolean);
}
