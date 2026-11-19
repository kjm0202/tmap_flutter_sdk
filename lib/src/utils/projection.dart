import 'dart:math' as math;

import '../models/lat_lng.dart';
import '../models/point.dart';
import '../tmap_controller.dart';

/// TMAP v3 좌표 변환 API입니다.
///
/// EPSG:3857 변환은 동기식 순수 Dart 연산입니다. TMAP 고유의 Bessel 및
/// KATEC 보정은 SDK와 동일한 값을 얻기 위해 연결된 지도를 통해 실행합니다.
class Projection {
  final TMapController? _controller;

  const Projection([this._controller]);

  static const double _earthRadius = 6378137.0;

  /// WGS84 위경도를 EPSG:3857의 미터 좌표로 변환합니다.
  Point convertWGS84GEOToEPSG3857(LatLng coordinate) {
    final latitude = coordinate.latitude * math.pi / 180;
    final x = _earthRadius * coordinate.longitude * math.pi / 180;
    final y = _earthRadius * math.log(math.tan(math.pi / 4 + latitude / 2));
    return Point(x, y);
  }

  /// EPSG:3857 미터 좌표를 WGS84 위경도로 변환합니다.
  LatLng convertEPSG3857ToWGS84GEO(Point coordinate) {
    final longitude = coordinate.x / _earthRadius * 180 / math.pi;
    final latitude =
        (2 * math.atan(math.exp(coordinate.y / _earthRadius)) - math.pi / 2) *
            180 /
            math.pi;
    return LatLng(latitude, longitude);
  }

  Future<LatLng> convertBesselGEOToWGS84GEO(LatLng coordinate) async =>
      LatLng.fromJson(
          await _convert('convertBesselGEOToWGS84GEO', coordinate.toJson()));

  Future<LatLng> convertBesselTMToWGS84GEO(Point coordinate) async =>
      LatLng.fromJson(
          await _convert('convertBesselTMToWGS84GEO', coordinate.toJson()));

  Future<LatLng> convertWGS84GEOToBesselGEO(LatLng coordinate) async =>
      LatLng.fromJson(
          await _convert('convertWGS84GEOToBesselGEO', coordinate.toJson()));

  Future<Point> convertWGS84GEOToBesselTM(LatLng coordinate) async =>
      Point.fromJson(
          await _convert('convertWGS84GEOToBesselTM', coordinate.toJson()));

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
