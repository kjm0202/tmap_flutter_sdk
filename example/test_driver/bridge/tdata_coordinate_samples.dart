import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

/// Controlled model sample replayed through the released `RouteInfo` and
/// `PoiItem` parsers. It uses no map, app key, HTTP client or network, so the
/// same observation is printed on web, Android and iOS.
///
/// Standalone: `flutter run -t test_driver/bridge/tdata_coordinate_samples.dart`
void main() {
  try {
    verifyReleasedCoordinateSamples();
  } catch (_) {
    debugPrint('MODEL_REPLAY_FAIL');
    rethrow;
  }
  debugPrint('MODEL_REPLAY_PASS');
}

/// Prints one `TDATA_MODEL_REPLAY` observation and throws when a public
/// release condition is not met.
void verifyReleasedCoordinateSamples() {
  final failures = <String>[];
  void expect(String id, bool ok) {
    if (!ok) failures.add(id);
  }

  // Mixed route payload archived in historical-route.dart, replayed as is.
  final route = RouteInfo.fromJson({
    'type': 'FeatureCollection',
    'extra': {'value': null},
    'features': [
      {
        'geometry': {
          'type': 'Point',
          'coordinates': [127, 37, 42],
        },
        'properties': {'road': 'start'},
      },
      {
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [127, 37, 10],
            [128, 38, null],
          ],
        },
        'properties': {'road': 'first'},
      },
      {
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [130, 40, 20],
            [131, 41],
          ],
        },
        'properties': {'road': 'second'},
      },
    ],
  });
  final guides = [for (final guide in route.guidePoints) guide.point];
  expect(
    'routePath',
    listEquals(route.path, const [
      LatLng(37, 127),
      LatLng(38, 128),
      LatLng(40, 130),
      LatLng(41, 131),
    ]),
  );
  expect('routeGuide', listEquals(guides, const [LatLng(37, 127)]));

  // Zero/valid route input archived in historical-response.dart; reported only.
  final zeroRoute = RouteInfo.fromJson({
    'features': [
      {
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [0, 0],
            [127, 37],
          ],
        },
      },
    ],
  });

  // POI rows archived in historical-poi.dart.
  final absent = PoiItem.fromJson({'name': 'missing'});
  const constructed = PoiItem(
    id: 'id',
    name: 'name',
    point: LatLng(0, 0),
    address: '',
    roadAddress: '',
  );
  final validZero = PoiItem.fromJson({'noorLat': 0, 'noorLon': 0});
  final malformedNoor = PoiItem.fromJson({
    'noorLat': '37',
    'noorLon': 'bad',
    'frontLat': '37.4',
    'frontLon': '127.1',
  });
  final noorLatFrontLon = PoiItem.fromJson({
    'noorLat': '37',
    'frontLon': '127',
  });
  expect('absentPoint', absent.point == const LatLng(0, 0));
  expect('constructedZero', constructed.point == const LatLng(0, 0));
  expect('validZero', validZero.point == const LatLng(0, 0));

  final observation = jsonEncode({
    'schemaVersion': 1,
    'scope': 'controlled-model-sample-no-network',
    'routePath': _pairs(route.path),
    'routeGuides': _pairs(guides),
    'zeroRoutePath': _pairs(zeroRoute.path),
    'poi': {
      'absentPoint': _pair(absent.point),
      'constructedZero': _pair(constructed.point),
      'validZero': _pair(validZero.point),
      // Recorded only; invalid-source fallback is not asserted as correct.
      'malformedNoorWithCompleteFront': _pair(malformedNoor.point),
      'noorLatFrontLonOnly': _pair(noorLatFrontLon.point),
    },
    'failures': failures,
  });
  debugPrint('TDATA_MODEL_REPLAY $observation');
  if (failures.isNotEmpty) {
    throw StateError('released coordinate samples failed: $failures');
  }
}

List<List<num>> _pairs(List<LatLng> points) => [
  for (final p in points) _pair(p),
];

// Integral doubles are emitted as ints so the VM and web encode identically.
List<num> _pair(LatLng p) => [_number(p.latitude), _number(p.longitude)];

num _number(double value) =>
    value.isFinite && value == value.truncateToDouble() ? value.toInt() : value;
