import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// A circular TMAP map overlay.
class Circle extends BaseDraw {
  /// Unique circle identifier.
  final String circleId;

  /// Center coordinate in WGS84 latitude and longitude.
  final LatLng center;

  /// Circle radius in meters.
  final double radius;

  /// Interior fill color.
  final Color? fillColor;

  /// Fill opacity, from 0.0 (transparent) to 1.0 (opaque).
  final double fillOpacity;

  /// Creates a Tmapv3 circle around [center] with [radius] in meters.
  ///
  /// Uses a red stroke and fill by default, with a two-pixel stroke.
  const Circle({
    required this.circleId,
    required this.center,
    required this.radius,
    this.fillColor = const Color(0x33FF0000),
    this.fillOpacity = 0.3,
    super.strokeColor = const Color(0xFFFF0000),
    super.strokeOpacity = 1.0,
    super.strokeWidth = 2,
    super.zIndex = 5,
  });

  /// Serializes the circle ID, center, radius in meters and style for overlay
  /// change detection.
  ///
  /// Colors use CSS hex strings; nullable colors are omitted when absent.
  Map<String, dynamic> toJson() {
    return {
      'circleId': circleId,
      'center': center.toJson(),
      'radius': radius,
      if (fillColor != null) 'fillColor': fillColor?.toHexColor(),
      'fillOpacity': fillOpacity,
      if (strokeColor != null) 'strokeColor': strokeColor?.toHexColor(),
      'strokeOpacity': strokeOpacity,
      'strokeWidth': strokeWidth,
      'zIndex': zIndex,
    };
  }
}
