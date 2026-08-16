import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';

/// TMAP 텍스트 라벨 오버레이 클래스입니다.
class Label {
  /// 라벨 고유 ID
  final String labelId;

  /// 표출 위경도 좌표
  final LatLng position;

  /// 라벨 텍스트 내용
  final String content;

  /// 폰트 크기 CSS (기본: '14px')
  final String fontSize;

  /// 폰트 색상
  final Color fontColor;

  /// 최소 표출 줌 레벨
  final int? minLevel;

  /// 최대 표출 줌 레벨
  final int? maxLevel;

  const Label({
    required this.labelId,
    required this.position,
    required this.content,
    this.fontSize = '14px',
    this.fontColor = Colors.black,
    this.minLevel,
    this.maxLevel,
  });

  Map<String, dynamic> toJson() {
    return {
      'labelId': labelId,
      'position': position.toJson(),
      'content': content,
      'fontSize': fontSize,
      'fontColor': fontColor.toHexColor(),
      if (minLevel != null) 'minLevel': minLevel,
      if (maxLevel != null) 'maxLevel': maxLevel,
    };
  }
}
