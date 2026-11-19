import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const String _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';
const String _clustererExpr =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null))';
const String _canvasExpr =
    '(document.querySelector(".vsm-canvas") || (map && map.vsmMap && map.vsmMap().getCanvas()))';

String _checkLabelLayerExpr(String labelId) => '''(function() {
  const lb = $_reg.labels?.["$labelId"];
  const id = lb?._label_data?.layerId;
  return Boolean(id && map.vsmMap().hasLayer(id));
})()''';

String _zoomConstraintsExpr(int min, int max) => '''(function() {
  if (!map) return false;
  var minZ = typeof map.getMinZoom === "function" ? map.getMinZoom() : map._data?.options?.minZoom;
  var maxZ = typeof map.getMaxZoom === "function" ? map.getMaxZoom() : map._data?.options?.maxZoom;
  return minZ === $min && maxZ === $max;
})()''';

String _zoomExpr() =>
    'Math.round(typeof map.getZoom === "function" ? map.getZoom() : 0)';

class _MapHostConfig {
  final double width;
  final double height;
  final int minZoom;
  final int maxZoom;
  final bool naviControl;
  final bool scaleBar;

  const _MapHostConfig({
    this.width = 320.0,
    this.height = 320.0,
    this.minZoom = 10,
    this.maxZoom = 18,
    this.naviControl = true,
    this.scaleBar = true,
  });

  _MapHostConfig copyWith({
    double? width,
    double? height,
    int? minZoom,
    int? maxZoom,
    bool? naviControl,
    bool? scaleBar,
  }) {
    return _MapHostConfig(
      width: width ?? this.width,
      height: height ?? this.height,
      minZoom: minZoom ?? this.minZoom,
      maxZoom: maxZoom ?? this.maxZoom,
      naviControl: naviControl ?? this.naviControl,
      scaleBar: scaleBar ?? this.scaleBar,
    );
  }
}

/// Verifies declarative TMap rebuilds, overlay replacement/removal, camera
/// sync, callback isolation, constraints, container relayout, and WebView reload semantics.
Future<void> testWidgetLifecycle() async {
  await _testDeclarativeRebuildAndRemount();
  await _testConstraintsAndRelayout();
  await _testWebViewReloadAndFallback();
}

