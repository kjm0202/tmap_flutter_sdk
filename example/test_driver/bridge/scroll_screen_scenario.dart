import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'gesture_target.dart';
import 'live_scenario.dart';
import 'native_input_stub.dart' if (dart.library.io) 'native_input.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _initialCenter = LatLng(37.5665, 126.9780);

/// Exercises gesture arbitration in a real scrollable screen and reload's base URL.
Future<void> testScrollScreenScenario() async {
  final failures = <String>[];
  Future<void> stage(String name, Future<void> Function() run) async {
    try {
      await run();
    } catch (error) {
      failures.add('$name: $error');
    }
  }

  await stage('default', () => _testScrollScreen(eager: false));
  await stage('eager', () => _testScrollScreen(eager: true));
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
    await stage('standalone', _testStandaloneDefault);
    await stage('non-scrollable parent', _testNonScrollableParent);
    await stage('dynamic content', testScrollScreenDynamic);
  }
  await stage('reload', _testRelativeReload);
  if (failures.isNotEmpty) {
    throw StateError('Scroll screen failures: ${failures.join('; ')}');
  }
}

/// Tests changes in scroll extent without replacing the map or its parent.
Future<void> testScrollScreenDynamic() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS || !useNativeInput) {
    throw StateError('Dynamic scroll test requires iOS native input');
  }

  final mapKey = GlobalKey();
  final scroll = ScrollController();
  final contentHeight = ValueNotifier<double>(0);
  final failures = <String>[];
  final sinceLayout = Stopwatch();
  int? downMicros;
  int? moveMicros;
  int? pointer;
  final controller = await mountLiveMap((created) {
    // This widget is not rebuilt when contentHeight changes.
    final map = SizedBox(
      key: mapKey,
      height: 260,
      width: double.infinity,
      child: TMap(
        onMapCreated: created,
        center: _initialCenter,
        zoom: 16,
        naviControl: false,
        scaleBar: false,
      ),
    );
    return Scaffold(
      body: SafeArea(
        child: Listener(
          onPointerDown: (event) {
            if (sinceLayout.isRunning && downMicros == null) {
              pointer = event.pointer;
              downMicros = sinceLayout.elapsedMicroseconds;
            }
          },
          onPointerMove: (event) {
            if (sinceLayout.isRunning && event.pointer == pointer) {
              moveMicros ??= sinceLayout.elapsedMicroseconds;
            }
          },
          child: SingleChildScrollView(
            controller: scroll,
            child: Column(children: [
              map,
              ValueListenableBuilder<double>(
                valueListenable: contentHeight,
                builder: (_, height, __) => SizedBox(height: height),
              ),
            ]),
          ),
        ),
      ),
    );
  });

  try {
    await expectLive(
      'dynamic content map canvas ready',
      () => checkJs(controller,
          'Boolean(map && map.vsmMap && map.vsmMap().getCanvas())'),
    );
    await WidgetsBinding.instance.endOfFrame;
    if (!scroll.position.hasContentDimensions ||
        scroll.position.maxScrollExtent != 0 ||
        scroll.offset != 0) {
      throw StateError('Dynamic test did not start with a fitting parent');
    }

    Future<void> transition(String label, double height,
        {required bool shouldScroll}) async {
      // Settle and measure before changing content. After the change there is
      // only the layout frame and the gesture, with no preparatory gesture or
      // delay that could mask a stale scroll guard.
      if (scroll.offset != 0) {
        scroll.jumpTo(0);
        await WidgetsBinding.instance.endOfFrame;
      }
      final before = await currentGestureCenter(controller);
      final rect = _bounds(mapKey);
      final from = Offset(rect.center.dx, rect.top + rect.height * .68);
      final to = Offset(rect.center.dx, rect.top + rect.height * .30);
      final armed = await prepareNativeDrag(from.dx, from.dy, to.dx, to.dy);
      downMicros = null;
      moveMicros = null;
      pointer = null;
      contentHeight.value = height;
      await WidgetsBinding.instance.endOfFrame;
      sinceLayout
        ..reset()
        ..start();
      final extent = scroll.position.maxScrollExtent;
      final offsetBefore = scroll.offset;
      if (!scroll.position.hasContentDimensions ||
          offsetBefore != 0 ||
          (extent > 0) != shouldScroll ||
          _bounds(mapKey) != rect) {
        throw StateError(
            '$label: incorrect layout: extent=$extent, offset=$offsetBefore');
      }
      await fireNativeDrag(armed);
      sinceLayout.stop();
      await Future<void>.delayed(const Duration(milliseconds: 900));
      final delta = _centerDelta(before, await currentGestureCenter(controller));
      final scrollDelta = scroll.offset - offsetBefore;
      debugPrint('SCROLL_SCREEN mode=dynamic_$label '
          'extent=${extent.toStringAsFixed(1)} '
          'parent_px=${scrollDelta.toStringAsFixed(1)} '
          'map_center=${delta.toStringAsFixed(8)} '
          'layout_to_down_us=$downMicros '
          'down_to_move_us=${downMicros != null && moveMicros != null ? moveMicros! - downMicros! : null}');
      if (downMicros == null || moveMicros == null) {
        failures.add('$label: missing Flutter pointer down or move observation');
      }
      if (shouldScroll
          ? scrollDelta < 20 || delta > 0.000001
          : scrollDelta.abs() > 2 || delta < 0.00001) {
        failures.add('$label: parent=$scrollDelta, map=$delta');
      }
    }

    await transition('to_scrollable', 2000, shouldScroll: true);
    await transition('to_fitting', 0, shouldScroll: false);
    if (failures.isNotEmpty) {
      throw StateError('Dynamic scroll failures: ${failures.join('; ')}');
    }
  } finally {
    await unmountLiveMap();
    contentHeight.dispose();
    scroll.dispose();
  }
}

