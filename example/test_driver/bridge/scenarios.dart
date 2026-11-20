import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'shape_scenarios.dart';
import 'cluster_scenarios.dart';
import 'cluster_members_scenario.dart';
import 'tdata_scenarios.dart';
import 'tdata_rest_scenario.dart';
import 'tdata_coordinate_scenario.dart';
import 'camera_scenarios.dart';
import 'info_window_scenarios.dart';
import 'map_display_scenario.dart';
import 'map_gestures_scenario.dart';
import 'overlay_interactions_scenario.dart';
import 'overlay_tools_scenario.dart';
import 'widget_lifecycle_scenario.dart';
import 'overlay_presentation_scenario.dart';
import 'overlay_regression_scenario.dart';
import 'polygon_zindex_scenario.dart';
import 'shape_style_scenario.dart';
import 'shape_contract_scenario.dart';
import 'drawing_pointer_scenario.dart';
import 'scroll_screen_scenario.dart';
import 'place_area_popup_scenario.dart';
import 'place_response_capture.dart';
import 'overlay_contract_scenarios.dart';
import 'projection_scenario.dart';
import 'map_contract_scenario.dart';
import 'map_options_scenario.dart';
import 'map_touch_scenario.dart';
import 'value_types_scenario.dart';
import 'visualization_scenario.dart';

void main() async {
  const filter = String.fromEnvironment('SCENARIO_FILTER');
  final names = filter.split(',').map((s) => s.trim()).toSet();
  if (filter.trim().isEmpty || names.contains('place_area_popup')) {
    await runWithPlaceCaptureClient(_runScenarios);
  } else {
    await _runScenarios();
  }
}

Future<void> _runScenarios() async {
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
    'tdata_rest': testTDataRestScenario,
    'tdata_coordinates': () => testTdataCoordinateScenario(controller),
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
    'overlay_regression': testOverlayRegression,
    'polygon_zindex': testPolygonZIndex,
    'shape_zindex': testShapeZIndex,
    'shape_style': testShapeStyle,
    'shape_contracts': testShapeContracts,
    'shape_drawing': testDrawingPointerScenario,
    'cluster_members': testClusterMembers,
    'marker_contract': testMarkerContract,
    'cluster_contract': testClusterContract,
    'info_window_contract': testInfoWindowContract,
    'label_contract': testLabelContract,
    'scroll_screen': testScrollScreenScenario,
    'scroll_screen_dynamic': testScrollScreenDynamic,
    'place_area_popup': testPlaceAreaPopupScenario,
    'projection': testProjectionScenario,
    'map_contract': testMapContract,
    'map_controls': testMapControls,
    'map_advanced_options': testMapAdvancedOptions,
    'map_touch': testMapTouchEvents,
    'map_context_menu': testMapContextMenu,
    'value_types': testValueTypes,
    'visualization': testVisualizationScenario,
  };

  final filterEnv = const String.fromEnvironment('SCENARIO_FILTER');
  const chromeCdpRequired = {
    'shape_drawing',
    'map_touch',
    'map_context_menu',
  };
  final List<String> suitesToRun;
  bool allPassed = true;

  if (filterEnv.trim().isEmpty) {
    // The dynamic case already runs inside scroll_screen on iOS; the alias is
    // only for selecting that case directly.
    suitesToRun = scenarios.keys
        .where((name) =>
            name != 'scroll_screen_dynamic' &&
            (kIsWeb || !chromeCdpRequired.contains(name)))
        .toList();
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
      suitesToRun = scenarios.keys
          .where((name) =>
              filterSet.contains(name) &&
              !(name == 'scroll_screen_dynamic' &&
                  filterSet.contains('scroll_screen')))
          .toList();
    }
  }

  int ranCount = 0;

  for (final name in suitesToRun) {
    if (!kIsWeb && chromeCdpRequired.contains(name)) {
      allPassed = false;
      debugPrint('SCENARIO $name FAIL: requires Chrome CDP input driver');
      continue;
    }
    final runner = scenarios[name]!;
    final timeoutSeconds =
        name == 'scroll_screen' || name == 'place_area_popup' ? 150 : 75;
    ranCount++;

    try {
      await runner().timeout(Duration(seconds: timeoutSeconds),
          onTimeout: () =>
              throw TimeoutException('Scenario execution timeout'));
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
      debugPrint('SCENARIO $name FAIL: $type timeout after ${timeoutSeconds}s');
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
