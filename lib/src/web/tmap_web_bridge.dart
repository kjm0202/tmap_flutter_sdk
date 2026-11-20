import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'package:web/web.dart' as web;

import '../auth/auth_repository.dart';
import '../bridge_assets.dart';
import '../constants/map_type.dart';
import '../models/lat_lng.dart';
import '../models/lat_lng_bounds.dart';
import '../overlays/circle.dart';
import '../overlays/clusterer.dart';
import '../overlays/custom_overlay.dart';
import '../overlays/ground_overlay.dart';
import '../overlays/info_window.dart';
import '../overlays/label.dart';
import '../overlays/marker.dart';
import '../overlays/polygon.dart';
import '../overlays/polyline.dart';
import '../overlays/rectangle.dart';
import '../utils/hex_color.dart';

@JS('eval')
external JSAny? _eval(JSString script);

/// TMAP Web Bridge - 브라우저 window 객체에 TMAP 헬퍼 스크립트를 관리하고 인스턴스를 제어
class TMapWebBridge {
  static bool _scriptsInjected = false;

  /// 웹 페이지에 공유 및 웹 지도 JS 브리지를 한 번만 삽입합니다.
  static Future<void> injectHelperScripts() async {
    if (_scriptsInjected) return;
    final scripts = await loadBridgeAssets(const ['shared.js', 'web.js']);
    if (_scriptsInjected) return;
    _eval('(function() {\n$scripts\n})();'.toJS);
    _scriptsInjected = true;
  }

  static void _call(String method, List<Object?> arguments) {
    (web.window as JSObject).callMethodVarArgs<JSAny?>(
      'tmap_$method'.toJS,
      arguments.map((value) => value.jsify()).toList(),
    );
  }

  /// [viewId]로 식별되는 웹 지도 인스턴스를 초기화합니다.
  ///
  /// 전달한 좌표 경계가 비어 있으면 `bounds` 또는 `maxBounds` 옵션을 생략합니다.
  /// [callbacks]에는 SDK 이벤트를 받는 JS 콜백을 전달합니다.
  static void initMap({
    required String viewId,
    required String containerId,
    LatLng? center,
    LatLngBounds? bounds,
    LatLngBounds? maxBounds,
    int? zoom,
    int? minZoom,
    int? maxZoom,
    double? bearing,
    double? pitch,
    double? minPitch,
    double? maxPitch,
    TMapType? mapType,
    bool? naviControl,
    bool? scaleBar,
    bool? hasOnMapLongTap,
    required JSObject callbacks,
  }) {
    final appKey = AuthRepository.instance.appKey;
    final options = {
      if (appKey.isNotEmpty) 'appKey': appKey,
      if (center != null) 'center': [center.latitude, center.longitude],
      if (bounds != null && !bounds.isEmpty) 'bounds': bounds.toJson(),
      if (maxBounds != null && !maxBounds.isEmpty)
        'maxBounds': maxBounds.toJson(),
      if (zoom != null) 'zoom': zoom,
      if (minZoom != null) 'minZoom': minZoom,
      if (maxZoom != null) 'maxZoom': maxZoom,
      if (bearing != null) 'bearing': bearing,
      if (pitch != null) 'pitch': pitch,
      if (minPitch != null) 'minPitch': minPitch,
      if (maxPitch != null) 'maxPitch': maxPitch,
      if (mapType != null) 'mapType': mapType.name.toUpperCase(),
      if (naviControl != null) 'naviControl': naviControl,
      if (scaleBar != null) 'scaleBar': scaleBar,
      if (hasOnMapLongTap != null) 'hasOnMapLongTap': hasOnMapLongTap,
    };

    (web.window as JSObject).callMethodVarArgs<JSAny?>(
      'tmap_init'.toJS,
      [viewId.toJS, containerId.toJS, options.jsify(), callbacks],
    );
  }

  /// [viewId]의 웹 지도 인스턴스 및 브리지 리소스를 해제합니다.
  static void dispose(String viewId) {
    if (_scriptsInjected) _call('dispose', [viewId]);
  }

