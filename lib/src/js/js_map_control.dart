/// 지도 조작(이동, 줌, 회전, 피치 등)을 위한 JavaScript 함수 생성기
class JsMapControl {
  static String getScript() {
    return '''
    function setCenter(lat, lng) {
      if (map) {
        var pos = new Tmapv3.LatLng(lat, lng);
        map.setCenter(pos);
      }
    }

    function setZoom(level) {
      if (map) {
        map.setZoom(level);
      }
    }

    function zoomIn() {
      if (map) {
        map.zoomIn();
      }
    }

    function zoomOut() {
      if (map) {
        map.zoomOut();
      }
    }

    function zoomToMaxExtent() {
      if (map && map.zoomToMaxExtent) {
        map.zoomToMaxExtent();
      }
    }

    function panTo(lat, lng) {
      if (map) {
        var pos = new Tmapv3.LatLng(lat, lng);
        map.panTo(pos);
      }
    }

    function panBy(x, y) {
      if (map) {
        map.panBy(x, y);
      }
    }

    function setBearing(bearing) {
      if (map && map.setBearing) {
        map.setBearing(bearing);
      }
    }

    function setPitch(pitch) {
      if (map && map.setPitch) {
        map.setPitch(pitch);
      }
    }

    function setMapType(type) {
      if (map && map.setMapType) {
        map.setMapType(type);
      }
    }

    function fitBounds(swLat, swLng, neLat, neLng, padding) {
      if (map) {
        var sw = new Tmapv3.LatLng(swLat, swLng);
        var ne = new Tmapv3.LatLng(neLat, neLng);
        var bounds = new Tmapv3.LatLngBounds();
        bounds.extend(sw);
        bounds.extend(ne);
        if (padding) {
          map.fitBounds(bounds, padding);
        } else {
          map.fitBounds(bounds);
        }
      }
    }

    function relayout() {
      if (map && map.resize) {
        map.resize();
      }
    }
    ''';
  }
}
