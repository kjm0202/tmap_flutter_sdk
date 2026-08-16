/// 좌표 변환 및 화면 유틸리티를 위한 JavaScript 스크립트 생성기
class JsUtils {
  static String getScript() {
    return '''
    function screenToReal(x, y) {
      if (map && map.screenToReal) {
        var pt = new Tmapv3.Point(x, y);
        var latLng = map.screenToReal(pt);
        return JSON.stringify({
          latitude: latLng.getLat ? latLng.getLat() : latLng._lat,
          longitude: latLng.getLng ? latLng.getLng() : latLng._lng
        });
      }
      return null;
    }

    function realToScreen(lat, lng) {
      if (map && map.realToScreen) {
        var pos = new Tmapv3.LatLng(lat, lng);
        var pt = map.realToScreen(pos);
        return JSON.stringify({
          x: pt.getX ? pt.getX() : pt.x,
          y: pt.getY ? pt.getY() : pt.y
        });
      }
      return null;
    }

    function getBoundsData() {
      if (map && map.getBounds) {
        var bnd = map.getBounds();
        var sw = bnd.getSouthWest ? bnd.getSouthWest() : bnd._sw;
        var ne = bnd.getNorthEast ? bnd.getNorthEast() : bnd._ne;
        return JSON.stringify({
          southWest: {
            latitude: sw.getLat ? sw.getLat() : sw._lat,
            longitude: sw.getLng ? sw.getLng() : sw._lng
          },
          northEast: {
            latitude: ne.getLat ? ne.getLat() : ne._lat,
            longitude: ne.getLng ? ne.getLng() : ne._lng
          }
        });
      }
      return null;
    }
    ''';
  }
}
