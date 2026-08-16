import 'lat_lng.dart';

/// TMAP 경로 탐색 결과 모델입니다.
class RouteInfo {
  /// 총 거리 (미터)
  final int totalDistance;

  /// 총 소요 시간 (초)
  final int totalTime;

  /// 총 요금 (원)
  final int totalFare;

  /// 택시 예상 요금 (원)
  final int taxiFare;

  /// 경로 좌표 목록
  final List<LatLng> path;

  /// 경로 안내 지점 목록
  final List<RouteGuidePoint> guidePoints;

  const RouteInfo({
    required this.totalDistance,
    required this.totalTime,
    required this.totalFare,
    required this.taxiFare,
    required this.path,
    required this.guidePoints,
  });

  factory RouteInfo.fromJson(Map<String, dynamic> json) {
    final features = (json['features'] as List<dynamic>?) ?? <dynamic>[];
    final pathPoints = <LatLng>[];
    final guides = <RouteGuidePoint>[];

    int distance = 0;
    int time = 0;
    int fare = 0;
    int taxi = 0;

    for (final feature in features) {
      final fMap = feature as Map<String, dynamic>?;
      if (fMap == null) continue;

      final geometry = fMap['geometry'] as Map<String, dynamic>?;
      final properties = fMap['properties'] as Map<String, dynamic>?;

      if (properties != null && properties.containsKey('totalDistance')) {
        distance = (properties['totalDistance'] as num? ?? 0).toInt();
        time = (properties['totalTime'] as num? ?? 0).toInt();
        fare = (properties['totalFare'] as num? ?? 0).toInt();
        taxi = (properties['taxiFare'] as num? ?? 0).toInt();
      }

      if (geometry != null) {
        final type = geometry['type'] as String? ?? '';
        final coordinates = geometry['coordinates'];

        if (type == 'Point' && coordinates is List && coordinates.length >= 2) {
          final lng = (coordinates[0] as num).toDouble();
          final lat = (coordinates[1] as num).toDouble();
          final point = LatLng(lat, lng);
          final description = properties?['description'] as String? ?? '';
          final name = properties?['name'] as String? ?? '';
          guides.add(RouteGuidePoint(
            point: point,
            name: name,
            description: description,
          ));
        } else if (type == 'LineString' && coordinates is List) {
          for (final coord in coordinates) {
            if (coord is List && coord.length >= 2) {
              final lng = (coord[0] as num).toDouble();
              final lat = (coord[1] as num).toDouble();
              pathPoints.add(LatLng(lat, lng));
            }
          }
        }
      }
    }

    return RouteInfo(
      totalDistance: distance,
      totalTime: time,
      totalFare: fare,
      taxiFare: taxi,
      path: pathPoints,
      guidePoints: guides,
    );
  }
}

/// 경로 안내 지점 모델입니다.
class RouteGuidePoint {
  final LatLng point;
  final String name;
  final String description;

  const RouteGuidePoint({
    required this.point,
    required this.name,
    required this.description,
  });
}
