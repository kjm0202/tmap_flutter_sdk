// Multiple feature collectors may observe different parts of one contract.
// Keep every observation group; a later collector must not replace prior proof.
export function boundedObservationGroups(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function mergeBoundedObservations(...collections) {
  const merged = {};
  for (const collection of collections) {
    for (const [contract, observation] of Object.entries(collection)) {
      merged[contract] = Object.hasOwn(merged, contract)
        ? [...boundedObservationGroups(merged[contract]), ...boundedObservationGroups(observation)]
        : observation;
    }
  }
  return merged;
}

// Retains the existing cases metric. Event phases and callbacks are reported
// separately; this is neither a full API count nor a semantic verification count.
export function countBoundedCases(observations) {
  return Object.values(observations).flatMap(boundedObservationGroups).reduce(
    (total, group) => total + Object.values(group.platforms || {}).reduce(
      (n, platform) => n + (platform.cases?.length || 0), 0), 0);
}
