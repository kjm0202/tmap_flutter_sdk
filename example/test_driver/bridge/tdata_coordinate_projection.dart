import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

const _start = LatLng(37.5589, 126.9723);
const _end = LatLng(37.5682, 126.9875);
const _walkStartName = '출발지';
const _walkEndName = '목적지';
const _projectedOptions = <String, dynamic>{'resCoordType': 'EPSG3857'};
const _tolerance = 1e-5;

class _GeoRoute {
  final List<LatLng> path;
  final List<LatLng> guides;

  const _GeoRoute(this.path, this.guides);
}

Future<void> verifyProjectedRoutes(TMapController controller) async {
  final car = await _verifyMode(
    mode: 'car',
    endpoint: '/tmap/routes',
    oracleBody: {'searchOption': 0},
    target: () => controller.getRoutePlan(
      start: _start,
      end: _end,
      options: _projectedOptions,
    ),
  );
  final walk = await _verifyMode(
    mode: 'walk',
    endpoint: '/tmap/routes/pedestrian',
    oracleBody: {'startName': _walkStartName, 'endName': _walkEndName},
    target: () => controller.getRoutePlanPedestrian(
      start: _start,
      end: _end,
      startName: _walkStartName,
      endName: _walkEndName,
      options: _projectedOptions,
    ),
  );

  print(
    'TDATA_PROJECTED_SAMPLE ' +
        jsonEncode({'car': car.sample, 'walk': walk.sample}),
  );

  final failures = [...car.failures, ...walk.failures];
  if (failures.isNotEmpty) {
    throw StateError(
      'Projected route verification failed (${failures.length}): '
      '${failures.join('; ')}',
    );
  }
}

class _ModeResult {
  final Map<String, Object?> sample;
  final List<String> failures;

  const _ModeResult(this.sample, this.failures);
}

Future<_ModeResult> _verifyMode({
  required String mode,
  required String endpoint,
  required Map<String, dynamic> oracleBody,
  required Future<RouteInfo?> Function() target,
}) async {
  final officialFailures = <String>[];
  final targetFailures = <String>[];
  _GeoRoute? official;
  RouteInfo? route;

  try {
    official = await _fetchOfficialWgs(endpoint, oracleBody);
    officialFailures.addAll(_checkOfficial(official));
  } catch (e) {
    officialFailures.add('official request failed: ${e.runtimeType}');
  }

  try {
    route = await target();
  } catch (e) {
    targetFailures.add('target threw ${e.runtimeType}');
  }

  int projectedValues = 0;
  if (route == null) {
    if (targetFailures.isEmpty) targetFailures.add('target returned null');
  } else {
    final allTargetPoints = [
      ...route.path,
      for (final guide in route.guidePoints) guide.point,
    ];
    for (final point in allTargetPoints) {
      if (!_isGeographic(point)) projectedValues++;
    }
    if (route.path.isEmpty) targetFailures.add('target path is empty');
    if (projectedValues > 0) {
      targetFailures.add(
        '$projectedValues target points are not geographic degrees',
      );
    }
    if (official != null && officialFailures.isEmpty) {
      targetFailures.addAll(_compare('path', route.path, official.path));
      targetFailures.addAll(
        _compare('guide', [
          for (final guide in route.guidePoints) guide.point,
        ], official.guides),
      );
    }
  }

  final first = route == null || route.path.isEmpty ? null : route.path.first;
  final officialFirst = official == null || official.path.isEmpty
      ? null
      : official.path.first;
  final sample = <String, Object?>{
    'first': first == null ? null : [first.latitude, first.longitude],
    'path': route?.path.length,
    'guides': route?.guidePoints.length,
    'projectedValues': projectedValues,
    'valid': targetFailures.isEmpty && officialFailures.isEmpty,
    'official': {
      'first': officialFirst == null
          ? null
          : [officialFirst.latitude, officialFirst.longitude],
      'path': official?.path.length,
      'guides': official?.guides.length,
      'valid': officialFailures.isEmpty,
    },
  };

  return _ModeResult(sample, [
    for (final failure in officialFailures) '$mode official WGS: $failure',
    for (final failure in targetFailures) '$mode target: $failure',
  ]);
}

Future<_GeoRoute> _fetchOfficialWgs(
  String endpoint,
  Map<String, dynamic> extraBody,
) async {
  final uri = Uri.https('apis.openapi.sk.com', endpoint, {
    'version': '1',
    'format': 'json',
  });
  final response = await http.post(
    uri,
    headers: {
      'Content-Type': 'application/json',
      'appKey': const String.fromEnvironment('TMAP_APP_KEY'),
    },
    body: jsonEncode({
      'startX': _start.longitude,
      'startY': _start.latitude,
      'endX': _end.longitude,
      'endY': _end.latitude,
      ...extraBody,
      'reqCoordType': 'WGS84GEO',
      'resCoordType': 'WGS84GEO',
    }),
  );
  if (response.statusCode != 200) {
    throw StateError('status ${response.statusCode}');
  }

  final data =
      jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  final path = <LatLng>[];
  final guides = <LatLng>[];
  for (final feature in data['features'] as List<dynamic>) {
    final geometry = feature['geometry'] as Map<String, dynamic>;
    final coordinates = geometry['coordinates'] as List<dynamic>;
    if (geometry['type'] == 'LineString') {
      for (final coord in coordinates) {
        path.add(
          LatLng((coord[1] as num).toDouble(), (coord[0] as num).toDouble()),
        );
      }
    } else if (geometry['type'] == 'Point') {
      guides.add(
        LatLng(
          (coordinates[1] as num).toDouble(),
          (coordinates[0] as num).toDouble(),
        ),
      );
    }
  }
  return _GeoRoute(path, guides);
}

List<String> _checkOfficial(_GeoRoute official) {
  final failures = <String>[];
  if (official.path.isEmpty) failures.add('path is empty');
  if (official.guides.isEmpty) failures.add('no guide points');
  final outside = [
    ...official.path,
    ...official.guides,
  ].where((point) => !_isInKorea(point)).length;
  if (outside > 0) failures.add('$outside points outside Korean bounds');
  return failures;
}

List<String> _compare(String label, List<LatLng> actual, List<LatLng> wgs) {
  if (actual.length != wgs.length) {
    return ['$label length ${actual.length} vs WGS ${wgs.length}'];
  }
  int mismatches = 0;
  int? firstMismatch;
  for (int i = 0; i < wgs.length; i++) {
    final latOk = (actual[i].latitude - wgs[i].latitude).abs() <= _tolerance;
    final lngOk = (actual[i].longitude - wgs[i].longitude).abs() <= _tolerance;
    if (!latOk || !lngOk) {
      mismatches++;
      firstMismatch ??= i;
    }
  }
  if (mismatches == 0) return const [];
  return [
    '$mismatches of ${wgs.length} $label points differ from WGS by more '
        'than $_tolerance degrees (first at $firstMismatch)',
  ];
}

bool _isGeographic(LatLng point) =>
    point.latitude.abs() <= 90 && point.longitude.abs() <= 180;

bool _isInKorea(LatLng point) =>
    point.latitude >= 33 &&
    point.latitude <= 43 &&
    point.longitude >= 124 &&
    point.longitude <= 132;
