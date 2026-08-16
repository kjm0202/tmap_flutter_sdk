/// TMAP 지도 상의 위경도 좌표를 표현하는 클래스입니다.
class LatLng {
  /// 위도 (Latitude)
  final double latitude;

  /// 경도 (Longitude)
  final double longitude;

  const LatLng(this.latitude, this.longitude);

  factory LatLng.fromJson(Map<String, dynamic> json) {
    return LatLng(
      (json['latitude'] as num? ?? json['lat'] as num? ?? 0.0).toDouble(),
      (json['longitude'] as num? ??
              json['lng'] as num? ??
              json['lon'] as num? ??
              0.0)
          .toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LatLng &&
          runtimeType == other.runtimeType &&
          latitude == other.latitude &&
          longitude == other.longitude;

  @override
  int get hashCode => latitude.hashCode ^ longitude.hashCode;

  @override
  String toString() => 'LatLng($latitude, $longitude)';
}
