import 'package:flutter/material.dart';

/// CSS hexadecimal color conversion utilities for Flutter [Color].
extension HexColorExtension on Color {
  /// Converts a color to `#RRGGBB` or `#AARRGGBB` CSS hexadecimal notation.
  ///
  /// The alpha byte is included before RGB when [includeAlpha] is true.
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
