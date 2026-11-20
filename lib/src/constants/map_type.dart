/// Map style types supported by TMAP.
enum TMapType {
  /// Standard road map.
  road('ROAD'),

  /// Hybrid map combining satellite imagery and road details.
  hybrid('HYBRID'),

  /// Public map style.
  public('PUBLIC'),

  /// Night map style.
  night('NIGHT');

  /// Uppercase map type identifier passed to Tmapv3.
  final String value;

  /// Associates the map type with its SDK identifier [value].
  const TMapType(this.value);
}
