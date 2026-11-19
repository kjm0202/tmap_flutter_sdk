import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  test('DotMap SDK option payload and immutable weighted data', () {
    final input = [
      const VisualizationPoint(lat: 37.5665, lng: 126.978, value: 7),
    ];
    final dot = DotMap(
      dotMapId: 'dots',
      data: input,
      radius: [3, 18],
      range: [1, 30],
      strokeColor: const Color(0xFF123456),
      strokeOpacity: 0.3,
      fillColor: const Color(0xFFABCDEF),
      fillOpacity: 0.4,
    );
    input.clear();
    expect(dot.data, hasLength(1));
    expect(() => dot.data.clear(), throwsUnsupportedError);
    expect(dot.toJson(), {
      'id': 'dots',
      'radius': [3, 18],
      'range': [1, 30],
      'strokeColor': '#123456',
      'strokeOpacity': 0.3,
      'fillColor': '#abcdef',
      'fillOpacity': 0.4,
      'data': {
        'data': [
          {'lat': 37.5665, 'lng': 126.978, 'value': 7},
        ],
      },
    });
    final updated = dot.copyWith(range: [0, 50], data: []);
    expect(updated.dotMapId, dot.dotMapId);
    expect(updated.data, isEmpty);
    expect(dot.range, [1, 30]);
  });

  test('SquareMap SDK origin, value thresholds and color palette', () {
    final values = <num>[10, 25];
    final colors = [const Color(0xFFFF0000), const Color(0xFF00FF00)];
    final square = SquareMap(
      squareMapId: 'grid',
      data: [const VisualizationPoint(lat: 37.5, lng: 127, value: 20)],
      origin: const LatLng(37.4, 126.9),
      size: 150,
      values: values,
      colors: colors,
      strokeOpacity: 0.2,
      fillOpacity: 0.6,
    );
    values.clear();
    colors.clear();
    expect(square.values, [10, 25]);
    expect(() => square.colors.clear(), throwsUnsupportedError);
    expect(square.toJson(), {
      'id': 'grid',
      'origin': {'latitude': 37.4, 'longitude': 126.9},
      'size': 150,
      'values': [10, 25],
      'colors': ['#ff0000', '#00ff00'],
      'strokeOpacity': 0.2,
      'fillOpacity': 0.6,
      'data': {
        'data': [
          {'lat': 37.5, 'lng': 127, 'value': 20},
        ],
      },
    });
    expect(square.copyWith(size: 250).size, 250);
    expect(square.size, 150);
  });

  test('HeatMap SDK max belongs inside data object', () {
    final heat = HeatMap(
      heatMapId: 'heat',
      radius: 14,
      max: 50,
      data: [const VisualizationPoint(lat: 37, lng: 127, value: 20)],
    );
    expect(heat.toJson(), {
      'id': 'heat',
      'radius': 14,
      'data': {
        'data': [
          {'lat': 37.0, 'lng': 127.0, 'value': 20},
        ],
        'max': 50,
      },
    });
    expect(heat.copyWith(max: 100).max, 100);
    expect(heat.max, 50);
  });
}
