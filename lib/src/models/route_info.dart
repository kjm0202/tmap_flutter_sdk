import 'dart:math' as math;

import 'lat_lng.dart';

/// A route returned by TMAP route planning.
class RouteInfo {
  /// Total route distance in metres.
  final int totalDistance;

  /// Total travel time in seconds.
  final int totalTime;

  /// Total route fare in Korean won (KRW).
  final int totalFare;

  /// Estimated taxi fare in Korean won (KRW).
  final int taxiFare;

  /// Ordered geographic coordinates of the route.
  final List<LatLng> path;

  /// Navigation guide points along the route.
  final List<RouteGuidePoint> guidePoints;

  /// Creates a route with totals, geometry, and guide points.
  const RouteInfo({
    required this.totalDistance,
    required this.totalTime,
    required this.totalFare,
    required this.taxiFare,
    required this.path,
    required this.guidePoints,
  });

  /// Parses a GeoJSON route, converting EPSG:3857 coordinates when requested.
  ///
  /// [responseCoordType] is the requested `resCoordType`, because the response
  /// payload does not state its coordinate system.
  /// Only `EPSG3857` coordinates are converted; any other value keeps the
  /// coordinates as returned (`WGS84GEO` by default).
  factory RouteInfo.fromJson(
    Map<String, dynamic> json, {
    String? responseCoordType = 'WGS84GEO',
  }) {
    final isEpsg3857 = responseCoordType == 'EPSG3857';
    final isWgs84 = responseCoordType == 'WGS84GEO';
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

        if (type == 'Point' &&
            isWgs84 &&
            (coordinates is! List || coordinates.length < 2)) {
          throw const FormatException('Invalid WGS84 guide coordinate');
        }
        if (type == 'LineString' && isWgs84 && coordinates is! List) {
          throw const FormatException('Invalid WGS84 line coordinates');
        }
        if (type == 'Point' && coordinates is List && coordinates.length >= 2) {
          final point = _toLatLng(coordinates, isEpsg3857, isWgs84);
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
              pathPoints.add(_toLatLng(coord, isEpsg3857, isWgs84));
            } else if (isWgs84) {
              throw const FormatException('Invalid WGS84 line coordinate');
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

  /// Spherical Mercator radius (metres) used by EPSG:3857.
  static const double _epsg3857Radius = 6378137;

  /// Reads one `[x, y]` pair, decoding `[xEastMetres, yNorthMetres]` when
  /// [isEpsg3857] and otherwise keeping `[longitude, latitude]` as is.
  static LatLng _toLatLng(List<dynamic> coord, bool isEpsg3857, bool isWgs84) {
    if (isWgs84 &&
        (coord[0] is! num ||
            coord[1] is! num ||
            !(coord[0] as num).isFinite ||
            !(coord[1] as num).isFinite ||
            (coord[0] as num).abs() > 180 ||
            (coord[1] as num).abs() > 90)) {
      throw const FormatException('Invalid WGS84 coordinate');
    }
    final x = (coord[0] as num).toDouble();
    final y = (coord[1] as num).toDouble();
    if (!isEpsg3857) return LatLng(y, x);
    final lng = x / _epsg3857Radius * 180 / math.pi;
    final lat = (2 * math.atan(math.exp(y / _epsg3857Radius)) - math.pi / 2) *
        180 /
        math.pi;
    return LatLng(lat, lng);
  }
}

/// A navigation guide point along a route.
class RouteGuidePoint {
  /// Guide point coordinate decoded from the route response.
  ///
  /// `WGS84GEO` coordinates are kept and `EPSG3857` coordinates are converted
  /// to WGS84; other coordinate types are kept as returned.
  final LatLng point;

  /// Name associated with the guide point.
  final String name;

  /// Navigation instruction text associated with the guide point.
  final String description;

  /// Creates a navigation guide point with its name and instructions.
  const RouteGuidePoint({
    required this.point,
    required this.name,
    required this.description,
  });
}
