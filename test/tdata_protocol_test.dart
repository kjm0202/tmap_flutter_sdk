import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  group('TDataProtocol Tests', () {
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
