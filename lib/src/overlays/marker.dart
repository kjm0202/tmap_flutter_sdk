import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';
import 'marker_icon.dart';

const _keepMarkerValue = Object();

/// A marker displayed on a TMAP map.
class Marker {
  /// Unique marker identifier.
  final String markerId;

  /// Marker position in WGS84 latitude and longitude.
  final LatLng position;

  /// Optional marker icon configuration.
  final MarkerIcon? icon;

  /// Marker color, used as the pin color when [icon] is absent.
  final Color? color;

  /// Marker tooltip title.
  final String? title;

  /// Text displayed in the marker label.
  final String? label;

  /// Marker label background color.
  final Color? labelBackgroundColor;

  /// Marker label text color.
  final Color? labelTextColor;

  /// Marker opacity, from 0.0 (transparent) to 1.0 (opaque).
  final double opacity;

  /// Marker visibility flag.
  final bool visible;

  /// Marker draggability flag.
  final bool draggable;

  /// Display order (z-index).
  final int zIndex;

  /// Icon anchor position, e.g., 'top-left', 'center', or 'bottom'.
  final String anchor;

  /// SDK context-menu options supplied as a JSON-encodable map.
  final Map<String, dynamic>? contextMenu;

  /// Title style options passed to the SDK's `titleOption` property.
  final Map<String, dynamic>? titleStyle;

  /// Creates a Tmapv3 marker at WGS84 [position] with identifier [markerId].
  ///
  /// Defaults to visible, not draggable, and anchored at the bottom.
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

  /// Returns a marker with selected properties updated and the same ID.
  ///
  /// Pass the result to [TMapController.addMarker] to update the map.
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

  /// Returns the marker bridge payload with coordinates and display options.
  ///
  /// Omits nullable properties when absent, converts colors to CSS hex,
  /// and serializes [titleStyle] under the `titleOption` key.
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
