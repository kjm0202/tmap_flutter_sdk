import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const String _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';

const LatLng _center = LatLng(37.5665, 126.9780);

const Marker _anchorMarker = Marker(
  markerId: 'anchor_marker',
  position: LatLng(37.5660, 126.9770),
  icon: MarkerIcon(iconHtml: '<span id="anchor-marker-dom">ANCHOR</span>'),
);

String _anchorAlive() => '''(function() {
  var reg = $_reg;
  var mkrs = (reg && reg.markers) || (typeof markers !== 'undefined' ? markers : null);
  var item = mkrs ? mkrs["anchor_marker"] : null;
  if (!item) return false;
  if (typeof item.getMap === 'function' && item.getMap() == null) return false;
  var el = document.getElementById("anchor-marker-dom");
  return el != null && (el.isConnected !== undefined ? el.isConnected : document.contains(el));
})()''';

String _labelAttached(String labelId, String expectedContent,
    String expectedFontSize, Color expectedColor) {
  final hex = expectedColor.toHexColor().toLowerCase();
  return '''(function() {
    var reg = $_reg;
    var mapObj = (reg && reg.map) || (typeof map !== 'undefined' ? map : null);
    var lbls = (reg && reg.labels) || (typeof labels !== 'undefined' ? labels : null);
    if (!lbls || !lbls["$labelId"]) return false;
    var l = lbls["$labelId"];
    if (!l) return false;
    if (l._label_data) {
      var layerId = l._label_data.layerId;
      if (!mapObj || !mapObj.vsmMap || typeof mapObj.vsmMap().hasLayer !== 'function') return false;
      if (!mapObj.vsmMap().hasLayer(layerId)) return false;
      var opts = l._label_data.options;
      if (!opts) return false;
      if (opts.content !== "$expectedContent") return false;
      if (opts.fontSize !== "$expectedFontSize") return false;
      if (opts.fontColor && opts.fontColor.toLowerCase() !== "$hex") return false;
      return true;
    }
    if (typeof l.getMap === 'function' && l.getMap() != null) return true;
    return false;
  })()''';
}

String _saveLabelLayer(String labelId) => '''(function() {
  var reg = $_reg;
  var lbls = (reg && reg.labels) || (typeof labels !== 'undefined' ? labels : null);
  var l = lbls ? lbls["$labelId"] : null;
  window["__layer_" + "$labelId"] = l && l._label_data ? l._label_data.layerId : null;
  return true;
})()''';

String _oldLabelLayerDetached(String labelId) => '''(function() {
  var reg = $_reg;
  var mapObj = (reg && reg.map) || (typeof map !== 'undefined' ? map : null);
  var oldLayerId = window["__layer_" + "$labelId"];
  if (!oldLayerId) return true;
  if (!mapObj || !mapObj.vsmMap || typeof mapObj.vsmMap().hasLayer !== 'function') return true;
  return !mapObj.vsmMap().hasLayer(oldLayerId);
})()''';

String _labelGone(String labelId) => '''(function() {
  var reg = $_reg;
  var mapObj = (reg && reg.map) || (typeof map !== 'undefined' ? map : null);
  var lbls = (reg && reg.labels) || (typeof labels !== 'undefined' ? labels : null);
  if (lbls && lbls["$labelId"]) return false;
  var oldLayerId = window["__layer_" + "$labelId"];
  if (oldLayerId && mapObj && mapObj.vsmMap && typeof mapObj.vsmMap().hasLayer === 'function') {
    if (mapObj.vsmMap().hasLayer(oldLayerId)) return false;
  }
  return true;
})()''';

String _allLabelsGone() => '''(function() {
  var reg = $_reg;
  var lbls = (reg && reg.labels) || (typeof labels !== 'undefined' ? labels : null);
  return !lbls || Object.keys(lbls).length === 0;
})()''';

