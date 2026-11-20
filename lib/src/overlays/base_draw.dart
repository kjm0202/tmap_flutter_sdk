import 'package:flutter/material.dart';

/// Common styling properties for drawable map overlays.
abstract class BaseDraw {
  /// Outline or stroke color.
  final Color? strokeColor;

  /// Stroke opacity, from 0.0 (transparent) to 1.0 (opaque).
  final double strokeOpacity;

  /// Stroke width in pixels.
  final int strokeWidth;

  /// Drawing order (z-index).
  final int zIndex;

  /// Initializes common shape styling for Tmapv3 drawing overlays.
  ///
  /// Defaults to full stroke opacity, a three-pixel line, and z-index zero.
  const BaseDraw({
    this.strokeColor,
    this.strokeOpacity = 1.0,
    this.strokeWidth = 3,
    this.zIndex = 0,
  });
}
