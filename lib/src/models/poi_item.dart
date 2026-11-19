import 'lat_lng.dart';

/// TMAP POI 검색 결과 항목 모델입니다.
class PoiItem {
  /// POI ID
  final String id;

  /// 명칭 (이름)
  final String name;

  /// 전화번호
  final String? telNo;

  /// 위경도 좌표
  final LatLng point;

  /// 지번 주소
  final String address;

  /// 도로명 주소
  final String roadAddress;

  /// 대분류/중분류/소분류 업종명
  final String? upperBizName;
  final String? middleBizName;
  final String? lowerBizName;

  /// 중심점으로부터의 거리 (반경 검색 시)
  final double? distance;

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

    // 위도/경도는 같은 그룹에서 완전하고 유효한 쌍으로만 선택합니다.
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
