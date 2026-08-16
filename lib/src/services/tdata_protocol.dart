import '../models/address_info.dart';
import '../models/auto_complete_item.dart';
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

  RouteInfo? toRouteInfo() {
    if (data is Map<String, dynamic>) {
      return RouteInfo.fromJson(data as Map<String, dynamic>);
    }
    return null;
  }

  List<PoiItem> toPoiList() {
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
    if (data is Map<String, dynamic>) {
      return AddressInfo.fromJson(data as Map<String, dynamic>);
    }
    return null;
  }

  List<AutoCompleteItem> toAutoCompleteList() {
    final list = <AutoCompleteItem>[];
    if (data is Map<String, dynamic>) {
      final ac = (data as Map<String, dynamic>)['autoComplete'];
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
}
