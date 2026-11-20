import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// A polyline overlay on a TMAP map.
class Polyline extends BaseDraw {
  /// Unique polyline identifier.
  final String polylineId;

  /// Ordered line coordinates in WGS84 latitude and longitude.
  final List<LatLng> points;

  /// Visibility flag for arrows indicating line direction.
  final bool direction;

  /// Creates a Tmapv3 line through the ordered WGS84 [points].
  ///
  /// Defaults to a blue five-pixel line without direction arrows.
  const Polyline({
    required this.polylineId,
    required this.points,
    super.strokeColor = const Color(0xFF0066FF),
    super.strokeOpacity = 1.0,
    super.strokeWidth = 5,
    super.zIndex = 10,
    this.direction = false,
  });

  /// Serializes the polyline ID, points and stroke style for overlay change
  /// detection.
  ///
  /// The `direction` flag controls direction-arrow display.
  Map<String, dynamic> toJson() {
    return {
      'polylineId': polylineId,
      'points': points.map((e) => e.toJson()).toList(),
      if (strokeColor != null) 'strokeColor': strokeColor?.toHexColor(),
      'strokeOpacity': strokeOpacity,
      'strokeWidth': strokeWidth,
      'zIndex': zIndex,
      'direction': direction,
    };
  }
}
