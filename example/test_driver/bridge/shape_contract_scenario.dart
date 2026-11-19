import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _center = LatLng(37.5665, 126.9780);
const _bounds = LatLngBounds(
  southWest: LatLng(37.565, 126.976),
  northEast: LatLng(37.568, 126.980),
);
const _points = [
  LatLng(37.565, 126.976),
  LatLng(37.565, 126.980),
  LatLng(37.568, 126.980),
  LatLng(37.568, 126.976),
];
const _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';
const _png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/// Real SDK readbacks for shape methods and GroundOverlay options.
Future<void> testShapeContracts() async {
  final controller = await mountLiveMap(
    (created) => TMap(center: _center, zoom: 15, onMapCreated: created),
  );
  try {
    await controller.addPolyline(const Polyline(
      polylineId: 'contract-line',
      points: _points,
      direction: true,
    ));
    await expectLive(
      'polyline direction arrow style in SDK',
      () => checkJs(
          controller,
          '$_reg.polylines["contract-line"]?._shape_data?.drawInfo?.direction === true && '
          '$_reg.polylines["contract-line"]?._shape_data?.vsmStyle?.["stroke-pattern"] === "PATTERN:arrow"'),
    );

    await controller.addRectangle(const Rectangle(
      rectangleId: 'contract-rectangle',
      bounds: _bounds,
      fillColor: Color(0xFF22AA44),
      strokeColor: Color(0xFFEE1177),
    ));
    await expectLive(
      'rectangle custom fill and stroke read back from SDK',
      () => checkJs(controller, '''(function() {
        const r = $_reg.rectangles["contract-rectangle"];
        const s = r?._shape_data?.vsmStyle;
        return r?.getMap() === map && s &&
          String(s.fill).toLowerCase() === '#22aa44' &&
          String(s.stroke).toLowerCase() === '#ee1177';
      })()'''),
    );
    await expectLive(
      'rectangle getPath exposes both corners',
      () => checkJs(controller, '''(function() {
        const p = $_reg.rectangles["contract-rectangle"]?.getPath();
        return p && Math.abs(p._sw.lat() - 37.565) < 1e-7 &&
          Math.abs(p._sw.lng() - 126.976) < 1e-7 &&
          Math.abs(p._ne.lat() - 37.568) < 1e-7 &&
          Math.abs(p._ne.lng() - 126.980) < 1e-7;
      })()'''),
    );

    await controller.addCircle(const Circle(
      circleId: 'contract-circle',
      center: _center,
      radius: 250,
    ));
    await expectLive(
      'circle getPath exposes center and radius',
      () => checkJs(controller, '''(function() {
        const p = $_reg.circles["contract-circle"]?.getPath();
        return p && Math.abs(p.center.lat() - 37.5665) < 1e-7 &&
          Math.abs(p.center.lng() - 126.978) < 1e-7 &&
          Math.abs(p.radius - 250) < 1e-7;
      })()'''),
    );

    await controller.addPolygon(const Polygon(
      polygonId: 'contract-polygon',
      points: _points,
    ));
    await expectLive(
      'polygon geometry ready for hit testing',
      () => checkJs(controller,
          '($_reg.polygons["contract-polygon"]?.getPath()?.path?.length || 0) >= 4'),
    );
    final inside =
        await controller.polygonContains('contract-polygon', _center);
    final outside = await controller.polygonContains(
        'contract-polygon', const LatLng(37.58, 126.99));
    final area = await controller.getPolygonArea('contract-polygon');
    final nativeArea =
        await runJs(controller, '$_reg.polygons["contract-polygon"].getArea()');
    final raw = Map<String, dynamic>.from(nativeArea as Map);
    double parseArea(Object? n) =>
        double.parse(n.toString().replaceAll(',', ''));
    if (!inside ||
        outside ||
        area == null ||
        area.pathSquareMeters <= 0 ||
        area.pathSquareMeters != parseArea(raw['pathArea']) ||
        jsonEncode(area.innerPathSquareMeters) !=
            jsonEncode(
                (raw['outerPathArea'] as List).map(parseArea).toList())) {
      throw StateError('polygon contains and area match SDK: '
          'inside=$inside outside=$outside '
          'area=${area?.pathSquareMeters}, holes=${area?.innerPathSquareMeters}, '
          'native=${jsonEncode(raw)}');
    }
    await expectLive(
      'polygon contains and area match SDK',
      () async => inside && !outside && area.pathSquareMeters > 0,
    );

    await controller.addGroundOverlay(const GroundOverlay(
      groundOverlayId: 'contract-image',
      url: _png,
      bounds: _bounds,
      opacity: 0.35,
    ));
    await expectLive(
      'ground overlay options attached with image layer',
      () => checkJs(controller, '''(function() {
        const g = $_reg.groundOverlays?.["contract-image"];
        const d = g?._shape_data;
        if (!g || g.getMap() !== map || !d || !d.bounds) return false;
        const sw = d.bounds.getSouthWest(), ne = d.bounds.getNorthEast();
        return d.url.startsWith('data:image/png;') &&
          d.opacity === 0.35 &&
          Math.abs(sw.lat() - 37.565) < 1e-7 &&
          Math.abs(ne.lng() - 126.980) < 1e-7 &&
          map.vsmMap().hasLayer(d.layerId);
      })()'''),
    );
    final layerId = await runJs(controller,
        '$_reg.groundOverlays["contract-image"]._shape_data.layerId');
    if (layerId is! num) {
      throw StateError('GroundOverlay did not provide a layer ID');
    }
    await controller.clearGroundOverlay('contract-image');
    await expectLive(
      'ground overlay setMap null detaches layer',
      () => checkJs(
          controller,
          '!$_reg.groundOverlays?.["contract-image"] && '
          '!map.vsmMap().hasLayer(${layerId.toInt()})'),
    );
  } finally {
    await controller.clearAll();
    await unmountLiveMap();
  }
}
