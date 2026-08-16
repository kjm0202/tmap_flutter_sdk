import 'package:flutter/material.dart';
import '../models/lat_lng_bounds.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// TMAP 사각형(Rectangle) 오버레이 클래스입니다.
class Rectangle extends BaseDraw {
  /// 사각형 고유 ID
  final String rectangleId;

  /// 사각형 경계 영역
  final LatLngBounds bounds;

  /// 내부 채우기 색상
  final Color? fillColor;

  /// 내부 채우기 투명도 (0.0 ~ 1.0)
  final double fillOpacity;

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
