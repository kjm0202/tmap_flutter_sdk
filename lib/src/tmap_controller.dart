import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'auth/auth_repository.dart';
import 'constants/map_type.dart';
import 'models/address_info.dart';
import 'models/auto_complete_item.dart';
import 'models/lat_lng.dart';
import 'models/lat_lng_bounds.dart';
import 'models/overlay_interaction.dart';
import 'models/poi_item.dart';
import 'models/point.dart';
import 'models/polygon_area.dart';
import 'models/route_info.dart';
import 'models/size.dart' as tmap_size;
import 'overlays/circle.dart';
import 'overlays/clusterer.dart';
import 'overlays/custom_overlay.dart';
import 'overlays/drawing_options.dart';
import 'overlays/ground_overlay.dart';
import 'overlays/info_window.dart';
import 'overlays/label.dart';
import 'overlays/marker.dart';
import 'overlays/polygon.dart';
import 'overlays/polyline.dart';
import 'overlays/rectangle.dart';
import 'overlays/visualization.dart';
import 'services/tdata_service.dart';
import 'utils/hex_color.dart';
import 'web/tmap_web_bridge_stub.dart'
    if (dart.library.js_interop) 'web/tmap_web_bridge.dart';

/// Controls a TMAP map on mobile WebView and Flutter Web platforms.
class TMapController {
  final WebViewController? _webViewController;
  final String? _webViewId;
  void Function(Map<String, dynamic>)? _drawingHandler;

  final Map<String,
          Map<MarkerInteractionType, Set<void Function(MarkerInteraction)>>>
      _markerListeners = {};
  final Map<ClusterInteractionType, Set<void Function(ClusterInteraction)>>
      _clusterListeners = {};

  /// The mobile [WebViewController].
  ///
  /// Throws [UnsupportedError] when used on Flutter Web.
  WebViewController get webViewController {
    final controller = _webViewController;
    if (controller != null) return controller;
    throw UnsupportedError(
        'webViewController is only available on Mobile platforms.');
  }

  String? _lastLoadedHtml;
  String? _lastLoadedBaseUrl;
  String? _currentDocId;

  /// Creates a controller backed by a mobile [WebViewController].
  TMapController(WebViewController webViewController)
      : _webViewController = webViewController,
        _webViewId = null;

  /// Creates a controller for the web map identified by [viewId].
  TMapController.fromWeb(String viewId)
      : _webViewController = null,
        _webViewId = viewId;

  Future<void> _runJs(String script) async {
    final controller = _webViewController;
    if (controller != null) {
      try {
        await controller.runJavaScript(script);
      } catch (e) {
        if (kIsWeb) {
          debugPrint(
              '[TMapController] runJavaScript not supported on Web: $script');
        } else {
          rethrow;
        }
      }
    }
  }

