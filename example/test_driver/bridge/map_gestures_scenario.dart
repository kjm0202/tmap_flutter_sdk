import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'native_input_stub.dart' if (dart.library.io) 'native_input.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';
import 'gesture_target.dart';

Future<void> _dispatchGesture(
  String action,
  TMapController controller,
  GestureTarget target,
) async {
  if (useNativeInput) {
    final view = ui.PlatformDispatcher.instance.implicitView ??
        ui.PlatformDispatcher.instance.views.first;
    final devicePixelRatio = view.devicePixelRatio;

    // Scaling client CSS -> Android physical or iOS Xunit
    final double scale = (defaultTargetPlatform == TargetPlatform.android)
        ? devicePixelRatio
        : 1.0;
    final centerX = target.x * scale;
    final centerY = target.y * scale;

    if (action == 'drag') {
      await driveNativeInput(
        action,
        centerX,
        centerY,
        endX: (target.x + 76) * scale,
        endY: centerY,
      );
    } else {
      await driveNativeInput(action, centerX, centerY);
    }
  } else {
    if (kIsWeb) {
      final jsCode = '''(function() {
          var priorId = (window.__tmapTrustedGesture && window.__tmapTrustedGesture.id) || 0;
          window.__tmapTrustedGesture = {
            id: priorId + 1,
            action: '$action',
            x: ${target.x},
            y: ${target.y},
            endX: ${target.x} + 76,
            endY: ${target.y},
            done: false
          };
          return true;
        })()''';
      if (!await checkJs(controller, jsCode)) {
        throw StateError('Web dispatch setup failed');
      }

      await expectLive(
          'CDP gesture host completion (start web_input/driver.mjs with matching browser debug port)',
          () => checkJs(
              controller, 'window.__tmapTrustedGesture && window.__tmapTrustedGesture.done === true'),
        );

      final error = await checkJs(controller, 'window.__tmapTrustedGesture.error');
      if (error) {
        throw StateError("Chrome native input host reported a gesture error: $action");
      }
    } else {
      throw StateError("Android/iOS requires TMAP_GESTURE_PORT");
    }
  }
}

const LatLng _targetCenter = LatLng(37.5665, 126.9780);
const int _initialZoom = 16;
const double _coordTolerance = 0.01;

