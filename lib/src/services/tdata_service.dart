import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../auth/auth_repository.dart';
import '../models/address_info.dart';
import '../models/auto_complete_item.dart';
import '../models/lat_lng.dart';
import '../models/poi_item.dart';
import '../models/route_info.dart';
import 'tdata_protocol.dart';

/// TData 서비스 요청 및 비동기 응답 처리기
class TDataService {
  static final http.Client _httpClient = http.Client();

  /// 자동차 경로 탐색 (REST API)
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
        return RouteInfo.fromJson(json);
      }
    } catch (e, st) {
      developer.log('getRoutePlan error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// 보행자 경로 탐색 (REST API)
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
        return RouteInfo.fromJson(json);
      }
    } catch (e, st) {
      developer.log('getRoutePlanPedestrian error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// POI 키워드 검색 (REST API)
  static Future<List<PoiItem>> searchPoi({
    required String searchKeyword,
    int count = 20,
    int page = 1,
    int? radius,
    LatLng? center,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      debugPrint(
          '[TDataService] searchPoi start: keyword=$searchKeyword, appKey=$appKey, center=$center, radius=$radius');
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
      debugPrint('[TDataService] Request URI: $uri');
      final json = await _get(uri, appKey);
      if (json != null) {
        final res = TDataResponse(requestId: '', success: true, data: json);
        final list = res.toPoiList();
        debugPrint('[TDataService] Parsed POI count: ${list.length}');
        return list;
      } else {
        debugPrint('[TDataService] searchPoi returned null json');
      }
    } catch (e, st) {
      debugPrint('[TDataService] searchPoi exception: $e\n$st');
      developer.log('searchPoi error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return [];
  }

  /// POI 주변 검색 (REST API)
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

  /// 주소로 좌표 검색 (지오코딩)
  static Future<LatLng?> getGeoFromAddress({
    required String address,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'fullAddr': address,
        'coordType': 'WGS84GEO',
      };
      final uri =
          Uri.https('apis.openapi.sk.com', '/tmap/geo/fullAddrGeo', params);
      final json = await _get(uri, appKey);
      if (json != null) {
        final coordInfo = json['coordinateInfo'] as Map<String, dynamic>?;
        final lat =
            coordInfo?['lat'] as String? ?? coordInfo?['newLat'] as String?;
        final lon =
            coordInfo?['lon'] as String? ?? coordInfo?['newLon'] as String?;
        if (lat != null && lon != null) {
          final pLat = double.tryParse(lat);
          final pLon = double.tryParse(lon);
          if (pLat != null && pLon != null) {
            return LatLng(pLat, pLon);
          }
        }
      }
    } catch (e, st) {
      developer.log('getGeoFromAddress error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// 좌표로 주소 검색 (역지오코딩)
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
        return TDataResponse(requestId: '', success: true, data: json)
            .toAddressInfo();
      }
    } catch (e, st) {
      developer.log('getAddressFromGeo error: $e',
          name: 'TDataService', error: e, stackTrace: st);
    }
    return null;
  }

  /// 키워드 자동완성 검색
  static Future<List<AutoCompleteItem>> getAutoCompleteSearch({
    required String keyword,
  }) async {
    try {
      final appKey = AuthRepository.instance.appKey;
      final params = <String, String>{
        'version': '1',
        'format': 'json',
        'keyword': keyword,
      };
      final uri = Uri.https(
          'apis.openapi.sk.com', '/tmap/pois/search/autocomplete', params);
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

  // ========================================
  // HTTP 내부 통신 헬퍼
  // ========================================

  static Future<Map<String, dynamic>?> _get(Uri uri, String appKey) async {
    try {
      final response = await _httpClient.get(
        uri,
        headers: {
          'appKey': appKey,
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 10));

      final body = utf8.decode(response.bodyBytes);
      debugPrint(
          '[TDataService] GET status: ${response.statusCode}, response snippet: ${body.length > 200 ? body.substring(0, 200) : body}');

      if (response.statusCode == 200) {
        return jsonDecode(body) as Map<String, dynamic>;
      } else {
        debugPrint(
            '[TDataService] GET $uri failed: ${response.statusCode} - $body');
        developer.log('GET $uri failed: ${response.statusCode} - $body',
            name: 'TDataService');
        return null;
      }
    } catch (e, st) {
      debugPrint('[TDataService] _get exception: $e\n$st');
      return null;
    }
  }

  static Future<Map<String, dynamic>?> _post(
      Uri uri, Map<String, dynamic> bodyJson, String appKey) async {
    try {
      final response = await _httpClient.post(
        uri,
        headers: {
          'appKey': appKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(bodyJson),
      ).timeout(const Duration(seconds: 10));

      final body = utf8.decode(response.bodyBytes);

      if (response.statusCode == 200) {
        return jsonDecode(body) as Map<String, dynamic>;
      } else {
        developer.log('POST $uri failed: ${response.statusCode} - $body',
            name: 'TDataService');
        return null;
      }
    } catch (e, st) {
      developer.log('POST $uri exception: $e',
          name: 'TDataService', error: e, stackTrace: st);
      return null;
    }
  }
}
