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
import 'services/tdata_service.dart';
import 'utils/hex_color.dart';
import 'web/tmap_web_bridge_stub.dart'
    if (dart.library.js_interop) 'web/tmap_web_bridge.dart';

/// TMAP 지도를 제어하는 컨트롤러 클래스입니다.
class TMapController {
  final WebViewController? _webViewController;
  final String? _webViewId;
  void Function(Map<String, dynamic>)? _drawingHandler;

  final Map<String,
          Map<MarkerInteractionType, Set<void Function(MarkerInteraction)>>>
      _markerListeners = {};
  final Map<ClusterInteractionType, Set<void Function(ClusterInteraction)>>
      _clusterListeners = {};

  /// 모바일 WebViewController 반환
  WebViewController get webViewController {
    final controller = _webViewController;
    if (controller != null) return controller;
    throw UnsupportedError(
        'webViewController is only available on Mobile platforms.');
  }

  String? _lastLoadedHtml;
  String? _lastLoadedBaseUrl;
  String? _currentDocId;

  /// 모바일(WebView) 컨트롤러 생성자
  TMapController(WebViewController webViewController)
      : _webViewController = webViewController,
        _webViewId = null;

  /// Web(DOM) 컨트롤러 생성자
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
  // 지도 기본 제어
  // ========================================

  /// 지도의 중심 좌표를 이동합니다.
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

  /// 줌 레벨을 설정합니다 (0~19).
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

