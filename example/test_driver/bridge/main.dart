import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _markerId = "bridge'\"마커";
const _target = LatLng(37.57, 126.98);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const appKey = String.fromEnvironment('TMAP_APP_KEY');
  if (appKey.isEmpty) throw StateError('TMAP_APP_KEY is required');
  AuthRepository.initialize(appKey: appKey);

  var taps = 0;
  final controller = await mountLiveMap(
    (created) => TMap(
      onMapCreated: created,
      onMarkerTap: (id, position, zoom) {
        if (id != _markerId ||
            (position.latitude - _target.latitude).abs() > 0.0001 ||
            (position.longitude - _target.longitude).abs() > 0.0001 ||
            zoom != 15) {
          throw StateError('Unexpected marker tap payload');
        }
        taps++;
      },
    ),
  );

  await controller.setCenter(_target);
  await controller.setZoom(15);
  await expectLive(
      'camera',
      () => checkJs(
          controller,
          'Math.abs(map.getCenter().lat() - 37.57) < 0.001 && '
          'Math.abs(map.getCenter().lng() - 126.98) < 0.001 && '
          'Math.round(map.getZoom()) === 15'));

  await controller.addMarker(const Marker(
    markerId: _markerId,
    position: _target,
    icon: MarkerIcon(iconHtml: '<span id="bridge-tap-target">M</span>'),
  ));
  const element = 'document.getElementById("bridge-tap-target")';
  await expectLive('marker creation', () => checkJs(controller, '!!$element'));
  await checkJs(controller,
      '(window.savedBridgeMarker = $element, window.savedBridgeMarker.click(), true)');
  await expectLive('marker tap', () async => taps == 1);

  await controller.clearMarker(_markerId);
  await expectLive('marker removal', () => checkJs(controller, '!$element'));
  await checkJs(controller, '(window.savedBridgeMarker.click(), true)');
  await Future<void>.delayed(const Duration(milliseconds: 250));
  if (taps != 1) throw StateError('Tap delivered after marker removal');

  await unmountLiveMap();
  if (kIsWeb &&
      !await checkJs(
          controller, 'Object.keys(window.tmap_instances).length === 0')) {
    throw StateError('Map retained after disposal');
  }
  debugPrint('BRIDGE_PROBE_PASS');
}