String _customOverlayAttached(String id, String domId, String text,
        int expectedX, int expectedY) =>
    '''(function() {
  var reg = $_reg;
  var cos = (reg && reg.customOverlays) || (typeof customOverlays !== 'undefined' ? customOverlays : null);
  if (!cos || !cos["$id"]) return false;
  var co = cos["$id"];
  if (typeof co.getMap === 'function' && co.getMap() == null) return false;
  var el = document.getElementById("$domId");
  if (!el) return false;
  var connected = el.isConnected !== undefined ? el.isConnected : document.contains(el);
  if (!connected) return false;
  if ("$text".length > 0 && (el.textContent || "").indexOf("$text") === -1) return false;
  var off = (typeof co.getOffset === 'function') ? co.getOffset() : (co._iw_data && co._iw_data.options && co._iw_data.options.offset);
  if (off) {
    var x = (typeof off.getX === 'function') ? off.getX() : (off._x !== undefined ? off._x : off.x);
    var y = (typeof off.getY === 'function') ? off.getY() : (off._y !== undefined ? off._y : off.y);
    if (Math.round(x) !== $expectedX || Math.round(y) !== $expectedY) return false;
  }
  return true;
})()''';

String _domDetached(String domId) => '''(function() {
  var el = document.getElementById("$domId");
  if (!el) return true;
  var connected = el.isConnected !== undefined ? el.isConnected : document.contains(el);
  return !connected;
})()''';

String _allCustomOverlaysGone(List<String> domIds) => '''(function() {
  var reg = $_reg;
  var cos = (reg && reg.customOverlays) || (typeof customOverlays !== 'undefined' ? customOverlays : null);
  if (cos && Object.keys(cos).length > 0) return false;
  var doms = ${jsonEncode(domIds)};
  for (var i = 0; i < doms.length; i++) {
    var el = document.getElementById(doms[i]);
    if (el && (el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;
  }
  return true;
})()''';

String _batchMarkersAttached(List<String> markerIds, List<String> domIds) =>
    '''(function() {
  var reg = $_reg;
  var mkrs = (reg && reg.markers) || (typeof markers !== 'undefined' ? markers : null);
  if (!mkrs) return false;
  var mIds = ${jsonEncode(markerIds)};
  var dIds = ${jsonEncode(domIds)};
  for (var i = 0; i < mIds.length; i++) {
    var m = mkrs[mIds[i]];
    if (!m) return false;
    if (typeof m.getMap === 'function' && m.getMap() == null) return false;
    var el = document.getElementById(dIds[i]);
    if (!el || !(el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;
  }
  return true;
})()''';

String _batchMarkersCleared(List<String> markerIds, List<String> domIds) =>
    '''(function() {
  var reg = $_reg;
  var mkrs = (reg && reg.markers) || (typeof markers !== 'undefined' ? markers : null);
  var mIds = ${jsonEncode(markerIds)};
  var dIds = ${jsonEncode(domIds)};
  if (mkrs) {
    for (var i = 0; i < mIds.length; i++) {
      if (mkrs[mIds[i]]) return false;
    }
  }
  for (var i = 0; i < dIds.length; i++) {
    var el = document.getElementById(dIds[i]);
    if (el && (el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;
  }
  return true;
})()''';

String _shapesRendered({required int expectedRadius}) => '''(function() {
  var reg = $_reg;
  var pls = (reg && reg.polylines) || (typeof polylines !== 'undefined' ? polylines : null);
  var pgs = (reg && reg.polygons) || (typeof polygons !== 'undefined' ? polygons : null);
  var cs = (reg && reg.circles) || (typeof circles !== 'undefined' ? circles : null);
  var rs = (reg && reg.rectangles) || (typeof rectangles !== 'undefined' ? rectangles : null);
  if (!pls || Object.keys(pls).length === 0) return false;
  if (!pgs || Object.keys(pgs).length === 0) return false;
  if (!cs || Object.keys(cs).length === 0) return false;
  if (!rs || Object.keys(rs).length === 0) return false;
  var cKeys = Object.keys(cs);
  var c = cs[cKeys[cKeys.length - 1]];
  if (!c || (typeof c.getMap === 'function' && c.getMap() == null)) return false;
  var r = typeof c.getRadius === 'function' ? c.getRadius() : 0;
  if (Math.round(r) !== $expectedRadius) return false;
  var rKeys = Object.keys(rs);
  var rect = rs[rKeys[rKeys.length - 1]];
  if (!rect || (typeof rect.getMap === 'function' && rect.getMap() == null)) return false;
  return true;
})()''';

