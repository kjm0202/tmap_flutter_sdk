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

    final lat = parseCoord(json['noorLat'] ?? json['frontLat'] ?? json['lat']);
    final lng = parseCoord(json['noorLon'] ?? json['frontLon'] ?? json['lon']);

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

    final roadName = json['roadName'] as String? ?? '';
    final buildingNo1 = json['buildingNo1'] as String? ?? '';
    final buildingNo2 = json['buildingNo2'] as String? ?? '';
    final roadAddrStr = [
      upperAddrName,
      middleAddrName,
      roadName,
      buildingNo1.isNotEmpty
          ? (buildingNo2.isNotEmpty ? '$buildingNo1-$buildingNo2' : buildingNo1)
          : '',
    ].where((e) => e.isNotEmpty).join(' ');

    return PoiItem(
      id: json['id'] as String? ?? json['pkey'] as String? ?? '',
      name: json['name'] as String? ?? '',
      telNo: json['telNo'] as String?,
      point: LatLng(lat, lng),
      address: addrStr,
      roadAddress: roadAddrStr,
      upperBizName: json['upperBizName'] as String?,
      middleBizName: json['middleBizName'] as String?,
      lowerBizName: json['lowerBizName'] as String?,
      distance: parseCoord(json['radius']),
    );
  }
}
