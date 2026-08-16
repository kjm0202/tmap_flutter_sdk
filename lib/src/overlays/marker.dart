import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'marker_icon.dart';

/// TMAP 지도 위에 표출되는 마커 클래스입니다.
class Marker {
  /// 마커 고유 ID
  final String markerId;

  /// 마커의 위경도 좌표
  final LatLng position;

  /// 마커 아이콘 설정
  final MarkerIcon? icon;

  /// 마커 배경 색상 (icon이 없을 경우 핀 색상)
  final Color? color;

  /// 마커 툴팁 제목
  final String? title;

  /// 마커 라벨 텍스트
  final String? label;

  /// 라벨 배경 색상
  final Color? labelBackgroundColor;

  /// 라벨 글자 색상
  final Color? labelTextColor;

  /// 마커 투명도 (0.0 ~ 1.0)
  final double opacity;

  /// 표시 여부
  final bool visible;

  /// 드래그 가능 여부
  final bool draggable;

  /// z-index 순서
  final int zIndex;

  /// 앵커 위치 ('top-left', 'center', 'bottom', 등)
  final String anchor;

  const Marker({
    required this.markerId,
    required this.position,
    this.icon,
    this.color,
    this.title,
    this.label,
    this.labelBackgroundColor,
    this.labelTextColor,
    this.opacity = 1.0,
    this.visible = true,
    this.draggable = false,
    this.zIndex = 100,
    this.anchor = 'bottom',
  });

  Map<String, dynamic> toJson() {
    return {
      'markerId': markerId,
      'position': position.toJson(),
      if (icon != null) 'icon': icon?.toJson(),
      if (color != null) 'color': color?.toHexColor(),
      if (title != null) 'title': title,
      if (label != null) 'label': label,
      if (labelBackgroundColor != null)
        'labelBackgroundColor': labelBackgroundColor?.toHexColor(),
      if (labelTextColor != null)
        'labelTextColor': labelTextColor?.toHexColor(),
      'opacity': opacity,
      'visible': visible,
      'draggable': draggable,
      'zIndex': zIndex,
      'anchor': anchor,
    };
  }
}
