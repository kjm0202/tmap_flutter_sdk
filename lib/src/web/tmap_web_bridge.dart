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

/// Controls TMAP web map instances through helpers on the browser window.
class TMapWebBridge {
  static bool _scriptsInjected = false;

  /// Injects the shared and web JavaScript bridge scripts once per page.
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

  /// Initializes the web map instance identified by [viewId].
  ///
  /// Omits empty [bounds] or [maxBounds] from the creation options.
  /// Passes [callbacks] to JavaScript to receive SDK events.
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

  /// Disposes of the web map instance and bridge resources for [viewId].
  static void dispose(String viewId) {
    if (_scriptsInjected) _call('dispose', [viewId]);
  }

  /// Sets the map center to WGS84 [center].
  static void setCenter(String viewId, LatLng center) {
    _call('setCenter', [viewId, center.latitude, center.longitude]);
  }

  /// Sets the camera zoom level to [zoom].
  static void setZoom(String viewId, int zoom) {
    _call('setZoom', [viewId, zoom]);
  }

  /// Calls the SDK map state query [method] and returns its JSON string.
  ///
  /// Queries include center, bounds, zoom, bearing, pitch, and screen
  /// coordinates. Passes [args] through to the SDK query.
  /// Returns null when JavaScript returns no result.
  static String? readMapData(
      String viewId, String method, Map<String, dynamic> args) {
    return (web.window as JSObject).callMethodVarArgs<JSString?>(
      'tmap_readMapData'.toJS,
      [viewId.toJS, method.toJS, args.jsify()],
    )?.toDart;
  }

  /// Calls the SDK's Bessel or KATEC projection conversion [method].
  ///
  /// Supplies input coordinates in [args] and returns JSON or null.
  static String? convertProjection(
      String viewId, String method, Map<String, dynamic> args) {
    return (web.window as JSObject).callMethodVarArgs<JSString?>(
      'tmap_convertProjection'.toJS,
      [viewId.toJS, method.toJS, args.jsify()],
    )?.toDart;
  }

  /// Updates the allowed map zoom range from [minZoom] to [maxZoom].
  static void setZoomLimit(String viewId, int minZoom, int maxZoom) {
    _call('setZoomLimit', [viewId, minZoom, maxZoom]);
  }

  /// Increases the map zoom by one level.
  static void zoomIn(String viewId) {
    _call('zoomIn', [viewId]);
  }

  /// Decreases the map zoom by one level.
  static void zoomOut(String viewId) {
    _call('zoomOut', [viewId]);
  }

  /// Zooms to the SDK's maximum map extent.
  ///
  /// Falls back to the minimum allowed zoom if that method is unavailable.
  static void zoomToMaxExtent(String viewId) {
    _call('zoomToMaxExtent', [viewId]);
  }

  /// Recalculates the map layout after its container size changes.
  static void relayout(String viewId) {
    _call('relayout', [viewId]);
  }

  /// Updates runtime [options], including zoom limits and map controls.
  static void updateMapOptions(String viewId, Map<String, dynamic> options) {
    _call('updateMapOptions', [viewId, options]);
  }

  /// Pans the map to WGS84 [target].
  static void panTo(String viewId, LatLng target) {
    _call('panTo', [viewId, target.latitude, target.longitude]);
  }

  /// Pans the map by [x] and [y] screen pixels.
  static void panBy(String viewId, int x, int y) {
    _call('panBy', [viewId, x, y]);
  }

  /// Sets the map bearing in degrees.
  static void setBearing(String viewId, double bearing) {
    _call('setBearing', [viewId, bearing]);
  }

  /// Sets the camera pitch in degrees.
  static void setPitch(String viewId, double pitch) {
    _call('setPitch', [viewId, pitch]);
  }

  /// Sets the map style to [mapType].
  static void setMapType(String viewId, TMapType mapType) {
    _call('setMapType', [viewId, mapType.name.toUpperCase()]);
  }

  /// Fits the map viewport to WGS84 [bounds].
  ///
  /// [padding] specifies the inset from the map edges in pixels.
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

  /// Adds [marker] to the map, replacing any marker with the same ID.
  static void addMarker(String viewId, Marker marker) {
    _call('addMarker', [viewId, marker.toJson()]);
  }

  /// Removes the map marker identified by [markerId].
  static void clearMarker(String viewId, String markerId) {
    _call('clearMarker', [viewId, markerId]);
  }

  /// Removes all markers registered on the map.
  static void clearAllMarkers(String viewId) {
    _call('clearAllMarkers', [viewId]);
  }

  /// Registers [clusterer] and its member markers on the map.
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

  /// Removes the marker clusterer from the map.
  static void clearClusterer(String viewId) {
    _call('clearClusterer', [viewId]);
  }

  /// Removes markers from the active clusterer.
  static void clearClusterMarkers(String viewId) {
    _call('clearClusterMarkers', [viewId]);
  }

  /// Adds [iw] to the map, replacing an information window with the same ID.
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

