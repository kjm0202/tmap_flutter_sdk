import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'dart:convert';

import 'shape_pair_script.dart';
import 'cluster_shape_pair_io.dart';
import 'live_scenario.dart';

bool isClose(num a, num b) => (a.toDouble() - b.toDouble()).abs() < 1e-7;

bool arePointsClose(List<dynamic> a, List<dynamic> b) {
  return isClose(a[0] as num, b[0] as num) && isClose(a[1] as num, b[1] as num);
}

List<dynamic> normalize(String type, List<dynamic> points) {
  if (type == 'polygon' && points.length > 1) {
    final first = points.first as List<dynamic>;
    final last = points.last as List<dynamic>;
    if (arePointsClose(first, last)) {
      return points.sublist(0, points.length - 1);
    }
  }
  return points;
}

List<dynamic> modelToGeo(String type, dynamic model) {
  switch (type) {
    case 'polyline':
    case 'polygon':
      return (model.points as List<LatLng>)
          .map((p) => [p.latitude, p.longitude])
          .toList();
    case 'circle':
      return [model.center.latitude, model.center.longitude, model.radius];
    case 'rectangle':
      return [
        [model.bounds.southWest.latitude, model.bounds.southWest.longitude],
        [model.bounds.northEast.latitude, model.bounds.northEast.longitude]
      ];
    default:
      throw UnimplementedError();
  }
}

bool compareGeometries(String type, List<dynamic> raw, List<dynamic> expected) {
  if (type == 'polyline' || type == 'polygon') {
    if (raw.length != expected.length) return false;
    for (int i = 0; i < raw.length; i++) {
      if (!arePointsClose(
          raw[i] as List<dynamic>, expected[i] as List<dynamic>)) {
        return false;
      }
    }
    return true;
  } else if (type == 'circle') {
    return arePointsClose(raw.sublist(0, 2), expected.sublist(0, 2)) &&
        isClose((raw[2] as num).toDouble(), (expected[2] as num).toDouble());
  } else if (type == 'rectangle') {
    return arePointsClose(
            raw[0] as List<dynamic>, expected[0] as List<dynamic>) &&
        arePointsClose(raw[1] as List<dynamic>, expected[1] as List<dynamic>);
  }
  return false;
}

void validateModel(String type, dynamic rawData, dynamic model) {
  final bBefore = rawData['before'] as Map<String, dynamic>;
  final bAfter = rawData['after'] as Map<String, dynamic>;

  if (bBefore['layerId'] == null || bAfter['layerId'] == null) {
    throw StateError('$type: layerId is null');
  }

  if (bBefore['geometry'] == null || (bBefore['geometry'] as List).isEmpty) {
    throw StateError('$type: initial geometry is empty');
  }
  if (bAfter['geometry'] == null || (bAfter['geometry'] as List).isEmpty) {
    throw StateError('$type: reattached geometry is empty');
  }

  final rawGeo = bBefore['geometry'] as List<dynamic>;
  final normalizedRaw = normalize(type, rawGeo);
  final modelGeo = modelToGeo(type, model);

  if (!compareGeometries(type, normalizedRaw, modelGeo)) {
    throw StateError('$type: Geometry mismatch with model');
  }
}

