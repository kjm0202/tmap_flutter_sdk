import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  group('LatLng Tests', () {
    test('LatLng instantiation and equality', () {
      const coord1 = LatLng(37.5665, 126.9780);
      const coord2 = LatLng(37.5665, 126.9780);
      const coord3 = LatLng(35.1796, 129.0756);

      expect(coord1, equals(coord2));
      expect(coord1, isNot(equals(coord3)));
      expect(coord1.latitude, 37.5665);
      expect(coord1.longitude, 126.9780);
    });

    test('LatLng JSON serialization / deserialization', () {
      const coord = LatLng(37.5665, 126.9780);
      final json = coord.toJson();
      final fromJson = LatLng.fromJson(json);

      expect(fromJson.latitude, coord.latitude);
      expect(fromJson.longitude, coord.longitude);
    });

    test('LatLng from alternative keys (lat, lon / lng)', () {
      final json1 = {'lat': 37.5, 'lon': 127.0};
      final json2 = {'lat': 37.5, 'lng': 127.0};

      expect(LatLng.fromJson(json1), equals(const LatLng(37.5, 127.0)));
      expect(LatLng.fromJson(json2), equals(const LatLng(37.5, 127.0)));
    });
  });
}
