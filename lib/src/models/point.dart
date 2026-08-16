/// 2D 스크린 좌표(픽셀)를 나타내는 클래스입니다.
class Point {
  final double x;
  final double y;

  const Point(this.x, this.y);

  factory Point.fromJson(Map<String, dynamic> json) {
    return Point(
      (json['x'] as num? ?? 0.0).toDouble(),
      (json['y'] as num? ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {'x': x, 'y': y};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Point &&
          runtimeType == other.runtimeType &&
          x == other.x &&
          y == other.y;

  @override
  int get hashCode => x.hashCode ^ y.hashCode;

  @override
  String toString() => 'Point($x, $y)';
}
