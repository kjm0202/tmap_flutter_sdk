import 'marker.dart';

/// TMAP 대용량 마커 클러스터러 클래스입니다.
class Clusterer {
  /// 클러스터링할 마커 목록
  final List<Marker> markers;

  /// 클러스터링이 적용되는 최대 줌 레벨 (기본값: 19)
  final int maxClusterZoom;

  /// 클러스터를 구성하는 최소 마커 수 (기본값: 2)
  final int minClusterCount;

  /// 클러스터 그리드 크기 (픽셀, 기본값: 80)
  final int gridSize;

  /// 표시 여부
  final bool visible;

  /// 투명도
  final double opacity;

  const Clusterer({
    required this.markers,
    this.maxClusterZoom = 19,
    this.minClusterCount = 2,
    this.gridSize = 80,
    this.visible = true,
    this.opacity = 1.0,
  });

  /// ID 목록에 해당하는 마커들을 찾습니다.
  List<Marker> getMarkersByIds(List<String> ids) {
    final idSet = ids.toSet();
    return markers.where((m) => idSet.contains(m.markerId)).toList();
  }

  Map<String, dynamic> toJson() {
    return {
      'markers': markers.map((e) => e.toJson()).toList(),
      'maxClusterZoom': maxClusterZoom,
      'minClusterCount': minClusterCount,
      'gridSize': gridSize,
      'visible': visible,
      'opacity': opacity,
    };
  }
}
