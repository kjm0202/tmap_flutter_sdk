import '../constants/drag_type.dart';
import '../constants/zoom_type.dart';
import '../models/lat_lng.dart';
import '../models/lat_lng_bounds.dart';
import '../tmap_controller.dart';

/// 지도 생성 완료 콜백
typedef MapCreateCallback = void Function(TMapController controller);

/// 지도 탭 콜백
typedef OnMapTap = void Function(LatLng latLng);

/// 지도 더블 탭 콜백
typedef OnMapDoubleTap = void Function(LatLng latLng);

/// 지도 롱 탭 (ContextMenu) 콜백
typedef OnMapLongTap = void Function(LatLng latLng);

/// 마커 탭 콜백
typedef OnMarkerTap = void Function(String markerId, LatLng latLng, int zoom);

/// 마커 클러스터 탭 콜백
typedef OnMarkerClustererTap = void Function(
  LatLng center,
  int zoom,
  List<String> markerIds,
);

/// 인포윈도우 탭 콜백
typedef OnInfoWindowTap = void Function(String infoWindowId, LatLng latLng);

/// 커스텀 오버레이 탭 콜백
typedef OnCustomOverlayTap = void Function(
    String customOverlayId, LatLng latLng);

/// 마커 드래그 변경 콜백
typedef OnMarkerDragChangeCallback = void Function(
  String markerId,
  LatLng latLng,
  DragType dragType,
);

/// 지도 드래그 상태 변경 콜백
typedef OnDragChangeCallback = void Function(
  LatLng latLng,
  int zoom,
  DragType dragType,
);

/// 카메라 이동 완료 (Idle) 콜백
typedef OnCameraIdle = void Function(
  LatLng center,
  int zoom,
  double bearing,
  double pitch,
);

/// 지도 중심 좌표 변경 콜백
typedef OnCenterChangeCallback = void Function(LatLng center, int zoom);

/// 줌 레벨 변경 콜백
typedef OnZoomChangeCallback = void Function(int zoom, ZoomType zoomType);

/// 회전각(Bearing) 변경 콜백
typedef OnBearingChangeCallback = void Function(double bearing);

/// 기울기(Pitch) 변경 콜백
typedef OnPitchChangeCallback = void Function(double pitch);

/// 지도 표출 영역(Bounds) 변경 콜백
typedef OnBoundsChangeCallback = void Function(LatLngBounds bounds);
