import 'lat_lng.dart';

/// TMAP 지오코딩 및 역지오코딩 결과 주소 모델입니다.
class AddressInfo {
  /// 전체 주소 명칭
  final String fullAddress;

  /// 시/도
  final String cityDo;

  /// 구/군
  final String guGun;

  /// 읍/면/동
  final String legalDong;

  /// 행정동
  final String? adminDong;

  /// 도로명
  final String? roadName;

  /// 건물 번호
  final String? buildingIndex;

  /// 건물명
  final String? buildingName;

  /// 지번 번지
  final String? bunji;

  /// 우편번호
  final String? zipCode;

  /// 좌표 (지오코딩 응답 시)
  final LatLng? point;

  const AddressInfo({
    required this.fullAddress,
    required this.cityDo,
    required this.guGun,
    required this.legalDong,
    this.adminDong,
    this.roadName,
    this.buildingIndex,
    this.buildingName,
    this.bunji,
    this.zipCode,
    this.point,
  });

  factory AddressInfo.fromJson(Map<String, dynamic> json) {
    final addrInfo = (json['addressInfo'] as Map<String, dynamic>?) ?? json;

    LatLng? coordinate(dynamic value) {
      if (value is! Map) return null;
      double? parse(dynamic number) {
        if (number is num) return number.toDouble();
        if (number is String) return double.tryParse(number.trim());
        return null;
      }

      final lat = parse(value['lat'] ?? value['latitude']);
      final lon = parse(value['lon'] ?? value['longitude']);
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

    String? nonempty(dynamic value) =>
        value is String && value.trim().isNotEmpty ? value : null;

    final point = coordinate(addrInfo) ??
        coordinate(addrInfo['roadCoord']) ??
        coordinate(addrInfo['legalDongCoord']) ??
        coordinate(addrInfo['adminDongCoord']);

    return AddressInfo(
      fullAddress: addrInfo['fullAddress'] as String? ?? '',
      cityDo: addrInfo['city_do'] as String? ?? '',
      guGun: addrInfo['gu_gun'] as String? ?? '',
      legalDong: addrInfo['legalDong'] as String? ??
          addrInfo['eup_myun'] as String? ??
          '',
      adminDong: addrInfo['adminDong'] as String?,
      roadName: addrInfo['roadName'] as String?,
      buildingIndex: addrInfo['buildingIndex'] as String?,
      buildingName: addrInfo['buildingName'] as String?,
      bunji: addrInfo['bunji'] as String?,
      zipCode: nonempty(addrInfo['zipCode']) ??
          nonempty(addrInfo['roadPostcode']) ??
          nonempty(addrInfo['postcode']) ??
          (addrInfo['zipCode'] is String ? addrInfo['zipCode'] as String : null),
      point: point,
    );
  }
}
