import 'package:flutter/material.dart';

/// Hexadecimal color string conversion for Flutter [Color].
extension HexColorExtension on Color {
  /// Converts a color to a `#RRGGBB` CSS hex string, or to an `#AARRGGBB`
  /// ARGB hex string when [includeAlpha] is true.
  ///
  /// The alpha-first form is not CSS notation: CSS reads 8-digit hex colors
  /// as `#RRGGBBAA`.
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
