import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

late Future<http.Response> Function(http.Request) _handler;
final _client = MockClient((request) => _handler(request));

Future<T> _withResponse<T>(Object body, Future<T> Function() action,
    {required String method, required String path}) async {
  final requests = <http.Request>[];
  _handler = (request) async {
    requests.add(request);
    return http.Response(jsonEncode(body), 200);
  };
  final result = await http.runWithClient(action, () => _client);
  expect(requests, hasLength(1));
  expect(requests.single.method, method);
  expect(requests.single.url.path, path);
  return result;
}

Map<String, dynamic> _route(String type, dynamic coordinates) => {
      'features': [
        {
          'geometry': {'type': type, 'coordinates': coordinates}
        }
      ]
    };

void main() {
  setUpAll(() => AuthRepository.initialize(appKey: 'fixture'));

  setUp(() {
    _handler = (_) => throw StateError('No response configured');
  });

  test('address chooses complete bounded pairs in compatibility order', () {
    expect(AddressInfo.fromJson({'lat': 37, 'lon': 127}).point,
        const LatLng(37, 127));
    expect(AddressInfo.fromJson({'latitude': -90, 'longitude': 180}).point,
        const LatLng(-90, 180));
    expect(
        AddressInfo.fromJson({
          'addressInfo': {
            'lat': 1,
            'lon': 2,
            'roadCoord': {'lat': '3', 'lon': '4'}
          }
        }).point,
        const LatLng(1, 2));
    expect(
        AddressInfo.fromJson({
          'roadCoord': {'lat': '37', 'lon': '127'},
          'legalDongCoord': {'lat': '38', 'lon': '128'},
        }).point,
        const LatLng(37, 127));
    expect(
        AddressInfo.fromJson({
          'lat': 10,
          'roadCoord': {'lat': '91', 'lon': '127'},
          'legalDongCoord': {'lat': '0', 'lon': '0'},
          'adminDongCoord': {'lat': '1', 'lon': '2'},
        }).point,
        const LatLng(0, 0));
    expect(
        AddressInfo.fromJson({
          'roadCoord': {'lat': '', 'lon': '127'},
          'legalDongCoord': {'lat': 'NaN', 'lon': '127'},
          'adminDongCoord': {'lat': '-90', 'lon': '180'},
        }).point,
        const LatLng(-90, 180));
    for (final coord in [
      {'lat': 12, 'lon': 181},
      {'lat': double.infinity, 'lon': 1},
      {'lat': 1, 'lon': null},
      {'latEntr': '1', 'lonEntr': '2'},
    ]) {
      expect(AddressInfo.fromJson({'roadCoord': coord}).point, isNull);
    }
  });

  test('address postal code prefers nonempty explicit then road then land', () {
    expect(
        AddressInfo.fromJson({
          'zipCode': '11111',
          'roadPostcode': '22222',
          'postcode': '33333'
        }).zipCode,
        '11111');
    expect(
        AddressInfo.fromJson(
                {'zipCode': '', 'roadPostcode': '22222', 'postcode': '33333'})
            .zipCode,
        '22222');
    expect(
        AddressInfo.fromJson(
            {'zipCode': ' ', 'roadPostcode': '', 'postcode': '33333'}).zipCode,
        '33333');
    expect(AddressInfo.fromJson({'zipCode': ''}).zipCode, '');
    expect(
        AddressInfo.fromJson(
            {'zipCode': ' ', 'roadPostcode': '', 'postcode': ' '}).zipCode,
        ' ');
    expect(AddressInfo.fromJson({}).zipCode, isNull);
    expect(AddressInfo.fromJson({'postcode': ''}).zipCode, isNull);
  });

  test('geocoding rejects contradictory CRS and retains untagged zero',
      () async {
    for (final type in [null, 'WGS84GEO', 'EPSG3857']) {
      final result = await _withResponse({
        'coordinateInfo': {
          if (type != null) 'coordType': type,
          'coordinate': [
            {'lat': '0', 'lon': '0'}
          ]
        }
      }, () => TDataService.getGeoFromAddress(address: 'fixture'),
          method: 'GET', path: '/tmap/geo/fullAddrGeo');
      expect(result, type == 'EPSG3857' ? null : const LatLng(0, 0));
    }
  });

  test('known WGS84 routes reject malformed coordinates without losing zero',
      () {
    for (final type in ['Point', 'LineString']) {
      for (final pair in [
        [181, 0],
        [0, -91],
        [double.nan, 0],
        [0, double.infinity],
        ['127', 37],
        [127],
        null,
      ]) {
        final json = _route(type, type == 'Point' ? pair : [pair]);
        expect(() => RouteInfo.fromJson(json), throwsFormatException);
        expect(() => RouteInfo.fromJson(json, responseCoordType: 'WGS84GEO'),
            throwsFormatException);
      }
      expect(
          () => RouteInfo.fromJson(_route(type, null)), throwsFormatException);
    }
    final route = RouteInfo.fromJson(_route('LineString', [
      [0, 0],
      [-180, 90],
      [180, -90]
    ]));
    expect(route.path,
        [const LatLng(0, 0), const LatLng(90, -180), const LatLng(-90, 180)]);
    expect(RouteInfo.fromJson(_route('Point', [0, 0])).guidePoints.single.point,
        const LatLng(0, 0));
    expect(
        RouteInfo.fromJson(_route('Point', [181, 91]),
                responseCoordType: 'KATECH')
            .guidePoints
            .single
            .point,
        const LatLng(91, 181));
    expect(
        RouteInfo.fromJson(_route('Point', [181, 91]), responseCoordType: null)
            .guidePoints
            .single
            .point,
        const LatLng(91, 181));
  });

  test('route services return null for invalid WGS84 coordinates', () async {
    final bad = _route('LineString', [
      [127, 37],
      [181, 0]
    ]);
    expect(
        await _withResponse(
            bad,
            () => TDataService.getRoutePlan(
                start: const LatLng(1, 2), end: const LatLng(3, 4)),
            method: 'POST',
            path: '/tmap/routes'),
        isNull);
    expect(
        await _withResponse(
            bad,
            () => TDataService.getRoutePlanPedestrian(
                start: const LatLng(1, 2), end: const LatLng(3, 4)),
            method: 'POST',
            path: '/tmap/routes/pedestrian'),
        isNull);
  });
}
