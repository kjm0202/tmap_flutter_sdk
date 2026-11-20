import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  const projection = Projection();

  test('Web Mercator conversion matches TMAP SDK Seoul reference to 1e-7', () {
    const seoul = LatLng(37.5665, 126.978);
    final meter = projection.convertWGS84GEOToEPSG3857(seoul);
    expect(meter.x, closeTo(14135126.30194829, 1e-7));
    expect(meter.y, closeTo(4518366.509981736, 1e-7));

    final recovered = projection.convertEPSG3857ToWGS84GEO(meter);
    expect(recovered.latitude, closeTo(seoul.latitude, 1e-10));
    expect(recovered.longitude, closeTo(seoul.longitude, 1e-10));
  });

  test('Web Mercator zero and southern hemisphere retain signs and precision',
      () {
    final zero = projection.convertWGS84GEOToEPSG3857(const LatLng(0, 0));
    expect(zero.x, 0);
    expect(zero.y.abs(), lessThan(1e-7));

    for (final source in [
      const LatLng(-33.8688, 151.2093),
      const LatLng(35.1796, 129.0756),
      const LatLng(37.5796, 126.977),
    ]) {
      final projected = projection.convertWGS84GEOToEPSG3857(source);
      final restored = projection.convertEPSG3857ToWGS84GEO(projected);
      expect(restored.latitude, closeTo(source.latitude, 1e-10));
      expect(restored.longitude, closeTo(source.longitude, 1e-10));
    }
  });

  test('vendor-specific projection requires a connected map', () {
    expect(() => projection.convertWGS84GEOToKatec(const LatLng(37, 127)),
        throwsStateError);
  });
}
