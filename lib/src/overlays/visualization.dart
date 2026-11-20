import 'package:flutter/material.dart';

import '../models/lat_lng.dart';
import '../utils/hex_color.dart';

/// A weighted geographic sample used by DotMap, SquareMap, and HeatMap.
@immutable
class VisualizationPoint {
  /// WGS84 latitude in degrees.
  final double lat;

  /// WGS84 longitude in degrees.
  final double lng;

  /// Numeric sample weight passed to the Tmapv3 visualization extension.
  final num value;

  /// Creates a weighted sample at the given WGS84 coordinates.
  const VisualizationPoint({
    required this.lat,
    required this.lng,
    required this.value,
  });

  /// Returns a sample JSON object with `lat`, `lng`, and `value` keys.
  Map<String, num> toJson() => {'lat': lat, 'lng': lng, 'value': value};
}

/// Immutable configuration for `Tmapv3.extension.DotMap`.
///
/// Add or replace it with [TMapController.addDotMap] / `updateDotMap`, and
/// destroy the native layer with `TMapController.removeDotMap`.
@immutable
class DotMap {
  /// Identifier used to replace or remove this dot visualization.
  final String dotMapId;

  /// Unmodifiable weighted geographic samples.
  final List<VisualizationPoint> data;

  /// Two dot radii supplied to the SDK, defaulting to `[4, 20]`.
  final List<num> radius;

  /// Increasing pair of sample values, defaulting to `[0, 10]`.
  final List<num> range;

  /// Dot outline color, white by default.
  final Color strokeColor;

  /// Outline opacity from 0 to 1, defaulting to 0.8.
  final double strokeOpacity;

  /// Dot interior color, red by default.
  final Color fillColor;

  /// Interior opacity from 0 to 1, defaulting to 0.5.
  final double fillOpacity;

  /// Creates a Tmapv3 dot visualization from weighted [data] samples.
  ///
  /// Copies all lists into unmodifiable collections and asserts a nonempty
  /// ID, increasing [range], valid [radius] pair, and opacities in 0 to 1.
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

  /// Returns a new configuration, retaining [dotMapId] and unspecified values.
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

  /// Returns the Tmapv3 dot-layer bridge payload.
  ///
  /// Wraps samples under `data: {data: [...]}` and encodes colors as CSS hex.
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
  /// Identifier used to replace or remove this square visualization.
  final String squareMapId;

  /// Unmodifiable weighted geographic samples.
  final List<VisualizationPoint> data;

  /// WGS84 geographic origin of the square visualization.
  final LatLng origin;

  /// Positive grid size passed to the SDK, defaulting to 200.
  final int size;

  /// Unmodifiable numeric thresholds corresponding to [colors].
  final List<num> values;

  /// Unmodifiable colors corresponding to [values].
  final List<Color> colors;

  /// Square outline opacity from 0 to 1, defaulting to 0.8.
  final double strokeOpacity;

  /// Square interior opacity from 0 to 1, defaulting to 0.6.
  final double fillOpacity;

  /// Creates a Tmapv3 square visualization from weighted [data] samples.
  ///
  /// Copies lists into unmodifiable collections and asserts a positive
  /// [size], nonempty equal-length [values] and [colors], and valid opacities.
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

  /// Returns a new configuration retaining [squareMapId] and omitted values.
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

  /// Returns the Tmapv3 square-layer bridge payload.
  ///
  /// Includes [origin], [size], thresholds, CSS hex colors, and wrapped data.
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
  /// Identifier used to replace or remove this heat visualization.
  final String heatMapId;

  /// Unmodifiable weighted geographic samples.
  final List<VisualizationPoint> data;

  /// Positive heat radius passed to the SDK, defaulting to 10.
  final int radius;

  /// Positive finite maximum sample weight used by the SDK.
  final num max;

  /// Creates a Tmapv3 heat visualization with a positive finite [max].
  ///
  /// Copies [data] into an unmodifiable list and asserts positive [radius]
  /// and a nonempty [heatMapId].
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

  /// Returns a new configuration with [heatMapId] and unspecified values kept.
  HeatMap copyWith({List<VisualizationPoint>? data, int? radius, num? max}) =>
      HeatMap(
        heatMapId: heatMapId,
        data: data ?? this.data,
        radius: radius ?? this.radius,
        max: max ?? this.max,
      );

  /// Returns the Tmapv3 heat-layer bridge payload.
  ///
  /// Stores the maximum weight inside `data: {data: [...], max: ...}`.
  Map<String, dynamic> toJson() => {
        'id': heatMapId,
        'radius': radius,
        'data': {
          'data': data.map((point) => point.toJson()).toList(),
          'max': max,
        },
      };
}
