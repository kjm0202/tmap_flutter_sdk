import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart' show debugPrintSynchronously;
import 'package:flutter/widgets.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AuthRepository.initialize(
    appKey: const String.fromEnvironment('TMAP_APP_KEY'),
  );
  const bool onlyA10 = bool.fromEnvironment('REVERSE_A10_ONLY');

  final c = await mountLiveMap((created) => TMap(onMapCreated: created));

  final samples = [
    ('cityHall', 37.5665, 126.978),
    ('gangnam', 37.4979, 127.0276),
    ('invalid', 91.0, 127.051755),
  ];

  final runs = onlyA10 ? [('cityHallCombined', 37.5665, 126.978)] : samples;

  bool allPassed = true;

  for (final (name, lat, lon) in runs) {
    final addressType = onlyA10 ? 'A10' : 'A04';
    String outcomeStr = 'null';
    try {
      final r = await c
          .getAddressFromGeo(latLng: LatLng(lat, lon), addressType: addressType)
          .timeout(const Duration(seconds: 30));

      if (r != null) {
        outcomeStr = 'AddressInfo';

        // Check valid both return AddressInfo and nonempty fullAddress
        if (name != 'invalid' && r.fullAddress.isEmpty) {
          allPassed = false;
        }
        if (name == 'invalid') {
          allPassed = false; // Invalid should return null
        }

        final fields = {
          'fullAddress': r.fullAddress,
          'cityDo': r.cityDo,
          'guGun': r.guGun,
          'legalDong': r.legalDong,
          'adminDong': r.adminDong,
          'roadName': r.roadName,
          'buildingIndex': r.buildingIndex,
          'buildingName': r.buildingName,
          'bunji': r.bunji,
          'zipCode': r.zipCode,
          'point': r.point == null
              ? null
              : [r.point!.latitude, r.point!.longitude],
        };

        for (final entry in fields.entries) {
          printField(name, entry.key, entry.value);
        }
      } else {
        // Invalid should return null
        if (name != 'invalid') {
          allPassed = false; // Valid should return AddressInfo
        }
      }
      printOutcome(name, outcomeStr, addressType: addressType);
    } catch (e) {
      allPassed = false;
      printOutcome(name, 'exception', addressType: addressType);
    }
  }

  debugPrintSynchronously(allPassed ? 'RGQA_PASS' : 'RGQA_FAIL');
  debugPrintSynchronously('MOUNTED');
}

void printField(String name, String field, Object? value) {
  String state = 'value';
  if (value == null) {
    state = 'null';
  } else if ((value is String && value.isEmpty) ||
      (value is List && value.isEmpty)) {
    state = 'empty';
  }

  String type = 'null';
  if (value != null) {
    type = (value is List) ? 'array' : 'string';
  }

  final serialized = (value is List)
      ? jsonEncode(value)
      : (value?.toString() ?? '');
  final sha = sha256.convert(utf8.encode(serialized)).toString();

  final record = {
    'kind': 'field',
    'name': name,
    'field': field,
    'state': state,
    'type': type,
    'sha256': sha,
  };
  debugPrintSynchronously('RGQA ${jsonEncode(record)}');
}

void printOutcome(String sample, String outcome, {String addressType = 'A04'}) {
  final record = {
    'kind': 'outcome',
    'sample': sample,
    'outcome': outcome,
    'addressType': addressType,
    'timestamp': DateTime.now().toUtc().toIso8601String(),
  };
  debugPrintSynchronously('RGQA ${jsonEncode(record)}');
}