String _polylinesAndPolygonsRemovedCirclesAndRectanglesPreserved() =>
    '''(function() {
  var reg = $_reg;
  var pls = (reg && reg.polylines) || (typeof polylines !== 'undefined' ? polylines : null) || {};
  var pgs = (reg && reg.polygons) || (typeof polygons !== 'undefined' ? polygons : null) || {};
  var cs = (reg && reg.circles) || (typeof circles !== 'undefined' ? circles : null) || {};
  var rs = (reg && reg.rectangles) || (typeof rectangles !== 'undefined' ? rectangles : null) || {};
  if (Object.keys(pls).length !== 0) return false;
  if (Object.keys(pgs).length !== 0) return false;
  if (Object.keys(cs).length === 0) return false;
  if (Object.keys(rs).length === 0) return false;
  var cKeys = Object.keys(cs);
  var rKeys = Object.keys(rs);
  var c = cs[cKeys[cKeys.length - 1]];
  var r = rs[rKeys[rKeys.length - 1]];
  return (c && (typeof c.getMap !== 'function' || c.getMap() != null)) &&
         (r && (typeof r.getMap !== 'function' || r.getMap() != null));
})()''';

String _mixedPreconditionSatisfied() => '''(function() {
  var reg = $_reg;
  var mkrs = (reg && reg.markers) || (typeof markers !== 'undefined' ? markers : null) || {};
  var cl = (reg && reg.clusterer) || (typeof markerCluster !== 'undefined' ? markerCluster : null);
  var lbls = (reg && reg.labels) || (typeof labels !== 'undefined' ? labels : null) || {};
  var cos = (reg && reg.customOverlays) || (typeof customOverlays !== 'undefined' ? customOverlays : null) || {};
  var pls = (reg && reg.polylines) || (typeof polylines !== 'undefined' ? polylines : null) || {};
  var pgs = (reg && reg.polygons) || (typeof polygons !== 'undefined' ? polygons : null) || {};
  var cs = (reg && reg.circles) || (typeof circles !== 'undefined' ? circles : null) || {};
  var rs = (reg && reg.rectangles) || (typeof rectangles !== 'undefined' ? rectangles : null) || {};

  return Object.keys(mkrs).length > 0 &&
         cl != null &&
         Object.keys(lbls).length > 0 &&
         Object.keys(cos).length > 0 &&
         Object.keys(pls).length > 0 &&
         Object.keys(pgs).length > 0 &&
         Object.keys(cs).length > 0 &&
         Object.keys(rs).length > 0;
})()''';

String _everythingCleared() => '''(function() {
  var reg = $_reg;
  var mkrs = (reg && reg.markers) || (typeof markers !== 'undefined' ? markers : null) || {};
  var cl = (reg && reg.clusterer) || (typeof markerCluster !== 'undefined' ? markerCluster : null);
  var lbls = (reg && reg.labels) || (typeof labels !== 'undefined' ? labels : null) || {};
  var cos = (reg && reg.customOverlays) || (typeof customOverlays !== 'undefined' ? customOverlays : null) || {};
  var pls = (reg && reg.polylines) || (typeof polylines !== 'undefined' ? polylines : null) || {};
  var pgs = (reg && reg.polygons) || (typeof polygons !== 'undefined' ? polygons : null) || {};
  var cs = (reg && reg.circles) || (typeof circles !== 'undefined' ? circles : null) || {};
  var rs = (reg && reg.rectangles) || (typeof rectangles !== 'undefined' ? rectangles : null) || {};

  if (Object.keys(mkrs).length !== 0) return false;
  if (cl != null) {
    if (cl._cluster_data && cl._cluster_data.clusterMarkers && cl._cluster_data.clusterMarkers.some(function(g) { return g && g.getMap() != null; })) return false;
  }
  if (Object.keys(lbls).length !== 0) return false;
  if (Object.keys(cos).length !== 0) return false;
  if (Object.keys(pls).length !== 0) return false;
  if (Object.keys(pgs).length !== 0) return false;
  if (Object.keys(cs).length !== 0) return false;
  if (Object.keys(rs).length !== 0) return false;

  var dom1 = document.getElementById("mixed-marker-dom");
  if (dom1 && (dom1.isConnected !== undefined ? dom1.isConnected : document.contains(dom1))) return false;
  var dom2 = document.getElementById("mixed-co-dom");
  if (dom2 && (dom2.isConnected !== undefined ? dom2.isConnected : document.contains(dom2))) return false;

  return true;
})()''';

