import 'dart:async';

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const LatLng _seoulCenter = LatLng(37.5665, 126.9780);
const LatLng _destinationLandmark = LatLng(37.5512, 126.9882);

/// Evaluates whether the current VSM style name and type match expected values.
Future<bool> _isStyle(
  TMapController controller,
  String expectedName,
  String expectedType,
) {
  return checkJs(
    controller,
    '(function() {'
    '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
    '  if (!m || !m.vsmMap) return false;'
    '  var vsm = typeof m.vsmMap === "function" ? m.vsmMap() : m.vsmMap;'
    '  if (!vsm || typeof vsm.getCurrentStyleNameAndType !== "function") return false;'
    '  var s = vsm.getCurrentStyleNameAndType();'
    '  return Boolean(s && s.name === "$expectedName" && s.type === "$expectedType");'
    '})()',
  );
}

/// Checks that the VSM canvas element is present, attached, and healthy.
Future<bool> _isCanvasHealthy(TMapController controller) {
  return checkJs(
    controller,
    '(function() {'
    '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
    '  if (!m || !m.vsmMap) return false;'
    '  var vsm = typeof m.vsmMap === "function" ? m.vsmMap() : m.vsmMap;'
    '  var canvas = vsm && typeof vsm.getCanvas === "function" ? vsm.getCanvas() : null;'
    '  return Boolean(canvas && canvas.classList && canvas.classList.contains("vsm-canvas") && m.getCenter());'
    '})()',
  );
}

/// Verifies that real SDK traffic lines are attached with actual map identity,
/// VSM layer registration, and non-empty coordinate paths (length >= 2) for each line,
/// and retains original references.
Future<bool> _isTrafficAttached(TMapController controller) {
  return checkJs(
    controller,
    '(function() {'
    '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
    '  if (!m || !m.vsmMap) return false;'
    '  var vsm = typeof m.vsmMap === "function" ? m.vsmMap() : m.vsmMap;'
    '  if (!vsm || typeof vsm.hasLayer !== "function") return false;'
    '  var lines = m.__tmapTrafficLines;'
    '  if (!Array.isArray(lines) || lines.length === 0) return false;'
    '  for (var i = 0; i < lines.length; i++) {'
    '    var line = lines[i];'
    '    if (!line) return false;'
    '    if (typeof line.getMap !== "function" || line.getMap() !== m) return false;'
    '    if (!line._shape_data || line._shape_data.layerId == null) return false;'
    '    if (!vsm.hasLayer(line._shape_data.layerId)) return false;'
    '    var path = line._shape_data.path;'
    '    if (!path || typeof path.length !== "number" || path.length < 2) return false;'
    '  }'
    '  window.__tmapTestSavedLines = lines.slice();'
    '  window.__tmapTestSavedLayerIds = lines.map(function(l) {'
    '    return l._shape_data.layerId;'
    '  });'
    '  return true;'
    '})()',
  );
}

/// Retains original SDK lines and layer IDs on test-only window properties before toggling traffic off,
/// without mutating any SDK or adapter state.
Future<bool> _retainTrafficLines(TMapController controller) {
  return checkJs(
    controller,
    '(function() {'
    '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
    '  if (!m) return false;'
    '  var lines = m.__tmapTrafficLines;'
    '  if (!Array.isArray(lines) || lines.length === 0) return false;'
    '  window.__tmapTestSavedLines = lines.slice();'
    '  window.__tmapTestSavedLayerIds = lines.map(function(l) {'
    '    return (l && l._shape_data) ? l._shape_data.layerId : null;'
    '  });'
    '  return window.__tmapTestSavedLines.length > 0 && window.__tmapTestSavedLayerIds.length === window.__tmapTestSavedLines.length;'
    '})()',
  );
}

