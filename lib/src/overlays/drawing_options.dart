import 'package:flutter/material.dart';

import '../utils/hex_color.dart';

/// Style applied by the SDK to shapes drawn interactively on the map.
class DrawingOptions {
  final Color fillColor;
  final double fillOpacity;
  final Color strokeColor;
  final double strokeOpacity;
  final int strokeWidth;

  const DrawingOptions({
    this.fillColor = const Color(0xFFFFFF00),
    this.fillOpacity = 0.5,
    this.strokeColor = const Color(0xFFFFC0CB),
    this.strokeOpacity = 0.7,
    this.strokeWidth = 2,
  })  : assert(fillOpacity >= 0 && fillOpacity <= 1),
        assert(strokeOpacity >= 0 && strokeOpacity <= 1),
        assert(strokeWidth >= 0);

  Map<String, dynamic> toJson() => {
        'fillColor': fillColor.toHexColor(),
        'fillOpacity': fillOpacity,
        'strokeColor': strokeColor.toHexColor(),
        'strokeOpacity': strokeOpacity,
        'strokeWeight': strokeWidth,
      };
}
