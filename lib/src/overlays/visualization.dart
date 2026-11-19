import 'package:flutter/material.dart';

import '../models/lat_lng.dart';
import '../utils/hex_color.dart';

/// A weighted geographic sample used by DotMap, SquareMap, and HeatMap.
@immutable
class VisualizationPoint {
  final double lat;
  final double lng;
  final num value;

  const VisualizationPoint({
    required this.lat,
    required this.lng,
    required this.value,
  });

  Map<String, num> toJson() => {'lat': lat, 'lng': lng, 'value': value};
}

/// Immutable configuration for `Tmapv3.extension.DotMap`.
///
/// Add or replace it with [TMapController.addDotMap] / `updateDotMap`, and
/// destroy the native layer with `TMapController.removeDotMap`.
@immutable
class DotMap {
  final String dotMapId;
  final List<VisualizationPoint> data;
  final List<num> radius;
  final List<num> range;
  final Color strokeColor;
  final double strokeOpacity;
  final Color fillColor;
  final double fillOpacity;

  DotMap({
    required this.dotMapId,
    required List<VisualizationPoint> data,
    List<num> radius = const [4, 20],
    List<num> range = const [0, 10],
    this.strokeColor = Colors.white,
    this.strokeOpacity = 0.8,
    this.fillColor = Colors.red,
    this.fillOpacity = 0.5,
  })  : data = List.unmodifiable(data),
        radius = List.unmodifiable(radius),
        range = List.unmodifiable(range) {
    assert(dotMapId.isNotEmpty);
    assert(this.radius.length == 2 &&
        this.radius[0] >= 0 &&
        this.radius[1] >= this.radius[0]);
    assert(this.range.length == 2 && this.range[1] > this.range[0]);
    assert(strokeOpacity >= 0 && strokeOpacity <= 1);
    assert(fillOpacity >= 0 && fillOpacity <= 1);
  }

  DotMap copyWith({
    List<VisualizationPoint>? data,
    List<num>? radius,
    List<num>? range,
    Color? strokeColor,
    double? strokeOpacity,
    Color? fillColor,
    double? fillOpacity,
  }) =>
      DotMap(
        dotMapId: dotMapId,
        data: data ?? this.data,
        radius: radius ?? this.radius,
        range: range ?? this.range,
        strokeColor: strokeColor ?? this.strokeColor,
        strokeOpacity: strokeOpacity ?? this.strokeOpacity,
        fillColor: fillColor ?? this.fillColor,
        fillOpacity: fillOpacity ?? this.fillOpacity,
      );

  Map<String, dynamic> toJson() => {
        'id': dotMapId,
        'radius': radius,
        'range': range,
        'strokeColor': strokeColor.toHexColor(),
        'strokeOpacity': strokeOpacity,
        'fillColor': fillColor.toHexColor(),
        'fillOpacity': fillOpacity,
        'data': {'data': data.map((point) => point.toJson()).toList()},
      };
}

/// Immutable configuration for `Tmapv3.extension.SquareMap`.
@immutable
class SquareMap {
  final String squareMapId;
  final List<VisualizationPoint> data;
  final LatLng origin;
  final int size;
  final List<num> values;
  final List<Color> colors;
  final double strokeOpacity;
  final double fillOpacity;

  SquareMap({
    required this.squareMapId,
    required List<VisualizationPoint> data,
    required this.origin,
    required List<num> values,
    required List<Color> colors,
    this.size = 200,
    this.strokeOpacity = 0.8,
    this.fillOpacity = 0.6,
  })  : data = List.unmodifiable(data),
        values = List.unmodifiable(values),
        colors = List.unmodifiable(colors) {
    assert(squareMapId.isNotEmpty);
    assert(size > 0);
    assert(this.values.isNotEmpty && this.values.length == this.colors.length);
    assert(strokeOpacity >= 0 && strokeOpacity <= 1);
    assert(fillOpacity >= 0 && fillOpacity <= 1);
  }

  SquareMap copyWith({
    List<VisualizationPoint>? data,
    LatLng? origin,
    int? size,
    List<num>? values,
    List<Color>? colors,
    double? strokeOpacity,
    double? fillOpacity,
  }) =>
      SquareMap(
        squareMapId: squareMapId,
        data: data ?? this.data,
        origin: origin ?? this.origin,
        size: size ?? this.size,
        values: values ?? this.values,
        colors: colors ?? this.colors,
        strokeOpacity: strokeOpacity ?? this.strokeOpacity,
        fillOpacity: fillOpacity ?? this.fillOpacity,
      );

  Map<String, dynamic> toJson() => {
        'id': squareMapId,
        'origin': origin.toJson(),
        'size': size,
        'values': values,
        'colors': colors.map((color) => color.toHexColor()).toList(),
        'strokeOpacity': strokeOpacity,
        'fillOpacity': fillOpacity,
        'data': {'data': data.map((point) => point.toJson()).toList()},
      };
}

/// Immutable configuration for `Tmapv3.extension.HeatMap`.
///
/// [max] is stored inside the SDK's `data` object, alongside the samples.
@immutable
class HeatMap {
  final String heatMapId;
  final List<VisualizationPoint> data;
  final int radius;
  final num max;

  HeatMap({
    required this.heatMapId,
    required List<VisualizationPoint> data,
    required this.max,
    this.radius = 10,
  }) : data = List.unmodifiable(data) {
    assert(heatMapId.isNotEmpty);
    assert(max > 0 && max.isFinite);
    assert(radius > 0);
  }

  HeatMap copyWith({List<VisualizationPoint>? data, int? radius, num? max}) =>
      HeatMap(
        heatMapId: heatMapId,
        data: data ?? this.data,
        radius: radius ?? this.radius,
        max: max ?? this.max,
      );

  Map<String, dynamic> toJson() => {
        'id': heatMapId,
        'radius': radius,
        'data': {
          'data': data.map((point) => point.toJson()).toList(),
          'max': max,
        },
      };
}
