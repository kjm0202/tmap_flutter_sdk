import 'lat_lng.dart';

/// Marker events available through `Tmapv3.Marker#on`.
enum MarkerInteractionType {
  /// Marker click event.
  click,

  /// Marker drag movement event.
  drag,

  /// Marker drag completion event.
  dragend,

  /// Pointer entering the marker.
  mouseenter,

  /// Pointer leaving the marker.
  mouseleave
}

/// A marker event with its identifier, position, and map zoom level.
class MarkerInteraction {
  /// Identifier of the marker that emitted the event.
  final String markerId;

  /// Kind of marker event.
  final MarkerInteractionType type;

  /// Marker position at the time of the event.
  final LatLng position;

  /// Map zoom level at the time of the event.
  final int zoom;

  /// Creates an event snapshot for [markerId] and [type].
  const MarkerInteraction({
    required this.markerId,
    required this.type,
    required this.position,
    required this.zoom,
  });
}

/// Pointer events available on marker clusters.
enum ClusterInteractionType {
  /// Pointer entering a marker cluster.
  mouseenter,

  /// Pointer leaving a marker cluster.
  mouseleave
}

/// A cluster event with its center, zoom level, and member marker IDs.
class ClusterInteraction {
  /// Kind of pointer event on the cluster.
  final ClusterInteractionType type;

  /// Geographic center of the cluster.
  final LatLng center;

  /// Map zoom level when the cluster event occurred.
  final int zoom;

  /// Identifiers of the markers included in the cluster.
  final List<String> markerIds;

  /// Creates a cluster event snapshot with its center and member identifiers.
  const ClusterInteraction({
    required this.type,
    required this.center,
    required this.zoom,
    required this.markerIds,
  });
}
