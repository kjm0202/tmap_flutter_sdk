import 'dart:math' as math;

import 'lat_lng.dart';

/// A geographic bounding rectangle on a TMAP map.
class LatLngBounds {
  /// Southwest corner.
  final LatLng southWest;

  /// Northeast corner.
  final LatLng northEast;
  final bool _explicitlyEmpty;

  /// Creates a nonempty geographic bounds from its two corner coordinates.
  const LatLngBounds({
    required this.southWest,
    required this.northEast,
  }) : _explicitlyEmpty = false;

  /// Creates an initially empty geographic bounding rectangle.
  const LatLngBounds.empty()
      : southWest = const LatLng(0, 0),
        northEast = const LatLng(0, 0),
        _explicitlyEmpty = true;

  /// Southwest corner after normalizing both coordinate axes.
  LatLng get normalizedSouthWest => LatLng(
        math.min(southWest.latitude, northEast.latitude),
        math.min(southWest.longitude, northEast.longitude),
      );

  /// Northeast corner after taking the maximum on each coordinate axis.
  LatLng get normalizedNorthEast => LatLng(
        math.max(southWest.latitude, northEast.latitude),
        math.max(southWest.longitude, northEast.longitude),
      );

  /// Northwest corner after normalizing both coordinate axes.
  LatLng get northWest =>
      LatLng(normalizedNorthEast.latitude, normalizedSouthWest.longitude);

  /// Southeast corner after normalizing both coordinate axes.
  LatLng get southEast =>
      LatLng(normalizedSouthWest.latitude, normalizedNorthEast.longitude);

  /// Distance along the north edge in metres, not degrees.
  double get width => isEmpty ? 0 : normalizedNorthEast.distanceTo(northWest);

  /// Distance along the west edge in metres, not degrees.
  double get height => isEmpty ? 0 : northWest.distanceTo(normalizedSouthWest);

  /// Whether the bounds were created by [LatLngBounds.empty] and remain empty.
  ///
  /// Ordinary bounds containing just the point (0, 0) are not empty.
  bool get isEmpty => _explicitlyEmpty;

  /// Returns a new envelope that includes [coordinate].
  LatLngBounds extend(LatLng coordinate) {
    if (isEmpty) {
      return LatLngBounds(southWest: coordinate, northEast: coordinate);
    }
    final sw = normalizedSouthWest;
    final ne = normalizedNorthEast;
    return LatLngBounds(
      southWest: LatLng(
        math.min(sw.latitude, coordinate.latitude),
        math.min(sw.longitude, coordinate.longitude),
      ),
      northEast: LatLng(
        math.max(ne.latitude, coordinate.latitude),
        math.max(ne.longitude, coordinate.longitude),
      ),
    );
  }

  /// Returns the union of these bounds with [other] without mutation.
  LatLngBounds union(LatLngBounds other) => other.isEmpty
      ? this
      : extend(other.normalizedSouthWest).extend(other.normalizedNorthEast);

  /// Reports overlap including shared edges, returning false on non-overlap.
  ///
  /// The JavaScript SDK yields null for non-overlapping bounds.
  bool intersects(LatLngBounds other) {
    if (isEmpty || other.isEmpty) return false;
    final a = normalizedSouthWest;
    final b = normalizedNorthEast;
    final c = other.normalizedSouthWest;
    final d = other.normalizedNorthEast;
    return a.latitude <= d.latitude &&
        b.latitude >= c.latitude &&
        a.longitude <= d.longitude &&
        b.longitude >= c.longitude;
  }

  /// Parses bounds from `southWest`/`northEast` or `_sw`/`_ne` maps.
  ///
  /// An `empty: true` flag produces [LatLngBounds.empty].
  /// Missing corners fall back to coordinates of zero.
  factory LatLngBounds.fromJson(Map<String, dynamic> json) {
    if (json['empty'] == true) return const LatLngBounds.empty();
    final swJson = json['southWest'] as Map<String, dynamic>? ??
        json['_sw'] as Map<String, dynamic>? ??
        <String, dynamic>{};
    final neJson = json['northEast'] as Map<String, dynamic>? ??
        json['_ne'] as Map<String, dynamic>? ??
        <String, dynamic>{};

    return LatLngBounds(
      southWest: LatLng.fromJson(swJson),
      northEast: LatLng.fromJson(neJson),
    );
  }

  /// Returns an `empty: true` map or a pair of geographic corner maps.
  ///
  /// Nonempty bounds preserve the original [southWest] and [northEast].
  Map<String, dynamic> toJson() {
    if (isEmpty) return {'empty': true};
    return {
      'southWest': southWest.toJson(),
      'northEast': northEast.toJson(),
    };
  }

  /// Center of the normalized bounds.
  LatLng get center => LatLng(
        (normalizedSouthWest.latitude + normalizedNorthEast.latitude) / 2,
        (normalizedSouthWest.longitude + normalizedNorthEast.longitude) / 2,
      );

  /// Checks whether [point] lies within the bounds, including their edges.
  bool contains(LatLng point) {
    if (isEmpty) return false;
    final sw = normalizedSouthWest;
    final ne = normalizedNorthEast;
    final latContained =
        point.latitude >= sw.latitude && point.latitude <= ne.latitude;
    final lngContained =
        point.longitude >= sw.longitude && point.longitude <= ne.longitude;
    return latContained && lngContained;
  }

  /// Tests equality using normalized corners or both empty states.
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LatLngBounds &&
          isEmpty == other.isEmpty &&
          (isEmpty ||
              (normalizedSouthWest == other.normalizedSouthWest &&
                  normalizedNorthEast == other.normalizedNorthEast));

  /// Hash code of normalized bounds, or zero for explicitly empty bounds.
  @override
  int get hashCode =>
      isEmpty ? 0 : Object.hash(normalizedSouthWest, normalizedNorthEast);

  /// Corner coordinates separated by a colon, or `null:null` when empty.
  @override
  String toString() =>
      isEmpty ? 'null:null' : '$normalizedSouthWest:$normalizedNorthEast';
}
