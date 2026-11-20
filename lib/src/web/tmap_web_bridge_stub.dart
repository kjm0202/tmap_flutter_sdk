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

/// A non-web TMapWebBridge stub with inert map operations.
///
/// Queries return null or false.
class TMapWebBridge {
  /// Ignores a request to set the WGS84 [center] of a map.
  static void setCenter(String viewId, LatLng center) {}

  /// Ignores a request to set the map zoom level to [zoom].
  static void setZoom(String viewId, int zoom) {}

  /// Returns null for every map state query named [method].
  ///
  /// The supplied [args] are not passed to a JavaScript SDK.
  static String? readMapData(
          String viewId, String method, Map<String, dynamic> args) =>
      null;

  /// Returns null for every projection conversion request.
  ///
  /// Neither [method] nor [args] are evaluated on non-web platforms.
  static String? convertProjection(
          String viewId, String method, Map<String, dynamic> args) =>
      null;

  /// Ignores the requested zoom range from [minZoom] to [maxZoom].
  static void setZoomLimit(String viewId, int minZoom, int maxZoom) {}

  /// Ignores a request to increase the map zoom by one level.
  static void zoomIn(String viewId) {}

  /// Ignores a request to decrease the map zoom by one level.
  static void zoomOut(String viewId) {}

  /// Ignores a request to show the maximum map extent.
  static void zoomToMaxExtent(String viewId) {}

  /// Ignores a request to recalculate the map layout.
  static void relayout(String viewId) {}

  /// Ignores a request to apply runtime map [options].
  static void updateMapOptions(String viewId, Map<String, dynamic> options) {}

  /// Ignores a request to pan to the WGS84 [target] coordinate.
  static void panTo(String viewId, LatLng target) {}

  /// Ignores a request to pan by [x] and [y] screen pixels.
  static void panBy(String viewId, int x, int y) {}

  /// Ignores a request to set the map [bearing] in degrees.
  static void setBearing(String viewId, double bearing) {}

  /// Ignores a request to set the map [pitch] in degrees.
  static void setPitch(String viewId, double pitch) {}

  /// Ignores a request to select the [mapType] map style.
  static void setMapType(String viewId, TMapType mapType) {}

  /// Ignores a request to fit WGS84 [bounds] with pixel [padding].
  static void fitBounds(String viewId, LatLngBounds bounds, int? padding) {}

  /// Ignores a request to add the [marker].
  static void addMarker(String viewId, Marker marker) {}

  /// Ignores a request to remove the marker with [markerId].
  static void clearMarker(String viewId, String markerId) {}

  /// Ignores a request to remove every marker.
  static void clearAllMarkers(String viewId) {}

  /// Ignores a request to register the [clusterer].
  static void addClusterer(String viewId, Clusterer clusterer) {}

  /// Ignores a request to remove the active marker clusterer.
  static void clearClusterer(String viewId) {}

  /// Ignores a request to clear markers in the active clusterer.
  static void clearClusterMarkers(String viewId) {}

  /// Ignores a request to add the [iw] information window.
  static void addInfoWindow(String viewId, InfoWindow iw) {}

  /// Ignores a request to remove [infoWindowId].
  static void clearInfoWindow(String viewId, String infoWindowId) {}

  /// Ignores a request to remove every information window.
  static void clearAllInfoWindows(String viewId) {}

  /// Ignores a request to add the [label].
  static void addLabel(String viewId, Label label) {}

  /// Ignores a request to remove the label with [labelId].
  static void clearLabel(String viewId, String labelId) {}

  /// Ignores a request to remove every label.
  static void clearAllLabels(String viewId) {}

  /// Ignores a request to add a custom [overlay].
  static void addCustomOverlay(String viewId, CustomOverlay overlay) {}

  /// Ignores a request to remove [customOverlayId].
  static void clearCustomOverlay(String viewId, String customOverlayId) {}

  /// Ignores a request to remove every custom overlay.
  static void clearAllCustomOverlays(String viewId) {}

  /// Ignores a request to add the [polyline].
  static void addPolyline(String viewId, Polyline polyline) {}

  /// Ignores a request to remove the polyline with [polylineId].
  static void clearPolyline(String viewId, String polylineId) {}

  /// Ignores a request to remove every polyline.
  static void clearAllPolylines(String viewId) {}

  /// Ignores a request to remove the polygon with [polygonId].
  static void clearPolygon(String viewId, String polygonId) {}

  /// Ignores a request to remove every polygon.
  static void clearAllPolygons(String viewId) {}

  /// Ignores a request to remove the circle with [circleId].
  static void clearCircle(String viewId, String circleId) {}

  /// Ignores a request to remove every circle.
  static void clearAllCircles(String viewId) {}

  /// Ignores a request to remove the rectangle with [rectangleId].
  static void clearRectangle(String viewId, String rectangleId) {}

  /// Ignores a request to remove every rectangle.
  static void clearAllRectangles(String viewId) {}

  /// Ignores a request to add the [circle].
  static void addCircle(String viewId, Circle circle) {}

  /// Ignores a request to add the [polygon].
  static void addPolygon(String viewId, Polygon polygon) {}

  /// Ignores a request to add the [rect] rectangle.
  static void addRectangle(String viewId, Rectangle rect) {}

  /// Ignores a request to add a ground [overlay].
  static void addGroundOverlay(String viewId, GroundOverlay overlay) {}

  /// Ignores a request to remove the ground overlay with [id].
  static void clearGroundOverlay(String viewId, String id) {}

  /// Ignores a request to remove every ground overlay.
  static void clearAllGroundOverlays(String viewId) {}

  /// Ignores a request to add a [type] visualization from [data].
  static void addVisualization(
      String viewId, String type, Map<String, dynamic> data) {}

  /// Ignores a request to remove the [type] visualization with [id].
  static void removeVisualization(String viewId, String type, String id) {}

  /// Returns false without testing whether [point] lies in polygon [id].
  static bool polygonContains(String viewId, String id, LatLng point) => false;

  /// Returns null without calculating the area of polygon [id].
  static String? polygonAreaJson(String viewId, String id) => null;

  /// Ignores a request to start [mode] drawing with [options].
  static void startDrawing(
      String viewId, String mode, Map<String, dynamic> options) {}

  /// Ignores a request to clear all drawn shapes.
  static void clearDrawings(String viewId) {}

  /// Ignores a request to remove all map overlays.
  static void clearAll(String viewId) {}

  /// Ignores a request to set traffic visibility to [isVisible].
  static void toggleTraffic(String viewId, bool isVisible) {}
}
