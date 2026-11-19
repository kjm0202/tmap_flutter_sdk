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

function addLabel(labelId, lat, lng, content, fontSize, fontColor, minLevel, maxLevel) {
  if (!map) return;

  if (labels[labelId]) {
    labels[labelId].setMap(null);
    delete labels[labelId];
  }

  var pos = new Tmapv3.LatLng(lat, lng);
  var options = {
    position: pos,
    content: content,
    fontSize: fontSize || "14px",
    fontColor: fontColor || "#000000",
    map: map
  };

  if (minLevel !== undefined && minLevel !== null) {
    options.minLevel = minLevel;
  }
  if (maxLevel !== undefined && maxLevel !== null) {
    options.maxLevel = maxLevel;
  }

  var label = new Tmapv3.Label(options);
  labels[labelId] = label;
}

function clearLabel(labelId) {
  if (labels[labelId]) {
    labels[labelId].setMap(null);
    delete labels[labelId];
  }
}

function clearAllLabels() {
  for (var id in labels) {
    if (labels.hasOwnProperty(id)) {
      labels[id].setMap(null);
    }
  }
  labels = {};
}

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

  if (config.hasMarkerClustererTapCallback) {
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
