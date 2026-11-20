import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

/// Reads the official SDK independently of the Flutter projection wrapper.
Future<Map<String, dynamic>> _sdkProjection(
    TMapController controller, String method, Object source) async {
  final String input;
  if (source is LatLng) {
    input = 'new Tmapv3.LatLng(${source.latitude}, ${source.longitude})';
  } else if (source is Point) {
    input = 'new Tmapv3.Point(${source.x}, ${source.y})';
  } else {
    throw ArgumentError.value(source);
  }
  final result = await runJs(
      controller,
      '(function() {'
      'var p = new Tmapv3.Projection();'
      'var fn = typeof p[${jsonEncode(method)}] === "function" ? '
      'p[${jsonEncode(method)}] : Tmapv3.Projection[${jsonEncode(method)}];'
      'var value = fn.call(p, $input);'
      'if (!value) throw new Error("No projection result");'
      'if (typeof value.lat === "function") {'
      '  return {latitude:value.lat(), longitude:value.lng()};'
      '}'
      'return {x:typeof value.getX === "function" ? value.getX() : value.x,'
      ' y:typeof value.getY === "function" ? value.getY() : value.y};'
      '})()');
  final decoded = result is String ? jsonDecode(result) : result;
  return Map<String, dynamic>.from(decoded as Map);
}

void _samePoint(Point actual, Map<String, dynamic> expected, String label) {
  final dx = (actual.x - (expected['x'] as num).toDouble()).abs();
  final dy = (actual.y - (expected['y'] as num).toDouble()).abs();
  if (dx > 1e-7 || dy > 1e-7) {
    throw StateError('$label point deviation: x=$dx, y=$dy');
  }
}

void _sameLatLng(LatLng actual, Map<String, dynamic> expected, String label) {
  final dLat =
      (actual.latitude - (expected['latitude'] as num).toDouble()).abs();
  final dLng =
      (actual.longitude - (expected['longitude'] as num).toDouble()).abs();
  if (dLat > 1e-7 || dLng > 1e-7) {
    throw StateError('$label degree deviation: lat=$dLat, lng=$dLng');
  }
}

Future<void> testProjectionScenario() async {
  final controller =
      await mountLiveMap((created) => TMap(onMapCreated: created));
  final projection = Projection(controller);
  var step = 'bridge readiness';
  try {
    final readinessResult = await runJs(
        controller,
        '({entry:typeof ${kIsWeb ? 'window.tmap_convertProjection' : 'convertProjection'},'
        'shared:typeof tmapBridge.convertProjection})');
    final decoded = readinessResult is String
        ? jsonDecode(readinessResult)
        : readinessResult;
    final readiness = Map<String, dynamic>.from(decoded as Map);
    if (readiness['entry'] != 'function' || readiness['shared'] != 'function') {
      throw StateError('Projection bridge missing: $readiness');
    }
    await expectLive(
      'Projection seven conversions match official SDK within 1e-7 at three points',
      () async {
        for (final origin in [
          const LatLng(37.5665, 126.978), // Seoul
          const LatLng(35.1796, 129.0756), // Busan
          const LatLng(33.4996, 126.5312), // Jeju
        ]) {
          step = 'BesselGEOToWGS84GEO';
          _sameLatLng(
            await projection.convertBesselGEOToWGS84GEO(origin),
            await _sdkProjection(
                controller, 'convertBesselGEOToWGS84GEO', origin),
            'Bessel GEO -> WGS84',
          );
          step = 'WGS84GEOToBesselGEO';
          _sameLatLng(
            await projection.convertWGS84GEOToBesselGEO(origin),
            await _sdkProjection(
                controller, 'convertWGS84GEOToBesselGEO', origin),
            'WGS84 -> Bessel GEO',
          );
          step = 'WGS84GEOToBesselTM';
          final tm = await projection.convertWGS84GEOToBesselTM(origin);
          _samePoint(
            tm,
            await _sdkProjection(
                controller, 'convertWGS84GEOToBesselTM', origin),
            'WGS84 -> Bessel TM',
          );
          step = 'BesselTMToWGS84GEO';
          _sameLatLng(
            await projection.convertBesselTMToWGS84GEO(tm),
            await _sdkProjection(controller, 'convertBesselTMToWGS84GEO', tm),
            'Bessel TM -> WGS84',
          );
          step = 'WGS84GEOToKatec';
          _samePoint(
            await projection.convertWGS84GEOToKatec(origin),
            await _sdkProjection(controller, 'convertWGS84GEOToKatec', origin),
            'WGS84 -> KATEC',
          );
          step = 'WGS84GEOToEPSG3857';
          final mercator = projection.convertWGS84GEOToEPSG3857(origin);
          _samePoint(
            mercator,
            await _sdkProjection(
                controller, 'convertWGS84GEOToEPSG3857', origin),
            'WGS84 -> EPSG3857 Dart math',
          );
          step = 'EPSG3857ToWGS84GEO';
          _sameLatLng(
            projection.convertEPSG3857ToWGS84GEO(mercator),
            await _sdkProjection(
                controller, 'convertEPSG3857ToWGS84GEO', mercator),
            'EPSG3857 -> WGS84 Dart math',
          );
        }
        return true;
      },
    );
  } catch (error) {
    throw StateError('Projection step $step: ${error.runtimeType}: $error');
  } finally {
    await unmountLiveMap();
  }
}
