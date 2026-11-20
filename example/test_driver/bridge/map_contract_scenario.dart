import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _seoul = LatLng(37.5665, 126.978);

bool _near(num value, num target, [double tolerance = 1e-6]) =>
    (value - target).abs() <= tolerance;

Future<void> testMapContract() async {
  var createdCount = 0;
  TMapController? receivedController;
  final controller = await mountLiveMap((created) => TMap(
        center: _seoul,
        zoom: 15,
        minZoom: 6,
        maxZoom: 18,
        bearing: 12,
        pitch: 10,
        onMapCreated: (value) {
          createdCount++;
          receivedController = value;
          created(value);
        },
      ));
  var step = 'ConfigLoad';
  try {
    await expectLive(
      'ConfigLoad creates typed Flutter TMapController once',
      () async =>
          createdCount == 1 && identical(receivedController, controller),
    );

    step = 'camera getters';
    await expectLive(
      'Map camera getters return SDK center zoom bearing pitch',
      () async {
        final center = await controller.getCenter();
        final zoom = await controller.getZoom();
        final bearing = await controller.getBearing();
        final pitch = await controller.getPitch();
        final sdk = Map<String, dynamic>.from(await runJs(
            controller,
            '({latitude:map.getCenter().lat(),longitude:map.getCenter().lng(),'
            'zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()})'));
        return _near(center.latitude, _seoul.latitude) &&
            _near(center.longitude, _seoul.longitude) &&
            _near(zoom, (sdk['zoom'] as num)) &&
            _near(bearing, (sdk['bearing'] as num)) &&
            _near(pitch, (sdk['pitch'] as num)) &&
            _near(zoom, 15, 0.2) &&
            _near(bearing, 12, 0.2) &&
            _near(pitch, 10, 0.2);
      },
    );

    step = 'bounds getter';
    await expectLive(
      'Map getBounds matches SDK rectangle corners',
      () async {
        final bounds = await controller.getBounds();
        final sdk = Map<String, dynamic>.from(await runJs(
            controller,
            '(function(){var b=map.getBounds(), sw=b.getSouthWest(),'
            'ne=b.getNorthEast();'
            'return {swLat:sw.lat(),swLng:sw.lng(),'
            'neLat:ne.lat(),neLng:ne.lng()};})()'));
        return _near(bounds.southWest.latitude, sdk['swLat'] as num) &&
            _near(bounds.southWest.longitude, sdk['swLng'] as num) &&
            _near(bounds.northEast.latitude, sdk['neLat'] as num) &&
            _near(bounds.northEast.longitude, sdk['neLng'] as num) &&
            bounds.contains(_seoul);
      },
    );

    step = 'zoom limits getters';
    await expectLive(
      'Map initial getMinZoom and getMaxZoom reflect widget options',
      () async =>
          _near(await controller.getMinZoom(), 6) &&
          _near(await controller.getMaxZoom(), 18),
    );

    step = 'screenSize';
    await expectLive(
      'Map screenSize matches SDK rendered pixel dimensions',
      () async {
        final size = await controller.screenSize();
        final sdk = Map<String, dynamic>.from(await runJs(
            controller,
            '(function(){var s=map.screenSize(); return {width:s._width,'
            'height:s._height};})()'));
        return size.width > 0 &&
            size.height > 0 &&
            _near(size.width, sdk['width'] as num) &&
            _near(size.height, sdk['height'] as num);
      },
    );

    step = 'pixel projection';
    await expectLive(
      'Map realToScreen and screenToReal match SDK and round-trip',
      () async {
        const location = LatLng(37.5702, 126.9832);
        final pixel = await controller.realToScreen(location);
        final rawPixel = Map<String, dynamic>.from(await runJs(
            controller,
            '(function(){var p=map.realToScreen(new Tmapv3.LatLng('
            '${location.latitude},${location.longitude}));'
            'return {x:typeof p.getX === "function" ? p.getX() : p.x,'
            'y:typeof p.getY === "function" ? p.getY() : p.y};})()'));
        final recovered = await controller.screenToReal(pixel);
        final rawCoordinate = Map<String, dynamic>.from(await runJs(
            controller,
            '(function(){var p=map.screenToReal(new Tmapv3.Point('
            '${pixel.x},${pixel.y}));'
            'return {latitude:p.lat(),longitude:p.lng()};})()'));
        return pixel.x.isFinite &&
            pixel.y.isFinite &&
            _near(pixel.x, rawPixel['x'] as num) &&
            _near(pixel.y, rawPixel['y'] as num) &&
            _near(recovered.latitude, rawCoordinate['latitude'] as num, 1e-7) &&
            _near(
                recovered.longitude, rawCoordinate['longitude'] as num, 1e-7) &&
            _near(recovered.latitude, location.latitude, 1e-5) &&
            _near(recovered.longitude, location.longitude, 1e-5);
      },
    );

    step = 'setZoomLimit';
    await controller.setZoomLimit(10, 14);
    await expectLive(
      'Map setZoomLimit updates SDK min and max getters',
      () async =>
          _near(await controller.getMinZoom(), 10) &&
          _near(await controller.getMaxZoom(), 14) &&
          await checkJs(
              controller, 'map.getMinZoom() === 10 && map.getMaxZoom() === 14'),
    );
  } catch (error) {
    throw StateError('Map step $step: ${error.runtimeType}: $error');
  } finally {
    await unmountLiveMap();
  }
}
