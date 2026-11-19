import 'dart:math' as math;

import 'point.dart';

/// TMAP 지도 상의 위경도 좌표를 표현하는 클래스입니다.
class LatLng {
  /// 위도 (Latitude)
  final double latitude;

  /// 경도 (Longitude)
  final double longitude;

  const LatLng(this.latitude, this.longitude);

  /// Creates a distinct value with the same coordinates.
  LatLng clone() => LatLng(latitude, longitude);

  /// An immutable alternative to the JS SDK's mutating setLatitude.
  LatLng withLatitude(double value) => LatLng(value, longitude);

  /// An immutable alternative to the JS SDK's mutating setLongitude.
  LatLng withLongitude(double value) => LatLng(latitude, value);

  /// Great-circle distance in metres, matching Tmapv3.LatLng.distanceTo.
  ///
  /// The SDK calculates an angular distance via the spherical cosine law,
  /// then converts degrees to nautical miles, statute miles and metres.
  double distanceTo(LatLng other) {
    final a = latitude * math.pi / 180;
    final b = other.latitude * math.pi / 180;
    final diff = (longitude - other.longitude) * math.pi / 180;
    final cosine =
        math.sin(a) * math.sin(b) + math.cos(a) * math.cos(b) * math.cos(diff);
    return math.acos(cosine.clamp(-1.0, 1.0)) *
        180 /
        math.pi *
        60 *
        1.1515 *
        1.609344 *
        1000;
  }

  /// Spherical Web Mercator, returned as eastings/northings in metres.
  ///
  /// Matches the SDK's latitude clamp at +/-89.5 degrees.
  Point toEPSG3857() {
    const radius = 6378137.0;
    final radians = latitude.clamp(-89.5, 89.5) * math.pi / 180;
    return Point(
      radius * longitude * math.pi / 180,
      -radius * math.log(math.tan((math.pi / 2 - radians) / 2)),
    );
  }

  /// Korean central-belt Bessel TM (eastings/northings in metres).
  ///
  /// The SDK uses a WGS84-to-Bessel three-translation datum approximation,
  /// followed by the central-meridian Transverse Mercator expansion.
  Point toBesselTm() {
    const sourceMajor = 6378137.0;
    const sourceMinor = 6356752.3142;
    const targetMajor = 6377397.155;
    const targetMinor = 6356078.96325;
    const centralMeridian = 2.21661859489632; // 127 degrees
    const latitudeOrigin = 0.663225115757845; // 38 degrees
    const falseEasting = 200000.0;
    const falseNorthing = 500000.0;

    const sourceRatio = sourceMinor / sourceMajor;
    const sourceEccentricitySquared = 1 - sourceRatio * sourceRatio;
    final longitudeRad = longitude * math.pi / 180;
    final latitudeRad = latitude * math.pi / 180;
    final sine = math.sin(latitudeRad);
    final cosine = math.cos(latitudeRad);
    final sourceDenominator = 1 - sourceEccentricitySquared * sine * sine;
    final meridionalRadius = sourceMajor *
        (1 - sourceEccentricitySquared) /
        math.pow(sourceDenominator, 1.5);
    final primeVerticalRadius = sourceMajor / math.sqrt(sourceDenominator);
    const differenceMajor = targetMajor - sourceMajor;
    const differenceFlattening = sourceRatio - targetMinor / targetMajor;

    // The SDK's WGS84 -> Bessel translations, in metres.
    const shiftX = 128.0;
    const shiftY = -481.0;
    const shiftZ = -664.0;
    final deltaLatitude = (-shiftX * sine * math.cos(longitudeRad) -
            shiftY * sine * math.sin(longitudeRad) +
            shiftZ * cosine +
            differenceMajor *
                primeVerticalRadius *
                sourceEccentricitySquared *
                sine *
                cosine /
                sourceMajor +
            differenceFlattening *
                (meridionalRadius / sourceRatio +
                    primeVerticalRadius * sourceRatio) *
                sine *
                cosine) /
        meridionalRadius;
    final deltaLongitude =
        (-shiftX * math.sin(longitudeRad) + shiftY * math.cos(longitudeRad)) /
            (primeVerticalRadius * cosine);
    final projectedLatitude = latitudeRad + deltaLatitude;
    final projectedLongitude = longitudeRad + deltaLongitude;

    const ratio = targetMinor / targetMajor;
    const eccentricitySquared = 1 - ratio * ratio;
    const secondEccentricitySquared =
        eccentricitySquared / (1 - eccentricitySquared);
    const e0 = 1 -
        0.25 *
            eccentricitySquared *
            (1 + eccentricitySquared / 16 * (3 + 1.25 * eccentricitySquared));
    const e1 = 0.375 *
        eccentricitySquared *
        (1 + 0.25 * eccentricitySquared * (1 + 0.46875 * eccentricitySquared));
    const e2 = 0.05859375 *
        eccentricitySquared *
        eccentricitySquared *
        (1 + 0.75 * eccentricitySquared);
    const e3 = eccentricitySquared *
        eccentricitySquared *
        eccentricitySquared *
        (35 / 3072);
    double meridianArc(double value) =>
        targetMajor *
        (e0 * value -
            e1 * math.sin(2 * value) +
            e2 * math.sin(4 * value) -
            e3 * math.sin(6 * value));

    final longitudeOffset = projectedLongitude - centralMeridian;
    final cosLatitude = math.cos(projectedLatitude);
    final sinLatitude = math.sin(projectedLatitude);
    final scaledOffset = cosLatitude * longitudeOffset;
    final scaledOffsetSquared = scaledOffset * scaledOffset;
    final tangentSquared = math.pow(math.tan(projectedLatitude), 2);
    final etaSquared = secondEccentricitySquared * cosLatitude * cosLatitude;
    final radius = targetMajor /
        math.sqrt(1 - eccentricitySquared * sinLatitude * sinLatitude);
    final easting = falseEasting +
        radius *
            scaledOffset *
            (1 +
                scaledOffsetSquared /
                    6 *
                    (1 -
                        tangentSquared +
                        etaSquared +
                        scaledOffsetSquared /
                            20 *
                            (5 -
                                18 * tangentSquared +
                                tangentSquared * tangentSquared +
                                72 * etaSquared -
                                58 * secondEccentricitySquared)));
    final northing = falseNorthing +
        meridianArc(projectedLatitude) -
        meridianArc(latitudeOrigin) +
        radius *
            math.tan(projectedLatitude) *
            scaledOffsetSquared *
            (0.5 +
                scaledOffsetSquared /
                    24 *
                    (5 -
                        tangentSquared +
                        9 * etaSquared +
                        4 * etaSquared * etaSquared +
                        scaledOffsetSquared /
                            30 *
                            (61 -
                                58 * tangentSquared +
                                tangentSquared * tangentSquared +
                                600 * etaSquared -
                                330 * secondEccentricitySquared)));
    return Point(easting, northing);
  }

  factory LatLng.fromJson(Map<String, dynamic> json) {
    return LatLng(
      (json['latitude'] as num? ?? json['lat'] as num? ?? 0.0).toDouble(),
      (json['longitude'] as num? ??
              json['lng'] as num? ??
              json['lon'] as num? ??
              0.0)
          .toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LatLng &&
          runtimeType == other.runtimeType &&
          latitude == other.latitude &&
          longitude == other.longitude;

  @override
  int get hashCode => latitude.hashCode ^ longitude.hashCode;

  @override
  String toString() => '$latitude,$longitude';
}
