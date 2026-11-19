import '../models/address_info.dart';
import '../models/auto_complete_item.dart';
import '../models/auto_complete_v2_item.dart';
import '../models/poi_item.dart';
import '../models/route_info.dart';

/// TData 서비스 요청 타입
enum TDataRequestType {
  routePlan,
  routePlanPedestrian,
  poiSearch,
  poiSearchAround,
  geoFromAddress,
  addressFromGeo,
  autoComplete,
}

/// TData 서비스 응답 래퍼
class TDataResponse {
  final String requestId;
  final bool success;
  final String? error;
  final dynamic data;

  const TDataResponse({
    required this.requestId,
    required this.success,
    this.error,
    this.data,
  });

  factory TDataResponse.fromJson(Map<String, dynamic> json) {
    return TDataResponse(
      requestId: json['requestId'] as String? ?? '',
      success: json['success'] as bool? ?? false,
      error: json['error'] as String?,
      data: json['data'],
    );
  }

  bool get _failed =>
      !success ||
      (error != null && error!.isNotEmpty) ||
      (data is Map && (data as Map)['error'] != null);

  RouteInfo? toRouteInfo() {
    if (_failed) return null;
    if (data is Map<String, dynamic>) {
      return RouteInfo.fromJson(data as Map<String, dynamic>);
    }
    return null;
  }

  List<PoiItem> toPoiList() {
    if (_failed) return [];
    final list = <PoiItem>[];
    if (data is Map<String, dynamic>) {
      final searchPoiInfo = (data as Map<String, dynamic>)['searchPoiInfo'];
      if (searchPoiInfo is Map<String, dynamic>) {
        final pois = searchPoiInfo['pois'];
        if (pois is Map<String, dynamic>) {
          final poiList = pois['poi'];
          if (poiList is List) {
            for (final item in poiList) {
              if (item is Map<String, dynamic>) {
                list.add(PoiItem.fromJson(item));
              }
            }
          }
        }
      }
    }
    return list;
  }

  AddressInfo? toAddressInfo() {
    if (_failed) return null;
    if (data is Map<String, dynamic>) {
      return AddressInfo.fromJson(data as Map<String, dynamic>);
    }
    return null;
  }

  List<AutoCompleteItem> toAutoCompleteList() {
    if (_failed) return [];
    final list = <AutoCompleteItem>[];
    if (data is Map<String, dynamic>) {
      final mapData = data as Map<String, dynamic>;
      dynamic ac = mapData['autoComplete'];
      // /tmap/poi/autoComplete wraps successful suggestions in `response`.
      final response = mapData['response'];
      if (ac == null && response is Map<String, dynamic>) {
        ac = response['suggestions'];
      }
      if (ac is List) {
        for (final item in ac) {
          list.add(AutoCompleteItem.fromJson(item));
        }
      }
    } else if (data is List) {
      for (final item in data as List<dynamic>) {
        list.add(AutoCompleteItem.fromJson(item));
      }
    }
    return list;
  }

  List<AutoCompleteV2Item> toAutoCompleteV2List() {
    if (_failed) return [];
    final list = <AutoCompleteV2Item>[];
    if (data is Map<String, dynamic>) {
      final mapData = data as Map<String, dynamic>;
      final response = mapData['response'];
      dynamic suggestions = mapData['suggestions'];
      if (response is Map<String, dynamic>) {
        suggestions ??= response['suggestions'];
      }
      if (suggestions is List) {
        for (final item in suggestions) {
          if (item is Map<String, dynamic>) {
            list.add(AutoCompleteV2Item.fromJson(item));
          }
        }
      }
    }
    return list;
  }
}