  /// 지도 중심을 WGS84 위경도 [center]로 설정합니다.
  static void setCenter(String viewId, LatLng center) {
    _call('setCenter', [viewId, center.latitude, center.longitude]);
  }

  /// 지도의 카메라 줌 레벨을 설정합니다.
  static void setZoom(String viewId, int zoom) {
    _call('setZoom', [viewId, zoom]);
  }

  /// SDK의 지도 상태 조회 [method]를 호출하고 JSON 문자열을 반환합니다.
  ///
  /// 중심·경계·줌·회전·기울기·스크린 좌표 등의 조회를 [args]와 함께 전달합니다.
  /// JS에서 값을 반환하지 않으면 null이 됩니다.
  static String? readMapData(
      String viewId, String method, Map<String, dynamic> args) {
    return (web.window as JSObject).callMethodVarArgs<JSString?>(
      'tmap_readMapData'.toJS,
      [viewId.toJS, method.toJS, args.jsify()],
    )?.toDart;
  }

  /// SDK의 Bessel/KATEC 좌표 변환 [method]를 호출하고 JSON을 반환합니다.
  ///
  /// [args]는 입력 좌표이며 결과가 없으면 null을 반환합니다.
  static String? convertProjection(
      String viewId, String method, Map<String, dynamic> args) {
    return (web.window as JSObject).callMethodVarArgs<JSString?>(
      'tmap_convertProjection'.toJS,
      [viewId.toJS, method.toJS, args.jsify()],
    )?.toDart;
  }

  /// 지도의 최소·최대 허용 줌 레벨을 함께 갱신합니다.
  static void setZoomLimit(String viewId, int minZoom, int maxZoom) {
    _call('setZoomLimit', [viewId, minZoom, maxZoom]);
  }

  /// 지도를 한 단계 확대합니다.
  static void zoomIn(String viewId) {
    _call('zoomIn', [viewId]);
  }

  /// 지도를 한 단계 축소합니다.
  static void zoomOut(String viewId) {
    _call('zoomOut', [viewId]);
  }

  /// SDK가 지원하는 최대 화면 범위로 줌을 조정합니다.
  static void zoomToMaxExtent(String viewId) {
    _call('zoomToMaxExtent', [viewId]);
  }

  /// 컨테이너 크기가 바뀐 지도의 레이아웃을 갱신합니다.
  static void relayout(String viewId) {
    _call('relayout', [viewId]);
  }

  /// 줌 제한, 내비게이션 컨트롤, 스케일바 등의 런타임 옵션을 갱신합니다.
  static void updateMapOptions(String viewId, Map<String, dynamic> options) {
    _call('updateMapOptions', [viewId, options]);
  }

  /// WGS84 위경도 [target]으로 지도를 이동합니다.
  static void panTo(String viewId, LatLng target) {
    _call('panTo', [viewId, target.latitude, target.longitude]);
  }

  /// 지도 화면을 픽셀 오프셋 [x], [y]만큼 이동합니다.
  static void panBy(String viewId, int x, int y) {
    _call('panBy', [viewId, x, y]);
  }

  /// 지도 회전각을 도 단위로 설정합니다.
  static void setBearing(String viewId, double bearing) {
    _call('setBearing', [viewId, bearing]);
  }

  /// 지도 카메라 기울기를 도 단위로 설정합니다.
  static void setPitch(String viewId, double pitch) {
    _call('setPitch', [viewId, pitch]);
  }

  /// 지도 스타일 유형을 설정합니다.
  static void setMapType(String viewId, TMapType mapType) {
    _call('setMapType', [viewId, mapType.name.toUpperCase()]);
  }

  /// 지도의 화면 영역을 [bounds]에 맞춥니다.
  ///
  /// [padding]은 지도 화면 가장자리의 여백을 픽셀로 지정합니다.
  static void fitBounds(String viewId, LatLngBounds bounds, int? padding) {
    _call('fitBounds', [
      viewId,
      bounds.southWest.latitude,
      bounds.southWest.longitude,
      bounds.northEast.latitude,
      bounds.northEast.longitude,
      if (padding != null) padding
    ]);
  }