/// Verifies that the traffic registry is empty, every saved line is detached,
/// and all original layer IDs are absent from real VSM layers.
Future<bool> _isTrafficDetached(TMapController controller) {
  return checkJs(
    controller,
    '(function() {'
    '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
    '  if (!m || !m.vsmMap) return false;'
    '  var vsm = typeof m.vsmMap === "function" ? m.vsmMap() : m.vsmMap;'
    '  if (!vsm || typeof vsm.hasLayer !== "function") return false;'
    '  var lines = m.__tmapTrafficLines;'
    '  var registryEmpty = (!lines || (Array.isArray(lines) && lines.length === 0)) && m.__tmapTrafficEnabled === false;'
    '  if (!registryEmpty) return false;'
    '  var savedLines = window.__tmapTestSavedLines;'
    '  if (!Array.isArray(savedLines) || savedLines.length === 0) return false;'
    '  for (var i = 0; i < savedLines.length; i++) {'
    '    var line = savedLines[i];'
    '    if (!line) return false;'
    '    var mapRef = typeof line.getMap === "function" ? line.getMap() : null;'
    '    if (mapRef !== null && mapRef !== undefined) return false;'
    '  }'
    '  var savedLayerIds = window.__tmapTestSavedLayerIds;'
    '  if (!Array.isArray(savedLayerIds) || savedLayerIds.length === 0) return false;'
    '  for (var j = 0; j < savedLayerIds.length; j++) {'
    '    var layerId = savedLayerIds[j];'
    '    if (layerId != null && vsm.hasLayer(layerId)) return false;'
    '  }'
    '  return true;'
    '})()',
  );
}

/// Verifies that upon re-enabling traffic, actual new attached data and geometry are present,
/// and earlier SDK object identity is not revived (accounting for possible numeric ID reuse).
Future<bool> _isTrafficReattached(TMapController controller) {
  return checkJs(
    controller,
    '(function() {'
    '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
    '  if (!m || !m.vsmMap) return false;'
    '  var vsm = typeof m.vsmMap === "function" ? m.vsmMap() : m.vsmMap;'
    '  if (!vsm || typeof vsm.hasLayer !== "function") return false;'
    '  if (m.__tmapTrafficEnabled !== true) return false;'
    '  var newLines = m.__tmapTrafficLines;'
    '  if (!Array.isArray(newLines) || newLines.length === 0) return false;'
    '  var savedLines = window.__tmapTestSavedLines;'
    '  if (!Array.isArray(savedLines) || savedLines.length === 0) return false;'
    '  for (var i = 0; i < newLines.length; i++) {'
    '    var line = newLines[i];'
    '    if (!line) return false;'
    '    if (typeof line.getMap !== "function" || line.getMap() !== m) return false;'
    '    if (!line._shape_data || line._shape_data.layerId == null) return false;'
    '    if (!vsm.hasLayer(line._shape_data.layerId)) return false;'
    '    var path = line._shape_data.path;'
    '    if (!path || typeof path.length !== "number" || path.length < 2) return false;'
    '    for (var j = 0; j < savedLines.length; j++) {'
    '      if (line === savedLines[j]) return false;'
    '    }'
    '  }'
    '  for (var k = 0; k < savedLines.length; k++) {'
    '    var oldLine = savedLines[k];'
    '    if (oldLine && typeof oldLine.getMap === "function" && oldLine.getMap() != null) {'
    '      return false;'
    '    }'
    '  }'
    '  return true;'
    '})()',
  );
}

/// Clears captured test-only traffic references from window.
Future<bool> _clearCapturedTraffic(TMapController controller) {
  return checkJs(
    controller,
    '(function() {'
    '  delete window.__tmapTestSavedLines;'
    '  delete window.__tmapTestSavedLayerIds;'
    '  return true;'
    '})()',
  );
}

