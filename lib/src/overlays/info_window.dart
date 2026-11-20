import '../models/lat_lng.dart';
import '../models/point.dart';

const _keepInfoValue = Object();

/// An HTML info window displayed on a TMAP map.
class InfoWindow {
  /// Unique info window identifier.
  final String infoWindowId;

  /// Display position in WGS84 latitude and longitude.
  final LatLng position;

  /// Info window content as an HTML string.
  final String content;

  /// Window shape (1: speech bubble, 2: rectangle).
  final int type;

  /// CSS border style passed to the SDK (e.g., '1px solid #ff0000').
  final String? border;

  /// Screen-space offset in pixels.
  final Point? offset;

  /// Anchor position, e.g., 'top', 'bottom', 'left', or 'auto-top'.
  final String anchor;

  /// Info window visibility flag.
  final bool visible;

  /// Creates a Tmapv3 HTML info window at WGS84 [position].
  ///
  /// Defaults to type 2, bottom anchor, and visible; [offset] uses pixels.
  const InfoWindow({
    required this.infoWindowId,
    required this.position,
    required this.content,
    this.type = 2,
    this.border,
    this.offset,
    this.anchor = 'bottom',
    this.visible = true,
  });

  /// Returns an info window with updated properties and the same ID.
  ///
  /// Passing null for [border] or [offset] clears that property.
  InfoWindow copyWith({
    LatLng? position,
    String? content,
    int? type,
    Object? border = _keepInfoValue,
    Object? offset = _keepInfoValue,
    String? anchor,
    bool? visible,
  }) =>
      InfoWindow(
        infoWindowId: infoWindowId,
        position: position ?? this.position,
        content: content ?? this.content,
        type: type ?? this.type,
        border:
            identical(border, _keepInfoValue) ? this.border : border as String?,
        offset:
            identical(offset, _keepInfoValue) ? this.offset : offset as Point?,
        anchor: anchor ?? this.anchor,
        visible: visible ?? this.visible,
      );

  /// Serializes the info window ID, position and HTML content for overlay
  /// change detection.
  ///
  /// Includes CSS [border] and pixel [offset] only when non-null.
  Map<String, dynamic> toJson() {
    return {
      'infoWindowId': infoWindowId,
      'position': position.toJson(),
      'content': content,
      'type': type,
      if (border != null) 'border': border,
      if (offset != null) 'offset': offset?.toJson(),
      'anchor': anchor,
      'visible': visible,
    };
  }
}
