// Single registry for retaining and decoding structured platform evidence.
// Keep raw text-only status/REST summaries separate from JSON observations.
export const platformJsonMarkers = Object.freeze({
  "nativeLateHandleDeliveryResults": "NATIVE LATE HANDLE DELIVERY RESULT:",
  "nativePostDisposeResults": "NATIVE POST DISPOSE RESULT:",
  "tdataCallbackSetupRollbackResults": "TDATA CALLBACK SETUP ROLLBACK RESULT:",
  "sdkVsmErrorBoundaryResults": "SDK VSM ERROR BOUNDARY RESULT:",
  "mapLongTapCoexistenceResults": "MAP LONG TAP COEXISTENCE RESULT:",
  "mapTrustedLongTapResults": "MAP TRUSTED LONGTAP RESULT:",
  "tdataResponseFailureResults": "TDATA RESPONSE FAILURE RESULT:",
  "tdataRawQueryGuardResults": "TDATA RAW QUERY GUARD RESULT:",
  "tdataFixedSnapshotGuardResults": "TDATA FIXED SNAPSHOT GUARD RESULT:",
  "tdataResponseCloseResults": "TDATA RESPONSE CLOSE RESULT:",
  "tdataCallbackRelationResults": "TDATA CALLBACK RELATION RESULT:",
  "tdataRequestE2eResults": "TDATA REQUEST E2E RESULT:",
  "sdkNativeEnvironmentResults": "SDK NATIVE ENVIRONMENT RESULT:",
  "sdkNativeEnvironmentRelationSources": "SDK NATIVE ENVIRONMENT RELATION SOURCE:",
  "sdkNativeEnvironmentRelationResults": "SDK NATIVE ENVIRONMENT RELATION RESULT:",
  "sdkNativeEnvironmentRelationCleanups": "SDK NATIVE ENVIRONMENT RELATION CLEANUP:",
  "tdataFactoryClassificationResults": "TDATA FACTORY CLASSIFICATION RESULT:",
  "sdkStandaloneNativeResults": "SDK STANDALONE NATIVE RESULT:",
  "tdataClientFactoryCloseResults": "TDATA CLIENT FACTORY CLOSE RESULT:",
  "tdataPoiCoordinatePresenceResults": "TDATA POI COORDINATE RESULT:",
  "sdkHeatmapFailureResults": "SDK HEATMAP FAILURE RESULT:",
  "tdataScalarNumberResults": "TDATA SCALAR NUMBER RESULT:",
  "sdkStartupInvocationResults": "SDK STARTUP INVOCATION RESULT:",
  "sdkRawThrownValueResults": "SDK RAW THROWN VALUE RESULT:",
  "sdkCameraNumberSources": "SDK CAMERA NUMBERS SOURCE:",
  "sdkCameraNumberResults": "SDK CAMERA NUMBERS RESULT:",
  "sdkProjectionFacetSources": "SDK PROJECTION FACET SOURCE:",
  "sdkProjectionFacetResults": "SDK PROJECTION FACET RESULT:",
  "sdkProjectionFacetShared": "SDK PROJECTION FACET SHARED:",
  "sdkGeoJsonDrawResults": "SDK GEOJSON DRAW RESULT:",
  "tdataRouteGeometryResults": "TDATA ROUTE GEOMETRY RESULT:",
  "tdataResponseCleanupResults": "TDATA RESPONSE CLEANUP RESULT:",
  "tdataFractionalTimeoutResults": "TDATA FRACTIONAL TIMEOUT RESULT:",
  "tdataTransportFailureResults": "TDATA TRANSPORT FAILURE RESULT:",
  "domOccurrenceCaptureResults": "DOM EVENT OCCURRENCE RESULT:",
  "nativeEngineCleanupResults": "NATIVE ENGINE CLEANUP RESULT:",
  "sdkManagedMarkerClusterResults": "SDK MANAGED MARKER CLUSTER RESULT:",
  "sdkShapeEventsResults": "SDK SHAPE EVENTS RESULT:",
  "sdkXmlKmlForwardingResults": "SDK XML KML FORWARD RESULT:",
  "tdataResponseBytesResults": "TDATA RESPONSE BYTES RESULT:",
  "tdataCacheInvalidationResults": "TDATA CACHE INVALIDATION RESULT:",
  "tdataPoiPageResults": "TDATA POI PAGE RESULT:",
  "mapCloseResults": "MAP CLOSE RESULT:",
  "nativeBulkOffEmitterResults": "NATIVE BULK OFF EMITTER RESULT:",
  "sdkMapGeometrySources": "SDK MAP GEOMETRY SOURCE:",
  "sdkMapGeometryResults": "SDK MAP GEOMETRY RESULT:",
  "tdataCoordinateResponseResults": "TDATA COORDINATE RESPONSE RESULT:",
  "sdkDomEventTargetResults": "SDK DOM EVENT TARGET RESULT:",
  "nativeEventOccurrenceResults": "NATIVE EVENT OCCURRENCE RESULT:",
  "sdkOverlayNativeSources": "SDK OVERLAY NATIVE SOURCE:",
  "sdkOverlayNativeResults": "SDK OVERLAY NATIVE RESULT:",
  "trustedMarkerTapPreflights": "TRUSTED MARKER TAP PREFLIGHT:",
  "sdkTDataDependencyResults": "SDK TDATA DEPENDENCY RESULT:",
  "sdkTDataSnapshotResults": "SDK TDATA SNAPSHOT RESULT:",
  "tdataNativeLifecycleResults": "TDATA NATIVE LIFECYCLE RESULT:",
  "sdkTDataNativeResults": "SDK TDATA NATIVE RESULT:",
  "sdkNativeHtmlDdaResults": "SDK NATIVE HTMLDDA RESULT:",
  "sdkMarkerClusterNativeSources": "SDK MARKER CLUSTER NATIVE SOURCE:",
  "sdkMarkerClusterNativeResults": "SDK MARKER CLUSTER NATIVE RESULT:",
  "trustedMarkerTapResults": "TRUSTED MARKER TAP RESULT:",
  "sdkWrapperDetachResults": "SDK WRAPPER DETACH RESULT:",
  "managedMarkerEventsResults": "MANAGED MARKER EVENTS RESULT:",
  "sdkVisualizationNativeSources": "SDK VISUALIZATION NATIVE SOURCE:",
  "sdkVisualizationNativeResults": "SDK VISUALIZATION NATIVE RESULT:",
  "sdkHtmlGetterDomainResults": "SDK HTML GETTER DOMAIN RESULT:",
  "sdkHtmlNativeSources": "SDK HTML NATIVE SOURCE:",
  "sdkHtmlNativeResults": "SDK HTML NATIVE RESULT:",
  "sdkUtilitiesNativeSources": "SDK UTILITIES NATIVE SOURCE:",
  "sdkUtilitiesNativeDomainResults": "SDK UTILITIES NATIVE DOMAIN RESULT:",
  "sdkUtilitiesNativeResults": "SDK UTILITIES NATIVE RESULT:",
  "nativeEventInvocationResults": "NATIVE EVENT INVOCATION RESULT:",
  "sdkVsmControlsSources": "SDK VSM CONTROLS SOURCE:",
  "sdkVsmControlsResults": "SDK VSM CONTROLS RESULT:",
  "nativePromiseSources": "NATIVE PROMISE SOURCE:",
  "nativePromiseResults": "NATIVE PROMISE RESULT:",
  "sdkStartupEventSources": "SDK STARTUP EVENT SOURCE:",
  "sdkStartupEventResults": "SDK STARTUP EVENT RESULT:",
  "sdkDefaultPolicyTrustedResults": "SDK DEFAULT POLICY TRUSTED RESULT:",
  "sdkDefaultPolicySources": "SDK DEFAULT POLICY SOURCE:",
  "sdkDefaultPolicyResults": "SDK DEFAULT POLICY RESULT:",
  "sdkXmlKmlSources": "SDK XML KML SOURCE:",
  "sdkXmlKmlResults": "SDK XML KML RESULT:",
  "tdataScalarCompatibilityResults": "TDATA SCALAR COMPAT RESULT:",
  "tdataResponseCallbackResults": "TDATA RESPONSE CALLBACK RESULT:",
  "tdataSharedDebounceResults": "TDATA SHARED DEBOUNCE RESULT:",
  "reverseAddressBoundaryResults": "REVERSE ADDRESS BOUNDARY RESULT:",
  "overlayLifecycleSources": "OVERLAY LIFECYCLE SOURCE:",
  "overlayLifecycleResults": "OVERLAY LIFECYCLE RESULT:",
  "sdkDrawingLifecycleSources": "SDK DRAWING LIFECYCLE SOURCE:",
  "sdkDrawingLifecycleResults": "SDK DRAWING LIFECYCLE RESULT:",
  "sdkEventGettersSources": "SDK EVENT GETTERS SOURCE:",
  "sdkEventGettersResults": "SDK EVENT GETTERS RESULT:",
  "sdkEventGetterDomainResults": "SDK EVENT GETTER DOMAIN RESULT:",
  "sdkGeoJsonSources": "SDK GEOJSON SOURCE:",
  "sdkGeoJsonResults": "SDK GEOJSON RESULT:",
  "trustedInputRequests": "MAP TRUSTED INPUT REQUEST:",
  "trustedInputDriverResults": "MAP TRUSTED INPUT DRIVER:",
  "trustedInputResults": "MAP TRUSTED INPUT RESULT:",
  "nativeSdkEventSources": "NATIVE SDK EVENTS SOURCE:",
  "nativeSdkEventResults": "NATIVE SDK EVENTS RESULT:",
  "sdkVsmMapSources": "SDK VSM MAP SOURCE:",
  "sdkVsmMapResults": "SDK VSM MAP RESULT:",
  "tdataSessionResults": "TDATA SESSION RESULT:",
  "shapeSetterResults": "SHAPE SETTER OBSERVATION:",
  "pointSizeSetterResults": "POINT SIZE SETTER RESULT:",
  "geometryEqualsResults": "GEOMETRY EQUALS RESULT:",
  "latLngBoundsCenterResults": "LATLNGBOUNDS CENTER RESULT:",
  "routeOptionalTotalsResults": "ROUTE OPTIONAL TOTALS RESULT:",
  "poiOptionalDistanceResults": "POI OPTIONAL DISTANCE RESULT:",
  "geographicEqualsResults": "GEOGRAPHIC EQUALS RESULT:",
  "poiIdentifierResults": "POI IDENTIFIER RESULT:",
  "tdataGeofencingResults": "TDATA GEOFENCING RESULT:",
  "tdataSegmentedResults": "TDATA SEGMENTED RESULT:",
  "trafficOptionalResults": "TDATA TRAFFIC OPTIONAL RESULT:",
  "sdkPlanarGeometrySources": "SDK PLANAR GEOMETRY SOURCE:",
  "sdkPlanarGeometryResults": "SDK PLANAR GEOMETRY RESULT:",
  "mapDragProgressSources": "MAP DRAG PROGRESS SOURCE:",
  "mapDragProgressResults": "MAP DRAG PROGRESS RESULT:",
  "sdkGeometryNativeSources": "SDK GEOMETRY NATIVE SOURCE:",
  "sdkGeometryNativeResults": "SDK GEOMETRY NATIVE RESULT:",
  "mapControlLifecycleSources": "MAP CONTROL LIFECYCLE SOURCE:",
  "mapControlLifecycleResults": "MAP CONTROL LIFECYCLE RESULT:",
  "tdataAdditionalResults": "TDATA ADDITIONAL RESULT:",
  "sdkBoundsNativeSources": "SDK BOUNDS NATIVE SOURCE:",
  "sdkBoundsNativeResults": "SDK BOUNDS NATIVE RESULT:",
  "mapEventSnapshotResults": "MAP EVENT SNAPSHOT RESULT:",
  "unitConstantsResults": "SDK UNIT CONSTANTS RESULT:",
  "publicConstantsResults": "PUBLIC CONSTANTS RESULT:",
  "eventNamesResults": "EVENT NAMES RESULT:",
  "sdkBoundsDimensionsResults": "SDK BOUNDS DIMENSIONS RESULT:",
  "pedestrianRouteResults": "PEDESTRIAN ROUTE RESULT:",
  "polygonPathResults": "POLYGON PATH RESULT:",
  "vehicleRouteResults": "VEHICLE ROUTE RESULT:",
  "sdkLatLngBoundsStateResults": "SDK LATLNGBOUNDS STATE RESULT:",
  "markerGetterResults": "MARKER GETTER OBSERVATION:",
  "latLngBoundsNorthEastResults": "LATLNGBOUNDS NORTHEAST RESULT:",
  "latLngBoundsCornerResults": "LATLNGBOUNDS CORNER RESULT:",
  "addressPostcodeResults": "ADDRESS POSTCODE RESULT:",
  "getterResults": "GETTER CONTRACT RESULT:"
});

