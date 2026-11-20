import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:http/http.dart' as http;

import '../auth/auth_repository.dart';
import '../models/address_info.dart';
import '../models/auto_complete_item.dart';
import '../models/auto_complete_v2_item.dart';
import '../models/lat_lng.dart';
import '../models/lat_lng_bounds.dart';
import '../models/poi_detail_info.dart';
import '../models/poi_item.dart';
import '../models/projected_coordinate.dart';
import '../models/route_info.dart';
import '../models/traffic_segment.dart';
import 'tdata_protocol.dart';

/// An asynchronous client for TMAP TData REST services.
class TDataService {
  static final http.Client _httpClient = http.Client();

  /// Requests a driving route through the TMAP REST API.
  static Future<RouteInfo?> getRoutePlan({
    required LatLng start,
    required LatLng end,
    Map<String, dynamic>? options,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final uri = Uri.parse(
          'https://apis.openapi.sk.com/tmap/routes?version=1&format=json');

      final body = {
        'startX': start.longitude,
        'startY': start.latitude,
        'endX': end.longitude,
        'endY': end.latitude,
        'reqCoordType': 'WGS84GEO',
        'resCoordType': 'WGS84GEO',
        'searchOption': 0,
        if (options != null) ...options,
      };

      final json = await _post(uri, body, appKey);
      if (json != null) {
        return RouteInfo.fromJson(json,
            responseCoordType: _effectiveResCoordType(body));
      }
    } catch (e, st) {
      developer.log('getRoutePlan error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// Requests a pedestrian route through the TMAP REST API.
  static Future<RouteInfo?> getRoutePlanPedestrian({
    required LatLng start,
    required LatLng end,
    String startName = '출발지',
    String endName = '목적지',
    Map<String, dynamic>? options,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final uri = Uri.parse(
          'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json');

      final body = {
        'startX': start.longitude,
        'startY': start.latitude,
        'endX': end.longitude,
        'endY': end.latitude,
        'startName': startName,
        'endName': endName,
        'reqCoordType': 'WGS84GEO',
        'resCoordType': 'WGS84GEO',
        if (options != null) ...options,
      };

      final json = await _post(uri, body, appKey);
      if (json != null) {
        return RouteInfo.fromJson(json,
            responseCoordType: _effectiveResCoordType(body));
      }
    } catch (e, st) {
      developer.log('getRoutePlanPedestrian error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// Searches for POIs by keyword through the TMAP REST API.
  static Future<List<PoiItem>> searchPoi({
    required String searchKeyword,
    int count = 20,
    int page = 1,
    int? radius,
    LatLng? center,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'searchKeyword': searchKeyword,
        'count': count.toString(),
        'page': page.toString(),
        'reqCoordType': 'WGS84GEO',
        'resCoordType': 'WGS84GEO',
      };
      if (radius != null) {
        final km = radius > 33
            ? (radius / 1000).ceil().clamp(1, 33)
            : radius.clamp(1, 33);
        params['radius'] = km.toString();
      }
      if (center != null) {
        params['centerLat'] = center.latitude.toString();
        params['centerLon'] = center.longitude.toString();
      }

      final uri = Uri.https('apis.openapi.sk.com', '/tmap/pois', params);
      final json = await _get(uri, appKey);
      if (json != null) {
        final res = TDataResponse(requestId: '', success: true, data: json);
        return res.toPoiList();
      }
    } catch (e, st) {
      developer.log('searchPoi error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return [];
  }

  /// Searches for nearby POIs around [center] through the TMAP REST API.
  static Future<List<PoiItem>> searchPoiAround({
    required LatLng center,
    String? categories,
    int count = 20,
    int page = 1,
    int? radius,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'centerLat': center.latitude.toString(),
        'centerLon': center.longitude.toString(),
        'count': count.toString(),
        'page': page.toString(),
        'reqCoordType': 'WGS84GEO',
        'resCoordType': 'WGS84GEO',
      };
      if (categories != null && categories.isNotEmpty) {
        params['categories'] = categories;
      }
      if (radius != null) {
        final km = radius > 33
            ? (radius / 1000).ceil().clamp(1, 33)
            : radius.clamp(1, 33);
        params['radius'] = km.toString();
      }

      final uri =
          Uri.https('apis.openapi.sk.com', '/tmap/pois/search/around', params);
      final json = await _get(uri, appKey);
      if (json != null) {
        return TDataResponse(requestId: '', success: true, data: json)
            .toPoiList();
      }
    } catch (e, st) {
      developer.log('searchPoiAround error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return [];
  }

  /// Geocodes [address] to WGS84 coordinates through the TMAP REST API.
  static Future<LatLng?> getGeoFromAddress({
    required String address,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'fullAddr': address,
        'addressFlag': 'F00',
        'coordType': 'WGS84GEO',
      };
      final uri =
          Uri.https('apis.openapi.sk.com', '/tmap/geo/fullAddrGeo', params);
      final json = await _get(uri, appKey);
      if (json != null) return _geoFromResponse(json);
    } catch (e, st) {
      developer.log('getGeoFromAddress error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// Reverse-geocodes [point] to an address through the TMAP REST API.
  static Future<AddressInfo?> getAddressFromGeo({
    required LatLng point,
    String addressType = 'A04',
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'lat': point.latitude.toString(),
        'lon': point.longitude.toString(),
        'coordType': 'WGS84GEO',
        'addressType': addressType,
      };
      final uri = Uri.https(
          'apis.openapi.sk.com', '/tmap/geo/reversegeocoding', params);
      final json = await _get(uri, appKey);
      if (json != null) {
        if (json.containsKey('addressInfo')) {
          if (json['addressInfo'] is! Map<String, dynamic>) return null;
        } else {
          const addressFields = {
            'fullAddress',
            'city_do',
            'gu_gun',
            'legalDong',
            'eup_myun',
            'adminDong',
            'roadName',
            'buildingIndex',
            'buildingName',
            'bunji',
            'zipCode',
            'roadPostcode',
            'postcode',
            'lat',
            'lon',
            'latitude',
            'longitude',
            'roadCoord',
            'legalDongCoord',
            'adminDongCoord',
          };
          if (!json.keys.any(addressFields.contains)) return null;
        }
        return TDataResponse(requestId: '', success: true, data: json)
            .toAddressInfo();
      }
    } catch (e, st) {
      developer.log('getAddressFromGeo error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// Retrieves keyword autocomplete suggestions through the TMAP REST API.
  static Future<List<AutoCompleteItem>> getAutoCompleteSearch({
    required String keyword,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'searchKeyword': keyword.trim(),
      };
      final uri =
          Uri.https('apis.openapi.sk.com', '/tmap/poi/autoComplete', params);
      final json = await _get(uri, appKey);
      if (json != null) {
        return TDataResponse(requestId: '', success: true, data: json)
            .toAutoCompleteList();
      }
    } catch (e, st) {
      developer.log('getAutoCompleteSearch error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return [];
  }

  /// Requests location-aware keyword autocomplete suggestions.
  ///
  /// Implements the documented `Tmapv3.TData#getAutoCompleteSearchv3Json`
  /// through the SDK's V2 REST endpoint `/tmap/poi/V2autoComplete`. Sends
  /// [center] with the request, clamps [radius] to 1-33 kilometres, and
  /// limits [numResults] to 1-100.
  static Future<List<AutoCompleteV2Item>> getAutoCompleteSearchV2({
    required String keyword,
    required LatLng center,
    int? radius,
    int? numResults,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'searchKeyword': keyword.trim(),
        'centerLat': center.latitude.toString(),
        'centerLon': center.longitude.toString(),
        if (radius != null) 'radius': radius.clamp(1, 33).toString(),
        if (numResults != null)
          'numResults': numResults.clamp(1, 100).toString(),
      };
      final uri =
          Uri.https('apis.openapi.sk.com', '/tmap/poi/V2autoComplete', params);
      final json = await _get(uri, appKey);
      if (json != null) {
        return TDataResponse(requestId: '', success: true, data: json)
            .toAutoCompleteV2List();
      }
    } catch (e, st) {
      developer.log('getAutoCompleteSearchV2 error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return [];
  }

  /// Fetches real-time traffic links within [bounds].
  ///
  /// The response contains WGS84 GeoJSON line segments and congestion codes.
  static Future<List<TrafficSegment>> getRealTimeTraffic({
    required LatLngBounds bounds,
    required int zoomLevel,
    String? trafficType,
  }) async {
    try {
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'minLat': bounds.southWest.latitude.toString(),
        'minLon': bounds.southWest.longitude.toString(),
        'maxLat': bounds.northEast.latitude.toString(),
        'maxLon': bounds.northEast.longitude.toString(),
        'zoomLevel': zoomLevel.toString(),
        'reqCoordType': 'WGS84GEO',
        'resCoordType': 'WGS84GEO',
        if (trafficType != null) 'trafficType': trafficType,
      };
      final uri = Uri.https('apis.openapi.sk.com', '/tmap/traffic', params);
      final json = await _get(uri, AuthRepository.instance.appKey);
      if (json != null) return TrafficSegment.fromFeatureCollection(json);
    } catch (e, st) {
      developer.log('getRealTimeTraffic error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return [];
  }

  /// Retrieves a single POI's details using its ID from [searchPoi].
  static Future<PoiDetailInfo?> getPoiById({required String poiId}) async {
    if (poiId.trim().isEmpty) return null;
    try {
      final uri = Uri(
        scheme: 'https',
        host: 'apis.openapi.sk.com',
        pathSegments: ['tmap', 'pois', poiId],
        queryParameters: const {
          'version': '1',
          'format': 'json',
          'resCoordType': 'WGS84GEO',
        },
      );
      final json = await _get(uri, AuthRepository.instance.appKey);
      if (json != null && json['poiDetailInfo'] is Map<String, dynamic>) {
        return PoiDetailInfo.fromJson(json);
      }
    } catch (e, st) {
      developer.log('getPoiById error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// Geocodes address components using the legacy `/tmap/geo/geocoding` API.
  ///
  /// [getGeoFromAddress] handles a free-text address instead.
  static Future<LatLng?> getGeoFromAddressLegacy({
    required String cityDo,
    required String guGun,
    required String dong,
    required String bunji,
    String? detailAddress,
    String? addressFlag,
  }) async {
    try {
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'city_do': cityDo,
        'gu_gun': guGun,
        'dong': dong,
        'bunji': bunji,
        'coordType': 'WGS84GEO',
        if (detailAddress != null) 'detailAddress': detailAddress,
        if (addressFlag != null) 'addressFlag': addressFlag,
      };
      final uri =
          Uri.https('apis.openapi.sk.com', '/tmap/geo/geocoding', params);
      final json = await _get(uri, AuthRepository.instance.appKey);
      if (json != null) return _geoFromResponse(json);
    } catch (e, st) {
      developer.log('getGeoFromAddressLegacy error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// Converts a coordinate between TMAP coordinate systems.
  ///
  /// The API names the inputs `lat` and `lon` even when they are projected
  /// northing/easting values. The returned [ProjectedCoordinate] preserves the
  /// target unit and projection rather than assuming all values are degrees.
  static Future<ProjectedCoordinate?> transformJson({
    required double latitude,
    required double longitude,
    required String fromCoord,
    required String toCoord,
  }) async {
    if (!latitude.isFinite ||
        !longitude.isFinite ||
        fromCoord.isEmpty ||
        toCoord.isEmpty) {
      return null;
    }
    try {
      final params = {
        'version': '1',
        'format': 'json',
        'lat': latitude.toString(),
        'lon': longitude.toString(),
        'fromCoord': fromCoord,
        'toCoord': toCoord,
      };
      final uri =
          Uri.https('apis.openapi.sk.com', '/tmap/geo/coordconvert', params);
      final json = await _get(uri, AuthRepository.instance.appKey);
      if (json != null) {
        return ProjectedCoordinate.fromJson(json, coordType: toCoord);
      }
    } catch (e, st) {
      developer.log('transformJson error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// Returns the effective `resCoordType` after applying caller options.
  static String? _effectiveResCoordType(Map<String, dynamic> body) {
    final value = body['resCoordType'];
    return value is String ? value : null;
  }

  static LatLng? _geoFromResponse(Map<String, dynamic> json) {
    final coordInfo = json['coordinateInfo'];
    if (coordInfo is! Map) return null;
    final coordType = coordInfo['coordType'];
    if (coordType is String &&
        coordType.isNotEmpty &&
        coordType != 'WGS84GEO') {
      return null;
    }
    final coordinates = coordInfo['coordinate'];
    final List<dynamic> coordList;
    if (coordinates is List) {
      coordList = coordinates;
    } else if (coordinates is Map) {
      coordList = [coordinates];
    } else {
      coordList = [coordInfo];
    }
    for (final item in coordList) {
      if (item is! Map) continue;
      final point = _parseWgs84Coordinate(item['lat'], item['lon']) ??
          _parseWgs84Coordinate(item['newLat'], item['newLon']);
      if (point != null) return point;
    }
    return null;
  }

  /// Parses one WGS84 coordinate pair without mixing values from two sources.
  static LatLng? _parseWgs84Coordinate(dynamic latitude, dynamic longitude) {
    double? parse(dynamic value) {
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value.trim());
      return null;
    }

    final lat = parse(latitude);
    final lon = parse(longitude);
    if (lat == null ||
        lon == null ||
        !lat.isFinite ||
        !lon.isFinite ||
        lat.abs() > 90 ||
        lon.abs() > 180) {
      return null;
    }
    return LatLng(lat, lon);
  }

  // ========================================
  // HTTP request helpers
  // ========================================

  static Map<String, dynamic>? _decodeBody(String body) {
    final json = jsonDecode(body) as Map<String, dynamic>;
    return json['error'] == null ? json : null;
  }

  static Future<Map<String, dynamic>?> _get(Uri uri, String appKey) async {
    try {
      final response = await _httpClient.get(
        uri,
        headers: {
          'appKey': appKey,
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return _decodeBody(utf8.decode(response.bodyBytes));
      } else {
        developer.log('GET ${uri.path} failed: ${response.statusCode}',
            name: 'TDataService');
        return null;
      }
    } catch (e, st) {
      developer.log('GET ${uri.path} exception',
          name: 'TDataService', error: e, stackTrace: st);
      return null;
    }
  }

  static Future<Map<String, dynamic>?> _post(
      Uri uri, Map<String, dynamic> bodyJson, String appKey) async {
    try {
      final response = await _httpClient
          .post(
            uri,
            headers: {
              'appKey': appKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode(bodyJson),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return _decodeBody(utf8.decode(response.bodyBytes));
      } else {
        developer.log('POST ${uri.path} failed: ${response.statusCode}',
            name: 'TDataService');
        return null;
      }
    } catch (e, st) {
      developer.log('POST ${uri.path} exception',
          name: 'TDataService', error: e, stackTrace: st);
      return null;
    }
  }
}
