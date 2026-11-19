import { webGetterSourceEvidence } from "./web_getter_source_evidence.mjs";
import { mobileGetterSourceEvidence } from "./mobile_getter_source_evidence.mjs";
import { isDeepStrictEqual } from 'node:util';

export function reviewAdditionalBridgeTargets({issues, manifest, runtime, libFingerprint, bridgeFingerprint}) {
  const defaultResult = { open: issues, resolved: [] };
  const webEvidence = webGetterSourceEvidence({manifest, runtime, libFingerprint, bridgeFingerprint});
  const mobileEvidence = mobileGetterSourceEvidence({manifest, runtime, libFingerprint, bridgeFingerprint});

  if (!webEvidence) {
    return defaultResult;
  }

  let openIssues = [...issues];
  const resolved = [];

  // Targets
  const targets = [
      { id: 'web.realToScreen', name: 'realToScreen', env: 'chrome-web-bridge', wrapper: 'tmap_realToScreen', contract: 'Tmapv3.Map#realToScreen' },
      { id: 'mobile-helper.getZoom', name: 'getZoom', env: 'chrome-mobile-js-helper', wrapper: 'getZoomData', contract: 'Tmapv3.Map#getZoom' },
      { id: 'mobile-helper.getMinZoom', name: 'getMinZoom', env: 'chrome-mobile-js-helper', wrapper: 'getMinZoomData', contract: 'Tmapv3.Map#getMinZoom' },
      { id: 'mobile-helper.getMaxZoom', name: 'getMaxZoom', env: 'chrome-mobile-js-helper', wrapper: 'getMaxZoomData', contract: 'Tmapv3.Map#getMaxZoom' },
      { id: 'mobile-helper.getPitch', name: 'getPitch', env: 'chrome-mobile-js-helper', wrapper: 'getPitchData', contract: 'Tmapv3.Map#getPitch' },
      { id: 'mobile-helper.getBearing', name: 'getBearing', env: 'chrome-mobile-js-helper', wrapper: 'getBearingData', contract: 'Tmapv3.Map#getBearing' },
      { id: 'mobile-helper.getCenter', name: 'getCenter', env: 'chrome-mobile-js-helper', wrapper: 'getCenterData', contract: 'Tmapv3.Map#getCenter' },
  ];

  for (const target of targets) {
    const candidateIssues = openIssues.filter(i => i.id === target.id);
    if (candidateIssues.length !== 1) continue;
    const candidateIssue = candidateIssues[0];

    const runtimeIssues = (runtime.issues || []).filter(i => i.id === target.id);
    if (runtimeIssues.length !== 1) continue;
    const runtimeIssue = runtimeIssues[0];

    const targetIssue = { code: 'bridge-component-check-failed', id: target.id, status: 'unresolved-unavailable-wrapper' };
    if (!isDeepStrictEqual(candidateIssue, targetIssue) || !isDeepStrictEqual(runtimeIssue, targetIssue)) continue;

    if (!target.id.startsWith('web.') && !mobileEvidence) continue;

    const observations = (runtime.bridgeObservations || []).filter(o => o.id === target.id);
    if (observations.length !== 1) continue;
    const observation = observations[0];

    // Exactly 7 fields: id, contract, environment, wrapper, comparison, status, expected
    const allowedKeys = ['id', 'contract', 'environment', 'wrapper', 'comparison', 'status', 'expected'];
    const keys = Object.keys(observation);
    if (observation.status !== 'unresolved-unavailable-wrapper' ||
        keys.length !== allowedKeys.length ||
        !keys.every(key => allowedKeys.includes(key)) ||
        observation.id !== target.id ||
        observation.contract !== target.contract ||
        observation.environment !== target.env ||
        observation.wrapper !== target.wrapper ||
        observation.comparison !== 'direct-sdk-reference') {
        continue;
    }

    const exp = observation.expected;
    let isValidExpected = false;

    if (target.id === 'web.realToScreen') {
        if (exp && typeof exp === 'object' && Object.keys(exp).length === 2 && typeof exp.x === 'number' && typeof exp.y === 'number' && Number.isFinite(exp.x) && Number.isFinite(exp.y)) {
            isValidExpected = true;
        }
    } else if (target.id === 'mobile-helper.getCenter') {
        if (exp && typeof exp === 'object' && Object.keys(exp).length === 2 && typeof exp.latitude === 'number' && typeof exp.longitude === 'number' && Number.isFinite(exp.latitude) && Number.isFinite(exp.longitude)) {
            isValidExpected = true;
        }
    } else {
        const mapping = {getZoom:'zoom',getMinZoom:'minZoom',getMaxZoom:'maxZoom',getPitch:'pitch',getBearing:'bearing'};
        const key = mapping[target.name];

        if (key && exp && typeof exp === 'object' && !Array.isArray(exp)) {
            if (target.name === 'getBearing' && isDeepStrictEqual(exp, {bearing:{special:'-0'},__tmapCameraNumberTag:true})) {
                isValidExpected = true;
            } else if (isDeepStrictEqual(exp, {[key]: exp?.[key]}) && Number.isFinite(exp?.[key])) {
                isValidExpected = true;
            }
        }
    }

    if (!isValidExpected) continue;

    openIssues = openIssues.filter(i => i !== candidateIssue);
    resolved.push({
      status: 'REVIEWED_OBSOLETE_AUDIT_TARGET',
      rationale: `Vetted bridge target absence: ${target.id}. Wrapper ${target.wrapper} unavailable in ${target.env} for contract ${target.contract}.`,
      scope: target.id,
      original: candidateIssue,
      evidence: { ...webEvidence, ...(target.id.startsWith('mobile-helper.') ? mobileEvidence : {}), observation }
    });
  }

  return { open: openIssues, resolved };
}
