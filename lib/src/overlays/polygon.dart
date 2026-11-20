import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// A polygon overlay on a TMAP map.
class Polygon extends BaseDraw {
  /// Unique polygon identifier.
  final String polygonId;

  /// Ordered polygon vertices in WGS84 latitude and longitude.
  final List<LatLng> points;

  /// Interior fill color.
  final Color? fillColor;

  /// Fill opacity, from 0.0 (transparent) to 1.0 (opaque).
  final double fillOpacity;

  /// Creates a Tmapv3 polygon using ordered WGS84 [points].
  ///
  /// Defaults to a blue fill and a two-pixel blue outline.
  const Polygon({
    required this.polygonId,
    required this.points,
    this.fillColor = const Color(0x330066FF),
    this.fillOpacity = 0.4,
    super.strokeColor = const Color(0xFF0066FF),
    super.strokeOpacity = 1.0,
    super.strokeWidth = 2,
    super.zIndex = 5,
  });

  /// Serializes the polygon ID, points and style for overlay change detection.
  ///
  /// Encodes points as latitude/longitude objects and colors as CSS hex.
  Map<String, dynamic> toJson() {
    return {
      'polygonId': polygonId,
      'points': points.map((e) => e.toJson()).toList(),
      if (fillColor != null) 'fillColor': fillColor?.toHexColor(),
      'fillOpacity': fillOpacity,
      if (strokeColor != null) 'strokeColor': strokeColor?.toHexColor(),
      'strokeOpacity': strokeOpacity,
      'strokeWidth': strokeWidth,
      'zIndex': zIndex,
    };
  }
}
