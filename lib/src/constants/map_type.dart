/// TMAP 지도 타입 정의
enum TMapType {
  /// 일반 도로 지도
  road('ROAD'),

  /// 위성 + 일반 지도 (하이브리드)
  hybrid('HYBRID'),

  /// 공공 지도
  public('PUBLIC'),

  /// 야간 지도
  night('NIGHT');

  final String value;
  const TMapType(this.value);
}
