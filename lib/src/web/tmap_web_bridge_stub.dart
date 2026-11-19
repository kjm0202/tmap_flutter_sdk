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

/// 모바일 플랫폼용 TMapWebBridge 스텁
class TMapWebBridge {
  static void setCenter(String viewId, LatLng center) {}
  static void setZoom(String viewId, int zoom) {}
  static void zoomIn(String viewId) {}
  static void zoomOut(String viewId) {}
  static void zoomToMaxExtent(String viewId) {}
  static void relayout(String viewId) {}
  static void updateMapOptions(String viewId, Map<String, dynamic> options) {}
  static void panTo(String viewId, LatLng target) {}
  static void panBy(String viewId, int x, int y) {}
  static void setBearing(String viewId, double bearing) {}
  static void setPitch(String viewId, double pitch) {}
  static void setMapType(String viewId, TMapType mapType) {}
  static void fitBounds(String viewId, LatLngBounds bounds, int? padding) {}
  static void addMarker(String viewId, Marker marker) {}
  static void clearMarker(String viewId, String markerId) {}
  static void clearAllMarkers(String viewId) {}
  static void addClusterer(String viewId, Clusterer clusterer) {}
  static void clearClusterer(String viewId) {}
  static void addInfoWindow(String viewId, InfoWindow iw) {}
  static void clearInfoWindow(String viewId, String infoWindowId) {}
  static void clearAllInfoWindows(String viewId) {}
  static void addLabel(String viewId, Label label) {}
  static void clearLabel(String viewId, String labelId) {}
  static void clearAllLabels(String viewId) {}
  static void addCustomOverlay(String viewId, CustomOverlay overlay) {}
  static void clearCustomOverlay(String viewId, String customOverlayId) {}
  static void clearAllCustomOverlays(String viewId) {}
  static void addPolyline(String viewId, Polyline polyline) {}
  static void clearPolyline(String viewId, String polylineId) {}
  static void clearAllPolylines(String viewId) {}
  static void clearPolygon(String viewId, String polygonId) {}
  static void clearAllPolygons(String viewId) {}
  static void clearCircle(String viewId, String circleId) {}
  static void clearAllCircles(String viewId) {}
  static void clearRectangle(String viewId, String rectangleId) {}
  static void clearAllRectangles(String viewId) {}
  static void addCircle(String viewId, Circle circle) {}
  static void addPolygon(String viewId, Polygon polygon) {}
  static void addRectangle(String viewId, Rectangle rect) {}
  static void addGroundOverlay(String viewId, GroundOverlay overlay) {}
  static void clearGroundOverlay(String viewId, String id) {}
  static void clearAllGroundOverlays(String viewId) {}
  static bool polygonContains(String viewId, String id, LatLng point) => false;
  static String? polygonAreaJson(String viewId, String id) => null;
  static void startDrawing(
      String viewId, String mode, Map<String, dynamic> options) {}
  static void clearDrawings(String viewId) {}
  static void clearAll(String viewId) {}
  static void toggleTraffic(String viewId, bool isVisible) {}
}
