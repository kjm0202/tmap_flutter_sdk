import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'auth/auth_repository.dart';
import 'constants/map_type.dart';
import 'models/address_info.dart';
import 'models/auto_complete_item.dart';
import 'models/lat_lng.dart';
import 'models/lat_lng_bounds.dart';
import 'models/poi_item.dart';
import 'models/point.dart';
import 'models/route_info.dart';
import 'overlays/circle.dart';
import 'overlays/clusterer.dart';
import 'overlays/custom_overlay.dart';
import 'overlays/info_window.dart';
import 'overlays/label.dart';
import 'overlays/marker.dart';
import 'overlays/polygon.dart';
import 'overlays/polyline.dart';
import 'overlays/rectangle.dart';
import 'services/tdata_service.dart';
import 'utils/hex_color.dart';

/// TMAP 지도를 제어하는 컨트롤러 클래스입니다.
class TMapController {
  final WebViewController _webViewController;

  WebViewController get webViewController => _webViewController;

  TMapController(this._webViewController);

  Future<void> _runJs(String script) async {
    try {
      await _webViewController.runJavaScript(script);
    } catch (e) {
      if (kIsWeb) {
        debugPrint('[TMapController] runJavaScript not supported on Web: $script');
      } else {
        rethrow;
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
    await _runJs(
      'setCenter(${center.latitude}, ${center.longitude});',
    );
  }

  /// 줌 레벨을 설정합니다 (0~19).
  Future<void> setZoom(int zoom) async {
    await _runJs('setZoom($zoom);');
  }

  /// 1레벨 확대합니다.
  Future<void> zoomIn() async {
    await _runJs('zoomIn();');
  }

  /// 1레벨 축소합니다.
  Future<void> zoomOut() async {
    await _runJs('zoomOut();');
  }

  /// 전체 맵이 보이도록 최대 영역으로 축소합니다.
  Future<void> zoomToMaxExtent() async {
    await _runJs('zoomToMaxExtent();');
  }

  /// 지정 좌표로 지도를 부드럽게 패닝 이동합니다.
  Future<void> panTo(LatLng target) async {
    await _runJs(
      'panTo(${target.latitude}, ${target.longitude});',
    );
  }

  /// 화면 픽셀 거리(x, y)만큼 지도를 이동합니다.
  Future<void> panBy(int x, int y) async {
    await _runJs('panBy($x, $y);');
  }

  /// 지도 회전 각도를 설정합니다 (0 ~ 360도).
  Future<void> setBearing(double bearing) async {
    await _runJs('setBearing($bearing);');
  }

  /// 지도 기울기 각도를 설정합니다 (0 ~ 60도).
  Future<void> setPitch(double pitch) async {
    await _runJs('setPitch($pitch);');
  }

  /// 지도 타입을 설정합니다.
  Future<void> setMapType(TMapType mapType) async {
    await _runJs("setMapType('${mapType.value}');");
  }

  /// 주어진 영역이 화면에 맞게 보이도록 지도를 조정합니다.
  Future<void> fitBounds(LatLngBounds bounds, {int? padding}) async {
    final padStr = padding != null ? ', $padding' : '';
    await _runJs(
      'fitBounds(${bounds.southWest.latitude}, ${bounds.southWest.longitude}, ${bounds.northEast.latitude}, ${bounds.northEast.longitude}$padStr);',
    );
  }

  /// 지도 크기 재계산 (리사이즈/레이아웃 복구)
  Future<void> relayout() async {
    await _runJs('relayout();');
  }

  /// HTML 문자열을 웹뷰에 다시 로드합니다.
  Future<void> reloadHtml(String htmlString, {String? baseUrl}) async {
    await _webViewController.loadHtmlString(
      htmlString,
      baseUrl: baseUrl ?? AuthRepository.instance.baseUrl,
    );
  }

  /// 웹뷰를 새로고침합니다.
  Future<void> reload() async {
    await _webViewController.reload();
  }

  // ========================================
  // 마커 제어
  // ========================================

  /// 지도에 단일 마커를 추가합니다.
  Future<void> addMarker(Marker marker) async {
    final iconUrl = marker.icon?.iconUrl != null
        ? "'${_escapeForJs(marker.icon?.iconUrl ?? '')}'"
        : 'null';
    final iconHtml = marker.icon?.iconHtml != null
        ? "'${_escapeForJs(marker.icon?.iconHtml ?? '')}'"
        : 'null';
    final iconW = marker.icon?.size?.width;
    final iconH = marker.icon?.size?.height;
    final offsetX = marker.icon?.offset?.x;
    final offsetY = marker.icon?.offset?.y;
    final title =
        marker.title != null ? "'${_escapeForJs(marker.title ?? '')}'" : 'null';
    final label =
        marker.label != null ? "'${_escapeForJs(marker.label ?? '')}'" : 'null';
    final labelBg = marker.labelBackgroundColor != null
        ? "'${marker.labelBackgroundColor?.toHexColor()}'"
        : 'null';
    final labelColor = marker.labelTextColor != null
        ? "'${marker.labelTextColor?.toHexColor()}'"
        : 'null';
    final color =
        marker.color != null ? "'${marker.color?.toHexColor()}'" : 'null';

    await _runJs(
      "addMarker('${marker.markerId}', ${marker.position.latitude}, ${marker.position.longitude}, $title, $label, $labelBg, $labelColor, $iconUrl, $iconHtml, $iconW, $iconH, $offsetX, $offsetY, $color, '${marker.anchor}', ${marker.opacity}, ${marker.visible}, ${marker.draggable}, ${marker.zIndex});",
    );
  }

  /// 지도에 여러 마커를 일괄 추가합니다.
  Future<void> addMarkers(List<Marker> markers) async {
    for (final marker in markers) {
      await addMarker(marker);
    }
  }

  /// 특정 마커를 제거합니다.
  Future<void> clearMarker(String markerId) async {
    await _runJs("clearMarker('$markerId');");
  }

  /// 모든 마커를 제거합니다.
  Future<void> clearAllMarkers() async {
    await _runJs('clearAllMarkers();');
  }

  // ========================================
  // 마커 클러스터러
  // ========================================

  /// 대용량 마커 클러스터러를 추가합니다.
  Future<void> addMarkerClusterer(Clusterer clusterer) async {
    final jsonStr =
        jsonEncode(clusterer.markers.map((e) => e.toJson()).toList());
    await _runJs(
      "addMarkerClusterer($jsonStr, ${clusterer.maxClusterZoom}, ${clusterer.minClusterCount}, ${clusterer.gridSize}, ${clusterer.opacity}, ${clusterer.visible});",
    );
  }

  /// 마커 클러스터러를 제거합니다.
  Future<void> clearMarkerClusterer() async {
    await _runJs('clearMarkerClusterer();');
  }

  // ========================================
  // 인포윈도우 & 라벨
  // ========================================

  /// 정보창(InfoWindow)을 추가합니다.
  Future<void> addInfoWindow(InfoWindow infoWindow) async {
    final content = "'${_escapeForJs(infoWindow.content)}'";
    final border = infoWindow.border != null
        ? "'${_escapeForJs(infoWindow.border ?? '')}'"
        : 'null';
    final offsetX = infoWindow.offset?.x;
    final offsetY = infoWindow.offset?.y;

    await _runJs(
      "addInfoWindow('${infoWindow.infoWindowId}', ${infoWindow.position.latitude}, ${infoWindow.position.longitude}, $content, ${infoWindow.type}, $border, $offsetX, $offsetY, '${infoWindow.anchor}', ${infoWindow.visible});",
    );
  }

  /// 특정 정보창을 제거합니다.
  Future<void> clearInfoWindow(String infoWindowId) async {
    await _runJs("clearInfoWindow('$infoWindowId');");
  }

  /// 모든 정보창을 제거합니다.
  Future<void> clearAllInfoWindows() async {
    await _runJs('clearAllInfoWindows();');
  }

  /// 텍스트 라벨을 추가합니다.
  Future<void> addLabel(Label label) async {
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
    await _runJs("clearLabel('$labelId');");
  }

  /// 모든 텍스트 라벨을 제거합니다.
  Future<void> clearAllLabels() async {
    await _runJs('clearAllLabels();');
  }

  // ========================================
  // 도형 오버레이 (Polyline, Polygon, Circle, Rectangle, CustomOverlay)
  // ========================================

  /// 폴리라인을 추가합니다.
  Future<void> addPolyline(Polyline polyline) async {
    final pointsJson =
        jsonEncode(polyline.points.map((e) => e.toJson()).toList());
    final strokeColor = polyline.strokeColor != null
        ? "'${polyline.strokeColor?.toHexColor()}'"
        : "'#0066FF'";

    await _runJs(
      "addPolyline('${polyline.polylineId}', $pointsJson, $strokeColor, ${polyline.strokeOpacity}, ${polyline.strokeWidth}, ${polyline.direction}, ${polyline.zIndex});",
    );
  }

  /// 특정 폴리라인을 제거합니다.
  Future<void> clearPolyline(String polylineId) async {
    await _runJs("clearPolyline('$polylineId');");
  }

  /// 다각형을 추가합니다.
  Future<void> addPolygon(Polygon polygon) async {
    final pointsJson =
        jsonEncode(polygon.points.map((e) => e.toJson()).toList());
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
    await _runJs("clearPolygon('$polygonId');");
  }

  /// 원을 추가합니다.
  Future<void> addCircle(Circle circle) async {
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
    await _runJs("clearCircle('$circleId');");
  }

  /// 사각형을 추가합니다.
  Future<void> addRectangle(Rectangle rectangle) async {
    final fillColor = rectangle.fillColor != null
        ? "'${rectangle.fillColor?.toHexColor()}'"
        : "'#00AA00'";
    final strokeColor = rectangle.strokeColor != null
        ? "'${rectangle.strokeColor?.toHexColor()}'"
        : "'#00AA00'";
    final sw = rectangle.bounds.southWest;
    final ne = rectangle.bounds.northEast;

    await _runJs(
      "addRectangle('${rectangle.rectangleId}', ${sw.latitude}, ${sw.longitude}, ${ne.latitude}, ${ne.longitude}, $fillColor, ${rectangle.fillOpacity}, $strokeColor, ${rectangle.strokeOpacity}, ${rectangle.strokeWidth}, ${rectangle.zIndex});",
    );
  }

  /// 특정 사각형을 제거합니다.
  Future<void> clearRectangle(String rectangleId) async {
    await _runJs("clearRectangle('$rectangleId');");
  }

  /// 커스텀 HTML 오버레이를 추가합니다.
  Future<void> addCustomOverlay(CustomOverlay overlay) async {
    final content = "'${_escapeForJs(overlay.content)}'";
    final offsetX = overlay.offset?.x;
    final offsetY = overlay.offset?.y;

    await _runJs(
      "addCustomOverlay('${overlay.customOverlayId}', ${overlay.position.latitude}, ${overlay.position.longitude}, $content, $offsetX, $offsetY, ${overlay.zIndex});",
    );
  }

  /// 모든 폴리라인을 제거합니다.
  Future<void> clearAllPolylines() async {
    await _runJs('clearAllPolylines();');
  }

  /// 모든 다각형을 제거합니다.
  Future<void> clearAllPolygons() async {
    await _runJs('clearAllPolygons();');
  }

  /// 모든 원을 제거합니다.
  Future<void> clearAllCircles() async {
    await _runJs('clearAllCircles();');
  }

  /// 모든 사각형을 제거합니다.
  Future<void> clearAllRectangles() async {
    await _runJs('clearAllRectangles();');
  }

  /// 모든 커스텀 오버레이를 제거합니다.
  Future<void> clearAllCustomOverlays() async {
    await _runJs('clearAllCustomOverlays();');
  }

  /// 지도 위의 모든 오버레이/도형/마커를 일괄 삭제합니다.
  Future<void> clearAll() async {
    await _runJs('clearAll();');
  }

  // ========================================
  // TData OpenAPI 연동 서비스
  // ========================================

  /// 자동차 경로 탐색을 요청합니다.
  Future<RouteInfo?> getRoutePlan({
    required LatLng start,
    required LatLng end,
    Map<String, dynamic>? options,
  }) {
    return TDataService.getRoutePlan(start: start, end: end, options: options);
  }

  /// 보행자 경로 탐색을 요청합니다.
  Future<RouteInfo?> getRoutePlanPedestrian({
    required LatLng start,
    required LatLng end,
    String startName = '출발지',
    String endName = '목적지',
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

  /// 키워드로 POI 장소 목록을 검색합니다.
  Future<List<PoiItem>> searchPoi({
    required String keyword,
    int count = 20,
    int page = 1,
    int? radius,
    LatLng? center,
  }) {
    return TDataService.searchPoi(
      searchKeyword: keyword,
      count: count,
      page: page,
      radius: radius,
      center: center,
    );
  }

  /// 특정 좌표 주변의 POI를 검색합니다.
  /// [radius]는 검색 반경(km, 1~33km)입니다. (기본값: 1km)
  Future<List<PoiItem>> searchPoiAround({
    required LatLng center,
    String? category,
    int count = 20,
    int page = 1,
    int radius = 1,
  }) {
    return TDataService.searchPoiAround(
      center: center,
      categories: category,
      count: count,
      page: page,
      radius: radius,
    );
  }

  /// 주소를 좌표로 변환합니다 (지오코딩).
  Future<LatLng?> getGeoFromAddress({
    required String address,
  }) {
    return TDataService.getGeoFromAddress(address: address);
  }

  /// 좌표를 주소로 변환합니다 (역지오코딩).
  Future<AddressInfo?> getAddressFromGeo(LatLng point) {
    return TDataService.getAddressFromGeo(point: point);
  }

  /// 검색어 자동완성 목록을 가져옵니다.
  Future<List<AutoCompleteItem>> getAutoCompleteSearch(String keyword) {
    return TDataService.getAutoCompleteSearch(keyword: keyword);
  }

  /// 지도 위 실시간 교통정보 표시를 On/Off 합니다.
  Future<void> toggleTrafficInfo(bool isVisible) async {
    await _runJs('toggleTraffic($isVisible);');
  }

  // ========================================
  // 유틸리티
  // ========================================

  /// 스크린 좌표(픽셀)를 위경도 좌표로 변환합니다.
  Future<LatLng?> screenToReal(Point point) async {
    final result = await _webViewController.runJavaScriptReturningResult(
      'screenToReal(${point.x}, ${point.y});',
    );
    if (result is String && result.isNotEmpty && result != 'null') {
      final json = jsonDecode(result) as Map<String, dynamic>;
      return LatLng.fromJson(json);
    }
    return null;
  }

  /// 위경도 좌표를 스크린 픽셀 좌표로 변환합니다.
  Future<Point?> realToScreen(LatLng point) async {
    final result = await _webViewController.runJavaScriptReturningResult(
      'realToScreen(${point.latitude}, ${point.longitude});',
    );
    if (result is String && result.isNotEmpty && result != 'null') {
      final json = jsonDecode(result) as Map<String, dynamic>;
      return Point.fromJson(json);
    }
    return null;
  }

  /// 현재 지도의 영역(Bounds)을 가져옵니다.
  Future<LatLngBounds?> getBounds() async {
    final result = await _webViewController.runJavaScriptReturningResult(
      'getBoundsData();',
    );
    if (result is String && result.isNotEmpty && result != 'null') {
      final json = jsonDecode(result) as Map<String, dynamic>;
      return LatLngBounds.fromJson(json);
    }
    return null;
  }
}