Future<void> _testDeclarativeRebuildAndRemount() async {
  const mapKey = ValueKey('widget_lifecycle_declarative_map');
  var tapCount1 = 0;
  var tapCount2 = 0;

  final controller = await mountLiveMap((created) => TMap(
        key: mapKey,
        onMapCreated: created,
        center: const LatLng(37.5665, 126.9780),
        zoom: 15,
        onMarkerTap: (id, pos, zoom) => tapCount1++,
        markers: const [
          Marker(
            markerId: 'm1',
            position: LatLng(37.5665, 126.9780),
            icon: MarkerIcon(iconHtml: '<span id="dom-m1">M1</span>'),
          ),
        ],
        infoWindows: const [
          InfoWindow(
            infoWindowId: 'iw1',
            position: LatLng(37.5665, 126.9780),
            content: '<span id="dom-iw1">IW1</span>',
          ),
        ],
        labels: const [
          Label(
            labelId: 'lb1',
            position: LatLng(37.5665, 126.9780),
            content: 'LB1',
          ),
        ],
        polylines: const [
          Polyline(
            polylineId: 'pl1',
            points: [LatLng(37.5665, 126.9780), LatLng(37.5670, 126.9790)],
          ),
        ],
        polygons: const [
          Polygon(
            polygonId: 'pg1',
            points: [
              LatLng(37.560, 126.970),
              LatLng(37.560, 126.980),
              LatLng(37.570, 126.970),
            ],
          ),
        ],
        circles: const [
          Circle(
            circleId: 'c1',
            center: LatLng(37.5665, 126.9780),
            radius: 100,
          ),
        ],
        rectangles: const [
          Rectangle(
            rectangleId: 'r1',
            bounds: LatLngBounds(
              southWest: LatLng(37.560, 126.970),
              northEast: LatLng(37.570, 126.980),
            ),
          ),
        ],
        customOverlays: const [
          CustomOverlay(
            customOverlayId: 'co1',
            position: LatLng(37.5665, 126.9780),
            content: '<span id="dom-co1">CO1</span>',
          ),
        ],
        clusterer: const Clusterer(
          markers: [
            Marker(markerId: 'cl_m1', position: LatLng(37.5665, 126.9780)),
            Marker(markerId: 'cl_m2', position: LatLng(37.5666, 126.9781)),
          ],
        ),
      ));

  try {
    await expectLive(
      'initial canvas ready',
      () => checkJs(controller, 'Boolean($_canvasExpr)'),
    );

    await expectLive(
      'initial camera center near 37.5665, 126.9780 and zoom 15',
      () => checkJs(
        controller,
        'Math.abs(map.getCenter().lat() - 37.5665) < 0.005 && '
        'Math.abs(map.getCenter().lng() - 126.9780) < 0.005 && '
        'Math.round(map.getZoom()) === 15',
      ),
    );

    await expectLive(
      'initial marker rendered in DOM',
      () => checkJs(controller, '!!document.getElementById("dom-m1")'),
    );

    await expectLive(
      'initial infoWindow rendered in DOM',
      () => checkJs(controller, '!!document.getElementById("dom-iw1")'),
    );

    await expectLive(
      'initial shapes present in registry',
      () => checkJs(
        controller,
        'Boolean($_reg.polylines?.["pl1"] && $_reg.polygons?.["pg1"] && '
        '$_reg.circles?.["c1"] && $_reg.rectangles?.["r1"])',
      ),
    );

    await expectLive(
      'initial clusterer attached',
      () => checkJs(controller, 'Boolean($_clustererExpr)'),
    );

    await expectLive(
      'initial label and custom overlay present in registry and DOM',
      () => checkJs(
        controller,
        'Boolean($_reg.labels?.["lb1"] && $_reg.customOverlays?.["co1"] && '
        'document.getElementById("dom-co1") && (${_checkLabelLayerExpr("lb1")}))',
      ),
    );

    // Normal Flutter rebuild with new props under same widget key
    runApp(MaterialApp(
      home: TMap(
        key: mapKey,
        center: const LatLng(37.5750, 126.9850),
        zoom: 16,
        onMarkerTap: (id, pos, zoom) => tapCount2++,
        markers: const [
          Marker(
            markerId: 'm2',
            position: LatLng(37.5750, 126.9850),
            icon: MarkerIcon(iconHtml: '<span id="dom-m2">M2</span>'),
          ),
        ],
        infoWindows: const [
          InfoWindow(
            infoWindowId: 'iw2',
            position: LatLng(37.5750, 126.9850),
            content: '<span id="dom-iw2">IW2</span>',
          ),
        ],
        labels: const [
          Label(
            labelId: 'lb2',
            position: LatLng(37.5750, 126.9850),
            content: 'LB2',
          ),
        ],
        polylines: const [
          Polyline(
            polylineId: 'pl2',
            points: [LatLng(37.5750, 126.9850), LatLng(37.5760, 126.9860)],
          ),
        ],
        polygons: const [
          Polygon(
            polygonId: 'pg2',
            points: [
              LatLng(37.570, 126.980),
              LatLng(37.570, 126.990),
              LatLng(37.580, 126.980),
            ],
          ),
        ],
        circles: const [
          Circle(
            circleId: 'c2',
            center: LatLng(37.5750, 126.9850),
            radius: 150,
          ),
        ],
        rectangles: const [
          Rectangle(
            rectangleId: 'r2',
            bounds: LatLngBounds(
              southWest: LatLng(37.570, 126.980),
              northEast: LatLng(37.580, 126.990),
            ),
          ),
        ],
        customOverlays: const [
          CustomOverlay(
            customOverlayId: 'co2',
            position: LatLng(37.5750, 126.9850),
            content: '<span id="dom-co2">CO2</span>',
          ),
        ],
        clusterer: null,
      ),
    ));
    await WidgetsBinding.instance.endOfFrame;

    await expectLive(
      'rebuilt camera center near 37.5750, 126.9850 and zoom 16',
      () => checkJs(
        controller,
        'Math.abs(map.getCenter().lat() - 37.5750) < 0.005 && '
        'Math.abs(map.getCenter().lng() - 126.9850) < 0.005 && '
        'Math.round(map.getZoom()) === 16',
      ),
    );

    await expectLive(
      'initial overlays removed from registry and DOM',
      () => checkJs(
        controller,
        '!document.getElementById("dom-m1") && '
        '!document.getElementById("dom-iw1") && '
        '!$_reg.polylines?.["pl1"] && '
        '!$_reg.polygons?.["pg1"] && '
        '!$_reg.circles?.["c1"] && '
        '!$_reg.rectangles?.["r1"] && '
        '!$_reg.labels?.["lb1"] && '
        '!$_reg.customOverlays?.["co1"] && '
        '!document.getElementById("dom-co1") && '
        '!$_clustererExpr',
      ),
    );

    await expectLive(
      'replaced overlays present in registry and DOM',
      () => checkJs(
        controller,
        'Boolean(document.getElementById("dom-m2") && '
        'document.getElementById("dom-iw2") && '
        '$_reg.polylines?.["pl2"] && '
        '$_reg.polygons?.["pg2"] && '
        '$_reg.circles?.["c2"] && '
        '$_reg.rectangles?.["r2"] && '
        '$_reg.labels?.["lb2"] && '
        '$_reg.customOverlays?.["co2"] && '
        'document.getElementById("dom-co2"))',
      ),
    );

    await expectLive(
      'replaced label layer attached with hasLayer',
      () => checkJs(controller, _checkLabelLayerExpr('lb2')),
    );

    // Verify click on replaced marker dispatches to new callback without duplicates or stale callbacks
    await expectLive(
      'replaced marker ready for click',
      () => checkJs(controller, '!!document.getElementById("dom-m2")'),
    );
    await checkJs(controller, '(document.getElementById("dom-m2").click(), true)');

    await expectLive(
      'replaced marker tap callback invoked',
      () async => tapCount2 == 1,
    );

    if (tapCount1 != 0) {
      throw StateError('Stale callback invoked after rebuild: tapCount1=$tapCount1');
    }
    if (tapCount2 != 1) {
      throw StateError('Duplicate callback invocation: tapCount2=$tapCount2');
    }

    // Unmount active map
    await unmountLiveMap();

    if (kIsWeb) {
      await expectLive(
        'web map instances cleared after unmount',
        () => checkJs(
          controller,
          'Object.keys(window.tmap_instances || {}).length === 0',
        ),
      );
    }

    // Remount a fresh map instance
    final remountController = await mountLiveMap((created) => TMap(
          key: const ValueKey('widget_lifecycle_remount_map'),
          onMapCreated: created,
          center: const LatLng(37.5500, 126.9700),
          zoom: 14,
        ));

    await expectLive(
      'remounted map canvas active',
      () => checkJs(remountController, 'Boolean($_canvasExpr)'),
    );
  } finally {
    await unmountLiveMap();
  }
}