  /// 지정한 지도에 [marker]를 추가하거나 같은 ID의 마커를 대체합니다.
  static void addMarker(String viewId, Marker marker) {
    _call('addMarker', [viewId, marker.toJson()]);
  }

  /// 지도에서 [markerId]의 마커를 제거합니다.
  static void clearMarker(String viewId, String markerId) {
    _call('clearMarker', [viewId, markerId]);
  }

  /// 지도에 등록된 모든 마커를 제거합니다.
  static void clearAllMarkers(String viewId) {
    _call('clearAllMarkers', [viewId]);
  }

  /// 지도에 [clusterer]와 그 멤버 마커를 등록합니다.
  static void addClusterer(String viewId, Clusterer clusterer) {
    final data = {
      'maxZoom': clusterer.maxClusterZoom,
      'minClusterSize': clusterer.minClusterCount,
      'gridSize': clusterer.gridSize,
      'visible': clusterer.visible,
      'opacity': clusterer.opacity,
      if (clusterer.icons != null) 'icons': clusterer.icons,
      if (clusterer.zIndex != null) 'zIndex': clusterer.zIndex,
      'markers': clusterer.markers.map((m) => m.toJson()).toList(),
    };
    _call('addClusterer', [viewId, data]);
  }

  /// 지도에서 마커 클러스터러를 해제합니다.
  static void clearClusterer(String viewId) {
    _call('clearClusterer', [viewId]);
  }

  /// 현재 클러스터러의 마커들을 제거합니다.
  static void clearClusterMarkers(String viewId) {
    _call('clearClusterMarkers', [viewId]);
  }

  /// 지도에 정보 창을 추가하거나 같은 ID의 정보 창을 대체합니다.
  static void addInfoWindow(String viewId, InfoWindow iw) {
    final data = {
      'id': iw.infoWindowId,
      'lat': iw.position.latitude,
      'lng': iw.position.longitude,
      'content': iw.content,
      'type': iw.type,
      if (iw.border != null) 'border': iw.border,
      'anchor': iw.anchor,
      if (iw.offset != null) 'offsetX': iw.offset?.x,
      if (iw.offset != null) 'offsetY': iw.offset?.y,
      'visible': iw.visible,
    };
    _call('addInfoWindow', [viewId, data]);
  }

  /// [infoWindowId]의 정보 창을 제거합니다.
  static void clearInfoWindow(String viewId, String infoWindowId) {
    _call('clearInfoWindow', [viewId, infoWindowId]);
  }

  /// 등록된 모든 정보 창을 제거합니다.
  static void clearAllInfoWindows(String viewId) {
    _call('clearAllInfoWindows', [viewId]);
  }

  /// 지도에 텍스트 라벨을 추가하거나 같은 ID의 라벨을 대체합니다.
  static void addLabel(String viewId, Label label) {
    final data = {
      'id': label.labelId,
      'lat': label.position.latitude,
      'lng': label.position.longitude,
      'content': label.content,
      'fontSize': label.fontSize,
      'fontColor': label.fontColor.toHexColor(),
      if (label.minLevel != null) 'minLevel': label.minLevel,
      if (label.maxLevel != null) 'maxLevel': label.maxLevel,
    };
    _call('addLabel', [viewId, data]);
  }

  /// [labelId]의 라벨을 제거합니다.
  static void clearLabel(String viewId, String labelId) {
    _call('clearLabel', [viewId, labelId]);
  }

  /// 등록된 모든 라벨을 제거합니다.
  static void clearAllLabels(String viewId) {
    _call('clearAllLabels', [viewId]);
  }

  /// 지도에 사용자 정의 오버레이를 추가하거나 같은 ID의 항목을 대체합니다.
  static void addCustomOverlay(String viewId, CustomOverlay overlay) {
    final data = {
      'id': overlay.customOverlayId,
      'lat': overlay.position.latitude,
      'lng': overlay.position.longitude,
      'content': overlay.content,
      if (overlay.offset != null) 'offsetX': overlay.offset?.x,
      if (overlay.offset != null) 'offsetY': overlay.offset?.y,
      'zIndex': overlay.zIndex,
    };
    _call('addCustomOverlay', [viewId, data]);
  }

