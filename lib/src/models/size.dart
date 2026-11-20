/// A two-dimensional size with width and height.
class Size {
  /// Horizontal extent in the size's native units, typically pixels.
  final double width;

  /// Vertical extent in the size's native units, typically pixels.
  final double height;

  /// Creates a two-dimensional size from [width] and [height].
  const Size(this.width, this.height);

  /// Parses numeric `width`/`height` or `w`/`h` properties.
  ///
  /// Missing dimensions default to zero.
  factory Size.fromJson(Map<String, dynamic> json) {
    return Size(
      (json['width'] as num? ?? json['w'] as num? ?? 0.0).toDouble(),
      (json['height'] as num? ?? json['h'] as num? ?? 0.0).toDouble(),
    );
  }

  /// Returns a map containing numeric `width` and `height` properties.
  Map<String, dynamic> toJson() => {'width': width, 'height': height};

  /// Tests equality of both dimensions for sizes of the same runtime type.
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Size &&
          runtimeType == other.runtimeType &&
          width == other.width &&
          height == other.height;

  /// Hash code derived from [width] and [height].
  @override
  int get hashCode => width.hashCode ^ height.hashCode;

  /// Formats the dimensions as `Size(width, height)`.
  @override
  String toString() => 'Size($width, $height)';
}
