import 'marker.dart';

/// A TMAP marker clusterer for large marker collections.
class Clusterer {
  /// Markers to group into clusters.
  final List<Marker> markers;

  /// Highest zoom level for clustering (default: 19).
  final int maxClusterZoom;

  /// Minimum markers per cluster (default: 2).
  final int minClusterCount;

  /// Cluster grid size in pixels (default: 80).
  final int gridSize;

  /// Clusterer visibility flag.
  final bool visible;

  /// Cluster opacity.
  final double opacity;

  /// SDK-specific cluster icon definitions.
  final List<Map<String, dynamic>>? icons;

  /// Display order (z-index) of the cluster group.
  final int? zIndex;

  /// Configures Tmapv3 marker clustering for [markers].
  ///
  /// The default grid is 80 pixels, the minimum cluster count is two,
  /// and clustering stops above zoom level 19.
  const Clusterer({
    required this.markers,
    this.maxClusterZoom = 19,
    this.minClusterCount = 2,
    this.gridSize = 80,
    this.visible = true,
    this.opacity = 1.0,
    this.icons,
    this.zIndex,
  });

  /// Returns a new clusterer with updated markers or options.
  ///
  /// Pass the result to the controller to update the displayed clusters.
  Clusterer copyWith({
    List<Marker>? markers,
    int? maxClusterZoom,
    int? minClusterCount,
    int? gridSize,
    bool? visible,
    double? opacity,
    List<Map<String, dynamic>>? icons,
    int? zIndex,
  }) =>
      Clusterer(
        markers: markers ?? this.markers,
        maxClusterZoom: maxClusterZoom ?? this.maxClusterZoom,
        minClusterCount: minClusterCount ?? this.minClusterCount,
        gridSize: gridSize ?? this.gridSize,
        visible: visible ?? this.visible,
        opacity: opacity ?? this.opacity,
        icons: icons ?? this.icons,
        zIndex: zIndex ?? this.zIndex,
      );

  /// Returns a new clusterer containing [marker].
  ///
  /// Replaces any existing marker with the same [Marker.markerId].
  Clusterer addMarker(Marker marker) => copyWith(markers: [
        ...markers.where((m) => m.markerId != marker.markerId),
        marker,
      ]);

  /// Returns a new clusterer without the marker identified by [markerId].
  Clusterer removeMarker(String markerId) =>
      copyWith(markers: markers.where((m) => m.markerId != markerId).toList());

  /// Returns markers matching [ids], in their original list order.
  List<Marker> getMarkersByIds(List<String> ids) {
    final idSet = ids.toSet();
    return markers.where((m) => idSet.contains(m.markerId)).toList();
  }

  /// Returns the cluster bridge payload, including serialized [markers].
  ///
  /// Includes SDK icon definitions and z-index only when provided.
  Map<String, dynamic> toJson() {
    return {
      'markers': markers.map((e) => e.toJson()).toList(),
      'maxClusterZoom': maxClusterZoom,
      'minClusterCount': minClusterCount,
      'gridSize': gridSize,
      'visible': visible,
      'opacity': opacity,
      if (icons != null) 'icons': icons,
      if (zIndex != null) 'zIndex': zIndex,
    };
  }
}
