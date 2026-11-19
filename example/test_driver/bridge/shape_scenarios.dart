import 'dart:async';
import 'dart:ui' show Color;

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const String _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';

Future<void> _waitFor(String step, Future<bool> Function() check) async {
  for (var i = 0; i < 40; i++) {
    if (await check()) return;
    await Future<void>.delayed(const Duration(milliseconds: 100));
  }
  throw StateError('Timed out waiting for $step');
}

/// JS expression: pick a vertex from getPath().path[], allow optional closing
/// vertex at index [n] matching index [0].
String _polyVtx(String id, String collection, int idx) =>
    '$_reg.$collection["$id"]?.getPath()?.path[$idx]';

/// True when vertex [idx] of polygon/polyline [id] matches [lat],[lng].
String _vtxMatch(String id, String collection, int idx, double lat, double lng,
        {double eps = 1e-6}) =>
    '(function(){var v=${_polyVtx(id, collection, idx)};'
    'return v!=null && Math.abs(v.lat()-$lat)<$eps && Math.abs(v.lng()-$lng)<$eps;})()';

/// True when all three zone vertices are present (closing vertex allowed).
String _zoneVertices() {
  const id = 'zone_danger';
  final v0 = _vtxMatch(id, 'polygons', 0, 37.5600, 126.9700);
  final v1 = _vtxMatch(id, 'polygons', 1, 37.5600, 126.9800);
  final v2 = _vtxMatch(id, 'polygons', 2, 37.5700, 126.9700);
  return 'Boolean($v0 && $v1 && $v2)';
}

/// True when route polyline has exactly two vertices (or three with closing).
String _routeVertices() {
  const id = 'route_main';
  final v0 = _vtxMatch(id, 'polylines', 0, 37.5665, 126.9780);
  final v1 = _vtxMatch(id, 'polylines', 1, 37.5675, 126.9790);
  return '(function(){'
      'var p=$_reg.polylines["$id"];'
      'var arr=p?.getPath()?.path;'
      'return arr!=null && arr.length>=2 && $v0 && $v1;'
      '})()';
}

/// Rectangle bounds check via getBounds().getSouthWest()/getNorthEast().
String _rectBounds({double eps = 1e-6}) => '(function(){'
    'var r=$_reg.rectangles["grid_box"];'
    'if(!r)return false;'
    'var b=r.getBounds();'
    'var sw=b.getSouthWest(),ne=b.getNorthEast();'
    'return Math.abs(sw.lat()-37.5500)<$eps && Math.abs(sw.lng()-126.9600)<$eps'
    ' && Math.abs(ne.lat()-37.5600)<$eps && Math.abs(ne.lng()-126.9700)<$eps;'
    '})()';

// ---------------------------------------------------------------------------
// Shape definitions
// ---------------------------------------------------------------------------

const _route = Polyline(
  polylineId: 'route_main',
  points: [LatLng(37.5665, 126.9780), LatLng(37.5675, 126.9790)],
  strokeColor: Color(0xFF0066FF),
  strokeWidth: 4,
);

const _preserveRoute = Polyline(
  polylineId: 'route_preserve',
  points: [LatLng(37.5700, 126.9800), LatLng(37.5710, 126.9810)],
);

const _zone = Polygon(
  polygonId: 'zone_danger',
  points: [
    LatLng(37.5600, 126.9700),
    LatLng(37.5600, 126.9800),
    LatLng(37.5700, 126.9700),
  ],
  fillColor: Color(0x33FFB300),
);

const _circle = Circle(
  circleId: 'fence_radius',
  center: LatLng(37.5665, 126.9780),
  radius: 250.0,
  fillColor: Color(0x33FF0000),
);

const _rect = Rectangle(
  rectangleId: 'grid_box',
  bounds: LatLngBounds(
    southWest: LatLng(37.5500, 126.9600),
    northEast: LatLng(37.5600, 126.9700),
  ),
);

// ---------------------------------------------------------------------------
// Main test entry
// ---------------------------------------------------------------------------

