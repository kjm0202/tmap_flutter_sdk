import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _points = [
  LatLng(37.56, 126.97),
  LatLng(37.56, 126.98),
  LatLng(37.57, 126.97),
];
const _center = LatLng(37.5665, 126.978);
const _bounds = LatLngBounds(
  southWest: LatLng(37.56, 126.97),
  northEast: LatLng(37.57, 126.98),
);

/// Checks the real SDK's stored value, attachment, replacement and removal.
Future<void> _checkShape(
  TMapController controller, {
  required String name,
  required String collection,
  required int defaultZIndex,
  required Future<void> Function(int?) add,
  required Future<void> Function() clear,
  List<int> explicitValues = const [0, 50],
}) async {
  final id = '$name-zindex';
  final shape =
      '(window.tmap_instances ? '
      'Object.values(window.tmap_instances)[0]?.$collection?.["$id"] : '
      'window.$collection["$id"])';
  await expectLive(
    '$name initially absent',
    () => checkJs(controller, '$shape == null'),
  );

  // null invokes the actual Dart default; it is not an explicit zIndex.
  for (final z in <int?>[null, ...explicitValues]) {
    await checkJs(controller, '''(function() {
      window.__zIndexPrevious = $shape || null;
      window.__zIndexPreviousLayer = window.__zIndexPrevious?._shape_data?.layerId;
      return true;
    })()''');
    await add(z);
    await expectLive(
      '$name zIndex ${z ?? defaultZIndex} and replacement',
      () => checkJs(controller, '''(function() {
        const current = $shape;
        const previous = window.__zIndexPrevious;
        const vsm = map.vsmMap();
        return Boolean(current && current !== previous && current.getMap() === map &&
          current._shape_data?.zIndex === ${z ?? defaultZIndex} &&
          current._shape_data.layerId != null && vsm.hasLayer(current._shape_data.layerId) &&
          (!previous || (previous.getMap() == null &&
            !vsm.hasLayer(window.__zIndexPreviousLayer))));
      })()'''),
    );
  }

  await checkJs(controller, '''(function() {
    window.__zIndexPrevious = $shape;
    window.__zIndexPreviousLayer = window.__zIndexPrevious._shape_data.layerId;
    return true;
  })()''');
  await clear();
  await expectLive(
    '$name removed and layer detached',
    () => checkJs(
      controller,
      '$shape == null && window.__zIndexPrevious.getMap() == null && '
      '!map.vsmMap().hasLayer(window.__zIndexPreviousLayer)',
    ),
  );
  await checkJs(
    controller,
    '(delete window.__zIndexPrevious, delete window.__zIndexPreviousLayer)',
  );
}

Future<void> _withMap(Future<void> Function(TMapController) run) async {
  final controller = await mountLiveMap(
    (created) => TMap(center: _center, zoom: 14, onMapCreated: created),
  );
  try {
    await run(controller);
  } finally {
    await unmountLiveMap();
  }
}

/// Retains the existing polygon_zindex selector and its explicit cases.
Future<void> testPolygonZIndex() => _withMap(
  (controller) => _checkShape(
    controller,
    name: 'polygon',
    collection: 'polygons',
    defaultZIndex: 5,
    explicitValues: const [0, 5, 10, 50],
    add: (z) => controller.addPolygon(
      z == null
          ? const Polygon(polygonId: 'polygon-zindex', points: _points)
          : Polygon(polygonId: 'polygon-zindex', points: _points, zIndex: z),
    ),
    clear: () => controller.clearPolygon('polygon-zindex'),
  ),
);

/// Verifies the three shape APIs on an ordinary public controller.
Future<void> testShapeZIndex() => _withMap((controller) async {
  await _checkShape(
    controller,
    name: 'circle',
    collection: 'circles',
    defaultZIndex: 5,
    add: (z) => controller.addCircle(
      z == null
          ? const Circle(
              circleId: 'circle-zindex',
              center: _center,
              radius: 250,
            )
          : Circle(
              circleId: 'circle-zindex',
              center: _center,
              radius: 250,
              zIndex: z,
            ),
    ),
    clear: () => controller.clearCircle('circle-zindex'),
  );
  await _checkShape(
    controller,
    name: 'rectangle',
    collection: 'rectangles',
    defaultZIndex: 5,
    add: (z) => controller.addRectangle(
      z == null
          ? const Rectangle(rectangleId: 'rectangle-zindex', bounds: _bounds)
          : Rectangle(
              rectangleId: 'rectangle-zindex',
              bounds: _bounds,
              zIndex: z,
            ),
    ),
    clear: () => controller.clearRectangle('rectangle-zindex'),
  );
  await _checkShape(
    controller,
    name: 'polyline',
    collection: 'polylines',
    defaultZIndex: 10,
    add: (z) => controller.addPolyline(
      z == null
          ? const Polyline(polylineId: 'polyline-zindex', points: _points)
          : Polyline(polylineId: 'polyline-zindex', points: _points, zIndex: z),
    ),
    clear: () => controller.clearPolyline('polyline-zindex'),
  );
});
