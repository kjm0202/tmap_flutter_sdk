import 'package:flutter/material.dart';

/// 지도 오버레이(도형) 공통 기본 속성을 정의하는 추상 클래스입니다.
abstract class BaseDraw {
  /// 테두리/선 색상
  final Color? strokeColor;

  /// 선 투명도 (0.0 ~ 1.0)
  final double strokeOpacity;

  /// 선 두께 (픽셀)
  final int strokeWidth;

  /// z-index 순서
  final int zIndex;

  const BaseDraw({
    this.strokeColor,
    this.strokeOpacity = 1.0,
    this.strokeWidth = 3,
    this.zIndex = 0,
  });
}
