import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

Future<void> verifyRouteCoordinates(TMapController controller) async {
  final url = Uri.parse(
    'https://apis.openapi.sk.com/tmap/routes?version=1&format=json',
  );
  final res = await http.post(
    url,
    headers: {
      'Content-Type': 'application/json',
      'appKey': const String.fromEnvironment('TMAP_APP_KEY'),
    },
    body: jsonEncode({
      'startX': 126.9723,
      'startY': 37.5589,
      'endX': 126.9875,
      'endY': 37.5682,
      'reqCoordType': 'WGS84GEO',
      'resCoordType': 'WGS84GEO',
      'searchOption': 0,
    }),
  );

  if (res.statusCode != 200) {
    throw StateError('Car WGS route API failed: ${res.statusCode}');
  }

  final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  final features = data['features'] as List<dynamic>;

  final expectedPath = <List<double>>[];
  final expectedGuides = <Map<String, Object>>[];
  int lineStrings = 0;
  int nonEmptyLineStrings = 0;
  int joins = 0;
  int blankGuideNames = 0;

  List<dynamic>? previousLine;
  for (final f in features) {
    final geom = f['geometry'] as Map<String, dynamic>;
    final props = f['properties'] as Map<String, dynamic>? ?? const {};

    if (geom['type'] == 'LineString') {
      final coords = geom['coordinates'] as List<dynamic>;
      lineStrings++;
      if (coords.isNotEmpty) nonEmptyLineStrings++;
      if (previousLine != null &&
          previousLine.isNotEmpty &&
          coords.isNotEmpty &&
          previousLine.last[0] == coords.first[0] &&
          previousLine.last[1] == coords.first[1]) {
        joins++;
      }
      for (final coord in coords) {
        expectedPath.add([
          (coord[0] as num).toDouble(),
          (coord[1] as num).toDouble(),
        ]);
      }
      previousLine = coords;
    } else if (geom['type'] == 'Point') {
      final coords = geom['coordinates'] as List<dynamic>;
      final name = props['name'] as String? ?? '';
      expectedGuides.add({
        'lat': (coords[1] as num).toDouble(),
        'lng': (coords[0] as num).toDouble(),
        'name': name,
        'description': props['description'] as String? ?? '',
      });
      if (name.isEmpty) blankGuideNames++;
    }
  }

  final plan = RouteInfo.fromJson(data);

  print(
    'TDATA_ROUTE_SAMPLE ' +
        jsonEncode({
          'lineStrings': lineStrings,
          'vertices': plan.path.length,
          'expectedVertices': expectedPath.length,
          'guides': plan.guidePoints.length,
          'expectedGuides': expectedGuides.length,
          'joins': joins,
          'emptyGuideNames': blankGuideNames,
        }),
  );

  if (nonEmptyLineStrings < 2 || expectedGuides.isEmpty || joins < 1) {
    throw StateError(
      'Car WGS witness lacks coverage: $nonEmptyLineStrings nonempty line '
      'strings, ${expectedGuides.length} guide points, $joins joins '
      '(need at least 2, 1, 1)',
    );
  }

  if (plan.path.length != expectedPath.length) {
    throw StateError(
      'Path length mismatch: ${plan.path.length} vs ${expectedPath.length}',
    );
  }
  for (int i = 0; i < expectedPath.length; i++) {
    if (plan.path[i].longitude != expectedPath[i][0] ||
        plan.path[i].latitude != expectedPath[i][1]) {
      throw StateError('Path coordinate mismatch at vertex $i');
    }
  }

  if (plan.guidePoints.length != expectedGuides.length) {
    throw StateError(
      'Guide point count mismatch: '
      '${plan.guidePoints.length} vs ${expectedGuides.length}',
    );
  }
  for (int i = 0; i < expectedGuides.length; i++) {
    final guide = plan.guidePoints[i];
    final expected = expectedGuides[i];
    if (guide.point.latitude != expected['lat'] ||
        guide.point.longitude != expected['lng']) {
      throw StateError('Guide point coordinate mismatch at guide $i');
    }
    if (guide.name != expected['name'] ||
        guide.description != expected['description']) {
      throw StateError('Guide name/description mismatch at guide $i');
    }
  }
}
