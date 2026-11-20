import 'package:flutter/material.dart';

import '../utils/hex_color.dart';

/// Style applied by the SDK to shapes drawn interactively on the map.
class DrawingOptions {
  /// Interior fill color, yellow by default.
  final Color fillColor;

  /// Interior opacity from 0 to 1, defaulting to 0.5.
  final double fillOpacity;

  /// Shape outline color, pink by default.
  final Color strokeColor;

  /// Outline opacity from 0 to 1, defaulting to 0.7.
  final double strokeOpacity;

  /// Nonnegative outline width in pixels, defaulting to 2.
  final int strokeWidth;

  /// Creates styling for shapes drawn through the Tmapv3 drawing extension.
  ///
  /// Asserts both opacities are between 0 and 1 and width is nonnegative.
  const DrawingOptions({
    this.fillColor = const Color(0xFFFFFF00),
    this.fillOpacity = 0.5,
    this.strokeColor = const Color(0xFFFFC0CB),
    this.strokeOpacity = 0.7,
    this.strokeWidth = 2,
  })  : assert(fillOpacity >= 0 && fillOpacity <= 1),
        assert(strokeOpacity >= 0 && strokeOpacity <= 1),
        assert(strokeWidth >= 0);

  /// Returns the SDK drawing-style JSON with CSS hex colors.
  ///
  /// Serializes [strokeWidth] under the SDK's `strokeWeight` key.
  Map<String, dynamic> toJson() => {
        'fillColor': fillColor.toHexColor(),
        'fillOpacity': fillOpacity,
        'strokeColor': strokeColor.toHexColor(),
        'strokeOpacity': strokeOpacity,
        'strokeWeight': strokeWidth,
      };
}
