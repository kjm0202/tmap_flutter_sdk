import 'package:flutter/foundation.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'gesture_target.dart';
import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

/// Uses the CDP driver, which issues trusted touch input to the real map.
Future<void> testMapTouchEvents() async {
  if (!kIsWeb) throw StateError('map_touch requires Chrome CDP input driver');
  final starts = <LatLng>[];
  final ends = <LatLng>[];
  final controller = await mountLiveMap((created) => TMap(
        center: const LatLng(37.5665, 126.978),
        onTouchStart: starts.add,
        onTouchEnd: ends.add,
        onMapCreated: created,
      ));
  try {
    await expectLive('Map touch canvas ready',
        () => checkJs(controller, '!!map.vsmMap().getCanvas()'));
    final target = await gestureTarget(controller, 0.62, 0.43);
    await checkJs(controller, '''(function() {
      window.__sdkTouchCounts = {start:0,end:0};
      map.on('TouchStart', function(e) {
        window.__sdkTouchCounts.start++;
      });
      map.on('TouchEnd', function(e) {
        window.__sdkTouchCounts.end++;
      });
      window.__tmapTrustedGesture = {
        id: Date.now(), action:'hold', x:${target.x}, y:${target.y}, done:false
      };
      return true;
    })()''');

    await expectLive(
      'CDP trusted touch hold completed',
      () => checkJs(controller,
          'window.__tmapTrustedGesture && window.__tmapTrustedGesture.done === true'),
    );
    await expectLive(
        'Map SDK TouchStart and TouchEnd events fired',
        () => checkJs(controller,
            'window.__sdkTouchCounts.start > 0 && window.__sdkTouchCounts.end > 0'));

    await expectLive(
      'Map TouchStart callback delivers typed LatLng at touch location',
      () async =>
          starts.isNotEmpty &&
          starts.last.latitude.isFinite &&
          starts.last.longitude.isFinite,
    );
    await expectLive(
      'Map TouchEnd callback delivers typed LatLng at touch location',
      () async =>
          ends.isNotEmpty &&
          ends.last.latitude.isFinite &&
          ends.last.longitude.isFinite,
    );
    target.expectCoordinate(starts.last, 'SDK TouchStart');
    target.expectCoordinate(ends.last, 'SDK TouchEnd');
  } finally {
    await unmountLiveMap();
  }
}

/// Right-click triggers the separate ContextMenu SDK event in Chrome.
Future<void> testMapContextMenu() async {
  if (!kIsWeb) {
    throw StateError('map_context_menu requires Chrome CDP input driver');
  }
  final contextMenus = <LatLng>[];
  final controller = await mountLiveMap((created) => TMap(
        center: const LatLng(37.5665, 126.978),
        onMapLongTap: contextMenus.add,
        onMapCreated: created,
      ));
  try {
    await expectLive('Map context menu canvas ready',
        () => checkJs(controller, '!!map.vsmMap().getCanvas()'));
    final target = await gestureTarget(controller, 0.60, 0.40);
    await checkJs(controller, '''(function() {
      window.__sdkContextCount = 0;
      map.on('ContextMenu', function() { window.__sdkContextCount++; });
      window.__tmapTrustedGesture = {
        id: Date.now(), action:'contextMenu',
        x:${target.x}, y:${target.y}, done:false
      };
      return true;
    })()''');
    await expectLive(
      'CDP trusted context menu click completed',
      () => checkJs(controller,
          'window.__tmapTrustedGesture && window.__tmapTrustedGesture.done === true'),
    );
    await expectLive(
      'Map ContextMenu callback delivers typed LatLng from SDK event',
      () async =>
          contextMenus.isNotEmpty &&
          await checkJs(controller, 'window.__sdkContextCount > 0'),
    );
    target.expectCoordinate(contextMenus.last, 'SDK ContextMenu');
  } finally {
    await unmountLiveMap();
  }
}
