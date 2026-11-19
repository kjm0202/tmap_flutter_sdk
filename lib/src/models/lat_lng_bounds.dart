import 'dart:math' as math;

import 'lat_lng.dart';

/// TMAP 지도 상의 사각 경계 영역을 표현하는 클래스입니다.
class LatLngBounds {
  /// 남서쪽 좌표
  final LatLng southWest;

  /// 북동쪽 좌표
  final LatLng northEast;
  final bool _explicitlyEmpty;

  const LatLngBounds({
    required this.southWest,
    required this.northEast,
  }) : _explicitlyEmpty = false;

  /// Represents the official SDK's initially empty LatLngBounds.
  const LatLngBounds.empty()
      : southWest = const LatLng(0, 0),
        northEast = const LatLng(0, 0),
        _explicitlyEmpty = true;

  /// The SDK normalizes both latitude and longitude when both corners exist.
  LatLng get normalizedSouthWest => LatLng(
        math.min(southWest.latitude, northEast.latitude),
        math.min(southWest.longitude, northEast.longitude),
      );

  LatLng get normalizedNorthEast => LatLng(
        math.max(southWest.latitude, northEast.latitude),
        math.max(southWest.longitude, northEast.longitude),
      );

  LatLng get northWest =>
      LatLng(normalizedNorthEast.latitude, normalizedSouthWest.longitude);

  LatLng get southEast =>
      LatLng(normalizedSouthWest.latitude, normalizedNorthEast.longitude);

  /// Distance along the north edge in metres, not degrees.
  double get width => isEmpty ? 0 : normalizedNorthEast.distanceTo(northWest);

  /// Distance along the west edge in metres, not degrees.
  double get height => isEmpty ? 0 : northWest.distanceTo(normalizedSouthWest);

  bool get isEmpty => _explicitlyEmpty;

  /// Returns a new envelope that includes [coordinate].
  LatLngBounds extend(LatLng coordinate) {
    if (isEmpty) {
      return LatLngBounds(southWest: coordinate, northEast: coordinate);
    }
    final sw = normalizedSouthWest;
    final ne = normalizedNorthEast;
    return LatLngBounds(
      southWest: LatLng(
        math.min(sw.latitude, coordinate.latitude),
        math.min(sw.longitude, coordinate.longitude),
      ),
      northEast: LatLng(
        math.max(ne.latitude, coordinate.latitude),
        math.max(ne.longitude, coordinate.longitude),
      ),
    );
  }

  /// Immutable equivalent of the SDK's mutating union operation.
  LatLngBounds union(LatLngBounds other) => other.isEmpty
      ? this
      : extend(other.normalizedSouthWest).extend(other.normalizedNorthEast);

  /// Reports overlap including shared edges, returning false on non-overlap.
  ///
  /// The JavaScript SDK yields null for non-overlapping bounds.
  bool intersects(LatLngBounds other) {
    if (isEmpty || other.isEmpty) return false;
    final a = normalizedSouthWest;
    final b = normalizedNorthEast;
    final c = other.normalizedSouthWest;
    final d = other.normalizedNorthEast;
    return a.latitude <= d.latitude &&
        b.latitude >= c.latitude &&
        a.longitude <= d.longitude &&
        b.longitude >= c.longitude;
  }

  factory LatLngBounds.fromJson(Map<String, dynamic> json) {
    final swJson = json['southWest'] as Map<String, dynamic>? ??
        json['_sw'] as Map<String, dynamic>? ??
        <String, dynamic>{};
    final neJson = json['northEast'] as Map<String, dynamic>? ??
        json['_ne'] as Map<String, dynamic>? ??
        <String, dynamic>{};

    return LatLngBounds(
      southWest: LatLng.fromJson(swJson),
      northEast: LatLng.fromJson(neJson),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'southWest': southWest.toJson(),
      'northEast': northEast.toJson(),
    };
  }

  /// 중심 좌표를 반환합니다.
  LatLng get center => LatLng(
        (normalizedSouthWest.latitude + normalizedNorthEast.latitude) / 2,
        (normalizedSouthWest.longitude + normalizedNorthEast.longitude) / 2,
      );

  /// 특정 좌표가 경계 내에 포함되는지 확인합니다.
  bool contains(LatLng point) {
    if (isEmpty) return false;
    final sw = normalizedSouthWest;
    final ne = normalizedNorthEast;
    final latContained =
        point.latitude >= sw.latitude && point.latitude <= ne.latitude;
    final lngContained =
        point.longitude >= sw.longitude && point.longitude <= ne.longitude;
    return latContained && lngContained;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LatLngBounds &&
          isEmpty == other.isEmpty &&
          (isEmpty ||
              (normalizedSouthWest == other.normalizedSouthWest &&
                  normalizedNorthEast == other.normalizedNorthEast));

  @override
  int get hashCode =>
      isEmpty ? 0 : Object.hash(normalizedSouthWest, normalizedNorthEast);

  @override
  String toString() =>
      isEmpty ? 'null:null' : '$normalizedSouthWest:$normalizedNorthEast';
}
