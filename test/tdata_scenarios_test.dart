import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

late http.Request _lastRequest;
late http.Response _cannedResponse;

MockClient _buildClient() => MockClient((request) async {
      _lastRequest = request;
      return _cannedResponse;
    });

void _setCanned(Object body, [int status = 200]) {
  _cannedResponse = http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );
}

final _client = _buildClient();

Future<T> _run<T>(Future<T> Function() fn) =>
    http.runWithClient(fn, () => _client);

const _poiFixture = {
  'searchPoiInfo': {
    'pois': {
      'poi': [
        {
          'id': '1234',
          'name': '서울역',
          'noorLat': '37.5547',
          'noorLon': '126.9706',
        },
      ],
    },
  },
};

const _geoCoordinateListFixture = {
  'coordinateInfo': {
    'coordinate': [
      {'lat': '37.5665', 'lon': '126.9780'},
      {'newLat': '37.4979', 'newLon': '127.0276'},
    ],
  },
};

const _geoCoordinateObjectFixture = {
  'coordinateInfo': {
    'coordinate': {
      'lat': 37.5665,
      'lon': 126.9780,
      'newLat': 37.4979,
      'newLon': 127.0276,
    },
  },
};

const _autoCompleteSuggestionsFixture = {
  'response': {
    'returnCode': 0,
    'totalCount': 2,
    'suggestions': [
      {'keyword': '서울역', 'coordinates': '', 'rpFlag': ''},
      {'keyword': '서울역버스환승센터'},
    ],
  },
};

const _autoCompleteLegacyFixture = {
  'autoComplete': ['서울역', '서울대', '서울숲'],
};

const _routeFixture = {
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'geometry': {
        'type': 'LineString',
        'coordinates': [
          [126.9706, 37.5547],
          [127.0276, 37.4979],
        ],
      },
      'properties': {
        'totalTime': 1800,
        'totalDistance': 15000,
      },
    },
  ],
};

