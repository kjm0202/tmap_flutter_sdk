import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/src/models/lat_lng.dart';
import 'package:tmap_flutter_sdk/src/models/lat_lng_bounds.dart';
import 'package:tmap_flutter_sdk/src/utils/bounds_on_ready.dart';

void main() {
  const initial = LatLngBounds(
    southWest: LatLng(37.5, 126.9),
    northEast: LatLng(37.6, 127.0),
  );
  const updated = LatLngBounds(
    southWest: LatLng(37.4, 126.8),
    northEast: LatLng(37.7, 127.1),
  );

  test('bounds changed before ConfigLoad are applied on readiness', () {
    expect(boundsToApplyOnReady(initial, updated), same(updated));
    expect(boundsToApplyOnReady(null, updated), same(updated));
    expect(boundsToApplyOnReady(const LatLngBounds.empty(), updated),
        same(updated));
  });

  test('unchanged, null and empty bounds are excluded on readiness', () {
    expect(boundsToApplyOnReady(initial, initial), isNull);
    expect(
      boundsToApplyOnReady(
        initial,
        LatLngBounds(
          southWest: initial.southWest,
          northEast: initial.northEast,
        ),
      ),
      isNull,
    );
    expect(boundsToApplyOnReady(initial, null), isNull);
    expect(boundsToApplyOnReady(initial, const LatLngBounds.empty()), isNull);
  });
}