const textMarkers = ['LIVE PASS:', 'LIVE RESULT:', 'RAW TDATA RESULT:',
  'All tests passed!', 'Some tests failed.', 'native initial bounds', 'live TMAP map'];

// A marker belongs to the log envelope, never to a JSON string in its payload.
// Only strip prefixes emitted by the supported Flutter reporters/loggers.
export function decodePlatformLogLine(line) {
  const text = line.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r$/, '')
    .replace(/^(?:[VDIWE]\/flutter(?:\s*\(\s*\d+\s*\))?:\s*|flutter:\s*)/, '')
    .replace(/^\d{2}:\d{2}(?::\d{2})?\s+\+\d+(?:\s+~\d+)?(?:\s+-\d+)?\s*:\s*/, '');
  for (const [field, marker] of Object.entries(platformJsonMarkers)) {
    if (text.startsWith(marker)) return {kind:'json',field,marker,payload:text.slice(marker.length).trim()};
  }
  for (const marker of textMarkers) {
    if (text.startsWith(marker)) return {kind:'text',marker,payload:text.slice(marker.length).trim()};
  }
  return null;
}

export function selectPlatformLogLines(body) {
  return body.split('\n').filter(line => decodePlatformLogLine(line) !== null);
}

export function parsePlatformJsonResults(lines) {
  const results = Object.fromEntries(Object.keys(platformJsonMarkers).map(field => [field, []]));
  for (const line of lines) {
    const row = decodePlatformLogLine(line);
    if (row?.kind === 'json') results[row.field].push(JSON.parse(row.payload));
  }
  return results;
}

