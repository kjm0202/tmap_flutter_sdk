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
import '../utils/bounds_on_ready.dart';
import '../utils/overlay_snapshot.dart';
import '../utils/zoom_phase.dart';
import 'tmap_web_bridge.dart';
import 'tmap_web_loader.dart';

/// A Flutter Web widget that renders a TMAP map in a native DOM element.
class TMapWebWidget extends StatefulWidget {
  /// Map center in WGS84 latitude/longitude, or null to omit the option.
  ///
  /// Non-null changes after the map is initialized call
  /// [TMapWebBridge.setCenter]. Changes made while the SDK script loads are
  /// included in the options passed to [TMapWebBridge.initMap]; changes made
  /// after that call and before the map reports creation are not applied.
  final LatLng? center;

  /// Geographic bounds displayed by the map.
  ///
  /// Changes after initialization call [TMapWebBridge.fitBounds].
  /// Null or [LatLngBounds.empty] values are ignored at creation and on update.
  final LatLngBounds? bounds;

  /// Map movement restriction bounds, applied only during SDK map creation.
  ///
  /// Null and empty bounds are omitted from the creation options.
  final LatLngBounds? maxBounds;

  /// Camera zoom level, 16 by default; later changes update the web map.
  final int zoom;

  /// Minimum zoom level, 0 by default; later changes update the zoom limits.
  final int minZoom;

  /// Maximum zoom level, 19 by default; later changes update the zoom limits.
  final int maxZoom;

  /// Camera bearing in degrees, 0 by default; later changes update the map.
  final double bearing;

  /// Camera pitch in degrees, 0 by default; later changes update the map.
  final double pitch;

  /// Minimum camera pitch in degrees, applied only during map creation.
  final double? minPitch;

  /// Maximum camera pitch in degrees, applied only during map creation.
  final double? maxPitch;

  /// Map style, [TMapType.road] by default; later changes update the map.
  final TMapType mapType;

  /// Navigation control visibility, false by default; later changes apply.
  final bool naviControl;

  /// Scale bar visibility, false by default; later changes apply.
  ///
  /// "Later changes" for [zoom], [minZoom], [maxZoom], [bearing], [pitch],
  /// [mapType], [naviControl] and this field mean changes made after the map
  /// is initialized. Changes made while the SDK script loads are included in
  /// the options passed to [TMapWebBridge.initMap]; changes made after that
  /// call and before the map reports creation are not applied.
  final bool scaleBar;

  /// Map markers, or null for none, synchronized by marker ID and JSON.
  final List<Marker>? markers;

  /// Marker clusterer, or null to remove the existing clusterer.
  final Clusterer? clusterer;

  /// Information windows, or null for none, synchronized by window ID.
  final List<InfoWindow>? infoWindows;

  /// Map labels, or null for none, synchronized by label ID.
  final List<Label>? labels;

  /// Map polylines, or null for none, synchronized by polyline ID.
  final List<Polyline>? polylines;

  /// Map polygons, or null for none, synchronized by polygon ID.
  final List<Polygon>? polygons;

  /// Map circles, or null for none, synchronized by circle ID.
  final List<Circle>? circles;

  /// Map rectangles, or null for none, synchronized by rectangle ID.
  final List<Rectangle>? rectangles;

  /// Custom overlays, or null for none, synchronized by overlay ID.
  final List<CustomOverlay>? customOverlays;

  /// Callback receiving the [TMapController] after map initialization.
  ///
  /// Registered overlays are synchronized before this callback is invoked.
  final MapCreateCallback? onMapCreated;

  /// Callback for map taps at WGS84 latitude/longitude coordinates.
  final OnMapTap? onMapTap;

  /// Callback for map double-taps at WGS84 coordinates.
  final OnMapDoubleTap? onMapDoubleTap;

  /// Callback for map long-press events at WGS84 coordinates.
  final OnMapLongTap? onMapLongTap;

  /// Callback for SDK touch-start events at WGS84 coordinates.
  final OnMapTouch? onTouchStart;

  /// Callback for SDK touch-end events at WGS84 coordinates.
  final OnMapTouch? onTouchEnd;

  /// Callback for map drag start, move, and end events.
  ///
  /// Receives the WGS84 center, zoom level, and [DragType] phase.
  final OnDragChangeCallback? onDragChangeCallback;

  /// Callback for zoom start and end; intermediate gesture zoom changes are
  /// not reported.
  final OnZoomChangeCallback? onZoomChangeCallback;

  /// Callback for center changes with WGS84 coordinates and zoom level.
  final OnCenterChangeCallback? onCenterChangeCallback;

  /// Callback for changes to the displayed WGS84 coordinate bounds.
  final OnBoundsChangeCallback? onBoundsChangeCallback;

  /// Callback for camera bearing changes in degrees.
  final OnBearingChangeCallback? onBearingChangeCallback;