Future<void> _testScrollScreen({required bool eager}) async {
  final scroll = ScrollController();
  final headerKey = GlobalKey();
  final mapKey = GlobalKey();
  var taps = 0;
  final label = eager ? 'explicit eager recognizer' : 'default recognizers';
  final controller = await mountLiveMap(
    (created) => Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          controller: scroll,
          child: Column(
            children: [
              SizedBox(key: headerKey, height: 140, width: double.infinity),
              SizedBox(
                key: mapKey,
                height: 260,
                width: double.infinity,
                child: TMap(
                  onMapCreated: created,
                  onMapTap: (_) => taps++,
                  center: _initialCenter,
                  zoom: 16,
                  naviControl: false,
                  scaleBar: false,
                  gestureRecognizers: eager
                      ? {
                          Factory<OneSequenceGestureRecognizer>(
                            () => EagerGestureRecognizer(),
                          ),
                        }
                      : const <Factory<OneSequenceGestureRecognizer>>{},
                ),
              ),
              const SizedBox(height: 900),
            ],
          ),
        ),
      ),
    ),
  );

  try {
    await expectLive(
      '$label canvas ready',
      () => checkJs(
        controller,
        'Boolean(map && map.vsmMap && map.vsmMap().getCanvas())',
      ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 400));

    // A drag outside the platform view must actually scroll the parent. This
    // also proves that the host coordinates and the scrollable are usable.
    final outsideBefore = await currentGestureCenter(controller);
    final header = _bounds(headerKey);
    await _drag(
      controller,
      header.center + const Offset(0, 45),
      header.center - const Offset(0, 45),
    );
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (scroll.offset < 20) {
      throw StateError(
        '$label: outside drag did not scroll parent: ${scroll.offset}',
      );
    }
    final outsideAfter = await currentGestureCenter(controller);
    final outsideScrollDelta = scroll.offset;
    final outsideCenterDelta = _centerDelta(outsideBefore, outsideAfter);
    _expectCenterUnchanged(outsideBefore, outsideAfter, '$label outside drag');

    scroll.jumpTo(0);
    await WidgetsBinding.instance.endOfFrame;
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final rect = _bounds(mapKey);
    final size = MediaQueryData.fromView(
      ui.PlatformDispatcher.instance.implicitView ??
          ui.PlatformDispatcher.instance.views.first,
    ).size;
    final from = Offset(rect.center.dx, rect.top + rect.height * .68);
    final to = Offset(rect.center.dx, rect.top + rect.height * .30);
    if (from.dx <= 0 ||
        from.dx >= size.width ||
        from.dy >= size.height ||
        to.dy <= 0 ||
        to.dy >= size.height) {
      throw StateError(
        '$label: map drag points outside viewport: $from -> $to in $size',
      );
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS && !eager) {
      final initialTapCount = taps;
      await driveNativeInput('tapApp', rect.center.dx, rect.center.dy);
      await expectLive('scrollable map tap callback',
          () async => taps == initialTapCount + 1);
      final horizontalBefore = await currentGestureCenter(controller);
      final horizontalScrollBefore = scroll.offset;
      await _drag(controller, rect.center + const Offset(-55, 0),
          rect.center + const Offset(55, 0));
      await Future<void>.delayed(const Duration(milliseconds: 900));
      final horizontalAfter = await currentGestureCenter(controller);
      final horizontalDelta = _centerDelta(horizontalBefore, horizontalAfter);
      if (horizontalDelta < 0.00001 ||
          (scroll.offset - horizontalScrollBefore).abs() > 2) {
        throw StateError(
            'default: horizontal map drag failed: map=$horizontalDelta, parent=${scroll.offset - horizontalScrollBefore}');
      }
      debugPrint(
          'SCROLL_SCREEN mode=default_horizontal map=${horizontalDelta.toStringAsFixed(8)}');
      await driveNativeInput('pinchMap', rect.center.dx, rect.center.dy);
      await expectLive('scrollable map pinch zoom',
          () => checkJs(controller, 'map.getZoom() > 16.1'));
      debugPrint('SCROLL_SCREEN mode=default_pinch zoomed=true');
      await controller.setZoom(16);
      await controller.setCenter(_initialCenter);
      await Future<void>.delayed(const Duration(milliseconds: 700));
    }
    final before = await currentGestureCenter(controller);
    final scrollBefore = scroll.offset;
    await _drag(controller, from, to);
    await Future<void>.delayed(const Duration(milliseconds: 900));
    final after = await currentGestureCenter(controller);
    final scrollDelta = scroll.offset - scrollBefore;
    final centerDelta = _centerDelta(before, after);

    // Web's HTML map owns gestures in both configurations. Mobile WebView
    // participates in Flutter's gesture arena with the supplied recognizers.
    if (kIsWeb || eager) {
      if (scrollDelta.abs() > 2 || centerDelta < 0.00001) {
        throw StateError(
          '$label: expected map pan without parent scroll; '
          'scroll delta=$scrollDelta, center $before -> $after',
        );
      }
    } else if (scrollDelta < 20 || centerDelta > 0.000001) {
      throw StateError(
        '$label: expected parent scroll without map pan; '
        'scroll delta=$scrollDelta, center $before -> $after',
      );
    }
    debugPrint('SCROLL_SCREEN mode=${eager ? 'eager' : 'default'} '
        'outside_px=${outsideScrollDelta.toStringAsFixed(1)} '
        'outside_center=${outsideCenterDelta.toStringAsFixed(8)} '
        'inside_px=${scrollDelta.toStringAsFixed(1)} '
        'inside_center=${centerDelta.toStringAsFixed(8)}');
  } finally {
    await unmountLiveMap();
    scroll.dispose();
  }
}

