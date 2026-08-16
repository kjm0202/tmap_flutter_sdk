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

    final lat =
        (addrInfo['lat'] as num? ?? addrInfo['latitude'] as num?)?.toDouble();
    final lng =
        (addrInfo['lon'] as num? ?? addrInfo['longitude'] as num?)?.toDouble();
    final point = (lat != null && lng != null) ? LatLng(lat, lng) : null;

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
      zipCode: addrInfo['zipCode'] as String?,
      point: point,
    );
  }
}
