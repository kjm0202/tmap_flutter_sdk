import {reviewRestDocuments} from './rest_document_review.mjs';
import {positionalConstructorDispositions, requiresPositionalConstructorEvidence} from './positional_constructor_dispositions.mjs';
import {reviewProjectionInitialization} from './projection_initialization_review.mjs';
import {reviewXmlNamespaceWrites} from './xml_dictionary_review.mjs';
import {reviewRequestHeaderAndKmlStyleWrites} from './request_kml_dictionary_review.mjs';
import {documentIdentityDispositions, requiresDocumentIdentityEvidence} from './document_identity_dispositions.mjs';
import {documentSourceDispositions, requiresDocumentSourceEvidence} from './document_source_dispositions.mjs';
import {collectMapLongTapCoexistenceObservations} from './map_longtap_coexistence_verification.mjs';
import {collectTrustedLongTapObservations} from './map_trusted_longtap_verification.mjs';
import {collectTDataRequestE2eObservations} from './tdata_request_e2e_observations.mjs';
import {collectNativePostDisposeObservations} from './native_post_dispose_verification.mjs';
import {collectNativeLateHandleDeliveryObservations} from './native_late_handle_delivery_verification.mjs';
import {collectTDataResponseFailureObservations,collectTDataRawQueryGuardObservations,collectTDataFixedSnapshotGuardObservations,collectTDataResponseCloseObservations} from './tdata_next_adapter_observations.mjs';
import {collectTDataCallbackRelationObservations} from './tdata_callback_relation_verification.mjs';
import {collectTDataCallbackSetupRollbackObservations} from './tdata_callback_setup_rollback_observations.mjs';
import {collectSdkNativeEnvironmentObservations} from './sdk_native_environment_observations.mjs';
import {collectSdkNativeEnvironmentRelation} from './sdk_native_environment_relation_verification.mjs';
import {collectSdkVsmErrorBoundaryObservations} from './sdk_vsm_error_boundary_observations.mjs';
import {collectTDataClientFactoryClassificationObservations} from './tdata_client_factory_classification_observations.mjs';
import {collectSdkStandaloneNativeObservations} from './sdk_standalone_native_observations.mjs';
import {collectTDataClientFactoryCloseObservations} from './tdata_client_factory_close_observations.mjs';
import {collectTDataPoiCoordinatePresenceObservations} from './tdata_poi_coordinate_presence_observations.mjs';
import {collectSdkHeatmapFailureObservations} from './sdk_heatmap_failure_observations.mjs';
import {collectSdkCameraNumberObservations} from './sdk_camera_number_observations.mjs';
import {collectTDataScalarNumberObservations} from './tdata_scalar_number_observations.mjs';
import {collectMapEventRelations} from './map_event_relations_verification.mjs';
import {collectSdkRawThrownValueObservations} from './sdk_raw_thrown_value_verification.mjs';
import {collectSdkGeoJsonDrawObservations} from './sdk_geojson_draw_observations.mjs';
import {collectSdkNativeStartupObservations} from './sdk_native_startup_verification.mjs';
import {collectSdkNativeStartupInvocationObservations} from './sdk_native_startup_invocation_verification.mjs';
import {collectSdkWrapperDetachObservations} from './sdk_wrapper_detach_verification.mjs';
import {collectTrustedMarkerTapObservations} from './trusted_marker_tap_verification.mjs';
import {collectNativeEventInvocationObservations} from './native_event_invocation_verification.mjs';
import {collectManagedMarkerEventsObservations} from './managed_marker_events_verification.mjs';
import {collectSdkUtilitiesNativeObservations} from './sdk_utilities_native_verification.mjs';
import {collectSdkHtmlNativeObservations} from './sdk_html_native_verification.mjs';
import {collectSdkVisualizationNativeObservations} from './sdk_visualization_native_verification.mjs';
import {collectSdkDrawingLifecycleObservations} from './sdk_drawing_lifecycle_verification.mjs';
import {collectSdkTDataNativeObservations} from './sdk_tdata_native_verification.mjs';
import {collectSdkTDataLifecycleObservations} from './sdk_tdata_lifecycle_verification.mjs';
import {collectNativeLifecycleObservations} from './native_lifecycle_observations.mjs';
import {collectTDataBytesCacheObservations} from './tdata_bytes_cache_observations.mjs';
import {collectNativeResourceObservations} from './native_resources_observations.mjs';
import {collectTDataPoiPageObservations} from './tdata_poi_page_observations.mjs';
import {collectTDataCoordinateResponseObservations} from './tdata_coordinate_response_observations.mjs';
import {collectTDataRouteGeometryObservations} from './tdata_route_geometry_observations.mjs';
import {collectTDataResponseCleanupObservations} from './tdata_response_cleanup_observations.mjs';
import {collectTDataFractionalTimeoutObservations} from './tdata_fractional_timeout_observations.mjs';
import {collectTDataTransportFailureObservations} from './tdata_transport_failure_observations.mjs';
import {collectSdkMapGeometryObservations} from './sdk_map_geometry_observations.mjs';
import {applySdkHtmlNativeContractProof,validSdkHtmlNativeContractProofs} from './html_native_contract_proof.mjs';
import {verifySdkHtmlNativeAdaptations} from './sdk_html_native_adaptation_verification.mjs';
import {applySdkUtilitiesNativeContractProof,validSdkUtilitiesNativeContractProofs} from './utilities_native_contract_proof.mjs';
import {verifySdkUtilitiesNativeAdaptations} from './sdk_utilities_native_adaptation_verification.mjs';
import {applySdkProjectionFacetContractProof,validSdkProjectionFacetContractProofs} from './projection_facet_contract_proof.mjs';
import {verifySdkProjectionFacetAdaptations} from './sdk_projection_facet_adaptation_verification.mjs';
import {applySdkNativeEnvironmentContractProof,validSdkNativeEnvironmentContractProofs} from './native_environment_contract_proof.mjs';
import {verifySdkNativeEnvironmentAdaptations} from './sdk_native_environment_adaptation_verification.mjs';
import {collectSdkMarkerClusterNativeObservations} from './sdk_marker_cluster_native_verification.mjs';
import {collectSdkDefaultPolicyObservations} from './sdk_default_policy_verification.mjs';
import {collectSdkDefaultPolicyTrustedObservations} from './sdk_default_policy_trusted_verification.mjs';
import {collectReverseAddressBoundaryObservations} from './tdata_reverse_address_boundary_verification.mjs';
import {collectSharedDebounceObservations} from './tdata_shared_debounce_verification.mjs';
import {collectOverlayLifecycleObservations} from './overlay_lifecycle_verification.mjs';
import {collectNativePromiseObservations} from './native_promise_verification.mjs';
import {collectSdkVsmControlsObservations} from './sdk_vsm_controls_native_verification.mjs';
import {collectSdkEventGettersObservations} from './sdk_event_getters_verification.mjs';
import {verifySdkEventGetterDomainAdaptations} from './sdk_event_getter_domain_strict_verification.mjs';
import {applySdkEventGetterContractProof,validSdkEventGetterContractProofs} from './sdk_event_getter_contract_proof.mjs';
import {collectSdkXmlKmlNativeObservations} from './sdk_xml_kml_native_verification.mjs';
import {collectSdkGeoJsonNativeObservations} from './sdk_geojson_native_verification.mjs';
import {collectTDataScalarCompatibilityObservations} from './tdata_scalar_compatibility_verification.mjs';
import {collectTDataResponseCallbackObservations} from './tdata_response_callback_verification.mjs';
import {verifyEventNameConstants} from './event_names_verification.mjs';
import {reviewedEventNamesAliases,canonicalEventNameId} from './event_names_aliases.mjs';
import {verifyBoundsDimensionsAdaptations,boundsDimensionsContracts} from './bounds_dimensions_verification.mjs';
import {verifyFiniteConstantAdaptations,validFiniteConstantAdaptations,finiteConstantContracts} from './finite_constants_verification.mjs';
import {attachDocumentationMismatches,validDocumentationMismatch} from './documentation_mismatches.mjs';
import {verifyNumericGetters} from './getter_verification.mjs';
import {verifyPointSetterAdaptations} from './point_setter_verification.mjs';
import {collectShapeSetterObservations} from './shape_observations.mjs';
import {collectSdkBoundsNativeObservations} from './sdk_bounds_native_verification.mjs';
import {collectMapEventSnapshotObservations} from './map_event_snapshot_verification.mjs';
import {collectSdkGeometryNativeObservations} from './sdk_geometry_native_verification.mjs';
import {collectMapControlLifecycleObservations} from './map_control_lifecycle_verification.mjs';
import {collectTDataGeofencingObservations} from './tdata_geofencing_verification.mjs';
import {collectSdkPlanarGeometryObservations} from './sdk_planar_geometry_verification.mjs';
import {collectMapDragProgressObservations} from './map_drag_progress_verification.mjs';
import {collectTDataSegmentedObservations} from './tdata_segmented_verification.mjs';
import {collectNativeSdkEventsObservations} from './native_sdk_events_verification.mjs';
import {collectSdkVsmMapObservations} from './sdk_vsm_map_verification.mjs';
import {collectTDataSessionObservations} from './tdata_session_verification.mjs';
import {collectTrustedInputObservations} from './trusted_input_verification.mjs';
import {boundedObservationGroups, mergeBoundedObservations, countBoundedCases} from './bounded_observations.mjs';
import {contractWorklist,validAdaptationProof} from './contracts.mjs';
import {reviewInternalState,validInternalReview} from './scope_reviews.mjs';
import {reviewReferenceOnly,validReferenceReview} from './reference_scope_reviews.mjs';
import {reviewCurrentReferences,currentReferenceValidator} from './current_reference_scope.mjs';
import { adjudicate, reviewedMemberAliases, reviewedStaticDispatchAliases } from "./resolutions.mjs";
import { reviewAbsentWebGetters } from './web_getter_reviews.mjs';
import { reviewAdditionalBridgeTargets } from './additional_bridge_reviews.mjs';
import { reviewGenericDispatch } from './generic_dispatch_reviews.mjs';
import { reviewRetiredTDataTargets } from './retired_tdata_targets.mjs';
import { reviewReleasedRouteGeometry } from './route_geometry_release_review.mjs';
import { reviewReleasedPoiCoordinate } from './poi_coordinate_release_review.mjs';
import { reviewResponseFailureReplay } from './response_failure_replay_review.mjs';
import { reviewLegacyNativeAdapters } from './legacy_native_adapter_reviews.mjs';
import { reviewRetiredMapEventSnapshotTarget } from './retired_map_event_snapshot_target.mjs';
import { reviewRetiredOverlayTargets } from './retired_overlay_targets.mjs';