Future<void> _testStandaloneDefault() async {
  final mapKey = GlobalKey();
  final controller = await mountLiveMap((created) => SizedBox.expand(
        key: mapKey,
        child: TMap(onMapCreated: created, center: _initialCenter, zoom: 16),
      ));
  try {
    await expectLive(
        'standalone map canvas ready',
        () => checkJs(controller,
            'Boolean(map && map.vsmMap && map.vsmMap().getCanvas())'));
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final rect = _bounds(mapKey);
    final before = await currentGestureCenter(controller);
    await _drag(
        controller,
        Offset(rect.center.dx, rect.top + rect.height * .60),
        Offset(rect.center.dx, rect.top + rect.height * .40));
    await Future<void>.delayed(const Duration(milliseconds: 900));
    final delta = _centerDelta(before, await currentGestureCenter(controller));
    if (delta < 0.00001) {
      throw StateError(
          'Standalone default map did not pan: center delta=$delta');
    }
    debugPrint(
        'SCROLL_SCREEN mode=standalone_default inside_center=${delta.toStringAsFixed(8)}');
  } finally {
    await unmountLiveMap();
  }
}

Future<void> _testNonScrollableParent() async {
  final mapKey = GlobalKey();
  final scroll = ScrollController();
  final controller = await mountLiveMap((created) => Scaffold(
        body: SingleChildScrollView(
          controller: scroll,
          physics: const NeverScrollableScrollPhysics(),
          child: Column(children: [
            SizedBox(
                key: mapKey,
                height: 300,
                child: TMap(
                    onMapCreated: created, center: _initialCenter, zoom: 16)),
            const SizedBox(height: 900),
          ]),
        ),
      ));
  try {
    await expectLive(
        'non-scrollable parent map ready',
        () => checkJs(controller,
            'Boolean(map && map.vsmMap && map.vsmMap().getCanvas())'));
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final rect = _bounds(mapKey);
    final before = await currentGestureCenter(controller);
    await _drag(controller, rect.center + const Offset(0, 50),
        rect.center - const Offset(0, 50));
    await Future<void>.delayed(const Duration(milliseconds: 900));
    final delta = _centerDelta(before, await currentGestureCenter(controller));
    if (delta < 0.00001 || scroll.offset.abs() > 2) {
      throw StateError(
          'Non-scrollable parent should allow map pan: map=$delta, parent=${scroll.offset}');
    }
    debugPrint(
        'SCROLL_SCREEN mode=non_scrollable_parent inside_center=${delta.toStringAsFixed(8)}');
  } finally {
    await unmountLiveMap();
    scroll.dispose();
  }
}

