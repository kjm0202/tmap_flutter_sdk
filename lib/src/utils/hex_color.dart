import 'package:flutter/material.dart';

/// Flutter [Color] 확장 유틸리티
extension HexColorExtension on Color {
  /// Color를 CSS Hex 문자열 (`#RRGGBB` 또는 `#AARRGGBB`)로 변환합니다.
  String toHexColor({bool includeAlpha = false}) {
    final aHex = (a * 255).round().toRadixString(16).padLeft(2, '0');
    final rHex = (r * 255).round().toRadixString(16).padLeft(2, '0');
    final gHex = (g * 255).round().toRadixString(16).padLeft(2, '0');
    final bHex = (b * 255).round().toRadixString(16).padLeft(2, '0');

    if (includeAlpha) {
      return '#$aHex$rHex$gHex$bHex';
    }
    return '#$rHex$gHex$bHex';
  }
}
