import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

import '../auth/auth_repository.dart';
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
import '../tmap_controller.dart';
import 'tmap_web_bridge.dart';
import 'tmap_web_loader.dart';

/// Flutter Web 전용 네이티브 TMAP DOM 렌더링 위젯
class TMapWebWidget extends StatefulWidget {
  final LatLng? center;
  final int zoom;
  final int minZoom;
  final int maxZoom;
  final double bearing;
  final double pitch;
  final TMapType mapType;
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
  final OnMarkerTap? onMarkerTap;
  final OnCameraIdle? onCameraIdle;

  const TMapWebWidget({
    super.key,
    this.center,
    this.zoom = 16,
    this.minZoom = 7,
    this.maxZoom = 19,
    this.bearing = 0,
    this.pitch = 0,
    this.mapType = TMapType.road,
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
    this.onMarkerTap,
    this.onCameraIdle,
  });

  @override
  State<TMapWebWidget> createState() => _TMapWebWidgetState();
}

class _TMapWebWidgetState extends State<TMapWebWidget> {
  static int _nextViewId = 0;
  late final String _viewId;
  late final String _containerId;
  late final String _viewType;
  late final TMapController _controller;
  bool _isMapInitialized = false;

  @override
  void initState() {
    super.initState();
    _nextViewId++;
    _viewId = 'web_view_$_nextViewId';
    _containerId = 'tmap_container_$_viewId';
    _viewType = 'tmap_web_view_$_viewId';
    _controller = TMapController.fromWeb(_viewId);

    // DOM 플랫폼 뷰 등록
    ui_web.platformViewRegistry.registerViewFactory(
      _viewType,
      (int viewId) {
        final element = web.document.createElement('div') as web.HTMLDivElement;
        element.id = _containerId;
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.overflow = 'hidden';
        return element;
      },
    );

    _initWebMap();
  }

  Future<void> _initWebMap() async {
    final appKey = AuthRepository.instance.appKey;
    debugPrint(
        '[TMapWebWidget] _initWebMap starting for viewId=$_viewId, appKey=$appKey');
    if (appKey.isEmpty || appKey == 'YOUR_TMAP_APP_KEY_HERE') {
      debugPrint(
          '[TMapWebWidget] AppKey is empty or placeholder, aborting init.');
      return;
    }

    try {
      await TMapWebLoader.loadScript(appKey);
      debugPrint(
          '[TMapWebLoader] loadScript completed, initializing map in DOM...');

      // 콜백 객체 생성
      final callbacks = JSObject();

      final onMapCreatedFn = (JSString _) {
        debugPrint('[TMapWebWidget] Map JS onMapCreated callback triggered!');
        if (!mounted) return;
        setState(() => _isMapInitialized = true);
        _syncAllOverlays();
        widget.onMapCreated?.call(_controller);
      }.toJS;
      callbacks.setProperty('onMapCreated'.toJS, onMapCreatedFn);

      final onMapTapFn = (JSNumber lat, JSNumber lng) {
        widget.onMapTap?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
      }.toJS;
      callbacks.setProperty('onMapTap'.toJS, onMapTapFn);

      final onMarkerTapFn =
          (JSString markerId, JSNumber lat, JSNumber lng, JSNumber zoom) {
        widget.onMarkerTap?.call(
          markerId.toDart,
          LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom.toDartInt,
        );
      }.toJS;
      callbacks.setProperty('onMarkerTap'.toJS, onMarkerTapFn);

      final onCameraIdleFn = (JSNumber lat, JSNumber lng, JSNumber zoom,
          JSNumber bearing, JSNumber pitch) {
        widget.onCameraIdle?.call(
          LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom.toDartInt,
          bearing.toDartDouble,
          pitch.toDartDouble,
        );
      }.toJS;
      callbacks.setProperty('onCameraIdle'.toJS, onCameraIdleFn);

      TMapWebBridge.initMap(
        viewId: _viewId,
        containerId: _containerId,
        center: widget.center,
        zoom: widget.zoom,
        minZoom: widget.minZoom,
        maxZoom: widget.maxZoom,
        bearing: widget.bearing,
        pitch: widget.pitch,
        mapType: widget.mapType,
        callbacks: callbacks,
      );
    } catch (e) {
      debugPrint('[TMapWebWidget] init error: $e');
    }
  }

  @override
  void didUpdateWidget(TMapWebWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_isMapInitialized) {
      _initWebMap();
      return;
    }

    if (widget.center != oldWidget.center && widget.center != null) {
      TMapWebBridge.setCenter(_viewId, widget.center!);
    }
    if (widget.zoom != oldWidget.zoom) {
      TMapWebBridge.setZoom(_viewId, widget.zoom);
    }
    if (widget.bearing != oldWidget.bearing) {
      TMapWebBridge.setBearing(_viewId, widget.bearing);
    }
    if (widget.pitch != oldWidget.pitch) {
      TMapWebBridge.setPitch(_viewId, widget.pitch);
    }
    if (widget.mapType != oldWidget.mapType) {
      TMapWebBridge.setMapType(_viewId, widget.mapType);
    }

    _syncAllOverlays();
  }

  void _syncAllOverlays() {
    // 1. 마커 동기화
    TMapWebBridge.clearAllMarkers(_viewId);
    final markers = widget.markers;
    if (markers != null && markers.isNotEmpty) {
      for (final m in markers) {
        TMapWebBridge.addMarker(_viewId, m);
      }
    }

    // 2. 클러스터러 동기화
    final clusterer = widget.clusterer;
    if (clusterer != null) {
      TMapWebBridge.addClusterer(_viewId, clusterer);
    } else {
      TMapWebBridge.clearClusterer(_viewId);
    }

    // 3. 인포윈도우 동기화
    TMapWebBridge.clearAllInfoWindows(_viewId);
    final infoWindows = widget.infoWindows;
    if (infoWindows != null && infoWindows.isNotEmpty) {
      for (final iw in infoWindows) {
        TMapWebBridge.addInfoWindow(_viewId, iw);
      }
    }

    // 4. 폴리라인 동기화
    TMapWebBridge.clearAllPolylines(_viewId);
    final polylines = widget.polylines;
    if (polylines != null && polylines.isNotEmpty) {
      for (final p in polylines) {
        TMapWebBridge.addPolyline(_viewId, p);
      }
    }

    // 5. 원형, 다각형, 사각형 동기화
    final circles = widget.circles;
    if (circles != null && circles.isNotEmpty) {
      for (final c in circles) {
        TMapWebBridge.addCircle(_viewId, c);
      }
    }
    final polygons = widget.polygons;
    if (polygons != null && polygons.isNotEmpty) {
      for (final pg in polygons) {
        TMapWebBridge.addPolygon(_viewId, pg);
      }
    }
    final rectangles = widget.rectangles;
    if (rectangles != null && rectangles.isNotEmpty) {
      for (final r in rectangles) {
        TMapWebBridge.addRectangle(_viewId, r);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewType);
  }
}
