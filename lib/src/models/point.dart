import 'dart:math' as math;

/// 2차원 좌표입니다. 화면 좌표에서는 픽셀, 투영 좌표에서는 미터를 사용합니다.
class Point {
  final double x;
  final double y;

  const Point(this.x, this.y);

  /// 현재 좌표와 값이 같은 새 [Point]를 만듭니다.
  Point clone() => Point(x, y);

  /// 두 좌표 사이의 유클리드 거리를 원래 좌표계 단위로 반환합니다.
  ///
  /// 화면 좌표끼리 비교할 때는 픽셀, 투영 좌표끼리 비교할 때는 미터입니다.
  double distanceTo(Point other) =>
      math.sqrt(math.pow(other.x - x, 2) + math.pow(other.y - y, 2));

  /// Immutable equivalents of the SDK's mutable setters.
  Point withValue(double nextX, double nextY) => Point(nextX, nextY);

  /// [x]만 [value]로 바꾼 새로운 [Point]를 반환합니다.
  Point withX(double value) => Point(value, y);

  /// [y]만 [value]로 바꾼 새로운 [Point]를 반환합니다.
  Point withY(double value) => Point(x, value);

  /// Returns the translated position instead of mutating the current value.
  Point offset(double offsetX, double offsetY) =>
      Point(x + offsetX, y + offsetY);

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
  String toString() => '${x.toStringAsFixed(2)},${y.toStringAsFixed(2)}';
}
