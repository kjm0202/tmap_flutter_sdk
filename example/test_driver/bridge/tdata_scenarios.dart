import 'dart:math' as math;
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

Future<void> testTDataScenarios(TMapController controller) async {
  const start = LatLng(37.5663, 126.9779);
  const station = LatLng(37.5547, 126.9707);

  final List<PoiItem> pois = await controller.searchPoi(
    keyword: '서울역',
    center: station,
    count: 8,
  );

  final PoiItem poi = pois.firstWhere(
    (p) =>
        p.name.contains('서울역') &&
        (p.point.latitude - station.latitude).abs() < 0.02 &&
        (p.point.longitude - station.longitude).abs() < 0.02,
    orElse: () => throw StateError(
      'No PoiItem matching 서울역 within 0.02 deg of station',
    ),
  );

  final RouteInfo? route = await controller.getRoutePlan(
    start: start,
    end: poi.point,
  );

  if (route == null) {
    throw StateError('getRoutePlan returned null');
  }
  if (route.totalDistance <= 0 || route.totalDistance >= 50000) {
    throw StateError('totalDistance out of plausible range');
  }
  if (route.totalTime <= 0 || route.totalTime >= 7200) {
    throw StateError('totalTime out of plausible range');
  }
  if (route.path.length < 2) {
    throw StateError('path has fewer than 2 points');
  }
  if ((route.path.first.latitude - start.latitude).abs() >= 0.05 ||
      (route.path.first.longitude - start.longitude).abs() >= 0.05) {
    throw StateError('path first point not near start');
  }
  if ((route.path.last.latitude - poi.point.latitude).abs() >= 0.05 ||
      (route.path.last.longitude - poi.point.longitude).abs() >= 0.05) {
    throw StateError('path last point not near end');
  }
  if (route.taxiFare <= 0) {
    throw StateError('taxiFare not positive for car route');
  }
  if (route.totalFare < 0) {
    throw StateError('totalFare negative for car route');
  }
  if (route.guidePoints.isEmpty) {
    throw StateError('guidePoints empty for car route');
  }

  final AddressInfo? addr = await controller.getAddressFromGeo(
    latLng: poi.point,
  );

  if (addr == null || !addr.fullAddress.contains('서울')) {
    throw StateError('getAddressFromGeo returned null or unexpected address');
  }
}

double _distanceMeters(LatLng a, LatLng b) {
  final dLat = (b.latitude - a.latitude) * 111320;
  final dLon = (b.longitude - a.longitude) *
      111320 *
      math.cos(a.latitude * math.pi / 180);
  return math.sqrt(dLat * dLat + dLon * dLon);
}

Future<void> testPlaceSearchScenario(TMapController controller) async {
  const cityHall = LatLng(37.5665, 126.9780);

  final List<AutoCompleteItem> suggestions =
      await controller.getAutoCompleteSearch(keyword: '서울역');
  suggestions.firstWhere(
    (s) => s.keyword.trim().isNotEmpty && s.keyword.contains('서울역'),
    orElse: () => throw StateError(
      'No relevant nonblank 서울역 autocomplete suggestion',
    ),
  );

  final List<PoiItem> pois = await controller.searchPoiAround(
    center: cityHall,
    category: '편의점',
    radius: 1,
    count: 10,
  );
  const convenienceStoreMarkers = [
    '편의점',
    'GS25',
    'CU',
    '세븐일레븐',
    '7-ELEVEN',
    '이마트24',
    'EMART24',
    '미니스톱',
  ];

  bool isConvenienceStore(PoiItem poi) {
    final labels = [
      poi.name,
      poi.upperBizName ?? '',
      poi.middleBizName ?? '',
      poi.lowerBizName ?? '',
    ];
    return labels.any(
      (label) => convenienceStoreMarkers.any(
        (marker) => label.toUpperCase().contains(marker),
      ),
    );
  }

  pois.firstWhere(
    (p) =>
        p.name.trim().isNotEmpty &&
        p.point.latitude != 0 &&
        p.point.longitude != 0 &&
        _distanceMeters(cityHall, p.point) <= 1100 &&
        isConvenienceStore(p),
    orElse: () => throw StateError(
      'No named convenience-store POI with nonzero coords within 1.1 km '
      'of City Hall',
    ),
  );
}

Future<void> testWalkingScenario(TMapController controller) async {
  const cityHall = LatLng(37.5665, 126.9780);
  const station = LatLng(37.5547, 126.9707);

  final LatLng? origin =
      await controller.getGeoFromAddress(address: '서울특별시 중구 세종대로 110');
  if (origin == null) {
    throw StateError('getGeoFromAddress returned null');
  }
  if (_distanceMeters(origin, cityHall) > 1000) {
    throw StateError('Geocoded origin is not near City Hall');
  }

  final RouteInfo? route = await controller.getRoutePlanPedestrian(
    start: origin,
    end: station,
    startName: '서울시청',
    endName: '서울역',
  );
  if (route == null) {
    throw StateError('getRoutePlanPedestrian returned null');
  }
  if (route.totalDistance <= 0 || route.totalDistance > 5000) {
    throw StateError('Pedestrian totalDistance out of plausible range');
  }
  if (route.totalTime <= 0 || route.totalTime > 3600) {
    throw StateError('Pedestrian totalTime out of plausible range');
  }
  if (route.path.length < 2) {
    throw StateError('Pedestrian path has fewer than 2 points');
  }
  if (_distanceMeters(route.path.first, origin) > 500) {
    throw StateError('Path first point not near origin');
  }
  if (_distanceMeters(route.path.last, station) > 500) {
    throw StateError('Path last point not near destination');
  }
}
