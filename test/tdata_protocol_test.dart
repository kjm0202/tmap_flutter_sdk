import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  group('TDataProtocol Tests', () {
    group('response failure envelopes', () {
      final data = <String, dynamic>{
        'searchPoiInfo': {
          'pois': {
            'poi': [
              {'id': '1', 'name': 'result', 'lat': 37.5, 'lon': 127.0},
            ],
          },
        },
        'response': {
          'suggestions': ['result'],
        },
        'features': [
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': [127.0, 37.5],
            },
            'properties': {'totalDistance': 12},
          },
        ],
        'addressInfo': {'fullAddress': 'result'},
      };

      void expectRejected(TDataResponse response) {
        expect(response.toPoiList(), isEmpty);
        expect(response.toAutoCompleteList(), isEmpty);
        expect(response.toRouteInfo(), isNull);
        expect(response.toAddressInfo(), isNull);
      }

      void expectAccepted(TDataResponse response) {
        expect(response.toPoiList().single.name, 'result');
        expect(response.toAutoCompleteList().single.keyword, 'result');
        expect(response.toRouteInfo()!.totalDistance, 12);
        expect(response.toAddressInfo()!.fullAddress, 'result');
      }

      test(
        'missing or false success and nonempty wrapper error reject data',
        () {
          for (final json in [
            {'data': data},
            {'success': false, 'data': data},
            {'success': true, 'error': 'failure', 'data': data},
          ]) {
            final response = TDataResponse.fromJson(json);
            expectRejected(response);
            expect(identical(response.data, data), isTrue);
          }
        },
      );

      test('any non-null body error rejects without changing raw data', () {
        for (final error in [
          <String, Object>{'code': 'fixture'},
          '',
          false,
          0,
        ]) {
          final body = {...data, 'error': error};
          final before = Map<String, dynamic>.from(body);
          final response = TDataResponse(
            requestId: 'x',
            success: true,
            data: body,
          );
          expectRejected(response);
          expect(identical(response.data, body), isTrue);
          expect(identical((response.data as Map)['error'], error), isTrue);
          expect(body, before);
        }
      });

      test(
        'success accepts missing or null body error and empty wrapper error',
        () {
          for (final body in [
            data,
            {...data, 'error': null},
          ]) {
            final response = TDataResponse(
              requestId: 'x',
              success: true,
              error: '',
              data: body,
            );
            expectAccepted(response);
            expect(identical(response.data, body), isTrue);
          }
          final suggestions = ['result'];
          final raw = TDataResponse(
            requestId: 'x',
            success: true,
            data: suggestions,
          );
          expect(raw.toAutoCompleteList().single.keyword, 'result');
          expect(identical(raw.data, suggestions), isTrue);
          expectRejected(
            TDataResponse(requestId: 'x', success: false, data: suggestions),
          );
        },
      );
    });

    test('Parse POI response', () {
      final json = {
        'requestId': 'req_1',
        'success': true,
        'data': {
          'searchPoiInfo': {
            'pois': {
              'poi': [
                {
                  'id': '1001',
                  'name': 'SK T타워',
                  'telNo': '02-1234-5678',
                  'noorLat': 37.5665,
                  'noorLon': 126.9850,
                  'upperAddrName': '서울특별시',
                  'middleAddrName': '중구',
                  'lowerAddrName': '을지로2가',
                  'detailAddrName': '65',
                  'roadName': '을지로',
                  'buildingNo1': '65',
                }
              ]
            }
          }
        }
      };

      final response = TDataResponse.fromJson(json);
      expect(response.success, isTrue);
      expect(response.requestId, 'req_1');

      final pois = response.toPoiList();
      expect(pois.length, 1);
      expect(pois.first.name, 'SK T타워');
      expect(pois.first.point.latitude, 37.5665);
      expect(pois.first.point.longitude, 126.9850);
    });

    test('Parse Route response', () {
      final json = {
        'requestId': 'req_2',
        'success': true,
        'data': {
          'features': [
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Point',
                'coordinates': [126.9850, 37.5665]
              },
              'properties': {
                'totalDistance': 15000,
                'totalTime': 1200,
                'totalFare': 2000,
                'taxiFare': 16000,
                'name': '출발지',
                'description': '출발지 안내'
              }
            },
            {
              'type': 'Feature',
              'geometry': {
                'type': 'LineString',
                'coordinates': [
                  [126.9850, 37.5665],
                  [126.9900, 37.5700]
                ]
              },
              'properties': {'description': '직진 안내'}
            }
          ]
        }
      };

      final response = TDataResponse.fromJson(json);
      expect(response.success, isTrue);

      final route = response.toRouteInfo();
      expect(route, isNotNull);
      expect(route?.totalDistance, 15000);
      expect(route?.totalTime, 1200);
      expect(route?.path.length, 2);
      expect(route?.guidePoints.length, 1);
    });

    group('RouteInfo.fromJson responseCoordType', () {
      const x = 14134496.373156464;
      const y = 4517248.111148808;
      const lng = 126.97234125338395;
      const lat = 37.55853605747212;
      const eps = 1e-9;

      Map<String, dynamic> routeJson(List<num> point, List<List<num>> line) => {
            'type': 'FeatureCollection',
            'features': [
              {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': point},
                'properties': {
                  'totalDistance': 15000,
                  'totalTime': 1200,
                  'totalFare': 2000,
                  'taxiFare': 16000,
                  'name': '',
                  'description': '출발',
                },
              },
              {
                'type': 'Feature',
                'geometry': {'type': 'LineString', 'coordinates': line},
                'properties': {'description': '직진'},
              },
              {
                'type': 'Feature',
                'geometry': {'type': 'LineString', 'coordinates': line},
                'properties': {'description': '계속 직진'},
              },
            ],
          };

      void expectMetadata(RouteInfo route) {
        expect(route.totalDistance, 15000);
        expect(route.totalTime, 1200);
        expect(route.totalFare, 2000);
        expect(route.taxiFare, 16000);
        expect(route.guidePoints.single.name, '');
        expect(route.guidePoints.single.description, '출발');
      }

      test('decodes the official EPSG3857 pair on guides and every segment',
          () {
        final route = RouteInfo.fromJson(
          routeJson([
            x,
            y
          ], [
            [x, y],
            [x, y],
            [0, 0],
          ]),
          responseCoordType: 'EPSG3857',
        );

        expectMetadata(route);
        final guide = route.guidePoints.single.point;
        expect(guide.longitude, closeTo(lng, eps));
        expect(guide.latitude, closeTo(lat, eps));
        expect(route.path.length, 6);
        for (final i in [0, 1, 3, 4]) {
          expect(route.path[i].longitude, closeTo(lng, eps));
          expect(route.path[i].latitude, closeTo(lat, eps));
        }
        for (final i in [2, 5]) {
          expect(route.path[i].longitude, 0);
          expect(route.path[i].latitude, 0);
        }
      });

      test('decodes the negative projected counterpart', () {
        final route = RouteInfo.fromJson(
          routeJson([
            -x,
            -y
          ], [
            [-x, -y],
          ]),
          responseCoordType: 'EPSG3857',
        );

        expect(route.guidePoints.single.point.longitude, closeTo(-lng, eps));
        expect(route.guidePoints.single.point.latitude, closeTo(-lat, eps));
        expect(route.path.first.longitude, closeTo(-lng, eps));
        expect(route.path.first.latitude, closeTo(-lat, eps));
      });

      test('keeps ordinary WGS84 parsing by default and for other values', () {
        final json = routeJson([
          lng,
          lat
        ], [
          [lng, lat],
          [126.99, 37.57],
        ]);
        for (final route in [
          RouteInfo.fromJson(json),
          RouteInfo.fromJson(json, responseCoordType: 'WGS84GEO'),
          RouteInfo.fromJson(json, responseCoordType: null),
          RouteInfo.fromJson(json, responseCoordType: 'KATECH'),
        ]) {
          expectMetadata(route);
          expect(route.guidePoints.single.point.longitude, lng);
          expect(route.guidePoints.single.point.latitude, lat);
          expect(route.path.map((p) => [p.longitude, p.latitude]), [
            [lng, lat],
            [126.99, 37.57],
            [lng, lat],
            [126.99, 37.57],
          ]);
        }
      });
    });
  });
}