void main() {
  setUpAll(() {
    AuthRepository.initialize(appKey: 'fixture');
  });

  group('TDataService regression tests', () {
    test('searchPoi returns parsed PoiItem list', () async {
      _setCanned(_poiFixture);

      final result = await _run(() => TDataService.searchPoi(
            searchKeyword: '서울역',
            center: const LatLng(37.5665, 126.9780),
            count: 5,
            radius: 500,
          ));

      expect(_lastRequest.method, 'GET');
      expect(_lastRequest.url.path, '/tmap/pois');
      expect(_lastRequest.url.queryParameters['searchKeyword'], '서울역');
      expect(_lastRequest.headers['appKey'], 'fixture');

      expect(result, isNotEmpty);
      final poi = result.first;
      expect(poi.point.latitude, closeTo(37.5547, 0.001));
      expect(poi.point.longitude, closeTo(126.9706, 0.001));
    });

    test('searchPoiAround returns nearby POIs by category', () async {
      _setCanned(_poiFixture);

      final result = await _run(() => TDataService.searchPoiAround(
            center: const LatLng(37.5547, 126.9706),
            categories: 'SW8',
            radius: 500,
          ));

      expect(_lastRequest.method, 'GET');
      expect(_lastRequest.url.path, '/tmap/pois/search/around');
      expect(_lastRequest.url.queryParameters['categories'], 'SW8');
      expect(_lastRequest.url.queryParameters['radius'], '1');
      expect(_lastRequest.headers['appKey'], 'fixture');

      expect(result, isNotEmpty);
      expect(result.first.point.latitude, closeTo(37.5547, 0.001));
    });

    test('getRoutePlan POSTs and returns RouteInfo with path', () async {
      _setCanned(_routeFixture);

      final result = await _run(() => TDataService.getRoutePlan(
            start: const LatLng(37.5547, 126.9706),
            end: const LatLng(37.4979, 127.0276),
          ));

      expect(_lastRequest.method, 'POST');
      expect(_lastRequest.url.path, '/tmap/routes');
      expect(_lastRequest.headers['appKey'], 'fixture');

      expect(result, isNotNull);
      expect(result!.path, isNotEmpty);
      expect(result.path.first.longitude, closeTo(126.9706, 0.001));
    });

    test('getRoutePlanPedestrian POSTs to pedestrian endpoint', () async {
      _setCanned(_routeFixture);

      final result = await _run(() => TDataService.getRoutePlanPedestrian(
            start: const LatLng(37.5547, 126.9706),
            end: const LatLng(37.4979, 127.0276),
            startName: '서울역',
            endName: '강남역',
          ));

      expect(_lastRequest.method, 'POST');
      expect(_lastRequest.url.path, '/tmap/routes/pedestrian');

      final body = jsonDecode(_lastRequest.body) as Map<String, dynamic>;
      expect(body['startName'], '서울역');
      expect(body['endName'], '강남역');

      expect(result, isNotNull);
      expect(result!.path.length, greaterThan(1));
    });

    test('route callers decode EPSG3857 when options request it', () async {
      const epsg3857Fixture = {
        'type': 'FeatureCollection',
        'features': [
          {
            'type': 'Feature',
            'geometry': {
              'type': 'LineString',
              'coordinates': [
                [14134496.373156464, 4517248.111148808],
              ],
            },
            'properties': {'totalTime': 1800, 'totalDistance': 15000},
          },
        ],
      };
      final options = {'resCoordType': 'EPSG3857'};

      for (final call in [
        () => TDataService.getRoutePlan(
              start: const LatLng(37.5547, 126.9706),
              end: const LatLng(37.4979, 127.0276),
              options: options,
            ),
        () => TDataService.getRoutePlanPedestrian(
              start: const LatLng(37.5547, 126.9706),
              end: const LatLng(37.4979, 127.0276),
              options: options,
            ),
      ]) {
        _setCanned(epsg3857Fixture);

        final result = await _run(call);

        final body = jsonDecode(_lastRequest.body) as Map<String, dynamic>;
        expect(body['reqCoordType'], 'WGS84GEO');
        expect(body['resCoordType'], 'EPSG3857');
        expect(options, {'resCoordType': 'EPSG3857'});

        expect(result, isNotNull);
        expect(result!.totalDistance, 15000);
        expect(result.totalTime, 1800);
        expect(result.path.single.longitude, closeTo(126.97234125338395, 1e-9));
        expect(result.path.single.latitude, closeTo(37.55853605747212, 1e-9));
      }
    });

    test('getGeoFromAddress returns LatLng from legacy flat fixture', () async {
      _setCanned({
        'coordinateInfo': {'lat': '37.5', 'lon': '127.0'},
      });

      final result = await _run(
        () => TDataService.getGeoFromAddress(address: '서울특별시 중구'),
      );

      expect(_lastRequest.method, 'GET');
      expect(_lastRequest.url.path, '/tmap/geo/fullAddrGeo');
      expect(_lastRequest.url.queryParameters['addressFlag'], 'F00');
      expect(_lastRequest.headers['appKey'], 'fixture');

      expect(result, isNotNull);
      expect(result!.latitude, closeTo(37.5, 0.001));
      expect(result.longitude, closeTo(127.0, 0.001));
    });

    test('getGeoFromAddress parses coordinate list of objects', () async {
      _setCanned(_geoCoordinateListFixture);

      final result = await _run(
        () => TDataService.getGeoFromAddress(address: '서울특별시 중구 세종대로 110'),
      );

      expect(result, isNotNull);
      expect(result!.latitude, closeTo(37.5665, 0.0001));
      expect(result.longitude, closeTo(126.9780, 0.0001));
    });

    test('getGeoFromAddress parses a single coordinate object', () async {
      _setCanned(_geoCoordinateObjectFixture);

      final result = await _run(
        () => TDataService.getGeoFromAddress(address: '서울특별시 중구 세종대로 110'),
      );

      expect(result, isNotNull);
      // lat/lon is preferred over newLat/newLon within the same object.
      expect(result!.latitude, closeTo(37.5665, 0.0001));
      expect(result.longitude, closeTo(126.9780, 0.0001));
    });

    test('getGeoFromAddress does not mix fields across coordinate pairs',
        () async {
      _setCanned({
        'coordinateInfo': {
          'coordinate': [
            {'lat': '37.1', 'newLat': '37.2', 'newLon': '127.2'},
            {'lat': '37.3', 'lon': '127.3'},
          ],
        },
      });

      final result = await _run(
        () => TDataService.getGeoFromAddress(address: '서울특별시 중구'),
      );

      expect(result, isNotNull);
      expect(result!.latitude, closeTo(37.2, 0.0001));
      expect(result.longitude, closeTo(127.2, 0.0001));
    });

    test('getGeoFromAddress rejects missing, nonfinite, and out-of-range coords',
        () async {
      _setCanned({
        'coordinateInfo': {
          'coordinate': [
            {'lat': 'NaN', 'lon': '127.0'},
            {'lat': '95.0', 'lon': '127.0'},
            {'lat': '37.5', 'lon': '200.0'},
          ],
        },
      });
      final invalid = await _run(
        () => TDataService.getGeoFromAddress(address: '서울특별시 중구'),
      );
      expect(invalid, isNull);

      _setCanned({'coordinateInfo': <String, Object?>{}});
      final missing = await _run(
        () => TDataService.getGeoFromAddress(address: '서울특별시 중구'),
      );
      expect(missing, isNull);
    });

    test('getAddressFromGeo returns AddressInfo with fullAddress', () async {
      _setCanned({
        'addressInfo': {'fullAddress': '서울특별시 중구 세종대로 110'},
      });

      final result = await _run(
        () => TDataService.getAddressFromGeo(
          point: const LatLng(37.5665, 126.9780),
        ),
      );

      expect(result, isNotNull);
      expect(result!.fullAddress, contains('서울'));
    });

    test('getAutoCompleteSearch returns response.suggestions', () async {
      _setCanned(_autoCompleteSuggestionsFixture);

      final result = await _run(
        () => TDataService.getAutoCompleteSearch(keyword: ' 서울역 '),
      );

      expect(_lastRequest.method, 'GET');
      expect(_lastRequest.url.path, '/tmap/poi/autoComplete');
      expect(_lastRequest.url.queryParameters['searchKeyword'], '서울역');
      expect(_lastRequest.url.queryParameters.containsKey('keyword'), isFalse);

      expect(result, isNotEmpty);
      expect(result.first.keyword, '서울역');
    });

    test('getAutoCompleteSearch accepts text suggestions', () async {
      _setCanned({
        'response': {
          'suggestions': ['서울역', '서울대'],
        },
      });

      final result = await _run(
        () => TDataService.getAutoCompleteSearch(keyword: '서울'),
      );

      expect(result.map((item) => item.keyword), ['서울역', '서울대']);
    });

    test('getAutoCompleteSearch keeps legacy autoComplete list support',
        () async {
      _setCanned(_autoCompleteLegacyFixture);

      final result = await _run(
        () => TDataService.getAutoCompleteSearch(keyword: '서울'),
      );

      expect(result, isNotEmpty);
      expect(result.first.keyword, '서울역');
      expect(result.map((item) => item.keyword), contains('서울숲'));
    });

    test('service returns null/empty on HTTP error', () async {
      _setCanned({'error': 'server error'}, 500);

      final route = await _run(
        () => TDataService.getRoutePlan(
          start: const LatLng(37.5547, 126.9706),
          end: const LatLng(37.4979, 127.0276),
        ),
      );

      expect(route, isNull);

      _setCanned({'error': 'not found'}, 404);
      final pois = await _run(
        () => TDataService.searchPoi(
          searchKeyword: 'x',
          center: const LatLng(37.0, 127.0),
          count: 1,
          radius: 100,
        ),
      );
      expect(pois, isEmpty);
    });

    test('searchPoi returns empty list when poi array is empty', () async {
      _setCanned({
        'searchPoiInfo': {
          'pois': {'poi': <Object?>[]},
        },
      });

      final result = await _run(() => TDataService.searchPoi(
            searchKeyword: '없는곳',
            center: const LatLng(37.5665, 126.9780),
            count: 5,
            radius: 500,
          ));

      expect(_lastRequest.url.path, '/tmap/pois');
      expect(result, isEmpty);
    });

    test('searchPoi returns empty list on non-JSON HTTP 200', () async {
      _cannedResponse = http.Response('invalid JSON', 200);

      final result = await _run(() => TDataService.searchPoi(
            searchKeyword: '서울역',
            center: const LatLng(37.5665, 126.9780),
            count: 5,
            radius: 500,
          ));

      expect(_lastRequest.url.path, '/tmap/pois');
      expect(result, isEmpty);
    });
  });
}
