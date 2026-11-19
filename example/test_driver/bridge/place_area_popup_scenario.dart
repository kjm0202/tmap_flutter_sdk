import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'native_input_stub.dart' if (dart.library.io) 'native_input.dart';
import 'place_response_capture.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _registry =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';
const _popupId = 'place-area-popup';
const _popupDom = 'place-area-popup-content';
const _rectangleId = 'place-area-rectangle';

Future<void> _tap(TMapController controller, double x, double y) async {
  if (useNativeInput) {
    final view = ui.PlatformDispatcher.instance.implicitView ??
        ui.PlatformDispatcher.instance.views.first;
    final scale = defaultTargetPlatform == TargetPlatform.android
        ? view.devicePixelRatio
        : 1.0;
    await driveNativeInput('tap', x * scale, y * scale);
  } else if (kIsWeb) {
    await checkJs(controller, '''(function() {
      var prior = (window.__tmapTrustedGesture && window.__tmapTrustedGesture.id) || 0;
      window.__tmapTrustedGesture = {id: prior + 1, action: 'tap',
        x: $x, y: $y, done: false};
      return true;
    })()''');
    await expectLive(
      'trusted marker tap host completion',
      () => checkJs(
        controller,
        'window.__tmapTrustedGesture && window.__tmapTrustedGesture.done === true',
      ),
    );
    if (await checkJs(controller, 'window.__tmapTrustedGesture.error')) {
      throw StateError('Trusted marker tap host reported an error');
    }
  } else {
    throw StateError('Android/iOS requires TMAP_GESTURE_PORT for marker tap');
  }
}

Map<String, dynamic> _object(dynamic value) => value is String
    ? Map<String, dynamic>.from(jsonDecode(value) as Map)
    : Map<String, dynamic>.from(value as Map);

Future<Map<String, dynamic>> _rect(TMapController c, String id) async {
  return _object(
    await runJs(c, '''(function() {
    var el = document.getElementById(${jsonEncode(id)});
    if (!el || !el.isConnected) return null;
    var r = el.getBoundingClientRect();
    return {x: r.left, y: r.top, width: r.width, height: r.height};
  })()'''),
  );
}

