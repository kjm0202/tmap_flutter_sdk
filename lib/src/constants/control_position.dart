/// TMAP 지도 컨트롤의 배치 위치
enum ControlPosition {
  topLeft('top-left'),
  topRight('top-right'),
  bottomLeft('bottom-left'),
  bottomRight('bottom-right'),
  center('center');

  final String value;
  const ControlPosition(this.value);
}
