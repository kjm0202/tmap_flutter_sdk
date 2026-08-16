import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// TMAP 다각형(Polygon) 오버레이 클래스입니다.
class Polygon extends BaseDraw {
  /// 다각형 고유 ID
  final String polygonId;

  /// 꼭짓점 좌표 목록
  final List<LatLng> points;

  /// 내부 채우기 색상
  final Color? fillColor;

  /// 내부 채우기 투명도 (0.0 ~ 1.0)
  final double fillOpacity;

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
