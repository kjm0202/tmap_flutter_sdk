import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

/// Verifies the REST service's typed results against real HTTP responses.
Future<void> testTDataRestScenario() async {
  const cityHall = LatLng(37.5665, 126.978);
  const station = LatLng(37.5547, 126.9706);

  final route = await TDataService.getRoutePlan(
    start: cityHall,
    end: station,
  );
  if (route == null || route.totalDistance <= 0 || route.path.length < 2) {
    throw StateError('TData REST car route lacks distance or path');
  }

  final pedestrian = await TDataService.getRoutePlanPedestrian(
    start: cityHall,
    end: station,
    startName: '서울시청',
    endName: '서울역',
  );
  if (pedestrian == null ||
      pedestrian.totalDistance <= 0 ||
      pedestrian.path.length < 2) {
    throw StateError('TData REST pedestrian route lacks distance or path');
  }

  final pois = await TDataService.searchPoi(
    searchKeyword: '서울시청',
    count: 2,
  );
  if (pois.isEmpty || pois.first.id.isEmpty || pois.first.name.isEmpty) {
    throw StateError('TData REST POI search returned no usable ID');
  }
  final detail = await TDataService.getPoiById(poiId: pois.first.id);
  if (detail == null ||
      detail.id != pois.first.id ||
      detail.point == null ||
      detail.name.isEmpty) {
    throw StateError('TData REST POI detail did not match search result');
  }

  final around = await TDataService.searchPoiAround(
    center: cityHall,
    categories: '편의점',
    radius: 1,
    count: 2,
  );
  if (around.isEmpty || around.first.name.isEmpty) {
    throw StateError('TData REST POI around search returned no data');
  }

  final geocoded = await TDataService.getGeoFromAddress(
    address: '서울특별시 중구 세종대로 110',
  );
  final legacy = await TDataService.getGeoFromAddressLegacy(
    cityDo: '서울',
    guGun: '중구',
    dong: '태평로1가',
    bunji: '31',
  );
  if (geocoded == null ||
      legacy == null ||
      (geocoded.latitude - cityHall.latitude).abs() > 0.01 ||
      (legacy.longitude - cityHall.longitude).abs() > 0.01) {
    throw StateError('TData REST address coordinates out of expected area');
  }

  final address = await TDataService.getAddressFromGeo(point: cityHall);
  if (address == null || !address.fullAddress.contains('서울')) {
    throw StateError('TData REST reverse geocoding returned no address');
  }

  final suggestions = await TDataService.getAutoCompleteSearch(
    keyword: '서울역',
  );
  if (!suggestions.any((s) => s.keyword.contains('서울역'))) {
    throw StateError('TData REST autocomplete returned no related result');
  }

  final segments = await TDataService.getRealTimeTraffic(
    bounds: const LatLngBounds(
      southWest: LatLng(37.56, 126.97),
      northEast: LatLng(37.575, 126.99),
    ),
    zoomLevel: 14,
  );
  if (segments.isEmpty || segments.first.path.length < 2) {
    throw StateError('TData REST traffic returned no usable links');
  }

  final projected = await TDataService.transformJson(
    latitude: cityHall.latitude,
    longitude: cityHall.longitude,
    fromCoord: 'WGS84GEO',
    toCoord: 'EPSG3857',
  );
  if (projected == null ||
      projected.coordType != 'EPSG3857' ||
      projected.x < 10000000 ||
      projected.y < 1000000 ||
      projected.asLatLng != null) {
    throw StateError('TData REST coordinate conversion result is invalid');
  }
}