  /// [customOverlayId]의 사용자 정의 오버레이를 제거합니다.
  static void clearCustomOverlay(String viewId, String customOverlayId) {
    _call('clearCustomOverlay', [viewId, customOverlayId]);
  }

  /// 등록된 모든 사용자 정의 오버레이를 제거합니다.
  static void clearAllCustomOverlays(String viewId) {
    _call('clearAllCustomOverlays', [viewId]);
  }

  /// 지도에 폴리라인을 추가하거나 같은 ID의 항목을 대체합니다.
  static void addPolyline(String viewId, Polyline polyline) {
    final data = {
      'id': polyline.polylineId,
      'points': polyline.points
          .map((p) => {'lat': p.latitude, 'lng': p.longitude})
          .toList(),
      'strokeColor': polyline.strokeColor?.toHexColor() ?? '#0066FF',
      'strokeOpacity': polyline.strokeOpacity,
      'strokeWidth': polyline.strokeWidth,
      'direction': polyline.direction,
      'zIndex': polyline.zIndex,
    };
    _call('addPolyline', [viewId, data]);
  }

  /// [polylineId]의 폴리라인을 제거합니다.
  static void clearPolyline(String viewId, String polylineId) {
    _call('clearPolyline', [viewId, polylineId]);
  }

  /// 등록된 모든 폴리라인을 제거합니다.
  static void clearAllPolylines(String viewId) {
    _call('clearAllPolylines', [viewId]);
  }

  /// [polygonId]의 다각형을 제거합니다.
  static void clearPolygon(String viewId, String polygonId) {
    _call('clearPolygon', [viewId, polygonId]);
  }

  /// 등록된 모든 다각형을 제거합니다.
  static void clearAllPolygons(String viewId) {
    _call('clearAllPolygons', [viewId]);
  }

  /// [circleId]의 원 오버레이를 제거합니다.
  static void clearCircle(String viewId, String circleId) {
    _call('clearCircle', [viewId, circleId]);
  }

  /// 등록된 모든 원 오버레이를 제거합니다.
  static void clearAllCircles(String viewId) {
    _call('clearAllCircles', [viewId]);
  }

  /// [rectangleId]의 사각형을 제거합니다.
  static void clearRectangle(String viewId, String rectangleId) {
    _call('clearRectangle', [viewId, rectangleId]);
  }

  /// 등록된 모든 사각형을 제거합니다.
  static void clearAllRectangles(String viewId) {
    _call('clearAllRectangles', [viewId]);
  }

  /// 지도에 원 오버레이를 추가하거나 같은 ID의 항목을 대체합니다.
  static void addCircle(String viewId, Circle circle) {
    final data = {
      'id': circle.circleId,
      'lat': circle.center.latitude,
      'lng': circle.center.longitude,
      'radius': circle.radius,
      'fillColor': circle.fillColor?.toHexColor() ?? '#FF0000',
      'fillOpacity': circle.fillOpacity,
      'strokeColor': circle.strokeColor?.toHexColor() ?? '#FF0000',
      'strokeOpacity': circle.strokeOpacity,
      'strokeWidth': circle.strokeWidth,
      'zIndex': circle.zIndex,
    };
    _call('addCircle', [viewId, data]);
  }

  /// 지도에 다각형을 추가하거나 같은 ID의 항목을 대체합니다.
  static void addPolygon(String viewId, Polygon polygon) {
    final data = {
      'id': polygon.polygonId,
      'points': polygon.points
          .map((p) => {'lat': p.latitude, 'lng': p.longitude})
          .toList(),
      'fillColor': polygon.fillColor?.toHexColor() ?? '#0066FF',
      'fillOpacity': polygon.fillOpacity,
      'strokeColor': polygon.strokeColor?.toHexColor() ?? '#0066FF',
      'strokeOpacity': polygon.strokeOpacity,
      'strokeWidth': polygon.strokeWidth,
      'zIndex': polygon.zIndex,
    };
    _call('addPolygon', [viewId, data]);
  }

