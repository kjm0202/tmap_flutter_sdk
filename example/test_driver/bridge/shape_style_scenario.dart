import 'dart:convert';

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _points = [
  LatLng(37.56, 126.97),
  LatLng(37.56, 126.98),
  LatLng(37.57, 126.97),
];
const _center = LatLng(37.5665, 126.978);
const _radius = 250.0;
const _bounds = LatLngBounds(
  southWest: LatLng(37.56, 126.97),
  northEast: LatLng(37.57, 126.98),
);

/// Compares attached public Dart shapes with attached official SDK controls.
Future<void> testShapeStyle() async {
  final controller = await mountLiveMap(
    (created) => TMap(center: _center, zoom: 14, onMapCreated: created),
  );
  try {
    for (final type in ['polyline', 'polygon', 'circle', 'rectangle']) {
      for (final variant in ['default', 'positive', 'zero', 'opacity']) {
        final width = variant == 'positive'
            ? 7
            : variant == 'zero'
            ? 0
            : null;
        final opacity = variant == 'opacity' ? 0.0 : 1.0;
        final fillOpacity = variant == 'opacity'
            ? 0.0
            : (type == 'polygon' ? 0.4 : 0.3);
        final id = '$type-style';

        // Use the public constructor with omitted style arguments for the default.
        switch (type) {
          case 'polyline':
            await controller.addPolyline(
              variant == 'default'
                  ? Polyline(polylineId: id, points: _points)
                  : Polyline(
                      polylineId: id,
                      points: _points,
                      strokeWidth: width ?? 5,
                      strokeOpacity: opacity,
                    ),
            );
          case 'polygon':
            await controller.addPolygon(
              variant == 'default'
                  ? Polygon(polygonId: id, points: _points)
                  : Polygon(
                      polygonId: id,
                      points: _points,
                      strokeWidth: width ?? 2,
                      strokeOpacity: opacity,
                      fillOpacity: fillOpacity,
                    ),
            );
          case 'circle':
            await controller.addCircle(
              variant == 'default'
                  ? Circle(circleId: id, center: _center, radius: _radius)
                  : Circle(
                      circleId: id,
                      center: _center,
                      radius: _radius,
                      strokeWidth: width ?? 2,
                      strokeOpacity: opacity,
                      fillOpacity: fillOpacity,
                    ),
            );
          case 'rectangle':
            await controller.addRectangle(
              variant == 'default'
                  ? Rectangle(rectangleId: id, bounds: _bounds)
                  : Rectangle(
                      rectangleId: id,
                      bounds: _bounds,
                      strokeWidth: width ?? 2,
                      strokeOpacity: opacity,
                      fillOpacity: fillOpacity,
                    ),
            );
        }

        final shape =
            '(window.tmap_instances ? '
            'Object.values(window.tmap_instances)[0].${type}s["$id"] : '
            'window.${type}s["$id"])';
        await expectLive(
          '$type $variant attached',
          () => checkJs(
            controller,
            'Boolean($shape && $shape.getMap() === map && '
            'map.vsmMap().hasLayer($shape._shape_data.layerId))',
          ),
        );

        final color = type == 'circle'
            ? '#ff0000'
            : type == 'rectangle'
            ? '#00aa00'
            : '#0066ff';
        final requestedWidth = width ?? (type == 'polyline' ? 5 : 2);
        List<double> coordinate(LatLng p) => [p.latitude, p.longitude];
        final geometry = jsonEncode({
          'points': _points.map(coordinate).toList(),
          'center': coordinate(_center),
          'radius': _radius,
          'southWest': coordinate(_bounds.southWest),
          'northEast': coordinate(_bounds.northEast),
        });
        final rawResult = await runJs(controller, '''(function() {
          const T = window.Tmapv3;
          const input = $geometry;
          const latLng = p => new T.LatLng(p[0], p[1]);
          const points = input.points.map(latLng);
          const options = {map: map, strokeColor: '$color',
            strokeWeight: $requestedWidth, strokeOpacity: $opacity};
          if ('$type' !== 'polyline') {
            options.fillColor = '$color';
            options.fillOpacity = $fillOpacity;
          }
          if ('$type' === 'polyline') options.path = points;
          if ('$type' === 'polygon') options.paths = points;
          if ('$type' === 'circle') {
            options.center = latLng(input.center);
            options.radius = input.radius;
          }
          if ('$type' === 'rectangle') {
            // The SDK constructor takes southWest first, northEast second.
            options.bounds = new T.LatLngBounds(
              latLng(input.southWest), latLng(input.northEast));
          }
          const constructors = {polyline: T.Polyline, polygon: T.Polygon,
            circle: T.Circle, rectangle: T.Rectangle};
          const direct = new constructors['$type'](options);
          let omitted, mismatch;
          try {
            const read = function(s) {
              const data = s._shape_data, style = data.vsmStyle;
              const keys = ['$type' === 'polyline' ? null : 'fill-opacity',
                'stroke-width', 'stroke-opacity'].filter(Boolean);
              if (!keys.every(k => typeof style[k] === 'number')) {
                throw new Error('Missing numeric SDK style fields: ' + keys.join(', '));
              }
              return {width: style['stroke-width'], strokeOpacity: style['stroke-opacity'],
                fillOpacity: '$type' === 'polyline' ? null : style['fill-opacity']};
            };
            const readGeometry = function(s) {
              if ('$type' === 'polyline' || '$type' === 'polygon') {
                return s.getPath().path.map(p => [p.lat(), p.lng()]);
              }
              if ('$type' === 'circle') {
                const center = s.getCenter();
                return [center.lat(), center.lng(), s.getRadius()];
              }
              const bounds = s.getBounds();
              const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
              return [[sw.lat(), sw.lng()], [ne.lat(), ne.lng()]];
            };
            const attached = direct.getMap() === map &&
              map.vsmMap().hasLayer(direct._shape_data.layerId);
            // This is a separate direct omitted-option control, not Dart's default.
            if ('$variant' === 'default') {
              const omittedOptions = Object.assign({}, options);
              delete omittedOptions.strokeWeight;
              omitted = new constructors['$type'](omittedOptions);
            }
            // Exercise the comparison against the original zero-width mistake.
            if ('$type' === 'rectangle' && '$variant' === 'default') {
              const wrongNe = [input.northEast[0], input.southWest[1]];
              mismatch = new T.Rectangle(Object.assign({}, options, {
                bounds: new T.LatLngBounds(latLng(input.southWest), latLng(wrongNe))
              }));
            }
            return {attached: attached, dart: read($shape), direct: read(direct),
              dartGeometry: readGeometry($shape), directGeometry: readGeometry(direct),
              mismatchGeometry: mismatch ? readGeometry(mismatch) : null,
              sdkOmittedStrokeWeightWidth: omitted ? read(omitted).width : null};
          } finally {
            direct.setMap(null);
            if (omitted) omitted.setMap(null);
            if (mismatch) mismatch.setMap(null);
          }
        })()''');

        if (rawResult == null) {
          throw StateError('Failed to get shape style result for $type $variant');
        }
        final Map<String, dynamic> result = (rawResult is String)
            ? jsonDecode(rawResult)
            : Map<String, dynamic>.from(rawResult as Map<dynamic, dynamic>);

        final actual = result['dart'] as Map<String, dynamic>;
        final expectedWidth = variant == 'zero' ? 2 : requestedWidth;
        if (result['attached'] != true ||
            jsonEncode(actual) != jsonEncode(result['direct']) ||
            actual['width'] != expectedWidth ||
            (variant == 'default' &&
                result['sdkOmittedStrokeWeightWidth'] != 2)) {
          throw StateError('$type $variant style mismatch: $result');
        }
        if (jsonEncode(result['dartGeometry']) !=
                jsonEncode(result['directGeometry']) ||
            (type == 'rectangle' &&
                variant == 'default' &&
                (jsonEncode(result['directGeometry']) !=
                        jsonEncode([
                          coordinate(_bounds.southWest),
                          coordinate(_bounds.northEast),
                        ]) ||
                    jsonEncode(result['dartGeometry']) ==
                        jsonEncode(result['mismatchGeometry']) ||
                    result['mismatchGeometry'] == null))) {
          throw StateError('$type $variant geometry mismatch: $result');
        }
      }
    }
  } finally {
    await controller.clearAll();
    await unmountLiveMap();
  }
}
