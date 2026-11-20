import '../models/lat_lng_bounds.dart';

/// Returns bounds updated while the map was initializing, if they can be applied.
LatLngBounds? boundsToApplyOnReady(
  LatLngBounds? boundsAtCreation,
  LatLngBounds? currentBounds,
) {
  if (currentBounds == null ||
      currentBounds.isEmpty ||
      currentBounds == boundsAtCreation) {
    return null;
  }
  return currentBounds;
}
