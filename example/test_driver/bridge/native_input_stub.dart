import 'dart:async';

/// Whether native iOS touch input driving is active.
///
/// Always `false` on web and non-io platforms.
bool get useNativeInput => false;

/// No-op stub for platforms where native iOS touch input driver is not available.
Future<void> driveNativeInput(
  String action,
  double x,
  double y, {
  double? endX,
  double? endY,
}) async {
  // No-op on non-io / web platforms.
}
