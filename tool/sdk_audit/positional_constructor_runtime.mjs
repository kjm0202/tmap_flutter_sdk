export function positionalConstructorRuntimeEvidence(
  runtime,
  owner,
  sdkSha256,
  manifest,
) {
  if (
    !runtime ||
    !Array.isArray(runtime.networkScripts) ||
    !runtime.aliases ||
    !Array.isArray(runtime.instances) ||
    !Array.isArray(runtime.observations) ||
    runtime.auth !== "script-executed"
  ) {
    return null;
  }

  // Validate manifest and runtime.verifiedBootstrapDigest
  const officialBootstrapUrl =
    "https://apis.openapi.sk.com/tmap/vectorjs?version=1";
  const bootstrapDigest =
    "784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e";

  if (runtime.verifiedBootstrapDigest !== bootstrapDigest) return null;

  const bootstrapSources =
    manifest?.sources?.filter(
      (s) => s.role === "official-key-authenticated-bootstrap",
    ) || [];

  if (bootstrapSources.length !== 1) return null;
  const bSource = bootstrapSources[0];

  if (
    bSource.url !== officialBootstrapUrl ||
    bSource.kind !== "sdk-script" ||
    bSource.sha256 !== bootstrapDigest
  ) {
    return null;
  }

  // Require explicit owner enum
  const validOwners = ["Tmapv3.base.Point", "Tmapv3.base.LatLng"];
  if (!validOwners.includes(owner)) return null;

  // 1. Validate networkScripts
  const pinnedCoreScripts = runtime.networkScripts.filter(
    (s) => s.classification === "pinned-core",
  );
  if (pinnedCoreScripts.length !== 1) return null;

  const script = pinnedCoreScripts[0];
  const officialUrls = [
    "https://topopentile1.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206",
    "https://topopentile2.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206",
    "https://topopentile3.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206",
  ];
  if (!officialUrls.includes(script.url)) return null;

  // Validate manifest source pin
  const manifestAtUrl = manifest.sources.filter((s) => s.url === script.url);
  if (manifestAtUrl.length !== 1) return null;

  const manifestPin = manifestAtUrl[0];
  if (
    manifestPin.role !== "bootstrap-cdn-versioned-core" ||
    manifestPin.kind !== "bootstrap-cdn-versioned-core" ||
    manifestPin.sha256 !== sdkSha256 ||
    manifestPin.bytes !== 1281499
  ) {
    return null;
  }

  if (
    script.sha256 !== sdkSha256 ||
    script.status !== 200 ||
    script.pinned !== true ||
    script.bytes !== 1281499
  ) {
    return null;
  }

  // 2. Validate Aliases
  const pub = owner.replace(".base", "");
  if (runtime.aliases[pub] !== owner) return null;

  // 3. Validate Instances
  const pubInstances = runtime.instances.filter((i) => i.name === pub);
  if (pubInstances.length !== 1 || pubInstances[0].status !== "constructed")
    return null;

  // 4. Validate Observations
  const isLatLng = owner.includes("LatLng");
  const expectedIds = isLatLng
    ? ["latlng.lat", "latlng.lng"]
    : ["point.getX", "point.getY"];
  const expectedPair = isLatLng ? [37.5665, 126.978] : [1.25, -2.5];
  const expectedValues = isLatLng
    ? { "latlng.lat": 37.5665, "latlng.lng": 126.978 }
    : { "point.getX": 1.25, "point.getY": -2.5 };

  const matchedObservations = [];
  for (const id of expectedIds) {
    const obs = runtime.observations.filter((o) => o.id === id);
    if (obs.length !== 1) return null;
    const o = obs[0];

    // Literal exact numeric expectations
    if (o.value !== expectedValues[id]) return null;

    // Exact pair expectations for before AND after
    if (
      JSON.stringify(o.before) !== JSON.stringify(expectedPair) ||
      JSON.stringify(o.after) !== JSON.stringify(expectedPair)
    ) {
      return null;
    }

    if (o.status !== "observed") return null;

    matchedObservations.push(o);
  }

  // 5. Return evidence
  return {
    observations: matchedObservations.map((o) => ({
      id: o.id,
      value: o.value,
      before: o.before,
      after: o.after,
    })),
    source: {
      url: script.url,
      sha256: script.sha256,
    },
  };
}