  Future<Map<String, dynamic>> _readMap(
      String name, [Map<String, dynamic> args = const {}]) async {
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

  /// 현재 지도의 중심 좌표를 SDK로부터 읽습니다.
  Future<LatLng> getCenter() async => LatLng.fromJson(await _readMap('getCenter'));

  /// 현재 화면에서 보이는 지도 경계를 반환합니다.
  Future<LatLngBounds> getBounds() async =>
      LatLngBounds.fromJson(await _readMap('getBounds'));

  /// 현재 줌을 반환합니다. 애니메이션 중에는 소수점 줌일 수 있습니다.
  Future<double> getZoom() => _getNumber('getZoom');

  Future<double> getMinZoom() => _getNumber('getMinZoom');

  Future<double> getMaxZoom() => _getNumber('getMaxZoom');

  Future<double> getBearing() => _getNumber('getBearing');

  Future<double> getPitch() => _getNumber('getPitch');

  /// 지도상 위경도를 지도 컨테이너 기준 화면 픽셀로 변환합니다.
  Future<Point> realToScreen(LatLng position) async => Point.fromJson(
        await _readMap('realToScreen', position.toJson()),
      );

  /// 지도 컨테이너 기준 화면 픽셀을 위경도로 변환합니다.
  Future<LatLng> screenToReal(Point pixel) async => LatLng.fromJson(
        await _readMap('screenToReal', pixel.toJson()),
      );

  /// 지도 SDK가 사용 중인 화면 크기를 픽셀로 반환합니다.
  Future<tmap_size.Size> screenSize() async =>
      tmap_size.Size.fromJson(await _readMap('screenSize'));

  /// 최소/최대 허용 줌을 변경합니다.
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

  /// SDK 고유의 Bessel 및 KATEC 좌표 변환용 내부 전달 함수입니다.
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

  /// 1레벨 확대합니다.
  Future<void> zoomIn() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.zoomIn(viewId);
      return;
    }
    await _runJs('zoomIn();');
  }

  /// 1레벨 축소합니다.
  Future<void> zoomOut() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.zoomOut(viewId);
      return;
    }
    await _runJs('zoomOut();');
  }

  /// 전체 맵이 보이도록 최대 영역으로 축소합니다.
  Future<void> zoomToMaxExtent() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.zoomToMaxExtent(viewId);
      return;
    }
    await _runJs('zoomToMaxExtent();');
  }

  /// 지정 좌표로 지도를 부드럽게 패닝 이동합니다.
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

  /// 화면 픽셀 거리(x, y)만큼 지도를 이동합니다.
  Future<void> panBy(int x, int y) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.panBy(viewId, x, y);
      return;
    }
    await _runJs('panBy($x, $y);');
  }

  /// 지도 회전 각도를 설정합니다 (0 ~ 360도).
  Future<void> setBearing(double bearing) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setBearing(viewId, bearing);
      return;
    }
    await _runJs('setBearing($bearing);');
  }

  /// 지도 기울기 각도를 설정합니다 (0 ~ 60도).
  Future<void> setPitch(double pitch) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setPitch(viewId, pitch);
      return;
    }
    await _runJs('setPitch($pitch);');
  }

  /// 지도 타입을 설정합니다.
  Future<void> setMapType(TMapType mapType) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.setMapType(viewId, mapType);
      return;
    }
    await _runJs("setMapType('${mapType.value}');");
  }

  /// 주어진 영역이 화면에 맞게 보이도록 지도를 조정합니다.
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

  /// 지도 크기 재계산 (리사이즈/레이아웃 복구)
  Future<void> relayout() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.relayout(viewId);
      return;
    }
    await _runJs('relayout();');
  }

  /// 지도 옵션(줌 제한, 컨트롤 표시 여부 등)을 업데이트합니다.
  Future<void> updateMapOptions(Map<String, dynamic> options) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.updateMapOptions(viewId, options);
      return;
    }
    await _runJs('updateMapOptions(${jsonEncode(options)});');
  }

  /// HTML 문자열을 웹뷰에 다시 로드합니다.
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

  /// 웹뷰를 새로고침합니다.
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
  // 마커 제어
  // ========================================

  /// 한 마커의 SDK 이벤트를 구독합니다. 등록 후에도 마커 교체가 가능합니다.
  void onMarkerEvent(String markerId, MarkerInteractionType type,
      void Function(MarkerInteraction) listener) {
    _markerListeners
        .putIfAbsent(markerId, () => {})
        .putIfAbsent(type, () => {})
        .add(listener);
  }

  /// 이전에 등록한 마커 이벤트 핸들러를 해제합니다.
  void offMarkerEvent(String markerId, MarkerInteractionType type,
      void Function(MarkerInteraction) listener) {
    final byType = _markerListeners[markerId];
    byType?[type]?.remove(listener);
    if (byType?[type]?.isEmpty ?? false) byType!.remove(type);
    if (byType?.isEmpty ?? false) _markerListeners.remove(markerId);
  }

  /// 브리지에서 전달된 마커 이벤트를 Dart 구독자에게 전달합니다.
  void dispatchMarkerInteraction(MarkerInteraction event) {
    final listeners = _markerListeners[event.markerId]?[event.type];
    if (listeners == null) return;
    for (final listener in listeners.toList()) {
      listener(event);
    }
  }

  /// 지도에 마커를 추가합니다.
  Future<void> addMarker(Marker marker) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.addMarker(viewId, marker);
      return;
    }
    await _runJs('addMarker(${jsonEncode(marker.toJson())});');
  }

  /// 여러 마커를 일괄 추가합니다.
  Future<void> addMarkers(List<Marker> markers) async {
    for (final marker in markers) {
      await addMarker(marker);
    }
  }

  /// 특정 마커를 제거합니다.
  Future<void> clearMarker(String markerId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearMarker(viewId, markerId);
      return;
    }
    await _runJs('clearMarker(${jsonEncode(markerId)});');
  }

  /// 모든 마커를 제거합니다.
  Future<void> clearAllMarkers() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllMarkers(viewId);
      return;
    }
    await _runJs('clearAllMarkers();');
  }

  // ========================================
  // 마커 클러스터러 제어
  // ========================================

  /// 클러스터 그룹의 포인터 이벤트를 구독합니다.
  void onClusterEvent(
      ClusterInteractionType type, void Function(ClusterInteraction) listener) {
    _clusterListeners.putIfAbsent(type, () => {}).add(listener);
  }

  /// 클러스터 그룹의 포인터 이벤트 구독을 해제합니다.
  void offClusterEvent(
      ClusterInteractionType type, void Function(ClusterInteraction) listener) {
    _clusterListeners[type]?.remove(listener);
    if (_clusterListeners[type]?.isEmpty ?? false) {
      _clusterListeners.remove(type);
    }
  }

  /// 브리지에서 전달된 클러스터 이벤트를 Dart 구독자에게 전달합니다.
  void dispatchClusterInteraction(ClusterInteraction event) {
    for (final listener in _clusterListeners[event.type]?.toList() ??
        <void Function(ClusterInteraction)>[]) {
      listener(event);
    }
  }

  /// 마커 클러스터러를 추가/활성화합니다.
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

  /// 클러스터러를 유지하면서 현재 멤버를 모두 제거합니다.
  Future<void> clearClusterMarkers() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearClusterMarkers(viewId);
      return;
    }
    await _runJs('clearClusterMarkers();');
  }

  /// 마커 클러스터러를 제거합니다.
  Future<void> clearMarkerClusterer() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearClusterer(viewId);
      return;
    }
    await _runJs('clearMarkerClusterer();');
  }

  // ========================================
  // 정보창 (InfoWindow) & 라벨 제어
  // ========================================

  /// 정보창을 추가합니다.
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

  /// 특정 정보창을 제거합니다.
  Future<void> clearInfoWindow(String infoWindowId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearInfoWindow(viewId, infoWindowId);
      return;
    }
    await _runJs("clearInfoWindow('$infoWindowId');");
  }

  /// 모든 정보창을 제거합니다.
  Future<void> clearAllInfoWindows() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllInfoWindows(viewId);
      return;
    }
    await _runJs('clearAllInfoWindows();');
  }

  /// 텍스트 라벨을 추가합니다.
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

  /// 특정 텍스트 라벨을 제거합니다.
  Future<void> clearLabel(String labelId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearLabel(viewId, labelId);
      return;
    }
    await _runJs("clearLabel('$labelId');");
  }

  /// 모든 텍스트 라벨을 제거합니다.
  Future<void> clearAllLabels() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllLabels(viewId);
      return;
    }
    await _runJs('clearAllLabels();');
  }

  // ========================================
  // 도형 오버레이 제어
  // ========================================

  /// 폴리라인(선)을 추가합니다.
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

  /// 특정 폴리라인을 제거합니다.
  Future<void> clearPolyline(String polylineId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearPolyline(viewId, polylineId);
      return;
    }
    await _runJs("clearPolyline('$polylineId');");
  }

  /// 다각형을 추가합니다.
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

  /// 특정 다각형을 제거합니다.
  Future<void> clearPolygon(String polygonId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearPolygon(viewId, polygonId);
      return;
    }
    await _runJs("clearPolygon('$polygonId');");
  }

  /// 원을 추가합니다.
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

  /// 특정 원을 제거합니다.
  Future<void> clearCircle(String circleId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearCircle(viewId, circleId);
      return;
    }
    await _runJs("clearCircle('$circleId');");
  }

  /// 사각형을 추가합니다.
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

  /// 특정 사각형을 제거합니다.
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

  /// 커스텀 HTML 오버레이를 추가합니다.
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

  /// 특정 커스텀 오버레이를 제거합니다.
  Future<void> clearCustomOverlay(String customOverlayId) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearCustomOverlay(viewId, customOverlayId);
      return;
    }
    await _runJs("clearCustomOverlay('$customOverlayId');");
  }

  /// 모든 폴리라인을 제거합니다.
  Future<void> clearAllPolylines() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllPolylines(viewId);
      return;
    }
    await _runJs('clearAllPolylines();');
  }

  /// 모든 폴리라인과 다각형을 일괄 제거합니다.
  Future<void> clearAllPolylinesAndPolygons() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllPolylines(viewId);
      TMapWebBridge.clearAllPolygons(viewId);
      return;
    }
    await _runJs('clearAllPolylines(); clearAllPolygons();');
  }

  /// 모든 다각형을 제거합니다.
  Future<void> clearAllPolygons() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllPolygons(viewId);
      return;
    }
    await _runJs('clearAllPolygons();');
  }

  /// 모든 원을 제거합니다.
  Future<void> clearAllCircles() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllCircles(viewId);
      return;
    }
    await _runJs('clearAllCircles();');
  }

  /// 모든 사각형을 제거합니다.
  Future<void> clearAllRectangles() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllRectangles(viewId);
      return;
    }
    await _runJs('clearAllRectangles();');
  }

  /// 모든 커스텀 오버레이를 제거합니다.
  Future<void> clearAllCustomOverlays() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAllCustomOverlays(viewId);
      return;
    }
    await _runJs('clearAllCustomOverlays();');
  }

  /// 지도 위의 모든 오버레이/도형/마커를 일괄 삭제합니다.
  Future<void> clearAll() async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.clearAll(viewId);
      return;
    }
    await _runJs('clearAll();');
  }

  // ========================================
  // 편의 메서드: 단일 도형 그리기
  // ========================================

  /// 폴리라인을 빠르게 그립니다.
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

  /// 다각형을 빠르게 그립니다.
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

  /// 원을 빠르게 그립니다.
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

  /// 사각형을 빠르게 그립니다.
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
  // 교통 정보
  // ========================================

  /// 지도 위 실시간 교통정보 표시를 On/Off 합니다.
  Future<void> toggleTrafficInfo(bool isVisible) async {
    final viewId = _webViewId;
    if (viewId != null) {
      TMapWebBridge.toggleTraffic(viewId, isVisible);
      return;
    }
    await _runJs('toggleTraffic($isVisible);');
  }

  // ========================================
  // TData OpenAPI 연동
  // ========================================

  /// 자동차 경로 탐색 (TData OpenAPI)
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

  /// 보행자 경로 탐색 (TData OpenAPI)
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

  /// POI 명칭/키워드 검색 (TData OpenAPI)
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

  /// 주변 특정 업종/키워드 POI 검색 (TData OpenAPI)
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

  /// 주소로 위경도 좌표 검색 (지오코딩)
  Future<LatLng?> getGeoFromAddress({
    required String address,
  }) {
    return TDataService.getGeoFromAddress(address: address);
  }

  /// 위경도 좌표로 주소 검색 (역지오코딩)
  Future<AddressInfo?> getAddressFromGeo({
    required LatLng latLng,
    String addressType = 'A04',
  }) {
    return TDataService.getAddressFromGeo(
        point: latLng, addressType: addressType);
  }

  /// POI 검색어 자동완성 (TData OpenAPI)
  Future<List<AutoCompleteItem>> getAutoCompleteSearch({
    required String keyword,
  }) {
    return TDataService.getAutoCompleteSearch(keyword: keyword);
  }
}