  /// Removes the information window identified by [infoWindowId].
  static void clearInfoWindow(String viewId, String infoWindowId) {
    _call('clearInfoWindow', [viewId, infoWindowId]);
  }

  /// Removes all registered information windows.
  static void clearAllInfoWindows(String viewId) {
    _call('clearAllInfoWindows', [viewId]);
  }

  /// Adds [label] to the map, replacing any label with the same ID.
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

  /// Removes the label identified by [labelId].
  static void clearLabel(String viewId, String labelId) {
    _call('clearLabel', [viewId, labelId]);
  }

  /// Removes all registered labels.
  static void clearAllLabels(String viewId) {
    _call('clearAllLabels', [viewId]);
  }

  /// Adds [overlay], replacing any custom overlay with the same ID.
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

  /// Removes the custom overlay identified by [customOverlayId].
  static void clearCustomOverlay(String viewId, String customOverlayId) {
    _call('clearCustomOverlay', [viewId, customOverlayId]);
  }

  /// Removes all registered custom overlays.
  static void clearAllCustomOverlays(String viewId) {
    _call('clearAllCustomOverlays', [viewId]);
  }

  /// Adds [polyline], replacing any polyline with the same ID.
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

  /// Removes the polyline identified by [polylineId].
  static void clearPolyline(String viewId, String polylineId) {
    _call('clearPolyline', [viewId, polylineId]);
  }

  /// Removes all registered polylines.
  static void clearAllPolylines(String viewId) {
    _call('clearAllPolylines', [viewId]);
  }

  /// Removes the polygon identified by [polygonId].
  static void clearPolygon(String viewId, String polygonId) {
    _call('clearPolygon', [viewId, polygonId]);
  }

  /// Removes all registered polygons.
  static void clearAllPolygons(String viewId) {
    _call('clearAllPolygons', [viewId]);
  }

  /// Removes the circle overlay identified by [circleId].
  static void clearCircle(String viewId, String circleId) {
    _call('clearCircle', [viewId, circleId]);
  }

  /// Removes all registered circle overlays.
  static void clearAllCircles(String viewId) {
    _call('clearAllCircles', [viewId]);
  }

  /// Removes the rectangle identified by [rectangleId].
  static void clearRectangle(String viewId, String rectangleId) {
    _call('clearRectangle', [viewId, rectangleId]);
  }

  /// Removes all registered rectangles.
  static void clearAllRectangles(String viewId) {
    _call('clearAllRectangles', [viewId]);
  }

  /// Adds [circle], replacing any circle with the same ID.
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

  /// Adds [polygon], replacing any polygon with the same ID.
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

  /// Adds [rect], replacing any rectangle with the same ID.
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

  /// Adds [overlay], replacing any ground overlay with the same ID.
  static void addGroundOverlay(String viewId, GroundOverlay overlay) {
    _call('addGroundOverlay', [viewId, overlay.toJson()]);
  }

  /// Removes the ground image overlay identified by [id].
  static void clearGroundOverlay(String viewId, String id) {
    _call('clearGroundOverlay', [viewId, id]);
  }

  /// Removes all registered ground image overlays.
  static void clearAllGroundOverlays(String viewId) {
    _call('clearAllGroundOverlays', [viewId]);
  }

  /// Creates or replaces a [type] visualization layer from [data].
  static void addVisualization(
      String viewId, String type, Map<String, dynamic> data) {
    _call('addVisualization', [viewId, type, data]);
  }

  /// Removes visualization [id] of [type].
  static void removeVisualization(String viewId, String type, String id) {
    _call('removeVisualization', [viewId, type, id]);
  }

  /// Tests whether polygon [id] contains WGS84 [point].
  ///
  /// Returns false if the polygon does not exist.
  static bool polygonContains(String viewId, String id, LatLng point) {
    final result = (web.window as JSObject).callMethodVarArgs<JSBoolean?>(
      'tmap_polygonContains'.toJS,
      [viewId.toJS, id.toJS, point.latitude.toJS, point.longitude.toJS],
    );
    return result?.toDart ?? false;
  }

  /// Returns the SDK-computed area of polygon [id] as a JSON string.
  ///
  /// Returns the JSON string "null" when the polygon does not exist.
  static String? polygonAreaJson(String viewId, String id) {
    final result = (web.window as JSObject).callMethodVarArgs<JSString?>(
      'tmap_polygonAreaJson'.toJS,
      [viewId.toJS, id.toJS],
    );
    return result?.toDart;
  }

  /// Starts a map drawing session using [mode] and [options].
  static void startDrawing(
      String viewId, String mode, Map<String, dynamic> options) {
    _call('startDrawing', [viewId, mode, options]);
  }

  /// Clears drawing items created on the current map.
  static void clearDrawings(String viewId) {
    _call('clearDrawings', [viewId]);
  }

  /// Removes all supported overlays registered on the current map.
  static void clearAll(String viewId) {
    _call('clearAll', [viewId]);
  }

  /// Sets the real-time map traffic layer visibility to [isVisible].
  static void toggleTraffic(String viewId, bool isVisible) {
    _call('toggleTraffic', [viewId, isVisible]);
  }
}
