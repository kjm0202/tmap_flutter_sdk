import 'dart:async';

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _unrelatedMarkerId = 'unrelated-marker';
const _unrelatedPos = LatLng(37.5665, 126.9780);

const _clusterPosA = LatLng(37.5000, 127.0300);
const _clusterPosB = LatLng(37.5001, 127.0301);
const _clusterPosC = LatLng(37.5002, 127.0302);
const _replacementPosA = LatLng(37.4900, 127.0200);
const _replacementPosB = LatLng(37.4901, 127.0201);

Future<void> _waitFor(String step, Future<bool> Function() check) async {
  for (var i = 0; i < 50; i++) {
    if (await check()) return;
    await Future<void>.delayed(const Duration(milliseconds: 150));
  }
  throw StateError('Timed out waiting for $step');
}

const _clustererExpr =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null))';

// Returns true when _cluster_data.clusterMarkers has exactly `count` entries
// and all of them have a non-null map (i.e. are displayed).
String _oneGroupDisplayed(int memberCount) => '(function(){'
    'var cl=$_clustererExpr;'
    'if(!cl||!cl._cluster_data)return false;'
    'var gm=cl._cluster_data.clusterMarkers;'
    'if(!Array.isArray(gm)||gm.length!==1)return false;'
    'var g=gm[0];'
    'if(!g||g.getMap()==null)return false;'
    // member count is the numeric text written on the group marker element
    'var el=g._marker_data&&g._marker_data.vsmMarker?g._marker_data.vsmMarker.getElement():null;'
    'var txt=el?el.textContent.trim():"";'
    'if(String(txt)!==String($memberCount))return false;'
    // input members must be detached
    'var mem=cl._cluster_data.markers;'
    'if(!Array.isArray(mem)||mem.length!==$memberCount)return false;'
    'return mem.every(function(m){return m&&m.getMap()==null;});'
    '})()';

// Null/absent clusterer AND no stale group markers on the map.
const _clustererGone = '(function(){'
    'var cl=$_clustererExpr;'
    'if(cl!=null){var gm=cl._cluster_data&&cl._cluster_data.clusterMarkers;'
    'if(Array.isArray(gm)&&gm.some(function(g){return g&&g.getMap()!=null;}))return false;}'
    'return true;'
    '})()';

// Unrelated marker liveness: resolves the web state object (tmap_instances) or
// falls back to window (mobile WebView), then checks markers['unrelated-marker']
// .getMap()===map. No for-loop, no id field on the marker object.
const _unrelatedAlive =
    '((window.tmap_instances?Object.values(window.tmap_instances)[0]:window)'
    '?.markers?.["$_unrelatedMarkerId"]?.getMap()===map)';

Future<void> testClusterScenarios(TMapController controller) async {
  // Centre map on cluster members so the clusterer groups them at zoom 10.
  await controller.setCenter(_clusterPosA);
  await controller.setZoom(10);
  await _waitFor(
    'camera setup',
    () => checkJs(
      controller,
      'Math.abs(map.getCenter().lat()-37.50)<0.05&&Math.round(map.getZoom())===10',
    ),
  );

  // Cleanup runs in finally even if the startup marker check below fails.
  try {
    // Unrelated standalone marker – must survive all cluster operations.
    await controller.addMarker(const Marker(
      markerId: _unrelatedMarkerId,
      position: _unrelatedPos,
      title: 'Standalone Marker',
    ));
    await _waitFor(
        'unrelated marker visible', () => checkJs(controller, _unrelatedAlive));

    // ── Phase 1: 3-member cluster ─────────────────────────────────────────
    await controller.addMarkerClusterer(const Clusterer(
      markers: [
        Marker(markerId: 'c1', position: _clusterPosA),
        Marker(markerId: 'c2', position: _clusterPosB),
        Marker(markerId: 'c3', position: _clusterPosC),
      ],
      maxClusterZoom: 16,
      minClusterCount: 2,
      gridSize: 80,
    ));
    await _waitFor('3-member group displayed',
        () => checkJs(controller, _oneGroupDisplayed(3)));

    // Save the old group marker's DOM element before replacement so we can
    // assert it is detached afterwards. SDK marker getMap() may retain its
    // value after removal, so checking isConnected on the actual DOM element
    // is a stronger detachment signal.
    await checkJs(
      controller,
      '(function(){'
      'var gm=$_clustererExpr._cluster_data.clusterMarkers;'
      'var g=gm&&gm[0];'
      'window.__oldGroupMarkerEl=g&&g._marker_data&&g._marker_data.vsmMarker'
      '?g._marker_data.vsmMarker.getElement():null;'
      'return true;'
      '})()',
    );

    // ── Phase 2: replace with 2-member cluster ────────────────────────────
    await controller.addMarkerClusterer(const Clusterer(
      markers: [
        Marker(markerId: 'r1', position: _replacementPosA),
        Marker(markerId: 'r2', position: _replacementPosB),
      ],
      maxClusterZoom: 16,
      minClusterCount: 2,
      gridSize: 80,
    ));
    await _waitFor('2-member group displayed',
        () => checkJs(controller, _oneGroupDisplayed(2)));

    // Old group marker DOM element must now be detached from the document.
    await _waitFor(
      'old group marker DOM element detached after replacement',
      () => checkJs(
        controller,
        '!window.__oldGroupMarkerEl||!window.__oldGroupMarkerEl.isConnected',
      ),
    );

    // ── Phase 3: remove clusterer ─────────────────────────────────────────
    await controller.clearMarkerClusterer();
    await _waitFor('clusterer removed, no stale groups',
        () => checkJs(controller, _clustererGone));

    // ── Phase 4: unrelated marker untouched ───────────────────────────────
    if (!await checkJs(controller, _unrelatedAlive)) {
      throw StateError(
          'Unrelated marker was removed during cluster operations');
    }
  } finally {
    await controller.clearMarkerClusterer();
    await controller.clearMarker(_unrelatedMarkerId);
    await checkJs(controller, 'delete window.__oldGroupMarkerEl');
  }
}
