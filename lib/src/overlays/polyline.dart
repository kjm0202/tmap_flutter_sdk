import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'base_draw.dart';

/// TMAP 폴리라인(선) 오버레이 클래스입니다.
class Polyline extends BaseDraw {
  /// 폴리라인 고유 ID
  final String polylineId;

  /// 선을 구성하는 좌표 목록
  final List<LatLng> points;

  /// 방향 화살표 표시 여부
  final bool direction;

  const Polyline({
    required this.polylineId,
    required this.points,
    super.strokeColor = const Color(0xFF0066FF),
    super.strokeOpacity = 1.0,
    super.strokeWidth = 5,
    super.zIndex = 10,
    this.direction = false,
  });

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
