import '../constants/zoom_type.dart';

/// Converts a bridge zoom phase to [ZoomType], or returns null if unsupported.
ZoomType? zoomTypeFromPhase(String? phase) {
  switch (phase) {
    case 'start':
      return ZoomType.start;
    case 'end':
      return ZoomType.end;
    default:
      return null;
  }
}
