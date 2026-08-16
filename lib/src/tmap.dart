import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'auth/auth_repository.dart';
import 'callbacks/callbacks.dart';
import 'constants/drag_type.dart';
import 'constants/html_wrapper.dart';
import 'constants/map_type.dart';
import 'constants/zoom_type.dart';
import 'js/js_clusterer.dart';
import 'js/js_global_variables.dart';
import 'js/js_info_window.dart';
import 'js/js_label.dart';
import 'js/js_map_control.dart';
import 'js/js_map_init.dart';
import 'js/js_marker.dart';
import 'js/js_overlay_clear.dart';
import 'js/js_overlay_draw.dart';
import 'js/js_tdata.dart';
import 'js/js_utils.dart';
import 'models/lat_lng.dart';
import 'models/lat_lng_bounds.dart';
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
import 'web/tmap_web_stub.dart'
    if (dart.library.js_interop) 'web/tmap_web_widget.dart';

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
    this.zoom = 16,
    this.minZoom = 0,
    this.maxZoom = 19,
    this.bearing = 0.0,
    this.pitch = 0.0,
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
  bool _isMapReady = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (!kIsWeb) {
      _initializeWebView();
    }
  }

  @override
  void dispose() {
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

    controller.loadHtmlString(
      _loadMap(),
      baseUrl: AuthRepository.instance.baseUrl,
    );

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
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return TMapWebWidget(
        center: widget.center,
        zoom: widget.zoom,
        minZoom: widget.minZoom,
        maxZoom: widget.maxZoom,
        bearing: widget.bearing,
        pitch: widget.pitch,
        mapType: widget.mapType,
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
        onMarkerTap: widget.onMarkerTap,
        onCameraIdle: widget.onCameraIdle,
      );
    }

    return WebViewWidget(
      controller: _mapController.webViewController,
      gestureRecognizers: widget.gestureRecognizers,
    );
  }

  String _loadMap() {
    return htmlWrapper('''
<script>
  ${JsGlobalVariables.getScript()}
  ${JsMapInit.getScript(
      center: widget.center,
      zoom: widget.zoom,
      minZoom: widget.minZoom,
      maxZoom: widget.maxZoom,
      bearing: widget.bearing,
      pitch: widget.pitch,
      mapType: widget.mapType,
      naviControl: widget.naviControl,
      scaleBar: widget.scaleBar,
      hasOnMapTap: widget.onMapTap != null,
      hasOnMapDoubleTap: widget.onMapDoubleTap != null,
      hasOnMapLongTap: widget.onMapLongTap != null,
      hasOnDragChangeCallback: widget.onDragChangeCallback != null,
      hasOnZoomChangeCallback: widget.onZoomChangeCallback != null,
      hasOnCenterChangeCallback: widget.onCenterChangeCallback != null,
      hasOnBoundsChangeCallback: widget.onBoundsChangeCallback != null,
      hasOnCameraIdle: widget.onCameraIdle != null,
      hasOnBearingChangeCallback: widget.onBearingChangeCallback != null,
      hasOnPitchChangeCallback: widget.onPitchChangeCallback != null,
    )}
  ${JsMapControl.getScript()}
  ${JsMarker.getScript(
      hasMarkerTapCallback: widget.onMarkerTap != null,
      hasMarkerDragCallback: widget.onMarkerDragChangeCallback != null,
    )}
  ${JsInfoWindow.getScript(
      hasInfoWindowTapCallback: widget.onInfoWindowTap != null,
    )}
  ${JsLabel.getScript()}
  ${JsClusterer.getScript(
      hasMarkerClustererTapCallback: widget.onMarkerClustererTap != null,
    )}
  ${JsOverlayDraw.getScript(
      hasCustomOverlayTapCallback: widget.onCustomOverlayTap != null,
    )}
  ${JsOverlayClear.getScript()}
  ${JsTData.getScript()}
  ${JsUtils.getScript()}
</script>
''');
  }

  @override
  void didUpdateWidget(TMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (kIsWeb) return;

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

    if (widget.mapType != oldWidget.mapType) {
      _mapController.setMapType(widget.mapType);
    }

    _syncOverlays();
  }

  void _syncOverlays() {
    final markers = widget.markers;
    _mapController.clearAllMarkers();
    if (markers != null && markers.isNotEmpty) {
      _mapController.addMarkers(markers);
    }

    final clusterer = widget.clusterer;
    if (clusterer != null) {
      _mapController.addMarkerClusterer(clusterer);
    } else {
      _mapController.clearMarkerClusterer();
    }

    final infoWindows = widget.infoWindows;
    _mapController.clearAllInfoWindows();
    if (infoWindows != null && infoWindows.isNotEmpty) {
      for (final iw in infoWindows) {
        _mapController.addInfoWindow(iw);
      }
    }

    final labels = widget.labels;
    _mapController.clearAllLabels();
    if (labels != null && labels.isNotEmpty) {
      for (final lb in labels) {
        _mapController.addLabel(lb);
      }
    }

    final polylines = widget.polylines;
    _mapController.clearAllPolylines();
    if (polylines != null && polylines.isNotEmpty) {
      for (final pl in polylines) {
        _mapController.addPolyline(pl);
      }
    }

    final polygons = widget.polygons;
    _mapController.clearAllPolygons();
    if (polygons != null && polygons.isNotEmpty) {
      for (final pg in polygons) {
        _mapController.addPolygon(pg);
      }
    }

    final circles = widget.circles;
    _mapController.clearAllCircles();
    if (circles != null && circles.isNotEmpty) {
      for (final c in circles) {
        _mapController.addCircle(c);
      }
    }

    final rectangles = widget.rectangles;
    _mapController.clearAllRectangles();
    if (rectangles != null && rectangles.isNotEmpty) {
      for (final r in rectangles) {
        _mapController.addRectangle(r);
      }
    }

    final customOverlays = widget.customOverlays;
    _mapController.clearAllCustomOverlays();
    if (customOverlays != null && customOverlays.isNotEmpty) {
      for (final co in customOverlays) {
        _mapController.addCustomOverlay(co);
      }
    }
  }

  void _addJavaScriptChannels(WebViewController controller) {
    controller
      ..addJavaScriptChannel(
        'onMapCreated',
        onMessageReceived: (JavaScriptMessage result) {
          _isMapReady = true;
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
          final onMapTap = widget.onMapTap;
          if (onMapTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            onMapTap(LatLng.fromJson(json));
          }
        },
      )
      ..addJavaScriptChannel(
        'onMapLongTap',
        onMessageReceived: (JavaScriptMessage result) {
          final onMapLongTap = widget.onMapLongTap;
          if (onMapLongTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            onMapLongTap(LatLng.fromJson(json));
          }
        },
      )
      ..addJavaScriptChannel(
        'onMarkerTap',
        onMessageReceived: (JavaScriptMessage result) {
          final onMarkerTap = widget.onMarkerTap;
          if (onMarkerTap != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final id = json['markerId'] as String? ?? '';
            final latLng = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            onMarkerTap(id, latLng, zoom);
          }
        },
      )
      ..addJavaScriptChannel(
        'onMarkerClustererTap',
        onMessageReceived: (JavaScriptMessage result) {
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
          final onMarkerDragChange = widget.onMarkerDragChangeCallback;
          if (onMarkerDragChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final id = json['markerId'] as String? ?? '';
            final latLng = LatLng.fromJson(json);
            final typeStr = json['dragType'] as String? ?? '';
            final type = typeStr == 'start' ? DragType.start : DragType.end;
            onMarkerDragChange(id, latLng, type);
          }
        },
      )
      ..addJavaScriptChannel(
        'dragStart',
        onMessageReceived: (JavaScriptMessage result) {
          final onDragChange = widget.onDragChangeCallback;
          if (onDragChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final latLng = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            onDragChange(latLng, zoom, DragType.start);
          }
        },
      )
      ..addJavaScriptChannel(
        'dragEnd',
        onMessageReceived: (JavaScriptMessage result) {
          final onDragChange = widget.onDragChangeCallback;
          if (onDragChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final latLng = LatLng.fromJson(json);
            final zoom = (json['zoom'] as num? ?? 16).toInt();
            onDragChange(latLng, zoom, DragType.end);
          }
        },
      )
      ..addJavaScriptChannel(
        'zoomChanged',
        onMessageReceived: (JavaScriptMessage result) {
          final onZoomChange = widget.onZoomChangeCallback;
          if (onZoomChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            final zoom = (json['zoomLevel'] as num? ?? 16).toInt();
            onZoomChange(zoom, ZoomType.end);
          }
        },
      )
      ..addJavaScriptChannel(
        'centerChanged',
        onMessageReceived: (JavaScriptMessage result) {
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
          final onBoundsChange = widget.onBoundsChangeCallback;
          if (onBoundsChange != null) {
            final json = jsonDecode(result.message) as Map<String, dynamic>;
            onBoundsChange(LatLngBounds.fromJson(json));
          }
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
