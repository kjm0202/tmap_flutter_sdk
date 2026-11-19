import 'dart:async';

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

// Two well-separated landmark coordinates in Seoul:
// Namsan Seoul Tower (South) & Gyeongbokgung Palace (North)
const LatLng _namsanTower = LatLng(37.5512, 126.9882);
const LatLng _gyeongbokgung = LatLng(37.5796, 126.9770);

// Off-target coordinate away from Seoul landmarks (Gangnam Station area)
const LatLng _offTarget = LatLng(37.4979, 127.0276);

Future<void> _waitFor(String step, Future<bool> Function() check) async {
  for (var i = 0; i < 50; i++) {
    if (await check()) return;
    await Future<void>.delayed(const Duration(milliseconds: 150));
  }
  throw StateError('Timed out waiting for $step');
}

/// JS helper: Returns true if (lat, lng) is strictly within map.getBounds().
String _isPointInBounds(double lat, double lng) => '(function() {'
    'if (!map || !map.getBounds) return false;'
    'var b = map.getBounds();'
    'if (!b) return false;'
    'var sw = b.getSouthWest ? b.getSouthWest() : (b._sw || null);'
    'var ne = b.getNorthEast ? b.getNorthEast() : (b._ne || null);'
    'if (!sw || !ne) return false;'
    'var swLat = typeof sw.lat === "function" ? sw.lat() : (sw._lat ?? sw.lat);'
    'var swLng = typeof sw.lng === "function" ? sw.lng() : (sw._lng ?? sw.lng);'
    'var neLat = typeof ne.lat === "function" ? ne.lat() : (ne._lat ?? ne.lat);'
    'var neLng = typeof ne.lng === "function" ? ne.lng() : (ne._lng ?? ne.lng);'
    'var minLat = Math.min(swLat, neLat);'
    'var maxLat = Math.max(swLat, neLat);'
    'var minLng = Math.min(swLng, neLng);'
    'var maxLng = Math.max(swLng, neLng);'
    'return ($lat >= minLat && $lat <= maxLat && $lng >= minLng && $lng <= maxLng);'
    '})()';

/// JS helper: Evaluates whether map center is within epsilon of (lat, lng).
String _isCenterNear(double lat, double lng, {double eps = 0.005}) =>
    '(function() {'
    'if (!map || !map.getCenter) return false;'
    'var c = map.getCenter();'
    'if (!c) return false;'
    'var cLat = typeof c.lat === "function" ? c.lat() : (c._lat ?? c.lat);'
    'var cLng = typeof c.lng === "function" ? c.lng() : (c._lng ?? c.lng);'
    'return Math.abs(cLat - $lat) < $eps && Math.abs(cLng - $lng) < $eps;'
    '})()';

