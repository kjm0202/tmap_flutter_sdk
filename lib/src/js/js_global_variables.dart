/// JavaScript 전역 변수 선언 스크립트
class JsGlobalVariables {
  static String getScript() {
    return '''
    var map;
    var markers = {};
    var infoWindows = {};
    var labels = {};
    var polylines = {};
    var polygons = {};
    var circles = {};
    var rectangles = {};
    var customOverlays = {};
    var markerCluster = null;
    var tdata = null;
    var defaultCenter;
    ''';
  }
}
