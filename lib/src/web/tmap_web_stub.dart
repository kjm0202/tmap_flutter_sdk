import 'package:flutter/material.dart';

import '../callbacks/callbacks.dart';
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

/// A non-web placeholder for the TMAP web map widget.
///
/// Renders an empty [SizedBox] and does not invoke map callbacks.
class TMapWebWidget extends StatelessWidget {
  /// Requested initial map center in WGS84 latitude/longitude, or null.
  final LatLng? center;

  /// Requested initial bounds, ignored by this non-rendering stub.
  final LatLngBounds? bounds;

  /// Requested map movement bounds, ignored by this non-rendering stub.
  final LatLngBounds? maxBounds;

  /// Requested initial zoom level; defaults to 16.
  final int zoom;

  /// Requested minimum zoom level; defaults to 0.
  final int minZoom;

  /// Requested maximum zoom level; defaults to 19.
  final int maxZoom;

  /// Requested camera bearing in degrees; defaults to 0.
  final double bearing;

  /// Requested camera pitch in degrees; defaults to 0.
  final double pitch;

  /// Requested minimum camera pitch in degrees, ignored by this stub.
  final double? minPitch;

  /// Requested maximum camera pitch in degrees, ignored by this stub.
  final double? maxPitch;

  /// Requested map style; defaults to [TMapType.road].
  final TMapType mapType;

  /// Requested navigation controls, disabled by default.
  final bool naviControl;

  /// Requested map scale bar, disabled by default.
  final bool scaleBar;

  /// Optional markers that a web map would render.
  final List<Marker>? markers;

  /// Optional marker clusterer configuration.
  final Clusterer? clusterer;

  /// Optional information windows that a web map would render.
  final List<InfoWindow>? infoWindows;

  /// Optional labels that a web map would render.
  final List<Label>? labels;

  /// Optional polylines that a web map would render.
  final List<Polyline>? polylines;

  /// Optional polygons that a web map would render.
  final List<Polygon>? polygons;

  /// Optional circles that a web map would render.
  final List<Circle>? circles;

  /// Optional rectangles that a web map would render.
  final List<Rectangle>? rectangles;

  /// Optional custom overlays that a web map would render.
  final List<CustomOverlay>? customOverlays;

  /// Callback reserved for map creation, receiving a map controller.
  final MapCreateCallback? onMapCreated;

  /// Callback reserved for a map tap at a WGS84 [LatLng].
  final OnMapTap? onMapTap;

  /// Callback reserved for a map double-tap at a WGS84 [LatLng].
  final OnMapDoubleTap? onMapDoubleTap;

  /// Callback reserved for a map long-press at a WGS84 [LatLng].
  final OnMapLongTap? onMapLongTap;

  /// Callback reserved for SDK touch-start events.
  final OnMapTouch? onTouchStart;

  /// Callback reserved for SDK touch-end events.
  final OnMapTouch? onTouchEnd;

  /// Callback reserved for map drag start, move, and end events.
  final OnDragChangeCallback? onDragChangeCallback;

  /// Callback reserved for map zoom start and end events.
  final OnZoomChangeCallback? onZoomChangeCallback;

  /// Callback reserved for map center and zoom changes.
  final OnCenterChangeCallback? onCenterChangeCallback;

  /// Callback reserved for changes to WGS84 map bounds.
  final OnBoundsChangeCallback? onBoundsChangeCallback;

  /// Callback reserved for bearing changes in degrees.
  final OnBearingChangeCallback? onBearingChangeCallback;

  /// Callback reserved for camera pitch changes in degrees.
  final OnPitchChangeCallback? onPitchChangeCallback;

  /// Callback reserved for camera idle events with camera state.
  final OnCameraIdle? onCameraIdle;

  /// Callback reserved for taps on a marker with its ID and position.
  final OnMarkerTap? onMarkerTap;

  /// Callback reserved for marker drag start, move, and end events.
  final OnMarkerDragChangeCallback? onMarkerDragChangeCallback;

  /// Callback reserved for cluster taps, including member marker IDs.
  final OnMarkerClustererTap? onMarkerClustererTap;

  /// Callback reserved for information window taps.
  final OnInfoWindowTap? onInfoWindowTap;

  /// Callback reserved for custom overlay taps.
  final OnCustomOverlayTap? onCustomOverlayTap;

  /// Creates a non-rendering placeholder with the requested map settings.
  const TMapWebWidget({
    super.key,
    this.center,
    this.bounds,
    this.maxBounds,
    this.zoom = 16,
    this.minZoom = 0,
    this.maxZoom = 19,
    this.bearing = 0,
    this.pitch = 0,
    this.minPitch,
    this.maxPitch,
    this.mapType = TMapType.road,
    this.naviControl = false,
    this.scaleBar = false,
    this.markers,
    this.clusterer,
    this.infoWindows,
    this.labels,
    this.polylines,
    this.polygons,
    this.circles,
    this.rectangles,
    this.customOverlays,
    this.onMapCreated,
    this.onMapTap,
    this.onMapDoubleTap,
    this.onMapLongTap,
    this.onTouchStart,
    this.onTouchEnd,
    this.onDragChangeCallback,
    this.onZoomChangeCallback,
    this.onCenterChangeCallback,
    this.onBoundsChangeCallback,
    this.onBearingChangeCallback,
    this.onPitchChangeCallback,
    this.onCameraIdle,
    this.onMarkerTap,
    this.onMarkerDragChangeCallback,
    this.onMarkerClustererTap,
    this.onInfoWindowTap,
    this.onCustomOverlayTap,
  });

  /// Returns an empty [SizedBox] without initializing a Tmapv3 map.
  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
