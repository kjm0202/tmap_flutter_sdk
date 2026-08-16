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
  });
}
