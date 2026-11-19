import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  group('PoiItem road address', () {
    final base = <String, dynamic>{
      'id': '1001',
      'name': '서울역',
      'telNo': '02-123-4567',
      'noorLat': '37.5547',
      'noorLon': '126.9707',
      'upperAddrName': '서울',
      'middleAddrName': '용산구',
      'lowerAddrName': '동자동',
      'detailAddrName': '상세',
      'firstNo': '43',
      'secondNo': '2',
      'roadName': '한강대로',
      'upperBizName': '교통',
      'middleBizName': '철도',
      'lowerBizName': '역',
      'radius': '1.5',
    };

    test('uses the Seoul Station provider full road address', () {
      final poi = PoiItem.fromJson({
        ...base,
        'firstBuildNo': '405',
        'secondBuildNo': '0',
        'newAddressList': {
          'newAddress': [
            {
              'roadName': '한강대로',
              'bldNo1': '405',
              'bldNo2': '0',
              'fullAddressRoad': '서울 용산구 한강대로 405',
            },
          ],
        },
      });

      expect(poi.roadAddress, '서울 용산구 한강대로 405');
      expect(poi.address, '서울 용산구 동자동 상세 43-2');
      expect(poi.id, '1001');
      expect(poi.name, '서울역');
      expect(poi.telNo, '02-123-4567');
      expect(poi.point, const LatLng(37.5547, 126.9707));
      expect(poi.upperBizName, '교통');
      expect(poi.middleBizName, '철도');
      expect(poi.lowerBizName, '역');
      expect(poi.distance, 1.5);
    });

    test('finds the first usable full address across malformed entries', () {
      final poi = PoiItem.fromJson({
        ...base,
        'buildingNo1': '10',
        'newAddressList': {
          'newAddress': [
            null,
            'invalid',
            {'fullAddressRoad': 123, 'bldNo1': '20'},
            {'fullAddressRoad': '   '},
            {'fullAddressRoad': '  서울 용산구 한강대로 405  '},
            {'fullAddressRoad': '다른 주소'},
          ],
        },
      });
      expect(poi.roadAddress, '서울 용산구 한강대로 405');
    });

    test('falls back for absent, blank, or malformed nested data', () {
      for (final nested in [
        null,
        'invalid',
        <String, dynamic>{},
        {'newAddress': 'invalid'},
        {'newAddress': <dynamic>[]},
        {
          'newAddress': [
            null,
            {'fullAddressRoad': '  '},
          ],
        },
      ]) {
        final poi = PoiItem.fromJson({
          ...base,
          'buildingNo1': '65',
          'buildingNo2': '3',
          'newAddressList': nested,
        });
        expect(poi.roadAddress, '서울 용산구 한강대로 65-3');
      }
    });

    test('supports provider and nested building number keys', () {
      expect(
        PoiItem.fromJson({...base, 'firstBuildNo': '405', 'secondBuildNo': '2'})
            .roadAddress,
        '서울 용산구 한강대로 405-2',
      );
      expect(
        PoiItem.fromJson({
          ...base,
          'newAddressList': {
            'newAddress': {'bldNo1': '405', 'bldNo2': '2'},
          },
        }).roadAddress,
        '서울 용산구 한강대로 405-2',
      );
      expect(
        PoiItem.fromJson({
          ...base,
          'buildingNo1': '65',
          'firstBuildNo': '405',
          'newAddressList': {
            'newAddress': [
              {'bldNo1': '405', 'bldNo2': '2'},
            ],
          },
        }).roadAddress,
        '서울 용산구 한강대로 65',
      );
    });

    test('omits empty or zero subnumbers and never adds a dangling hyphen', () {
      for (final suffix in [null, '', '  ', '0', '00']) {
        expect(
          PoiItem.fromJson({
            ...base,
            'buildingNo1': '65',
            'buildingNo2': suffix,
          }).roadAddress,
          '서울 용산구 한강대로 65',
        );
        expect(
          PoiItem.fromJson({
            ...base,
            'firstBuildNo': '405',
            'secondBuildNo': suffix,
          }).roadAddress,
          '서울 용산구 한강대로 405',
        );
        expect(
          PoiItem.fromJson({
            ...base,
            'newAddressList': {
              'newAddress': [
                {'bldNo1': '405', 'bldNo2': suffix},
              ],
            },
          }).roadAddress,
          '서울 용산구 한강대로 405',
        );
      }
      expect(
        PoiItem.fromJson({...base, 'buildingNo2': '3'}).roadAddress,
        '서울 용산구 한강대로',
      );
    });
  });

  group('PoiItem coordinate pair', () {
    LatLng pointOf(Map<String, dynamic> json) => PoiItem.fromJson(json).point;

    test('does not mix a partial noor latitude with a front longitude', () {
      expect(pointOf({'noorLat': 37, 'frontLon': 127}), const LatLng(0, 0));
    });

    test('falls back to the front pair when the noor pair is malformed', () {
      expect(
        pointOf({
          'noorLat': 37,
          'noorLon': 'bad',
          'frontLat': 37.4,
          'frontLon': 127.1,
        }),
        const LatLng(37.4, 127.1),
      );
    });

    test('skips an out-of-range noor latitude', () {
      expect(
        pointOf({
          'noorLat': 91,
          'noorLon': 127,
          'frontLat': '37.5',
          'frontLon': '127.0',
        }),
        const LatLng(37.5, 127.0),
      );
      expect(pointOf({'noorLat': 91, 'noorLon': 127}), const LatLng(0, 0));
      expect(pointOf({'noorLat': 37, 'noorLon': 181}), const LatLng(0, 0));
    });

    test('falls back to the lat/lon pair', () {
      expect(
        pointOf({
          'noorLat': 'x',
          'noorLon': 127,
          'frontLat': 37,
          'lat': '35.1',
          'lon': '129.0',
        }),
        const LatLng(35.1, 129.0),
      );
    });

    test('accepts inclusive boundary values', () {
      expect(pointOf({'noorLat': 90, 'noorLon': 180}), const LatLng(90, 180));
      expect(
        pointOf({'frontLat': '-90', 'frontLon': '-180'}),
        const LatLng(-90, -180),
      );
    });

    test('rejects NaN and Infinity values', () {
      expect(
        pointOf({
          'noorLat': double.nan,
          'noorLon': 127,
          'frontLat': 37,
          'frontLon': double.infinity,
          'lat': 'NaN',
          'lon': '127',
        }),
        const LatLng(0, 0),
      );
      expect(
        pointOf({
          'noorLat': 'Infinity',
          'noorLon': 127,
          'lat': 36.0,
          'lon': '-Infinity',
        }),
        const LatLng(0, 0),
      );
      expect(
        pointOf({
          'noorLat': 37,
          'noorLon': double.negativeInfinity,
          'lat': 36.5,
          'lon': 127.5,
        }),
        const LatLng(36.5, 127.5),
      );
    });

    test('preserves a valid zero pair over lower-priority valid pairs', () {
      expect(
        pointOf({
          'noorLat': 0,
          'noorLon': '0',
          'frontLat': 37.4,
          'frontLon': 127.1,
          'lat': 35,
          'lon': 129,
        }),
        const LatLng(0, 0),
      );
      expect(
        pointOf({'frontLat': 0.0, 'frontLon': 0.0, 'lat': 35, 'lon': 129}),
        const LatLng(0, 0),
      );
    });

    test('returns LatLng(0, 0) when no coordinates are present', () {
      expect(pointOf({}), const LatLng(0, 0));
      expect(pointOf({'noorLat': null, 'lon': true}), const LatLng(0, 0));
    });
  });
}
