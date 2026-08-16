import 'lat_lng.dart';

/// TMAP 지도 상의 사각 경계 영역을 표현하는 클래스입니다.
class LatLngBounds {
  /// 남서쪽 좌표
  final LatLng southWest;

  /// 북동쪽 좌표
  final LatLng northEast;

  const LatLngBounds({
    required this.southWest,
    required this.northEast,
  });

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
        (southWest.latitude + northEast.latitude) / 2,
        (southWest.longitude + northEast.longitude) / 2,
      );

  /// 특정 좌표가 경계 내에 포함되는지 확인합니다.
  bool contains(LatLng point) {
    final latContained = point.latitude >= southWest.latitude &&
        point.latitude <= northEast.latitude;
    final lngContained = point.longitude >= southWest.longitude &&
        point.longitude <= northEast.longitude;
    return latContained && lngContained;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LatLngBounds &&
          runtimeType == other.runtimeType &&
          southWest == other.southWest &&
          northEast == other.northEast;

  @override
  int get hashCode => southWest.hashCode ^ northEast.hashCode;

  @override
  String toString() =>
      'LatLngBounds(southWest: $southWest, northEast: $northEast)';
}
