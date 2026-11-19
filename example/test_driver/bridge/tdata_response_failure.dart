import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

// Standalone: flutter run -t test_driver/bridge/tdata_response_failure.dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await runTDataResponseFailureContracts();
    debugPrintSynchronously('TDATA_ENVELOPE_PASS');
  } catch (_) {
    debugPrintSynchronously('TDATA_ENVELOPE_FAIL');
    rethrow;
  }
}

const _poi = {
  'searchPoiInfo': {
    'pois': {
      'poi': [
        {'id': 'fixture', 'name': 'result', 'lat': 0, 'lon': 0},
      ],
    },
  },
};
const _auto = {
  'response': {
    'suggestions': ['result'],
  },
};
const _route = {
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'geometry': {
        'type': 'Point',
        'coordinates': [0, 0],
      },
      'properties': {'totalDistance': 12},
    },
  ],
};

/// Runs the historical response-envelope contracts without network access.
/// Call before any other use of TDataService, whose HTTP client is static.
Future<void> runTDataResponseFailureContracts() async {
  final groups = <String, Map<String, bool>>{
    'wrapper-failure': {
      'failedRejected': false,
      'errorRejected': false,
      'rawRetained': false,
      'rawUnchanged': false,
    },
    'payload-error': {
      'poiRejected': false,
      'autoRejected': false,
      'routeRejected': false,
      'rawRetained': false,
      'rawUnchanged': false,
    },
    'success': {
      'poiPreserved': false,
      'autoPreserved': false,
      'routePreserved': false,
      'nullErrorPreserved': false,
      'absentErrorPreserved': false,
      'nullSuccessRejected': false,
      'absentSuccessRejected': false,
      'rawUnchanged': false,
    },
    'http200-object-error': {
      'poiRejected': false,
      'aroundRejected': false,
      'autoRejected': false,
      'routeRejected': false,
      'poiRequest': false,
      'aroundRequest': false,
      'autoRequest': false,
      'routeRequest': false,
      'poiHealthy': false,
      'aroundHealthy': false,
      'autoHealthy': false,
      'routeHealthy': false,
      'poiHealthyRequest': false,
      'aroundHealthyRequest': false,
      'autoHealthyRequest': false,
      'routeHealthyRequest': false,
    },
  };

  void check(String group, String name, bool Function() assertion) {
    try {
      groups[group]![name] = assertion();
    } catch (_) {
      groups[group]![name] = false;
    }
  }

  bool rejects(TDataResponse response) =>
      response.toPoiList().isEmpty &&
      response.toAutoCompleteList().isEmpty &&
      response.toRouteInfo() == null;

  final failed = TDataResponse(requestId: 'x', success: false, data: _poi);
  final reported = TDataResponse(
    requestId: 'x',
    success: true,
    error: 'failure',
    data: _route,
  );
  final wrapperBefore = jsonEncode([failed.data, reported.data]);
  check('wrapper-failure', 'failedRejected', () => rejects(failed));
  check('wrapper-failure', 'errorRejected', () => rejects(reported));
  check('wrapper-failure', 'rawRetained', () => identical(failed.data, _poi));
  check(
    'wrapper-failure',
    'rawUnchanged',
    () => jsonEncode([failed.data, reported.data]) == wrapperBefore,
  );

  final bodyError = {'code': 'fixture'};
  final p = TDataResponse(
    requestId: 'x',
    success: true,
    data: {..._poi, 'error': bodyError},
  );
  final a = TDataResponse(
    requestId: 'x',
    success: true,
    data: {..._auto, 'error': bodyError},
  );
  final r = TDataResponse(
    requestId: 'x',
    success: true,
    data: {..._route, 'error': bodyError},
  );
  final payloadBefore = jsonEncode([p.data, a.data, r.data]);
  check('payload-error', 'poiRejected', () => p.toPoiList().isEmpty);
  check('payload-error', 'autoRejected', () => a.toAutoCompleteList().isEmpty);
  check('payload-error', 'routeRejected', () => r.toRouteInfo() == null);
  check(
    'payload-error',
    'rawRetained',
    () => identical((p.data as Map)['error'], bodyError),
  );
  check(
    'payload-error',
    'rawUnchanged',
    () => jsonEncode([p.data, a.data, r.data]) == payloadBefore,
  );

  final pOk = TDataResponse(
    requestId: 'x',
    success: true,
    data: {..._poi, 'error': null},
  );
  final aOk = TDataResponse(requestId: 'x', success: true, data: _auto);
  final rOk = TDataResponse(requestId: 'x', success: true, data: _route);
  final successBefore = jsonEncode([pOk.data, aOk.data, rOk.data]);
  check(
    'success',
    'poiPreserved',
    () => pOk.toPoiList().single.name == 'result',
  );
  check(
    'success',
    'autoPreserved',
    () => aOk.toAutoCompleteList().single.keyword == 'result',
  );
  check('success', 'routePreserved', () => rOk.toRouteInfo() != null);
  check(
    'success',
    'nullErrorPreserved',
    () =>
        TDataResponse(
              requestId: 'x',
              success: true,
              data: {..._auto, 'error': null},
            ).toAutoCompleteList().single.keyword ==
            'result' &&
        TDataResponse(
              requestId: 'x',
              success: true,
              data: {..._route, 'error': null},
            ).toRouteInfo() !=
            null,
  );
  check(
    'success',
    'absentErrorPreserved',
    () =>
        TDataResponse(
          requestId: 'x',
          success: true,
          data: _poi,
        ).toPoiList().single.name ==
        'result',
  );
  check(
    'success',
    'nullSuccessRejected',
    () => rejects(
      TDataResponse.fromJson({'requestId': 'x', 'success': null, 'data': _poi}),
    ),
  );
  check(
    'success',
    'absentSuccessRejected',
    () => rejects(TDataResponse.fromJson({'requestId': 'x', 'data': _poi})),
  );
  check(
    'success',
    'rawUnchanged',
    () => jsonEncode([pOk.data, aOk.data, rOk.data]) == successBefore,
  );

  // A synthetic nonempty value only initializes the public auth path. The mock
  // intercepts every request and never delegates to a network client.
  const fixtureCredential = 'offline-fixture';
  final requests = <http.Request>[];
  var healthy = false;
  final client = MockClient((request) async {
    requests.add(request);
    final path = request.url.path;
    final Object body;
    if (path == '/tmap/pois' || path == '/tmap/pois/search/around') {
      body = _poi;
    } else if (path == '/tmap/poi/autoComplete') {
      body = _auto;
    } else if (path == '/tmap/routes') {
      body = _route;
    } else {
      return http.Response('{}', 500);
    }
    return http.Response(
      jsonEncode({
        ...body as Map<String, Object>,
        if (!healthy) 'error': {'code': 'fixture'},
      }),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  });

  bool matches(
    http.Request request,
    String method,
    String path,
    Map<String, String> parameters,
  ) {
    final uri = request.url;
    if (request.method != method ||
        uri.scheme != 'https' ||
        uri.host != 'apis.openapi.sk.com' ||
        uri.path != path ||
        request.headers['appKey'] != fixtureCredential) {
      return false;
    }
    if (!parameters.entries.every(
      (entry) {
        final value = uri.queryParameters[entry.key];
        if (path == '/tmap/pois/search/around' &&
            (entry.key == 'centerLat' || entry.key == 'centerLon')) {
          if (value == null || value.isEmpty) return false;
          final actual = double.tryParse(value);
          final expected = double.tryParse(entry.value);
          return actual != null &&
              actual.isFinite &&
              expected != null &&
              expected.isFinite &&
              actual == expected;
        }
        return value == entry.value;
      },
    )) {
      return false;
    }
    if (method == 'POST') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      return body['startX'] == 0 &&
          body['startY'] == 0 &&
          body['endX'] == 1 &&
          body['endY'] == 1;
    }
    return true;
  }

  Future<void> exercise(
    String name,
    String method,
    String path,
    Map<String, String> parameters,
    Future<bool> Function() invoke,
  ) async {
    final before = requests.length;
    var result = false;
    try {
      result = await invoke();
    } catch (_) {
      // Keep running the other observations even if a service call throws.
    }
    final suffix = healthy ? 'Healthy' : 'Rejected';
    final requestSuffix = healthy ? 'HealthyRequest' : 'Request';
    groups['http200-object-error']!['$name$suffix'] = result;
    check(
      'http200-object-error',
      '$name$requestSuffix',
      () =>
          requests.length == before + 1 &&
          matches(requests.last, method, path, parameters),
    );
  }

  try {
    AuthRepository.initialize(appKey: fixtureCredential);
    await http.runWithClient(() async {
      for (final isHealthy in [false, true]) {
        healthy = isHealthy;
        await exercise(
          'poi',
          'GET',
          '/tmap/pois',
          {'searchKeyword': 'fixture'},
          () async {
            final result = await TDataService.searchPoi(
              searchKeyword: 'fixture',
            );
            return healthy
                ? result.length == 1 && result.single.name == 'result'
                : result.isEmpty;
          },
        );
        await exercise(
          'around',
          'GET',
          '/tmap/pois/search/around',
          {'centerLat': '0.0', 'centerLon': '0.0'},
          () async {
            final result = await TDataService.searchPoiAround(
              center: const LatLng(0, 0),
            );
            return healthy
                ? result.length == 1 && result.single.name == 'result'
                : result.isEmpty;
          },
        );
        await exercise(
          'auto',
          'GET',
          '/tmap/poi/autoComplete',
          {'searchKeyword': 'fixture'},
          () async {
            final result = await TDataService.getAutoCompleteSearch(
              keyword: 'fixture',
            );
            return healthy
                ? result.length == 1 && result.single.keyword == 'result'
                : result.isEmpty;
          },
        );
        await exercise(
          'route',
          'POST',
          '/tmap/routes',
          {'version': '1', 'format': 'json'},
          () async {
            final result = await TDataService.getRoutePlan(
              start: const LatLng(0, 0),
              end: const LatLng(1, 1),
            );
            return healthy
                ? result != null && result.totalDistance == 12
                : result == null;
          },
        );
      }
    }, () => client);
  } catch (_) {
    // Any setup failure leaves the corresponding observations false.
  } finally {
    client.close();
  }

  debugPrintSynchronously('TDATA_ENVELOPE_RESULT ${jsonEncode(groups)}');
  if (groups.values.any((checks) => checks.values.any((value) => !value))) {
    throw StateError('TData response envelope contracts failed');
  }
}
