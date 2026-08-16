/// 마커 생성 및 제어를 위한 JavaScript 스크립트 생성기
class JsMarker {
  static String getScript({
    required bool hasMarkerTapCallback,
    required bool hasMarkerDragCallback,
  }) {
    return '''
    function addMarker(markerId, lat, lng, title, label, labelBg, labelColor, iconUrl, iconHtml, iconW, iconH, offsetX, offsetY, color, anchor, opacity, visible, draggable, zIndex) {
      if (!map) return;

      if (markers[markerId]) {
        markers[markerId].setMap(null);
        delete markers[markerId];
      }

      var pos = new Tmapv3.LatLng(lat, lng);
      var markerOptions = {
        position: pos,
        map: map,
        anchor: anchor || "bottom",
        opacity: opacity !== undefined ? opacity : 1,
        visible: visible !== undefined ? visible : true,
        draggable: draggable !== undefined ? draggable : false,
        zIndex: zIndex || 100
      };

      if (color) {
        markerOptions.color = color;
      }

      if (title) {
        markerOptions.title = title;
      }

      if (label) {
        markerOptions.label = label;
        if (labelBg || labelColor) {
          markerOptions.labelOption = {
            backgroundColor: labelBg || "#ffffff",
            color: labelColor || "#000000",
            fontSize: "13px",
            padding: "4px 8px",
            borderRadius: "4px"
          };
        }
      }

      if (iconUrl) {
        markerOptions.icon = iconUrl;
        if (iconW && iconH) {
          markerOptions.iconSize = new Tmapv3.Size(iconW, iconH);
        }
      } else if (iconHtml) {
        markerOptions.iconHTML = iconHtml;
        if (iconW && iconH) {
          markerOptions.iconSize = new Tmapv3.Size(iconW, iconH);
        }
      }

      if (offsetX !== undefined && offsetY !== undefined && offsetX !== null && offsetY !== null) {
        markerOptions.offset = new Tmapv3.Point(offsetX, offsetY);
      }

      var marker = new Tmapv3.Marker(markerOptions);
      markers[markerId] = marker;

      if ($hasMarkerTapCallback) {
        marker.on("click", function(evt) {
          if (window.onMarkerTap) {
            var p = marker.getPosition();
            var mLat = p.getLat ? p.getLat() : (p._lat || p.lat);
            var mLng = p.getLng ? p.getLng() : (p._lng || p.lng);
            var z = map.getZoom ? Math.round(map.getZoom()) : 16;
            onMarkerTap.postMessage(JSON.stringify({
              markerId: markerId,
              latitude: mLat,
              longitude: mLng,
              zoom: z
            }));
          }
        });
      }

      if ($hasMarkerDragCallback && draggable) {
        marker.on("dragstart", function(evt) {
          if (window.onMarkerDragChangeCallback) {
            var p = marker.getPosition();
            var mLat = p.getLat ? p.getLat() : (p._lat || p.lat);
            var mLng = p.getLng ? p.getLng() : (p._lng || p.lng);
            onMarkerDragChangeCallback.postMessage(JSON.stringify({
              markerId: markerId,
              latitude: mLat,
              longitude: mLng,
              dragType: "start"
            }));
          }
        });

        marker.on("dragend", function(evt) {
          if (window.onMarkerDragChangeCallback) {
            var p = marker.getPosition();
            var mLat = p.getLat ? p.getLat() : (p._lat || p.lat);
            var mLng = p.getLng ? p.getLng() : (p._lng || p.lng);
            onMarkerDragChangeCallback.postMessage(JSON.stringify({
              markerId: markerId,
              latitude: mLat,
              longitude: mLng,
              dragType: "end"
            }));
          }
        });
      }
    }

    function clearMarker(markerId) {
      if (markers[markerId]) {
        markers[markerId].setMap(null);
        delete markers[markerId];
      }
    }

    function clearAllMarkers() {
      for (var id in markers) {
        if (markers.hasOwnProperty(id)) {
          markers[id].setMap(null);
        }
      }
      markers = {};
    }
    ''';
  }
}
