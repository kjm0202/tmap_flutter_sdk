import 'dart:math' as math;

/// 2D 스크린 좌표(픽셀)를 나타내는 클래스입니다.
class Point {
  final double x;
  final double y;

  const Point(this.x, this.y);

  Point clone() => Point(x, y);

  double distanceTo(Point other) =>
      math.sqrt(math.pow(other.x - x, 2) + math.pow(other.y - y, 2));

  /// Immutable equivalents of the SDK's mutable setters.
  Point withValue(double nextX, double nextY) => Point(nextX, nextY);
  Point withX(double value) => Point(value, y);
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
