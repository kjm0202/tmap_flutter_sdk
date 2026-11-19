import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

final _mapKey = GlobalKey();
const _center = LatLng(37.5665, 126.9780);
const _members = [
  Marker(markerId: 'one', position: _center),
  Marker(markerId: 'two', position: LatLng(37.5666, 126.9781)),
];
const _cluster =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null))';
const _circle =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.circles?.zero : (typeof circles !== "undefined" ? circles["zero"] : null))';

Clusterer _style(bool visible, double opacity) =>
    Clusterer(markers: _members, visible: visible, opacity: opacity);

// Check both SDK options and the actual group badge. A hidden SDK marker can
// either have a hidden DOM node or no connected node at all. Requiring the
// cluster and its two members prevents a missing cluster from passing as hidden.
String _badgeStyle(bool visible, double opacity) {
  // Original Tmapv3.extension.MarkerCluster, measured on all three devices:
  // opacity 0 is stored as 0 but renders like opacity 1. The raw SDK namespace
  // and construction are also exercised in cluster_click_pair.dart.
  final renderedOpacity = opacity == 0 ? 1 : opacity;
  return '''(function() {
  const cl = $_cluster;
  const data = cl?._cluster_data;
  const options = data?.options;
  const groups = data?.clusterMarkers;
  if (!options || options.visible !== $visible ||
      typeof options.opacity !== 'number' ||
      options.opacity !== $opacity ||
      !Array.isArray(data.markers) || data.markers.length !== 2 ||
      !Array.isArray(groups) || groups.length !== 1 || !groups[0]) return false;
  let el = groups[0]._marker_data?.vsmMarker?.getElement();
  if (!el?.isConnected) return ${!visible};
  if (el.textContent.trim() !== '2') return false;
  const rect = el.getBoundingClientRect();
  let alpha = 1, hidden = false;
  for (; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    alpha *= Number(style.opacity);
    hidden ||= style.visibility === 'hidden' || style.visibility === 'collapse' ||
        style.display === 'none';
  }
  if (!$visible) return hidden || alpha === 0 || rect.width === 0 || rect.height === 0;
  return !hidden && rect.width > 0 && rect.height > 0 &&
      Math.abs(alpha - $renderedOpacity) < 0.01;
})()''';
}

/// Runs the same public controller and widget overlay checks on all platforms.
Future<void> testOverlayRegression() async {
  try {
    final controller = await mountLiveMap(
      (created) => TMap(
        key: _mapKey,
        center: _center,
        zoom: 12,
        onMapCreated: created,
        clusterer: const Clusterer(markers: _members),
      ),
    );

    Future<void> expectStyle(String phase, bool visible, double opacity) =>
        expectLive(
          '$phase cluster badge visible=$visible opacity=$opacity',
          () => checkJs(controller, _badgeStyle(visible, opacity)),
        );

    // The visible default and its subsequent removal are negative controls for
    // the hidden checks. Retain its real element to detect stale DOM on clear.
    await expectStyle('initial', true, 1);
    final mapState = _mapKey.currentState;
    if (mapState == null || !mapState.mounted) {
      throw StateError('Initial map is not mounted at the map key');
    }
    if (!await checkJs(controller, '''(function() {
      window.__overlayRegressionMap = map;
      const el = $_cluster?._cluster_data?.clusterMarkers?.[0]
          ?._marker_data?.vsmMarker?.getElement();
      if (!el?.isConnected) return false;
      window.__overlayRegressionBadge = el;
      return true;
    })()''')) {
      throw StateError('Could not capture the visible default badge');
    }
    await controller.clearMarkerClusterer();
    await expectLive(
      'removed cluster and detached default badge',
      () => checkJs(
        controller,
        '$_cluster == null && window.__overlayRegressionBadge && !window.__overlayRegressionBadge.isConnected',
      ),
    );

    Future<void> capturePreviousBadge() async {
      await checkJs(controller, '''(function() {
        window.__overlayRegressionCluster = $_cluster;
        window.__overlayRegressionPrevious = $_cluster?._cluster_data
            ?.clusterMarkers?.[0]?._marker_data?.vsmMarker?.getElement() || null;
        return true;
      })()''');
    }

    Future<void> expectPreviousDetached(String phase) => expectLive(
      '$phase previous cluster replaced and badge detached',
      () => checkJs(
        controller,
        '$_cluster !== window.__overlayRegressionCluster && '
        '(!window.__overlayRegressionPrevious || !window.__overlayRegressionPrevious.isConnected)',
      ),
    );

    // Controller replacements exercise the public imperative Dart-to-SDK path.
    for (final style in [
      _style(false, 1),
      _style(true, .35),
      _style(true, 0),
      _style(true, 1),
    ]) {
      await capturePreviousBadge();
      await controller.addMarkerClusterer(style);
      await expectStyle('controller', style.visible, style.opacity);
      await expectPreviousDetached('controller');
    }

    // Rebuild the same widget to exercise declarative snapshot synchronization.
    for (final style in [
      _style(false, 1),
      _style(true, .35),
      _style(true, 0),
      _style(true, 1),
    ]) {
      await capturePreviousBadge();
      runApp(
        MaterialApp(
          home: TMap(key: _mapKey, center: _center, zoom: 12, clusterer: style),
        ),
      );
      await WidgetsBinding.instance.endOfFrame;
      if (!identical(_mapKey.currentState, mapState) || !mapState.mounted) {
        throw StateError(
          'Widget map state changed or unmounted at the map key',
        );
      }
      await expectLive(
        'widget retained original SDK map',
        () => checkJs(controller, 'map === window.__overlayRegressionMap'),
      );
      await expectStyle('widget', style.visible, style.opacity);
      await expectPreviousDetached('widget');
    }

    for (final radius in [250.0, 0.0, 100.0]) {
      await controller.addCircle(
        Circle(
          circleId: 'zero',
          center: _center,
          radius: radius,
          fillColor: const Color(0xFFFF00FF),
          fillOpacity: 1,
          strokeColor: const Color(0xFFFF00FF),
        ),
      );
      await expectLive(
        'SDK circle attached with radius $radius',
        () => checkJs(
          controller,
          'Boolean($_circle && $_circle.getMap() && $_circle.getRadius() === $radius)',
        ),
      );
    }
    await checkJs(
      controller,
      '(delete window.__overlayRegressionBadge, delete window.__overlayRegressionPrevious, '
      'delete window.__overlayRegressionCluster, delete window.__overlayRegressionMap)',
    );
  } finally {
    await unmountLiveMap();
  }
}
