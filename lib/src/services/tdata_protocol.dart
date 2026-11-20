import '../models/address_info.dart';
import '../models/auto_complete_item.dart';
import '../models/auto_complete_v2_item.dart';
import '../models/poi_item.dart';
import '../models/route_info.dart';

/// A type of TData service request.
enum TDataRequestType {
  /// Driving route request.
  routePlan,

  /// Pedestrian route request.
  routePlanPedestrian,

  /// POI keyword search request.
  poiSearch,

  /// POI search around a geographic center.
  poiSearchAround,

  /// Forward geocoding request from an address.
  geoFromAddress,

  /// Reverse geocoding request from geographic coordinates.
  addressFromGeo,

  /// Keyword autocomplete request.
  autoComplete,
}

/// A TData response with its status and payload.
class TDataResponse {
  /// Identifier associated with the request, or an empty string if absent.
  final String requestId;

  /// Raw success flag from the response.
  ///
  /// Parsers also reject the response when [error] is non-empty or
  /// `data.error` is present.
  final bool success;

  /// Error description, if supplied.
  final String? error;

  /// Raw response payload, whose shape depends on the request type.
  final dynamic data;

  /// Creates a response with its request identifier and raw payload.
  const TDataResponse({
    required this.requestId,
    required this.success,
    this.error,
    this.data,
  });

  /// Parses a TData response envelope with `requestId`, `success`, and data.
  ///
  /// Missing identifiers and success flags default to `''` and false.
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

  /// Returns a route parsed from a successful GeoJSON feature collection.
  ///
  /// Returns null if the response failed or [data] is not an object.
  RouteInfo? toRouteInfo() {
    if (_failed) return null;
    if (data is Map<String, dynamic>) {
      return RouteInfo.fromJson(data as Map<String, dynamic>);
    }
    return null;
  }

  /// Returns POIs from `searchPoiInfo.pois.poi` in a successful response.
  ///
  /// Returns an empty list on failure or when the POI array is absent.
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

  /// Returns an address parsed from a successful geocoding payload.
  ///
  /// Returns null on failure or when [data] is not a map.
  AddressInfo? toAddressInfo() {
    if (_failed) return null;
    if (data is Map<String, dynamic>) {
      return AddressInfo.fromJson(data as Map<String, dynamic>);
    }
    return null;
  }

  /// Returns keyword suggestions from a successful autocomplete response.
  ///
  /// Accepts an `autoComplete` array, `response.suggestions`, or a raw list;
  /// returns an empty list for failed or unsupported response shapes.
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

  /// Returns V2 suggestions from a successful autocomplete response.
  ///
  /// Reads `suggestions` or `response.suggestions`; skips non-map entries and
  /// returns an empty list when no supported array is present.
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
