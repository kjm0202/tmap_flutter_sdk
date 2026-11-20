/// Positions available for TMAP map controls.
enum ControlPosition {
  /// Upper-left corner of the map.
  topLeft('top-left'),

  /// Upper-right corner of the map.
  topRight('top-right'),

  /// Lower-left corner of the map.
  bottomLeft('bottom-left'),

  /// Lower-right corner of the map.
  bottomRight('bottom-right'),

  /// Center of the map.
  center('center');

  /// SDK position string, such as `top-left`.
  final String value;

  /// Associates a control position with its SDK string [value].
  const ControlPosition(this.value);
}