  String _escapeForJs(String input) {
    return input
        .replaceAll(r'\', r'\\')
        .replaceAll("'", r"\'")
        .replaceAll('"', r'\"')
        .replaceAll('\n', r'\n')
        .replaceAll('\r', r'\r')
        .replaceAll('\t', r'\t');
  }

  // ========================================
  // Basic map controls.
  // ========================================

  /// Sets the map center to [center] in WGS84 latitude/longitude.
  Future<void> setCenter(LatLng center) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setCenter(viewId, center);
      return;
    }
    await _runJs(
      'setCenter(${center.latitude}, ${center.longitude});',
    );
  }

  /// Sets the map zoom level to [zoom] (normally 0–19).
  Future<void> setZoom(int zoom) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setZoom(viewId, zoom);
      return;
    }
    await _runJs('setZoom($zoom);');
  }

  Map<String, dynamic> _parseJsData(Object? raw, String operation) {
    if (raw == null) {
      throw StateError('$operation returned no data; the map may be disposed');
    }
    dynamic decoded = raw;
    // WKWebView returns JSON strings directly, while Android can return a
    // JSON-encoded representation of the string. Web already returns a String.
    for (var i = 0; i < 2 && decoded is String; i++) {
      decoded = jsonDecode(decoded);
    }
    if (decoded is! Map) {
      throw StateError('$operation returned an unexpected result: $decoded');
    }
    return Map<String, dynamic>.from(decoded);
  }

  Future<Map<String, dynamic>> _readMap(String name,
      [Map<String, dynamic> args = const {}]) async {
    final viewId = _webViewId;
    final Object? response;
    if (viewId != null) {
      response = TMapWebBridge.readMapData(viewId, name, args);
    } else {
      response = await _webViewController!.runJavaScriptReturningResult(
        'readMapData(${jsonEncode(name)}, ${jsonEncode(args)});',
      );
    }
    return _parseJsData(response, name);
  }

  Future<double> _getNumber(String getter) async {
    final value = (await _readMap(getter))['value'];
    if (value is! num) throw StateError('$getter did not return a number');
    return value.toDouble();
  }

  /// Returns the current map center reported by the SDK.
  Future<LatLng> getCenter() async =>
      LatLng.fromJson(await _readMap('getCenter'));

  /// Returns the geographic bounds currently visible on the map.
  Future<LatLngBounds> getBounds() async =>
      LatLngBounds.fromJson(await _readMap('getBounds'));

  /// Returns the current zoom level, which can be fractional during animation.
  Future<double> getZoom() => _getNumber('getZoom');

  /// Returns the minimum zoom level allowed by the SDK map.
  ///
  /// Use [getZoom] to read the current camera zoom level.
  Future<double> getMinZoom() => _getNumber('getMinZoom');

  /// Returns the maximum zoom level allowed by the SDK map.
  ///
  /// Reflects updates made by [setZoomLimit], not the current camera zoom.
  Future<double> getMaxZoom() => _getNumber('getMaxZoom');

  /// Returns the current map bearing in degrees.
  Future<double> getBearing() => _getNumber('getBearing');

  /// Returns the current camera pitch in degrees.
  Future<double> getPitch() => _getNumber('getPitch');

  /// Converts WGS84 [position] into pixels relative to the map container.
  Future<Point> realToScreen(LatLng position) async => Point.fromJson(
        await _readMap('realToScreen', position.toJson()),
      );

  /// Converts map-container pixel coordinates to WGS84 latitude/longitude.
  Future<LatLng> screenToReal(Point pixel) async => LatLng.fromJson(
        await _readMap('screenToReal', pixel.toJson()),
      );

  /// Returns the SDK map viewport size in pixels.
  Future<tmap_size.Size> screenSize() async =>
      tmap_size.Size.fromJson(await _readMap('screenSize'));

  /// Sets the allowed zoom range from [minZoom] to [maxZoom].
  ///
  /// Throws [ArgumentError] when [minZoom] exceeds [maxZoom].
  Future<void> setZoomLimit(int minZoom, int maxZoom) async {
    if (minZoom > maxZoom) {
      throw ArgumentError.value(minZoom, 'minZoom', 'Must be <= maxZoom');
    }
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setZoomLimit(viewId, minZoom, maxZoom);
      return;
    }
    await _runJs('setZoomLimit($minZoom, $maxZoom);');
  }

  /// Forwards a Bessel or KATEC projection conversion to the SDK.
  ///
  /// Passes [method] and [args] to the platform bridge and parses its result.
  Future<Map<String, dynamic>> convertProjection(
      String method, Map<String, dynamic> args) async {
    final viewId = _webViewId;
    final Object? response;
    if (viewId != null) {
      response = TMapWebBridge.convertProjection(viewId, method, args);
    } else {
      response = await _webViewController!.runJavaScriptReturningResult(
        'convertProjection(${jsonEncode(method)}, ${jsonEncode(args)});',
      );
    }
    return _parseJsData(response, method);
  }

  /// Increases the map zoom by one level.
  Future<void> zoomIn() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.zoomIn(viewId);
      return;
    }
    await _runJs('zoomIn();');
  }

  /// Decreases the map zoom by one level.
  Future<void> zoomOut() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.zoomOut(viewId);
      return;
    }
    await _runJs('zoomOut();');
  }

  /// Zooms to the SDK's maximum extent.
  ///
  /// Falls back to the minimum allowed zoom when the SDK lacks this method.
  Future<void> zoomToMaxExtent() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.zoomToMaxExtent(viewId);
      return;
    }
    await _runJs('zoomToMaxExtent();');
  }

  /// Pans the map to WGS84 [target].
  Future<void> panTo(LatLng target) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.panTo(viewId, target);
      return;
    }
    await _runJs(
      'panTo(${target.latitude}, ${target.longitude});',
    );
  }

  /// Pans the map by [x] and [y] pixels in screen coordinates.
  Future<void> panBy(int x, int y) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.panBy(viewId, x, y);
      return;
    }
    await _runJs('panBy($x, $y);');
  }

  /// Sets the map bearing in degrees (0–360).
  Future<void> setBearing(double bearing) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setBearing(viewId, bearing);
      return;
    }
    await _runJs('setBearing($bearing);');
  }

  /// Sets the camera pitch in degrees (0–60).
  Future<void> setPitch(double pitch) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setPitch(viewId, pitch);
      return;
    }
    await _runJs('setPitch($pitch);');
  }

  /// Sets the map style to [mapType].
  Future<void> setMapType(TMapType mapType) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setMapType(viewId, mapType);
      return;
    }
    await _runJs("setMapType('${mapType.value}');");
  }

  /// Fits [bounds] into the map viewport.
  ///
  /// The optional [padding] specifies the inset from the edges in pixels.
  Future<void> fitBounds(LatLngBounds bounds, {int? padding}) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.fitBounds(viewId, bounds, padding);
      return;
    }
    final padStr = padding != null ? ', $padding' : '';
    await _runJs(
      'fitBounds(${bounds.southWest.latitude}, ${bounds.southWest.longitude}, ${bounds.northEast.latitude}, ${bounds.northEast.longitude}$padStr);',
    );
  }

  /// Recalculates the map layout after its container is resized.
  Future<void> relayout() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.relayout(viewId);
      return;
    }
    await _runJs('relayout();');
  }

  /// Updates runtime map [options], such as zoom limits and control visibility.
  Future<void> updateMapOptions(Map<String, dynamic> options) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.updateMapOptions(viewId, options);
      return;
    }
    await _runJs('updateMapOptions(${jsonEncode(options)});');
  }

  /// Loads [htmlString] into the mobile WebView with an optional [baseUrl].
  Future<void> reloadHtml(String htmlString, {String? baseUrl}) async {
    final controller = _webViewController;
    if (controller != null) {
      final id = DateTime.now().microsecondsSinceEpoch.toString();
      final marker = '<!-- TMAP_DOC_ID: $id -->';
      final modifiedHtml = '$marker\n$htmlString';

      await controller.loadHtmlString(
        modifiedHtml,
        baseUrl: baseUrl ?? AuthRepository.instance.baseUrl,
      );
      _lastLoadedHtml = modifiedHtml;
      _currentDocId = id;
      _lastLoadedBaseUrl = baseUrl ?? AuthRepository.instance.baseUrl;
    }
  }

  /// Reloads the mobile WebView, restoring a previously loaded HTML document.
  ///
  /// Uses a normal WebView reload when the stored document marker is absent.
  Future<void> reload() async {
    final controller = _webViewController;
    if (controller != null) {
      if (_lastLoadedHtml != null && _currentDocId != null) {
        try {
          final js = '''
            (function() {
              var walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT, null, false);
              while (walker.nextNode()) {
                if (walker.currentNode.nodeValue.includes('TMAP_DOC_ID: $_currentDocId')) {
                  return '$_currentDocId';
                }
              }
              return null;
            })();
          ''';
          final result = await controller.runJavaScriptReturningResult(js);
          final docId =
              result.toString().replaceAll('"', '').replaceAll("'", '');
          if (docId == _currentDocId) {
            await controller.loadHtmlString(_lastLoadedHtml!,
                baseUrl: _lastLoadedBaseUrl);
            return;
          }
        } catch (e) {
          debugPrint('[TMapController] failed to verify document: $e');
        }
      }
      await controller.reload();
    }
  }

  // ========================================
  // Marker controls.
  // ========================================

  /// Registers [listener] for [type] events from [markerId].
  ///
  /// The subscription remains active if the marker is replaced.
  void onMarkerEvent(String markerId, MarkerInteractionType type,
      void Function(MarkerInteraction) listener) {
    _markerListeners
        .putIfAbsent(markerId, () => {})
        .putIfAbsent(type, () => {})
        .add(listener);
  }

  /// Unregisters a previously added [listener] for [markerId] and [type].
  void offMarkerEvent(String markerId, MarkerInteractionType type,
      void Function(MarkerInteraction) listener) {
    final byType = _markerListeners[markerId];
    byType?[type]?.remove(listener);
    if (byType?[type]?.isEmpty ?? false) byType!.remove(type);
    if (byType?.isEmpty ?? false) _markerListeners.remove(markerId);
  }

  /// Dispatches a bridge [event] to matching Dart marker listeners.
  void dispatchMarkerInteraction(MarkerInteraction event) {
    final listeners = _markerListeners[event.markerId]?[event.type];
    if (listeners == null) return;
    for (final listener in listeners.toList()) {
      try {
        listener(event);
      } catch (error, stack) {
        FlutterError.reportError(FlutterErrorDetails(
          exception: error,
          stack: stack,
          library: 'tmap_flutter_sdk',
          context: ErrorDescription('while dispatching a marker interaction'),
        ));
      }
    }
  }

  /// Adds [marker] to the map.
  Future<void> addMarker(Marker marker) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addMarker(viewId, marker);
      return;
    }
    await _runJs('addMarker(${jsonEncode(marker.toJson())});');
  }

  /// Adds each marker in [markers] to the map sequentially.
  Future<void> addMarkers(List<Marker> markers) async {
    for (final marker in markers) {
      await addMarker(marker);
    }
  }

  /// Removes the marker identified by [markerId].
  Future<void> clearMarker(String markerId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearMarker(viewId, markerId);
      return;
    }
    await _runJs('clearMarker(${jsonEncode(markerId)});');
  }

  /// Removes all map markers.
  Future<void> clearAllMarkers() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllMarkers(viewId);
      return;
    }
    await _runJs('clearAllMarkers();');
  }

  // ========================================
  // Marker clusterer controls.
  // ========================================

  /// Registers [listener] for cluster interaction events of [type].
  void onClusterEvent(
      ClusterInteractionType type, void Function(ClusterInteraction) listener) {
    _clusterListeners.putIfAbsent(type, () => {}).add(listener);
  }

  /// Unregisters [listener] from cluster interaction events of [type].
  void offClusterEvent(
      ClusterInteractionType type, void Function(ClusterInteraction) listener) {
    _clusterListeners[type]?.remove(listener);
    if (_clusterListeners[type]?.isEmpty ?? false) {
      _clusterListeners.remove(type);
    }
  }

  /// Dispatches a bridge cluster [event] to subscribed Dart listeners.
  void dispatchClusterInteraction(ClusterInteraction event) {
    for (final listener in _clusterListeners[event.type]?.toList() ??
        <void Function(ClusterInteraction)>[]) {
      try {
        listener(event);
      } catch (error, stack) {
        FlutterError.reportError(FlutterErrorDetails(
          exception: error,
          stack: stack,
          library: 'tmap_flutter_sdk',
          context: ErrorDescription('while dispatching a cluster interaction'),
        ));
      }
    }
  }

  /// Adds or activates a marker [clusterer] on the map.
  Future<void> addMarkerClusterer(Clusterer clusterer) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addClusterer(viewId, clusterer);
      return;
    }
    final jsonStr =
        jsonEncode(clusterer.markers.map((e) => e.toJson()).toList());
    final icons = jsonEncode(clusterer.icons);
    final zIndex = clusterer.zIndex;
    await _runJs(
      "addMarkerClusterer($jsonStr, ${clusterer.maxClusterZoom}, ${clusterer.minClusterCount}, ${clusterer.gridSize}, ${clusterer.opacity}, ${clusterer.visible}, $icons, $zIndex);",
    );
  }

  /// Clears all cluster members while retaining the clusterer.
  Future<void> clearClusterMarkers() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearClusterMarkers(viewId);
      return;
    }
    await _runJs('clearClusterMarkers();');
  }

  /// Removes the marker clusterer from the map.
  Future<void> clearMarkerClusterer() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearClusterer(viewId);
      return;
    }
    await _runJs('clearMarkerClusterer();');
  }

  // ========================================
  // Information window and label controls.
  // ========================================

  /// Adds [infoWindow] to the map.
  Future<void> addInfoWindow(InfoWindow infoWindow) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addInfoWindow(viewId, infoWindow);
      return;
    }
    final content = "'${_escapeForJs(infoWindow.content)}'";
    final border =
        infoWindow.border != null ? "'${infoWindow.border}'" : 'null';
    final offsetX = infoWindow.offset?.x;
    final offsetY = infoWindow.offset?.y;

    await _runJs(
      "addInfoWindow('${infoWindow.infoWindowId}', ${infoWindow.position.latitude}, ${infoWindow.position.longitude}, $content, ${infoWindow.type}, $border, $offsetX, $offsetY, '${infoWindow.anchor}', ${infoWindow.visible});",
    );
  }

  /// Removes the information window identified by [infoWindowId].
  Future<void> clearInfoWindow(String infoWindowId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearInfoWindow(viewId, infoWindowId);
      return;
    }
    await _runJs("clearInfoWindow('$infoWindowId');");
  }

  /// Removes all information windows from the map.
  Future<void> clearAllInfoWindows() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllInfoWindows(viewId);
      return;
    }
    await _runJs('clearAllInfoWindows();');
  }

  /// Adds a text [label] to the map.
  Future<void> addLabel(Label label) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addLabel(viewId, label);
      return;
    }
    final content = "'${_escapeForJs(label.content)}'";
    final fontColor = "'${label.fontColor.toHexColor()}'";
    final minLevel = label.minLevel;
    final maxLevel = label.maxLevel;

    await _runJs(
      "addLabel('${label.labelId}', ${label.position.latitude}, ${label.position.longitude}, $content, '${label.fontSize}', $fontColor, $minLevel, $maxLevel);",
    );
  }

  /// Removes the text label identified by [labelId].
  Future<void> clearLabel(String labelId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearLabel(viewId, labelId);
      return;
    }
    await _runJs("clearLabel('$labelId');");
  }

  /// Removes all text labels from the map.
  Future<void> clearAllLabels() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllLabels(viewId);
      return;
    }
    await _runJs('clearAllLabels();');
  }

  // ========================================
  // Shape overlay controls.
  // ========================================

  /// Adds [polyline] to the map.
  Future<void> addPolyline(Polyline polyline) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addPolyline(viewId, polyline);
      return;
    }
    final pointsJson =
        jsonEncode(polyline.points.map((p) => p.toJson()).toList());
    final strokeColor = polyline.strokeColor != null
        ? "'${polyline.strokeColor?.toHexColor()}'"
        : "'#0066FF'";

    await _runJs(
      "addPolyline('${polyline.polylineId}', $pointsJson, $strokeColor, ${polyline.strokeOpacity}, ${polyline.strokeWidth}, ${polyline.direction}, ${polyline.zIndex});",
    );
  }

  /// Removes the polyline identified by [polylineId].
  Future<void> clearPolyline(String polylineId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearPolyline(viewId, polylineId);
      return;
    }
    await _runJs("clearPolyline('$polylineId');");
  }

  /// Adds [polygon] to the map.
  Future<void> addPolygon(Polygon polygon) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addPolygon(viewId, polygon);
      return;
    }
    final pointsJson =
        jsonEncode(polygon.points.map((p) => p.toJson()).toList());
    final fillColor = polygon.fillColor != null
        ? "'${polygon.fillColor?.toHexColor()}'"
        : "'#0066FF'";
    final strokeColor = polygon.strokeColor != null
        ? "'${polygon.strokeColor?.toHexColor()}'"
        : "'#0066FF'";

    await _runJs(
      "addPolygon('${polygon.polygonId}', $pointsJson, $fillColor, ${polygon.fillOpacity}, $strokeColor, ${polygon.strokeOpacity}, ${polygon.strokeWidth}, ${polygon.zIndex});",
    );
  }

  /// Removes the polygon identified by [polygonId].
  Future<void> clearPolygon(String polygonId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearPolygon(viewId, polygonId);
      return;
    }
    await _runJs("clearPolygon('$polygonId');");
  }

  /// Adds [circle] to the map.
  Future<void> addCircle(Circle circle) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addCircle(viewId, circle);
      return;
    }
    final fillColor = circle.fillColor != null
        ? "'${circle.fillColor?.toHexColor()}'"
        : "'#FF0000'";
    final strokeColor = circle.strokeColor != null
        ? "'${circle.strokeColor?.toHexColor()}'"
        : "'#FF0000'";

    await _runJs(
      "addCircle('${circle.circleId}', ${circle.center.latitude}, ${circle.center.longitude}, ${circle.radius}, $fillColor, ${circle.fillOpacity}, $strokeColor, ${circle.strokeOpacity}, ${circle.strokeWidth}, ${circle.zIndex});",
    );
  }

  /// Removes the circle identified by [circleId].
  Future<void> clearCircle(String circleId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearCircle(viewId, circleId);
      return;
    }
    await _runJs("clearCircle('$circleId');");
  }

  /// Adds [rectangle] to the map.
  Future<void> addRectangle(Rectangle rectangle) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addRectangle(viewId, rectangle);
      return;
    }
    final fillColor = rectangle.fillColor != null
        ? "'${rectangle.fillColor?.toHexColor()}'"
        : "'#0066FF'";
    final strokeColor = rectangle.strokeColor != null
        ? "'${rectangle.strokeColor?.toHexColor()}'"
        : "'#0066FF'";
    final sw = rectangle.bounds.southWest;
    final ne = rectangle.bounds.northEast;

    await _runJs(
      "addRectangle('${rectangle.rectangleId}', ${sw.latitude}, ${sw.longitude}, ${ne.latitude}, ${ne.longitude}, $fillColor, ${rectangle.fillOpacity}, $strokeColor, ${rectangle.strokeOpacity}, ${rectangle.strokeWidth}, ${rectangle.zIndex});",
    );
  }

  /// Removes the rectangle identified by [rectangleId].
  Future<void> clearRectangle(String rectangleId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearRectangle(viewId, rectangleId);
      return;
    }
    await _runJs("clearRectangle('$rectangleId');");
  }

  /// Adds an image overlay bounded by two geographic corners.
  Future<void> addGroundOverlay(GroundOverlay overlay) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addGroundOverlay(viewId, overlay);
      return;
    }
    await _runJs('addGroundOverlay(${jsonEncode(overlay.groundOverlayId)}, '
        '${jsonEncode(overlay.url)}, '
        '${overlay.bounds.southWest.latitude}, '
        '${overlay.bounds.southWest.longitude}, '
        '${overlay.bounds.northEast.latitude}, '
        '${overlay.bounds.northEast.longitude}, ${overlay.opacity});');
  }

  /// Detaches an image overlay from this map.
  Future<void> clearGroundOverlay(String groundOverlayId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearGroundOverlay(viewId, groundOverlayId);
      return;
    }
    await _runJs('clearGroundOverlay(${jsonEncode(groundOverlayId)});');
  }

  /// Removes every image overlay registered with this controller.
  Future<void> clearAllGroundOverlays() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllGroundOverlays(viewId);
      return;
    }
    await _runJs('clearAllGroundOverlays();');
  }

  // ========================================
  // Data visualizations (DotMap, SquareMap, HeatMap).
  // ========================================

  Future<void> _addVisualization(String type, Map<String, dynamic> data) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addVisualization(viewId, type, data);
      return;
    }
    await _runJs('addVisualization(${jsonEncode(type)}, ${jsonEncode(data)});');
  }

  Future<void> _removeVisualization(String type, String id) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.removeVisualization(viewId, type, id);
      return;
    }
    await _runJs(
        'removeVisualization(${jsonEncode(type)}, ${jsonEncode(id)});');
  }

  /// Creates a dot-density visualization on this map.
  Future<void> addDotMap(DotMap layer) =>
      _addVisualization('dot', layer.toJson());

  /// Replaces an existing dot layer with the same ID and new options/data.
  Future<void> updateDotMap(DotMap layer) => addDotMap(layer);

  /// Calls the underlying DotMap's `destroy()` and releases its ID.
  Future<void> removeDotMap(String dotMapId) =>
      _removeVisualization('dot', dotMapId);

  /// Creates a geographic grid visualization on this map.
  Future<void> addSquareMap(SquareMap layer) =>
      _addVisualization('square', layer.toJson());

  /// Replaces an existing square layer with the same ID and new options/data.
  Future<void> updateSquareMap(SquareMap layer) => addSquareMap(layer);

  /// Calls the underlying SquareMap's `destroy()` and releases its ID.
  Future<void> removeSquareMap(String squareMapId) =>
      _removeVisualization('square', squareMapId);

  /// Creates a heat-density visualization on this map.
  Future<void> addHeatMap(HeatMap layer) =>
      _addVisualization('heat', layer.toJson());

  /// Replaces an existing heat layer with the same ID and new options/data.
  Future<void> updateHeatMap(HeatMap layer) => addHeatMap(layer);

  /// Calls the underlying HeatMap's `destroy()` and releases its ID.
  Future<void> removeHeatMap(String heatMapId) =>
      _removeVisualization('heat', heatMapId);

  /// Queries the SDK's polygon hit-test (including any interior rings).
  Future<bool> polygonContains(String polygonId, LatLng point) async {
    final viewId = _webViewId;
    if (viewId != null) {
      return TMapWebBridge.polygonContains(viewId, polygonId, point);
    }
    final value = await webViewController.runJavaScriptReturningResult(
      'polygonContains(${jsonEncode(polygonId)}, '
      '${point.latitude}, ${point.longitude});',
    );
    return value == true || value == 1 || value == 'true';
  }

  /// Reads the SDK-computed exterior and interior polygon areas.
  Future<PolygonArea?> getPolygonArea(String polygonId) async {
    final viewId = _webViewId;
    final String? raw;
    if (viewId != null) {
      raw = TMapWebBridge.polygonAreaJson(viewId, polygonId);
    } else {
      final result = await webViewController.runJavaScriptReturningResult(
        'polygonAreaJson(${jsonEncode(polygonId)});',
      );
      raw = result.toString();
    }
    if (raw == null || raw == 'null' || raw.isEmpty) return null;
    // WebView implementations can return either the JS string directly or
    // its JSON-encoded representation.
    dynamic decoded = jsonDecode(raw);
    if (decoded is String) decoded = jsonDecode(decoded);
    if (decoded == null) return null;
    return PolygonArea.fromJson(Map<String, dynamic>.from(decoded as Map));
  }

  /// Starts a pointer-driven circle using Tmapv3.extension.Drawing.
  Future<void> startDrawingCircle({
    required void Function(Circle) onComplete,
    DrawingOptions options = const DrawingOptions(),
  }) async {
    _drawingHandler = (data) {
      if (data['type'] != 'circle') return;
      onComplete(Circle(
        circleId: data['id'] as String,
        center:
            LatLng.fromJson(Map<String, dynamic>.from(data['center'] as Map)),
        radius: (data['radius'] as num).toDouble(),
        fillColor: options.fillColor,
        fillOpacity: options.fillOpacity,
        strokeColor: options.strokeColor,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth,
      ));
    };
    await _startDrawing('Circle', options);
  }

  /// Starts a pointer-driven rectangle.
  Future<void> startDrawingRectangle({
    required void Function(Rectangle) onComplete,
    DrawingOptions options = const DrawingOptions(),
  }) async {
    _drawingHandler = (data) {
      if (data['type'] != 'rectangle') return;
      onComplete(Rectangle(
        rectangleId: data['id'] as String,
        bounds: LatLngBounds.fromJson(
            Map<String, dynamic>.from(data['bounds'] as Map)),
        fillColor: options.fillColor,
        fillOpacity: options.fillOpacity,
        strokeColor: options.strokeColor,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth,
      ));
    };
    await _startDrawing('Rectangle', options);
  }

  /// Starts a pointer-driven polyline; finish with a secondary click.
  Future<void> startDrawingPolyline({
    required void Function(Polyline) onComplete,
    DrawingOptions options = const DrawingOptions(),
  }) async {
    _drawingHandler = (data) {
      if (data['type'] != 'polyline') return;
      onComplete(Polyline(
        polylineId: data['id'] as String,
        points: (data['points'] as List<dynamic>)
            .map((p) => LatLng.fromJson(Map<String, dynamic>.from(p as Map)))
            .toList(growable: false),
        strokeColor: options.strokeColor,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth,
      ));
    };
    await _startDrawing('Polyline', options);
  }

  /// Starts a pointer-driven polygon; finish with a secondary click.
  Future<void> startDrawingPolygon({
    required void Function(Polygon) onComplete,
    DrawingOptions options = const DrawingOptions(),
  }) async {
    _drawingHandler = (data) {
      if (data['type'] != 'polygon') return;
      onComplete(Polygon(
        polygonId: data['id'] as String,
        points: (data['points'] as List<dynamic>)
            .map((p) => LatLng.fromJson(Map<String, dynamic>.from(p as Map)))
            .toList(growable: false),
        fillColor: options.fillColor,
        fillOpacity: options.fillOpacity,
        strokeColor: options.strokeColor,
        strokeOpacity: options.strokeOpacity,
        strokeWidth: options.strokeWidth,
      ));
    };
    await _startDrawing('Polygon', options);
  }

  Future<void> _startDrawing(String mode, DrawingOptions options) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.startDrawing(viewId, mode, options.toJson());
      return;
    }
    await _runJs('startDrawing(${jsonEncode(mode)}, '
        '${jsonEncode(options.toJson())});');
  }

  /// Clears completed drawings and cancels any in-progress gesture.
  Future<void> clearDrawings() async {
    _drawingHandler = null;
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearDrawings(viewId);
      return;
    }
    await _runJs('clearDrawings();');
  }

  /// Receives a completion payload from the platform bridge.
  void handleDrawingComplete(String payload) {
    final handler = _drawingHandler;
    if (handler == null) return;
    final parsed = jsonDecode(payload);
    if (parsed is Map) handler(Map<String, dynamic>.from(parsed));
  }

  /// Adds a custom HTML [overlay] to the map.
  Future<void> addCustomOverlay(CustomOverlay overlay) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addCustomOverlay(viewId, overlay);
      return;
    }
    final content = "'${_escapeForJs(overlay.content)}'";
    final offsetX = overlay.offset?.x;
    final offsetY = overlay.offset?.y;

    await _runJs(
      "addCustomOverlay('${overlay.customOverlayId}', ${overlay.position.latitude}, ${overlay.position.longitude}, $content, $offsetX, $offsetY, ${overlay.zIndex});",
    );
  }

  /// Removes the custom overlay identified by [customOverlayId].
  Future<void> clearCustomOverlay(String customOverlayId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearCustomOverlay(viewId, customOverlayId);
      return;
    }
    await _runJs("clearCustomOverlay('$customOverlayId');");
  }

  /// Removes all polylines from the map.
  Future<void> clearAllPolylines() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllPolylines(viewId);
      return;
    }
    await _runJs('clearAllPolylines();');
  }

  /// Removes all polylines and polygons from the map.
  Future<void> clearAllPolylinesAndPolygons() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllPolylines(viewId);
      TMapWebBridge.clearAllPolygons(viewId);
      return;
    }
    await _runJs('clearAllPolylines(); clearAllPolygons();');
  }

  /// Removes all polygons from the map.
  Future<void> clearAllPolygons() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllPolygons(viewId);
      return;
    }
    await _runJs('clearAllPolygons();');
  }

  /// Removes all circles from the map.
  Future<void> clearAllCircles() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllCircles(viewId);
      return;
    }
    await _runJs('clearAllCircles();');
  }

  /// Removes all rectangles from the map.
  Future<void> clearAllRectangles() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllRectangles(viewId);
      return;
    }
    await _runJs('clearAllRectangles();');
  }

  /// Removes all custom overlays from the map.
  Future<void> clearAllCustomOverlays() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllCustomOverlays(viewId);
      return;
    }
    await _runJs('clearAllCustomOverlays();');
  }

  /// Removes all supported map overlays, shapes, and markers.
  Future<void> clearAll() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAll(viewId);
      return;
    }
    await _runJs('clearAll();');
  }

  // ========================================
  // Convenience methods for drawing individual shapes.
  // ========================================

  /// Creates and adds a polyline with a generated ID.
  Future<void> drawPolyline({
    required List<LatLng> points,
    Color? strokeColor,
    int strokeWidth = 6,
    double strokeOpacity = 1.0,
    bool direction = false,
  }) async {
    final polyline = Polyline(
      polylineId: 'polyline_${DateTime.now().millisecondsSinceEpoch}',
      points: points,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
      strokeOpacity: strokeOpacity,
      direction: direction,
    );
    await addPolyline(polyline);
  }

  /// Creates and adds a polygon with a generated ID.
  Future<void> drawPolygon({
    required List<LatLng> points,
    Color? fillColor,
    double fillOpacity = 0.3,
    Color? strokeColor,
    int strokeWidth = 2,
    double strokeOpacity = 1.0,
  }) async {
    final polygon = Polygon(
      polygonId: 'polygon_${DateTime.now().millisecondsSinceEpoch}',
      points: points,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
      strokeOpacity: strokeOpacity,
    );
    await addPolygon(polygon);
  }

  /// Creates and adds a circle with a generated ID.
  Future<void> drawCircle({
    required LatLng center,
    required double radius,
    Color? fillColor,
    double fillOpacity = 0.3,
    Color? strokeColor,
    int strokeWidth = 2,
    double strokeOpacity = 1.0,
  }) async {
    final circle = Circle(
      circleId: 'circle_${DateTime.now().millisecondsSinceEpoch}',
      center: center,
      radius: radius,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
      strokeOpacity: strokeOpacity,
    );
    await addCircle(circle);
  }

  /// Creates and adds a rectangle with a generated ID.
  Future<void> drawRectangle({
    required LatLngBounds bounds,
    Color? fillColor,
    double fillOpacity = 0.3,
    Color? strokeColor,
    int strokeWidth = 2,
    double strokeOpacity = 1.0,
  }) async {
    final rect = Rectangle(
      rectangleId: 'rect_${DateTime.now().millisecondsSinceEpoch}',
      bounds: bounds,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
      strokeOpacity: strokeOpacity,
    );
    await addRectangle(rect);
  }

  // ========================================
  // Traffic information.
  // ========================================

  /// Sets the visibility of the real-time traffic layer on the map.
  Future<void> toggleTrafficInfo(bool isVisible) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.toggleTraffic(viewId, isVisible);
      return;
    }
    await _runJs('toggleTraffic($isVisible);');
  }

  // ========================================
  // TData OpenAPI integration.
  // ========================================

  /// Requests a driving route from the TData OpenAPI.
  Future<RouteInfo?> getRoutePlan({
    required LatLng start,
    required LatLng end,
    Map<String, dynamic>? options,
  }) {
    return TDataService.getRoutePlan(
      start: start,
      end: end,
      options: options,
    );
  }

  /// Requests a pedestrian route from the TData OpenAPI.
  ///
  /// Uses Korean default names for the start and end points.
  Future<RouteInfo?> getRoutePlanPedestrian({
    required LatLng start,
    required LatLng end,
    String startName = '출발지',
    String endName = '도착지',
    Map<String, dynamic>? options,
  }) {
    return TDataService.getRoutePlanPedestrian(
      start: start,
      end: end,
      startName: startName,
      endName: endName,
      options: options,
    );
  }

  /// Searches for points of interest by [keyword] through the TData OpenAPI.
  Future<List<PoiItem>> searchPoi({
    required String keyword,
    LatLng? center,
    int? radius,
    int count = 20,
    int page = 1,
  }) {
    return TDataService.searchPoi(
      searchKeyword: keyword,
      center: center,
      radius: radius,
      count: count,
      page: page,
    );
  }

  /// Searches for nearby points of interest by optional [category].
  ///
  /// Uses [center] as the search origin for the TData OpenAPI.
  Future<List<PoiItem>> searchPoiAround({
    required LatLng center,
    String? category,
    int radius = 1,
    int count = 20,
    int page = 1,
  }) {
    return TDataService.searchPoiAround(
      center: center,
      categories: category,
      radius: radius,
      count: count,
      page: page,
    );
  }

  /// Geocodes [address] to WGS84 latitude/longitude coordinates.
  Future<LatLng?> getGeoFromAddress({
    required String address,
  }) {
    return TDataService.getGeoFromAddress(address: address);
  }

  /// Reverse-geocodes WGS84 [latLng] to an address.
  Future<AddressInfo?> getAddressFromGeo({
    required LatLng latLng,
    String addressType = 'A04',
  }) {
    return TDataService.getAddressFromGeo(
        point: latLng, addressType: addressType);
  }

  /// Gets POI keyword completions from the TData OpenAPI.
  Future<List<AutoCompleteItem>> getAutoCompleteSearch({
    required String keyword,
  }) {
    return TDataService.getAutoCompleteSearch(keyword: keyword);
  }
}
