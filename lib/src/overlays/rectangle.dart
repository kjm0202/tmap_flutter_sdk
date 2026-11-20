import 'package:flutter/material.dart';
import '../models/lat_lng_bounds.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// A rectangular overlay on a TMAP map.
class Rectangle extends BaseDraw {
  /// Unique rectangle identifier.
  final String rectangleId;

  /// Geographic bounds of the rectangle.
  final LatLngBounds bounds;

  /// Interior fill color.
  final Color? fillColor;

  /// Fill opacity, from 0.0 (transparent) to 1.0 (opaque).
  final double fillOpacity;

  /// Creates a Tmapv3 rectangle covering geographic [bounds].
  ///
  /// Defaults to a green fill and a two-pixel green outline.
  const Rectangle({
    required this.rectangleId,
    required this.bounds,
    this.fillColor = const Color(0x3300AA00),
    this.fillOpacity = 0.3,
    super.strokeColor = const Color(0xFF00AA00),
    super.strokeOpacity = 1.0,
    super.strokeWidth = 2,
    super.zIndex = 5,
  });

  /// Serializes the rectangle ID, WGS84 bounds and style for overlay change
  /// detection.
  ///
  /// Nullable colors are omitted; provided colors use CSS hex strings.
  Map<String, dynamic> toJson() {
    return {
      'rectangleId': rectangleId,
      'bounds': bounds.toJson(),
      if (fillColor != null) 'fillColor': fillColor?.toHexColor(),
      'fillOpacity': fillOpacity,
      if (strokeColor != null) 'strokeColor': strokeColor?.toHexColor(),
      'strokeOpacity': strokeOpacity,
      'strokeWidth': strokeWidth,
      'zIndex': zIndex,
    };
  }
}
