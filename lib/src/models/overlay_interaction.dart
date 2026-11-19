import 'lat_lng.dart';

/// `Tmapv3.Marker#on`으로 구독할 수 있는 마커 이벤트.
enum MarkerInteractionType { click, drag, dragend, mouseenter, mouseleave }

/// SDK가 전달한 마커 이벤트의 식별자와 좌표, 카메라 줌.
class MarkerInteraction {
  final String markerId;
  final MarkerInteractionType type;
  final LatLng position;
  final int zoom;

  const MarkerInteraction({
    required this.markerId,
    required this.type,
    required this.position,
    required this.zoom,
  });
}

/// 마커 클러스터 그룹의 포인터 이벤트.
enum ClusterInteractionType { mouseenter, mouseleave }

/// SDK 클러스터 그룹이 전달한 중심·줌·멤버 ID 목록.
class ClusterInteraction {
  final ClusterInteractionType type;
  final LatLng center;
  final int zoom;
  final List<String> markerIds;

  const ClusterInteraction({
    required this.type,
    required this.center,
    required this.zoom,
    required this.markerIds,
  });
}
