import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'marker_icon.dart';

const _keepMarkerValue = Object();

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

  /// SDK 컨텍스트 메뉴 설정. JSON으로 변환 가능한 옵션을 전달합니다.
  final Map<String, dynamic>? contextMenu;

  /// SDK `titleOption`에 전달되는 제목 스타일 설정.
  final Map<String, dynamic>? titleStyle;

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
    this.contextMenu,
    this.titleStyle,
  });

  /// 변경할 속성만 지정하여 새 마커 값을 만듭니다.
  ///
  /// 지도에 반영하려면 [TMapController.addMarker]에 반환 값을 전달합니다.
  Marker copyWith({
    LatLng? position,
    Object? icon = _keepMarkerValue,
    Object? color = _keepMarkerValue,
    Object? title = _keepMarkerValue,
    Object? label = _keepMarkerValue,
    Object? labelBackgroundColor = _keepMarkerValue,
    Object? labelTextColor = _keepMarkerValue,
    double? opacity,
    bool? visible,
    bool? draggable,
    int? zIndex,
    String? anchor,
    Object? contextMenu = _keepMarkerValue,
    Object? titleStyle = _keepMarkerValue,
  }) =>
      Marker(
        markerId: markerId,
        position: position ?? this.position,
        icon:
            identical(icon, _keepMarkerValue) ? this.icon : icon as MarkerIcon?,
        color:
            identical(color, _keepMarkerValue) ? this.color : color as Color?,
        title:
            identical(title, _keepMarkerValue) ? this.title : title as String?,
        label:
            identical(label, _keepMarkerValue) ? this.label : label as String?,
        labelBackgroundColor: identical(labelBackgroundColor, _keepMarkerValue)
            ? this.labelBackgroundColor
            : labelBackgroundColor as Color?,
        labelTextColor: identical(labelTextColor, _keepMarkerValue)
            ? this.labelTextColor
            : labelTextColor as Color?,
        opacity: opacity ?? this.opacity,
        visible: visible ?? this.visible,
        draggable: draggable ?? this.draggable,
        zIndex: zIndex ?? this.zIndex,
        anchor: anchor ?? this.anchor,
        contextMenu: identical(contextMenu, _keepMarkerValue)
            ? this.contextMenu
            : contextMenu as Map<String, dynamic>?,
        titleStyle: identical(titleStyle, _keepMarkerValue)
            ? this.titleStyle
            : titleStyle as Map<String, dynamic>?,
      );

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
      if (contextMenu != null) 'contextMenu': contextMenu,
      if (titleStyle != null) 'titleOption': titleStyle,
    };
  }
}
