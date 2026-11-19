import 'dart:async';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'shape_scenarios.dart';
import 'cluster_scenarios.dart';
import 'tdata_scenarios.dart';
import 'camera_scenarios.dart';
import 'info_window_scenarios.dart';
import 'map_display_scenario.dart';
import 'map_gestures_scenario.dart';
import 'overlay_interactions_scenario.dart';
import 'overlay_tools_scenario.dart';
import 'widget_lifecycle_scenario.dart';
import 'overlay_presentation_scenario.dart';

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

  final Map<String, Future<void> Function()> scenarios = {
    'shapes': () => testShapeScenarios(controller),
    'cluster': () => testClusterScenarios(controller),
    'tdata': () => testTDataScenarios(controller),
    'place_search': () => testPlaceSearchScenario(controller),
    'walking': () => testWalkingScenario(controller),
    'camera': () => testCameraScenarios(controller),
    'info_window': () => testInfoWindowScenarios(controller),
    'map_display': testMapDisplay,
    'map_gestures': testMapGestures,
    'overlay_interactions': testOverlayInteractions,
    'overlay_tools': testOverlayTools,
    'widget_lifecycle': testWidgetLifecycle,
    'overlay_presentation': testOverlayPresentation,
  };

  final filterEnv = const String.fromEnvironment('SCENARIO_FILTER');
  final List<String> suitesToRun;
  bool allPassed = true;

  if (filterEnv.trim().isEmpty) {
    suitesToRun = scenarios.keys.toList();
  } else {
    final filterNames = filterEnv
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    if (filterNames.isEmpty) {
      allPassed = false;
      suitesToRun = const [];
    } else {
      final filterSet = filterNames.toSet();
      final unknown = <String>{};
      for (final name in filterNames) {
        if (!scenarios.containsKey(name) && unknown.add(name)) {
          allPassed = false;
          debugPrint('SCENARIO $name FAIL: unknown scenario');
        }
      }
      suitesToRun = scenarios.keys.where(filterSet.contains).toList();
    }
  }

  int ranCount = 0;

  for (final name in suitesToRun) {
    final runner = scenarios[name]!;
    ranCount++;

    try {
      await runner().timeout(const Duration(seconds: 75), onTimeout: () => throw TimeoutException('Scenario execution timeout'));
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
    } on TimeoutException catch (e) {
      allPassed = false;
      final type = e.message == 'Map readiness timeout' ? 'outer' : 'interior';
      debugPrint('SCENARIO $name FAIL: $type timeout after 75s');
    } catch (e) {
      allPassed = false;
      debugPrint('SCENARIO $name FAIL: ${e.runtimeType}');
    }
  }

  runApp(const SizedBox.shrink());
  await WidgetsBinding.instance.endOfFrame;

  if (allPassed && flutterErrorCount == 0 && ranCount > 0) {
    debugPrint('SCENARIOS_PASS');
  } else {
    debugPrint('SCENARIOS_FAIL');
  }
}
