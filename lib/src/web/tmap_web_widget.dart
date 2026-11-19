import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:ui_web' as ui_web;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

import '../auth/auth_repository.dart';
import '../callbacks/callbacks.dart';
import '../constants/drag_type.dart';
import '../constants/map_type.dart';
import '../constants/zoom_type.dart';
import '../models/lat_lng.dart';
import '../models/lat_lng_bounds.dart';
import '../models/overlay_interaction.dart';
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
import '../utils/overlay_snapshot.dart';
import 'tmap_web_bridge.dart';
import 'tmap_web_loader.dart';

/// Flutter Web 전용 네이티브 TMAP DOM 렌더링 위젯
class TMapWebWidget extends StatefulWidget {
  final LatLng? center;
  final LatLngBounds? bounds;
  final LatLngBounds? maxBounds;
  final int zoom;
  final int minZoom;
  final int maxZoom;
  final double bearing;
  final double pitch;
  final double? minPitch;
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
  final OnMapTouch? onTouchStart;
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
  State<TMapWebWidget> createState() => _TMapWebWidgetState();
}

class _TMapWebWidgetState extends State<TMapWebWidget> {
  static int _nextViewId = 0;
  late final String _viewId;
  late final String _containerId;
  late final String _viewType;
  late final TMapController _controller;
  final OverlaySnapshot _overlaySnapshot = OverlaySnapshot();
  bool _isInitializing = false;
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
    if (_isInitializing) return;
    final appKey = AuthRepository.instance.appKey;
    debugPrint('[TMapWebWidget] _initWebMap starting for viewId=$_viewId');
    if (appKey.isEmpty || appKey == 'YOUR_TMAP_APP_KEY_HERE') {
      debugPrint(
          '[TMapWebWidget] AppKey is empty or placeholder, aborting init.');
      return;
    }

