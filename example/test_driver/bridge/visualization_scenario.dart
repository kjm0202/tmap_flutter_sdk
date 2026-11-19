import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _registry =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';
const _samples = [
  VisualizationPoint(lat: 37.5665, lng: 126.9780, value: 7),
  VisualizationPoint(lat: 37.5670, lng: 126.9790, value: 13),
];

String _layerExists(String type, String id) => '''(function() {
  const state = $_registry;
  const obj = state && state.visualizations && state.visualizations['$type'] && state.visualizations['$type']['$id'];
  const clazz = {dot: 'DotMap', square: 'SquareMap', heat: 'HeatMap'}['$type'];
  return !!(obj && obj instanceof Tmapv3.extension[clazz] &&
    state.map.vsmMap().hasLayer(obj.layerId));
})()''';

String _layerMissing(String type, String id) => '''(function() {
  const state = $_registry;
  const oldId = window.__visualizationLayerIds && window.__visualizationLayerIds['$type'];
  return !(state && state.visualizations && state.visualizations['$type'] && state.visualizations['$type']['$id']) &&
    (oldId === undefined || !state.map.vsmMap().hasLayer(oldId));
})()''';

String _saveLayerIds() => '''(function() {
  const state = $_registry;
  window.__visualizationLayerIds = {
    dot: state.visualizations.dot['viz-dot'].layerId,
    square: state.visualizations.square['viz-square'].layerId,
    heat: state.visualizations.heat['viz-heat'].layerId,
  };
  return true;
})()''';

String _updatedLayer(String type, String id, String optionCheck) =>
    '''(function() {
  const state = $_registry;
  const obj = state.visualizations['$type']['$id'];
  const oldId = window.__visualizationLayerIds['$type'];
  const engine = state.map.vsmMap();
  return !!(obj && obj.layerId !== oldId &&
    !engine.hasLayer(oldId) && engine.hasLayer(obj.layerId) && ($optionCheck));
})()''';

Future<void> testVisualizationScenario(TMapController controller) async {
  final dot = DotMap(
    dotMapId: 'viz-dot',
    data: _samples,
    radius: [5, 17],
    range: [0, 25],
    strokeColor: const Color(0xFF226688),
    strokeOpacity: 0.7,
    fillColor: const Color(0xFFFF8800),
    fillOpacity: 0.45,
  );
  final square = SquareMap(
    squareMapId: 'viz-square',
    data: _samples,
    origin: const LatLng(37.5650, 126.9770),
    size: 160,
    values: [10, 20],
    colors: [const Color(0xFF22AA66), const Color(0xFF112266)],
    fillOpacity: 0.6,
    strokeOpacity: 0.4,
  );
  final heat = HeatMap(
    heatMapId: 'viz-heat',
    data: _samples,
    radius: 18,
    max: 30,
  );

  try {
    await controller.addDotMap(dot);
    await expectLive('DotMap constructor options and data attached',
        () => checkJs(controller, _layerExists('dot', 'viz-dot')));
    await controller.addSquareMap(square);
    await expectLive('SquareMap constructor options and data attached',
        () => checkJs(controller, _layerExists('square', 'viz-square')));
    await controller.addHeatMap(heat);
    await expectLive('HeatMap constructor options and data attached',
        () => checkJs(controller, _layerExists('heat', 'viz-heat')));

    await expectLive('DotMap native radius range colors and weighted data',
        () => checkJs(controller, '''(function() {
          const layer = $_registry.visualizations.dot['viz-dot'];
          return layer._radiusMin === 5 && layer._radiusMax === 17 &&
            layer._valueMin === 0 && layer._valueMax === 25 &&
            layer._color.fillColor === '#ff8800' && layer._color.strokeColor === '#226688' &&
            layer._color.fillOpacity === 0.45 && layer._color.strokeOpacity === 0.7 &&
            layer.data.data.length === 2 && layer.data.data[0].value === 7 &&
            layer.data.data[0].lat === 37.5665 && layer.data.data[0].lng === 126.978;
        })()'''));
    await expectLive('SquareMap native size palette and weighted data',
        () => checkJs(controller, '''(function() {
          const layer = $_registry.visualizations.square['viz-square'];
          return layer._size === 160 && layer._values[0] === 10 &&
            layer._values[1] === 20 && layer._colors[0] === '#22aa66' &&
            layer._colors[1] === '#112266' && layer._fillOpacity === 0.6 &&
            layer._strokeOpacity === 0.4 && layer.data.data.length === 2 &&
            layer.data.data[1].value === 13 &&
            layer.data.data[1].lat === 37.567 && layer.data.data[1].lng === 126.979;
        })()'''));
    await expectLive('HeatMap native radius max and weighted data',
        () => checkJs(controller, '''(function() {
          const layer = $_registry.visualizations.heat['viz-heat'];
          return layer.radius === 18 && layer.data.max === 30 &&
            layer.data.data.length === 2 && layer.data.data[0].lat === 37.5665 &&
            layer.data.data[0].lng === 126.978 && layer.data.data[0].value === 7;
        })()'''));
    await checkJs(controller, _saveLayerIds());

    await controller.updateDotMap(dot.copyWith(range: [0, 40]));
    await expectLive(
        'DotMap update detaches the previous SDK layer',
        () => checkJs(controller,
            _updatedLayer('dot', 'viz-dot', 'obj._valueMax === 40')));
    await controller.updateSquareMap(square.copyWith(size: 240));
    await expectLive(
        'SquareMap update detaches the previous SDK layer',
        () => checkJs(controller,
            _updatedLayer('square', 'viz-square', 'obj._size === 240')));
    await controller.updateHeatMap(heat.copyWith(radius: 26));
    await expectLive(
        'HeatMap update detaches the previous SDK layer',
        () => checkJs(controller,
            _updatedLayer('heat', 'viz-heat', 'obj.radius === 26')));
    await checkJs(controller, _saveLayerIds());
  } finally {
    await controller.removeDotMap('viz-dot');
    await controller.removeSquareMap('viz-square');
    await controller.removeHeatMap('viz-heat');
  }
  await expectLive('DotMap destroy detaches SDK layer',
      () => checkJs(controller, _layerMissing('dot', 'viz-dot')));
  await expectLive('SquareMap destroy detaches SDK layer',
      () => checkJs(controller, _layerMissing('square', 'viz-square')));
  await expectLive('HeatMap destroy detaches SDK layer',
      () => checkJs(controller, _layerMissing('heat', 'viz-heat')));
}
