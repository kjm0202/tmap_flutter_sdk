import 'dart:math' as math;

import '../models/lat_lng.dart';
import '../models/point.dart';
import '../tmap_controller.dart';

/// Coordinate conversions supported by the TMAP v3 API.
///
/// EPSG:3857 conversions are synchronous, pure Dart calculations.
/// SDK-specific Bessel and KATEC conversions run through a connected map.
class Projection {
  final TMapController? _controller;

  /// Creates a coordinate conversion helper.
  ///
  /// EPSG:3857 conversions run synchronously without a controller.
  /// Bessel/KATEC conversions require a [TMapController] for SDK calls and
  /// fail with [StateError] when no controller is provided.
  const Projection([this._controller]);

  static const double _earthRadius = 6378137.0;

  /// Converts WGS84 latitude/longitude in degrees to EPSG:3857 meters.
  ///
  /// Runs synchronously without a map or network connection.
  Point convertWGS84GEOToEPSG3857(LatLng coordinate) {
    final latitude = coordinate.latitude * math.pi / 180;
    final x = _earthRadius * coordinate.longitude * math.pi / 180;
    final y = _earthRadius * math.log(math.tan(math.pi / 4 + latitude / 2));
    return Point(x, y);
  }

  /// Converts EPSG:3857 coordinates in meters to WGS84 degrees.
  ///
  /// Runs synchronously without a map or network connection.
  LatLng convertEPSG3857ToWGS84GEO(Point coordinate) {
    final longitude = coordinate.x / _earthRadius * 180 / math.pi;
    final latitude =
        (2 * math.atan(math.exp(coordinate.y / _earthRadius)) - math.pi / 2) *
            180 /
            math.pi;
    return LatLng(latitude, longitude);
  }

  /// Converts Bessel geographic degrees to WGS84 degrees through the SDK.
  Future<LatLng> convertBesselGEOToWGS84GEO(LatLng coordinate) async =>
      LatLng.fromJson(
          await _convert('convertBesselGEOToWGS84GEO', coordinate.toJson()));

  /// Converts Bessel TM projected coordinates in meters to WGS84 degrees.
  Future<LatLng> convertBesselTMToWGS84GEO(Point coordinate) async =>
      LatLng.fromJson(
          await _convert('convertBesselTMToWGS84GEO', coordinate.toJson()));

  /// Converts WGS84 latitude/longitude in degrees to Bessel geographic degrees.
  Future<LatLng> convertWGS84GEOToBesselGEO(LatLng coordinate) async =>
      LatLng.fromJson(
          await _convert('convertWGS84GEOToBesselGEO', coordinate.toJson()));

  /// Converts WGS84 latitude/longitude degrees to Bessel TM meters.
  Future<Point> convertWGS84GEOToBesselTM(LatLng coordinate) async =>
      Point.fromJson(
          await _convert('convertWGS84GEOToBesselTM', coordinate.toJson()));

  /// Converts WGS84 latitude/longitude degrees to KATEC meters.
  Future<Point> convertWGS84GEOToKatec(LatLng coordinate) async =>
      Point.fromJson(
          await _convert('convertWGS84GEOToKatec', coordinate.toJson()));

  Future<Map<String, dynamic>> _convert(
      String method, Map<String, dynamic> coordinate) {
    final controller = _controller;
    if (controller == null) {
      throw StateError('$method requires Projection(TMapController)');
    }
    return controller.convertProjection(method, coordinate);
  }
}
