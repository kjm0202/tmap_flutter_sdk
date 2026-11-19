import 'package:flutter/material.dart';

import '../callbacks/callbacks.dart';
import '../constants/map_type.dart';
import '../models/lat_lng.dart';
import '../overlays/circle.dart';
import '../overlays/clusterer.dart';
import '../overlays/custom_overlay.dart';
import '../overlays/info_window.dart';
import '../overlays/label.dart';
import '../overlays/marker.dart';
import '../overlays/polygon.dart';
import '../overlays/polyline.dart';
import '../overlays/rectangle.dart';

/// 모바일 플랫폼용 Web 위젯 스텁
class TMapWebWidget extends StatelessWidget {
  final LatLng? center;
  final int zoom;
  final int minZoom;
  final int maxZoom;
  final double bearing;
  final double pitch;
  final TMapType mapType;
  final bool naviControl;
  final bool scaleBar;
  final List<Marker>? markers;
  final Clusterer? clusterer;
  final List<InfoWindow>? infoWindows;
  final List<Label>? labels;
  final List<Polyline>? polylines;
  final List<Polygon>? polygons;
  final List<Circle>? circles;
  final List<Rectangle>? rectangles;
  final List<CustomOverlay>? customOverlays;
  final MapCreateCallback? onMapCreated;
  final OnMapTap? onMapTap;
  final OnMapDoubleTap? onMapDoubleTap;
  final OnMapLongTap? onMapLongTap;
  final OnDragChangeCallback? onDragChangeCallback;
  final OnZoomChangeCallback? onZoomChangeCallback;
  final OnCenterChangeCallback? onCenterChangeCallback;
  final OnBoundsChangeCallback? onBoundsChangeCallback;
  final OnBearingChangeCallback? onBearingChangeCallback;
  final OnPitchChangeCallback? onPitchChangeCallback;
  final OnCameraIdle? onCameraIdle;
  final OnMarkerTap? onMarkerTap;
  final OnMarkerDragChangeCallback? onMarkerDragChangeCallback;
  final OnMarkerClustererTap? onMarkerClustererTap;
  final OnInfoWindowTap? onInfoWindowTap;
  final OnCustomOverlayTap? onCustomOverlayTap;

  const TMapWebWidget({
    super.key,
    this.center,
    this.zoom = 16,
    this.minZoom = 0,
    this.maxZoom = 19,
    this.bearing = 0,
    this.pitch = 0,
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

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
