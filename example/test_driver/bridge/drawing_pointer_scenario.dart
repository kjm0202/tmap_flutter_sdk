import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';
const _style = DrawingOptions(
  fillColor: Color(0xFF229955),
  fillOpacity: 0.35,
  strokeColor: Color(0xFFCC3311),
  strokeOpacity: 0.75,
  strokeWidth: 4,
);
int _gestureSequence = 0;

/// Performs real mouse actions through web_input/driver.mjs (CDP).
/// The browser driver watches __tmapTrustedGesture and sets its done flag.
Future<void> _trustedMouse(
  TMapController controller,
  String action, {
  required int x,
  required int y,
  int? endX,
  int? endY,
}) async {
  final id = DateTime.now().microsecondsSinceEpoch + ++_gestureSequence;
  final request = jsonEncode({
    'id': id,
    'action': action,
    'x': x,
    'y': y,
    if (endX != null) 'endX': endX,
    if (endY != null) 'endY': endY,
    'done': false,
  });
  await runJs(controller,
      '(function() {window.__tmapTrustedGesture = $request; return true})()');
  await expectLive(
      'CDP $action gesture completed',
      () => checkJs(
          controller,
          'window.__tmapTrustedGesture?.id === $id && '
          'window.__tmapTrustedGesture?.done === true'));
  final error =
      await runJs(controller, 'window.__tmapTrustedGesture?.error || null');
  if (error != null) throw StateError('CDP $action gesture failed: $error');
}

/// Checks native completion and Dart typed callbacks from actual map input.
Future<void> testDrawingPointerScenario() async {
  final controller = await mountLiveMap(
    (created) => TMap(
      center: const LatLng(37.5665, 126.978),
      zoom: 15,
      onMapCreated: created,
    ),
  );
  Circle? circle;
  Rectangle? rectangle;
  Polyline? polyline;
  Polygon? polygon;

  Future<void> assertFinished(String type, int expectedCount) async {
    await expectLive(
        'Drawing $type completed from real mouse and typed callback',
        () => checkJs(controller, '''(function() {
          const d = $_reg.drawingSession?.nativeDrawing();
          return d && d.isFinish() && d.getShapes().length === $expectedCount &&
            d.get${type}s().length === 1;
        })()'''));
  }

  try {
    await controller.startDrawingCircle(
      options: _style,
      onComplete: (shape) => circle = shape,
    );
    await expectLive(
        'Drawing circle starts interactive mode',
        () => checkJs(controller,
            '$_reg.drawingSession?.nativeDrawing()?._status?.drawType === 1 && map.isDrawing === true'));
    await expectLive(
      'Drawing constructor style and map options read back from SDK',
      () => checkJs(controller, '''(function() {
        const d = $_reg.drawingSession?.nativeDrawing();
        const o = d?._status?.drawOptions;
        return d?._data?.map === map && o &&
          o.fillColor === '#229955' && o.fillOpacity === 0.35 &&
          o.strokeColor === '#cc3311' && o.strokeOpacity === 0.75 &&
          o.strokeWeight === 4;
      })()'''),
    );
    await _trustedMouse(controller, 'drag',
        x: 300, y: 280, endX: 390, endY: 365);
    await assertFinished('Circle', 1);
    await expectLive(
        'Drawing circle Dart callback returns geographic radius',
        () async =>
            circle != null &&
            circle!.radius > 0 &&
            circle!.center.latitude > 35 &&
            circle!.strokeColor == _style.strokeColor);

    await controller.startDrawingRectangle(
      options: _style,
      onComplete: (shape) => rectangle = shape,
    );
    await _trustedMouse(controller, 'drag',
        x: 410, y: 270, endX: 510, endY: 355);
    await assertFinished('Rectangle', 2);
    await expectLive(
        'Drawing rectangle Dart callback returns geographic bounds',
        () async =>
            rectangle != null &&
            rectangle!.bounds.northEast != rectangle!.bounds.southWest &&
            rectangle!.fillOpacity == _style.fillOpacity);

    await controller.startDrawingPolyline(
      options: _style,
      onComplete: (shape) => polyline = shape,
    );
    await _trustedMouse(controller, 'tap', x: 280, y: 400);
    await _trustedMouse(controller, 'tap', x: 330, y: 430);
    await _trustedMouse(controller, 'tap', x: 390, y: 405);
    await _trustedMouse(controller, 'rightClick', x: 390, y: 405);
    await assertFinished('Polyline', 3);
    await expectLive('Drawing polyline Dart callback returns vertices',
        () async => polyline != null && polyline!.points.length >= 2);

    await controller.startDrawingPolygon(
      options: _style,
      onComplete: (shape) => polygon = shape,
    );
    await _trustedMouse(controller, 'tap', x: 470, y: 390);
    await _trustedMouse(controller, 'tap', x: 540, y: 410);
    await _trustedMouse(controller, 'tap', x: 490, y: 465);
    await _trustedMouse(controller, 'rightClick', x: 490, y: 465);
    await assertFinished('Polygon', 4);
    await expectLive(
        'Drawing polygon Dart callback returns vertices',
        () async =>
            polygon != null &&
            polygon!.points.length >= 3 &&
            polygon!.fillColor == _style.fillColor);

    final layerIds = await runJs(controller,
        '$_reg.drawingSession.nativeDrawing().getShapes().map(s => s._shape_data.layerId)');
    if (layerIds is! List || layerIds.length != 4) {
      throw StateError('Drawing did not retain four native shape layers');
    }
    await controller.clearDrawings();
    await expectLive('Drawing clear detaches all four completed shapes',
        () => checkJs(controller, '''(function() {
          const d = $_reg.drawingSession?.nativeDrawing();
          return d && d.getShapes().length === 0 && d.isFinish() &&
            map.isDrawing === false &&
            ${jsonEncode(layerIds)}.every(id => !map.vsmMap().hasLayer(id));
        })()'''));
  } finally {
    await controller.clearDrawings();
    await controller.clearAll();
    await unmountLiveMap();
  }
}
