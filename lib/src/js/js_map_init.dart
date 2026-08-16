import '../constants/map_type.dart';
import '../models/lat_lng.dart';

/// TMAP 초기화 및 지도 이벤트 리스너 스크립트 생성기
class JsMapInit {
  static String getScript({
    required LatLng? center,
    required int zoom,
    required int minZoom,
    required int maxZoom,
    required double bearing,
    required double pitch,
    required TMapType mapType,
    required bool naviControl,
    required bool scaleBar,
    required bool hasOnMapTap,
    required bool hasOnMapDoubleTap,
    required bool hasOnMapLongTap,
    required bool hasOnDragChangeCallback,
    required bool hasOnZoomChangeCallback,
    required bool hasOnCenterChangeCallback,
    required bool hasOnBoundsChangeCallback,
    required bool hasOnCameraIdle,
    required bool hasOnBearingChangeCallback,
    required bool hasOnPitchChangeCallback,
  }) {
    final centerLat = center?.latitude ?? 37.5665;
    final centerLng = center?.longitude ?? 126.9780;

    return '''
    window.onload = function() {
      waitForTmap(0);
    };

    function waitForTmap(retryCount) {
      if (typeof Tmapv3 !== 'undefined' && Tmapv3.Map) {
        try {
          initTmap();
        } catch (e) {
          console.error("initTmap error:", e);
        }
      } else if (retryCount < 60) {
        setTimeout(function() {
          waitForTmap(retryCount + 1);
        }, 100);
      } else {
        console.error("Tmapv3 SDK load timeout. Check your network or AppKey.");
      }
    }

    function initTmap() {
      defaultCenter = new Tmapv3.LatLng($centerLat, $centerLng);

      var options = {
        center: defaultCenter,
        zoom: $zoom,
        minZoom: $minZoom,
        maxZoom: $maxZoom,
        bearing: $bearing,
        pitch: $pitch,
        mapType: "${mapType.value}",
        naviControl: $naviControl,
        scaleBar: $scaleBar,
        width: "100%",
        height: "100%"
      };

      map = new Tmapv3.Map("map_div", options);

      try {
        tdata = new Tmapv3.extension.TData();
      } catch(e) {
        try {
          tdata = new Tmapv3.TData();
        } catch(e2) {}
      }

      map.on("ConfigLoad", function() {
        if (window.onMapCreated) {
          onMapCreated.postMessage("ready");
        }
      });

      if ($hasOnMapTap) {
        map.on("Click", function(evt) {
          if (window.onMapTap && evt && evt.data && evt.data.lngLat) {
            var lat = evt.data.lngLat.getLat ? evt.data.lngLat.getLat() : (evt.data.lngLat._lat || evt.data.lngLat.lat);
            var lng = evt.data.lngLat.getLng ? evt.data.lngLat.getLng() : (evt.data.lngLat._lng || evt.data.lngLat.lng);
            onMapTap.postMessage(JSON.stringify({
              latitude: lat,
              longitude: lng,
              zoom: map.getZoom ? map.getZoom() : $zoom
            }));
          }
        });
      }

      if ($hasOnMapLongTap) {
        map.on("ContextMenu", function(evt) {
          if (window.onMapLongTap && evt && evt.data && evt.data.lngLat) {
            var lat = evt.data.lngLat.getLat ? evt.data.lngLat.getLat() : (evt.data.lngLat._lat || evt.data.lngLat.lat);
            var lng = evt.data.lngLat.getLng ? evt.data.lngLat.getLng() : (evt.data.lngLat._lng || evt.data.lngLat.lng);
            onMapLongTap.postMessage(JSON.stringify({
              latitude: lat,
              longitude: lng,
              zoom: map.getZoom ? map.getZoom() : $zoom
            }));
          }
        });
      }

      if ($hasOnDragChangeCallback) {
        map.on("DragStart", function(evt) {
          if (window.dragStart) {
            var c = map.getCenter();
            var lat = c.getLat ? c.getLat() : (c._lat || c.lat);
            var lng = c.getLng ? c.getLng() : (c._lng || c.lng);
            dragStart.postMessage(JSON.stringify({
              latitude: lat,
              longitude: lng,
              zoom: map.getZoom ? map.getZoom() : $zoom
            }));
          }
        });

        map.on("DragEnd", function(evt) {
          if (window.dragEnd) {
            var c = map.getCenter();
            var lat = c.getLat ? c.getLat() : (c._lat || c.lat);
            var lng = c.getLng ? c.getLng() : (c._lng || c.lng);
            dragEnd.postMessage(JSON.stringify({
              latitude: lat,
              longitude: lng,
              zoom: map.getZoom ? map.getZoom() : $zoom
            }));
          }
        });
      }

      if ($hasOnZoomChangeCallback) {
        map.on("Zoom", function(evt) {
          if (window.zoomChanged) {
            var z = map.getZoom ? map.getZoom() : $zoom;
            zoomChanged.postMessage(JSON.stringify({ zoomLevel: Math.round(z) }));
          }
        });
      }

      if ($hasOnCameraIdle || $hasOnCenterChangeCallback || $hasOnBoundsChangeCallback || $hasOnBearingChangeCallback || $hasOnPitchChangeCallback) {
        map.on("DragEnd", function() {
          _notifyCameraState();
        });
        map.on("Zoom", function() {
          _notifyCameraState();
        });
      }
    }

    function _notifyCameraState() {
      if (!map) return;
      var c = map.getCenter();
      var lat = c.getLat ? c.getLat() : (c._lat || c.lat);
      var lng = c.getLng ? c.getLng() : (c._lng || c.lng);
      var z = map.getZoom ? Math.round(map.getZoom()) : $zoom;
      var b = map.getBearing ? map.getBearing() : 0;
      var p = map.getPitch ? map.getPitch() : 0;

      if ($hasOnCameraIdle && window.cameraIdle) {
        cameraIdle.postMessage(JSON.stringify({
          latitude: lat,
          longitude: lng,
          zoom: z,
          bearing: b,
          pitch: p
        }));
      }

      if ($hasOnCenterChangeCallback && window.centerChanged) {
        centerChanged.postMessage(JSON.stringify({
          latitude: lat,
          longitude: lng,
          zoom: z
        }));
      }

      if ($hasOnBearingChangeCallback && window.bearingChanged) {
        bearingChanged.postMessage(JSON.stringify({ bearing: b }));
      }

      if ($hasOnPitchChangeCallback && window.pitchChanged) {
        pitchChanged.postMessage(JSON.stringify({ pitch: p }));
      }

      if ($hasOnBoundsChangeCallback && window.boundsChanged) {
        var bnd = map.getBounds ? map.getBounds() : null;
        if (bnd) {
          var sw = bnd.getSouthWest ? bnd.getSouthWest() : (bnd._sw || null);
          var ne = bnd.getNorthEast ? bnd.getNorthEast() : (bnd._ne || null);
          if (sw && ne) {
            var swLat = sw.getLat ? sw.getLat() : (sw._lat || sw.lat);
            var swLng = sw.getLng ? sw.getLng() : (sw._lng || sw.lng);
            var neLat = ne.getLat ? ne.getLat() : (ne._lat || ne.lat);
            var neLng = ne.getLng ? ne.getLng() : (ne._lng || ne.lng);

            boundsChanged.postMessage(JSON.stringify({
              southWest: { latitude: swLat, longitude: swLng },
              northEast: { latitude: neLat, longitude: neLng }
            }));
          }
        }
      }
    }
    ''';
  }
}
