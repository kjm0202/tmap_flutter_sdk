import 'lat_lng.dart';

/// Location-aware suggestion returned by `/tmap/poi/V2autoComplete`.
class AutoCompleteV2Item {
  /// POI ID assigned by TMAP.
  final String id;

  /// Suggested keyword.
  final String keyword;

  /// Category name.
  final String categoryName;

  /// Category nickname such as a subway line or station type.
  final String categoryNickName;

  /// Road-name address.
  final String fullAddress;

  /// Jibun address.
  final String jibunAddress;

  /// WGS84 coordinates of the POI.
  final LatLng? point;

  /// WGS84 coordinates used for navigation guidance.
  final LatLng? navPoint;

  /// Distance from the requested center in kilometres.
  final double? distance;

  /// Whether the POI has sub-POIs.
  final bool? hasSubPoi;

  const AutoCompleteV2Item({
    required this.id,
    required this.keyword,
    this.categoryName = '',
    this.categoryNickName = '',
    this.fullAddress = '',
    this.jibunAddress = '',
    this.point,
    this.navPoint,
    this.distance,
    this.hasSubPoi,
  });

  factory AutoCompleteV2Item.fromJson(Map<String, dynamic> json) {
    double? number(dynamic value) {
      final result = value is num
          ? value.toDouble()
          : (value is String ? double.tryParse(value.trim()) : null);
      return result != null && result.isFinite ? result : null;
    }

    LatLng? parsePoint(dynamic value) {
      if (value is! Map) return null;
      final lat = number(value['lat']);
      final lon = number(value['lon']);
      if (lat == null || lon == null || lat.abs() > 90 || lon.abs() > 180) {
        return null;
      }
      return LatLng(lat, lon);
    }

    final subPoi = json['has_subpoi_yn'];

    return AutoCompleteV2Item(
      id: json['poi_id']?.toString() ?? '',
      keyword: json['keyword'] as String? ?? '',
      categoryName: json['cate_name'] as String? ?? '',
      categoryNickName: json['cate_nick_name'] as String? ?? '',
      fullAddress: json['full_address'] as String? ?? '',
      jibunAddress: json['full_address_jibun'] as String? ?? '',
      point: parsePoint(json['coordinates']),
      navPoint: parsePoint(json['nav_coordinates']),
      distance: number(json['distance']),
      hasSubPoi: subPoi is String ? subPoi == 'Y' : null,
    );
  }
}
