import 'lat_lng.dart';

/// Coordinate values returned by TMAP's `/tmap/geo/coordconvert` endpoint.
///
/// The endpoint labels values `lon` and `lat` even for projected coordinate
/// systems measured in metres. Use [x] and [y] for those raw values.
class ProjectedCoordinate {
  /// Raw `coordinate.lon` value, in metres eastward for projected systems.
  final double x;

  /// Raw `coordinate.lat` value, in metres northward for projected systems.
  final double y;

  /// Requested coordinate system code, such as `WGS84GEO` or `KATECH`.
  final String coordType;

  /// Creates a result preserving its coordinate values and system code.
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

  /// Parses numeric or numeric-string `coordinate.lon` and `coordinate.lat`.
  ///
  /// Returns null if the coordinate object is missing or a value is not finite.
  /// [coordType] identifies the requested target coordinate system.
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