/// 1. Map styles scenario: tests ROAD, HYBRID, PUBLIC, NIGHT via genuine SDK style observation.
Future<void> _testMapStyles() async {
  final controller = await mountLiveMap(
    (created) => TMap(
      center: _seoulCenter,
      zoom: 16,
      mapType: TMapType.road,
      onMapCreated: created,
    ),
  );

  try {
    // Initial style settle: ROAD -> TMAP/DEFAULT
    await expectLive(
      'initial ROAD style settled (TMAP/DEFAULT)',
      () => _isStyle(controller, 'TMAP', 'DEFAULT'),
    );

    // Switch to HYBRID -> SAM/DEFAULT
    await controller.setMapType(TMapType.hybrid);
    await expectLive(
      'HYBRID style settled (SAM/DEFAULT)',
      () => _isStyle(controller, 'SAM', 'DEFAULT'),
    );

    // Switch to PUBLIC -> TMAP/PUBLIC_POI
    await controller.setMapType(TMapType.public);
    await expectLive(
      'PUBLIC style settled (TMAP/PUBLIC_POI)',
      () => _isStyle(controller, 'TMAP', 'PUBLIC_POI'),
    );

    // Switch to NIGHT -> TMAP/NIGHT
    await controller.setMapType(TMapType.night);
    await expectLive(
      'NIGHT style settled (TMAP/NIGHT)',
      () => _isStyle(controller, 'TMAP', 'NIGHT'),
    );

    // Restore ROAD -> TMAP/DEFAULT
    await controller.setMapType(TMapType.road);
    await expectLive(
      'ROAD style restored (TMAP/DEFAULT)',
      () => _isStyle(controller, 'TMAP', 'DEFAULT'),
    );

    // Canvas stays healthy and usable
    await expectLive(
      'vsm canvas healthy across style transitions',
      () => _isCanvasHealthy(controller),
    );
  } finally {
    await unmountLiveMap();
  }
}

/// 2. Traffic layer scenario: tests on/off/on with real SDK lines and detachment verification.
Future<void> _testTrafficLayer() async {
  final controller = await mountLiveMap(
    (created) => TMap(
      center: _seoulCenter,
      zoom: 16,
      onMapCreated: created,
    ),
  );

  try {
    // Traffic ON: real SDK lines attached with non-empty path
    await controller.toggleTrafficInfo(true);
    await expectLive(
      'traffic layer lines attached on toggle true',
      () => _isTrafficAttached(controller),
    );

    // Canvas remains healthy and map stays usable
    await expectLive(
      'map canvas healthy while traffic is visible',
      () => _isCanvasHealthy(controller),
    );

    // Retain original SDK lines plus layer IDs on test-only window property before toggling off
    await expectLive(
      'retain original SDK traffic lines and layer IDs before toggle off',
      () => _retainTrafficLines(controller),
    );

    // Traffic OFF: lines cleared, detached, and absent from VSM layers
    await controller.toggleTrafficInfo(false);
    await expectLive(
      'traffic layer lines detached, registry empty, and layers absent from VSM on toggle false',
      () => _isTrafficDetached(controller),
    );

    // Verify no stale refresh on off
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final stillDetached = await _isTrafficDetached(controller);
    if (!stillDetached) {
      throw StateError(
          'Stale traffic refresh observed after traffic was toggled off');
    }

    // Traffic ON again: lines re-populate and re-attach with new object identities and geometry
    await controller.toggleTrafficInfo(true);
    await expectLive(
      'traffic layer lines re-attached with new instances and geometry on second toggle true',
      () => _isTrafficReattached(controller),
    );
  } finally {
    try {
      await _clearCapturedTraffic(controller);
    } catch (_) {}
    try {
      await controller.toggleTrafficInfo(false);
    } catch (_) {}
    await unmountLiveMap();
  }
}

