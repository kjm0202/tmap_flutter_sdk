import 'lat_lng.dart';

/// A point of interest (POI) returned by TMAP search.
class PoiItem {
  /// Identifier of the POI.
  final String id;

  /// Display name of the POI.
  final String name;

  /// Telephone number, if available.
  final String? telNo;

  /// WGS84 latitude and longitude of the POI.
  final LatLng point;

  /// Land-lot address of the POI.
  final String address;

  /// Road-name address of the POI.
  final String roadAddress;

  /// Top-level business category name, if available.
  final String? upperBizName;

  /// Mid-level business category name, if available.
  final String? middleBizName;

  /// Lower-level business category name, if available.
  final String? lowerBizName;

  /// Distance from the search center, read from `radius` (0 if absent).
  final double? distance;

  /// Creates a POI search result with its position and address fields.
  const PoiItem({
    required this.id,
    required this.name,
    this.telNo,
    required this.point,
    required this.address,
    required this.roadAddress,
    this.upperBizName,
    this.middleBizName,
    this.lowerBizName,
    this.distance,
  });

  /// Parses a POI object from the TMAP `/tmap/pois` search response.
  ///
  /// Uses the first valid WGS84 pair among `noorLat`/`noorLon`,
  /// `frontLat`/`frontLon`, and `lat`/`lon`; otherwise [point] is (0, 0).
  /// Road addresses prefer `newAddressList` when a complete value exists.
  factory PoiItem.fromJson(Map<String, dynamic> json) {
    double parseCoord(dynamic val) {
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val) ?? 0.0;
      return 0.0;
    }

    double? coordValue(dynamic val) {
      final result = val is num
          ? val.toDouble()
          : (val is String ? double.tryParse(val) : null);
      return result != null && result.isFinite ? result : null;
    }

    // Use only a complete, valid latitude/longitude pair from the same group.
    LatLng point = const LatLng(0, 0);
    for (final keys in const [
      ['noorLat', 'noorLon'],
      ['frontLat', 'frontLon'],
      ['lat', 'lon'],
    ]) {
      final lat = coordValue(json[keys[0]]);
      final lng = coordValue(json[keys[1]]);
      if (lat != null &&
          lng != null &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180) {
        point = LatLng(lat, lng);
        break;
      }
    }

    final upperAddrName = json['upperAddrName'] as String? ?? '';
    final middleAddrName = json['middleAddrName'] as String? ?? '';
    final lowerAddrName = json['lowerAddrName'] as String? ?? '';
    final detailAddrName = json['detailAddrName'] as String? ?? '';
    final firstNo = json['firstNo'] as String? ?? '';
    final secondNo = json['secondNo'] as String? ?? '';

    final addrStr = [
      upperAddrName,
      middleAddrName,
      lowerAddrName,
      detailAddrName,
      firstNo.isNotEmpty
          ? (secondNo.isNotEmpty ? '$firstNo-$secondNo' : firstNo)
          : '',
    ].where((e) => e.isNotEmpty).join(' ');

    String roadValue(dynamic value) => value is String ? value.trim() : '';

    final newAddressList = json['newAddressList'];
    final newAddress = newAddressList is Map
        ? newAddressList['newAddress']
        : null;
    final List<dynamic> candidates = newAddress is List
        ? newAddress
        : (newAddress is Map ? [newAddress] : const <dynamic>[]);
    Map<dynamic, dynamic>? nestedAddress;
    String fullAddressRoad = '';
    for (final candidate in candidates) {
      if (candidate is! Map) continue;
      final fullAddress = roadValue(candidate['fullAddressRoad']);
      if (fullAddress.isNotEmpty) {
        fullAddressRoad = fullAddress;
        break;
      }
      if (nestedAddress == null && roadValue(candidate['bldNo1']).isNotEmpty) {
        nestedAddress = candidate;
      }
    }

    String firstValue(List<dynamic> values) {
      for (final value in values) {
        final result = roadValue(value);
        if (result.isNotEmpty) return result;
      }
      return '';
    }

    final roadName = firstValue([json['roadName'], nestedAddress?['roadName']]);
    final topBuildingNo1 = firstValue([
      json['buildingNo1'],
      json['firstBuildNo'],
    ]);
    final buildingNo1 = topBuildingNo1.isNotEmpty
        ? topBuildingNo1
        : roadValue(nestedAddress?['bldNo1']);
    final buildingNo2 = topBuildingNo1.isNotEmpty
        ? firstValue([json['buildingNo2'], json['secondBuildNo']])
        : roadValue(nestedAddress?['bldNo2']);
    final buildingNo = buildingNo1.isEmpty
        ? ''
        : buildingNo2.isEmpty || int.tryParse(buildingNo2) == 0
        ? buildingNo1
        : '$buildingNo1-$buildingNo2';
    final roadAddrStr = fullAddressRoad.isNotEmpty
        ? fullAddressRoad
        : [
            upperAddrName,
            middleAddrName,
            roadName,
            buildingNo,
          ].where((e) => e.isNotEmpty).join(' ');

    return PoiItem(
      id: json['id'] as String? ?? json['pkey'] as String? ?? '',
      name: json['name'] as String? ?? '',
      telNo: json['telNo'] as String?,
      point: point,
      address: addrStr,
      roadAddress: roadAddrStr,
      upperBizName: json['upperBizName'] as String?,
      middleBizName: json['middleBizName'] as String?,
      lowerBizName: json['lowerBizName'] as String?,
      distance: parseCoord(json['radius']),
    );
  }
}