  /// Callback for camera pitch changes in degrees.
  final OnPitchChangeCallback? onPitchChangeCallback;

  /// Callback for camera idle events with center, zoom, bearing, and pitch.
  ///
  /// The center uses WGS84 latitude/longitude; angles are in degrees.
  final OnCameraIdle? onCameraIdle;

  /// Callback for marker taps with marker ID, WGS84 position, and zoom.
  final OnMarkerTap? onMarkerTap;

  /// Callback for marker drag events with ID, WGS84 position, and phase.
  final OnMarkerDragChangeCallback? onMarkerDragChangeCallback;

  /// Callback for cluster taps with WGS84 center, zoom, and marker IDs.
  final OnMarkerClustererTap? onMarkerClustererTap;

  /// Callback for information window taps with ID and WGS84 position.
  final OnInfoWindowTap? onInfoWindowTap;

  /// Callback for custom overlay taps with ID and WGS84 position.
  final OnCustomOverlayTap? onCustomOverlayTap;

  /// Creates a Tmapv3 web map widget with camera options and overlays.
  ///
  /// [minPitch], [maxPitch], and [maxBounds] apply only during map creation.
  /// Null overlay collections are treated as empty during synchronization.
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

  /// Creates state to register the map DOM view and manage its JS lifecycle.
  @override
  State<TMapWebWidget> createState() => _TMapWebWidgetState();
}

/// Manages the Tmapv3 HTML view, JavaScript callbacks, and overlay snapshots.
class _TMapWebWidgetState extends State<TMapWebWidget> {
  static int _nextViewId = 0;
  late final String _viewId;
  late final String _containerId;
  late final String _viewType;
  late final TMapController _controller;
  final OverlaySnapshot _overlaySnapshot = OverlaySnapshot();
  bool _isInitializing = false;
  bool _isMapInitialized = false;
  LatLngBounds? _boundsAtCreation;

  /// Registers the HTML platform view and begins loading the Tmapv3 SDK.
  @override
  void initState() {
    super.initState();
    _nextViewId++;
    _viewId = 'web_view_$_nextViewId';
    _containerId = 'tmap_container_$_viewId';
    _viewType = 'tmap_web_view_$_viewId';
    _controller = TMapController.fromWeb(_viewId);

    // Register the DOM platform view.
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

      // Create the JavaScript callback object.
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
        final pendingBounds =
            boundsToApplyOnReady(_boundsAtCreation, widget.bounds);
        if (pendingBounds != null) {
          TMapWebBridge.fitBounds(_viewId, pendingBounds, null);
        }
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

      callbacks.setProperty(
          'onTouchStart'.toJS,
          ((JSNumber lat, JSNumber lng) {
            if (mounted) {
              widget.onTouchStart
                  ?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
            }
          }).toJS);
      callbacks.setProperty(
          'onTouchEnd'.toJS,
          ((JSNumber lat, JSNumber lng) {
            if (mounted) {
              widget.onTouchEnd
                  ?.call(LatLng(lat.toDartDouble, lng.toDartDouble));
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
        final zoomType = zoomTypeFromPhase(phase?.toDart);
        if (zoomType != null) {
          widget.onZoomChangeCallback?.call(zoom.toDartInt, zoomType);
        }
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

      final onMarkerDragFn = (JSString id, JSNumber lat, JSNumber lng,
          JSString? phase, JSNumber zoom) {
        if (!mounted) return;
        final phaseStr = phase?.toDart;
        if (phaseStr == 'move' || phaseStr == 'end') {
          _controller.dispatchMarkerInteraction(MarkerInteraction(
            markerId: id.toDart,
            type: phaseStr == 'move'
                ? MarkerInteractionType.drag
                : MarkerInteractionType.dragend,
            position: LatLng(lat.toDartDouble, lng.toDartDouble),
            zoom: zoom.toDartInt,
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

      final boundsAtCreation = widget.bounds;
      _boundsAtCreation = boundsAtCreation;
      TMapWebBridge.initMap(
        viewId: _viewId,
        containerId: _containerId,
        center: widget.center,
        bounds: boundsAtCreation,
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

  /// Applies changed map options and synchronizes overlays once the map is
  /// initialized.
  ///
  /// Before the map is ready, starts initialization if none is in progress.
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
    if (widget.bounds != oldWidget.bounds &&
        widget.bounds != null &&
        !widget.bounds!.isEmpty) {
      TMapWebBridge.fitBounds(_viewId, widget.bounds!, null);
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

  /// Disposes of the JavaScript map resources for this view.
  @override
  void dispose() {
    _isMapInitialized = false;
    TMapWebBridge.dispose(_viewId);
    super.dispose();
  }

  /// Returns the HTML map view inside a detector that claims pointer input.
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
