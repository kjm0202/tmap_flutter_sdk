import 'package:flutter/material.dart';
import '../models/lat_lng.dart';
import '../utils/hex_color.dart';

const _keepLabelValue = Object();

/// A TMAP text label overlay.
class Label {
  /// Unique label identifier.
  final String labelId;

  /// Display position in WGS84 latitude and longitude.
  final LatLng position;

  /// Text displayed in the label.
  final String content;

  /// CSS font size (default: '14px').
  final String fontSize;

  /// Font color.
  final Color fontColor;

  /// Minimum zoom level at which the label is visible.
  final int? minLevel;

  /// Maximum zoom level at which the label is visible.
  final int? maxLevel;

  /// Creates a Tmapv3 text label at WGS84 [position].
  ///
  /// Defaults to black, 14-pixel text without a zoom visibility restriction.
  const Label({
    required this.labelId,
    required this.position,
    required this.content,
    this.fontSize = '14px',
    this.fontColor = Colors.black,
    this.minLevel,
    this.maxLevel,
  });

  /// Returns a label with updated properties and the same ID.
  ///
  /// Passing null for [minLevel] or [maxLevel] removes that zoom limit.
  Label copyWith({
    LatLng? position,
    String? content,
    String? fontSize,
    Color? fontColor,
    Object? minLevel = _keepLabelValue,
    Object? maxLevel = _keepLabelValue,
  }) =>
      Label(
        labelId: labelId,
        position: position ?? this.position,
        content: content ?? this.content,
        fontSize: fontSize ?? this.fontSize,
        fontColor: fontColor ?? this.fontColor,
        minLevel: identical(minLevel, _keepLabelValue)
            ? this.minLevel
            : minLevel as int?,
        maxLevel: identical(maxLevel, _keepLabelValue)
            ? this.maxLevel
            : maxLevel as int?,
      );

  /// Serializes the label ID, position, text and font style for overlay
  /// change detection.
  ///
  /// Includes minimum and maximum zoom levels only when specified.
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
