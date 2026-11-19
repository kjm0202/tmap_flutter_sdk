import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

// These fixtures were captured directly from apis.openapi.sk.com using the
// local test key. The capture utility strips credentials before writing them.
late http.Response _response;
late http.Request _request;
final _client = MockClient((request) async {
  _request = request;
  return _response;
});

void _fixture(String name) {
  final bytes = File('test/fixtures/tdata/$name.json').readAsBytesSync();
  _response = http.Response.bytes(bytes, 200, headers: {
    'content-type': 'application/json; charset=utf-8',
  });
}

Future<T> _run<T>(Future<T> Function() callback) =>
    http.runWithClient(callback, () => _client);

void main() {
  setUpAll(() => AuthRepository.initialize(appKey: 'fixture-key'));

  test('recorded /tmap/routes returns a typed route', () async {
    _fixture('route');
    final route = await _run(() => TDataService.getRoutePlan(
          start: const LatLng(37.5665, 126.978),
          end: const LatLng(37.5547, 126.9706),
        ));
    expect(_request.method, 'POST');
    expect(_request.url.path, '/tmap/routes');
    expect(route, isNotNull);
    expect(route!.totalDistance, greaterThan(500));
    expect(route.totalTime, greaterThan(0));
    expect(route.path.length, greaterThan(2));
    expect(route.guidePoints, isNotEmpty);
  });

  test('recorded /tmap/routes/pedestrian returns pedestrian route', () async {
    _fixture('pedestrian');
    final route = await _run(() => TDataService.getRoutePlanPedestrian(
          start: const LatLng(37.5665, 126.978),
          end: const LatLng(37.5547, 126.9706),
          startName: '서울시청',
          endName: '서울역',
        ));
    expect(_request.url.path, '/tmap/routes/pedestrian');
    expect(route, isNotNull);
    expect(route!.totalDistance, greaterThan(500));
    expect(route.path, isNotEmpty);
  });

  test('recorded /tmap/pois returns typed search POIs', () async {
    _fixture('pois');
    final result = await _run(() => TDataService.searchPoi(
          searchKeyword: '서울시청',
          count: 2,
        ));
    expect(_request.url.path, '/tmap/pois');
    expect(result, isNotEmpty);
    expect(result.first.id, '40189');
    expect(result.first.name, contains('서울'));
    expect(result.first.point.latitude, closeTo(37.5667, 0.001));
  });

  test('recorded /tmap/pois/search/around returns nearby POIs', () async {
    _fixture('around');
    final result = await _run(() => TDataService.searchPoiAround(
          center: const LatLng(37.5665, 126.978),
          categories: '편의점',
          count: 2,
          radius: 1,
        ));
    expect(_request.url.path, '/tmap/pois/search/around');
    expect(result, isNotEmpty);
    expect(result.first.name, isNotEmpty);
    expect(result.first.point.longitude, inInclusiveRange(126.9, 127.1));
  });

  test('recorded /tmap/geo/fullAddrGeo decodes WGS84', () async {
    _fixture('full_addr_geo');
    final point = await _run(() => TDataService.getGeoFromAddress(
          address: '서울특별시 중구 세종대로 110',
        ));
    expect(_request.url.path, '/tmap/geo/fullAddrGeo');
    expect(point, isNotNull);
    expect(point!.latitude, closeTo(37.5663, 0.001));
    expect(point.longitude, closeTo(126.9778, 0.001));
  });

  test('recorded /tmap/geo/reversegeocoding decodes AddressInfo', () async {
    _fixture('reverse_geo');
    final address = await _run(() => TDataService.getAddressFromGeo(
          point: const LatLng(37.5665, 126.978),
        ));
    expect(_request.url.path, '/tmap/geo/reversegeocoding');
    expect(address, isNotNull);
    expect(address!.fullAddress, contains('세종대로'));
  });

  test('recorded /tmap/poi/autoComplete parses suggestions', () async {
    _fixture('autocomplete');
    final suggestions =
        await _run(() => TDataService.getAutoCompleteSearch(keyword: '서울역'));
    expect(_request.url.path, '/tmap/poi/autoComplete');
    expect(suggestions, isNotEmpty);
    expect(suggestions.first.keyword, '서울역');
  });

  test('recorded /tmap/traffic yields typed congestion segments', () async {
    _fixture('traffic');
    final result = await _run(() => TDataService.getRealTimeTraffic(
          bounds: const LatLngBounds(
            southWest: LatLng(37.56, 126.97),
            northEast: LatLng(37.575, 126.99),
          ),
          zoomLevel: 14,
        ));
    expect(_request.method, 'GET');
    expect(_request.url.path, '/tmap/traffic');
    expect(_request.url.queryParameters['zoomLevel'], '14');
    expect(result, isNotEmpty);
    expect(result.first.id, isNotEmpty);
    expect(result.first.path.length, greaterThan(1));
    expect(result.first.path.first.latitude, inInclusiveRange(37.4, 37.7));
    expect(result.first.congestion, inInclusiveRange(0, 4));
    expect(result.any((segment) => segment.congestion > 0), isTrue);
  });

  test('recorded /tmap/pois/{poiInfo} yields typed POI details', () async {
    _fixture('poi_detail');
    final detail = await _run(() => TDataService.getPoiById(poiId: '40189'));
    expect(_request.url.path, '/tmap/pois/40189');
    expect(detail, isNotNull);
    expect(detail!.id, '40189');
    expect(detail.name, contains('서울'));
    expect(detail.roadAddress, contains('세종대로'));
    expect(detail.point!.latitude, closeTo(37.5667, 0.001));
  });

  test('recorded /tmap/geo/geocoding parses legacy coordinates', () async {
    _fixture('geocoding');
    final point = await _run(() => TDataService.getGeoFromAddressLegacy(
          cityDo: '서울',
          guGun: '중구',
          dong: '태평로1가',
          bunji: '31',
        ));
    expect(_request.url.path, '/tmap/geo/geocoding');
    expect(_request.url.queryParameters['city_do'], '서울');
    expect(point, isNotNull);
    expect(point!.latitude, closeTo(37.5666, 0.001));
    expect(point.longitude, closeTo(126.9782, 0.001));
  });

  test('recorded /tmap/geo/coordconvert preserves projected units', () async {
    _fixture('coordconvert');
    final point = await _run(() => TDataService.transformJson(
          latitude: 37.5665,
          longitude: 126.978,
          fromCoord: 'WGS84GEO',
          toCoord: 'EPSG3857',
        ));
    expect(_request.url.path, '/tmap/geo/coordconvert');
    expect(_request.url.queryParameters['fromCoord'], 'WGS84GEO');
    expect(_request.url.queryParameters['toCoord'], 'EPSG3857');
    expect(point, isNotNull);
    expect(point!.coordType, 'EPSG3857');
    expect(point.x, closeTo(14135126.3, 0.1));
    expect(point.y, closeTo(4518366.5, 0.1));
    expect(point.asLatLng, isNull);
  });

  test('new REST parsers reject server errors and malformed coordinates',
      () async {
    _response = http.Response(
        jsonEncode({
          'error': {'code': 'fixture'}
        }),
        200);
    expect(
        await _run(() => TDataService.getRealTimeTraffic(
              bounds: const LatLngBounds(
                southWest: LatLng(37.56, 126.97),
                northEast: LatLng(37.575, 126.99),
              ),
              zoomLevel: 14,
            )),
        isEmpty);
    expect(await _run(() => TDataService.getPoiById(poiId: '40189')), isNull);
    expect(
        await _run(() => TDataService.getGeoFromAddressLegacy(
              cityDo: '서울',
              guGun: '중구',
              dong: '태평로1가',
              bunji: '31',
            )),
        isNull);
    expect(
        await _run(() => TDataService.transformJson(
              latitude: 37.5,
              longitude: 127,
              fromCoord: 'WGS84GEO',
              toCoord: 'EPSG3857',
            )),
        isNull);

    expect(
        TrafficSegment.fromFeatureCollection({
          'features': [
            {
              'geometry': {
                'type': 'LineString',
                'coordinates': [
                  [126.97, 37.56],
                  [126.98, 'NaN'],
                ],
              },
              'properties': {'id': 'bad'},
            },
          ],
        }),
        isEmpty);
    expect(
        ProjectedCoordinate.fromJson({
          'coordinate': {'lat': 'NaN', 'lon': '127.0'},
        }, coordType: 'WGS84GEO'),
        isNull);
  });
}