/// Real-world map annotation flow testing label, custom overlay, batch markers,
/// convenience shape drawing, partial shape clearing, and mixed clearAll.
Future<void> testOverlayTools() async {
  const appKey = String.fromEnvironment('TMAP_APP_KEY');
  if (appKey.isNotEmpty && AuthRepository.instance.appKey.isEmpty) {
    AuthRepository.initialize(appKey: appKey);
  }

  final controller = await mountLiveMap(
    (created) => TMap(
      onMapCreated: created,
    ),
  );

  try {
    // 0. Initial camera setup
    await controller.setCenter(_center);
    await controller.setZoom(16);
    await expectLive(
      'camera readiness',
      () => checkJs(
        controller,
        'Math.abs(map.getCenter().lat() - 37.5665) < 0.001 && '
        'Math.abs(map.getCenter().lng() - 126.9780) < 0.001 && '
        'Math.round(map.getZoom()) === 16',
      ),
    );

    // Add persistent anchor marker to verify sibling overlays are preserved
    await controller.addMarker(_anchorMarker);
    await expectLive(
        'anchor marker attached', () => checkJs(controller, _anchorAlive()));

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Native GPU-rendered Label (styled text, replacement, clear)
    // ─────────────────────────────────────────────────────────────────────────
    const label1 = Label(
      labelId: 'label_alpha',
      position: LatLng(37.5665, 126.9780),
      content: 'City Hall Alpha',
      fontSize: '15px',
      fontColor: Color(0xFF003366),
    );
    const label2 = Label(
      labelId: 'label_beta',
      position: LatLng(37.5670, 126.9790),
      content: 'Plaza Beta',
      fontSize: '13px',
      fontColor: Color(0xFF336600),
    );

    // 1a. Add labels & positive precondition verification
    await controller.addLabel(label1);
    await controller.addLabel(label2);
    await expectLive(
      'label1 attached with GPU VSM layer and SDK options',
      () => checkJs(
          controller,
          _labelAttached('label_alpha', 'City Hall Alpha', '15px',
              const Color(0xFF003366))),
    );
    await expectLive(
      'label2 attached with GPU VSM layer and SDK options',
      () => checkJs(controller,
          _labelAttached('label_beta', 'Plaza Beta', '13px', const Color(0xFF336600))),
    );
    await expectLive('anchor marker intact during label add',
        () => checkJs(controller, _anchorAlive()));

    // 1b. Replace same ID (old layer detached, new options active, sibling preserved)
    await checkJs(controller, _saveLabelLayer('label_alpha'));
    const label1Replaced = Label(
      labelId: 'label_alpha',
      position: LatLng(37.5668, 126.9785),
      content: 'City Hall Replaced',
      fontSize: '18px',
      fontColor: Color(0xFFCC0000),
    );
    await controller.addLabel(label1Replaced);
    await expectLive(
      'label1 replaced with new VSM layer and updated options',
      () => checkJs(
          controller,
          _labelAttached('label_alpha', 'City Hall Replaced', '18px',
              const Color(0xFFCC0000))),
    );
    await expectLive('old label1 layer detached from VSM',
        () => checkJs(controller, _oldLabelLayerDetached('label_alpha')));
    await expectLive(
        'sibling label2 unaffected by replacement',
        () => checkJs(controller,
            _labelAttached('label_beta', 'Plaza Beta', '13px', const Color(0xFF336600))));
    await expectLive('anchor marker intact after label replacement',
        () => checkJs(controller, _anchorAlive()));

    // 1c. Single clear (removes target, sibling label2 preserved, anchor preserved)
    await checkJs(controller, _saveLabelLayer('label_alpha'));
    await controller.clearLabel('label_alpha');
    await expectLive('label1 detached and removed from registry',
        () => checkJs(controller, _labelGone('label_alpha')));
    await expectLive(
        'sibling label2 preserved after single clear',
        () => checkJs(controller,
            _labelAttached('label_beta', 'Plaza Beta', '13px', const Color(0xFF336600))));
    await expectLive('anchor marker intact after single label clear',
        () => checkJs(controller, _anchorAlive()));

    // 1d. Bulk clear labels
    await controller.addLabel(label1Replaced);
    await expectLive(
      'label1 reseeded before bulk clear',
      () => checkJs(
          controller,
          _labelAttached('label_alpha', 'City Hall Replaced', '18px',
              const Color(0xFFCC0000))),
    );
    await controller.clearAllLabels();
    await expectLive(
        'all labels cleared', () => checkJs(controller, _allLabelsGone()));
    await expectLive('anchor marker intact after clearAllLabels',
        () => checkJs(controller, _anchorAlive()));

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: CustomOverlay (HTML with offset & zIndex, replace, clear)
    // ─────────────────────────────────────────────────────────────────────────
    const custom1 = CustomOverlay(
      customOverlayId: 'co_alpha',
      position: LatLng(37.5665, 126.9780),
      content: '<div id="co-dom-alpha" class="custom-card">Card Alpha</div>',
      offset: Point(10, -20),
      zIndex: 150,
    );
    const custom2 = CustomOverlay(
      customOverlayId: 'co_beta',
      position: LatLng(37.5670, 126.9790),
      content: '<div id="co-dom-beta" class="custom-card">Card Beta</div>',
      offset: Point(0, -30),
      zIndex: 120,
    );

    // 2a. Add custom overlays & positive precondition
    await controller.addCustomOverlay(custom1);
    await controller.addCustomOverlay(custom2);
    await expectLive(
      'custom1 attached with offset, zIndex, and DOM node',
      () => checkJs(controller,
          _customOverlayAttached('co_alpha', 'co-dom-alpha', 'Card Alpha', 10, -20)),
    );
    await expectLive(
      'custom2 attached with offset, zIndex, and DOM node',
      () => checkJs(controller,
          _customOverlayAttached('co_beta', 'co-dom-beta', 'Card Beta', 0, -30)),
    );
    await expectLive('anchor marker intact during custom overlay add',
        () => checkJs(controller, _anchorAlive()));

    // 2b. Replace same ID (old DOM node detached, new DOM node attached, sibling intact)
    const custom1Replaced = CustomOverlay(
      customOverlayId: 'co_alpha',
      position: LatLng(37.5666, 126.9782),
      content:
          '<div id="co-dom-alpha-v2" class="custom-card">Card Alpha V2</div>',
      offset: Point(15, -25),
      zIndex: 200,
    );
    await controller.addCustomOverlay(custom1Replaced);
    await expectLive(
      'custom1 replaced with updated DOM node and offset',
      () => checkJs(
          controller,
          _customOverlayAttached(
              'co_alpha', 'co-dom-alpha-v2', 'Card Alpha V2', 15, -25)),
    );
    await expectLive('old custom1 DOM element detached',
        () => checkJs(controller, _domDetached('co-dom-alpha')));
    await expectLive(
        'sibling custom2 DOM element intact',
        () => checkJs(controller,
            _customOverlayAttached('co_beta', 'co-dom-beta', 'Card Beta', 0, -30)));
    await expectLive('anchor marker intact after custom overlay replacement',
        () => checkJs(controller, _anchorAlive()));

    // 2c. Clear all custom overlays
    await controller.clearAllCustomOverlays();
    await expectLive(
        'all custom overlays cleared and DOM detached',
        () => checkJs(controller,
            _allCustomOverlaysGone(['co-dom-alpha-v2', 'co-dom-beta'])));
    await expectLive('anchor marker intact after clearAllCustomOverlays',
        () => checkJs(controller, _anchorAlive()));

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: Batch Markers (addMarkers & clearAllMarkers)
    // ─────────────────────────────────────────────────────────────────────────
    const batchMarkerIds = ['batch_m1', 'batch_m2', 'batch_m3'];
    const batchDomIds = ['bm-dom-1', 'bm-dom-2', 'bm-dom-3'];
    final batchMarkers = [
      const Marker(
        markerId: 'batch_m1',
        position: LatLng(37.5650, 126.9770),
        icon: MarkerIcon(iconHtml: '<span id="bm-dom-1">BM1</span>'),
      ),
      const Marker(
        markerId: 'batch_m2',
        position: LatLng(37.5652, 126.9772),
        icon: MarkerIcon(iconHtml: '<span id="bm-dom-2">BM2</span>'),
      ),
      const Marker(
        markerId: 'batch_m3',
        position: LatLng(37.5654, 126.9774),
        icon: MarkerIcon(iconHtml: '<span id="bm-dom-3">BM3</span>'),
      ),
    ];

    // 3a. Batch add markers
    await controller.addMarkers(batchMarkers);
    await expectLive(
      'batch markers attached with DOM icons',
      () =>
          checkJs(controller, _batchMarkersAttached(batchMarkerIds, batchDomIds)),
    );
    await expectLive('anchor marker intact during batch markers add',
        () => checkJs(controller, _anchorAlive()));

    // 3b. Clear all markers
    await controller.clearAllMarkers();
    await expectLive(
      'all markers cleared including batch and anchor',
      () => checkJs(controller, _batchMarkersCleared(batchMarkerIds, batchDomIds)),
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4: Convenience Shape Methods & Partial Clears
    // ─────────────────────────────────────────────────────────────────────────
    // 4a. Draw convenience shapes (polyline, polygon, circle, rectangle)
    await controller.drawPolyline(
      points: const [LatLng(37.5665, 126.9780), LatLng(37.5675, 126.9790)],
      strokeColor: const Color(0xFF0066FF),
      strokeWidth: 5,
    );
    await controller.drawPolygon(
      points: const [
        LatLng(37.5600, 126.9700),
        LatLng(37.5600, 126.9800),
        LatLng(37.5700, 126.9700),
      ],
      fillColor: const Color(0x33FFB300),
      strokeColor: const Color(0xFFFFB300),
    );
    await controller.drawCircle(
      center: const LatLng(37.5665, 126.9780),
      radius: 150.0,
      fillColor: const Color(0x33FF0000),
    );
    await controller.drawRectangle(
      bounds: const LatLngBounds(
        southWest: LatLng(37.5500, 126.9600),
        northEast: LatLng(37.5600, 126.9700),
      ),
      fillColor: const Color(0x3300AA00),
    );
    await expectLive(
      'native shapes rendered from convenience methods',
      () => checkJs(controller, _shapesRendered(expectedRadius: 150)),
    );

    // 4b. clearAllPolylinesAndPolygons removes both while preserving circle & rectangle
    await controller.clearAllPolylinesAndPolygons();
    await expectLive(
      'clearAllPolylinesAndPolygons removed polylines & polygons while preserving circle & rectangle',
      () => checkJs(controller,
          _polylinesAndPolygonsRemovedCirclesAndRectanglesPreserved()),
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 5: Mixed clearAll Cleans All (cluster, labels, custom, shapes, markers)
    // ─────────────────────────────────────────────────────────────────────────
    // 5a. Seed a comprehensive mixed overlay environment
    await controller.addMarker(const Marker(
      markerId: 'mixed_marker',
      position: LatLng(37.5665, 126.9780),
      icon: MarkerIcon(iconHtml: '<span id="mixed-marker-dom">MM</span>'),
    ));
    await controller.addMarkerClusterer(const Clusterer(
      markers: [
        Marker(markerId: 'cl_1', position: LatLng(37.5660, 126.9770)),
        Marker(markerId: 'cl_2', position: LatLng(37.5661, 126.9771)),
      ],
      minClusterCount: 2,
    ));
    await controller.addLabel(
      const Label(
        labelId: 'mixed_label',
        position: LatLng(37.5665, 126.9780),
        content: 'Mixed Label',
      ),
    );
    await controller.addCustomOverlay(
      const CustomOverlay(
        customOverlayId: 'mixed_co',
        position: LatLng(37.5665, 126.9780),
        content: '<div id="mixed-co-dom">MCO</div>',
      ),
    );
    await controller.drawPolyline(
      points: const [LatLng(37.5665, 126.9780), LatLng(37.5670, 126.9790)],
    );
    await controller.drawPolygon(
      points: const [
        LatLng(37.5665, 126.9780),
        LatLng(37.5670, 126.9790),
        LatLng(37.5670, 126.9770),
      ],
    );

    await expectLive(
      'mixed overlay environment positive precondition satisfied',
      () => checkJs(controller, _mixedPreconditionSatisfied()),
    );

    // 5b. Execute mixed clearAll
    await controller.clearAll();

    // 5c. Assert everything is cleanly detached and cleared
    await expectLive(
      'mixed clearAll cleaned all overlays including cluster, labels, custom, shapes, and markers',
      () => checkJs(controller, _everythingCleared()),
    );
  } finally {
    try {
      await controller.clearAll();
    } catch (_) {}
    await unmountLiveMap();
  }
}
