import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'auth/auth_repository.dart';
import 'bridge_assets.dart';
import 'callbacks/callbacks.dart';
import 'constants/drag_type.dart';
import 'constants/html_wrapper.dart';
import 'constants/map_type.dart';
import 'constants/zoom_type.dart';
import 'models/lat_lng.dart';
import 'models/lat_lng_bounds.dart';
import 'models/overlay_interaction.dart';
import 'overlays/circle.dart';
import 'overlays/clusterer.dart';
import 'overlays/custom_overlay.dart';
import 'overlays/info_window.dart';
import 'overlays/label.dart';
import 'overlays/marker.dart';
import 'overlays/polygon.dart';
import 'overlays/polyline.dart';
import 'overlays/rectangle.dart';
import 'tmap_controller.dart';
import 'utils/overlay_snapshot.dart';
import 'web/tmap_web_stub.dart'
    if (dart.library.js_interop) 'web/tmap_web_widget.dart';

class _PointerInfo {
  final Offset downPosition;
  final Duration downTime;
  bool movedBeyondSlop = false;

  _PointerInfo(this.downPosition, this.downTime);
}

/// TMAP Vector Map (v3) Flutter 위젯입니다.
class TMap extends StatefulWidget {
  /// 지도 생성이 완료되었을 때 호출되는 콜백
  final MapCreateCallback? onMapCreated;

  /// 지도 탭 콜백
  final OnMapTap? onMapTap;

  /// 지도 더블 탭 콜백
  final OnMapDoubleTap? onMapDoubleTap;

  /// 지도 롱 탭 (ContextMenu) 콜백
  final OnMapLongTap? onMapLongTap;

  /// SDK 지도 터치 시작 이벤트
  final OnMapTouch? onTouchStart;

  /// SDK 지도 터치 종료 이벤트
  final OnMapTouch? onTouchEnd;

  /// 마커 탭 콜백
  final OnMarkerTap? onMarkerTap;

  /// 마커 클러스터 탭 콜백
  final OnMarkerClustererTap? onMarkerClustererTap;

  /// 인포윈도우 탭 콜백
  final OnInfoWindowTap? onInfoWindowTap;

  /// 커스텀 오버레이 탭 콜백
  final OnCustomOverlayTap? onCustomOverlayTap;

  /// 마커 드래그 변경 콜백
  final OnMarkerDragChangeCallback? onMarkerDragChangeCallback;

  /// 지도 드래그 상태 변경 콜백
  final OnDragChangeCallback? onDragChangeCallback;

  /// 카메라 이동 완료 (Idle) 콜백
  final OnCameraIdle? onCameraIdle;

  /// 지도 중심 좌표 변경 콜백
  final OnCenterChangeCallback? onCenterChangeCallback;

  /// 줌 레벨 변경 콜백
  final OnZoomChangeCallback? onZoomChangeCallback;

  /// 회전각 변경 콜백
  final OnBearingChangeCallback? onBearingChangeCallback;

  /// 기울기 변경 콜백
  final OnPitchChangeCallback? onPitchChangeCallback;

  /// 지도 표출 영역 변경 콜백
  final OnBoundsChangeCallback? onBoundsChangeCallback;

  /// 초기 지도 중심 좌표
  final LatLng? center;

  /// 초기 지도에 표시할 영역입니다.
  ///
  /// 값이 변경되면 [TMapController.fitBounds]로 새 영역을 표시합니다.
  /// [LatLngBounds.empty]와 null은 지도 영역 설정에서 제외됩니다.
  final LatLngBounds? bounds;

  /// 지도 이동을 제한할 영역입니다. SDK에서 생성할 때만 설정할 수 있습니다.
  ///
  /// null과 [LatLngBounds.empty]는 제한을 설정하지 않습니다.
  final LatLngBounds? maxBounds;

  /// 초기 줌 레벨 (0 ~ 19)
  final int zoom;

  /// 최소 줌 레벨
  final int minZoom;

  /// 최대 줌 레벨
  final int maxZoom;

  /// 초기 회전 각도 (0 ~ 360도)
  final double bearing;

  /// 초기 기울기 각도 (0 ~ 60도)
  final double pitch;