Rect _bounds(GlobalKey key) {
  final box = key.currentContext?.findRenderObject() as RenderBox?;
  if (box == null || !box.hasSize) {
    throw StateError('Gesture target is not laid out');
  }
  return box.localToGlobal(Offset.zero) & box.size;
}

double _centerDelta(LatLng a, LatLng b) =>
    (a.latitude - b.latitude).abs() + (a.longitude - b.longitude).abs();

void _expectCenterUnchanged(LatLng a, LatLng b, String label) {
  if (_centerDelta(a, b) > 0.000001) {
    throw StateError('$label unexpectedly moved map center: $a -> $b');
  }
}

Future<void> _drag(TMapController controller, Offset from, Offset to) async {
  if (useNativeInput) {
    final view = ui.PlatformDispatcher.instance.implicitView ??
        ui.PlatformDispatcher.instance.views.first;
    final scale = defaultTargetPlatform == TargetPlatform.android
        ? view.devicePixelRatio
        : 1.0;
    await driveNativeInput(
      defaultTargetPlatform == TargetPlatform.iOS ? 'dragApp' : 'drag',
      from.dx * scale,
      from.dy * scale,
      endX: to.dx * scale,
      endY: to.dy * scale,
    );
    return;
  }
  if (!kIsWeb) throw StateError('Android/iOS requires TMAP_GESTURE_PORT');
  await checkJs(controller, '''(function() {
    var priorId = (window.__tmapTrustedGesture && window.__tmapTrustedGesture.id) || 0;
    window.__tmapTrustedGesture = {id: priorId + 1, action: 'dragTouch',
      x: ${from.dx}, y: ${from.dy}, endX: ${to.dx}, endY: ${to.dy}, done: false};
    return true;
  })()''');
  await expectLive(
    'Chrome trusted drag completion',
    () => checkJs(
      controller,
      'window.__tmapTrustedGesture && window.__tmapTrustedGesture.done === true',
    ),
  );
  if (await checkJs(controller, 'window.__tmapTrustedGesture.error')) {
    throw StateError('Chrome trusted drag failed');
  }
}

