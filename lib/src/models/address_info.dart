import 'lat_lng.dart';

/// An address returned by TMAP geocoding or reverse geocoding.
class AddressInfo {
  /// Full address.
  final String fullAddress;

  /// Province or metropolitan city.
  final String cityDo;

  /// District or county.
  final String guGun;

  /// Legal town, township, or neighborhood name.
  final String legalDong;

  /// Administrative neighborhood name, if available.
  final String? adminDong;

  /// Road name, if available.
  final String? roadName;

  /// Building number, if available.
  final String? buildingIndex;

  /// Building name, if available.
  final String? buildingName;

  /// Land-lot number, if available.
  final String? bunji;

  /// Postal code, if available.
  final String? zipCode;

  /// WGS84 coordinates when a valid pair is present in the response.
  final LatLng? point;

  /// Creates an address with optional components and WGS84 [point].
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

  /// Parses a reverse-geocoding `addressInfo` envelope or a map of address
  /// fields.
  ///
  /// A forward-geocoding `coordinateInfo` envelope is not unwrapped.
  /// Missing required strings become empty; [point] is null if no valid
  /// coordinate pair exists.
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