Future<void> testMapGestures() async {
  final tapEvents = <LatLng>[];
  final doubleTapEvents = <LatLng>[];
  final longTapEvents = <LatLng>[];
  final dragEvents = <(LatLng, int, DragType)>[];

  final controller = await mountLiveMap(
    (created) => TMap(
      center: _targetCenter,
      zoom: _initialZoom,
      onMapCreated: created,
      onMapTap: (latLng) => tapEvents.add(latLng),
      onMapDoubleTap: (latLng) {
        doubleTapEvents.add(latLng);
      },
      onMapLongTap: (latLng) {
        longTapEvents.add(latLng);
      },
      onDragChangeCallback: (latLng, zoom, dragType) =>
          dragEvents.add((latLng, zoom, dragType)),
    ),
  );

  try {
    // Readiness & Initial Alignment
    await expectLive(
      'map canvas readiness',
      () => checkJs(controller,
          '(function() { if (!map || !map.vsmMap) return false; var c = map.vsmMap().getCanvas(); if (!c) return false; var r = c.getBoundingClientRect(); return r && r.width > 0 && r.height > 0; })()'),
    );
    await expectLive(
      'initial camera alignment',
      () => checkJs(
        controller,
        '(function() { return Math.round(map.getZoom()) === $_initialZoom; })()',
      ),
    );

    final initialCenter = await currentGestureCenter(controller);
    if ((initialCenter.latitude - _targetCenter.latitude).abs() > 0.005 ||
        (initialCenter.longitude - _targetCenter.longitude).abs() > 0.005) {
      throw StateError(
        'Initial camera center out of tolerance: expected $_targetCenter, got $initialCenter',
      );
    }

    // Pre-capture targets
    final tapTarget = await gestureTarget(controller, 0.60, 0.42);
    final doubleTapTarget = await gestureTarget(controller, 0.38, 0.60);

    // ── 2. Map Tap ──────────────────────────────────────────────────────────
    await _dispatchGesture('tap', controller, tapTarget);
    await expectLive('map tap callback', () async => tapEvents.isNotEmpty);
    tapTarget.expectCoordinate(tapEvents.last, 'tap');
    await Future<void>.delayed(const Duration(milliseconds: 700));

    // ── 3. Double Tap ───────────────────────────────────────────────────────
    // SDK map.on("ZoomEnd", handler)
    await checkJs(controller, '''
      (function() {
        window.__zoomEnd = false;
        var handler = function() {
          window.__zoomEnd = true;
          map.off("ZoomEnd", handler);
        };
        map.on("ZoomEnd", handler);
        return true;
      })()
    ''');

    await _dispatchGesture(
        'doubleTap', controller, doubleTapTarget);

    await expectLive(
        'controller zoom response from double tap',
        () => checkJs(
            controller, 'Math.round(map.getZoom()) === ${_initialZoom + 1}'));
    await expectLive('zoom end flag',
        () => checkJs(controller, 'window.__zoomEnd === true'));
    await expectLive(
        'map double tap callback', () async => doubleTapEvents.isNotEmpty);
    doubleTapTarget.expectCoordinate(doubleTapEvents.last, 'double tap');

    // ── 4. Long Press ───────────────────────────────────────────────────────
    final holdTarget = await gestureTarget(controller, 0.66, 0.32);
    longTapEvents.clear();
    await _dispatchGesture(
        'hold', controller, holdTarget);
    await expectLive(
        'map long press callback', () async => longTapEvents.isNotEmpty);
    holdTarget.expectCoordinate(longTapEvents.last, 'hold');

    if (doubleTapEvents.length != 1 || longTapEvents.length != 1) {
      throw StateError('Expected exactly 1 doubleTapEvent and 1 longTapEvent, '
          'but found: doubleTapEvents.length=${doubleTapEvents.length}, '
          'longTapEvents.length=${longTapEvents.length}');
    }

    // Ensure sufficient interval for independent physical gestures to prevent input collision.
    await Future<void>.delayed(const Duration(milliseconds: 850));

    // ── 5. Map Drag Start / End ─────────────────────────────────────────────
    final tapCountBeforeDrag = tapEvents.length;

    final preDrag = await currentGestureCenter(controller);
    await _dispatchGesture('drag', controller,
        await gestureTarget(controller, 0.55, 0.55));

    // Controller state responds: center changed after drag
    await expectLive(
      'controller center response from drag',
      () => checkJs(
        controller,
        '(function() {'
        'var c = map.getCenter();'
        'var lng = typeof c.lng === "function" ? c.lng() : (c._lng ?? c.lng);'
        'return Math.abs(lng - ${preDrag.longitude}) > 0.0001;'
        '})()',
      ),
    );

    // Ensure drag motion is not mistakenly registered as a tap callback
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (tapEvents.length != tapCountBeforeDrag) {
      throw StateError(
        'Drag motion mistakenly triggered tap callback: taps before=$tapCountBeforeDrag, after=${tapEvents.length}',
      );
    }

    // Require ordered DragType.start, drag/move, end with coordinate/zoom consistency on ALL platforms
    await expectLive(
      'Dart onDragChangeCallback ordered start and end',
      () async =>
          dragEvents.any((e) => e.$3 == DragType.start) &&
          dragEvents.any((e) => e.$3 == DragType.end),
    );

    final startIdx = dragEvents.indexWhere((e) => e.$3 == DragType.start);
    final endIdx = dragEvents.lastIndexWhere((e) => e.$3 == DragType.end);

    if (startIdx == -1 || endIdx == -1 || startIdx > endIdx) {
      throw StateError(
        'Drag events not ordered: start index $startIdx, end index $endIdx',
      );
    }

    // Verify any intermediate move events occur strictly between start and end
    for (var i = 0; i < dragEvents.length; i++) {
      if (dragEvents[i].$3 == DragType.move) {
        if (i < startIdx || i > endIdx) {
          throw StateError(
            'Drag move event at index $i is outside start ($startIdx) and end ($endIdx)',
          );
        }
      }
    }

    if (!dragEvents.sublist(startIdx + 1, endIdx).any((e) => e.$3 == DragType.move)) {
      throw StateError('Drag must contain at least one move event');
    }

    final dragStart = dragEvents[startIdx];
    final dragEnd = dragEvents[endIdx];

    // Coordinates and zoom correlation
    if ((dragStart.$1.latitude - preDrag.latitude).abs() >
            _coordTolerance ||
        (dragStart.$1.longitude - preDrag.longitude).abs() >
            _coordTolerance) {
      throw StateError(
        'Drag start coordinate out of tolerance: expected near $preDrag, got ${dragStart.$1}',
      );
    }

    if (dragStart.$2 < 15 || dragStart.$2 > 19) {
      throw StateError('Drag start zoom invalid: ${dragStart.$2}');
    }
    if (dragEnd.$2 < 15 || dragEnd.$2 > 19) {
      throw StateError('Drag end zoom invalid: ${dragEnd.$2}');
    }

    if ((dragEnd.$1.latitude - dragStart.$1.latitude).abs() < 0.00001 &&
        (dragEnd.$1.longitude - dragStart.$1.longitude).abs() < 0.00001) {
      throw StateError(
        'Drag end center did not shift from drag start center',
      );
    }
  } finally {
    await unmountLiveMap();
  }
}

