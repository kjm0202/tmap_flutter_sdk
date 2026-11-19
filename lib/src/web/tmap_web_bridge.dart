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

  /// 지도 초기화 호출
  static void initMap({
    required String viewId,
    required String containerId,
    LatLng? center,
    int? zoom,
    int? minZoom,
    int? maxZoom,
    double? bearing,
    double? pitch,
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
      if (zoom != null) 'zoom': zoom,
      if (minZoom != null) 'minZoom': minZoom,
      if (maxZoom != null) 'maxZoom': maxZoom,
      if (bearing != null) 'bearing': bearing,
      if (pitch != null) 'pitch': pitch,
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

  static void dispose(String viewId) {
    if (_scriptsInjected) _call('dispose', [viewId]);
  }

  static void setCenter(String viewId, LatLng center) {
    _call('setCenter', [viewId, center.latitude, center.longitude]);
  }

  static void setZoom(String viewId, int zoom) {
    _call('setZoom', [viewId, zoom]);
  }

  static void zoomIn(String viewId) {
    _call('zoomIn', [viewId]);
  }

  static void zoomOut(String viewId) {
    _call('zoomOut', [viewId]);
  }

  static void zoomToMaxExtent(String viewId) {
    _call('zoomToMaxExtent', [viewId]);
  }

  static void relayout(String viewId) {
    _call('relayout', [viewId]);
  }

  static void updateMapOptions(String viewId, Map<String, dynamic> options) {
    _call('updateMapOptions', [viewId, options]);
  }

  static void panTo(String viewId, LatLng target) {
    _call('panTo', [viewId, target.latitude, target.longitude]);
  }

  static void panBy(String viewId, int x, int y) {
    _call('panBy', [viewId, x, y]);
  }

  static void setBearing(String viewId, double bearing) {
    _call('setBearing', [viewId, bearing]);
  }

  static void setPitch(String viewId, double pitch) {
    _call('setPitch', [viewId, pitch]);
  }

  static void setMapType(String viewId, TMapType mapType) {
    _call('setMapType', [viewId, mapType.name.toUpperCase()]);
  }

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

  static void addMarker(String viewId, Marker marker) {
    _call('addMarker', [viewId, marker.toJson()]);
  }

  static void clearMarker(String viewId, String markerId) {
    _call('clearMarker', [viewId, markerId]);
  }

  static void clearAllMarkers(String viewId) {
    _call('clearAllMarkers', [viewId]);
  }

  static void addClusterer(String viewId, Clusterer clusterer) {
    final data = {
      'maxZoom': clusterer.maxClusterZoom,
      'minClusterSize': clusterer.minClusterCount,
      'gridSize': clusterer.gridSize,
      'markers': clusterer.markers
          .map((m) => {
                'id': m.markerId,
                'lat': m.position.latitude,
                'lng': m.position.longitude,
                if (m.title != null) 'title': m.title,
              })
          .toList(),
    };
    _call('addClusterer', [viewId, data]);
  }

  static void clearClusterer(String viewId) {
    _call('clearClusterer', [viewId]);
  }

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

  static void clearInfoWindow(String viewId, String infoWindowId) {
    _call('clearInfoWindow', [viewId, infoWindowId]);
  }

  static void clearAllInfoWindows(String viewId) {
    _call('clearAllInfoWindows', [viewId]);
  }

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

  static void clearLabel(String viewId, String labelId) {
    _call('clearLabel', [viewId, labelId]);
  }

  static void clearAllLabels(String viewId) {
    _call('clearAllLabels', [viewId]);
  }

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

  static void clearCustomOverlay(String viewId, String customOverlayId) {
    _call('clearCustomOverlay', [viewId, customOverlayId]);
  }

  static void clearAllCustomOverlays(String viewId) {
    _call('clearAllCustomOverlays', [viewId]);
  }

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

  static void clearPolyline(String viewId, String polylineId) {
    _call('clearPolyline', [viewId, polylineId]);
  }

  static void clearAllPolylines(String viewId) {
    _call('clearAllPolylines', [viewId]);
  }

  static void clearPolygon(String viewId, String polygonId) {
    _call('clearPolygon', [viewId, polygonId]);
  }

  static void clearAllPolygons(String viewId) {
    _call('clearAllPolygons', [viewId]);
  }

  static void clearCircle(String viewId, String circleId) {
    _call('clearCircle', [viewId, circleId]);
  }

  static void clearAllCircles(String viewId) {
    _call('clearAllCircles', [viewId]);
  }

  static void clearRectangle(String viewId, String rectangleId) {
    _call('clearRectangle', [viewId, rectangleId]);
  }

  static void clearAllRectangles(String viewId) {
    _call('clearAllRectangles', [viewId]);
  }

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

  static void clearAll(String viewId) {
    _call('clearAll', [viewId]);
  }

  static void toggleTraffic(String viewId, bool isVisible) {
    _call('toggleTraffic', [viewId, isVisible]);
  }
}