Future<void> _testConstraintsAndRelayout() async {
  const mapKey = ValueKey('widget_lifecycle_constraints_map');
  final hostConfig = ValueNotifier<_MapHostConfig>(const _MapHostConfig());

  final controller = await mountLiveMap((created) => ValueListenableBuilder<_MapHostConfig>(
        valueListenable: hostConfig,
        builder: (context, config, _) => Center(
          child: SizedBox(
            width: config.width,
            height: config.height,
            child: TMap(
              key: mapKey,
              onMapCreated: created,
              center: const LatLng(37.5665, 126.9780),
              zoom: 14,
              minZoom: config.minZoom,
              maxZoom: config.maxZoom,
              naviControl: config.naviControl,
              scaleBar: config.scaleBar,
            ),
          ),
        ),
      ));

  try {
    await expectLive(
      'initial minZoom and maxZoom constraints observed in SDK',
      () => checkJs(controller, _zoomConstraintsExpr(10, 18)),
    );

    await expectLive(
      'initial controls verified in SDK and DOM',
      () => checkJs(
        controller,
        'Boolean(map && map.__tmapNaviControl && map.__tmapScaleBarControl && '
        'document.querySelector(".top-right-group") && document.querySelector(".bottom-left-group"))',
      ),
    );

    // Zoom boundary and out-of-range checks for initial limits (10..18)
    await controller.setZoom(14);
    await expectLive(
      'zoom set to interior 14',
      () => checkJs(controller, '${_zoomExpr()} === 14'),
    );

    await controller.setZoom(5);
    await expectLive(
      'below-min zoom request ignored and retains 14',
      () => checkJs(controller, '${_zoomExpr()} === 14'),
    );

    await controller.setZoom(10);
    await expectLive(
      'zoom reached lower bound 10',
      () => checkJs(controller, '${_zoomExpr()} === 10'),
    );

    await controller.setZoom(18);
    await expectLive(
      'zoom reached upper bound 18',
      () => checkJs(controller, '${_zoomExpr()} === 18'),
    );

    await controller.setZoom(22);
    await expectLive(
      'above-max zoom request ignored and retains upper bound 18',
      () => checkJs(controller, '${_zoomExpr()} === 18'),
    );

    // Update constraints and controls through rebuild under same ancestors
    hostConfig.value = hostConfig.value.copyWith(
      minZoom: 8,
      maxZoom: 17,
      naviControl: false,
      scaleBar: false,
    );
    await WidgetsBinding.instance.endOfFrame;

    await expectLive(
      'rebuilt minZoom and maxZoom constraints observed in SDK',
      () => checkJs(controller, _zoomConstraintsExpr(8, 17)),
    );

    await expectLive(
      'controls removed after rebuild',
      () => checkJs(
        controller,
        'Boolean(map && !map.__tmapNaviControl && !map.__tmapScaleBarControl && '
        '!document.querySelector(".top-right-group") && !document.querySelector(".bottom-left-group"))',
      ),
    );

    // Zoom boundary and out-of-range checks for rebuilt limits (8..17)
    await controller.setZoom(14);
    await expectLive(
      'zoom set to interior 14 under rebuilt constraints',
      () => checkJs(controller, '${_zoomExpr()} === 14'),
    );

    await controller.setZoom(5);
    await expectLive(
      'below-min zoom request ignored and retains 14 under rebuilt constraints',
      () => checkJs(controller, '${_zoomExpr()} === 14'),
    );

    await controller.setZoom(8);
    await expectLive(
      'zoom reached newly allowed lower bound 8',
      () => checkJs(controller, '${_zoomExpr()} === 8'),
    );

    await controller.setZoom(17);
    await expectLive(
      'zoom reached rebuilt upper bound 17',
      () => checkJs(controller, '${_zoomExpr()} === 17'),
    );

    await controller.setZoom(22);
    await expectLive(
      'above-max zoom request ignored and retains upper bound 17',
      () => checkJs(controller, '${_zoomExpr()} === 17'),
    );

    // Container resizing: capture initial canvas size, resize SizedBox, verify canvas size changes
    await checkJs(
      controller,
      '(function() {'
      '  var c = $_canvasExpr;'
      '  if (!c) return false;'
      '  var r = c.getBoundingClientRect();'
      '  window.__initCanvasW = r.width;'
      '  window.__initCanvasH = r.height;'
      '  return r.width > 0 && r.height > 0;'
      '})()',
    );

    hostConfig.value = hostConfig.value.copyWith(width: 240.0, height: 200.0);
    await WidgetsBinding.instance.endOfFrame;
    await controller.relayout();

    await expectLive(
      'canvas size changes after resizing container',
      () => checkJs(
        controller,
        '(function() {'
        '  var c = $_canvasExpr;'
        '  if (!c) return false;'
        '  var r = c.getBoundingClientRect();'
        '  return r.width > 0 && r.height > 0 && (r.width !== window.__initCanvasW || r.height !== window.__initCanvasH);'
        '})()',
      ),
    );

    const fitTarget = LatLngBounds(
      southWest: LatLng(37.5500, 126.9700),
      northEast: LatLng(37.5700, 126.9900),
    );
    await controller.fitBounds(fitTarget);

    await expectLive(
      'bounds enclose fitTarget after fitBounds and relayout',
      () => checkJs(
        controller,
        '(function() {'
        '  if (!map || !map.getBounds) return false;'
        '  var b = map.getBounds();'
        '  if (!b) return false;'
        '  var sw = b.getSouthWest ? b.getSouthWest() : (b._sw || null);'
        '  var ne = b.getNorthEast ? b.getNorthEast() : (b._ne || null);'
        '  if (!sw || !ne) return false;'
        '  var swLat = typeof sw.lat === "function" ? sw.lat() : (sw._lat ?? sw.lat);'
        '  var swLng = typeof sw.lng === "function" ? sw.lng() : (sw._lng ?? sw.lng);'
        '  var neLat = typeof ne.lat === "function" ? ne.lat() : (ne._lat ?? ne.lat);'
        '  var neLng = typeof ne.lng === "function" ? ne.lng() : (ne._lng ?? ne.lng);'
        '  return (swLat <= 37.5505 && neLat >= 37.5695 && swLng <= 126.9705 && neLng >= 126.9895);'
        '})()',
      ),
    );
  } finally {
    hostConfig.dispose();
    await unmountLiveMap();
  }
}