/// 3. Pitch, bearing, callbacks, zoom extent, and relayout scenario.
Future<void> _testCameraPoseAndControls() async {
  const initialCenter = _seoulCenter;
  const initialZoom = 16;
  const initialBearing = 20.0;
  const initialPitch = 15.0;

  var centerChangeCount = 0;
  LatLng? lastCenter;

  var boundsChangeCount = 0;
  LatLngBounds? lastBounds;

  final recordedZoomTypes = <ZoomType>[];
  bool zoomPhasesInOrder() {
    final firstEnd = recordedZoomTypes.indexOf(ZoomType.end);
    return firstEnd >= 0 &&
        !recordedZoomTypes.skip(firstEnd + 1).contains(ZoomType.start);
  }

  var bearingChangeCount = 0;
  double? lastBearing;

  var pitchChangeCount = 0;
  double? lastPitch;

  var cameraIdleCount = 0;
  LatLng? idleCenter;
  int? idleZoom;
  double? idleBearing;
  double? idlePitch;

  final controller = await mountLiveMap(
    (created) => TMap(
      center: initialCenter,
      zoom: initialZoom,
      bearing: initialBearing,
      pitch: initialPitch,
      onMapCreated: created,
      onCenterChangeCallback: (center, zoom) {
        centerChangeCount++;
        lastCenter = center;
      },
      onBoundsChangeCallback: (bounds) {
        boundsChangeCount++;
        lastBounds = bounds;
      },
      onZoomChangeCallback: (zoom, zoomType) {
        recordedZoomTypes.add(zoomType);
      },
      onBearingChangeCallback: (bearing) {
        bearingChangeCount++;
        lastBearing = bearing;
      },
      onPitchChangeCallback: (pitch) {
        pitchChangeCount++;
        lastPitch = pitch;
      },
      onCameraIdle: (center, zoom, bearing, pitch) {
        cameraIdleCount++;
        idleCenter = center;
        idleZoom = zoom;
        idleBearing = bearing;
        idlePitch = pitch;
      },
    ),
  );

  try {
    // Verify initial pose via real SDK getters
    await expectLive(
      'initial camera pose settled matching initial params',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  if (!m || typeof m.getCenter !== "function" || typeof m.getZoom !== "function") return false;'
        '  var c = m.getCenter();'
        '  if (!c) return false;'
        '  var lat = typeof c.lat === "function" ? c.lat() : (c._lat ?? c.lat);'
        '  var lng = typeof c.lng === "function" ? c.lng() : (c._lng ?? c.lng);'
        '  var z = m.getZoom();'
        '  var b = typeof m.getBearing === "function" ? m.getBearing() : 0;'
        '  var p = typeof m.getPitch === "function" ? m.getPitch() : 0;'
        '  var centerOk = Math.abs(lat - 37.5665) < 0.01 && Math.abs(lng - 126.9780) < 0.01;'
        '  var zoomOk = Math.round(z) === 16;'
        '  var bearingOk = Math.abs(b - 20.0) < 2.0;'
        '  var pitchOk = Math.abs(p - 15.0) < 2.0;'
        '  return centerOk && zoomOk && bearingOk && pitchOk;'
        '})()',
      ),
    );

    // Pitch change: 15 -> 40
    await controller.setPitch(40.0);
    await expectLive(
      'pitch settled at 40 via SDK getter',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  if (!m || typeof m.getPitch !== "function") return false;'
        '  return Math.abs(m.getPitch() - 40.0) < 1.0;'
        '})()',
      ),
    );
    await expectLive(
      'pitch callback received updated pitch',
      () async =>
          pitchChangeCount > 0 &&
          lastPitch != null &&
          (lastPitch! - 40.0).abs() < 2.0,
    );

    // Bearing change: 20 -> 60
    await controller.setBearing(60.0);
    await expectLive(
      'bearing settled at 60 via SDK getter',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  if (!m || typeof m.getBearing !== "function") return false;'
        '  return Math.abs(m.getBearing() - 60.0) < 1.0;'
        '})()',
      ),
    );
    await expectLive(
      'bearing callback received updated bearing',
      () async =>
          bearingChangeCount > 0 &&
          lastBearing != null &&
          (lastBearing! - 60.0).abs() < 2.0,
    );

    // Center change
    await controller.setCenter(_destinationLandmark);
    await expectLive(
      'center shifted to landmark via SDK getter',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  if (!m || typeof m.getCenter !== "function") return false;'
        '  var c = m.getCenter();'
        '  if (!c) return false;'
        '  var lat = typeof c.lat === "function" ? c.lat() : (c._lat ?? c.lat);'
        '  var lng = typeof c.lng === "function" ? c.lng() : (c._lng ?? c.lng);'
        '  return Math.abs(lat - 37.5512) < 0.005 && Math.abs(lng - 126.9882) < 0.005;'
        '})()',
      ),
    );
    await expectLive(
      'center callback fired with landmark position',
      () async =>
          centerChangeCount > 0 &&
          lastCenter != null &&
          (lastCenter!.latitude - _destinationLandmark.latitude).abs() < 0.01 &&
          (lastCenter!.longitude - _destinationLandmark.longitude).abs() < 0.01,
    );

    // Programmatic zooms may emit only Zoom, so ZoomType.start is optional.
    recordedZoomTypes.clear();
    await controller.zoomIn();
    await expectLive(
      'zoomIn incremented SDK zoom to 17',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  return Boolean(m && typeof m.getZoom === "function" && Math.round(m.getZoom()) === 17);'
        '})()',
      ),
    );
    await expectLive(
      'zoomIn callback received ZoomType.end',
      () async => recordedZoomTypes.contains(ZoomType.end),
    );
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!zoomPhasesInOrder()) {
      throw StateError(
        'zoomIn reported end before a later start: $recordedZoomTypes',
      );
    }

    recordedZoomTypes.clear();
    await controller.zoomOut();
    await expectLive(
      'zoomOut restored SDK zoom to 16',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  return Boolean(m && typeof m.getZoom === "function" && Math.round(m.getZoom()) === 16);'
        '})()',
      ),
    );
    await expectLive(
      'zoomOut callback received ZoomType.end',
      () async => recordedZoomTypes.contains(ZoomType.end),
    );
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!zoomPhasesInOrder()) {
      throw StateError(
        'zoomOut reported end before a later start: $recordedZoomTypes',
      );
    }

    // Bounds getter and bounds callback
    await expectLive(
      'bounds getter returned valid non-degenerate bounding box',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  if (!m || typeof m.getBounds !== "function") return false;'
        '  var b = m.getBounds();'
        '  if (!b) return false;'
        '  var sw = b.getSouthWest ? b.getSouthWest() : b._sw;'
        '  var ne = b.getNorthEast ? b.getNorthEast() : b._ne;'
        '  if (!sw || !ne) return false;'
        '  var swLat = typeof sw.lat === "function" ? sw.lat() : (sw._lat ?? sw.lat);'
        '  var neLat = typeof ne.lat === "function" ? ne.lat() : (ne._lat ?? ne.lat);'
        '  return typeof swLat === "number" && typeof neLat === "number" && swLat < neLat;'
        '})()',
      ),
    );
    await expectLive(
      'bounds change callback received valid bounds',
      () async =>
          boundsChangeCount > 0 &&
          lastBounds != null &&
          lastBounds!.southWest.latitude < lastBounds!.northEast.latitude,
    );

    // Camera idle callback payload
    await expectLive(
      'camera idle callback fired with complete pose payload',
      () async =>
          cameraIdleCount > 0 &&
          idleCenter != null &&
          idleZoom != null &&
          idleBearing != null &&
          idlePitch != null,
    );

    // zoomToMaxExtent: zoom shrinks to max extent
    await controller.zoomToMaxExtent();
    await expectLive(
      'zoomToMaxExtent reduced zoom level significantly towards maximum extent',
      () => checkJs(
        controller,
        '(function() {'
        '  var m = (typeof map !== "undefined" && map) ? map : (window.tmap_instances ? Object.values(window.tmap_instances)[0]?.map : null);'
        '  if (!m || typeof m.getZoom !== "function") return false;'
        '  return m.getZoom() <= 12;'
        '})()',
      ),
    );

    // relayout: canvas healthy and map operational
    await controller.relayout();
    await expectLive(
      'map stays usable and vsm canvas intact after relayout',
      () => _isCanvasHealthy(controller),
    );
  } finally {
    await unmountLiveMap();
  }
}

/// Executes all map display scenarios (styles, traffic layer, pitch/bearing/pose/relayout).
///
/// Gathers independent failures so that a style failure does not mask camera failures,
/// while guaranteeing deterministic cleanup and fresh map mounts.
Future<void> testMapDisplay() async {
  final failures = <String>[];

  Future<void> stage(String name, Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      failures.add('[$name] $e');
    }
  }

  await stage('map styles (ROAD, HYBRID, PUBLIC, NIGHT)', _testMapStyles);
  await stage('traffic layer (on/off/on and detachment)', _testTrafficLayer);
  await stage('camera pose, pitch, bearing, zoom extent, relayout',
      _testCameraPoseAndControls);

  if (failures.isNotEmpty) {
    throw StateError('Map display scenario failures:\n${failures.join('\n')}');
  }
}
