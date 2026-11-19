import 'dart:async';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'shape_scenarios.dart';
import 'cluster_scenarios.dart';
import 'tdata_scenarios.dart';
import 'camera_scenarios.dart';
import 'info_window_scenarios.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final key = const String.fromEnvironment('TMAP_APP_KEY');
  if (key.isEmpty) {
    debugPrint('SCENARIOS_FAIL');
    return;
  }

  AuthRepository.initialize(appKey: key);

  final mapCompleter = Completer<TMapController>();
  int flutterErrorCount = 0;

  FlutterError.onError = (FlutterErrorDetails details) {
    flutterErrorCount++;
    debugPrint('FLUTTER_ERROR: ${details.exception.runtimeType}');
  };

  runApp(MaterialApp(
    home: TMap(
      onMapCreated: (controller) {
        if (!mapCompleter.isCompleted) mapCompleter.complete(controller);
      },
    ),
  ));

  final TMapController controller;
  try {
    controller = await mapCompleter.future.timeout(
      const Duration(seconds: 45),
      onTimeout: () => throw TimeoutException('Map readiness timeout'),
    );
  } on TimeoutException {
    debugPrint('SCENARIOS_FAIL');
    return;
  }

  final Map<String, Future<void> Function(TMapController)> scenarios = {
    'shapes': testShapeScenarios,
    'cluster': testClusterScenarios,
    'tdata': testTDataScenarios,
    'place_search': testPlaceSearchScenario,
    'walking': testWalkingScenario,
    'camera': testCameraScenarios,
    'info_window': testInfoWindowScenarios,
  };

  bool allPassed = true;

  for (final entry in scenarios.entries) {
    final name = entry.key;
    try {
      await entry.value(controller).timeout(const Duration(seconds: 75));
      debugPrint('SCENARIO $name PASS');
    } on StateError catch (e) {
      allPassed = false;
      final raw = e.message
          .replaceAll(key, '[KEY]')
          .replaceAll(RegExp(r'https?://\S+'), '[URL]');
      final collapsed = raw.replaceAll('\n', ' | ');
      final detail =
          collapsed.length > 1800 ? collapsed.substring(0, 1800) : collapsed;
      debugPrint('SCENARIO $name FAIL: $detail');
    } on TimeoutException {
      allPassed = false;
      debugPrint('SCENARIO $name FAIL: timed out after 75s');
    } catch (e) {
      allPassed = false;
      debugPrint('SCENARIO $name FAIL: ${e.runtimeType}');
    }
  }

  runApp(const SizedBox.shrink());
  await WidgetsBinding.instance.endOfFrame;

  if (allPassed && flutterErrorCount == 0) {
    debugPrint('SCENARIOS_PASS');
  } else {
    debugPrint('SCENARIOS_FAIL');
  }
}