  /// 지도에 사각형을 추가하거나 같은 ID의 항목을 대체합니다.
  static void addRectangle(String viewId, Rectangle rect) {
    final data = {
      'id': rect.rectangleId,
      'swLat': rect.bounds.southWest.latitude,
      'swLng': rect.bounds.southWest.longitude,
      'neLat': rect.bounds.northEast.latitude,
      'neLng': rect.bounds.northEast.longitude,
      'fillColor': rect.fillColor?.toHexColor() ?? '#0066FF',
      'fillOpacity': rect.fillOpacity,
      'strokeColor': rect.strokeColor?.toHexColor() ?? '#0066FF',
      'strokeOpacity': rect.strokeOpacity,
      'strokeWidth': rect.strokeWidth,
      'zIndex': rect.zIndex,
    };
    _call('addRectangle', [viewId, data]);
  }

  /// 지도에 지면 이미지 오버레이를 추가하거나 같은 ID의 항목을 대체합니다.
  static void addGroundOverlay(String viewId, GroundOverlay overlay) {
    _call('addGroundOverlay', [viewId, overlay.toJson()]);
  }

  /// [id]의 지면 이미지 오버레이를 제거합니다.
  static void clearGroundOverlay(String viewId, String id) {
    _call('clearGroundOverlay', [viewId, id]);
  }

  /// 등록된 모든 지면 이미지 오버레이를 제거합니다.
  static void clearAllGroundOverlays(String viewId) {
    _call('clearAllGroundOverlays', [viewId]);
  }

  /// [type]과 [data]에 따라 지도 시각화 레이어를 생성하거나 대체합니다.
  static void addVisualization(
      String viewId, String type, Map<String, dynamic> data) {
    _call('addVisualization', [viewId, type, data]);
  }

  /// [type] 유형의 [id] 시각화 레이어를 제거합니다.
  static void removeVisualization(String viewId, String type, String id) {
    _call('removeVisualization', [viewId, type, id]);
  }

  /// [id] 다각형에 WGS84 위경도 [point]가 포함되는지 확인합니다.
  ///
  /// 해당 ID의 다각형이 없으면 false입니다.
  static bool polygonContains(String viewId, String id, LatLng point) {
    final result = (web.window as JSObject).callMethodVarArgs<JSBoolean?>(
      'tmap_polygonContains'.toJS,
      [viewId.toJS, id.toJS, point.latitude.toJS, point.longitude.toJS],
    );
    return result?.toDart ?? false;
  }

  /// [id] 다각형의 SDK 면적 결과를 JSON 문자열로 반환합니다.
  ///
  /// 해당 ID가 없으면 JSON `null` 문자열을 반환합니다.
  static String? polygonAreaJson(String viewId, String id) {
    final result = (web.window as JSObject).callMethodVarArgs<JSString?>(
      'tmap_polygonAreaJson'.toJS,
      [viewId.toJS, id.toJS],
    );
    return result?.toDart;
  }

  /// [mode]와 [options]로 지도 위 드로잉 세션을 시작합니다.
  static void startDrawing(
      String viewId, String mode, Map<String, dynamic> options) {
    _call('startDrawing', [viewId, mode, options]);
  }

  /// 현재 지도에서 생성된 드로잉 항목들을 지웁니다.
  static void clearDrawings(String viewId) {
    _call('clearDrawings', [viewId]);
  }

  /// 현재 지도에 등록된 모든 지원 오버레이를 정리합니다.
  static void clearAll(String viewId) {
    _call('clearAll', [viewId]);
  }

  /// 지도 실시간 교통 정보 레이어의 표시 여부를 설정합니다.
  static void toggleTraffic(String viewId, bool isVisible) {
    _call('toggleTraffic', [viewId, isVisible]);
  }
}
