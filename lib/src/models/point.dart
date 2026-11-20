import 'dart:math' as math;

/// A two-dimensional point in pixels on screen or metres when projected.
class Point {
  /// Horizontal coordinate in the point's native units.
  final double x;

  /// Vertical coordinate in the point's native units.
  final double y;

  /// Creates a Cartesian point from its horizontal and vertical coordinates.
  const Point(this.x, this.y);

  /// Creates a new [Point] with the same coordinates.
  Point clone() => Point(x, y);

  /// Calculates Euclidean distance to [other] in the native coordinate units.
  ///
  /// Screen positions use pixels; projected coordinates use metres.
  double distanceTo(Point other) =>
      math.sqrt(math.pow(other.x - x, 2) + math.pow(other.y - y, 2));

  /// Returns a new [Point] with [x] and [y] set to [nextX] and [nextY].
  ///
  /// Unlike the SDK's mutable setters, the original point is unchanged.
  Point withValue(double nextX, double nextY) => Point(nextX, nextY);

  /// Returns a new [Point] with [x] replaced by [value].
  Point withX(double value) => Point(value, y);

  /// Returns a new [Point] with [y] replaced by [value].
  Point withY(double value) => Point(x, value);

  /// Returns the translated position instead of mutating the current value.
  Point offset(double offsetX, double offsetY) =>
      Point(x + offsetX, y + offsetY);

  /// Parses a point with numeric `x` and `y` properties.
  ///
  /// Missing values default to zero; units depend on the coordinate system.
  factory Point.fromJson(Map<String, dynamic> json) {
    return Point(
      (json['x'] as num? ?? 0.0).toDouble(),
      (json['y'] as num? ?? 0.0).toDouble(),
    );
  }

  /// Returns a map with numeric `x` and `y` properties.
  Map<String, dynamic> toJson() => {'x': x, 'y': y};

  /// Tests equality of both coordinates for points of the same runtime type.
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Point &&
          runtimeType == other.runtimeType &&
          x == other.x &&
          y == other.y;

  /// Hash code derived from [x] and [y].
  @override
  int get hashCode => x.hashCode ^ y.hashCode;

  /// Formats the coordinates in `x,y` order with two decimal places.
  @override
  String toString() => '${x.toStringAsFixed(2)},${y.toStringAsFixed(2)}';
}
