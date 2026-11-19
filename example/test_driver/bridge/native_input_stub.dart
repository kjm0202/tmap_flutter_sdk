import 'dart:async';

/// Whether native iOS touch input driving is active.
///
/// Always `false` on web and non-io platforms.
bool get useNativeInput => false;

Future<String> prepareNativeDrag(
        double x, double y, double endX, double endY) async =>
    throw StateError('Native input driver unavailable');

Future<void> fireNativeDrag(String id) async =>
    throw StateError('Native input driver unavailable');

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
