import { isDeepStrictEqual } from 'node:util';

export function exactGenericAbsence(runtime, target) {
  const kind = target.id.split('.')[0];
  const adapterId = target.id;

  // Find exactly one matching object in runtime.bridgeObservations by id
  const matches = runtime.bridgeObservations.filter(obs => obs.id === adapterId);
  if (matches.length !== 1) {
    return null;
  }
  const actual = matches[0];

  // Define EXPECTED object
  let expected = {
    id: adapterId,
    contract: target.contract,
    environment: 'chrome-extension-bridge',
    status: 'unresolved-unavailable-wrapper',
    wrapper: 'generic extension dispatch',
    comparison: 'unmeasured',
    scope: `Historical generic-adapter comparisons for ${kind} were not run. The current bridges.dart emitter does not provide an extension handler; the conditional path only supports an externally supplied historical handler; direct public bridge paths are evaluated independently.`
  };

  // Special case for Drawing.pointer
  if (adapterId === 'Drawing.pointer.generic-adapter') {
    expected.environment = 'chrome-real-mouse';
    expected.scope = 'Pointer comparisons through the generic adapter were not run; this does not establish absence of a public drawing API.';
  }

  // Check key count and deep strict equality (all 7 properties, no extra keys)
  const actualKeys = Object.keys(actual);
  if (actualKeys.length !== 7) {
    return null;
  }

  if (isDeepStrictEqual(actual, expected)) {
    return actual;
  }

  return null;
}
