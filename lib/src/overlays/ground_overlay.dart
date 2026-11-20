import '../models/lat_lng_bounds.dart';

/// An image anchored to geographic bounds on the TMAP vector map.
class GroundOverlay {
  /// Identifier used to replace or remove this image overlay.
  final String groundOverlayId;

  /// URL of the image rendered over the map.
  final String url;

  /// Geographic southwest and northeast image corners in WGS84.
  final LatLngBounds bounds;

  /// Image opacity from 0 (transparent) to 1 (opaque).
  final double opacity;

  /// Creates a Tmapv3 ground image with full opacity by default.
  ///
  /// Asserts that [opacity] is within the inclusive range 0 to 1.
  const GroundOverlay({
    required this.groundOverlayId,
    required this.url,
    required this.bounds,
    this.opacity = 1.0,
  }) : assert(opacity >= 0 && opacity <= 1);

  /// Returns an image-overlay bridge payload with ID, URL, bounds, and opacity.
  ///
  /// The ID is encoded under the `id` key.
  Map<String, dynamic> toJson() => {
        'id': groundOverlayId,
        'url': url,
        'bounds': bounds.toJson(),
        'opacity': opacity,
      };
}
