import '../models/lat_lng_bounds.dart';

/// Returns changed, nonempty bounds to apply after map initialization.
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
