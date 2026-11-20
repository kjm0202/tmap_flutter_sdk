import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

Future<void> testMapControls() async {
  final controller = await mountLiveMap((created) => TMap(
        center: const LatLng(37.5665, 126.978),
        naviControl: true,
        scaleBar: true,
        onMapCreated: created,
      ));
  try {
    await expectLive(
      'Map constructor naviControl and scaleBar attach real VSM controls',
      () => checkJs(controller,
          'Boolean(map.__tmapNaviControl && map.__tmapScaleBarControl)'),
    );
  } finally {
    await unmountLiveMap();
  }
}

Future<void> testMapAdvancedOptions() async {
  const displayBounds = LatLngBounds(
    southWest: LatLng(37.55, 126.965),
    northEast: LatLng(37.58, 126.99),
  );
  const outerBounds = LatLngBounds(
    southWest: LatLng(37.4, 126.7),
    northEast: LatLng(37.8, 127.3),
  );
  final controller = await mountLiveMap((created) => TMap(
        center: const LatLng(37.5665, 126.978),
        zoom: 15,
        bounds: displayBounds,
        maxBounds: outerBounds,
        minPitch: 5,
        maxPitch: 50,
        onMapCreated: created,
      ));
  try {
    await expectLive(
      'Map options.bounds fits both initial geographic corners',
      () async {
        final view = await controller.getBounds();
        return view.contains(displayBounds.southWest) &&
            view.contains(displayBounds.northEast);
      },
    );
    await controller.setPitch(60);
    await expectLive(
      'Map options.maxPitch clamps SDK pitch to 50',
      () async => (await controller.getPitch() - 50).abs() < 0.001,
    );
    await controller.setPitch(0);
    await expectLive(
      'Map options.minPitch clamps SDK pitch to 5',
      () async => (await controller.getPitch() - 5).abs() < 0.001,
    );
    await controller.setCenter(const LatLng(37.65, 127.12));
    await expectLive(
      'Map options.maxBounds allows movement within maximum area',
      () async {
        final current = await controller.getCenter();
        return (current.latitude - 37.65).abs() < 0.015 &&
            (current.longitude - 127.12).abs() < 0.015;
      },
    );
    await controller.setCenter(const LatLng(38.5, 128.5));
    await expectLive(
      'Map options.maxBounds rejects center outside allowed area',
      () async => outerBounds.contains(await controller.getCenter()),
    );
  } finally {
    await unmountLiveMap();
  }
}
