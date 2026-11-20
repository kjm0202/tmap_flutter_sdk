import 'lat_lng.dart';

/// Coordinate values returned by TMAP's `/tmap/geo/coordconvert` endpoint.
///
/// The endpoint labels values `lon` and `lat` even for projected coordinate
/// systems measured in metres. Use [x] and [y] for those raw values.
class ProjectedCoordinate {
  /// 응답의 `coordinate.lon` 값입니다. 투영 좌표계에서는 미터 단위 X축입니다.
  final double x;

  /// 응답의 `coordinate.lat` 값입니다. 투영 좌표계에서는 미터 단위 Y축입니다.
  final double y;

  /// 요청한 좌표계 코드(예: `WGS84GEO`, `KATECH`)입니다.
  final String coordType;

  /// 좌표 수치와 좌표계 코드를 보존하는 결과 객체를 만듭니다.
  const ProjectedCoordinate({
    required this.x,
    required this.y,
    required this.coordType,
  });

  /// Only WGS84 geographic results can be safely interpreted as a [LatLng].
  LatLng? get asLatLng =>
      coordType == 'WGS84GEO' && x.abs() <= 180 && y.abs() <= 90
          ? LatLng(y, x)
          : null;

  /// `coordinate.lon/lat` 숫자 또는 숫자 문자열을 파싱합니다.
  ///
  /// 좌표 객체가 없거나 값이 유한한 숫자가 아니면 null을 반환합니다.
  /// [coordType]은 호출자가 요청한 좌표계를 지정합니다.
  static ProjectedCoordinate? fromJson(
    Map<String, dynamic> json, {
    required String coordType,
  }) {
    final coordinate = json['coordinate'];
    if (coordinate is! Map) return null;
    double? number(dynamic value) {
      final result = value is num
          ? value.toDouble()
          : (value is String ? double.tryParse(value.trim()) : null);
      return result != null && result.isFinite ? result : null;
    }

    final x = number(coordinate['lon']);
    final y = number(coordinate['lat']);
    if (x == null || y == null) return null;
    return ProjectedCoordinate(x: x, y: y, coordType: coordType);
  }
}