Future<Map<String, dynamic>> runShapePair() async {
  final controller = await mountLiveMap((created) => TMap(
      center: const LatLng(37.5665, 126.978), zoom: 14, onMapCreated: created));

  await pairRead(controller, shapePairInstall);

  final results = <String, dynamic>{};
  final types = ['polyline', 'polygon', 'circle', 'rectangle'];

  try {
    for (final type in types) {
      final rawData =
          await pairRead(controller, 'window.__shapePair.raw("$type")');
      if (rawData == null) {
        throw StateError('Null rawData for $type (stage: raw)');
      }

      // Construct model
      dynamic model;
      switch (type) {
        case 'polyline':
          model = Polyline(polylineId: 'pair-shape', points: [
            const LatLng(37.5665, 126.978),
            const LatLng(37.5675, 126.979)
          ]);
          break;
        case 'polygon':
          model = Polygon(polygonId: 'pair-shape', points: [
            const LatLng(37.56, 126.97),
            const LatLng(37.56, 126.98),
            const LatLng(37.57, 126.97)
          ]);
          break;
        case 'circle':
          model = Circle(
              circleId: 'pair-shape',
              center: const LatLng(37.5665, 126.978),
              radius: 250);
          break;
        case 'rectangle':
          model = Rectangle(
              rectangleId: 'pair-shape',
              bounds: LatLngBounds(
                  southWest: const LatLng(37.55, 126.96),
                  northEast: const LatLng(37.56, 126.97)));
          break;
      }

      // Initial add
      switch (type) {
        case 'polyline':
          await controller.addPolyline(model);
          break;
        case 'polygon':
          await controller.addPolygon(model);
          break;
        case 'circle':
          await controller.addCircle(model);
          break;
        case 'rectangle':
          await controller.addRectangle(model);
          break;
      }

      final dartBefore =
          await pairRead(controller, 'window.__shapePair.dartBefore("$type")');

      // Clear
      switch (type) {
        case 'polyline':
          await controller.clearPolyline('pair-shape');
          break;
        case 'polygon':
          await controller.clearPolygon('pair-shape');
          break;
        case 'circle':
          await controller.clearCircle('pair-shape');
          break;
        case 'rectangle':
          await controller.clearRectangle('pair-shape');
          break;
      }

      final dartDetached = await pairRead(
          controller, 'window.__shapePair.dartDetached("$type")');

      // Re-add
      switch (type) {
        case 'polyline':
          await controller.addPolyline(model);
          break;
        case 'polygon':
          await controller.addPolygon(model);
          break;
        case 'circle':
          await controller.addCircle(model);
          break;
        case 'rectangle':
          await controller.addRectangle(model);
          break;
      }

      final dartAfter =
          await pairRead(controller, 'window.__shapePair.dartAfter("$type")');

      // Final Clear
      switch (type) {
        case 'polyline':
          await controller.clearPolyline('pair-shape');
          break;
        case 'polygon':
          await controller.clearPolygon('pair-shape');
          break;
        case 'circle':
          await controller.clearCircle('pair-shape');
          break;
        case 'rectangle':
          await controller.clearRectangle('pair-shape');
          break;
      }

      // Assertions
      if (rawData == null ||
          rawData['before'] == null ||
          rawData['after'] == null ||
          rawData['detached'] == null ||
          dartBefore == null ||
          dartDetached == null ||
          dartAfter == null ||
          dartAfter['after'] == null) {
        throw StateError('Null data for $type');
      }

      final bBefore = rawData['before'];
      final bAfter = rawData['after'];
      final bDetached = rawData['detached'];

      if (!(bBefore['rendered'] == true && bBefore['sameMap'] == true)) {
        throw StateError(
            '$type: rawData.before invalid: ${bBefore.toString()}');
      }
      if (!(bAfter['rendered'] == true && bAfter['sameMap'] == true)) {
        throw StateError('$type: rawData.after invalid: ${bAfter.toString()}');
      }
      if (!(dartBefore['rendered'] == true && dartBefore['sameMap'] == true)) {
        throw StateError('$type: dartBefore invalid: ${dartBefore.toString()}');
      }
      if (!(dartAfter['after']['rendered'] == true &&
          dartAfter['after']['sameMap'] == true)) {
        throw StateError(
            '$type: dartAfter.after invalid: ${dartAfter['after'].toString()}');
      }

      if (bDetached['rendered'] != false || bDetached['sameMap'] != false) {
        throw StateError(
            '$type: rawData.detached must have rendered=false, sameMap=false: ${bDetached.toString()}');
      }
      if (dartDetached['rendered'] != false ||
          dartDetached['sameMap'] != false) {
        throw StateError(
            '$type: dartDetached must have rendered=false, sameMap=false: ${dartDetached.toString()}');
      }

      if (rawData['sameIdentity'] != true) {
        throw StateError('$type: rawData.sameIdentity must be true');
      }
      if (dartAfter['sameIdentity'] != false) {
        throw StateError('$type: dartAfter.sameIdentity must be false');
      }

      validateModel(type, rawData, model);

      final geoBefore = jsonEncode(bBefore['geometry']);
      final geoAfter = jsonEncode(bAfter['geometry']);
      final geoDartBefore = jsonEncode(dartBefore['geometry']);
      final geoDartAfter = jsonEncode(dartAfter['after']['geometry']);

      if (geoBefore != geoAfter ||
          geoBefore != geoDartBefore ||
          geoBefore != geoDartAfter) {
        throw StateError(
            '$type: Geometry mismatch: \nBefore: $geoBefore\nAfter: $geoAfter\nDartBefore: $geoDartBefore\nDartAfter: $geoDartAfter');
      }

      results[type] = {
        'official': rawData,
        'dart': {
          'before': dartBefore,
          'detached': dartDetached,
          ...dartAfter,
        }
      };
    }
  } finally {
    await unmountLiveMap();
  }

  return results;
}
