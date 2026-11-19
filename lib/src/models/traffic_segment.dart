import 'lat_lng.dart';

/// A road section in the TMAP real-time traffic GeoJSON response.
class TrafficSegment {
  final String id;
  final String name;

  /// TMAP congestion code: 0 unknown, 1 smooth, 2 slow, 3 congested, 4 jammed.
  final int congestion;
  final int speed;
  final List<LatLng> path;

  const TrafficSegment({
    required this.id,
    required this.name,
    required this.congestion,
    required this.speed,
    required this.path,
  });

  static List<TrafficSegment> fromFeatureCollection(Map<String, dynamic> json) {
    final features = json['features'];
    if (features is! List) return const [];
    return [
      for (final feature in features)
        if (feature is Map<String, dynamic>)
          if (fromFeature(feature) case final segment?) segment,
    ];
  }

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
