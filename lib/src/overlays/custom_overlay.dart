import '../models/lat_lng.dart';
import '../models/point.dart';

/// A TMAP custom overlay rendered from HTML content.
class CustomOverlay {
  /// Unique custom overlay identifier.
  final String customOverlayId;

  /// Display position in WGS84 latitude and longitude.
  final LatLng position;

  /// HTML markup rendered by the overlay.
  final String content;

  /// Screen-space offset in pixels.
  final Point? offset;

  /// Drawing order (z-index).
  final int zIndex;

  /// Creates an HTML overlay at WGS84 [position] with the given [content].
  ///
  /// The optional [offset] is measured in map-screen pixels.
  const CustomOverlay({
    required this.customOverlayId,
    required this.position,
    required this.content,
    this.offset,
    this.zIndex = 100,
  });

  /// Serializes the custom overlay ID, position, HTML content and optional
  /// offset for overlay change detection.
  ///
  /// Includes the pixel offset only when [offset] is non-null.
  Map<String, dynamic> toJson() {
    return {
      'customOverlayId': customOverlayId,
      'position': position.toJson(),
      'content': content,
      if (offset != null) 'offset': offset?.toJson(),
      'zIndex': zIndex,
    };
  }
}
