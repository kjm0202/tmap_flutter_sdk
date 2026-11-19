import 'dart:async';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

/// Mounts a live map isolated from previous roots.
///
/// Detaches any previous root by running `SizedBox.shrink()` and waiting for
/// `WidgetsBinding.instance.endOfFrame`. Wraps the built [TMap] in [MaterialApp],
/// using a [Completer] callback guarded against multiple invocations, and
/// enforces a readiness timeout.
Future<TMapController> mountLiveMap(TMap Function(MapCreateCallback created) build) async {
  runApp(const SizedBox.shrink());
  await WidgetsBinding.instance.endOfFrame;

  final completer = Completer<TMapController>();
  final mapWidget = build((controller) {
    if (!completer.isCompleted) {
      completer.complete(controller);
    }
  });

  runApp(MaterialApp(home: mapWidget));

  return completer.future.timeout(
    const Duration(seconds: 45),
    onTimeout: () => throw TimeoutException('Map readiness timeout'),
  );
}

/// Polls [read] until it returns `true` or reaches the timeout.
/// Throws a [StateError] with [description] upon timeout.
Future<void> expectLive(String description, Future<bool> Function() read) async {
  const maxAttempts = 50;
  const pollInterval = Duration(milliseconds: 150);

  for (var i = 0; i < maxAttempts; i++) {
    if (await read()) {
      return;
    }
    await Future<void>.delayed(pollInterval);
  }

  throw StateError('Timed out waiting for $description');
}

/// Unmounts any active live map and detaches the root widget tree.
Future<void> unmountLiveMap() async {
  runApp(const SizedBox.shrink());
  await WidgetsBinding.instance.endOfFrame;
}