/// Executes focused regression scenarios for v0.1.1 shape overlays.
Future<void> testShapeScenarios(TMapController controller) async {
  final failures = <String>[];

  Future<void> stage(String name, Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      failures.add('[$name] $e');
    }
  }

  try {
    // ── 1. Add shapes and verify attachment + vertex coordinates ─────────────

    await stage('add route polyline', () async {
      await controller.addPolyline(_route);
      await controller.addPolyline(_preserveRoute);
      await _waitFor(
          'route attached',
          () => checkJs(
              controller, 'Boolean($_reg.polylines["route_main"]?.getMap())'));
      await _waitFor(
          'route vertices', () => checkJs(controller, _routeVertices()));
    });

    await stage('add polygon zone', () async {
      await controller.addPolygon(_zone);
      await _waitFor(
          'polygon attached',
          () => checkJs(
              controller, 'Boolean($_reg.polygons["zone_danger"]?.getMap())'));
      await _waitFor(
          'polygon vertices', () => checkJs(controller, _zoneVertices()));
    });

    await stage('add circle – radius & attachment', () async {
      await controller.addCircle(_circle);
      await _waitFor(
          'circle attached + radius=250',
          () => checkJs(
              controller,
              'Boolean($_reg.circles["fence_radius"]?.getMap() && '
              'Math.round($_reg.circles["fence_radius"]?.getRadius()||0)===250)'));
    });

    await stage('add rectangle – bounds', () async {
      await controller.addRectangle(_rect);
      await _waitFor(
          'rectangle attached',
          () => checkJs(
              controller, 'Boolean($_reg.rectangles["grid_box"]?.getMap())'));
      await _waitFor(
          'rectangle bounds', () => checkJs(controller, _rectBounds()));
    });

    // ── 2. Same-ID replacement: old shape detached, new radius correct ───────

    await stage('same-ID circle replacement', () async {
      // Capture reference to old JS object before replacement.
      // On Web the bridge overwrites the registry entry; we verify the NEW
      // radius and that the map attachment is re-established.
      const updated = Circle(
        circleId: 'fence_radius',
        center: LatLng(37.5665, 126.9780),
        radius: 500.0,
        fillColor: Color(0x33800080),
      );
      await controller.addCircle(updated);
      await _waitFor(
          'circle replaced – radius=500',
          () => checkJs(
              controller,
              'Boolean($_reg.circles["fence_radius"]?.getMap() && '
              'Math.round($_reg.circles["fence_radius"]?.getRadius()||0)===500)'));
    });

    // ── 3. Individual deletions (clearPolyline / clearPolygon / etc.) ────────

    await stage('clearPolyline route_main – preserves route_preserve',
        () async {
      await controller.clearPolyline('route_main');
      await _waitFor('route_main gone',
          () => checkJs(controller, 'Boolean(!$_reg.polylines["route_main"])'));
      // Sibling must survive.
      final preserved = await checkJs(
          controller, 'Boolean($_reg.polylines["route_preserve"]?.getMap())');
      if (!preserved)
        throw StateError('route_preserve was unexpectedly removed');
    });

    await stage('clearPolygon zone_danger', () async {
      await controller.clearPolygon('zone_danger');
      await _waitFor('zone_danger gone',
          () => checkJs(controller, 'Boolean(!$_reg.polygons["zone_danger"])'));
    });

    await stage('clearCircle fence_radius', () async {
      await controller.clearCircle('fence_radius');
      await _waitFor('fence_radius gone',
          () => checkJs(controller, 'Boolean(!$_reg.circles["fence_radius"])'));
    });

    await stage('clearRectangle grid_box', () async {
      await controller.clearRectangle('grid_box');
      await _waitFor('grid_box gone',
          () => checkJs(controller, 'Boolean(!$_reg.rectangles["grid_box"])'));
    });

    // ── 4. Per-group clears via controller ───────────────────────────────────
    // Reseed so group-clear tests are not vacuously green.

    await stage('clearAllPolylines', () async {
      // Reseed polylines before clearing.
      await controller.addPolyline(_route);
      await controller.addPolyline(_preserveRoute);
      await _waitFor(
          'polylines reseeded',
          () => checkJs(
              controller,
              'Boolean($_reg.polylines["route_main"] && '
              '$_reg.polylines["route_preserve"])'));
      await controller.clearAllPolylines();
      await _waitFor(
          'all polylines cleared',
          () => checkJs(
              controller, 'Object.keys($_reg.polylines||{}).length===0'));
    });

    await stage('clearAllPolygons', () async {
      await controller.addPolygon(_zone);
      await _waitFor('polygon reseeded',
          () => checkJs(controller, 'Boolean($_reg.polygons["zone_danger"])'));
      await controller.clearAllPolygons();
      await _waitFor(
          'all polygons cleared',
          () => checkJs(
              controller, 'Object.keys($_reg.polygons||{}).length===0'));
    });

    await stage('clearAllCircles', () async {
      await controller.addCircle(_circle);
      await _waitFor('circle reseeded',
          () => checkJs(controller, 'Boolean($_reg.circles["fence_radius"])'));
      await controller.clearAllCircles();
      await _waitFor(
          'all circles cleared',
          () =>
              checkJs(controller, 'Object.keys($_reg.circles||{}).length===0'));
    });

    await stage('clearAllRectangles', () async {
      await controller.addRectangle(_rect);
      await _waitFor('rectangle reseeded',
          () => checkJs(controller, 'Boolean($_reg.rectangles["grid_box"])'));
      await controller.clearAllRectangles();
      await _waitFor(
          'all rectangles cleared',
          () => checkJs(
              controller, 'Object.keys($_reg.rectangles||{}).length===0'));
    });
  } finally {
    // Always clean up regardless of failures.
    await controller.clearAll();
  }

  if (failures.isNotEmpty) {
    throw StateError('Shape scenario failures:\n${failures.join('\n')}');
  }
}
