import 'dart:math' as math;

import 'point.dart';
import 'size.dart';

/// Cartesian SDK bounds, kept separate from geographic [LatLngBounds].
///
/// The JS constructor actually stores (left, top, width, height), despite the
/// published description naming its arguments left/bottom/right/top.
/// This value type follows the observed numeric SDK representation.
class Bounds {
  /// Left (minimum X) edge.
  final double left;

  /// Top (maximum Y) edge.
  final double top;

  /// Horizontal distance from [left] to [right].
  final double width;

  /// Vertical distance from [bottom] to [top].
  final double height;

  /// Creates a rectangle from its left and top edges, width and height.
  ///
  /// This matches the SDK's stored (left, top, width, height) values. The
  /// exposed bottom edge is [top] minus [height].
  const Bounds(this.left, this.top, this.width, this.height);

  /// Creates a rectangle from its left, bottom, right and top edges.
  const Bounds.fromEdges({
    required this.left,
    required double bottom,
    required double right,
    required this.top,
  })  : width = right - left,
        height = top - bottom;

  /// Right (maximum X) edge.
  double get right => left + width;

  /// Bottom (minimum Y) edge.
  double get bottom => top - height;

  /// Top-left corner of the rectangle.
  Point get position => Point(left, top);

  /// Rectangle dimensions.
  Size get size => Size(width, height);

  /// Returns an independent copy of this immutable rectangle.
  Bounds clone() => Bounds(left, top, width, height);

  /// Returns a copy with a different [left] edge and the same dimensions.
  Bounds withLeft(double value) => Bounds(value, top, width, height);

  /// Returns a copy with a different [top] edge and the same dimensions.
  Bounds withTop(double value) => Bounds(left, value, width, height);

  /// Returns a copy with a different [width].
  Bounds withWidth(double value) => Bounds(left, top, value, height);

  /// Returns a copy with a different [height].
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

  /// Tests whether the rectangles overlap using their exposed edges.
  ///
  /// Edge-only contact counts when [includeBoundary] is true. The SDK
  /// mistakenly uses top + height for its bottom-edge calculation and ignores
  /// the boundary flag; Dart follows the documented rectangle geometry.
  bool intersects(Bounds other, {bool includeBoundary = true}) {
    if (includeBoundary) {
      return right >= other.left &&
          left <= other.right &&
          top >= other.bottom &&
          bottom <= other.top;
    }
    return right > other.left &&
        left < other.right &&
        top > other.bottom &&
        bottom < other.top;
  }

  /// Returns the smallest rectangle enclosing both operands.
  ///
  /// The SDK's mutating union uses an inverted bottom edge; Dart keeps the
  /// documented edge convention and returns a new value.
  Bounds union(Bounds other) {
    final minLeft = math.min(left, other.left);
    final maxTop = math.max(top, other.top);
    return Bounds(
      minLeft,
      maxTop,
      math.max(right, other.right) - minLeft,
      maxTop - math.min(bottom, other.bottom),
    );
  }

  /// Tests equality of [left], [top], [width], and [height].
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Bounds &&
          left == other.left &&
          top == other.top &&
          width == other.width &&
          height == other.height;

  /// Hash code derived from the four rectangle dimensions.
  @override
  int get hashCode => Object.hash(left, top, width, height);

  /// Formats the four rectangle coordinates to two decimal places.
  @override
  String toString() => '${left.toStringAsFixed(2)},${top.toStringAsFixed(2)},'
      '${width.toStringAsFixed(2)},${height.toStringAsFixed(2)}';
}
