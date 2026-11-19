import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  test('Bounds constructor, fields, cloning, updates and geometry', () {
    const bounds = Bounds(1, 2, 4, 8);
    expect(bounds.left, 1);
    expect(bounds.top, 2);
    expect(bounds.width, 4);
    expect(bounds.height, 8);
    expect(bounds.right, 5);
    expect(bounds.bottom, -6);
    expect(bounds.position, const Point(1, 2));
    expect(bounds.size, const Size(4, 8));
    expect(bounds.clone(), bounds);
    expect(identical(bounds.clone(), bounds), isFalse);
    expect(bounds.toString(), '1.00,2.00,4.00,8.00');
    expect(bounds.withLeft(-1), const Bounds(-1, 2, 4, 8));
    expect(bounds.withTop(10), const Bounds(1, 10, 4, 8));
    expect(bounds.withWidth(8), const Bounds(1, 2, 8, 8));
    expect(bounds.withHeight(9), const Bounds(1, 2, 4, 9));
    expect(bounds, const Bounds(1, 2, 4, 8));

    const edges = Bounds.fromEdges(left: 1, bottom: 2, right: 5, top: 10);
    expect(edges, const Bounds(1, 10, 4, 8));
    expect(edges.bottom, 2);
    expect(edges.right, 5);
    expect(edges.contains(const Bounds(2, 9, 1, 2)), isTrue);
    expect(edges.contains(const Bounds(2, 9, 1, 2), includeBoundary: false),
        isTrue);
    expect(edges.contains(const Bounds(1, 9, 1, 2), includeBoundary: false),
        isFalse);
    expect(edges.containsPoint(const Point(5, 2)), isTrue);
    expect(edges.containsPoint(const Point(5, 2), includeBoundary: false),
        isFalse);
    expect(edges.containsPoint(const Point(8, 4)), isFalse);
    expect(bounds.intersects(const Bounds(5, 2, 7, 8)), isTrue);
    expect(bounds.intersects(const Bounds(5.01, 2, 1, 8)), isFalse);
    expect(bounds.union(const Bounds(5, 2, 7, 8)), const Bounds(1, 2, 11, 8));
    // SDK intersects/union treat top + height as the lower edge; contains
    // follows the documented bottom (top - height) geometry instead.
    expect(bounds.intersects(const Bounds(1, 10, 1, 1)), isTrue);
    expect(bounds.union(const Bounds(1, 10, 1, 1)),
        const Bounds(1, 2, 4, 9));
    expect(bounds.contains(const Bounds(1, 1, 1, 1)), isTrue);
    expect(bounds.contains(const Bounds(1, 1, 1, 1), includeBoundary: false),
        isFalse);
    expect(bounds.contains(const Bounds(1, 3, 1, 1)), isFalse);
    expect(bounds, const Bounds(1, 2, 4, 8));
  });

  test('LatLngBounds corners, extend, union, metres and antimeridian', () {
    const bounds = LatLngBounds(
      southWest: LatLng(10, 20),
      northEast: LatLng(20, 40),
    );
    expect(bounds.isEmpty, isFalse);
    expect(bounds.normalizedSouthWest, const LatLng(10, 20));
    expect(bounds.normalizedNorthEast, const LatLng(20, 40));
    expect(bounds.northWest, const LatLng(20, 20));
    expect(bounds.southEast, const LatLng(10, 40));
    expect(bounds.center, const LatLng(15, 30));
    expect(bounds.width, closeTo(2088426.1908793414, 0.001));
    expect(bounds.height, closeTo(1111895.7696000016, 0.001));
    expect(bounds.contains(const LatLng(10, 20)), isTrue);
    expect(bounds.contains(const LatLng(15, 30)), isTrue);
    expect(bounds.contains(const LatLng(21, 30)), isFalse);
    expect(
        bounds.intersects(const LatLngBounds(
          southWest: LatLng(20, 40),
          northEast: LatLng(25, 50),
        )),
        isTrue);
    expect(
        bounds.intersects(const LatLngBounds(
          southWest: LatLng(21, 41),
          northEast: LatLng(25, 50),
        )),
        isFalse);
    expect(
        bounds.extend(const LatLng(5, 50)),
        const LatLngBounds(
          southWest: LatLng(5, 20),
          northEast: LatLng(20, 50),
        ));
    expect(
        bounds.union(const LatLngBounds(
          southWest: LatLng(15, 30),
          northEast: LatLng(25, 50),
        )),
        const LatLngBounds(
          southWest: LatLng(10, 20),
          northEast: LatLng(25, 50),
        ));
    expect(bounds.toString(), '10.0,20.0:20.0,40.0');

    const empty = LatLngBounds.empty();
    expect(empty.isEmpty, isTrue);
    expect(empty.contains(const LatLng(0, 0)), isFalse);
    expect(empty.width, 0);
    expect(empty.height, 0);
    expect(empty.extend(const LatLng(4, 5)).isEmpty, isFalse);
    expect(empty.union(bounds), bounds);

    // The SDK sorts 170 and -170, so +/-179 is outside and 0 is inside.
    const crossing = LatLngBounds(
      southWest: LatLng(-10, 170),
      northEast: LatLng(10, -170),
    );
    expect(crossing.normalizedSouthWest, const LatLng(-10, -170));
    expect(crossing.normalizedNorthEast, const LatLng(10, 170));
    expect(crossing.center, const LatLng(0, 0));
    expect(crossing.contains(const LatLng(0, 179)), isFalse);
    expect(crossing.contains(const LatLng(0, -179)), isFalse);
    expect(crossing.contains(const LatLng(0, 0)), isTrue);
    expect(crossing.width, closeTo(2189667.889409638, 0.001));
    expect(
        crossing,
        const LatLngBounds(
          southWest: LatLng(-10, -170),
          northEast: LatLng(10, 170),
        ));
  });

  test('LatLng clone, distance, updates and two projections', () {
    const seoul = LatLng(37.5665, 126.978);
    expect(seoul.clone(), seoul);
    expect(identical(seoul.clone(), seoul), isFalse);
    expect(seoul.withLatitude(35), const LatLng(35, 126.978));
    expect(seoul.withLongitude(129), const LatLng(37.5665, 129));
    expect(seoul.toString(), '37.5665,126.978');
    expect(const LatLng(0, 0).distanceTo(const LatLng(0, 1)),
        closeTo(111189.5769599889, 0.01));
    expect(seoul.distanceTo(const LatLng(35.1796, 129.0756)),
        closeTo(325095.6174645442, 0.01));
    expect(seoul == const LatLng(37.5665000001, 126.978), isFalse);
    expect(seoul.toEPSG3857().x, closeTo(14135126.30194829, 0.001));
    expect(seoul.toEPSG3857().y, closeTo(4518366.509981736, 0.001));
    expect(seoul.toBesselTm().x, closeTo(197988.2559800241, 0.01));
    expect(seoul.toBesselTm().y, closeTo(451580.91217548324, 0.01));
  });

  test('Point constructor, clone, distance, setters, offset and equality', () {
    const point = Point(3, 4);
    expect(point.x, 3);
    expect(point.y, 4);
    expect(point.clone(), const Point(3, 4));
    expect(identical(point.clone(), point), isFalse);
    expect(point.distanceTo(const Point(0, 0)), 5);
    expect(point.withValue(7, 8), const Point(7, 8));
    expect(point.withX(9), const Point(9, 4));
    expect(point.withY(-2), const Point(3, -2));
    expect(point.offset(2, -3), const Point(5, 1));
    expect(point, const Point(3, 4));
    expect(point == const Point(3.0000000001, 4), isFalse);
    expect(point.toString(), '3.00,4.00');
  });

  test('Size constructor, fields and structural equality', () {
    const a = Size(3, 4);
    expect(a.width, 3);
    expect(a.height, 4);
    expect(a, const Size(3, 4));
    expect(a == const Size(3.0000000001, 4), isFalse);
    expect(a.hashCode, const Size(3, 4).hashCode);
  });
}
