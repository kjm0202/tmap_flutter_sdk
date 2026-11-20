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

/// 모바일 플랫폼용 Web 위젯 스텁
class TMapWebWidget extends StatelessWidget {
  final LatLng? center;

  /// 초기 영역이며 웹에서 변경 시 새 영역을 표시합니다. 빈 영역은 무시합니다.
  final LatLngBounds? bounds;

  /// SDK 지도 생성 시에만 적용할 이동 제한 영역입니다. 빈 영역은 무시합니다.
  final LatLngBounds? maxBounds;
  final int zoom;
  final int minZoom;
  final int maxZoom;
  final double bearing;
  final double pitch;

  /// 지도 생성 시에만 설정 가능한 최소 기울기(도)입니다.
  final double? minPitch;

  /// 지도 생성 시에만 설정 가능한 최대 기울기(도)입니다.
  final double? maxPitch;
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

  /// 터치 시작 시 호출되는 SDK 이벤트 콜백입니다.
  final OnMapTouch? onTouchStart;

  /// 터치 종료 시 호출되는 SDK 이벤트 콜백입니다.
  final OnMapTouch? onTouchEnd;
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

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
