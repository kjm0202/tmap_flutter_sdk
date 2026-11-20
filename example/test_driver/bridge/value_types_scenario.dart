import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

/// Compares pure Dart value operations with the installed official Tmapv3 SDK.
Future<void> testValueTypes() async {
  try {
    final controller = await mountLiveMap(
      (created) => TMap(onMapCreated: created),
    );
    final sdk = await runJs(controller, r'''(function() { try {
      const T = window.Tmapv3;
      const capture = fn => { try { return fn(); } catch (e) { return 'ERROR:' + e.message; } };
      const latLng = p => p == null ? null : typeof p.lat === 'function'
        ? [p.lat(), p.lng()] : {keys:Object.keys(p), text:String(p),
            latitude:p.latitude,longitude:p.longitude,x:p.x,y:p.y};
      const point = p => p == null ? null : [p.getX(), p.getY()];
      const b = new T.Bounds(1, 2, 4, 8);
      const bTouch = new T.Bounds(5, 2, 7, 8);
      const bInside = new T.Bounds(2, 3, 3, 4);
      const bDisjoint = new T.Bounds(5, 2, 7, 8);
      const bOutside = new T.Bounds(5.01, 2, 7, 8);
      const cDoc = new T.Bounds(1, 1, 1, 1);
      const cScr = new T.Bounds(1, 3, 1, 1);
      const dGap = new T.Bounds(1, 10, 1, 1);
      const bGapUnion = b.clone();
      const gapUnionResult = capture(() => bGapUnion.union(dGap));
      const gapIntersects = capture(() => b.intersects(dGap));
      const bUnion = b.clone();
      const unionResult = capture(() => bUnion.union(bDisjoint));
      const bSized = b.clone();
      bSized.setWidth(8); bSized.setHeight(9);
      const bSet = b.clone();
      bSet.setLeft(-1); bSet.setTop(10);
      const normal = new T.LatLngBounds(new T.LatLng(10, 20), new T.LatLng(20, 40));
      const cross = new T.LatLngBounds(new T.LatLng(-10, 170), new T.LatLng(10, -170));
      const single = new T.LatLngBounds();
      const singleEmpty = capture(() => single.isEmpty());
      single.extend(new T.LatLng(10, 20));
      single.extend(new T.LatLng(20, 40));
      const other = new T.LatLngBounds(new T.LatLng(15, 30), new T.LatLng(25, 50));
      const nonoverlap = new T.LatLngBounds(new T.LatLng(21, 41), new T.LatLng(25, 50));
      const overlap = capture(() => normal.intersects(other));
      const noOverlap = capture(() => normal.intersects(nonoverlap));
      const united = new T.LatLngBounds(new T.LatLng(10, 20), new T.LatLng(20, 40));
      const unitedResult = capture(() => united.union(other));
      const a = new T.LatLng(37.5665, 126.978);
      const near = new T.LatLng(37.5665000001, 126.978);
      const p = new T.Point(3, 4);
      const po = new T.Point(3, 4);
      const pOffset = capture(() => p.offset(2, -3));
      const pValue = new T.Point(3, 4);
      pValue.setValue(7, 8);
      const pSet = new T.Point(3, 4);
      pSet.setX(9); pSet.setY(-2);
      return {
        bounds: {width:b.getWidth(),height:b.getHeight(),pos:point(b.getPosition()),
          size:[b.getSize().getWidth(),b.getSize().getHeight()],text:b.toString(),
          clone:b.clone().toString(),inside:b.contains(bInside),
          touch:b.contains(bTouch),strictTouch:b.contains(bTouch,false),
          intersectsTouch:b.intersects(bTouch),intersectsStrict:b.intersects(bTouch,false),
          intersectsDisjoint:b.intersects(bOutside),
          unionResult:unionResult == null ? null : String(unionResult),union:bUnion.toString(),
          sized:bSized.toString(),set:bSet.toString(),
          containsDoc:b.contains(cDoc),containsDocStrict:b.contains(cDoc,false),
          containsScr:b.contains(cScr),gapUnion:bGapUnion.toString(),
          gapUnionResult:gapUnionResult == null ? null : String(gapUnionResult),
          gapIntersects:gapIntersects},
        latLngBounds: {center:latLng(normal.getCenter()),ne:latLng(normal.getNorthEast()),
          nw:latLng(normal.getNorthWest()),sw:latLng(normal.getSouthWest()),
          se:latLng(normal.getSouthEast()),width:normal.getWidth(),height:normal.getHeight(),
          empty:normal.isEmpty(),text:normal.toString(),
          inside:normal.contains(new T.LatLng(15,30)),boundary:normal.contains(new T.LatLng(10,20)),
          outside:normal.contains(new T.LatLng(15,50)),overlap:overlap,
          disjoint:noOverlap == null ? null : noOverlap,
          singleEmpty:singleEmpty,single:single.toString(),
          unionReturn:unitedResult == null ? null : String(unitedResult),
          union:united.toString(),equals:normal.equals(new T.LatLngBounds(new T.LatLng(10,20),new T.LatLng(20,40))),
          equalsNear:normal.equals(new T.LatLngBounds(new T.LatLng(10,20.0000000001),new T.LatLng(20,40)))},
        antimeridian: {sw:latLng(cross.getSouthWest()),ne:latLng(cross.getNorthEast()),
          center:latLng(cross.getCenter()),width:cross.getWidth(),height:cross.getHeight(),
          empty:cross.isEmpty(),positive:cross.contains(new T.LatLng(0,179)),
          negative:cross.contains(new T.LatLng(0,-179)),zero:cross.contains(new T.LatLng(0,0))},
        latLng:{clone:latLng(a.clone()),text:a.toString(),
          equals:a.equals(new T.LatLng(37.5665,126.978)),equalsNear:a.equals(near),
          distanceDegree:new T.LatLng(0,0).distanceTo(new T.LatLng(0,1)),
          distanceSeoul:a.distanceTo(new T.LatLng(35.1796,129.0756)),
          mercator:latLng(a.toEPSG3857()),bessel:latLng(a.toBesselTm()),
          set:(function(){const v=a.clone();v.setLatitude(35);v.setLongitude(129);return latLng(v);})()},
        point:{clone:point(po.clone()),text:po.toString(),
          equals:po.equals(new T.Point(3,4)),equalsNear:po.equals(new T.Point(3.0000000001,4)),
          distance:po.distanceTo(new T.Point(0,0)),
          offsetResult:pOffset == null ? null : String(pOffset),afterOffset:point(p),
          value:point(pValue),set:point(pSet)},
        size:{equals:new T.Size(3,4).equals(new T.Size(3,4)),
          equalsNear:new T.Size(3,4).equals(new T.Size(3.0000000001,4)),
          width:new T.Size(3,4).getWidth(),height:new T.Size(3,4).getHeight()}
      };
    } catch (e) { return {fatal: String(e), stack: String(e.stack).slice(0, 700)}; }
    })()''');
    final decoded = sdk is String ? jsonDecode(sdk) : sdk;
    if (decoded is! Map) {
      throw StateError(
          'SDK value probe returned ${decoded.runtimeType}, expected Map');
    }
    final result = Map<String, dynamic>.from(decoded);
    if (result.containsKey('fatal')) {
      throw StateError('SDK value probe failed: ${result['fatal']}');
    }

    List<double> latLngPair(LatLng value) => [value.latitude, value.longitude];
    List<double> pointPair(Point value) => [value.x, value.y];
    bool equivalent(Object? actual, Object? expected, double tolerance) {
      if (actual is num && expected is num) {
        return (actual - expected).abs() <= tolerance;
      }
      if (actual is List && expected is List) {
        return actual.length == expected.length &&
            List.generate(actual.length, (i) => i).every(
              (i) => equivalent(actual[i], expected[i], tolerance),
            );
      }
      return actual == expected;
    }

    const bounds = Bounds(1, 2, 4, 8);
    const normal = LatLngBounds(
      southWest: LatLng(10, 20),
      northEast: LatLng(20, 40),
    );
    const crossing = LatLngBounds(
      southWest: LatLng(-10, 170),
      northEast: LatLng(10, -170),
    );
    const seoul = LatLng(37.5665, 126.978);
    const pixel = Point(3, 4);
    const dimensions = Size(3, 4);
    final other = const LatLngBounds(
      southWest: LatLng(15, 30),
      northEast: LatLng(25, 50),
    );
    final joined = normal.union(other);
    final expanded = const LatLngBounds.empty()
        .extend(const LatLng(10, 20))
        .extend(const LatLng(20, 40));
    final checks =
        <({String group, String field, Object? expected, double tolerance})>[
      (group: 'bounds', field: 'width', expected: bounds.width, tolerance: 0),
      (group: 'bounds', field: 'height', expected: bounds.height, tolerance: 0),
      (
        group: 'bounds',
        field: 'pos',
        expected: pointPair(bounds.position),
        tolerance: 0
      ),
      (
        group: 'bounds',
        field: 'size',
        expected: [bounds.size.width, bounds.size.height],
        tolerance: 0
      ),
      (
        group: 'bounds',
        field: 'text',
        expected: bounds.toString(),
        tolerance: 0
      ),
      (
        group: 'bounds',
        field: 'clone',
        expected: bounds.clone().toString(),
        tolerance: 0
      ),
      (group: 'bounds', field: 'touch', expected: false, tolerance: 0),
      (group: 'bounds', field: 'strictTouch', expected: false, tolerance: 0),
      (
        group: 'bounds',
        field: 'intersectsTouch',
        expected: bounds.intersects(const Bounds(5, 2, 7, 8)),
        tolerance: 0
      ),
      (
        group: 'bounds',
        field: 'intersectsDisjoint',
        expected: bounds.intersects(const Bounds(5.01, 2, 7, 8)),
        tolerance: 0
      ),
      (group: 'bounds', field: 'unionResult', expected: null, tolerance: 0),
      (
        group: 'bounds',
        field: 'union',
        expected: bounds.union(const Bounds(5, 2, 7, 8)).toString(),
        tolerance: 0
      ),
      (group: 'bounds', field: 'gapUnionResult', expected: null, tolerance: 0),
      (
        group: 'bounds',
        field: 'sized',
        expected: bounds.withWidth(8).withHeight(9).toString(),
        tolerance: 0
      ),
      (
        group: 'bounds',
        field: 'set',
        expected: bounds.withLeft(-1).withTop(10).toString(),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'center',
        expected: latLngPair(normal.center),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'ne',
        expected: latLngPair(normal.normalizedNorthEast),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'nw',
        expected: latLngPair(normal.northWest),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'sw',
        expected: latLngPair(normal.normalizedSouthWest),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'se',
        expected: latLngPair(normal.southEast),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'width',
        expected: normal.width,
        tolerance: 0.01
      ),
      (
        group: 'latLngBounds',
        field: 'height',
        expected: normal.height,
        tolerance: 0.01
      ),
      (
        group: 'latLngBounds',
        field: 'empty',
        expected: normal.isEmpty,
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'text',
        expected: normal.toString(),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'inside',
        expected: normal.contains(const LatLng(15, 30)),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'boundary',
        expected: normal.contains(const LatLng(10, 20)),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'outside',
        expected: normal.contains(const LatLng(15, 50)),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'overlap',
        expected: normal.intersects(other),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'singleEmpty',
        expected: const LatLngBounds.empty().isEmpty,
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'single',
        expected: expanded.toString(),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'unionReturn',
        expected: joined.toString(),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'union',
        expected: joined.toString(),
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'equals',
        expected: normal == normal,
        tolerance: 0
      ),
      (
        group: 'latLngBounds',
        field: 'equalsNear',
        expected: normal ==
            const LatLngBounds(
                southWest: LatLng(10, 20.0000000001),
                northEast: LatLng(20, 40)),
        tolerance: 0
      ),
      (
        group: 'antimeridian',
        field: 'sw',
        expected: latLngPair(crossing.normalizedSouthWest),
        tolerance: 0
      ),
      (
        group: 'antimeridian',
        field: 'ne',
        expected: latLngPair(crossing.normalizedNorthEast),
        tolerance: 0
      ),
      (
        group: 'antimeridian',
        field: 'center',
        expected: latLngPair(crossing.center),
        tolerance: 0
      ),
      (
        group: 'antimeridian',
        field: 'width',
        expected: crossing.width,
        tolerance: 0.01
      ),
      (
        group: 'antimeridian',
        field: 'height',
        expected: crossing.height,
        tolerance: 0.01
      ),
      (
        group: 'antimeridian',
        field: 'empty',
        expected: crossing.isEmpty,
        tolerance: 0
      ),
      (
        group: 'antimeridian',
        field: 'positive',
        expected: crossing.contains(const LatLng(0, 179)),
        tolerance: 0
      ),
      (
        group: 'antimeridian',
        field: 'negative',
        expected: crossing.contains(const LatLng(0, -179)),
        tolerance: 0
      ),
      (
        group: 'antimeridian',
        field: 'zero',
        expected: crossing.contains(const LatLng(0, 0)),
        tolerance: 0
      ),
      (
        group: 'latLng',
        field: 'clone',
        expected: latLngPair(seoul.clone()),
        tolerance: 0
      ),
      (
        group: 'latLng',
        field: 'text',
        expected: seoul.toString(),
        tolerance: 0
      ),
      (
        group: 'latLng',
        field: 'equals',
        expected: seoul == seoul.clone(),
        tolerance: 0
      ),
      (
        group: 'latLng',
        field: 'equalsNear',
        expected: seoul == const LatLng(37.5665000001, 126.978),
        tolerance: 0
      ),
      (
        group: 'latLng',
        field: 'distanceDegree',
        expected: const LatLng(0, 0).distanceTo(const LatLng(0, 1)),
        tolerance: 0.01
      ),
      (
        group: 'latLng',
        field: 'distanceSeoul',
        expected: seoul.distanceTo(const LatLng(35.1796, 129.0756)),
        tolerance: 0.01
      ),
      (
        group: 'latLng',
        field: 'set',
        expected: latLngPair(seoul.withLatitude(35).withLongitude(129)),
        tolerance: 0
      ),
      (
        group: 'point',
        field: 'clone',
        expected: pointPair(pixel.clone()),
        tolerance: 0
      ),
      (group: 'point', field: 'text', expected: pixel.toString(), tolerance: 0),
      (
        group: 'point',
        field: 'equals',
        expected: pixel == pixel.clone(),
        tolerance: 0
      ),
      (
        group: 'point',
        field: 'equalsNear',
        expected: pixel == const Point(3.0000000001, 4),
        tolerance: 0
      ),
      (
        group: 'point',
        field: 'distance',
        expected: pixel.distanceTo(const Point(0, 0)),
        tolerance: 0
      ),
      (group: 'point', field: 'offsetResult', expected: null, tolerance: 0),
      (
        group: 'point',
        field: 'afterOffset',
        expected: pointPair(pixel.offset(2, -3)),
        tolerance: 0
      ),
      (
        group: 'point',
        field: 'value',
        expected: pointPair(pixel.withValue(7, 8)),
        tolerance: 0
      ),
      (
        group: 'point',
        field: 'set',
        expected: pointPair(pixel.withX(9).withY(-2)),
        tolerance: 0
      ),
      (
        group: 'size',
        field: 'equals',
        expected: dimensions == const Size(3, 4),
        tolerance: 0
      ),
      (
        group: 'size',
        field: 'equalsNear',
        expected: dimensions == const Size(3.0000000001, 4),
        tolerance: 0
      ),
      (group: 'size', field: 'width', expected: dimensions.width, tolerance: 0),
      (
        group: 'size',
        field: 'height',
        expected: dimensions.height,
        tolerance: 0
      ),
    ];
    for (final entry in checks) {
      final actual = (result[entry.group] as Map<String, dynamic>)[entry.field];
      if (!equivalent(actual, entry.expected, entry.tolerance)) {
        throw StateError(
          '${entry.group}.${entry.field}: SDK=${jsonEncode(actual)} Dart=${jsonEncode(entry.expected)}',
        );
      }
    }

    // The JS implementation reads point.x/point.y and an undefined
    // this._ne._lng, so it returns false even for a rectangle that is fully
    // inside by its own documented left/right/top/bottom geometry.
    // Dart supplies the documented containment instead.
    final sdkBounds = result['bounds'] as Map<String, dynamic>;
    const inner = Bounds(1, 1, 1, 1);
    if (sdkBounds['inside'] != false ||
        sdkBounds['containsDoc'] != false ||
        sdkBounds['containsScr'] != false ||
        !bounds.contains(inner) ||
        bounds.contains(inner, includeBoundary: false)) {
      throw StateError('Bounds.contains documented SDK discrepancy changed');
    }
    // The SDK ignores the strict-boundary argument and uses top + height for
    // intersections and unions. Dart consistently uses top - height.
    const edgeTouch = Bounds(5, 2, 7, 8);
    const aboveGap = Bounds(1, 10, 1, 1);
    if (sdkBounds['intersectsTouch'] != true ||
        sdkBounds['intersectsStrict'] != true ||
        !bounds.intersects(edgeTouch) ||
        bounds.intersects(edgeTouch, includeBoundary: false) ||
        sdkBounds['gapIntersects'] != true ||
        bounds.intersects(aboveGap) ||
        sdkBounds['gapUnion'] == bounds.union(aboveGap).toString() ||
        !bounds.union(aboveGap).contains(bounds) ||
        !bounds.union(aboveGap).contains(aboveGap)) {
      throw StateError('Bounds.intersects/union SDK discrepancy changed');
    }
    // The JS bounds predicate returns null for non-overlap. Dart supplies
    // the conventional false result through its non-nullable bool API.
    final sdkLatLngBounds = result['latLngBounds'] as Map<String, dynamic>;
    if (!sdkLatLngBounds.containsKey('disjoint') ||
        sdkLatLngBounds['disjoint'] != null ||
        normal.intersects(const LatLngBounds(
          southWest: LatLng(21, 41),
          northEast: LatLng(25, 50),
        ))) {
      throw StateError('LatLngBounds.intersects SDK null behavior changed');
    }
    final projected = result['latLng'] as Map<String, dynamic>;
    final converted = <String, Point>{
      'mercator': seoul.toEPSG3857(),
      'bessel': seoul.toBesselTm(),
    };
    for (final entry in converted.entries) {
      final actual = projected[entry.key] as Map<String, dynamic>;
      final tolerance = entry.key == 'bessel' ? 0.02 : 0.001;
      if (!equivalent(actual['x'], entry.value.x, tolerance) ||
          !equivalent(actual['y'], entry.value.y, tolerance)) {
        throw StateError('${entry.key} SDK projection does not match Dart');
      }
    }
    debugPrint('VALUE_TYPES_COMPARE_PASS: ${checks.length + 5} checks');
  } finally {
    await unmountLiveMap();
  }
}
