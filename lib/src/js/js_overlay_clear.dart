/// 오버레이 및 도형 제거를 위한 JavaScript 스크립트 생성기
class JsOverlayClear {
  static String getScript() {
    return '''
    function clearPolyline(id) {
      if (polylines[id]) {
        polylines[id].setMap(null);
        delete polylines[id];
      }
    }

    function clearPolygon(id) {
      if (polygons[id]) {
        polygons[id].setMap(null);
        delete polygons[id];
      }
    }

    function clearCircle(id) {
      if (circles[id]) {
        circles[id].setMap(null);
        delete circles[id];
      }
    }

    function clearRectangle(id) {
      if (rectangles[id]) {
        rectangles[id].setMap(null);
        delete rectangles[id];
      }
    }

    function clearCustomOverlay(id) {
      if (customOverlays[id]) {
        customOverlays[id].setMap(null);
        delete customOverlays[id];
      }
    }

    function clearAllPolylines() {
      for (var id in polylines) {
        if (polylines.hasOwnProperty(id)) {
          polylines[id].setMap(null);
        }
      }
      polylines = {};
    }

    function clearAllPolygons() {
      for (var id in polygons) {
        if (polygons.hasOwnProperty(id)) {
          polygons[id].setMap(null);
        }
      }
      polygons = {};
    }

    function clearAllCircles() {
      for (var id in circles) {
        if (circles.hasOwnProperty(id)) {
          circles[id].setMap(null);
        }
      }
      circles = {};
    }

    function clearAllRectangles() {
      for (var id in rectangles) {
        if (rectangles.hasOwnProperty(id)) {
          rectangles[id].setMap(null);
        }
      }
      rectangles = {};
    }

    function clearAllCustomOverlays() {
      for (var id in customOverlays) {
        if (customOverlays.hasOwnProperty(id)) {
          customOverlays[id].setMap(null);
        }
      }
      customOverlays = {};
    }

    function clearAll() {
      clearAllMarkers();
      clearAllInfoWindows();
      clearAllLabels();
      clearMarkerClusterer();
      clearAllPolylines();
      clearAllPolygons();
      clearAllCircles();
      clearAllRectangles();
      clearAllCustomOverlays();
    }
    ''';
  }
}