Future<void> _testRelativeReload() async {
  final controller = await mountLiveMap(
    (created) => TMap(onMapCreated: created),
  );
  try {
    if (kIsWeb) {
      await expectLive(
        'web map ready before reload no-ops',
        () => checkJs(
          controller,
          'Boolean(map && map.vsmMap && map.vsmMap().getCanvas())',
        ),
      );
      final before = await currentGestureCenter(controller);
      await checkJs(controller, '(window.__scrollReloadMap = map, true)');
      await controller.reloadHtml(
        '<div id="scroll-reload-sentinel"></div>',
        baseUrl: 'https://example.com/bridge/base/',
      );
      await controller.reload();
      if (!await checkJs(
        controller,
        'map === window.__scrollReloadMap && '
        '!document.getElementById("scroll-reload-sentinel")',
      )) {
        throw StateError('Web reload methods changed the live map or document');
      }
      _expectCenterUnchanged(
        before,
        await currentGestureCenter(controller),
        'web reload',
      );
      debugPrint('SCROLL_SCREEN reload=web_noop base=ignored');
    } else {
      const base = 'https://example.com/bridge/base/';
      const html = '<!doctype html><html><body>'
          '<a id="relative-link" href="../asset/item.html?probe=1">relative</a>'
          '</body></html>';
      const resolved = 'https://example.com/bridge/asset/item.html?probe=1';
      final expression =
          'document.getElementById("relative-link")?.href === "$resolved"';
      await controller.reloadHtml(html, baseUrl: base);
      await _expectReload('custom base URL resolves relative link',
          () => checkJs(controller, expression));
      await _expectReload(
          'transient reload flag set',
          () => checkJs(
              controller, '(window.__scrollReloadTransient = true, true)'));
      await _expectReload('transient reload flag observed',
          () => checkJs(controller, 'window.__scrollReloadTransient === true'));
      await controller.reload();
      await _expectReload(
        'reload retains custom base URL and reloads HTML',
        () => checkJs(
          controller,
          '$expression && typeof window.__scrollReloadTransient === "undefined"',
        ),
      );
      debugPrint('SCROLL_SCREEN reload=html_reloaded base=relative_resolved');
    }
  } finally {
    await unmountLiveMap();
  }
}

// WebView JavaScript can be unavailable or return late while a document is
// being replaced. Bound each attempt and the total wait, as in the lifecycle
// reload probe, so a navigation cannot stall the scenario indefinitely.
Future<void> _expectReload(
    String label, Future<bool> Function() predicate) async {
  final deadline = DateTime.now().add(const Duration(seconds: 30));
  while (DateTime.now().isBefore(deadline)) {
    final remaining = deadline.difference(DateTime.now());
    if (remaining <= Duration.zero) break;
    try {
      final attempt = remaining < const Duration(seconds: 1)
          ? remaining
          : const Duration(seconds: 1);
      if (await predicate().timeout(attempt)) return;
    } catch (_) {
      // Navigation can temporarily invalidate or delay a WebView JS call.
    }
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }
  throw StateError('Timed out waiting for $label');
}
