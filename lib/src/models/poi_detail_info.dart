import 'lat_lng.dart';

/// Detailed metadata returned by `/tmap/pois/{poiInfo}`.
class PoiDetailInfo {
  /// Identifier of the POI in the detail response.
  final String id;

  /// Display name of the POI.
  final String name;

  /// Address returned by the `address` property.
  final String address;

  /// Road address assembled from building address and number fields.
  final String roadAddress;

  /// Contact telephone number, if provided.
  final String? telNo;

  /// Business category name, if provided.
  final String? categoryName;

  /// Homepage URL, if provided.
  final String? homepageUrl;

  /// WGS84 POI position, or null when coordinate pairs are invalid or absent.
  final LatLng? point;

  /// Creates POI details with required identity, addresses, and optional data.
  const PoiDetailInfo({
    required this.id,
    required this.name,
    required this.address,
    required this.roadAddress,
    required this.point,
    this.telNo,
    this.categoryName,
    this.homepageUrl,
  });

  /// Accepts the endpoint's `poiDetailInfo` envelope or the inner POI object.
  factory PoiDetailInfo.fromJson(Map<String, dynamic> json) {
    final inner = json['poiDetailInfo'];
    final data = inner is Map<String, dynamic> ? inner : json;
    double? number(dynamic value) {
      final result = value is num
          ? value.toDouble()
          : (value is String ? double.tryParse(value.trim()) : null);
      return result != null && result.isFinite ? result : null;
    }

    LatLng? point;
    for (final keys in const [
      ['lat', 'lon'],
      ['frontLat', 'frontLon'],
    ]) {
      final lat = number(data[keys[0]]);
      final lon = number(data[keys[1]]);
      if (lat != null && lon != null && lat.abs() <= 90 && lon.abs() <= 180) {
        point = LatLng(lat, lon);
        break;
      }
    }
    final street = (data['bldAddr'] as String? ?? '').trim();
    final first = (data['bldNo1'] as String? ?? '').trim();
    final second = (data['bldNo2'] as String? ?? '').trim();
    final buildingNo = first.isEmpty
        ? ''
        : second.isEmpty || second == '0'
            ? first
            : '$first-$second';
    return PoiDetailInfo(
      id: data['id']?.toString() ?? '',
      name: data['name'] as String? ?? '',
      address: data['address'] as String? ?? '',
      roadAddress:
          [street, buildingNo].where((part) => part.isNotEmpty).join(' '),
      point: point,
      telNo: data['tel'] as String?,
      categoryName: data['bizCatName'] as String?,
      homepageUrl: data['homepageURL'] as String?,
    );
  }
}