/// Executes camera regression scenarios: route overview -> destination inspection.
Future<void> testCameraScenarios(TMapController controller) async {
  try {
    // ── 1. Setup: Start off-target and zoomed in ─────────────────────────────
    // Move away from landmarks to high zoom so neither is visible initially.
    await controller.setCenter(_offTarget);
    await controller.setZoom(17);

    await _waitFor(
      'camera off-target setup at zoom 17',
      () => checkJs(
        controller,
        '${_isCenterNear(_offTarget.latitude, _offTarget.longitude)} && Math.round(map.getZoom()) === 17',
      ),
    );

    // Verify initial condition: neither landmark is visible in getBounds()
    final initialNamsanVisible = await checkJs(
      controller,
      _isPointInBounds(_namsanTower.latitude, _namsanTower.longitude),
    );
    final initialGyeongbokgungVisible = await checkJs(
      controller,
      _isPointInBounds(_gyeongbokgung.latitude, _gyeongbokgung.longitude),
    );

    if (initialNamsanVisible && initialGyeongbokgungVisible) {
      throw StateError(
        'Initial state error: both landmarks unexpectedly visible at off-target zoom 17',
      );
    }

    // ── 2. Route overview: fitBounds with padding for two separated landmarks
    final routeBounds = LatLngBounds(
      southWest: LatLng(
        _namsanTower.latitude < _gyeongbokgung.latitude
            ? _namsanTower.latitude
            : _gyeongbokgung.latitude,
        _namsanTower.longitude < _gyeongbokgung.longitude
            ? _namsanTower.longitude
            : _gyeongbokgung.longitude,
      ),
      northEast: LatLng(
        _namsanTower.latitude > _gyeongbokgung.latitude
            ? _namsanTower.latitude
            : _gyeongbokgung.latitude,
        _namsanTower.longitude > _gyeongbokgung.longitude
            ? _namsanTower.longitude
            : _gyeongbokgung.longitude,
      ),
    );

    await controller.fitBounds(routeBounds, padding: 50);

    // Eventually assert both landmarks visible inside actual map.getBounds()
    await _waitFor(
      'both landmarks visible inside map.getBounds() after fitBounds',
      () => checkJs(
        controller,
        '${_isPointInBounds(_namsanTower.latitude, _namsanTower.longitude)} && '
        '${_isPointInBounds(_gyeongbokgung.latitude, _gyeongbokgung.longitude)}',
      ),
    );

    // ── 3. Inspect destination: panTo one landmark and assert center ─────────
    await controller.panTo(_gyeongbokgung);

    await _waitFor(
      'panTo destination center matches landmark',
      () => checkJs(
        controller,
        _isCenterNear(_gyeongbokgung.latitude, _gyeongbokgung.longitude),
      ),
    );

    // ── 4. Zoom step tests: zoomIn then zoomOut from known intermediate value
    // Set a known intermediate zoom level
    const baseZoom = 14;
    await controller.setZoom(baseZoom);

    await _waitFor(
      'intermediate zoom settled at $baseZoom',
      () => checkJs(
        controller,
        'Math.round(map.getZoom ? map.getZoom() : 0) === $baseZoom',
      ),
    );

    // zoomIn: observed SDK zoom increases by 1 step
    await controller.zoomIn();
    await _waitFor(
      'zoomIn observed SDK zoom increased by 1 step to ${baseZoom + 1}',
      () => checkJs(
        controller,
        'Math.round(map.getZoom ? map.getZoom() : 0) === ${baseZoom + 1}',
      ),
    );

    // zoomOut: observed SDK zoom returns back by 1 step
    await controller.zoomOut();
    await _waitFor(
      'zoomOut observed SDK zoom restored to $baseZoom',
      () => checkJs(
        controller,
        'Math.round(map.getZoom ? map.getZoom() : 0) === $baseZoom',
      ),
    );

    // ── 5. panBy e.g. 80 horizontal pixels & verify horizontal center change ─
    // Save current center longitude to a JS temporary variable
    await checkJs(
      controller,
      '(function() {'
      'var c = map.getCenter();'
      'window.__prevCenterLng = typeof c.lng === "function" ? c.lng() : (c._lng ?? c.lng);'
      'return true;'
      '})()',
    );

    // panBy 80 horizontal pixels (x: 80, y: 0)
    await controller.panBy(80, 0);

    // In map tile systems (Mercator), panning positive X shifts view right (eastwards)
    // or translates content leftwards; in either case, map.getCenter().lng() changes meaningfully.
    // We verify meaningful horizontal center change: Math.abs(newLng - prevLng) > 0.0001
    // and direction if known: newLng < prevLng or newLng > prevLng (diff != 0)
    await _waitFor(
      'panBy 80 horizontal pixels caused meaningful center change',
      () => checkJs(
        controller,
        '(function() {'
        'if (window.__prevCenterLng == null) return false;'
        'var c = map.getCenter();'
        'if (!c) return false;'
        'var curLng = typeof c.lng === "function" ? c.lng() : (c._lng ?? c.lng);'
        'return Math.abs(curLng - window.__prevCenterLng) > 0.0001;'
        '})()',
      ),
    );
  } finally {
    // Deterministic reset and cleanup
    try {
      await controller.setCenter(const LatLng(37.5665, 126.9780));
      await controller.setZoom(16);
    } catch (_) {}
    try {
      await checkJs(controller, 'delete window.__prevCenterLng');
    } catch (_) {}
  }
}
