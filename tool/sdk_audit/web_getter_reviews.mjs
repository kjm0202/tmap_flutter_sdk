import { webGetterSourceEvidence } from "./web_getter_source_evidence.mjs";
import { isDeepStrictEqual } from 'node:util';

export function reviewAbsentWebGetters({issues, manifest, runtime, libFingerprint, bridgeFingerprint}) {
  const defaultResult = { open: issues, resolved: [] };
  const sourceEvidence = webGetterSourceEvidence({manifest, runtime, libFingerprint, bridgeFingerprint});

  if (!sourceEvidence) {
    return defaultResult;
  }

  const names = ['getZoom', 'getMinZoom', 'getMaxZoom', 'getPitch', 'getBearing', 'getCenter'];
  let openIssues = [...issues];
  const resolved = [];

  for (const name of names) {
    const id = `web.${name}`;
    const candidateIssues = openIssues.filter(i => i.id === id);
    if (candidateIssues.length !== 1) continue;
    const candidateIssue = candidateIssues[0];

    const runtimeIssues = (runtime.issues || []).filter(i => i.id === id);
    if (runtimeIssues.length !== 1) continue;
    const runtimeIssue = runtimeIssues[0];

    const target = { code: 'bridge-component-check-failed', id: id, status: 'unresolved-unavailable-wrapper' };
    if (!isDeepStrictEqual(candidateIssue, target) || !isDeepStrictEqual(runtimeIssue, target)) continue;

    const observations = (runtime.bridgeObservations || []).filter(o => o.id === `web.${name}`);
    if (observations.length !== 1) continue;
    const observation = observations[0];

    const allowedKeys = ['id', 'contract', 'environment', 'wrapper', 'comparison', 'status', 'expected'];
    const keys = Object.keys(observation);
    if (observation.status !== 'unresolved-unavailable-wrapper' ||
        keys.length !== allowedKeys.length ||
        !keys.every(key => allowedKeys.includes(key)) ||
        observation.id !== `web.${name}` ||
        observation.contract !== `Tmapv3.Map#${name}` ||
        observation.environment !== 'chrome-web-bridge' ||
        observation.wrapper !== `tmap_${name}` ||
        observation.comparison !== 'direct-sdk-reference') {
        continue;
    }

    const exp = observation.expected;
    let isValidExpected = false;
    if (name === 'getCenter') {
        if (exp && typeof exp === 'object' && Object.keys(exp).length === 2 && typeof exp.latitude === 'number' && typeof exp.longitude === 'number' && Number.isFinite(exp.latitude) && Number.isFinite(exp.longitude)) {
            isValidExpected = true;
        }
    } else {
        if (typeof exp === 'number' && Number.isFinite(exp)) {
            isValidExpected = true;
        }
    }

    if (!isValidExpected) continue;

    openIssues = openIssues.filter(i => i !== candidateIssue);
    resolved.push({
      status: 'REVIEWED_OBSOLETE_AUDIT_TARGET',
      scope: name,
      rationale: `source-backed absence of the historical named getter in published/current Web bridge; official SDK getter and Dart callback paths remain open independently.`,
      original: candidateIssue,
      evidence: {
        ...sourceEvidence,
        observation: observation
      }
    });
  }

  return { open: openIssues, resolved };
}
