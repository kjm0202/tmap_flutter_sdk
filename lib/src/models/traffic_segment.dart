import 'lat_lng.dart';

/// A road section in the TMAP real-time traffic GeoJSON response.
class TrafficSegment {
  /// 응답 `properties.id`의 도로 구간 식별자입니다. 누락 시 빈 문자열입니다.
  final String id;

  /// 응답 `properties.name`의 도로 구간 이름입니다. 누락 시 빈 문자열입니다.
  final String name;

  /// TMAP congestion code: 0 unknown, 1 smooth, 2 slow, 3 congested, 4 jammed.
  final int congestion;

  /// 실시간 교통 응답의 구간 속도 값입니다. 누락 시 0입니다.
  final int speed;

  /// 구간 경로의 WGS84 위경도 순서 목록입니다. 유효한 좌표가 두 개 이상 있어야 합니다.
  final List<LatLng> path;

  /// 식별자, 혼잡도, 속도 및 지리적 경로로 교통 구간을 생성합니다.
  const TrafficSegment({
    required this.id,
    required this.name,
    required this.congestion,
    required this.speed,
    required this.path,
  });

  /// GeoJSON FeatureCollection에서 유효한 LineString 구간만 파싱합니다.
  ///
  /// `features`가 없거나 배열이 아니면 빈 목록을 반환합니다.
  static List<TrafficSegment> fromFeatureCollection(Map<String, dynamic> json) {
    final features = json['features'];
    if (features is! List) return const [];
    return [
      for (final feature in features)
        if (feature is Map<String, dynamic>)
          if (fromFeature(feature) case final segment?) segment,
    ];
  }

  /// GeoJSON Feature 하나에서 교통 구간을 파싱합니다.
  ///
  /// `geometry.coordinates`는 [경도, 위도] 순서입니다. 잘못된 좌표,
  /// LineString 이외의 도형 또는 좌표가 두 개 미만이면 null을 반환합니다.
  static TrafficSegment? fromFeature(Map<String, dynamic> json) {
    final geometry = json['geometry'];
    final props = json['properties'];
    if (geometry is! Map ||
        props is! Map ||
        geometry['type'] != 'LineString' ||
        geometry['coordinates'] is! List) {
      return null;
    }
    final path = <LatLng>[];
    for (final pair in geometry['coordinates'] as List) {
      if (pair is! List || pair.length < 2) return null;
      final lon = _number(pair[0]);
      final lat = _number(pair[1]);
      if (lat == null || lon == null || lat.abs() > 90 || lon.abs() > 180) {
        return null;
      }
      path.add(LatLng(lat, lon));
    }
    if (path.length < 2) return null;
    return TrafficSegment(
      id: props['id']?.toString() ?? '',
      name: props['name']?.toString() ?? '',
      congestion: _number(props['congestion'])?.toInt() ?? 0,
      speed: _number(props['speed'])?.toInt() ?? 0,
      path: List.unmodifiable(path),
    );
  }

  static double? _number(dynamic value) {
    final result = value is num
        ? value.toDouble()
        : (value is String ? double.tryParse(value.trim()) : null);
    return result != null && result.isFinite ? result : null;
  }
}
