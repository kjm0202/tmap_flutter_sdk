import 'dart:convert';
import 'dart:io';

import '../../../../lib/src/models/point.dart';
import '../../../../lib/src/models/size.dart';
import '../../../../lib/src/models/lat_lng.dart';
import '../../../../lib/src/models/lat_lng_bounds.dart';

Object? encode(dynamic v) => v is double && !v.isFinite
    ? {'special': v.toString()}
    : v is double && v == 0 && v.isNegative
    ? {'special': '-0'}
    : v;

List<double> read(dynamic o) {
  if (o is Point) return [o.x, o.y];
  if (o is Size) return [o.width, o.height];
  if (o is LatLng) return [o.latitude, o.longitude];
  if (o is LatLngBounds) {
    return [
      o.southWest.latitude,
      o.southWest.longitude,
      o.northEast.latitude,
      o.northEast.longitude,
    ];
  }
  throw StateError('Unsupported object: $o');
}

void main(List<String> args) {
  final cases = jsonDecode(File(args.first).readAsStringSync()) as List;
  final result = <Map<String, dynamic>>[];
  for (final c in cases) {
    try {
      final a = (c['args'] as List).map((v) => (v as num).toDouble()).toList();
      final dynamic obj = switch (c['class']) {
        'Point' => Point(a[0], a[1]),
        'Size' => Size(a[0], a[1]),
        'LatLng' => LatLng(a[0], a[1]),
        'LatLngBounds' => LatLngBounds(
            southWest: LatLng(a[0], a[1]),
            northEast: LatLng(a[2], a[3]),
          ),
        'Bounds' => throw StateError('Class Bounds not found in current source'),
        _ => throw StateError('Unknown fixture class: ${c['class']}'),
      };
      final before = read(obj);
      final String dartMethod = c['dart'] as String? ?? '';
      final a2 = ((c['methodArgs'] ?? <dynamic>[]) as List)
          .map((v) => (v as num).toDouble())
          .toList();
      dynamic value;
      switch (dartMethod) {
        case 'x':
        case 'getX':
          value = (obj is Point)
              ? obj.x
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#x),
                );
        case 'y':
        case 'getY':
          value = (obj is Point)
              ? obj.y
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#y),
                );
        case 'width':
        case 'getWidth':
          value = (obj is Size)
              ? obj.width
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#width),
                );
        case 'height':
        case 'getHeight':
          value = (obj is Size)
              ? obj.height
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#height),
                );
        case 'latitude':
        case 'lat':
          value = (obj is LatLng)
              ? obj.latitude
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#latitude),
                );
        case 'longitude':
        case 'lng':
          value = (obj is LatLng)
              ? obj.longitude
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#longitude),
                );
        case 'southWest':
        case 'getSouthWest':
          value = (obj is LatLngBounds)
              ? obj.southWest
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#southWest),
                );
        case 'northEast':
        case 'getNorthEast':
          value = (obj is LatLngBounds)
              ? obj.northEast
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#northEast),
                );
        case 'center':
        case 'getCenter':
          value = (obj is LatLngBounds)
              ? obj.center
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.getter(#center),
                );
        case 'contains':
          value = (obj is LatLngBounds)
              ? obj.contains(LatLng(a2[0], a2[1]))
              : throw NoSuchMethodError.withInvocation(
                  obj,
                  Invocation.method(#contains, [LatLng(a2[0], a2[1])]),
                );
        case 'toString':
          value = obj.toString();
        case 'toJson':
          value = obj.toJson();
        default:
          throw StateError('Unimplemented fixture method: $dartMethod');
      }

      final object = value is Point ||
          value is Size ||
          value is LatLng ||
          value is LatLngBounds;
      result.add({
        'id': c['id'],
        'status': 'observed',
        'value': object ? read(value).map(encode).toList() : encode(value),
        'before': before.map(encode).toList(),
        'after': read(obj).map(encode).toList(),
        'sameIdentity': identical(value, obj),
        'returnedObject': object,
      });
    } catch (e) {
      result.add({
        'id': c['id'],
        'status': 'threw',
        'errorType': e.runtimeType.toString(),
        'error': e.toString(),
      });
    }
  }
  stdout.write(jsonEncode(result));
}