/// One live journey: page 2 search, rectangular filtering, trusted selection,
/// and a rendered anchor comparison at the selected geographic location.
Future<void> testPlaceAreaPopupScenario() async {
  String? tappedId;
  LatLng? tappedPosition;
  final controller = await mountLiveMap(
    (created) => TMap(
      center: const LatLng(37.5665, 126.978),
      zoom: 13,
      onMapCreated: created,
      onMarkerTap: (id, point, zoom) {
        tappedId = id;
        tappedPosition = point;
      },
    ),
  );
  final markerIds = <String>[];
  try {
    const keyword = '커피';
    const center = LatLng(37.5665, 126.978);
    armPlaceResponseCapture();
    final pois = await controller.searchPoi(
      keyword: keyword,
      count: 20,
      page: 2,
      center: center,
    );
    final captured = takePlaceResponseCapture();
    final query = Map<String, dynamic>.from(captured['query'] as Map);
    if (captured['status'] != 200 ||
        query['searchKeyword'] != keyword ||
        query['page'] != '2' ||
        query['count'] != '20' ||
        query['centerLat'] != center.latitude.toString() ||
        query['centerLon'] != center.longitude.toString()) {
      throw StateError('Unexpected POI request parameters or response status');
    }
    final body = jsonDecode(captured['body'] as String) as Map<String, dynamic>;
    final info = body['searchPoiInfo'] as Map<String, dynamic>?;
    final rows = (info?['pois'] as Map<String, dynamic>?)?['poi'];
    if (rows is! List || rows.isEmpty || pois.length != rows.length) {
      throw StateError('Page 2 response did not match SDK result count');
    }
    for (var i = 0; i < rows.length; i++) {
      final row = Map<String, dynamic>.from(rows[i] as Map);
      final rawId = (row['id'] ?? row['pkey'])?.toString();
      if (rawId == null ||
          rawId.isEmpty ||
          pois[i].id != rawId ||
          pois[i].name != row['name']) {
        throw StateError('Page 2 POI identity mismatch at row $i');
      }
    }

    // Unique usable places, without relying on particular store names or order.
    final unique = <String, PoiItem>{};
    for (final poi in pois) {
      if (poi.id.isNotEmpty &&
          poi.point.latitude.isFinite &&
          poi.point.longitude.isFinite &&
          poi.point.latitude > 30 &&
          poi.point.latitude < 40 &&
          poi.point.longitude > 120 &&
          poi.point.longitude < 135) {
        unique.putIfAbsent(poi.id, () => poi);
      }
    }
    final places = unique.values.toList();
    if (places.length < 2) throw StateError('Insufficient usable page 2 POIs');
    final lons = places.map((p) => p.point.longitude).toSet().toList()..sort();
    if (lons.length < 2) throw StateError('POIs have no longitude spread');
    final cutoff = (lons[(lons.length - 1) ~/ 2] +
            lons[lons.length ~/ 2 + (lons.length.isOdd ? 1 : 0)]) /
        2;
    final lats = places.map((p) => p.point.latitude).toList()..sort();
    // Pad the sampled bounds just enough to show the rectangular filter.
    final latPad = ((lats.last - lats.first) * 0.05).clamp(0.0001, 0.01);
    final lonPad = ((cutoff - lons.first) * 0.05).clamp(0.0001, 0.01);
    final bounds = LatLngBounds(
      southWest: LatLng(lats.first - latPad, lons.first - lonPad),
      northEast: LatLng(lats.last + latPad, cutoff),
    );
    final expectedIds = places
        .where((p) => p.point.longitude <= cutoff)
        .map((p) => p.id)
        .toSet();
    final filtered = places.where((p) => bounds.contains(p.point)).toList();
    final actualIds = filtered.map((p) => p.id).toSet();
    if (actualIds.isEmpty ||
        actualIds.length == places.length ||
        actualIds.length != expectedIds.length ||
        !actualIds.containsAll(expectedIds)) {
      throw StateError('Rectangular filter returned unexpected POI IDs');
    }
    await controller.addRectangle(Rectangle(
      rectangleId: _rectangleId,
      bounds: bounds,
      fillOpacity: 0.1,
      strokeWidth: 2,
    ));
    await expectLive('filter rectangle attached to map',
        () => checkJs(controller, '''(function() {
      var shape = $_registry.rectangles && $_registry.rectangles['$_rectangleId'];
      return !!shape && !!shape.getMap && shape.getMap() === map;
    })()'''));
    await controller.fitBounds(bounds, padding: 60);
    final markerByPoi = <String, String>{};
    for (var i = 0; i < places.length; i++) {
      final markerId = 'place-area-marker-$i';
      markerIds.add(markerId);
      markerByPoi[places[i].id] = markerId;
      await controller.addMarker(
        Marker(
          markerId: markerId,
          position: places[i].point,
          icon: MarkerIcon(
            iconHtml:
                '<div id="$markerId" style="width:28px;height:28px;background:#1976d2;border:2px solid white;box-sizing:border-box"></div>',
            size: const Size(28, 28),
          ),
        ),
      );
    }
    Future<bool> attachments(Set<String> expected) =>
        checkJs(controller, '''(function() {
      var registry = $_registry;
      var all = ${jsonEncode(markerIds)}, expected = ${jsonEncode(expected.toList())};
      return all.every(function(id) {
        var marker = registry.markers && registry.markers[id];
        return (!!marker && marker.getMap && marker.getMap() === map) === expected.includes(id);
      });
    })()''');
    await expectLive(
      'all page 2 markers attached',
      () => attachments(markerIds.toSet()),
    );
    await checkJs(controller, '''(function() {
      var registry = $_registry;
      window.__placeAreaOriginals = {};
      ${jsonEncode(markerIds)}.forEach(function(id) { window.__placeAreaOriginals[id] = registry.markers[id]; });
      return true;
    })()''');
    final remainingMarkers = actualIds.map((id) => markerByPoi[id]!).toSet();
    for (final id in markerIds.where((id) => !remainingMarkers.contains(id))) {
      await controller.clearMarker(id);
    }
    await expectLive(
      'filtered marker attachments and removed objects detached',
      () async =>
          await attachments(remainingMarkers) &&
          await checkJs(controller, '''(function() {
        var all = ${jsonEncode(markerIds)}, remaining = ${jsonEncode(remainingMarkers.toList())};
        return all.every(function(id) {
          var m = window.__placeAreaOriginals[id];
          return m && m.getMap && (remaining.includes(id) ? m.getMap() === map : m.getMap() == null);
        });
      })()'''),
    );

    // Prefer a geographically isolated remaining result so a trusted tap does
    // not hit a different marker that happens to overlap it on screen.
    double separation(PoiItem p) => places
        .where((other) => other.id != p.id)
        .map((other) =>
            (other.point.latitude - p.point.latitude).abs() +
            (other.point.longitude - p.point.longitude).abs())
        .reduce((a, b) => a < b ? a : b);
    filtered.sort((a, b) => separation(b).compareTo(separation(a)));
    final selected = filtered.first;
    final selectedMarker = markerByPoi[selected.id]!;
    await controller.setCenter(selected.point);
    await controller.setZoom(18);
    await expectLive(
      'selected marker visible',
      () => checkJs(controller, '''(function() {
      var el = document.getElementById(${jsonEncode(selectedMarker)});
      if (!el || !el.isConnected) return false;
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 &&
          r.right <= innerWidth && r.bottom <= innerHeight;
    })()'''),
    );
    // Wait for the camera animation to settle before reading screen positions.
    await Future<void>.delayed(const Duration(milliseconds: 800));
    final markerRect = await _rect(controller, selectedMarker);
    await _tap(
      controller,
      (markerRect['x'] as num).toDouble() +
          (markerRect['width'] as num).toDouble() / 2,
      (markerRect['y'] as num).toDouble() +
          (markerRect['height'] as num).toDouble() / 2,
    );
    await expectLive(
      'selected marker tap callback',
      () async => tappedId != null,
    );
    if (tappedId != selectedMarker ||
        tappedPosition == null ||
        (tappedPosition!.latitude - selected.point.latitude).abs() > 0.00001 ||
        (tappedPosition!.longitude - selected.point.longitude).abs() >
            0.00001) {
      throw StateError('Tapped marker did not match selected remaining POI');
    }

    Future<Map<String, dynamic>> popup(String anchor) async {
      await controller.addInfoWindow(
        InfoWindow(
          infoWindowId: _popupId,
          position: selected.point,
          anchor: anchor,
          type: 2,
          content:
              '<div id="$_popupDom" style="width:120px;height:60px;background:white">Selected place</div>',
        ),
      );
      await expectLive(
        '$anchor InfoWindow rendered at selected position',
        () => checkJs(controller, '''(function() {
        var el = document.getElementById('$_popupDom');
        var iw = $_registry.infoWindows && $_registry.infoWindows['$_popupId'];
        if (!el || !el.isConnected || !iw || !iw.getPosition) return false;
        var p = iw.getPosition(), r = el.getBoundingClientRect();
        return Math.abs(p.lat() - ${selected.point.latitude}) < 0.00001 &&
          Math.abs(p.lng() - ${selected.point.longitude}) < 0.00001 && r.width > 0 && r.height > 0;
      })()'''),
      );
      await Future<void>.delayed(const Duration(milliseconds: 300));
      return _object(await runJs(controller, '''(function() {
        var r = document.getElementById('$_popupDom').getBoundingClientRect();
        var p = map.realToScreen(new Tmapv3.LatLng(${selected.point.latitude}, ${selected.point.longitude}));
        return {x:r.left, y:r.top, px:typeof p.getX === 'function' ? p.getX() : p.x, py:typeof p.getY === 'function' ? p.getY() : p.y};
      })()'''));
    }

    // Tmapv3 itself is the oracle for anchor semantics. A same-sized popup at
    // the exact same coordinate avoids guessing whether "top" names the
    // popup's attachment point or the side of the geographic point.
    Future<Map<String, dynamic>> reference(String anchor) async {
      final referenceDom = 'place-area-reference-$anchor';
      await checkJs(controller, '''(function() {
        if (window.__placeReference) window.__placeReference.setMap(null);
        window.__placeReference = new Tmapv3.InfoWindow({
          map: map, position: new Tmapv3.LatLng(${selected.point.latitude}, ${selected.point.longitude}),
          anchor: ${jsonEncode(anchor)}, type: 2,
          content: '<div id="$referenceDom" style="width:120px;height:60px;background:white">Selected place</div>'
        });
        return true;
      })()''');
      await expectLive(
          'original Tmapv3 $anchor popup rendered',
          () => checkJs(controller,
              '!!document.getElementById("$referenceDom") && document.getElementById("$referenceDom").isConnected'));
      await Future<void>.delayed(const Duration(milliseconds: 300));
      return _object(await runJs(controller, '''(function() {
        var r = document.getElementById('$referenceDom').getBoundingClientRect();
        var p = map.realToScreen(new Tmapv3.LatLng(${selected.point.latitude}, ${selected.point.longitude}));
        return {x:r.left, y:r.top, px:typeof p.getX === 'function' ? p.getX() : p.x, py:typeof p.getY === 'function' ? p.getY() : p.y};
      })()'''));
    }

    final bottom = await popup('bottom');
    final referenceBottom = await reference('bottom');
    final top = await popup('top');
    final referenceTop = await reference('top');
    double n(Map<String, dynamic> value, String key) =>
        (value[key] as num).toDouble();
    final dx = n(top, 'x') - n(bottom, 'x');
    final dy = n(top, 'y') - n(bottom, 'y');
    final expectedDx = n(referenceTop, 'x') - n(referenceBottom, 'x');
    final expectedDy = n(referenceTop, 'y') - n(referenceBottom, 'y');
    final observations = [bottom, referenceBottom, top, referenceTop];
    if (observations.any((item) =>
        (n(item, 'px') - n(bottom, 'px')).abs() > 1 ||
        (n(item, 'py') - n(bottom, 'py')).abs() > 1)) {
      throw StateError('Map projection moved during popup anchor comparison');
    }
    if (expectedDy.abs() < 3 ||
        dy * expectedDy <= 0 ||
        (dy - expectedDy).abs() > 2 ||
        (dx - expectedDx).abs() > 2) {
      throw StateError(
          'Popup anchor displacement differs from original Tmapv3');
    }
    debugPrint(
      'PLACE_AREA_POPUP ${jsonEncode({
            'page': 2,
            'results': pois.length,
            'usable': places.length,
            'remaining': actualIds.length,
            'removed': places.length - actualIds.length,
            'anchorDeltaX': dx,
            'anchorDeltaY': dy
          })}',
    );
  } finally {
    disarmPlaceResponseCapture();
    await checkJs(controller,
        '(function() { if (window.__placeReference) window.__placeReference.setMap(null); delete window.__placeReference; return true; })()');
    await controller.clearInfoWindow(_popupId);
    await controller.clearRectangle(_rectangleId);
    for (final id in markerIds) {
      await controller.clearMarker(id);
    }
    await checkJs(controller, 'delete window.__placeAreaOriginals');
    await unmountLiveMap();
  }
}
