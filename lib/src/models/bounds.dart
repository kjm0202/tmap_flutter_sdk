import 'dart:math' as math;

import 'point.dart';
import 'size.dart';

/// Cartesian SDK bounds, kept separate from geographic [LatLngBounds].
///
/// The JS constructor actually stores (left, top, width, height), despite the
/// published constructor description naming its arguments left/bottom/right/top.
/// This value type follows the observed numeric SDK representation.
class Bounds {
  final double left;
  final double top;
  final double width;
  final double height;

  const Bounds(this.left, this.top, this.width, this.height);

  /// Builds the same rectangle from its four edges.
  const Bounds.fromEdges({
    required this.left,
    required double bottom,
    required double right,
    required this.top,
  })  : width = right - left,
        height = top - bottom;

  double get right => left + width;
  double get bottom => top - height;
  Point get position => Point(left, top);
  Size get size => Size(width, height);

  Bounds clone() => Bounds(left, top, width, height);

  /// Immutable equivalents of the SDK's setLeft/setTop/setWidth/setHeight.
  Bounds withLeft(double value) => Bounds(value, top, width, height);
  Bounds withTop(double value) => Bounds(left, value, width, height);
  Bounds withWidth(double value) => Bounds(left, top, value, height);
  Bounds withHeight(double value) => Bounds(left, top, width, value);

  /// Tests whether the entire Cartesian rectangle is contained.
  ///
  /// The current JS Bounds.contains implementation does not work with its
  /// documented Bounds argument. Dart supplies the documented operation.
  bool contains(Bounds other, {bool includeBoundary = true}) {
    if (includeBoundary) {
      return other.left >= left &&
          other.right <= right &&
          other.bottom >= bottom &&
          other.top <= top;
    }
    return other.left > left &&
        other.right < right &&
        other.bottom > bottom &&
        other.top < top;
  }

  /// Returns whether this rectangle contains a screen-space point.
  bool containsPoint(Point other, {bool includeBoundary = true}) {
    if (includeBoundary) {
      return other.x >= left &&
          other.x <= right &&
          other.y >= bottom &&
          other.y <= top;
    }
    return other.x > left &&
        other.x < right &&
        other.y > bottom &&
        other.y < top;
  }

  /// Cartesian overlap matching the official SDK's intersects method.
  ///
  /// That method treats top as the origin of a positive-height Y interval.
  /// Its optional boundary flag in the docs is ignored by the SDK.
  bool intersects(Bounds other) =>
      right >= other.left &&
      left <= other.right &&
      top + height >= other.top &&
      top <= other.top + other.height;

  /// An immutable equivalent of the SDK's mutating union.
  Bounds union(Bounds other) {
    final minLeft = math.min(left, other.left);
    final minTop = math.min(top, other.top);
    return Bounds(
      minLeft,
      minTop,
      math.max(right, other.right) - minLeft,
      math.max(top + height, other.top + other.height) - minTop,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Bounds &&
          left == other.left &&
          top == other.top &&
          width == other.width &&
          height == other.height;

  @override
  int get hashCode => Object.hash(left, top, width, height);

  @override
  String toString() => '${left.toStringAsFixed(2)},${top.toStringAsFixed(2)},'
      '${width.toStringAsFixed(2)},${height.toStringAsFixed(2)}';
}