  /// SDK에서 허용하는 최소 기울기(도)입니다. 생성 시에만 적용됩니다.
  final double? minPitch;

  /// SDK에서 허용하는 최대 기울기(도)입니다. 생성 시에만 적용됩니다.
  final double? maxPitch;

  /// 지도 타입
  final TMapType mapType;

  /// 줌 내비게이션 컨트롤 표시 여부
  final bool naviControl;

  /// 스케일바 표시 여부
  final bool scaleBar;

  /// 표시할 마커 목록
  final List<Marker>? markers;

  /// 표시할 인포윈도우 목록
  final List<InfoWindow>? infoWindows;

  /// 표시할 라벨 목록
  final List<Label>? labels;

  /// 표시할 폴리라인 목록
  final List<Polyline>? polylines;

  /// 표시할 다각형 목록
  final List<Polygon>? polygons;

  /// 표시할 원 목록
  final List<Circle>? circles;

  /// 표시할 사각형 목록
  final List<Rectangle>? rectangles;

  /// 마커 클러스터러 설정
  final Clusterer? clusterer;

  /// 표시할 커스텀 오버레이 목록
  final List<CustomOverlay>? customOverlays;

  /// 웹뷰가 소비할 제스처 목록
  final Set<Factory<OneSequenceGestureRecognizer>> gestureRecognizers;

  const TMap({
    super.key,
    this.onMapCreated,
    this.onMapTap,
    this.onMapDoubleTap,
    this.onMapLongTap,
    this.onTouchStart,
    this.onTouchEnd,
    this.onMarkerTap,
    this.onMarkerClustererTap,
    this.onInfoWindowTap,
    this.onCustomOverlayTap,
    this.onMarkerDragChangeCallback,
    this.onDragChangeCallback,
    this.onCameraIdle,
    this.onCenterChangeCallback,
    this.onZoomChangeCallback,
    this.onBearingChangeCallback,
    this.onPitchChangeCallback,
    this.onBoundsChangeCallback,
    this.center,
    this.bounds,
    this.maxBounds,
    this.zoom = 16,
    this.minZoom = 0,
    this.maxZoom = 19,
    this.bearing = 0.0,
    this.pitch = 0.0,
    this.minPitch,
    this.maxPitch,
    this.mapType = TMapType.road,
    this.naviControl = false,
    this.scaleBar = false,
    this.markers,
    this.infoWindows,
    this.labels,
    this.polylines,
    this.polygons,
    this.circles,
    this.rectangles,
    this.clusterer,
    this.customOverlays,
    this.gestureRecognizers = const <Factory<OneSequenceGestureRecognizer>>{},
  });

  @override
  State<TMap> createState() => _TMapState();
}