import { counts, issue, sha } from "./common.mjs";
export function canonicalize(id, aliases) {
  const visited = new Set();
  let current = id;
  for (let n = 0; n < 50; n++) {
    if (visited.has(current)) return current;
    visited.add(current);
    const key = Object.keys(aliases)
      .filter(
        (a) =>
          current === a ||
          current.startsWith(a + "#") ||
          current.startsWith(a + ".") ||
          current.startsWith(a + "@") ||
          current.startsWith(a + "!") ||
          current.startsWith(a + "?") ||
          current.startsWith(a + ":") ||
          current.startsWith(a + "->"),
      )
      .sort((a, b) => b.length - a.length)[0];
    if (!key || aliases[key] === key) break;
    current = aliases[key] + current.slice(key.length);
  }
  return current;
}
export function compareObservations(cases, js, dart) {
  return cases.map((c) => {
    const a = js.find((r) => r.id === c.id),
      b = dart.find((r) => r.id === c.id);
    if (!a || !b)
      return { ...c, status: "unobserved", js: a ?? null, dart: b ?? null };
    const dimensions = [
      "status",
      "value",
      "before",
      "after",
      "sameIdentity",
      "returnedObject",
    ];
    const differences = dimensions.filter(
      (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
    );
    // Matching exceptions are not evidence of a functioning API.
    return {
      ...c,
      status:
        a.status !== "observed" || b.status !== "observed"
          ? "unresolved-exception"
          : differences.length
            ? "difference"
            : "sample-match",
      differences,
      js: a,
      dart: b,
    };
  });
}
export function reconcile({
  manifest,
  sources,
  docs,
  ast,
  runtime,
  dart,
  mappings,
  observations,
  libFingerprint,
  bridgeFingerprint,
}) {
  const aliases = {
    ...runtime.aliases,
    ...ast.aliases,
    ...mappings.documentAliases,
    ...reviewedMemberAliases(manifest,docs,ast,runtime,mappings),
    ...reviewedStaticDispatchAliases(manifest,docs,ast,runtime,mappings),
  };
  const exactEventNameAliases=reviewedEventNamesAliases(manifest,ast,runtime);
  const eventNamesRuntimeEvidence={eventNamesAliasEvidence:runtime.eventNamesAliasEvidence,networkScripts:runtime.networkScripts||[],rows:(runtime.rows||[]).filter(row=>row.phase==='loaded'&&(row.id==='Tmapv3.event.EventNames'||row.id.startsWith('Tmapv3.event.EventNames.'))),engine:{rows:(runtime.engine?.rows||[]).filter(row=>row.id==='Vsm.Map.EventNames'||row.id.startsWith('Vsm.Map.EventNames.'))}};
  const dependencies = docs.scriptReferences.map((d) => ({
    url: d.url.replace(/([?&]appkey=)[^&]*/gi, "$1[REDACTED]"),
    kind: /\/tmap\/vectorjs/.test(d.url)
      ? "authenticated-bootstrap"
      : /jquery|xss-filter|secure-random|mapscroll/.test(d.url)
        ? "documentation-ui-dependency"
        : "unclassified-script",
    evidence: d.evidence,
  }));
  let issues = [
    ...manifest.issues,
    ...docs.issues,
    ...ast.issues,
    ...runtime.issues,
    ...dart.issues,
  ];
  for (const dependency of dependencies)
    if (dependency.kind === "unclassified-script")
      issues.push(issue("unclassified-document-script", dependency));
  for (const dependency of ast.dependencies)
    issues.push(issue("unresolved-static-code-dependency", dependency));
  const registry = new Map();
  // Prototype descriptor containers are structural metadata; their members remain separate rows.
  const inputs = [
    ...docs.rows,
    ...ast.rows,
    ...runtime.rows.filter((r) => r.kind !== "prototype"),
    ...(runtime.engine?.rows || [])
      .filter((r) => r.kind !== "prototype")
      .map((r) => ({
        ...r,
        evidence: [
          {
            channel: "runtime-engine",
            source: manifest.sources.find((s) => s.kind === "sdk")?.url,
            sha256: manifest.sources.find((s) => s.kind === "sdk")?.sha256,
          },
        ],
      })),
  ];
  for (const input of inputs) {
    const id = canonicalize(canonicalEventNameId(input.id,exactEventNameAliases), aliases);
    const row = registry.get(id) || {
      id,
      kinds: [],
      channels: [],
      evidence: [],
      sourceNames: [],
      contracts: [],
      observations: [],
    };
    if (!row.kinds.includes(input.kind)) row.kinds.push(input.kind);
    if (!row.sourceNames.includes(input.id)) row.sourceNames.push(input.id);
    for (const e of input.evidence || []) {
      if (!row.channels.includes(e.channel)) row.channels.push(e.channel);
      const signature = JSON.stringify(e);
      if (!row.evidence.some((v) => JSON.stringify(v) === signature))
        row.evidence.push(e);
    }
    if (input.contract && !row.contracts.includes(input.contract))
      row.contracts.push(input.contract);
    registry.set(id, row);
  }
  const classIds = [
    ...new Set(
      [
        ...ast.classes,
        ...docs.rows.filter((r) => r.kind === "class").map((r) => r.id),
      ].map((id) => canonicalize(id, aliases)),
    ),
  ].sort((a, b) => b.length - a.length);
  for (const row of registry.values()) {
    const owner =
      classIds.find(
        (c) =>
          row.id === c ||
          ["#", ".", ":", "!", "@", "?"].some((sep) =>
            row.id.startsWith(c + sep),
          ),
      ) || null;
    row.owner = owner;
    row.scope = row.kinds.includes("reference-table")
      ? "linked-rest-reference"
      : row.id.startsWith("Vsm.")
        ? "engine-export-review-required"
        : row.channels.includes("docs")
          ? "documented"
          : row.channels.includes("example")
            ? "example-used"
            : "undocumented-review-required";
    const short = owner?.split(".").at(-1),
      owners = mappings.classCandidates[short] ?? (short ? [short] : []);
    const tail = owner ? row.id.slice(owner.length) : "";
    const member = tail.replace(/^[#.!@?]/, "").split(/[:.]/)[0];
    let candidates = [];
    const explicit = mappings.memberCandidates[row.id];
    if (explicit) candidates = dart.rows.filter((d) => explicit.includes(d.id));
    else if (!tail)
      candidates = dart.rows.filter(
        (d) => d.kind === "class" && owners.includes(d.id),
      );
    else if (tail === "#constructor")
      candidates = dart.rows.filter(
        (d) => d.kind === "constructor" && owners.includes(d.owner),
      );
    else if (tail.startsWith("#constructor:")) {
      const option = tail.slice("#constructor:".length);
      candidates = dart.rows.filter(
        (d) => owners.includes(d.owner) && d.name === option,
      );
    } else
      candidates = dart.rows.filter(
        (d) => owners.includes(d.owner) && d.name === member,
      );
    row.dartCandidates = candidates.map((d) => ({
      id: d.id,
      kind: d.kind,
      file: d.file,
      line: d.line,
      signature: d.signature,
      inheritedFrom: d.inheritedFrom,
    }));
    row.status = candidates.length ? "candidate-unverified" : "unmapped";
    row.platforms = { web: row.status, android: row.status, ios: row.status };
    row.requiredEvidence = [
      "input/options/defaults",
      "return/type",
      "mutation/identity",
      "errors",
      "lifecycle/events (if applicable)",
      "per-platform dispatch and runtime",
    ];
    const probes = observations.filter(
      (o) => canonicalize(o.contract, aliases) === row.id,
    );
    row.bridgeObservations = (runtime.bridgeObservations || [])
      .filter((o) => canonicalize(o.contract || "", aliases) === row.id)
      .map((o) => ({ id: o.id, status: o.status, environment: o.environment }));
    row.observations = probes.map((o) => ({ id: o.id, status: o.status }));
    if (probes.some((p) => p.status === "difference"))
      row.status = "observed-difference";
    else if (probes.some((p) => p.status === "unresolved-exception"))
      row.status = "unresolved-exception";
    else if (probes.some((p) => p.status === "sample-match"))
      row.status = "sample-observed-contract-open";
    if (row.id === "Tmapv3.Map#getDiv")
      row.platforms = {
        web: "candidate-unverified",
        android: "known-platform-difference",
        ios: "known-platform-difference",
      };
  }
  for (const instance of runtime.instances || []) {
    if (instance.status !== "constructed") continue;
    const owner = canonicalize(instance.name, aliases);
    for (const member of instance.ownMembers || []) {
      const id = owner + "@" + member.name;
      if (!registry.has(id))
        registry.set(id, {
          id,
          owner,
          kinds: ["instance-field"],
          channels: ["runtime-instance"],
          sourceNames: [id],
          contracts: [],
          observations: [],
          evidence: [
            {
              channel: "runtime-instance",
              phase: "after-construction",
              source: manifest.sources.find((s) => s.kind === "sdk")?.url,
              sha256: manifest.sources.find((s) => s.kind === "sdk")?.sha256,
            },
          ],
          scope: "undocumented-review-required",
          dartCandidates: [],
          status: "unmapped",
          platforms: { web: "unmapped", android: "unmapped", ios: "unmapped" },
        });
    }
  }
  // Factory registration, public classification and constructor execution are independent questions.
  for (const cls of ast.classes)
    if (
      !runtime.instances?.some(
        (i) =>
          canonicalize(i.name, aliases) === cls && i.status === "constructed",
      )
    )
      issues.push(issue("class-construction-unobserved", { id: cls }));
  const rows = [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
  const documented = rows.filter((r) => r.scope === "documented"),
    examplesOnly = rows.filter((r) => r.scope === "example-used");
  const crossCheck = {
    docsOnly: rows
      .filter(
        (r) =>
          r.channels.includes("docs") &&
          !r.channels.includes("ast") &&
          !r.channels.includes("runtime"),
      )
      .map((r) => r.id),
    astOnly: rows
      .filter(
        (r) =>
          r.channels.includes("ast") &&
          !r.channels.includes("docs") &&
          !r.channels.includes("runtime"),
      )
      .map((r) => r.id),
    runtimeOnly: rows
      .filter(
        (r) =>
          r.channels.includes("runtime") &&
          !r.channels.includes("docs") &&
          !r.channels.includes("ast"),
      )
      .map((r) => r.id),
  };
  const boundsDimensionsRuntimeEvidence={aliases:runtime.aliases,rows:(runtime.rows||[]).filter(row=>boundsDimensionsContracts.includes(row.id)&&row.phase==='loaded'),networkScripts:runtime.networkScripts||[]};
  const finiteConstantsRuntimeEvidence={rows:(runtime.rows||[]).filter(row=>finiteConstantContracts.includes(row.id)&&row.kind==='property'&&row.phase==='loaded'),networkScripts:runtime.networkScripts||[]};
  const getterProofs=[...verifyNumericGetters({rows,manifest,ast,dart,runtime,libFingerprint}),
    ...verifyPointSetterAdaptations({rows,manifest,ast,dart,docs,runtime,libFingerprint}),
    ...verifyBoundsDimensionsAdaptations({rows,manifest,runtime,libFingerprint}),
    ...verifyEventNameConstants({rows,manifest,ast,dart,runtime,libFingerprint}),
    ...verifyFiniteConstantAdaptations({rows,manifest,ast,dart,runtime,libFingerprint}),
    ...applySdkEventGetterContractProof({rows,manifest,runtime,libFingerprint}),
    ...applySdkHtmlNativeContractProof({rows,manifest,runtime,libFingerprint}),
    ...applySdkUtilitiesNativeContractProof({rows,manifest,runtime,libFingerprint}),
    ...applySdkProjectionFacetContractProof({rows,manifest,runtime,libFingerprint}),
    ...applySdkNativeEnvironmentContractProof({rows,manifest,runtime,libFingerprint})];
  const eventGetterDomainGate=verifySdkEventGetterDomainAdaptations({runtime,manifest,libFingerprint});
  issues.push(...eventGetterDomainGate.issues);
  const htmlNativeDomainGate=verifySdkHtmlNativeAdaptations({rows,runtime,manifest,libFingerprint});
  issues.push(...htmlNativeDomainGate.issues);
  const utilitiesNativeDomainGate=verifySdkUtilitiesNativeAdaptations({rows,runtime,manifest,libFingerprint});
  issues.push(...utilitiesNativeDomainGate.issues);
  const projectionFacetGate=verifySdkProjectionFacetAdaptations({rows,runtime,manifest,libFingerprint});
  issues.push(...projectionFacetGate.issues);
  const nativeEnvironmentGate=verifySdkNativeEnvironmentAdaptations({rows,runtime,manifest,libFingerprint});
  issues.push(...nativeEnvironmentGate.issues);
  const boundedShape=collectShapeSetterObservations({runtime,manifest,libFingerprint});
  const boundedNativeBounds=collectSdkBoundsNativeObservations({runtime,manifest,libFingerprint});
  const boundedEvents=collectMapEventSnapshotObservations({runtime,manifest,libFingerprint});
  const boundedGeometry=collectSdkGeometryNativeObservations({runtime,manifest,libFingerprint});
  const boundedMapControl=collectMapControlLifecycleObservations({runtime,manifest,libFingerprint});
  const boundedGeofencing=collectTDataGeofencingObservations({runtime,manifest,libFingerprint});
  const boundedPlanar=collectSdkPlanarGeometryObservations({runtime,manifest,libFingerprint});
  const boundedDrag=collectMapDragProgressObservations({runtime,manifest,libFingerprint});
  const boundedSegmented=collectTDataSegmentedObservations({runtime,manifest,libFingerprint});
  const boundedNativeEvents=collectNativeSdkEventsObservations({runtime,manifest,libFingerprint});
  const boundedVsmMap=collectSdkVsmMapObservations({runtime,manifest,libFingerprint});
  const boundedTDataSession=collectTDataSessionObservations({runtime,manifest,libFingerprint});
  const boundedTrustedInput=collectTrustedInputObservations({runtime,manifest,libFingerprint});
  const boundedNativeStartup=collectSdkNativeStartupObservations({runtime,manifest,libFingerprint});
  const boundedDefaultPolicy=collectSdkDefaultPolicyObservations({runtime,manifest,libFingerprint});
  const boundedDefaultPolicyTrusted=collectSdkDefaultPolicyTrustedObservations({runtime,manifest,libFingerprint});
  const boundedReverseAddress=collectReverseAddressBoundaryObservations({runtime,manifest,libFingerprint});
  const boundedSharedDebounce=collectSharedDebounceObservations({runtime,manifest,libFingerprint});
  const boundedOverlayLifecycle=collectOverlayLifecycleObservations({runtime,manifest,libFingerprint});
  const boundedNativePromise=collectNativePromiseObservations({runtime,manifest,libFingerprint});
  const boundedVsmControls=collectSdkVsmControlsObservations({runtime,manifest,libFingerprint});
  const boundedEventGetters=collectSdkEventGettersObservations({runtime,manifest,libFingerprint});
  const boundedXmlKml=collectSdkXmlKmlNativeObservations({runtime,manifest,libFingerprint});
  const boundedGeoJson=collectSdkGeoJsonNativeObservations({runtime,manifest,libFingerprint});
  const boundedTDataScalar=collectTDataScalarCompatibilityObservations({runtime,manifest,libFingerprint});
  const boundedTDataResponseCallback=collectTDataResponseCallbackObservations({runtime,manifest,libFingerprint});
  const tdataBytesCache=collectTDataBytesCacheObservations({runtime,manifest,libFingerprint});
  issues.push(...tdataBytesCache.issues);
  const nativeResources=collectNativeResourceObservations({runtime,manifest,libFingerprint});
  issues.push(...nativeResources.issues);
  const tdataPoiPage=collectTDataPoiPageObservations({runtime,manifest,libFingerprint});
  issues.push(...tdataPoiPage.issues);
  const tdataCoordinateResponse=collectTDataCoordinateResponseObservations({runtime,manifest,libFingerprint});
  issues.push(...tdataCoordinateResponse.issues);
  const tdataRouteGeometry=collectTDataRouteGeometryObservations({runtime,manifest,libFingerprint});
  const tdataResponseCleanup=collectTDataResponseCleanupObservations({runtime,manifest,libFingerprint});
  const tdataClientFactoryClose=collectTDataClientFactoryCloseObservations({runtime,manifest,libFingerprint});
  const tdataFactoryClassification=collectTDataClientFactoryClassificationObservations({runtime,manifest,libFingerprint});
  const tdataFractionalTimeout=collectTDataFractionalTimeoutObservations({runtime,manifest,libFingerprint});
  const tdataTransportFailure=collectTDataTransportFailureObservations({runtime,manifest,libFingerprint});
  issues.push(...tdataFactoryClassification.issues,...tdataClientFactoryClose.issues,...tdataRouteGeometry.issues,...tdataResponseCleanup.issues,...tdataFractionalTimeout.issues,...tdataTransportFailure.issues);
  const tdataPoiCoordinatePresence=collectTDataPoiCoordinatePresenceObservations({runtime,manifest,libFingerprint});
  const tdataScalarNumber=collectTDataScalarNumberObservations({runtime,manifest,libFingerprint});
  const mapEventRelations=collectMapEventRelations({runtime,manifest,libFingerprint});
  const sdkHeatmapFailures=collectSdkHeatmapFailureObservations({runtime,manifest,libFingerprint});
  issues.push(...tdataPoiCoordinatePresence.issues,...tdataScalarNumber.issues,...mapEventRelations.issues,...sdkHeatmapFailures.issues);
  const currentAdapterObservations={};
  for(const [name,collect] of Object.entries({
    tdataResponseFailure:collectTDataResponseFailureObservations,
    tdataRawQueryGuard:collectTDataRawQueryGuardObservations,
    tdataFixedSnapshotGuard:collectTDataFixedSnapshotGuardObservations,
    tdataResponseClose:collectTDataResponseCloseObservations,
    tdataCallbackRelation:collectTDataCallbackRelationObservations,
    nativePostDispose:collectNativePostDisposeObservations,
    tdataRequestE2e:collectTDataRequestE2eObservations,
    tdataCallbackSetupRollback:collectTDataCallbackSetupRollbackObservations,
    nativeEnvironment:collectSdkNativeEnvironmentObservations,
    vsmErrorBoundary:collectSdkVsmErrorBoundaryObservations,
  })) {
    const result=collect({rows,runtime,manifest,libFingerprint});
    issues.push(...result.issues);
    currentAdapterObservations[name]=result.observations;
  }
  const nativeEnvironmentRelations=collectSdkNativeEnvironmentRelation({runtime,manifest,libFingerprint});
  issues.push(...nativeEnvironmentRelations.issues);
  currentAdapterObservations.nativeEnvironmentRelations={status:nativeEnvironmentRelations.status,platforms:nativeEnvironmentRelations.platforms};
  const additionalNativeObservations=[
    collectTrustedLongTapObservations,
    collectMapLongTapCoexistenceObservations,
    collectNativeLateHandleDeliveryObservations,
    collectSdkStandaloneNativeObservations,
    collectSdkCameraNumberObservations,
    collectSdkGeoJsonDrawObservations,
    collectSdkRawThrownValueObservations,
    collectSdkNativeStartupInvocationObservations,
    collectSdkMapGeometryObservations,
    collectTrustedMarkerTapObservations,
    collectSdkWrapperDetachObservations,
    collectNativeEventInvocationObservations,
    collectManagedMarkerEventsObservations,
    collectSdkUtilitiesNativeObservations,
    collectSdkHtmlNativeObservations,
    collectSdkVisualizationNativeObservations,
    collectSdkDrawingLifecycleObservations,
    collectSdkTDataNativeObservations,
    collectSdkTDataLifecycleObservations,
    collectNativeLifecycleObservations,
    collectSdkMarkerClusterNativeObservations,
  ].map(collect=>collect({rows,runtime,manifest,libFingerprint}));
  const boundedObservations=mergeBoundedObservations(boundedShape.byContract,boundedNativeBounds.byContract,boundedEvents.byContract,
    boundedGeometry.byContract,boundedMapControl.byContract,boundedGeofencing.byContract,
    boundedPlanar.byContract,boundedDrag.byContract,boundedSegmented.byContract,
    boundedNativeEvents.byContract,boundedVsmMap.byContract,boundedTDataSession.byContract,boundedTrustedInput.byContract,boundedNativeStartup.byContract,boundedDefaultPolicy.byContract,boundedEventGetters.byContract,boundedXmlKml.byContract,boundedGeoJson.byContract,boundedTDataScalar.byContract,boundedTDataResponseCallback.byContract,boundedDefaultPolicyTrusted.byContract,boundedReverseAddress.byContract,boundedSharedDebounce.byContract,boundedOverlayLifecycle.byContract,boundedNativePromise.byContract,boundedVsmControls.byContract);
  issues.push(...boundedShape.issues,...boundedNativeBounds.issues,...boundedEvents.issues,
    ...boundedGeometry.issues,...boundedMapControl.issues,...boundedGeofencing.issues,
    ...boundedPlanar.issues,...boundedDrag.issues,...boundedSegmented.issues,
    ...boundedNativeEvents.issues,...boundedVsmMap.issues,...boundedTDataSession.issues,...boundedTrustedInput.issues,...boundedNativeStartup.issues,...boundedDefaultPolicy.issues,...boundedEventGetters.issues,...boundedXmlKml.issues,...boundedGeoJson.issues,...boundedTDataScalar.issues,...boundedTDataResponseCallback.issues,...boundedDefaultPolicyTrusted.issues,...boundedReverseAddress.issues,...boundedSharedDebounce.issues,...boundedOverlayLifecycle.issues,...boundedNativePromise.issues,...boundedVsmControls.issues);
  const allBoundedObservations=mergeBoundedObservations(boundedObservations,...additionalNativeObservations.map(result=>result.byContract));
  issues.push(...additionalNativeObservations.flatMap(result=>result.issues));
  for(const row of rows)row.boundedPlatformObservations=allBoundedObservations[row.id]||[];
  observations=[...observations,...getterProofs];
  for(const row of rows) row.observations.push(...getterProofs.filter(o=>o.contract===row.id).map(o=>({id:o.id,status:o.status,platform:o.platform})));
  reviewInternalState(rows,manifest);
  reviewReferenceOnly(rows,{manifest,ast,runtime});
  const referenceRuntimeEvidence=reviewCurrentReferences(rows,{manifest,ast,runtime});
  const openContracts=contractWorklist({rows,referenceRuntimeEvidence,baselineId:manifest.id,sdkSha256:manifest.sources.find(s=>s.kind==='sdk')?.sha256,libFingerprint,observations,platformEvidence:runtime.platformEvidence||null,boundsDimensionsRuntimeEvidence,finiteConstantsRuntimeEvidence,aliases,exactEventNameAliases,eventNamesRuntimeEvidence}).items.filter(r=>r.status==='OPEN');
  if(openContracts.length) issues.push(issue('runtime-scenario-coverage-open', {
    parent:'U111', count:openContracts.length, ledger:'contracts.json',
    reason:'Per-API source evidence and missing platform/dimension checks are enumerated in contracts.json; this is computed from inventory, not an unconditional runtime placeholder.'
  }));
  const documentIdentities = documentIdentityDispositions({issues, manifest, sources, ast, runtime});
  const documentSources = documentSourceDispositions({issues:documentIdentities.open, manifest, sources});
  const restReview = reviewRestDocuments({issues:documentSources.open, manifest, docs, rows, referenceRuntimeEvidence});
  const positionalConstructor = positionalConstructorDispositions({manifest, sources, ast, runtime, issues: restReview.open});

  const needsEvidence = i => requiresDocumentIdentityEvidence(manifest, i) || requiresDocumentSourceEvidence(manifest, i) || requiresPositionalConstructorEvidence(manifest, i);
  const pendingIdentities = positionalConstructor.open.filter(needsEvidence);
  const adjudication = adjudicate(positionalConstructor.open.filter(i => !needsEvidence(i)), manifest);
  adjudication.open.push(...pendingIdentities);
  adjudication.resolved.push(...documentIdentities.resolved, ...documentSources.resolved, ...restReview.resolved, ...positionalConstructor.resolved);
  issues = adjudication.open;

  const disposition = reviewAbsentWebGetters({issues, manifest, runtime, libFingerprint, bridgeFingerprint});
  issues = disposition.open;
  adjudication.resolved.push(...disposition.resolved);

  const additionalDisposition = reviewAdditionalBridgeTargets({issues, manifest, runtime, libFingerprint, bridgeFingerprint});
  issues = additionalDisposition.open;
  adjudication.resolved.push(...additionalDisposition.resolved);

  const genericDispatchDisposition = reviewGenericDispatch({issues, rows, manifest, runtime, libFingerprint, bridgeFingerprint});
  issues = genericDispatchDisposition.open;
  adjudication.resolved.push(...genericDispatchDisposition.resolved);

  const retiredTDataTargetsDisposition = reviewRetiredTDataTargets({issues, manifest, runtime, libFingerprint});
  issues = retiredTDataTargetsDisposition.open;
  adjudication.resolved.push(...retiredTDataTargetsDisposition.resolved);
  const releasedRouteGeometryDisposition = reviewReleasedRouteGeometry({issues, manifest, runtime, libFingerprint, dart});
  issues = releasedRouteGeometryDisposition.open;
  adjudication.resolved.push(...releasedRouteGeometryDisposition.resolved);
  const releasedPoiCoordinateDisposition = reviewReleasedPoiCoordinate({issues, manifest, runtime, libFingerprint, dart});
  issues = releasedPoiCoordinateDisposition.open;
  adjudication.resolved.push(...releasedPoiCoordinateDisposition.resolved);
  const responseFailureReplay = reviewResponseFailureReplay({issues, manifest, runtime, libFingerprint, dart});
  issues = responseFailureReplay.open;
  adjudication.resolved.push(...responseFailureReplay.resolved);
  const legacyNativeAdapterDisposition = reviewLegacyNativeAdapters({issues, manifest, runtime, dart, libFingerprint});
  issues = legacyNativeAdapterDisposition.open;
  adjudication.resolved.push(...legacyNativeAdapterDisposition.resolved);
  const retiredMapEventSnapshotDisposition = reviewRetiredMapEventSnapshotTarget({issues, manifest, runtime, dart, libFingerprint});
  issues = retiredMapEventSnapshotDisposition.open;
  adjudication.resolved.push(...retiredMapEventSnapshotDisposition.resolved);

  const retiredOverlayTargets = reviewRetiredOverlayTargets({issues, manifest, runtime, dart, libFingerprint});
  issues = retiredOverlayTargets.open;
  adjudication.resolved.push(...retiredOverlayTargets.resolved);

  const reviews = reviewProjectionInitialization(manifest, issues);
  const xmlReviews = reviewXmlNamespaceWrites({issues, manifest, sources, ast, runtime});
  const dictionaryReviews = reviewRequestHeaderAndKmlStyleWrites({issues: xmlReviews.open, manifest, sources, ast, runtime});
  const resolvedIssuesSet = new Set([...reviews.map(r => r.issue), ...xmlReviews.resolved.map(r => r.original), ...dictionaryReviews.resolved.map(r => r.original)]);

  for (const review of reviews) {
    adjudication.resolved.push({
      status: 'RESOLVED_DIAGNOSTIC',
      rationale: 'The pinned runtime reads and the AST source positions agree on the lookup index and initialized value. Public projection methods remain independently open.',
      scope: 'Key and stored value at private projection table initialization only',
      original: review.issue,
      receipt: review.receiptSha256,
      observation: review.observation
    });
  }
  for (const review of [...xmlReviews.resolved, ...dictionaryReviews.resolved]) {
      adjudication.resolved.push(review);
  }

  issues = issues.filter(issue => !resolvedIssuesSet.has(issue));
  // Options/parameters/returns are not prototype properties. Channel mismatch is a triage list, not automatic absence.
  const report = {
    schemaVersion: 1,
    baselineId: manifest.id,
    ...(referenceRuntimeEvidence ? {referenceRuntimeEvidence} : {}),
    sdkSha256: manifest.sources.find((s) => s.kind === "sdk")?.sha256,
    libFingerprint,
    extractionStatus: issues.length
      ? "INCOMPLETE"
      : "EXTRACTED_WITHIN_DECLARED_SCOPE",
    status: "INCOMPLETE",
    summary: {
      sources: manifest.sources.length,
      documents: docs.documentCount,
      namespaceRegistrations: ast.registrations,
      dartPublicDeclarations: dart.rows.length,
      inventory: rows.length,
      referenceOnlyUnverified: rows.filter(r=>r.status==='reviewed-reference-only').length,
      documented: documented.length,
      exampleOnly: examplesOnly.length,
      statuses: counts(rows, "status"),
      documentedStatuses: counts(documented, "status"),
      scopes: counts(rows, "scope"),
      issues: issues.length,
      issueTypes: counts(issues, "code"),
      observations: counts(observations, "status"),
      boundedPlatformContracts: Object.keys(allBoundedObservations).length,
      boundedPlatformObservationGroups: Object.values(allBoundedObservations).flatMap(boundedObservationGroups).length,
      boundedPlatformCases: countBoundedCases(allBoundedObservations),
    },
    issues,
    resolvedIssues: adjudication.resolved,
    rows,
    aliases,
    exactEventNameAliases,
    eventNamesRuntimeEvidence,
    eventNamesAliasEvidence:runtime.eventNamesAliasEvidence||null,
    crossCheck,
    observations,
    boundedPlatformObservations:allBoundedObservations,
    adapterObservations:{...currentAdapterObservations,tdataFactoryClassification:tdataFactoryClassification.observations,tdataClientFactoryClose:tdataClientFactoryClose.observations,tdataPoiCoordinatePresence:tdataPoiCoordinatePresence.observations,sdkHeatmapFailures:sdkHeatmapFailures.observations,tdataScalarNumber:tdataScalarNumber.observations,mapEventRelations,tdataBytesCache:tdataBytesCache.observations,nativeResources:nativeResources.observations,tdataPoiPage:tdataPoiPage.observations,tdataCoordinateResponse:tdataCoordinateResponse.observations,tdataRouteGeometry:tdataRouteGeometry.observations,tdataResponseCleanup:tdataResponseCleanup.observations,tdataFractionalTimeout:tdataFractionalTimeout.observations,tdataTransportFailure:tdataTransportFailure.observations},
    dependencies,
    bridgeObservations: runtime.bridgeObservations || [],
    platformEvidence: runtime.platformEvidence || null,
    boundsDimensionsRuntimeEvidence,
    finiteConstantsRuntimeEvidence,
    bridgeFingerprint: bridgeFingerprint || null,
    limitations: [
      "No inferred candidate is certified as supported.",
      "Public/internal classification remains open for undocumented exports, including Vsm engine exports.",
      "Runtime events, lazy loads, workers and lifecycle branches require additional scenarios; reflection is not proof of all executions.",
      "Dart syntax inventory follows exports/parts and local inheritance; it does not prove type-resolved dispatch.",
      "Selected Flutter Web/Android/iOS integration evidence is recorded separately in docs/sdk-audit/mobile-validation.json; it does not certify all per-row contracts.",
      "The finite differential probes cover listed numeric inputs only.",
    ],
  };
  attachDocumentationMismatches(report,{manifest,ast});
  const work = contractWorklist(report);
  for (const row of report.rows) {
    const item = work.items.find((i) => i.api === row.id);
    row.dimensions = item ? item.dimensions : [];
    row.dimensionIds = item ? item.dimensionIds : [];
    row.granularStatus = item ? item.granularStatus : "unverified";
  }
  report.dynamicUnresolvedSites = (report.issues || []).filter((i) =>
    [
      "dynamic-namespace",
      "dynamic-object-member",
      "dynamic-property-write",
      "dynamic-code",
      "reflective-property-definition",
    ].includes(i.code),
  );
  report.summary.granularStatuses = counts(report.rows, "granularStatus");
  report.summary.dimensionStatuses = counts(
    report.rows.flatMap((r) => r.dimensions || []),
    "status",
  );
  report.summary.documentationMismatchContracts=report.rows.filter(row=>validDocumentationMismatch(row,report)).length;
  report.status = strictGate(report).ok ? "COMPLETE" : "INCOMPLETE";
  return report;
}
export function strictGate(report) {
  const reasons = [];
  const currentReference = currentReferenceValidator(report);
  const referenceValid = row => currentReference(row) || validReferenceReview(row,report);
  const finiteProofs=validFiniteConstantAdaptations(report);
  const eventGetterProofs=validSdkEventGetterContractProofs(report);
  const htmlNativeProofs=validSdkHtmlNativeContractProofs(report);
  const utilitiesNativeProofs=validSdkUtilitiesNativeContractProofs(report);
  const projectionFacetProofs=validSdkProjectionFacetContractProofs(report);
  const nativeEnvironmentProofs=validSdkNativeEnvironmentContractProofs(report);
  if (!report.rows?.length) reasons.push("empty-inventory");
  if (report.issues?.length)
    reasons.push("unresolved-extraction-or-runtime-issues");
  if (contractWorklist({...report,rows:report.rows||[]},currentReference).items.some(r=>r.status==='OPEN')) reasons.push('unresolved-api-contracts');
  if (report.rows?.some((r) => r.status !== "verified" && !validInternalReview(r,report) && !validAdaptationProof(r,report,finiteProofs,eventGetterProofs,htmlNativeProofs,utilitiesNativeProofs,projectionFacetProofs,nativeEnvironmentProofs) && !referenceValid(r)))
    reasons.push("unresolved-api-contracts");
  if (report.rows?.some((r) => !r.evidence?.length))
    reasons.push("missing-source-evidence");
  if (
    report.rows?.some(
      (r) =>
        !validInternalReview(r,report) && !referenceValid(r) && (Object.values(r.platforms || {}).length !== 3 ||
        Object.values(r.platforms).some((s) => s !== "verified")),
    )
  )
    reasons.push("unresolved-platform-contracts");
  if (
    report.rows?.some(
      (r) =>
        r.status === "observed-difference" ||
        (r.observations || []).some((o) => o.status === "difference"),
    )
  )
    reasons.push("contract-observation-differences");
  if (
    report.rows?.some(
      (r) =>
        r.granularStatus === "source mismatch" || r.documentationMismatch,
    )
  )
    reasons.push("source-mismatches-present");
  const dimensions = [
    "inputs-defaults",
    "returns-types",
    "mutation-identity",
    "errors",
    "lifecycle-events",
    "dispatch",
  ];
  for (const row of report.rows || []) {
    if (row.status !== "verified" && row.status !== "reviewed-adaptation") continue;
    const proof = row.verification;
    if (
      !proof ||
      proof.baselineId !== report.baselineId ||
      proof.libSha256 !== report.libFingerprint?.sha256
    ) {
      reasons.push("unbound-contract-proof");
      continue;
    }
    for (const platform of ["web", "android", "ios"])
      for (const dimension of dimensions) {
        const refs = proof.platforms?.[platform]?.[dimension];
        if (!Array.isArray(refs) || !refs.length) {
          reasons.push("missing-contract-dimension-proof");
          continue;
        }
        for (const id of refs) {
          const observation = report.observations?.find(
            (o) => o.id === id && o.contract === row.id,
          );
          if (
            !observation ||
            observation.status !== (row.status === "reviewed-adaptation" ? "adaptation-match" : "sample-match") ||
            observation.platform !== platform ||
            !observation.dimensions?.includes(dimension)
          )
            reasons.push("invalid-contract-dimension-proof");
        }
      }
  }
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}
export function renderReport(r) {
  const lines = [
    "# TMAP JS → Flutter audit",
    "",
    `**${r.status}** · 기준본 \`${r.baselineId}\``,
    "",
    `SDK SHA-256: \`${r.sdkSha256}\``,
    "",
    "| 항목 | 수 |",
    "| --- | ---: |",
    ...Object.entries({
      sources: r.summary.sources,
      namespaceRegistrations: r.summary.namespaceRegistrations,
      inventory: r.summary.inventory,
      referenceOnlyUnverified:r.summary.referenceOnlyUnverified||0,
      documented: r.summary.documented,
      dartPublicDeclarations: r.summary.dartPublicDeclarations,
      issues: r.summary.issues,
      documentationMismatchContracts:r.summary.documentationMismatchContracts||0,
    }).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "목록 행은 클래스·메서드·옵션·인수·반환 계약·이벤트·런타임 속성의 합집합이다. 내부 구현 후보와 Vsm 엔진 노출도 포함하므로 전체 행 수를 공개 API 개수나 지원율의 분모로 사용하지 않는다. 이름 대응은 구현 완료가 아니다.",
    "REVIEWED_REFERENCE_ONLY는 명명된 JS SDK 서비스 wrapper 밖의 REST 참조 표에 대한 범위 판정이다. 원문은 보존하며 독립 REST 검증은 UNVERIFIED다. REVIEWED_INTERNAL_STATE 역시 기능 구현 검증 수에 포함하지 않는다.",
    "",
    ...((r.resolvedIssues || []).some(i => i.status === 'CONFIRMED_UPSTREAM_INCONSISTENCY') ? [
      "## 원문 불일치 판정",
      "",
      ...r.resolvedIssues.filter(i => i.status === 'CONFIRMED_UPSTREAM_INCONSISTENCY').map(i => `- ${i.status}: ${i.original.code} — ${i.rationale} (${i.scope})`),
      "",
    ] : []),
    ...((r.resolvedIssues || []).some(i => i.status === 'SOURCE_TYPE_NOT_SPECIFIED') ? [
      '## 원문 타입 미기재 판정', '',
      ...r.resolvedIssues.filter(i => i.status === 'SOURCE_TYPE_NOT_SPECIFIED').map(i => `- ${i.original.id}: ${i.rationale} (${i.scope})`), '',
    ] : []),
    "## 문서 계약 대응 상태",
    "",
    "| 상태 | 수 |",
    "| --- | ---: |",
    ...Object.entries(r.summary.documentedStatuses).map(
      ([k, v]) => `| ${k} | ${v} |`,
    ),
    "",
    "## 실제 JS / Dart 차등 관찰",
    "",
    "| 입력 시나리오 | 결과 | 차이 차원 |",
    "| --- | --- | --- |",
    ...r.observations.map(
      (o) => `| ${o.id} | ${o.status} | ${(o.differences || []).join(", ")} |`,
    ),
    "",
    "sample-match는 해당 입력의 관찰만 일치한 것이다. mutation을 불변 복사 API로 바꾼 의도적 차이도 difference로 표시하며, 전체 계약 검증으로 승격하지 않는다.",
    "",
    "## 실제 SDK에 연결한 포트 JS 브리지 검사",
    "",
    "| 시나리오 | 결과 | 실행 환경 |",
    "| --- | --- | --- |",
    ...(r.bridgeObservations || []).map(
      (o) => `| ${o.id} | ${o.status} | ${o.environment || "failed"} |`,
    ),
    "",
    "Dart에서 실제 생성한 JS를 실행한 컴포넌트 검사다. Flutter 위젯·Dart interop·Android/iOS 기기 전체 경로를 검증한 것은 아니다.",
    "",
    "## Flutter 플랫폼 통합 실행",
    "",
    "선별 시나리오의 실제 Flutter 실행이다. 전체 API 계약 완료를 뜻하지 않는다. 정제 로그 및 입력 해시는 platformEvidence에 보존한다.",
    "",
    "| 플랫폼 | 종류 | 결과 | 체크 수 |",
    "| --- | --- | --- | ---: |",
    ...(r.platformEvidence?.records || []).map(o=>`| ${o.platform} | ${o.kind} | ${o.passed?'PASS':'UNRESOLVED'} | ${o.checks.length || o.rawResults.length} |`),
    "",
    ...(r.platformEvidence?.externalBlocks || []).map(s=>'- '+s),
    ...(r.platformEvidence?.unresolvedCases || []).map(c=>`- 원인 미확정 (${c.platform}): ${c.observation}`),
    "",
    "## 계약별 제한된 플랫폼 관찰",
    "",
    "아래 수는 실행한 사례 수이며 검증 완료 수가 아니다. 입력·원본 반환·타입 차이·ID 오류·이벤트 등록 실패는 contracts.json의 boundedPlatformObservations에 보존한다. 기존 미검증 차원과 OPEN 상태는 유지한다.",
    "",
    "동일 계약의 서로 다른 기능 관찰은 별도 묶음으로 유지한다. 앞선 관찰을 덮어쓰지 않는다.",
    "",
    "| 계약 | 관찰 helper | Web 사례 | Android 사례 | iOS 사례 | 판정 |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...Object.entries(r.boundedPlatformObservations||{}).flatMap(([id,value])=>boundedObservationGroups(value).map(o=>
      `| ${id} | ${o.fixture?.file||o.helper?.file||''} | ${o.platforms?.web?.cases?.length||o.platforms?.web?.phases?.length||0} | ${o.platforms?.android?.cases?.length||o.platforms?.android?.phases?.length||0} | ${o.platforms?.ios?.cases?.length||o.platforms?.ios?.phases?.length||0} | observed-not-verified |`)),
    "",
    "## 문서화된 클래스 대응",
    "",
    "| 원본 | Dart 후보 | 상태 |",
    "| --- | --- | --- |",
    ...r.rows
      .filter((x) => x.kinds.includes("class") && x.scope === "documented")
      .map(
        (x) =>
          `| ${x.id} | ${x.dartCandidates.map((d) => d.id).join(", ") || "없음"} | ${x.status} |`,
      ),
    "",
    "## 문서화된 메서드 중 대응 후보 없음",
    "",
    ...r.rows
      .filter(
        (x) =>
          x.scope === "documented" &&
          x.kinds.includes("method") &&
          !x.kinds.includes("class") &&
          x.status === "unmapped",
      )
      .map((x) => `- \`${x.id}\``),
    "",
    "## 미해결 유형",
    "",
    "| 유형 | 수 |",
    "| --- | ---: |",
    ...Object.entries(r.summary.issueTypes).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## 제한",
    "",
    ...r.limitations.map((l) => "- " + l),
    "",
    "전체 행과 원본 위치는 inventory.json 및 report.json, 차등 결과는 observations.json, 원본 채널은 docs.json / ast.json / runtime.json / dart.json을 참조한다. check 명령은 미해결 상태에서 exit 1을 반환한다.",
    "",
  ];
  return lines.join("\n");
}
