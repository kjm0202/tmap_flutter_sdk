import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart' as tmap;

void main() {
  test('GroundOverlay immutable options and serialization', () {
    const bounds = tmap.LatLngBounds(
      southWest: tmap.LatLng(37.5, 126.9),
      northEast: tmap.LatLng(37.6, 127),
    );
    const overlay = tmap.GroundOverlay(
      groundOverlayId: 'image',
      url: 'data:image/png;base64,test',
      bounds: bounds,
      opacity: 0.35,
    );
    expect(overlay.toJson(), {
      'id': 'image',
      'url': 'data:image/png;base64,test',
      'bounds': bounds.toJson(),
      'opacity': 0.35,
    });
  });

  test('Polygon SDK area parsed including thousands separators and inner rings',
      () {
    final result = tmap.PolygonArea.fromJson({
      'pathArea': '12,345',
      'outerPathArea': ['2,001', 44],
    });
    expect(result.pathSquareMeters, 12345);
    expect(result.innerPathSquareMeters, [2001, 44]);
    expect(result.netSquareMeters, 10300);
  });

  test('Drawing controller callbacks yield typed shapes and preserve style',
      () async {
    final controller = tmap.TMapController.fromWeb('unit');
    const style = tmap.DrawingOptions(
      fillColor: Color(0xFF123456),
      fillOpacity: 0,
      strokeColor: Color(0xFF987654),
      strokeOpacity: 0.4,
      strokeWidth: 0,
    );
    expect(style.toJson(), {
      'fillColor': '#123456',
      'fillOpacity': 0,
      'strokeColor': '#987654',
      'strokeOpacity': 0.4,
      'strokeWeight': 0,
    });
    tmap.Circle? circle;
    await controller.startDrawingCircle(
        options: style, onComplete: (value) => circle = value);
    controller.handleDrawingComplete(jsonEncode({
      'type': 'circle',
      'id': 'circle-drawn',
      'center': {'latitude': 37.56, 'longitude': 126.98},
      'radius': 250,
    }));
    expect(circle?.center, const tmap.LatLng(37.56, 126.98));
    expect(circle?.radius, 250);
    expect(circle?.strokeWidth, 0);
    expect(circle?.fillOpacity, 0);

    tmap.Rectangle? rectangle;
    await controller.startDrawingRectangle(
        options: style, onComplete: (value) => rectangle = value);
    controller.handleDrawingComplete(jsonEncode({
      'type': 'rectangle',
      'id': 'rectangle-drawn',
      'bounds': {
        'southWest': {'latitude': 37.5, 'longitude': 126.9},
        'northEast': {'latitude': 37.6, 'longitude': 127},
      },
    }));
    expect(rectangle?.bounds.northEast, const tmap.LatLng(37.6, 127));
    expect(rectangle?.fillColor, const Color(0xFF123456));

    final points = [
      {'latitude': 37.5, 'longitude': 126.9},
      {'latitude': 37.6, 'longitude': 127.0},
      {'latitude': 37.7, 'longitude': 127.1},
    ];
    tmap.Polyline? line;
    await controller.startDrawingPolyline(
        options: style, onComplete: (value) => line = value);
    controller.handleDrawingComplete(jsonEncode({
      'type': 'polyline',
      'id': 'line-drawn',
      'points': points,
    }));
    expect(line?.points.length, 3);
    expect(line?.points.last, const tmap.LatLng(37.7, 127.1));
    expect(line?.strokeOpacity, 0.4);

    tmap.Polygon? polygon;
    await controller.startDrawingPolygon(
        options: style, onComplete: (value) => polygon = value);
    controller.handleDrawingComplete(jsonEncode({
      'type': 'polygon',
      'id': 'polygon-drawn',
      'points': points,
    }));
    expect(polygon?.points.length, 3);
    expect(polygon?.fillOpacity, 0);

    await controller.clearDrawings();
    controller.handleDrawingComplete(jsonEncode({
      'type': 'polygon',
      'id': 'stale',
      'points': points,
    }));
    expect(polygon?.polygonId, 'polygon-drawn');
  });
}
