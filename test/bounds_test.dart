import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  group('LatLngBounds Tests', () {
    test('LatLngBounds contains and center calculation', () {
      const sw = LatLng(37.0, 126.0);
      const ne = LatLng(38.0, 128.0);
      const bounds = LatLngBounds(southWest: sw, northEast: ne);

      expect(bounds.center, equals(const LatLng(37.5, 127.0)));

      expect(bounds.contains(const LatLng(37.5, 127.0)), isTrue);
      expect(bounds.contains(const LatLng(36.9, 127.0)), isFalse);
      expect(bounds.contains(const LatLng(38.1, 127.0)), isFalse);
      expect(bounds.contains(const LatLng(37.5, 125.9)), isFalse);
      expect(bounds.contains(const LatLng(37.5, 128.1)), isFalse);
    });

    test('LatLngBounds JSON serialization / deserialization', () {
      const bounds = LatLngBounds(
        southWest: LatLng(37.0, 126.0),
        northEast: LatLng(38.0, 128.0),
      );
      final json = bounds.toJson();
      final fromJson = LatLngBounds.fromJson(json);

      expect(fromJson, equals(bounds));
    });
  });
}
