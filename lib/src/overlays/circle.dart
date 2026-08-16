import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// TMAP 원(Circle) 오버레이 클래스입니다.
class Circle extends BaseDraw {
  /// 원 고유 ID
  final String circleId;

  /// 중심 좌표
  final LatLng center;

  /// 반경 (미터 단위)
  final double radius;

  /// 내부 채우기 색상
  final Color? fillColor;

  /// 내부 채우기 투명도 (0.0 ~ 1.0)
  final double fillOpacity;

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
