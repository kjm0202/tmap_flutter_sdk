import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

late Future<http.Response> Function(http.Request) _handler;

http.Client _clientFactory() => MockClient((request) => _handler(request));

Future<AddressInfo?> _reverse() => http.runWithClient(
      () => TDataService.getAddressFromGeo(point: const LatLng(37, 127)),
      _clientFactory,
    );

void _respondWith(Map<String, dynamic> body) {
  _handler = (request) async {
    expect(request.method, 'GET');
    expect(request.url.path, '/tmap/geo/reversegeocoding');
    return http.Response(jsonEncode(body), 200);
  };
}

void main() {
  setUpAll(() => AuthRepository.initialize(appKey: 'fixture'));

  setUp(() {
    _handler = (_) => throw StateError('No response configured');
  });

  test('rejects empty and unrelated successful envelopes', () async {
    for (final body in <Map<String, dynamic>>[
      {},
      {'status': 'ok'},
      {'error': null, 'result': <String, dynamic>{}},
    ]) {
      _respondWith(body);
      expect(await _reverse(), isNull, reason: '$body');
    }
  });

  test('accepts documented and sparse nested addresses', () async {
    _respondWith({
      'addressInfo': {'fullAddress': 'Seoul', 'city_do': 'Seoul'},
    });
    final address = await _reverse();
    expect(address?.fullAddress, 'Seoul');
    expect(address?.cityDo, 'Seoul');

    _respondWith({'addressInfo': <String, dynamic>{}});
    final sparse = await _reverse();
    expect(sparse, isNotNull);
    expect(sparse!.fullAddress, '');
  });

  test('rejects invalid nested addresses even with outer address fields',
      () async {
    for (final value in [null, 'address', 1, true, <Object>[]]) {
      _respondWith({'addressInfo': value, 'fullAddress': 'outer'});
      expect(await _reverse(), isNull, reason: '$value');
    }
  });

  test('accepts each recognized flat address field even when sparse', () async {
    for (final field in [
      'fullAddress',
      'city_do',
      'gu_gun',
      'legalDong',
      'eup_myun',
      'adminDong',
      'roadName',
      'buildingIndex',
      'buildingName',
      'bunji',
      'zipCode',
      'roadPostcode',
      'postcode',
      'lat',
      'lon',
      'latitude',
      'longitude',
      'roadCoord',
      'legalDongCoord',
      'adminDongCoord',
    ]) {
      _respondWith({field: ''});
      expect(await _reverse(), isNotNull, reason: field);
    }
    _respondWith({'lat': '37', 'lon': '127'});
    expect((await _reverse())?.point, const LatLng(37, 127));
    _respondWith({'roadPostcode': '12345'});
    expect((await _reverse())?.zipCode, '12345');
  });

  test('accepts valid addresses with absent or null error', () async {
    for (final body in <Map<String, dynamic>>[
      {
        'addressInfo': {'fullAddress': 'nested'}
      },
      {
        'error': null,
        'addressInfo': {'fullAddress': 'nested'}
      },
      {'fullAddress': 'flat'},
      {'error': null, 'fullAddress': 'flat'},
    ]) {
      _respondWith(body);
      expect(await _reverse(), isNotNull, reason: '$body');
    }
  });

  test('direct response conversion retains sparse map behavior', () {
    final result = const TDataResponse(
            requestId: '', success: true, data: <String, dynamic>{})
        .toAddressInfo();
    expect(result, isNotNull);
    expect(result!.fullAddress, '');
  });
}
