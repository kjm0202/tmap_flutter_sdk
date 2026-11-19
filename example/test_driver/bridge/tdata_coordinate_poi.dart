import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

Future<void> verifyPoiCoordinates(TMapController controller) async {
  const appKey = String.fromEnvironment('TMAP_APP_KEY');
  final uri = Uri.https('apis.openapi.sk.com', '/tmap/pois', {
    'version': '1',
    'format': 'json',
    'searchKeyword': '인천국제공항',
    'count': '20',
    'page': '1',
    'reqCoordType': 'WGS84GEO',
    'resCoordType': 'WGS84GEO',
    'centerLat': '37.4602',
    'centerLon': '126.4407',
  });

  final response = await http.get(uri, headers: {'appKey': appKey});
  if (response.statusCode != 200) {
    throw StateError('POI REST API failed: ${response.statusCode}');
  }
  final List<dynamic> rawRows = json.decode(
    utf8.decode(response.bodyBytes),
  )['searchPoiInfo']['pois']['poi'];

  final sdkPois = await controller.searchPoi(
    keyword: '인천국제공항',
    count: 20,
    center: LatLng(37.4602, 126.4407),
  );

  final rawIds = [
    for (final row in rawRows) (row['id'] ?? row['pkey']).toString(),
  ];
  final sdkIds = [for (final poi in sdkPois) poi.id];
  if (rawIds.length != sdkIds.length) {
    throw StateError(
      'POI count mismatch: raw ${rawIds.length}, sdk ${sdkIds.length}',
    );
  }
  for (int i = 0; i < rawIds.length; i++) {
    if (rawIds[i] != sdkIds[i]) {
      throw StateError('POI place ID mismatch at row $i');
    }
  }

  int rawRowCount = rawRows.length;
  int comparedRows = 0;
  int distinctlyDifferentPairs = 0;
  int controlledMissingNoorCount = 0;

  for (int i = 0; i < rawRows.length; i++) {
    final row = rawRows[i];

    final noorLat = double.tryParse(row['noorLat']?.toString() ?? '');
    final noorLon = double.tryParse(row['noorLon']?.toString() ?? '');
    final frontLat = double.tryParse(row['frontLat']?.toString() ?? '');
    final frontLon = double.tryParse(row['frontLon']?.toString() ?? '');

    if (noorLat == null ||
        noorLon == null ||
        frontLat == null ||
        frontLon == null) {
      continue;
    }

    comparedRows++;

    final rawItem = PoiItem.fromJson(Map<String, dynamic>.from(row));
    final sdkPoi = sdkPois[i];

    if (rawItem.id != sdkPoi.id) {
      throw StateError('PoiItem place ID mismatch at row $i');
    }
    if (rawItem.point.latitude != noorLat ||
        rawItem.point.longitude != noorLon ||
        sdkPoi.point.latitude != noorLat ||
        sdkPoi.point.longitude != noorLon) {
      throw StateError('POI noor coordinate mismatch at row $i');
    }

    if ((noorLat - frontLat).abs() > 0.001 ||
        (noorLon - frontLon).abs() > 0.001) {
      distinctlyDifferentPairs++;
    }

    final controlled = Map<String, dynamic>.from(row);
    controlled.remove('noorLat');
    controlled.remove('noorLon');
    final replayed = PoiItem.fromJson(controlled);

    if (replayed.point.latitude != frontLat ||
        replayed.point.longitude != frontLon) {
      throw StateError(
        'Controlled replay without noor fields at row $i '
        'did not fall back to exact front coordinates',
      );
    }
    controlledMissingNoorCount++;
  }

  print(
    'TDATA_POI_SAMPLE ' +
        jsonEncode({
          'rawRowCount': rawRowCount,
          'comparedRows': comparedRows,
          'distinctlyDifferentPairs': distinctlyDifferentPairs,
          'controlledMissingNoorCount': controlledMissingNoorCount,
        }),
  );

  if (comparedRows == 0) {
    throw StateError('No POI rows carried both noor and front coordinates');
  }
  if (distinctlyDifferentPairs == 0) {
    throw StateError(
      'No POI row had noor and front coordinates differing '
      'by more than 0.001 degrees',
    );
  }
  if (controlledMissingNoorCount != comparedRows) {
    throw StateError(
      'Controlled replay count $controlledMissingNoorCount '
      'does not equal compared rows $comparedRows',
    );
  }
}
