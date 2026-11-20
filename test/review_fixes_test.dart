import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  test('empty geographic bounds preserve their state through JSON', () {
    const empty = LatLngBounds.empty();
    const origin = LatLngBounds(
      southWest: LatLng(0, 0),
      northEast: LatLng(0, 0),
    );

    expect(empty.toJson(), {'empty': true});
    expect(LatLngBounds.fromJson(empty.toJson()).isEmpty, isTrue);
    expect(origin.isEmpty, isFalse);
    expect(origin.toJson(), {
      'southWest': {'latitude': 0.0, 'longitude': 0.0},
      'northEast': {'latitude': 0.0, 'longitude': 0.0},
    });
    expect(LatLngBounds.fromJson(origin.toJson()).isEmpty, isFalse);
    expect(LatLngBounds.fromJson(origin.toJson()), origin);
    expect(LatLngBounds.fromJson({'empty': false, ...origin.toJson()}), origin);
  });

  test('throwing marker listener is reported and later listeners still run',
      () {
    final errors = <FlutterErrorDetails>[];
    final originalOnError = FlutterError.onError;
    FlutterError.onError = errors.add;
    addTearDown(() => FlutterError.onError = originalOnError);

    final controller = TMapController.fromWeb('test');
    final calls = <String>[];
    controller.onMarkerEvent('m', MarkerInteractionType.drag, (_) {
      calls.add('first');
      throw StateError('marker listener failure');
    });
    controller.onMarkerEvent('m', MarkerInteractionType.drag, (_) {
      calls.add('second');
    });

    expect(
      () => controller.dispatchMarkerInteraction(const MarkerInteraction(
        markerId: 'm',
        type: MarkerInteractionType.drag,
        position: LatLng(1, 2),
        zoom: 17,
      )),
      returnsNormally,
    );
    expect(calls, ['first', 'second']);
    expect(errors, hasLength(1));
    expect(errors.single.exception, isA<StateError>());
    expect(errors.single.library, 'tmap_flutter_sdk');
  });

  test('throwing cluster listener is reported and siblings still run', () {
    final errors = <FlutterErrorDetails>[];
    final originalOnError = FlutterError.onError;
    FlutterError.onError = errors.add;
    addTearDown(() => FlutterError.onError = originalOnError);

    final controller = TMapController.fromWeb('test');
    var called = 0;
    controller.onClusterEvent(ClusterInteractionType.mouseenter, (_) {
      throw StateError('cluster listener failure');
    });
    controller.onClusterEvent(ClusterInteractionType.mouseenter, (_) {
      called++;
    });
    expect(
      () => controller.dispatchClusterInteraction(const ClusterInteraction(
        type: ClusterInteractionType.mouseenter,
        center: LatLng(1, 2),
        zoom: 17,
        markerIds: ['m'],
      )),
      returnsNormally,
    );
    expect(called, 1);
    expect(errors, hasLength(1));
    expect(errors.single.exception, isA<StateError>());
  });
}
