/// SDK Polygon.getArea measurements in square metres.
///
/// The native SDK reports the exterior and each inner ring separately, using
/// comma-formatted strings. This model retains both to avoid hiding holes.
class PolygonArea {
  /// Area of the exterior polygon ring in square metres.
  final double pathSquareMeters;

  /// Areas of the interior rings in square metres.
  final List<double> innerPathSquareMeters;

  /// Creates separate exterior and interior ring measurements.
  const PolygonArea({
    required this.pathSquareMeters,
    required this.innerPathSquareMeters,
  });

  /// Exterior area minus all interior ring areas, in square metres.
  double get netSquareMeters =>
      pathSquareMeters -
      innerPathSquareMeters.fold<double>(0, (sum, value) => sum + value);

  /// Parses a `Polygon.getArea` payload from Tmapv3.
  ///
  /// Reads `pathArea` and the `outerPathArea` list, accepting numbers or
  /// comma-separated numeric strings; malformed numeric values throw.
  factory PolygonArea.fromJson(Map<String, dynamic> json) {
    double parse(Object? value) {
      if (value is num) return value.toDouble();
      return double.parse(value.toString().replaceAll(',', ''));
    }

    return PolygonArea(
      pathSquareMeters: parse(json['pathArea']),
      innerPathSquareMeters:
          (json['outerPathArea'] as List<dynamic>? ?? const [])
              .map(parse)
              .toList(growable: false),
    );
  }
}
