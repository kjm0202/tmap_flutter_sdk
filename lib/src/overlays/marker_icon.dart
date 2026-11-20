import '../models/point.dart';
import '../models/size.dart';

/// Configuration for an image-based or HTML marker icon.
class MarkerIcon {
  /// Icon image URL or local web path.
  final String? iconUrl;

  /// Icon size in pixels (width, height).
  final Size? size;

  /// Icon anchor-point offset in pixels.
  final Point? offset;

  /// HTML markup for an icon, usable instead of [iconUrl].
  final String? iconHtml;

  /// Creates an optional image or HTML marker icon configuration.
  ///
  /// The [size] and [offset] describe pixel dimensions and offsets.
  const MarkerIcon({
    this.iconUrl,
    this.size,
    this.offset,
    this.iconHtml,
  });

  /// Returns supplied image URL, pixel size, offset, and HTML as JSON.
  ///
  /// Omits optional entries whose value is null.
  Map<String, dynamic> toJson() {
    return {
      if (iconUrl != null) 'iconUrl': iconUrl,
      if (size != null) 'size': size?.toJson(),
      if (offset != null) 'offset': offset?.toJson(),
      if (iconHtml != null) 'iconHtml': iconHtml,
    };
  }
}
