/// 폴리라인, 다각형, 원, 사각형, 커스텀 오버레이 그리기를 위한 JavaScript 스크립트 생성기
class JsOverlayDraw {
  static String getScript({required bool hasCustomOverlayTapCallback}) {
    return '''
    function addPolyline(polylineId, pointsJson, strokeColor, strokeOpacity, strokeWidth, direction, zIndex) {
      if (!map) return;

      if (polylines[polylineId]) {
        polylines[polylineId].setMap(null);
        delete polylines[polylineId];
      }

      var pointsData = typeof pointsJson === 'string' ? JSON.parse(pointsJson) : pointsJson;
      var path = [];
      for (var i = 0; i < pointsData.length; i++) {
        path.push(new Tmapv3.LatLng(pointsData[i].latitude, pointsData[i].longitude));
      }

      var polyline = new Tmapv3.Polyline({
        path: path,
        strokeColor: strokeColor || "#0066FF",
        strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
        strokeWeight: strokeWidth || 5,
        direction: direction || false,
        map: map
      });

      polylines[polylineId] = polyline;
    }

    function addPolygon(polygonId, pointsJson, fillColor, fillOpacity, strokeColor, strokeOpacity, strokeWidth, zIndex) {
      if (!map) return;

      if (polygons[polygonId]) {
        polygons[polygonId].setMap(null);
        delete polygons[polygonId];
      }

      var pointsData = typeof pointsJson === 'string' ? JSON.parse(pointsJson) : pointsJson;
      var paths = [];
      for (var i = 0; i < pointsData.length; i++) {
        paths.push(new Tmapv3.LatLng(pointsData[i].latitude, pointsData[i].longitude));
      }

      var polygon = new Tmapv3.Polygon({
        paths: paths,
        fillColor: fillColor || "#0066FF",
        fillOpacity: fillOpacity !== undefined ? fillOpacity : 0.4,
        strokeColor: strokeColor || "#0066FF",
        strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
        strokeWeight: strokeWidth || 2,
        map: map
      });

      polygons[polygonId] = polygon;
    }

    function addCircle(circleId, lat, lng, radius, fillColor, fillOpacity, strokeColor, strokeOpacity, strokeWidth, zIndex) {
      if (!map) return;

      if (circles[circleId]) {
        circles[circleId].setMap(null);
        delete circles[circleId];
      }

      var center = new Tmapv3.LatLng(lat, lng);
      var circle = new Tmapv3.Circle({
        center: center,
        radius: radius,
        fillColor: fillColor || "#FF0000",
        fillOpacity: fillOpacity !== undefined ? fillOpacity : 0.3,
        strokeColor: strokeColor || "#FF0000",
        strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
        strokeWeight: strokeWidth || 2,
        map: map
      });

      circles[circleId] = circle;
    }

    function addRectangle(rectangleId, swLat, swLng, neLat, neLng, fillColor, fillOpacity, strokeColor, strokeOpacity, strokeWidth, zIndex) {
      if (!map) return;

      if (rectangles[rectangleId]) {
        rectangles[rectangleId].setMap(null);
        delete rectangles[rectangleId];
      }

      var sw = new Tmapv3.LatLng(swLat, swLng);
      var ne = new Tmapv3.LatLng(neLat, neLng);
      var bounds = new Tmapv3.LatLngBounds();
      bounds.extend(sw);
      bounds.extend(ne);

      var rectangle = new Tmapv3.Rectangle({
        bounds: bounds,
        fillColor: fillColor || "#00AA00",
        fillOpacity: fillOpacity !== undefined ? fillOpacity : 0.3,
        strokeColor: strokeColor || "#00AA00",
        strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
        strokeWeight: strokeWidth || 2,
        map: map
      });

      rectangles[rectangleId] = rectangle;
    }

    function addCustomOverlay(customOverlayId, lat, lng, content, offsetX, offsetY, zIndex) {
      if (!map) return;

      if (customOverlays[customOverlayId]) {
        customOverlays[customOverlayId].setMap(null);
        delete customOverlays[customOverlayId];
      }

      var pos = new Tmapv3.LatLng(lat, lng);
      var options = {
        position: pos,
        content: content,
        type: 2,
        map: map
      };

      if (offsetX !== undefined && offsetY !== undefined && offsetX !== null && offsetY !== null) {
        options.offset = new Tmapv3.Point(offsetX, offsetY);
      }

      var overlay = new Tmapv3.InfoWindow(options);
      customOverlays[customOverlayId] = overlay;
    }
    ''';
  }
}
