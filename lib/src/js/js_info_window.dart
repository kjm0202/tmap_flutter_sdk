/// InfoWindow 생성 및 제어를 위한 JavaScript 스크립트 생성기
class JsInfoWindow {
  static String getScript({required bool hasInfoWindowTapCallback}) {
    return '''
    function addInfoWindow(infoWindowId, lat, lng, content, type, border, offsetX, offsetY, anchor, visible) {
      if (!map) return;

      if (infoWindows[infoWindowId]) {
        infoWindows[infoWindowId].setMap(null);
        delete infoWindows[infoWindowId];
      }

      var pos = new Tmapv3.LatLng(lat, lng);
      var options = {
        position: pos,
        content: content,
        type: type || 2,
        anchor: anchor || "bottom",
        visible: visible !== undefined ? visible : true,
        map: map
      };

      if (border) {
        options.border = border;
      }

      if (offsetX !== undefined && offsetY !== undefined && offsetX !== null && offsetY !== null) {
        options.offset = new Tmapv3.Point(offsetX, offsetY);
      }

      var infoWindow = new Tmapv3.InfoWindow(options);
      infoWindows[infoWindowId] = infoWindow;
    }

    function clearInfoWindow(infoWindowId) {
      if (infoWindows[infoWindowId]) {
        infoWindows[infoWindowId].setMap(null);
        delete infoWindows[infoWindowId];
      }
    }

    function clearAllInfoWindows() {
      for (var id in infoWindows) {
        if (infoWindows.hasOwnProperty(id)) {
          infoWindows[id].setMap(null);
        }
      }
      infoWindows = {};
    }
    ''';
  }
}
