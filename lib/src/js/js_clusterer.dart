/// MarkerCluster 생성을 위한 JavaScript 스크립트 생성기
class JsClusterer {
  static String getScript({required bool hasMarkerClustererTapCallback}) {
    return '''
    var clusterMarkersList = [];

    function addMarkerClusterer(markersData, maxClusterZoom, minClusterCount, gridSize, opacity, visible) {
      if (!map) return;

      clearMarkerClusterer();

      var markerList = [];
      var markersMap = {};

      for (var i = 0; i < markersData.length; i++) {
        var m = markersData[i];
        var pos = new Tmapv3.LatLng(m.position.latitude, m.position.longitude);
        var mOptions = {
          position: pos,
          anchor: m.anchor || "bottom",
          opacity: m.opacity !== undefined ? m.opacity : 1,
          visible: m.visible !== undefined ? m.visible : true,
          draggable: m.draggable || false,
          zIndex: m.zIndex || 100
        };

        if (m.color) mOptions.color = m.color;
        if (m.label) {
          mOptions.label = m.label;
          if (m.labelBackgroundColor || m.labelTextColor) {
            mOptions.labelOption = {
              backgroundColor: m.labelBackgroundColor || "#ffffff",
              color: m.labelTextColor || "#000000",
              fontSize: "13px",
              padding: "4px 8px",
              borderRadius: "4px"
            };
          }
        }

        if (m.icon && m.icon.iconUrl) {
          mOptions.icon = m.icon.iconUrl;
          if (m.icon.size) {
            mOptions.iconSize = new Tmapv3.Size(m.icon.size.width, m.icon.size.height);
          }
        }

        var marker = new Tmapv3.Marker(mOptions);
        marker._customMarkerId = m.markerId;

        // 클러스터 내부 마커 탭 이벤트 연동
        (function(mid, mpos) {
          marker.on("click", function() {
            if (window.onMarkerTap) {
              var lat = mpos.getLat ? mpos.getLat() : mpos._lat;
              var lng = mpos.getLng ? mpos.getLng() : mpos._lng;
              var zoom = map.getZoom ? Math.round(map.getZoom()) : 16;
              onMarkerTap.postMessage(JSON.stringify({
                markerId: mid,
                latitude: lat,
                longitude: lng,
                zoom: zoom
              }));
            }
          });
        })(m.markerId, pos);

        markerList.push(marker);
        markersMap[m.markerId] = marker;
      }

      clusterMarkersList = markerList;

      var clusterOptions = {
        markers: markerList,
        map: map,
        maxClusterZoom: maxClusterZoom || 19,
        minClusterCount: minClusterCount || 2,
        gridSize: gridSize || 80,
        visible: visible !== undefined ? visible : true,
        opacity: opacity !== undefined ? opacity : 1
      };

      if ($hasMarkerClustererTapCallback) {
        clusterOptions.onClusterClick = function(cluster) {
          if (window.onMarkerClustererTap && cluster) {
            var cLat = cluster.center ? (cluster.center.getLat ? cluster.center.getLat() : cluster.center._lat) : 0;
            var cLng = cluster.center ? (cluster.center.getLng ? cluster.center.getLng() : cluster.center._lng) : 0;
            var z = map.getZoom ? Math.round(map.getZoom()) : 16;
            var mIds = [];
            if (cluster.markers) {
              for (var j = 0; j < cluster.markers.length; j++) {
                if (cluster.markers[j]._customMarkerId) {
                  mIds.push(cluster.markers[j]._customMarkerId);
                }
              }
            }
            onMarkerClustererTap.postMessage(JSON.stringify({
              latitude: cLat,
              longitude: cLng,
              zoom: z,
              markers: mIds
            }));
          }
        };
      }

      try {
        markerCluster = new Tmapv3.extension.MarkerCluster(clusterOptions);
      } catch (e) {
        console.error("MarkerCluster creation error:", e);
      }
    }

    function clearMarkerClusterer() {
      if (markerCluster) {
        try {
          if (markerCluster.clearMarkers) {
            markerCluster.clearMarkers();
          }
          if (markerCluster.destroy) {
            markerCluster.destroy();
          }
        } catch(e) {
          console.error("clearMarkerClusterer error:", e);
        }
        markerCluster = null;
      }

      if (clusterMarkersList && clusterMarkersList.length > 0) {
        for (var i = 0; i < clusterMarkersList.length; i++) {
          try {
            clusterMarkersList[i].setMap(null);
          } catch(e) {}
        }
        clusterMarkersList = [];
      }
    }
    ''';
  }
}