export function parsePlatformTextResults(lines) {
  const rows = lines.map(decodePlatformLogLine).filter(row => row?.kind === 'text');
  const payloads = marker => rows.filter(row => row.marker === marker).map(row => row.payload);
  const webResults = payloads('LIVE RESULT:');
  return {
    webPassed: webResults.includes('PASS') && !webResults.some(value => value.startsWith('FAIL')),
    mobilePassed: rows.some(row => row.marker === 'All tests passed!' && row.payload === '') &&
      !rows.some(row => row.marker === 'Some tests failed.'),
    checks: payloads('LIVE PASS:'),
    rawResults: payloads('RAW TDATA RESULT:'),
  };
}

/** Keep physical line references while decoding only a recognized envelope. */
export function parsePlatformMarkerRows(lines, marker) {
  if (!Object.values(platformJsonMarkers).includes(marker)) throw Error('Unknown JSON log marker');
  return lines.flatMap((line, index) => {
    const row = decodePlatformLogLine(line);
    return row?.kind === 'json' && row.marker === marker
      ? [{data: JSON.parse(row.payload), line: index + 1}] : [];
  });
}

export function platformLogPassed(lines, platform) {
  const result = parsePlatformTextResults(lines);
  return platform === 'web' ? result.webPassed
    : (platform === 'android' || platform === 'ios') && result.mobilePassed;
}