    _isInitializing = true;
    try {
      await Future.wait([
        TMapWebLoader.loadScript(appKey),
        TMapWebBridge.injectHelperScripts(),
      ]);
      if (!mounted) return;
      debugPrint(
          '[TMapWebLoader] loadScript completed, initializing map in DOM...');

      // 콜백 객체 생성
      final callbacks = JSObject();
      callbacks.setProperty(
          'onInitError'.toJS,
          (() {
            _isInitializing = false;
          }).toJS);

      final onMapCreatedFn = (JSString _) {
        debugPrint('[TMapWebWidget] Map JS onMapCreated callback triggered!');
        _isInitializing = false;
        if (!mounted) return;
        setState(() => _isMapInitialized = true);
        _overlaySnapshot.clear();
        _syncAllOverlays();
        widget.onMapCreated?.call(_controller);
      }.toJS;
      callbacks.setProperty('onMapCreated'.toJS, onMapCreatedFn);

      final onMapTapFn = (JSNumber lat, JSNumber lng) {
        if (!mounted) return;
        widget.onMapTap?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
      }.toJS;
      callbacks.setProperty('onMapTap'.toJS, onMapTapFn);

      final onMapDoubleTapFn = (JSNumber lat, JSNumber lng) {
        if (!mounted) return;
        widget.onMapDoubleTap?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
      }.toJS;
      callbacks.setProperty('onMapDoubleTap'.toJS, onMapDoubleTapFn);

      final onMapLongTapFn = (JSNumber lat, JSNumber lng) {
        if (!mounted) return;
        widget.onMapLongTap?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
      }.toJS;
      callbacks.setProperty('onMapLongTap'.toJS, onMapLongTapFn);

      callbacks.setProperty('onTouchStart'.toJS,
          ((JSNumber lat, JSNumber lng) {
        if (mounted) {
          widget.onTouchStart?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
        }
      }).toJS);
      callbacks.setProperty('onTouchEnd'.toJS,
          ((JSNumber lat, JSNumber lng) {
        if (mounted) {
          widget.onTouchEnd?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
        }
      }).toJS);

      final onDragChangeFn =
          (JSNumber lat, JSNumber lng, JSNumber zoom, JSString? phase) {
        if (!mounted) return;
        final phaseStr = phase?.toDart;
        final dragType = phaseStr == 'start'
            ? DragType.start
            : (phaseStr == 'move' ? DragType.move : DragType.end);
        widget.onDragChangeCallback?.call(
          LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom.toDartInt,
          dragType,
        );
      }.toJS;
      callbacks.setProperty('onDragChange'.toJS, onDragChangeFn);

      final onCenterChangeFn = (JSNumber lat, JSNumber lng, JSNumber zoom) {
        if (!mounted) return;
        widget.onCenterChangeCallback?.call(
          LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom.toDartInt,
        );
      }.toJS;
      callbacks.setProperty('onCenterChange'.toJS, onCenterChangeFn);

      final onBoundsChangeFn =
          (JSNumber swLat, JSNumber swLng, JSNumber neLat, JSNumber neLng) {
        if (!mounted) return;
        widget.onBoundsChangeCallback?.call(
          LatLngBounds(
            southWest: LatLng(swLat.toDartDouble, swLng.toDartDouble),
            northEast: LatLng(neLat.toDartDouble, neLng.toDartDouble),
          ),
        );
      }.toJS;
      callbacks.setProperty('onBoundsChange'.toJS, onBoundsChangeFn);

      final onZoomChangeFn = (JSNumber zoom, JSString? phase) {
        if (!mounted) return;
        final phaseStr = phase?.toDart;
        final zoomType = phaseStr == 'start' ? ZoomType.start : ZoomType.end;
        widget.onZoomChangeCallback?.call(
          zoom.toDartInt,
          zoomType,
        );
      }.toJS;
      callbacks.setProperty('onZoomChange'.toJS, onZoomChangeFn);

      final onBearingChangeFn = (JSNumber value) {
        if (!mounted) return;
        widget.onBearingChangeCallback?.call(value.toDartDouble);
      }.toJS;
      callbacks.setProperty('onBearingChange'.toJS, onBearingChangeFn);

      final onPitchChangeFn = (JSNumber value) {
        if (!mounted) return;
        widget.onPitchChangeCallback?.call(value.toDartDouble);
      }.toJS;
      callbacks.setProperty('onPitchChange'.toJS, onPitchChangeFn);

      final onCameraIdleFn = (JSNumber lat, JSNumber lng, JSNumber zoom,
          JSNumber bearing, JSNumber pitch) {
        if (!mounted) return;
        widget.onCameraIdle?.call(
          LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom.toDartInt,
          bearing.toDartDouble,
          pitch.toDartDouble,
        );
      }.toJS;
      callbacks.setProperty('onCameraIdle'.toJS, onCameraIdleFn);

      final onMarkerTapFn =
          (JSString markerId, JSNumber lat, JSNumber lng, JSNumber zoom) {
        if (!mounted) return;
        _controller.dispatchMarkerInteraction(MarkerInteraction(
          markerId: markerId.toDart,
          type: MarkerInteractionType.click,
          position: LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom: zoom.toDartInt,
        ));
        widget.onMarkerTap?.call(
          markerId.toDart,
          LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom.toDartInt,
        );
      }.toJS;
      callbacks.setProperty('onMarkerTap'.toJS, onMarkerTapFn);

      final onMarkerDragFn =
          (JSString id, JSNumber lat, JSNumber lng, JSString? phase) {
        if (!mounted) return;
        final phaseStr = phase?.toDart;
        if (phaseStr == 'move' || phaseStr == 'end') {
          _controller.dispatchMarkerInteraction(MarkerInteraction(
            markerId: id.toDart,
            type: phaseStr == 'move'
                ? MarkerInteractionType.drag
                : MarkerInteractionType.dragend,
            position: LatLng(lat.toDartDouble, lng.toDartDouble),
            zoom: widget.zoom,
          ));
        }
        final dragType = phaseStr == 'start'
            ? DragType.start
            : (phaseStr == 'move' ? DragType.move : DragType.end);
        widget.onMarkerDragChangeCallback?.call(
          id.toDart,
          LatLng(lat.toDartDouble, lng.toDartDouble),
          dragType,
        );
      }.toJS;
      callbacks.setProperty('onMarkerDrag'.toJS, onMarkerDragFn);

      final onMarkerInteractionFn = (JSString id, JSNumber lat, JSNumber lng,
          JSNumber zoom, JSString type) {
        if (!mounted) return;
        _controller.dispatchMarkerInteraction(MarkerInteraction(
          markerId: id.toDart,
          type: MarkerInteractionType.values.byName(type.toDart),
          position: LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom: zoom.toDartInt,
        ));
      }.toJS;
      callbacks.setProperty('onMarkerInteraction'.toJS, onMarkerInteractionFn);

      final onMarkerClustererTapFn =
          (JSNumber lat, JSNumber lng, JSNumber zoom, JSAny? arrayOfStringIds) {
        if (!mounted) return;
        final List<String> markerIds = [];
        if (arrayOfStringIds != null) {
          if (arrayOfStringIds.isA<JSArray<JSAny?>>()) {
            final jsArray = arrayOfStringIds as JSArray<JSAny?>;
            for (int i = 0; i < jsArray.length; i++) {
              final item = jsArray[i];
              if (item != null) {
                if (item.isA<JSString>()) {
                  markerIds.add((item as JSString).toDart);
                } else {
                  markerIds.add(item.toString());
                }
              }
            }
          }
        }
        widget.onMarkerClustererTap?.call(
          LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom.toDartInt,
          markerIds,
        );
      }.toJS;
      callbacks.setProperty(
          'onMarkerClustererTap'.toJS, onMarkerClustererTapFn);

      final onClusterInteractionFn = (JSNumber lat, JSNumber lng, JSNumber zoom,
          JSAny? arrayOfIds, JSString type) {
        if (!mounted) return;
        final ids = <String>[];
        if (arrayOfIds != null && arrayOfIds.isA<JSArray<JSAny?>>()) {
          final array = arrayOfIds as JSArray<JSAny?>;
          for (var i = 0; i < array.length; i++) {
            final id = array[i];
            if (id != null && id.isA<JSString>()) {
              ids.add((id as JSString).toDart);
            }
          }
        }
        _controller.dispatchClusterInteraction(ClusterInteraction(
          type: ClusterInteractionType.values.byName(type.toDart),
          center: LatLng(lat.toDartDouble, lng.toDartDouble),
          zoom: zoom.toDartInt,
          markerIds: ids,
        ));
      }.toJS;
      callbacks.setProperty(
          'onClusterInteraction'.toJS, onClusterInteractionFn);

      final onInfoWindowTapFn = (JSString id, JSNumber lat, JSNumber lng) {
        if (!mounted) return;
        widget.onInfoWindowTap?.call(
          id.toDart,
          LatLng(lat.toDartDouble, lng.toDartDouble),
        );
      }.toJS;
      callbacks.setProperty('onInfoWindowTap'.toJS, onInfoWindowTapFn);

      final onCustomOverlayTapFn = (JSString id, JSNumber lat, JSNumber lng) {
        if (!mounted) return;
        widget.onCustomOverlayTap?.call(
          id.toDart,
          LatLng(lat.toDartDouble, lng.toDartDouble),
        );
      }.toJS;
      callbacks.setProperty('onCustomOverlayTap'.toJS, onCustomOverlayTapFn);

      final onDrawingCompleteFn = (JSString payload) {
        if (!mounted) return;
        _controller.handleDrawingComplete(payload.toDart);
      }.toJS;
      callbacks.setProperty('onDrawingComplete'.toJS, onDrawingCompleteFn);

      TMapWebBridge.initMap(
        viewId: _viewId,
        containerId: _containerId,
        center: widget.center,
        bounds: widget.bounds,
        maxBounds: widget.maxBounds,
        zoom: widget.zoom,
        minZoom: widget.minZoom,
        maxZoom: widget.maxZoom,
        bearing: widget.bearing,
        pitch: widget.pitch,
        minPitch: widget.minPitch,
        maxPitch: widget.maxPitch,
        mapType: widget.mapType,
        naviControl: widget.naviControl,
        scaleBar: widget.scaleBar,
        hasOnMapLongTap: widget.onMapLongTap != null,
        callbacks: callbacks,
      );
    } catch (e) {
      _isInitializing = false;
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
    if (widget.minZoom != oldWidget.minZoom ||
        widget.maxZoom != oldWidget.maxZoom ||
        widget.naviControl != oldWidget.naviControl ||
        widget.scaleBar != oldWidget.scaleBar ||
        (widget.onMapLongTap != null) != (oldWidget.onMapLongTap != null)) {
      TMapWebBridge.updateMapOptions(_viewId, {
        'minZoom': widget.minZoom,
        'maxZoom': widget.maxZoom,
        'naviControl': widget.naviControl,
        'scaleBar': widget.scaleBar,
        'longTap': widget.onMapLongTap != null,
      });
    }

    _syncAllOverlays();
  }