Future<void> _testWebViewReloadAndFallback() async {
  final controller = await mountLiveMap((created) => TMap(
        key: const ValueKey('widget_lifecycle_webview_map'),
        onMapCreated: created,
      ));

  try {
    if (kIsWeb) {
      var threwUnsupported = false;
      try {
        controller.webViewController;
      } on UnsupportedError {
        threwUnsupported = true;
      }
      if (!threwUnsupported) {
        throw StateError(
          'controller.webViewController must throw UnsupportedError on Web',
        );
      }

      await checkJs(controller, '(window.__webLiveMapSentinel = true, true)');
      await controller.reloadHtml('<div id="web-fallback-sentinel">SENTINEL</div>');
      await controller.reload();

      await expectLive(
        'web live map and DOM unchanged after reloadHtml and reload no-ops',
        () => checkJs(
          controller,
          'window.__webLiveMapSentinel === true && '
          '!document.getElementById("web-fallback-sentinel") && '
          'Boolean($_canvasExpr)',
        ),
      );
    } else {
      controller.webViewController;

      const sentinelId = 'bridge-html-reload-sentinel';
      const sentinelHtml =
          '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
          '<body><div id="$sentinelId">SENTINEL_ACTIVE</div></body></html>';

      await controller.reloadHtml(sentinelHtml);
      await _expectPoll(
        'sentinel element present in webview DOM after reloadHtml',
        () => checkJs(controller, '!!document.getElementById("$sentinelId")'),
      );

      await checkJs(controller, '(window.__transientReloadFlag = "ACTIVE", true)');
      await _expectPoll(
        'transient reload flag active before reload',
        () => checkJs(controller, 'window.__transientReloadFlag === "ACTIVE"'),
        timeout: const Duration(seconds: 5),
      );

      await controller.reload();
      await _expectPoll(
        'webview page reloaded: sentinel retained and transient JS flag reset',
        () => checkJs(
          controller,
          '!!document.getElementById("$sentinelId") && '
          'typeof window.__transientReloadFlag === "undefined"',
        ),
        timeout: const Duration(seconds: 5),
      );
    }
  } finally {
    await unmountLiveMap();
  }
}

Future<void> _expectPoll(
  String stageName,
  Future<bool> Function() predicate, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    final remaining = deadline.difference(DateTime.now());
    if (remaining <= Duration.zero) break;

    try {
      final attemptTimeout = remaining < const Duration(seconds: 1)
          ? remaining
          : const Duration(seconds: 1);
      if (await predicate().timeout(attemptTimeout)) {
        return;
      }
    } catch (_) {
      // Ignore errors (timeouts, etc.)
    }
    await Future.delayed(const Duration(milliseconds: 200));
  }
  throw StateError('Timed out waiting for $stageName');
}