class _TMapState extends State<TMap> with WidgetsBindingObserver {
  late final TMapController _mapController;
  final OverlaySnapshot _overlaySnapshot = OverlaySnapshot();
  bool _isMapReady = false;
  ScrollPosition? _iosScrollPosition;
  ScrollNotificationObserverState? _iosScrollObserver;
  String? _iosGuardDesired;
  String? _iosGuardApplied;
  bool _iosGuardSyncing = false;
  int _iosGuardDocumentEpoch = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (!kIsWeb) {
      _initializeWebView();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return;
    final position = Scrollable.maybeOf(context)?.position;
    if (!identical(position, _iosScrollPosition)) {
      _iosScrollPosition?.removeListener(_updateIosScrollGuard);
      _iosScrollPosition = position;
      _iosScrollPosition?.addListener(_updateIosScrollGuard);
    }
    final observer = ScrollNotificationObserver.maybeOf(context);
    if (!identical(observer, _iosScrollObserver)) {
      _iosScrollObserver?.removeListener(_handleIosScrollNotification);
      _iosScrollObserver = observer;
      _iosScrollObserver?.addListener(_handleIosScrollNotification);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updateIosScrollGuard();
    });
  }

  @override
  void dispose() {
    _iosScrollObserver?.removeListener(_handleIosScrollNotification);
    _iosScrollPosition?.removeListener(_updateIosScrollGuard);
    _isMapReady = false;
    if (!kIsWeb) {
      try {
        _mapController.webViewController.runJavaScript(
            'if (window.tmap_dispose_mobile) window.tmap_dispose_mobile();');
      } catch (e) {
        developer.log('Error disposing TMap: $e', name: 'TMap');
      }
    }
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed && _isMapReady && !kIsWeb) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted) {
          _mapController.relayout();
        }
      });
    }
  }

  void _initializeWebView() {
    late final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else if (WebViewPlatform.instance is AndroidWebViewPlatform) {
      params = AndroidWebViewControllerCreationParams();
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }

    final WebViewController controller =
        WebViewController.fromPlatformCreationParams(params);

    controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000));
    _addJavaScriptChannels(controller);

    if (controller.platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(true);
      final androidController = controller.platform as AndroidWebViewController;
      androidController.setMediaPlaybackRequiresUserGesture(false);
      androidController.setOnPlatformPermissionRequest(
        (PlatformWebViewPermissionRequest request) async {
          await request.grant();
        },
      );
    }

    _mapController = TMapController(controller);
    unawaited(_loadMap(controller));
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return TMapWebWidget(
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
        markers: widget.markers,
        clusterer: widget.clusterer,
        infoWindows: widget.infoWindows,
        labels: widget.labels,
        polylines: widget.polylines,
        polygons: widget.polygons,
        circles: widget.circles,
        rectangles: widget.rectangles,
        customOverlays: widget.customOverlays,
        onMapCreated: widget.onMapCreated,
        onMapTap: widget.onMapTap,
        onMapDoubleTap: widget.onMapDoubleTap,
        onMapLongTap: widget.onMapLongTap,
        onTouchStart: widget.onTouchStart,
        onTouchEnd: widget.onTouchEnd,
        onDragChangeCallback: widget.onDragChangeCallback,
        onZoomChangeCallback: widget.onZoomChangeCallback,
        onCenterChangeCallback: widget.onCenterChangeCallback,
        onBoundsChangeCallback: widget.onBoundsChangeCallback,
        onBearingChangeCallback: widget.onBearingChangeCallback,
        onPitchChangeCallback: widget.onPitchChangeCallback,
        onCameraIdle: widget.onCameraIdle,
        onMarkerTap: widget.onMarkerTap,
        onMarkerDragChangeCallback: widget.onMarkerDragChangeCallback,
        onMarkerClustererTap: widget.onMarkerClustererTap,
        onInfoWindowTap: widget.onInfoWindowTap,
        onCustomOverlayTap: widget.onCustomOverlayTap,
      );
    }

    return Listener(
      onPointerDown: _handlePointerDown,
      onPointerMove: _handlePointerMove,
      onPointerUp: _handlePointerUp,
      onPointerCancel: _handlePointerCancel,
      child: WebViewWidget(
        controller: _mapController.webViewController,
        gestureRecognizers: widget.gestureRecognizers,
      ),
    );
  }

  final Map<int, _PointerInfo> _activePointers = {};
  bool _isDisqualified = false;
  Offset? _firstTapPosition;
  Duration? _firstTapTime;
  DateTime? _lastDispatchedTime;
  Future<double?>? _currentBaseline;

  void _handleDoubleTap(LatLng latLng) {
    final now = DateTime.now();
    if (_lastDispatchedTime != null &&
        now.difference(_lastDispatchedTime!).inMilliseconds < 300) {
      return;
    }
    _lastDispatchedTime = now;
    widget.onMapDoubleTap?.call(latLng);
  }

  void _updateIosScrollGuard() {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS || !_isMapReady)
      return;
    final position = _iosScrollPosition;
    final enabled = widget.gestureRecognizers.isEmpty &&
        position != null &&
        position.hasContentDimensions &&
        position.physics.shouldAcceptUserOffset(position);
    _iosGuardDesired = enabled ? position.axis.name : '';
    if (!_iosGuardSyncing && _iosGuardDesired != _iosGuardApplied) {
      unawaited(_syncIosScrollGuard());
    }
  }

  void _handleIosScrollNotification(ScrollNotification notification) {
    final position = _iosScrollPosition;
    if (position != null &&
        identical(notification.context, position.context.notificationContext)) {
      _updateIosScrollGuard();
    }
  }

  Future<void> _syncIosScrollGuard() async {
    _iosGuardSyncing = true;
    try {
      while (mounted && _isMapReady && _iosGuardDesired != _iosGuardApplied) {
        final axis = _iosGuardDesired;
        final epoch = _iosGuardDocumentEpoch;
        await _mapController.webViewController.runJavaScript(
            'window.__tmapScrollGuardAxis = ${jsonEncode(axis)};');
        if (epoch == _iosGuardDocumentEpoch) _iosGuardApplied = axis;
      }
    } catch (error) {
      // Navigation or disposal may invalidate the WebView while a write is pending.
      developer.log(
          'iOS scroll guard synchronization failed: ${error.runtimeType}',
          name: 'TMap');
    } finally {
      _iosGuardSyncing = false;
    }
  }

  void _handlePointerDown(PointerDownEvent event) {
    if (defaultTargetPlatform != TargetPlatform.iOS &&
        defaultTargetPlatform != TargetPlatform.android) return;
    _updateIosScrollGuard();

    if (_activePointers.isNotEmpty) {
      _isDisqualified = true;
    } else {
      _isDisqualified = false;
    }

    _activePointers[event.pointer] =
        _PointerInfo(event.localPosition, event.timeStamp);
  }

  void _handlePointerMove(PointerMoveEvent event) {
    final pointer = _activePointers[event.pointer];
    if (pointer != null) {
      if ((event.localPosition - pointer.downPosition).distance > kTouchSlop) {
        pointer.movedBeyondSlop = true;
        _isDisqualified = true;
      }
    }
  }

  void _handlePointerUp(PointerUpEvent event) {
    if (defaultTargetPlatform != TargetPlatform.iOS &&
        defaultTargetPlatform != TargetPlatform.android) return;

    final wasDisqualified = _isDisqualified;
    final pointer = _activePointers.remove(event.pointer);
    if (_activePointers.isEmpty) {
      _isDisqualified = false;
    }

    if (pointer == null) return;

    final isLongPress =
        (event.timeStamp - pointer.downTime) > kLongPressTimeout;

    if (wasDisqualified || pointer.movedBeyondSlop || isLongPress) {
      if (_activePointers.isEmpty) _resetTap();
      return;
    }

    if (_activePointers.isEmpty) {
      if (_firstTapTime != null && _firstTapPosition != null) {
        if (event.timeStamp - _firstTapTime! <
                const Duration(milliseconds: 300) &&
            (event.localPosition - _firstTapPosition!).distance < 50) {
          final baseline = _currentBaseline;
          _performDoubleTap(event.localPosition, baseline);
          _resetTap();
          return;
        }
      }

      _firstTapPosition = event.localPosition;
      _firstTapTime = event.timeStamp;
      _currentBaseline = _readCameraZoom();
    }
  }

  Future<double?> _readCameraZoom() async {
    try {
      final result = await _mapController.webViewController
          .runJavaScriptReturningResult('''
        (function() {
          try {
            var r = map.vsmMap();
            if (!r) return null;
            return r.getCamera().getZoom();
          } catch(e) { return null; }
        })();
      ''');
      return double.tryParse(result.toString());
    } catch (e) {
      return null;
    }
  }

  void _handlePointerCancel(PointerCancelEvent event) {
    _activePointers.remove(event.pointer);
    _resetTap();
  }

  void _resetTap() {
    _firstTapPosition = null;
    _firstTapTime = null;
    _currentBaseline = null;
  }

  Future<void> _performDoubleTap(
      Offset localPosition, Future<double?>? baselineFuture) async {
    if (!mounted) return;

    final x = localPosition.dx.round();
    final y = localPosition.dy.round();

    final baseline = await baselineFuture;

    late LatLng latLng;
    try {
      final result = await _mapController.webViewController
          .runJavaScriptReturningResult('screenToReal($x, $y);');
      if (!mounted) return;
      final json = jsonDecode(result.toString()) as Map<String, dynamic>;
      latLng = LatLng.fromJson(json);
    } catch (e) {
      return;
    }

    _handleDoubleTap(latLng);

    await Future<void>.delayed(const Duration(milliseconds: 110));
    if (!mounted || _isDisqualified || baseline == null) {
      return;
    }

    final js = '''
      (function() {
        try {
          var r = map.vsmMap();
          if (!r) return;
          var cam = r.getCamera();
          var t = r.getTransform();
          var raw = cam.getZoom();
          
          var opts = r.getInteractive();
          var enabled = opts === true || (opts && typeof opts==='object' && opts.zoom && (opts.doubleClick || opts.touch));
          if (!enabled) return;

          if (Math.abs(raw - $baseline) < 1e-4 && !cam.isMoving()) {
            var maxZoom = t && typeof t.getMaxZoom === 'function' ? t.getMaxZoom() : NaN;
            if (!Number.isFinite(maxZoom)) maxZoom = ${widget.maxZoom};
            if (raw < maxZoom) {
              var target = Math.min(raw + 1, maxZoom);
              var pivot = t.screenPointToLngLat({x: $x, y: $y});
              cam.easeTo({zoom: target, pivot: pivot}, {}, {});
            }
          }
        } catch (e) {}
      })();
    ''';
    try {
      await _mapController.webViewController.runJavaScript(js);
    } catch (_) {
      // The WebView may have been disposed before this optional probe completes.
    }
  }

  Future<void> _loadMap(WebViewController controller) async {
    final scripts = await loadBridgeAssets(const [
      'shared.js',
      'mobile.js',
      'mobile_overlays.js',
      'mobile_tdata.js',
    ]);
    if (!mounted) return;
    final config = {
      'appKey': AuthRepository.instance.appKey,
      'iosScrollableGuard': defaultTargetPlatform == TargetPlatform.iOS,
      'centerLat': widget.center?.latitude ?? 37.5665,
      'centerLng': widget.center?.longitude ?? 126.9780,
      if (widget.bounds != null && !widget.bounds!.isEmpty)
        'bounds': widget.bounds!.toJson(),
      if (widget.maxBounds != null && !widget.maxBounds!.isEmpty)
        'maxBounds': widget.maxBounds!.toJson(),
      'mapType': widget.mapType.value,
      'zoom': widget.zoom,
      'minZoom': widget.minZoom,
      'maxZoom': widget.maxZoom,
      'bearing': widget.bearing,
      'pitch': widget.pitch,
      if (widget.minPitch != null) 'minPitch': widget.minPitch,
      if (widget.maxPitch != null) 'maxPitch': widget.maxPitch,
      'scaleBar': widget.scaleBar,
      'naviControl': widget.naviControl,
      'hasOnMapTap': widget.onMapTap != null,
      'hasOnMapDoubleTap': widget.onMapDoubleTap != null,
      'hasOnMapLongTap': widget.onMapLongTap != null,
      'hasOnDragChangeCallback': widget.onDragChangeCallback != null,
      'hasOnZoomChangeCallback': widget.onZoomChangeCallback != null,
      'hasOnCameraIdle': widget.onCameraIdle != null,
      'hasOnCenterChangeCallback': widget.onCenterChangeCallback != null,
      'hasOnBoundsChangeCallback': widget.onBoundsChangeCallback != null,
      'hasOnBearingChangeCallback': widget.onBearingChangeCallback != null,
      'hasOnPitchChangeCallback': widget.onPitchChangeCallback != null,
      'hasMarkerClustererTapCallback': widget.onMarkerClustererTap != null,
      'hasMarkerTapCallback': widget.onMarkerTap != null,
      'hasMarkerDragCallback': widget.onMarkerDragChangeCallback != null,
      'hasOnInfoWindowTap': widget.onInfoWindowTap != null,
      'hasOnCustomOverlayTap': widget.onCustomOverlayTap != null,
    };
    await _mapController.reloadHtml(
      htmlWrapper(
          '<script>const config = ${jsonEncode(config)};\n$scripts</script>'),
      baseUrl: AuthRepository.instance.baseUrl,
    );
  }

  @override
  void didUpdateWidget(TMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (kIsWeb) return;
    _updateIosScrollGuard();
    if (!_isMapReady) return;

    if (widget.center != oldWidget.center && widget.center != null) {
      final center = widget.center;
      if (center != null) {
        _mapController.setCenter(center);
      }
    }

    if (widget.zoom != oldWidget.zoom) {
      _mapController.setZoom(widget.zoom);
    }

    if (widget.bearing != oldWidget.bearing) {
      _mapController.setBearing(widget.bearing);
    }

    if (widget.pitch != oldWidget.pitch) {
      _mapController.setPitch(widget.pitch);
    }
    if (widget.bounds != oldWidget.bounds &&
        widget.bounds != null &&
        !widget.bounds!.isEmpty) {
      _mapController.fitBounds(widget.bounds!);
    }

    if (widget.mapType != oldWidget.mapType) {
      _mapController.setMapType(widget.mapType);
    }

    if (widget.minZoom != oldWidget.minZoom ||
        widget.maxZoom != oldWidget.maxZoom ||
        widget.naviControl != oldWidget.naviControl ||
        widget.scaleBar != oldWidget.scaleBar) {
      _mapController.updateMapOptions({
        'minZoom': widget.minZoom,
        'maxZoom': widget.maxZoom,
        'naviControl': widget.naviControl,
        'scaleBar': widget.scaleBar,
      });
    }

    _syncOverlays();
  }

  void _syncOverlays() {
    if (!_isMapReady) return;
    _overlaySnapshot.sync<Marker>(
      'markers',
      widget.markers,
      idOf: (m) => m.markerId,
      jsonOf: (m) => m.toJson(),
      add: (m) => _mapController.addMarker(m),
      remove: (id) => _mapController.clearMarker(id),
    );
    _overlaySnapshot.sync<InfoWindow>(
      'infoWindows',
      widget.infoWindows,
      idOf: (iw) => iw.infoWindowId,
      jsonOf: (iw) => iw.toJson(),
      add: (iw) => _mapController.addInfoWindow(iw),
      remove: (id) => _mapController.clearInfoWindow(id),
    );
    _overlaySnapshot.sync<Label>(
      'labels',
      widget.labels,
      idOf: (l) => l.labelId,
      jsonOf: (l) => l.toJson(),
      add: (l) => _mapController.addLabel(l),
      remove: (id) => _mapController.clearLabel(id),
    );
    _overlaySnapshot.sync<Polyline>(
      'polylines',
      widget.polylines,
      idOf: (p) => p.polylineId,
      jsonOf: (p) => p.toJson(),
      add: (p) => _mapController.addPolyline(p),
      remove: (id) => _mapController.clearPolyline(id),
    );
    _overlaySnapshot.sync<Polygon>(
      'polygons',
      widget.polygons,
      idOf: (p) => p.polygonId,
      jsonOf: (p) => p.toJson(),
      add: (p) => _mapController.addPolygon(p),
      remove: (id) => _mapController.clearPolygon(id),
    );
    _overlaySnapshot.sync<Circle>(
      'circles',
      widget.circles,
      idOf: (c) => c.circleId,
      jsonOf: (c) => c.toJson(),
      add: (c) => _mapController.addCircle(c),
      remove: (id) => _mapController.clearCircle(id),
    );
    _overlaySnapshot.sync<Rectangle>(
      'rectangles',
      widget.rectangles,
      idOf: (r) => r.rectangleId,
      jsonOf: (r) => r.toJson(),
      add: (r) => _mapController.addRectangle(r),
      remove: (id) => _mapController.clearRectangle(id),
    );
    _overlaySnapshot.sync<CustomOverlay>(
      'customOverlays',
      widget.customOverlays,
      idOf: (co) => co.customOverlayId,
      jsonOf: (co) => co.toJson(),
      add: (co) => _mapController.addCustomOverlay(co),
      remove: (id) => _mapController.clearCustomOverlay(id),
    );
    _overlaySnapshot.sync<Clusterer>(
      'clusterer',
      widget.clusterer == null ? const [] : [widget.clusterer!],
      idOf: (_) => 'clusterer',
      jsonOf: (c) => c.toJson(),
      add: (c) => _mapController.addMarkerClusterer(c),
      remove: (_) => _mapController.clearMarkerClusterer(),
    );
  }

  void _addJavaScriptChannels(WebViewController controller) {
    controller
      ..addJavaScriptChannel(
        'onMapCreated',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          _isMapReady = true;
          _iosGuardDocumentEpoch++;
          _iosGuardApplied = null;
          _updateIosScrollGuard();
          _overlaySnapshot.clear();
          _syncOverlays();
          final onMapCreated = widget.onMapCreated;
          if (onMapCreated != null) {
            onMapCreated(_mapController);
          }
        },
      )
      ..addJavaScriptChannel(
        'onMapTap',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onMapTap = widget.onMapTap;
          if (onMapTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            onMapTap(LatLng.fromJson(json));
          }
        },
      )
      ..addJavaScriptChannel(
        'onMapDoubleTap',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final json = jsonDecode(result.message) as Map<String, dynamic>;
          _handleDoubleTap(LatLng.fromJson(json));
        },
      )
      ..addJavaScriptChannel(
        'onMapLongTap',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onMapLongTap = widget.onMapLongTap;
          if (onMapLongTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            onMapLongTap(LatLng.fromJson(json));
          }
        },
      )
      ..addJavaScriptChannel(
        'onTouchStart',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final listener = widget.onTouchStart;
          if (listener != null) {
            listener(LatLng.fromJson(
                jsonDecode(result.message) as Map<String, dynamic>));
          }
        },
      )
      ..addJavaScriptChannel(
        'onTouchEnd',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final listener = widget.onTouchEnd;
          if (listener != null) {
            listener(LatLng.fromJson(
                jsonDecode(result.message) as Map<String, dynamic>));
          }
        },
      )
      ..addJavaScriptChannel(
        'onMarkerTap',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final json = jsonDecode(result.message) as Map<String, dynamic>;
          final id = (json['markerId'] ?? json['id'] ?? '') as String;
          final latLng = LatLng.fromJson(json);
          final zoom = (json['zoom'] as num? ?? 16).toInt();
          _mapController.dispatchMarkerInteraction(MarkerInteraction(
            markerId: id,
            type: MarkerInteractionType.click,
            position: latLng,
            zoom: zoom,
          ));
          final onMarkerTap = widget.onMarkerTap;
          if (onMarkerTap != null) {
            onMarkerTap(id, latLng, zoom);
          }
        },
      )
      ..addJavaScriptChannel(
        'onMarkerInteraction',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final json = jsonDecode(result.message) as Map<String, dynamic>;
          final type =
              MarkerInteractionType.values.byName(json['event'] as String);
          _mapController.dispatchMarkerInteraction(MarkerInteraction(
            markerId: (json['markerId'] ?? '') as String,
            type: type,
            position: LatLng.fromJson(json),
            zoom: (json['zoom'] as num? ?? 16).toInt(),
          ));
        },
      )
      ..addJavaScriptChannel(
        'onClusterInteraction',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final json = jsonDecode(result.message) as Map<String, dynamic>;
          _mapController.dispatchClusterInteraction(ClusterInteraction(
            type: ClusterInteractionType.values.byName(json['event'] as String),
            center: LatLng.fromJson(json),
            zoom: (json['zoom'] as num? ?? 16).toInt(),
            markerIds: (json['markers'] as List<dynamic>? ?? [])
                .map((e) => e.toString())
                .toList(),
          ));
        },
      )
      ..addJavaScriptChannel(
        'onMarkerClustererTap',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onMarkerClustererTap = widget.onMarkerClustererTap;
          if (onMarkerClustererTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final center = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            final markerIds = (json['markers'] as List<dynamic>?)
                    ?.map((e) => e.toString())
                    .toList() ??
                [];
            onMarkerClustererTap(center, zoom, markerIds);
          }
        },
      )
      ..addJavaScriptChannel(
        'onMarkerDragChangeCallback',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final json = jsonDecode(result.message) as Map<String, dynamic>;
          final id = (json['markerId'] ?? json['id'] ?? '') as String;
          final latLng = LatLng.fromJson(json);
          final typeStr =
              json['dragType'] as String? ?? json['phase'] as String? ?? '';
          if (typeStr == 'move' || typeStr == 'end') {
            _mapController.dispatchMarkerInteraction(MarkerInteraction(
              markerId: id,
              type: typeStr == 'move'
                  ? MarkerInteractionType.drag
                  : MarkerInteractionType.dragend,
              position: latLng,
              zoom: (json['zoom'] as num? ?? widget.zoom).round(),
            ));
          }
          final onMarkerDragChange = widget.onMarkerDragChangeCallback;
          if (onMarkerDragChange != null) {
            final type = typeStr == 'start'
                ? DragType.start
                : (typeStr == 'move' ? DragType.move : DragType.end);
            onMarkerDragChange(id, latLng, type);
          }
        },
      )
      ..addJavaScriptChannel(
        'onInfoWindowTap',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onInfoWindowTap = widget.onInfoWindowTap;
          if (onInfoWindowTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final id = (json['id'] ?? json['infoWindowId'] ?? '') as String;
            final latLng = LatLng.fromJson(json);
            onInfoWindowTap(id, latLng);
          }
        },
      )
      ..addJavaScriptChannel(
        'onCustomOverlayTap',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onCustomOverlayTap = widget.onCustomOverlayTap;
          if (onCustomOverlayTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final id = (json['id'] ?? json['customOverlayId'] ?? '') as String;
            final latLng = LatLng.fromJson(json);
            onCustomOverlayTap(id, latLng);
          }
        },
      )
      ..addJavaScriptChannel(
        'dragStart',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onDragChange = widget.onDragChangeCallback;
          if (onDragChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final latLng = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            final phaseStr = json['phase'] as String?;
            final phase = phaseStr == 'move'
                ? DragType.move
                : (phaseStr == 'end' ? DragType.end : DragType.start);
            onDragChange(latLng, zoom, phase);
          }
        },
      )
      ..addJavaScriptChannel(
        'dragMove',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onDragChange = widget.onDragChangeCallback;
          if (onDragChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final latLng = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            onDragChange(latLng, zoom, DragType.move);
          }
        },
      )
      ..addJavaScriptChannel(
        'dragEnd',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onDragChange = widget.onDragChangeCallback;
          if (onDragChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final latLng = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            final phaseStr = json['phase'] as String?;
            final phase = phaseStr == 'start'
                ? DragType.start
                : (phaseStr == 'move' ? DragType.move : DragType.end);
            onDragChange(latLng, zoom, phase);
          }
        },
      )
      ..addJavaScriptChannel(
        'zoomChanged',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onZoomChange = widget.onZoomChangeCallback;
          if (onZoomChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final zoom =
                (json['zoomLevel'] as num? ?? json['zoom'] as num? ?? 16)
                    .toInt();
            final phaseStr = json['phase'] as String?;
            final phase = phaseStr == 'start' ? ZoomType.start : ZoomType.end;
            onZoomChange(zoom, phase);
          }
        },
      )
      ..addJavaScriptChannel(
        'centerChanged',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onCenterChange = widget.onCenterChangeCallback;
          if (onCenterChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final center = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            onCenterChange(center, zoom);
          }
        },
      )
      ..addJavaScriptChannel(
        'cameraIdle',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onCameraIdle = widget.onCameraIdle;
          if (onCameraIdle != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final center = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            final bearing = (json['bearing'] as num? ?? 0.0).toDouble();
            final pitch = (json['pitch'] as num? ?? 0.0).toDouble();
            onCameraIdle(center, zoom, bearing, pitch);
          }
        },
      )
      ..addJavaScriptChannel(
        'bearingChanged',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onBearingChange = widget.onBearingChangeCallback;
          if (onBearingChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final bearing = (json['bearing'] as num? ?? 0.0).toDouble();
            onBearingChange(bearing);
          }
        },
      )
      ..addJavaScriptChannel(
        'pitchChanged',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onPitchChange = widget.onPitchChangeCallback;
          if (onPitchChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final pitch = (json['pitch'] as num? ?? 0.0).toDouble();
            onPitchChange(pitch);
          }
        },
      )
      ..addJavaScriptChannel(
        'boundsChanged',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          final onBoundsChange = widget.onBoundsChangeCallback;
          if (onBoundsChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            onBoundsChange(LatLngBounds.fromJson(json));
          }
        },
      )
      ..addJavaScriptChannel(
        'onDrawingComplete',
        onMessageReceived: (JavaScriptMessage result) {
          if (!mounted) return;
          _mapController.handleDrawingComplete(result.message);
        },
      )
      ..addJavaScriptChannel(
        'tdataCallback',
        onMessageReceived: (JavaScriptMessage result) {
          developer.log('tdataCallback: ${result.message}', name: 'TMap');
        },
      );
  }
}