  void _syncAllOverlays() {
    if (!_isMapInitialized) return;
    _overlaySnapshot.sync<Marker>(
      'markers',
      widget.markers,
      idOf: (m) => m.markerId,
      jsonOf: (m) => m.toJson(),
      add: (m) => TMapWebBridge.addMarker(_viewId, m),
      remove: (id) => TMapWebBridge.clearMarker(_viewId, id),
    );
    _overlaySnapshot.sync<InfoWindow>(
      'infoWindows',
      widget.infoWindows,
      idOf: (iw) => iw.infoWindowId,
      jsonOf: (iw) => iw.toJson(),
      add: (iw) => TMapWebBridge.addInfoWindow(_viewId, iw),
      remove: (id) => TMapWebBridge.clearInfoWindow(_viewId, id),
    );
    _overlaySnapshot.sync<Label>(
      'labels',
      widget.labels,
      idOf: (l) => l.labelId,
      jsonOf: (l) => l.toJson(),
      add: (l) => TMapWebBridge.addLabel(_viewId, l),
      remove: (id) => TMapWebBridge.clearLabel(_viewId, id),
    );
    _overlaySnapshot.sync<Polyline>(
      'polylines',
      widget.polylines,
      idOf: (p) => p.polylineId,
      jsonOf: (p) => p.toJson(),
      add: (p) => TMapWebBridge.addPolyline(_viewId, p),
      remove: (id) => TMapWebBridge.clearPolyline(_viewId, id),
    );
    _overlaySnapshot.sync<Polygon>(
      'polygons',
      widget.polygons,
      idOf: (p) => p.polygonId,
      jsonOf: (p) => p.toJson(),
      add: (p) => TMapWebBridge.addPolygon(_viewId, p),
      remove: (id) => TMapWebBridge.clearPolygon(_viewId, id),
    );
    _overlaySnapshot.sync<Circle>(
      'circles',
      widget.circles,
      idOf: (c) => c.circleId,
      jsonOf: (c) => c.toJson(),
      add: (c) => TMapWebBridge.addCircle(_viewId, c),
      remove: (id) => TMapWebBridge.clearCircle(_viewId, id),
    );
    _overlaySnapshot.sync<Rectangle>(
      'rectangles',
      widget.rectangles,
      idOf: (r) => r.rectangleId,
      jsonOf: (r) => r.toJson(),
      add: (r) => TMapWebBridge.addRectangle(_viewId, r),
      remove: (id) => TMapWebBridge.clearRectangle(_viewId, id),
    );
    _overlaySnapshot.sync<CustomOverlay>(
      'customOverlays',
      widget.customOverlays,
      idOf: (co) => co.customOverlayId,
      jsonOf: (co) => co.toJson(),
      add: (co) => TMapWebBridge.addCustomOverlay(_viewId, co),
      remove: (id) => TMapWebBridge.clearCustomOverlay(_viewId, id),
    );
    _overlaySnapshot.sync<Clusterer>(
      'clusterer',
      widget.clusterer == null ? const [] : [widget.clusterer!],
      idOf: (_) => 'clusterer',
      jsonOf: (c) => c.toJson(),
      add: (c) => TMapWebBridge.addClusterer(_viewId, c),
      remove: (_) => TMapWebBridge.clearClusterer(_viewId),
    );
  }

  @override
  void dispose() {
    _isMapInitialized = false;
    TMapWebBridge.dispose(_viewId);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // The HTML map receives DOM input independently of Flutter's gesture
    // arena. Claim the same pointer stream in Flutter so a surrounding
    // Scrollable does not move at the same time as the map.
    return RawGestureDetector(
      behavior: HitTestBehavior.opaque,
      gestures: <Type, GestureRecognizerFactory>{
        EagerGestureRecognizer:
            GestureRecognizerFactoryWithHandlers<EagerGestureRecognizer>(
          () => EagerGestureRecognizer(),
          (_) {},
        ),
      },
      child: HtmlElementView(viewType: _viewType),
    );
  }
}
