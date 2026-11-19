import 'dart:convert';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

class GestureTarget {
  final double x;
  final double y;
  final LatLng latLng;
  final double tolLat;
  final double tolLng;

  GestureTarget({
    required this.x,
    required this.y,
    required this.latLng,
    required this.tolLat,
    required this.tolLng,
  });

  void expectCoordinate(LatLng value, String label) {
    if (!latLng.latitude.isFinite ||
        !latLng.longitude.isFinite ||
        !value.latitude.isFinite ||
        !value.longitude.isFinite ||
        !tolLat.isFinite ||
        !tolLng.isFinite) {
      throw StateError('Non-finite values in coordinate comparison');
    }
    final latDiff = (latLng.latitude - value.latitude).abs();
    final lngDiff = (latLng.longitude - value.longitude).abs();

    if (latDiff > tolLat || lngDiff > tolLng) {
      throw StateError(
          'Failure in $label: Actual (${value.latitude}, ${value.longitude}) vs Expected (${latLng.latitude}, ${latLng.longitude}). '
          'Tolerance: Lat $tolLat, Lng $tolLng. Diff: Lat $latDiff, Lng $lngDiff');
    }
  }
}

Future<GestureTarget> gestureTarget(
    TMapController controller, double fx, double fy) async {
  final expression = '''
    (function() {
      const canvas = map.vsmMap().getCanvas();
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      
      const localX = Math.round(rect.width * $fx);
      const localY = Math.round(rect.height * $fy);
      const x = rect.left + localX;
      const y = rect.top + localY;
      
      const p = new Tmapv3.Point(localX, localY);
      const p2 = new Tmapv3.Point(localX + 2, localY + 2);
      const ll = map.screenToReal(p);
      const ll2 = map.screenToReal(p2);
      const center = map.screenToReal(new Tmapv3.Point(rect.width/2, rect.height/2));
      
      return {
        x: x,
        y: y,
        centerLat: center.lat(),
        centerLng: center.lng(),
        lat: ll.lat(),
        lng: ll.lng(),
        tolLat: Math.max(0.000001, Math.abs(ll2.lat() - ll.lat())),
        tolLng: Math.max(0.000001, Math.abs(ll2.lng() - ll.lng()))
      };
    })()
  ''';

  final result = await runJs(controller, expression);

  if (result == null) {
    throw StateError('Failed to get gesture target: map or canvas not found');
  }

  final Map<String, dynamic> data = (result is String)
      ? jsonDecode(result)
      : Map<String, dynamic>.from(result);

  final target = GestureTarget(
    x: (data['x'] as num).toDouble(),
    y: (data['y'] as num).toDouble(),
    latLng: LatLng(
        (data['lat'] as num).toDouble(), (data['lng'] as num).toDouble()),
    tolLat: (data['tolLat'] as num).toDouble(),
    tolLng: (data['tolLng'] as num).toDouble(),
  );

  // Assertion for off-center points
  if ((fx - 0.5).abs() > 0.01 || (fy - 0.5).abs() > 0.01) {
    final centerLat = (data['centerLat'] as num).toDouble();
    final centerLng = (data['centerLng'] as num).toDouble();

    // assert expected target differs from the independently projected canvas center by > tolerance
    if ((target.latLng.latitude - centerLat).abs() <= target.tolLat &&
        (target.latLng.longitude - centerLng).abs() <= target.tolLng) {
      throw StateError(
          'Gesture target too close to center: target (${target.latLng.latitude}, ${target.latLng.longitude}) vs center ($centerLat, $centerLng). Diff must be > tolerance.');
    }
  }

  return target;
}

Future<LatLng> currentGestureCenter(TMapController controller) async {
  // Use same forced conversion as per requirement
  final expression = '{lat:map.getCenter().lat(), lng:map.getCenter().lng()}';
  final result = await runJs(controller, expression);

  final Map<String, dynamic> data = (result is String)
      ? jsonDecode(result)
      : Map<String, dynamic>.from(result);

  return LatLng(
      (data['lat'] as num).toDouble(), (data['lng'] as num).toDouble());
}
