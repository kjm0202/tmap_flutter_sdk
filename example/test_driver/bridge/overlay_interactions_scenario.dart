import 'dart:async';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const String _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';

const String _clustererExpr =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null))';

/// Live bridge test suite for overlay interactions:
/// - Marker with icon/style label and actual tap, removal & stale detached target check
/// - Draggable marker via DOM pointer sequence (start/move/end) asserting Dart start/end
/// - Cluster group tap via rendered badge verifying center, zoom & member IDs (no standalone ID)
/// - InfoWindow tap with expected ID and coordinate
/// - CustomOverlay tap with expected ID and coordinate
Future<void> testOverlayInteractions() async {
  // Callback tracking state across all stages
  String? lastMarkerTapId;
  LatLng? lastMarkerTapPos;
  int? lastMarkerTapZoom;
  int markerTapCount = 0;

  final dragEvents = <(String id, LatLng pos, DragType type)>[];

  (LatLng center, int zoom, List<String> markerIds)? lastClusterTap;
  final clusterMemberTaps = <String>[];

  (String id, LatLng pos)? lastInfoTap;
  int infoTapCount = 0;

  (String id, LatLng pos)? lastCustomTap;
  int customTapCount = 0;

  final controller = await mountLiveMap(
    (created) => TMap(
      onMapCreated: created,
      onMarkerTap: (id, pos, zoom) {
        lastMarkerTapId = id;
        lastMarkerTapPos = pos;
        lastMarkerTapZoom = zoom;
        markerTapCount++;
        clusterMemberTaps.add(id);
      },
      onMarkerDragChangeCallback: (id, pos, type) {
        dragEvents.add((id, pos, type));
      },
      onMarkerClustererTap: (center, zoom, markerIds) {
        lastClusterTap = (center, zoom, markerIds);
      },
      onInfoWindowTap: (id, pos) {
        lastInfoTap = (id, pos);
        infoTapCount++;
      },
      onCustomOverlayTap: (id, pos) {
        lastCustomTap = (id, pos);
        customTapCount++;
      },
    ),
  );

  final failures = <String>[];
  Future<void> stage(String name, Future<void> Function() block) async {
    try {
      await block();
    } catch (e) {
      failures.add('$name: $e');
    }
  }

  try {
    // ── Stage 1: Marker tap with styled label/icon and stale target check ──
    await stage('marker_tap', () async {
      const markerId = 'interactive_marker';
      const markerPos = LatLng(37.5665, 126.9780);

      await controller.setCenter(markerPos);
      await controller.setZoom(16);
      await expectLive(
        'camera setup for marker tap',
        () => checkJs(
          controller,
          'Math.abs(map.getCenter().lat() - 37.5665) < 0.005 && Math.abs(map.getCenter().lng() - 126.9780) < 0.005',
        ),
      );

      try {
        await controller.addMarker(const Marker(
          markerId: markerId,
          position: markerPos,
          title: 'City Hall',
          label: 'Seoul City Hall',
          labelBackgroundColor: Color(0xFF1E88E5),
          labelTextColor: Color(0xFFFFFFFF),
          icon: MarkerIcon(
            iconHtml:
                '<div id="test-marker-icon-btn" style="width:28px;height:28px;background:#e53935;cursor:pointer;"><span>M</span></div>',
            size: Size(28, 28),
          ),
        ));

        // Locate rendered marker DOM element and save reference
        await expectLive(
          'marker DOM target rendered',
          () => checkJs(
            controller,
            '(function() {'
            '  var el = document.getElementById("test-marker-icon-btn");'
            '  if (!el) {'
            '    var m = $_reg?.markers?.["$markerId"];'
            '    el = m?._marker_data?.vsmMarker?.getElement();'
            '  }'
            '  if (!el || !(el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;'
            '  window.__testMarkerEl = el;'
            '  return true;'
            '})()',
          ),
        );

        // Dispatch real DOM click on the rendered marker element
        await checkJs(
          controller,
          '(function() {'
          '  if (!window.__testMarkerEl) return false;'
          '  window.__testMarkerEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  return true;'
          '})()',
        );

        await expectLive(
          'marker tap callback delivered to Dart',
          () async => lastMarkerTapId == markerId,
        );

        if (lastMarkerTapId != markerId) {
          throw StateError(
              'Marker tap ID mismatch: expected $markerId, got $lastMarkerTapId');
        }
        if (lastMarkerTapPos == null ||
            (lastMarkerTapPos!.latitude - markerPos.latitude).abs() > 0.001 ||
            (lastMarkerTapPos!.longitude - markerPos.longitude).abs() > 0.001) {
          throw StateError(
              'Marker tap position mismatch: $lastMarkerTapPos vs $markerPos');
        }
        if (lastMarkerTapZoom == null || lastMarkerTapZoom! < 10) {
          throw StateError('Marker tap zoom level invalid: $lastMarkerTapZoom');
        }

        // Removal & stale target check
        await controller.clearMarker(markerId);
        await expectLive(
          'marker removed from map',
          () => checkJs(
            controller,
            '(function() {'
            '  var m = $_reg?.markers?.["$markerId"];'
            '  return !m || m.getMap() == null;'
            '})()',
          ),
        );

        final tapsBefore = markerTapCount;
        await checkJs(
          controller,
          '(function() {'
          '  if (window.__testMarkerEl) {'
          '    window.__testMarkerEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  }'
          '  return true;'
          '})()',
        );
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (markerTapCount != tapsBefore) {
          throw StateError(
              'Stale detached marker target delivered tap after removal');
        }
      } finally {
        await controller.clearMarker(markerId);
        await checkJs(controller, 'delete window.__testMarkerEl');
      }
    });

    // ── Stage 2: Draggable marker via DOM pointer sequence ──
    await stage('marker_drag', () async {
      const dragId = 'draggable_marker';
      const dragStartPos = LatLng(37.5665, 126.9780);

      await controller.setCenter(dragStartPos);
      await controller.setZoom(16);

      try {
        await controller.addMarker(const Marker(
          markerId: dragId,
          position: dragStartPos,
          draggable: true,
          icon: MarkerIcon(
            iconHtml:
                '<div id="test-drag-marker-btn" style="width:28px;height:28px;background:#43a047;cursor:move;"><span>D</span></div>',
            size: Size(28, 28),
          ),
        ));

        // Locate rendered draggable marker element
        await expectLive(
          'draggable marker DOM target rendered',
          () => checkJs(
            controller,
            '(function() {'
            '  var el = document.getElementById("test-drag-marker-btn");'
            '  if (!el) {'
            '    var m = $_reg?.markers?.["$dragId"];'
            '    el = m?._marker_data?.vsmMarker?.getElement();'
            '  }'
            '  if (!el || !(el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;'
            '  window.__dragMarkerEl = el;'
            '  return true;'
            '})()',
          ),
        );

        dragEvents.clear();

        // Capture starting screen coords before removal, define reusable gesture,
        // and execute pointerdown, two increasingly displaced pointermoves, pointerup.
        await checkJs(
          controller,
          '(function() {'
          '  var el = window.__dragMarkerEl;'
          '  if (!el) return false;'
          '  var r = el.getBoundingClientRect();'
          '  var sx = Math.round(r.left + (r.width > 0 ? r.width / 2 : 14));'
          '  var sy = Math.round(r.top + (r.height > 0 ? r.height / 2 : 14));'
          '  window.__dragStartCoords = { sx: sx, sy: sy };'
          '  function mk(type, x, y, buttons) {'
          '    if (typeof PointerEvent !== "undefined") {'
          '      return new PointerEvent(type, {'
          '        pointerId: 5,'
          '        clientX: x,'
          '        clientY: y,'
          '        button: 0,'
          '        buttons: buttons,'
          '        bubbles: true,'
          '        cancelable: true,'
          '        view: window'
          '      });'
          '    }'
          '    var e = document.createEvent("Event");'
          '    e.initEvent(type, true, true);'
          '    e.pointerId = 5; e.clientX = x; e.clientY = y; e.button = 0; e.buttons = buttons; e.view = window;'
          '    return e;'
          '  }'
          '  window.__performDragGesture = function(targetEl, startX, startY) {'
          '    if (!targetEl) return false;'
          '    function dispatchMovement(type, x, y, buttons) {'
          '      var isAttached = targetEl && (targetEl.isConnected !== undefined ? targetEl.isConnected : (document.contains ? document.contains(targetEl) : false));'
          '      var ev = mk(type, x, y, buttons);'
          '      targetEl.dispatchEvent(ev);'
          '      if (!isAttached || !ev.bubbles) {'
          '        document.dispatchEvent(mk(type, x, y, buttons));'
          '      }'
          '    }'
          '    targetEl.dispatchEvent(mk("pointerdown", startX, startY, 1));'
          '    dispatchMovement("pointermove", startX + 20, startY + 20, 1);'
          '    dispatchMovement("pointermove", startX + 45, startY + 45, 1);'
          '    dispatchMovement("pointerup", startX + 45, startY + 45, 0);'
          '    return true;'
          '  };'
          '  return window.__performDragGesture(el, sx, sy);'
          '})()',
        );

        await expectLive(
          'draggable marker received drag callbacks',
          () async =>
              dragEvents.isNotEmpty &&
              dragEvents.any((e) => e.$1 == dragId && e.$3 == DragType.start) &&
              dragEvents.any((e) => e.$1 == dragId && e.$3 == DragType.move) &&
              dragEvents.any((e) => e.$1 == dragId && e.$3 == DragType.end),
        );

        if (dragEvents.isEmpty) {
          throw StateError('No drag events received');
        }

        final firstEvent = dragEvents.first;
        final lastEvent = dragEvents.last;

        if (firstEvent.$3 != DragType.start) {
          throw StateError(
              'Expected first drag event to be start, got ${firstEvent.$3}');
        }

        if (lastEvent.$3 != DragType.end) {
          throw StateError(
              'Expected last drag event to be end, got ${lastEvent.$3}');
        }

        final moveEvents =
            dragEvents.where((e) => e.$3 == DragType.move).toList();
        if (moveEvents.isEmpty) {
          throw StateError('Expected one or more DragType.move events');
        }

        final startCount =
            dragEvents.where((e) => e.$3 == DragType.start).length;
        final endCount = dragEvents.where((e) => e.$3 == DragType.end).length;
        if (startCount != 1) {
          throw StateError('Expected exactly one start event, got $startCount');
        }
        if (endCount != 1) {
          throw StateError('Expected exactly one end event, got $endCount');
        }
        if (dragEvents.length != 1 + moveEvents.length + 1) {
          throw StateError(
              'Stray drag phases detected in events: ${dragEvents.map((e) => e.$3).toList()}');
        }
        for (var i = 1; i < dragEvents.length - 1; i++) {
          if (dragEvents[i].$3 != DragType.move) {
            throw StateError(
                'Expected move event at index $i, got ${dragEvents[i].$3}');
          }
        }

        for (final event in dragEvents) {
          if (event.$1 != dragId) {
            throw StateError(
                'Drag event ID mismatch: expected $dragId, got ${event.$1}');
          }
        }

        if ((firstEvent.$2.latitude - dragStartPos.latitude).abs() > 0.001 ||
            (firstEvent.$2.longitude - dragStartPos.longitude).abs() > 0.001) {
          throw StateError(
              'Drag start coordinate mismatch: ${firstEvent.$2} vs $dragStartPos');
        }

        final latDiff = (lastEvent.$2.latitude - firstEvent.$2.latitude).abs();
        final lngDiff = (lastEvent.$2.longitude - firstEvent.$2.longitude).abs();
        if (latDiff < 0.00001 && lngDiff < 0.00001) {
          throw StateError(
              'Drag end coordinate did not change from start: start=${firstEvent.$2}, end=${lastEvent.$2}');
        }

        // Removal & stale target check
        await controller.clearMarker(dragId);
        await expectLive(
          'draggable marker removed from map',
          () => checkJs(
            controller,
            '(function() {'
            '  var m = $_reg?.markers?.["$dragId"];'
            '  return !m || m.getMap() == null;'
            '})()',
          ),
        );

        // Ensure prior target actually detached and remains saved
        await expectLive(
          'prior draggable marker target is saved and actually detached',
          () => checkJs(
            controller,
            '(function() {'
            '  var el = window.__dragMarkerEl;'
            '  if (!el) return false;'
            '  var connected = el.isConnected !== undefined ? el.isConnected : (document.contains ? document.contains(el) : false);'
            '  return !connected;'
            '})()',
          ),
        );

        dragEvents.clear();
        final detachedReplayResult = await checkJs(
          controller,
          '(function() {'
          '  var el = window.__dragMarkerEl;'
          '  var coords = window.__dragStartCoords;'
          '  if (!el || !coords || typeof window.__performDragGesture !== "function") return false;'
          '  return window.__performDragGesture(el, coords.sx, coords.sy);'
          '})()',
        );
        if (!detachedReplayResult) {
          throw StateError('Detached drag replay was not dispatched');
        }
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (dragEvents.isNotEmpty) {
          throw StateError(
              'Stale detached draggable marker delivered events after removal: $dragEvents');
        }
      } finally {
        await controller.clearMarker(dragId);
        await checkJs(
          controller,
          '(function() {'
          '  delete window.__dragMarkerEl;'
          '  delete window.__dragStartCoords;'
          '  delete window.__performDragGesture;'
          '  return true;'
          '})()',
        );
      }
    });

    // ── Stage 3: Cluster group tap via rendered badge ──
    await stage('cluster_tap', () async {
      const posA = LatLng(37.5000, 127.0300);
      const posB = LatLng(37.5002, 127.0302);

      await controller.setCenter(const LatLng(37.5001, 127.0301));
      await controller.setZoom(10);
      await expectLive(
        'camera for cluster tap',
        () => checkJs(
          controller,
          'Math.abs(map.getCenter().lat() - 37.5001) < 0.05 && Math.round(map.getZoom()) === 10',
        ),
      );

      try {
        await controller.addMarkerClusterer(const Clusterer(
          markers: [
            Marker(markerId: 'cl_m1', position: posA),
            Marker(markerId: 'cl_m2', position: posB),
          ],
          maxClusterZoom: 16,
          minClusterCount: 2,
          gridSize: 80,
        ));

        // Locate rendered cluster badge
        await expectLive(
          'cluster group rendered badge visible',
          () => checkJs(
            controller,
            '(function() {'
            '  var cl = $_clustererExpr;'
            '  if (!cl || !cl._cluster_data) return false;'
            '  var gm = cl._cluster_data.clusterMarkers;'
            '  if (!Array.isArray(gm) || gm.length !== 1) return false;'
            '  var g = gm[0];'
            '  if (!g || g.getMap() == null) return false;'
            '  var el = g._marker_data && g._marker_data.vsmMarker ? g._marker_data.vsmMarker.getElement() : null;'
            '  if (!el || !(el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;'
            '  window.__clusterBadgeEl = el;'
            '  return true;'
            '})()',
          ),
        );

        lastClusterTap = null;
        clusterMemberTaps.clear();

        // Dispatch click on the rendered cluster badge
        await checkJs(
          controller,
          '(function() {'
          '  if (!window.__clusterBadgeEl) return false;'
          '  window.__clusterBadgeEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  return true;'
          '})()',
        );

        await expectLive(
          'cluster group tap callback delivered to Dart',
          () async => lastClusterTap != null,
        );

        final clusterData = lastClusterTap!;
        if ((clusterData.$1.latitude - 37.5001).abs() > 0.05 ||
            (clusterData.$1.longitude - 127.0301).abs() > 0.05) {
          throw StateError('Cluster center mismatch: ${clusterData.$1}');
        }
        if (clusterData.$2 != 10) {
          throw StateError(
              'Cluster zoom mismatch: expected 10, got ${clusterData.$2}');
        }
        if (!clusterData.$3.contains('cl_m1') ||
            !clusterData.$3.contains('cl_m2')) {
          throw StateError(
              'Cluster member IDs mismatch: expected [cl_m1, cl_m2], got ${clusterData.$3}');
        }

        // Verify no standalone marker tap fired for cluster members
        if (clusterMemberTaps.any((id) => id == 'cl_m1' || id == 'cl_m2')) {
          throw StateError(
              'Standalone marker tap delivered during cluster group tap: $clusterMemberTaps');
        }

        // Removal & stale target check
        await controller.clearMarkerClusterer();
        await expectLive(
          'cluster group removed',
          () => checkJs(
            controller,
            '(function() {'
            '  var cl = $_clustererExpr;'
            '  if (cl != null) {'
            '    var gm = cl._cluster_data && cl._cluster_data.clusterMarkers;'
            '    if (Array.isArray(gm) && gm.some(function(g) { return g && g.getMap() != null; })) return false;'
            '  }'
            '  return !window.__clusterBadgeEl || !window.__clusterBadgeEl.isConnected;'
            '})()',
          ),
        );

        lastClusterTap = null;
        clusterMemberTaps.clear();
        await checkJs(
          controller,
          '(function() {'
          '  if (window.__clusterBadgeEl) {'
          '    window.__clusterBadgeEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  }'
          '  return true;'
          '})()',
        );
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (lastClusterTap != null || clusterMemberTaps.isNotEmpty) {
          throw StateError(
              'Stale detached cluster badge delivered tap after removal');
        }
      } finally {
        await controller.clearMarkerClusterer();
        await checkJs(controller, 'delete window.__clusterBadgeEl');
      }
    });

    // ── Stage 4: InfoWindow tap with expected ID/coordinate ──
    await stage('info_window_tap', () async {
      const infoId = 'info_interactive';
      const infoPos = LatLng(37.5658, 126.9780);

      try {
        await controller.addInfoWindow(const InfoWindow(
          infoWindowId: infoId,
          position: infoPos,
          content:
              '<div id="info-test-tap-btn" style="padding:8px;cursor:pointer;"><span>Info Window</span></div>',
          type: 2,
        ));

        await expectLive(
          'info window DOM target rendered',
          () => checkJs(
            controller,
            '(function() {'
            '  var el = document.getElementById("info-test-tap-btn");'
            '  if (!el || !(el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;'
            '  window.__infoTapEl = el;'
            '  return true;'
            '})()',
          ),
        );

        final tapsBefore = infoTapCount;
        lastInfoTap = null;
        await checkJs(
          controller,
          '(function() {'
          '  if (!window.__infoTapEl) return false;'
          '  window.__infoTapEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  return true;'
          '})()',
        );

        await expectLive(
          'info window tap delivered to Dart',
          () async => lastInfoTap != null,
        );
        await Future<void>.delayed(const Duration(milliseconds: 150));

        if (infoTapCount != tapsBefore + 1) {
          throw StateError(
              'Expected exactly one InfoWindow tap callback, got ${infoTapCount - tapsBefore} (before: $tapsBefore, current: $infoTapCount)');
        }
        if (lastInfoTap!.$1 != infoId) {
          throw StateError(
              'InfoWindow ID mismatch: expected $infoId, got ${lastInfoTap!.$1}');
        }
        if ((lastInfoTap!.$2.latitude - infoPos.latitude).abs() > 0.001 ||
            (lastInfoTap!.$2.longitude - infoPos.longitude).abs() > 0.001) {
          throw StateError(
              'InfoWindow coordinate mismatch: ${lastInfoTap!.$2} vs $infoPos');
        }

        // Removal & stale target check
        await controller.clearInfoWindow(infoId);
        await expectLive(
          'info window detached',
          () => checkJs(
            controller,
            '!document.getElementById("info-test-tap-btn") || !window.__infoTapEl || !window.__infoTapEl.isConnected',
          ),
        );

        final detachedTapsBefore = infoTapCount;
        lastInfoTap = null;
        await checkJs(
          controller,
          '(function() {'
          '  if (window.__infoTapEl) {'
          '    window.__infoTapEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  }'
          '  return true;'
          '})()',
        );
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (infoTapCount != detachedTapsBefore) {
          throw StateError(
              'Stale detached InfoWindow delivered tap after removal (tap count incremented: $infoTapCount vs $detachedTapsBefore)');
        }
        if (lastInfoTap != null) {
          throw StateError(
              'Stale detached InfoWindow delivered tap after removal');
        }
      } finally {
        await controller.clearInfoWindow(infoId);
        await checkJs(controller, 'delete window.__infoTapEl');
      }
    });

    // ── Stage 5: CustomOverlay tap with expected ID/coordinate ──
    await stage('custom_overlay_tap', () async {
      const customId = 'custom_interactive';
      const customPos = LatLng(37.5658, 126.9752);

      try {
        await controller.addCustomOverlay(const CustomOverlay(
          customOverlayId: customId,
          position: customPos,
          content:
              '<div id="custom-test-tap-btn" style="padding:8px;cursor:pointer;"><span>Custom Overlay</span></div>',
        ));

        await expectLive(
          'custom overlay DOM target rendered',
          () => checkJs(
            controller,
            '(function() {'
            '  var el = document.getElementById("custom-test-tap-btn");'
            '  if (!el || !(el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;'
            '  window.__customTapEl = el;'
            '  return true;'
            '})()',
          ),
        );

        final tapsBefore = customTapCount;
        lastCustomTap = null;
        await checkJs(
          controller,
          '(function() {'
          '  if (!window.__customTapEl) return false;'
          '  window.__customTapEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  return true;'
          '})()',
        );

        await expectLive(
          'custom overlay tap delivered to Dart',
          () async => lastCustomTap != null,
        );
        await Future<void>.delayed(const Duration(milliseconds: 150));

        if (customTapCount != tapsBefore + 1) {
          throw StateError(
              'Expected exactly one CustomOverlay tap callback, got ${customTapCount - tapsBefore} (before: $tapsBefore, current: $customTapCount)');
        }
        if (lastCustomTap!.$1 != customId) {
          throw StateError(
              'CustomOverlay ID mismatch: expected $customId, got ${lastCustomTap!.$1}');
        }
        if ((lastCustomTap!.$2.latitude - customPos.latitude).abs() > 0.001 ||
            (lastCustomTap!.$2.longitude - customPos.longitude).abs() > 0.001) {
          throw StateError(
              'CustomOverlay coordinate mismatch: ${lastCustomTap!.$2} vs $customPos');
        }

        // Removal & stale target check
        await controller.clearAllCustomOverlays();
        await expectLive(
          'custom overlay detached',
          () => checkJs(
            controller,
            '!document.getElementById("custom-test-tap-btn") || !window.__customTapEl || !window.__customTapEl.isConnected',
          ),
        );

        final detachedTapsBefore = customTapCount;
        lastCustomTap = null;
        await checkJs(
          controller,
          '(function() {'
          '  if (window.__customTapEl) {'
          '    window.__customTapEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));'
          '  }'
          '  return true;'
          '})()',
        );
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (customTapCount != detachedTapsBefore) {
          throw StateError(
              'Stale detached CustomOverlay delivered tap after removal (tap count incremented: $customTapCount vs $detachedTapsBefore)');
        }
        if (lastCustomTap != null) {
          throw StateError(
              'Stale detached CustomOverlay delivered tap after removal');
        }
      } finally {
        await controller.clearAllCustomOverlays();
        await checkJs(controller, 'delete window.__customTapEl');
      }
    });
  } finally {
    await unmountLiveMap();
  }

  if (failures.isNotEmpty) {
    throw StateError('Overlay interaction failures:\n${failures.join('\n')}');
  }
}
