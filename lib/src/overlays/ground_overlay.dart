import '../models/lat_lng_bounds.dart';

/// An image anchored to geographic bounds on the TMAP vector map.
class GroundOverlay {
  final String groundOverlayId;
  final String url;
  final LatLngBounds bounds;
  final double opacity;

  const GroundOverlay({
    required this.groundOverlayId,
    required this.url,
    required this.bounds,
    this.opacity = 1.0,
  }) : assert(opacity >= 0 && opacity <= 1);

  Map<String, dynamic> toJson() => {
        'id': groundOverlayId,
        'url': url,
        'bounds': bounds.toJson(),
        'opacity': opacity,
      };
}
