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

  /// SDK 클러스터 아이콘 정의 목록.
  final List<Map<String, dynamic>>? icons;

  /// 클러스터 그룹의 표시 순서.
  final int? zIndex;

  const Clusterer({
    required this.markers,
    this.maxClusterZoom = 19,
    this.minClusterCount = 2,
    this.gridSize = 80,
    this.visible = true,
    this.opacity = 1.0,
    this.icons,
    this.zIndex,
  });

  /// 멤버 추가·삭제 및 옵션 변경 후 컨트롤러에 다시 전달할 새 값입니다.
  Clusterer copyWith({
    List<Marker>? markers,
    int? maxClusterZoom,
    int? minClusterCount,
    int? gridSize,
    bool? visible,
    double? opacity,
    List<Map<String, dynamic>>? icons,
    int? zIndex,
  }) =>
      Clusterer(
        markers: markers ?? this.markers,
        maxClusterZoom: maxClusterZoom ?? this.maxClusterZoom,
        minClusterCount: minClusterCount ?? this.minClusterCount,
        gridSize: gridSize ?? this.gridSize,
        visible: visible ?? this.visible,
        opacity: opacity ?? this.opacity,
        icons: icons ?? this.icons,
        zIndex: zIndex ?? this.zIndex,
      );

  /// 지정한 멤버를 추가한 새 클러스터러 값입니다.
  Clusterer addMarker(Marker marker) => copyWith(markers: [
        ...markers.where((m) => m.markerId != marker.markerId),
        marker,
      ]);

  /// 지정한 멤버를 제거한 새 클러스터러 값입니다.
  Clusterer removeMarker(String markerId) =>
      copyWith(markers: markers.where((m) => m.markerId != markerId).toList());

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
      if (icons != null) 'icons': icons,
      if (zIndex != null) 'zIndex': zIndex,
    };
  }
}
