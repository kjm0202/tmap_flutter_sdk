import '../constants/drag_type.dart';
import '../constants/zoom_type.dart';
import '../models/lat_lng.dart';
import '../models/lat_lng_bounds.dart';
import '../tmap_controller.dart';

/// Callback invoked after map initialization completes.
typedef MapCreateCallback = void Function(TMapController controller);

/// Callback for a single tap on the map.
typedef OnMapTap = void Function(LatLng latLng);

/// Callback for a double tap on the map.
typedef OnMapDoubleTap = void Function(LatLng latLng);

/// Callback for a long tap (context-menu event) on the map.
typedef OnMapLongTap = void Function(LatLng latLng);

/// Callback for touch-start or touch-end events on the map surface.
typedef OnMapTouch = void Function(LatLng latLng);

/// Callback for a marker tap, with its ID, position, and zoom level.
typedef OnMarkerTap = void Function(String markerId, LatLng latLng, int zoom);

/// Callback for a cluster tap, with its center, zoom, and marker IDs.
typedef OnMarkerClustererTap = void Function(
  LatLng center,
  int zoom,
  List<String> markerIds,
);

/// Callback for a tap on an info window.
typedef OnInfoWindowTap = void Function(String infoWindowId, LatLng latLng);

/// Callback for a tap on a custom overlay.
typedef OnCustomOverlayTap = void Function(
    String customOverlayId, LatLng latLng);

/// Callback for marker drag events, including the [DragType] phase.
typedef OnMarkerDragChangeCallback = void Function(
  String markerId,
  LatLng latLng,
  DragType dragType,
);

/// Callback for map drag events, including zoom and [DragType].
typedef OnDragChangeCallback = void Function(
  LatLng latLng,
  int zoom,
  DragType dragType,
);

/// Callback fired when the camera becomes idle after movement.
typedef OnCameraIdle = void Function(
  LatLng center,
  int zoom,
  double bearing,
  double pitch,
);

/// Callback for map center changes, with the new center and zoom.
typedef OnCenterChangeCallback = void Function(LatLng center, int zoom);

/// Callback for map zoom changes with their [ZoomType] phase.
///
/// SDK `ZoomStart` reports [ZoomType.start]. `ZoomEnd` and a standalone
/// `Zoom` (for example from a programmatic zoom) report [ZoomType.end].
/// `Zoom` events fired during a gesture are not reported.
typedef OnZoomChangeCallback = void Function(int zoom, ZoomType zoomType);

/// Callback for map bearing changes.
typedef OnBearingChangeCallback = void Function(double bearing);

/// Callback for map pitch changes.
typedef OnPitchChangeCallback = void Function(double pitch);

/// Callback for changes to the visible map bounds.
typedef OnBoundsChangeCallback = void Function(LatLngBounds bounds);
