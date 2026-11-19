// Executed in Chrome after the pinned SDK map reaches ConfigLoad.
// This observes one SDK call; it is not a Flutter or device parity check.
export async function probeMapSourceContracts() {
  const map = window.__auditMap;
  const observation = {
    id: 'map-source:getScale',
    contract: 'Tmapv3.Map#getScale',
    environment: 'chrome-pinned-sdk',
  };

  if (map == null) {
    return [{ ...observation, status: 'unavailable', reason: 'map missing' }];
  }

  // Inspect descriptors without evaluating accessors or serializing map data.
  const inspect = (object, key) => {
    if (object == null) return { exists: false, own: false };
    const own = Object.getOwnPropertyDescriptor(object, key);
    let holder = object;
    let descriptor = own;
    while (!descriptor && (holder = Object.getPrototypeOf(holder))) {
      descriptor = Object.getOwnPropertyDescriptor(holder, key);
    }
    if (!descriptor) return { exists: false, own: false };
    return {
      exists: true,
      own: Boolean(own),
      kind: 'value' in descriptor ? 'data' : 'accessor',
      valueType: 'value' in descriptor ? typeof descriptor.value : null,
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      ...('writable' in descriptor ? { writable: descriptor.writable } : {}),
      ...(!('value' in descriptor)
        ? { hasGetter: !!descriptor.get, hasSetter: !!descriptor.set }
        : {}),
    };
  };
  const snapshot = () => {
    const dataDescriptor = Object.getOwnPropertyDescriptor(map, '_data');
    const data = dataDescriptor && 'value' in dataDescriptor
      ? dataDescriptor.value
      : undefined;
    return {
      mapData: inspect(map, '_data'),
      mapTileLayerMain: inspect(data, 'mapTileLayerMain'),
      getScale: inspect(map, 'getScale'),
    };
  };

  const before = snapshot();
  let outcome;
  try {
    const value = map.getScale();
    const serializableValue =
      typeof value === 'number' && !Number.isFinite(value)
        ? String(value)
        : value === null || ['number', 'string', 'boolean'].includes(typeof value)
          ? value
          : null;
    outcome = {
      status: 'observed',
      valueType: typeof value,
      value: serializableValue,
    };
  } catch (error) {
    outcome = {
      status: 'threw',
      errorName: error?.name ?? 'Error',
      error: String(error),
    };
  }
  return [{ ...observation, ...outcome, before, after: snapshot() }];
}
