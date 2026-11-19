/// SDK Polygon.getArea measurements in square metres.
///
/// The native SDK reports the exterior and each inner ring separately, using
/// comma-formatted strings. This model retains both to avoid hiding holes.
class PolygonArea {
  final double pathSquareMeters;
  final List<double> innerPathSquareMeters;

  const PolygonArea({
    required this.pathSquareMeters,
    required this.innerPathSquareMeters,
  });

  double get netSquareMeters =>
      pathSquareMeters -
      innerPathSquareMeters.fold<double>(0, (sum, value) => sum + value);

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
