var infoWindowListeners = {};
var customOverlayListeners = {};
var clusterMarkersList = [];
var clusterMarkerDragListeners = {};
var clusterGeneration = 0;
var clusterZoomBinding = null;

function addInfoWindow(infoWindowId, lat, lng, content, type, border, offsetX, offsetY, anchor, visible) {
  if (!map) return;

  if (infoWindowListeners[infoWindowId]) {
    try {
      if (infoWindowListeners[infoWindowId].element && infoWindowListeners[infoWindowId].handler) {
        infoWindowListeners[infoWindowId].element.removeEventListener("click", infoWindowListeners[infoWindowId].handler);
      }
    } catch (_) {}
    delete infoWindowListeners[infoWindowId];
  }

  if (infoWindows[infoWindowId]) {
    if (typeof infoWindows[infoWindowId].setMap === 'function') {
      infoWindows[infoWindowId].setMap(null);
    }
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

  var el = null;
  if (infoWindow && infoWindow._iw_data) {
    el = infoWindow._iw_data.contentDiv || (infoWindow._iw_data.htmlElement && typeof infoWindow._iw_data.htmlElement.getElement === 'function' ? infoWindow._iw_data.htmlElement.getElement() : null) || infoWindow._iw_data.containerElement;
  }
  if (!el && infoWindow && typeof infoWindow.getElement === 'function') {
    try { el = infoWindow.getElement(); } catch (_) {}
  }
  if (el && typeof el.addEventListener === 'function') {
    var handler = function(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (window.onInfoWindowTap) {
        var p = (infoWindow && typeof infoWindow.getPosition === 'function') ? infoWindow.getPosition() : pos;
        var curLat = latitudeOf(p);
        var curLng = longitudeOf(p);
        onInfoWindowTap.postMessage(JSON.stringify({
          infoWindowId: infoWindowId,
          id: infoWindowId,
          latitude: Number(curLat),
          longitude: Number(curLng)
        }));
      }
    };
    el.addEventListener("click", handler);
    el.onpointerdown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
    el.onmousedown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
    el.ontouchstart = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
    infoWindowListeners[infoWindowId] = { element: el, handler: handler };
  }

  infoWindows[infoWindowId] = infoWindow;
}

function clearInfoWindow(infoWindowId) {
  if (infoWindowListeners[infoWindowId]) {
    try {
      if (infoWindowListeners[infoWindowId].element && infoWindowListeners[infoWindowId].handler) {
        infoWindowListeners[infoWindowId].element.removeEventListener("click", infoWindowListeners[infoWindowId].handler);
      }
    } catch (_) {}
    delete infoWindowListeners[infoWindowId];
  }
  if (infoWindows && Object.prototype.hasOwnProperty.call(infoWindows, infoWindowId)) {
    if (infoWindows[infoWindowId] && typeof infoWindows[infoWindowId].setMap === 'function') {
      infoWindows[infoWindowId].setMap(null);
    }
    delete infoWindows[infoWindowId];
  }
}

function clearAllInfoWindows() {
  for (var id in infoWindowListeners) {
    if (Object.prototype.hasOwnProperty.call(infoWindowListeners, id)) {
      try {
        if (infoWindowListeners[id].element && infoWindowListeners[id].handler) {
          infoWindowListeners[id].element.removeEventListener("click", infoWindowListeners[id].handler);
        }
      } catch (_) {}
    }
  }
  infoWindowListeners = {};

  for (var id in infoWindows) {
    if (Object.prototype.hasOwnProperty.call(infoWindows, id)) {
      if (infoWindows[id] && typeof infoWindows[id].setMap === 'function') {
        infoWindows[id].setMap(null);
      }
    }
  }
  infoWindows = {};
}

function addLabel(labelId, lat, lng, content, fontSize, fontColor, minLevel, maxLevel) {
  if (!map) return;

  if (labels[labelId]) {
    if (typeof labels[labelId].setMap === 'function') {
      labels[labelId].setMap(null);
    }
    delete labels[labelId];
  }

  var pos = new Tmapv3.LatLng(lat, lng);
  var options = {
    position: pos,
    content: content || '',
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

  var label;
  try {
    if (typeof Tmapv3 !== 'undefined' && Tmapv3.Label) {
      label = new Tmapv3.Label(options);
    } else {
      label = new Tmapv3.InfoWindow({
        position: pos,
        content: '<div style="font-size:' + (fontSize || '14px') + ';color:' + (fontColor || '#000000') + ';">' + (content || '') + '</div>',
        type: 2,
        map: map
      });
    }
  } catch (_) {
    try {
      label = new Tmapv3.InfoWindow({
        position: pos,
        content: '<div style="font-size:' + (fontSize || '14px') + ';color:' + (fontColor || '#000000') + ';">' + (content || '') + '</div>',
        type: 2,
        map: map
      });
    } catch (_) {}
  }
  if (label) labels[labelId] = label;
}

function clearLabel(labelId) {
  if (labels && Object.prototype.hasOwnProperty.call(labels, labelId)) {
    if (labels[labelId] && typeof labels[labelId].setMap === 'function') {
      labels[labelId].setMap(null);
    }
    delete labels[labelId];
  }
}

function clearAllLabels() {
  for (var id in labels) {
    if (Object.prototype.hasOwnProperty.call(labels, id)) {
      if (labels[id] && typeof labels[id].setMap === 'function') {
        labels[id].setMap(null);
      }
    }
  }
  labels = {};
}

function addMarkerClusterer(markersData, maxClusterZoom, minClusterCount, gridSize, opacity, visible, icons) {
  if (!map) return;

  clusterGeneration++;
  clearMarkerClusterer();

  var currentGeneration = ++clusterGeneration;
  var currentInstance = null;
  var markerList = [];
  var markersMap = {};

  for (var i = 0; i < markersData.length; i++) {
    var m = markersData[i];
    var mId = m.markerId || m.id;
    var pos = new Tmapv3.LatLng(m.position ? m.position.latitude : m.lat, m.position ? m.position.longitude : m.lng);
    var mOptions = {
      position: pos,
      anchor: m.anchor || "bottom",
      opacity: m.opacity !== undefined ? m.opacity : 1,
      visible: m.visible !== undefined ? m.visible : true,
      draggable: false,
      zIndex: m.zIndex || 100
    };

    if (m.color) mOptions.color = m.color;
    if (m.title) mOptions.title = m.title;
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

    if (m.icon) {
      if (m.icon.iconUrl) mOptions.icon = m.icon.iconUrl;
      else if (m.icon.iconHtml) mOptions.iconHTML = m.icon.iconHtml;
      if (m.icon.size) mOptions.iconSize = new Tmapv3.Size(m.icon.size.width, m.icon.size.height);
      if (m.icon.offset) mOptions.offset = new Tmapv3.Point(m.icon.offset.x, m.icon.offset.y);
    } else {
      if (m.iconUrl) mOptions.icon = m.iconUrl;
      else if (m.iconHtml) mOptions.iconHTML = m.iconHtml;
      if (m.iconW != null && m.iconH != null) mOptions.iconSize = new Tmapv3.Size(m.iconW, m.iconH);
      if (m.offsetX !== undefined && m.offsetY !== undefined) mOptions.offset = new Tmapv3.Point(m.offsetX, m.offsetY);
    }

    var marker = new Tmapv3.Marker(mOptions);
    marker._customMarkerId = mId;

    (function(currentMarker, currentId, currentPos, isDraggable) {
      if (typeof currentMarker.on === 'function') {
        currentMarker.on("click", function() {
          if (currentGeneration !== clusterGeneration || !markerCluster) return;
          if (currentInstance && markerCluster !== currentInstance) return;
          if (window.onMarkerTap) {
            var p = (currentMarker.getPosition && typeof currentMarker.getPosition === 'function') ? currentMarker.getPosition() : currentPos;
            var lat = latitudeOf(p);
            var lng = longitudeOf(p);
            var zoom = (map && typeof map.getZoom === 'function') ? Math.round(map.getZoom()) : 16;
            onMarkerTap.postMessage(JSON.stringify({
              markerId: currentId,
              latitude: lat,
              longitude: lng,
              zoom: zoom
            }));
          }
        });
      }

      if (isDraggable && typeof bindTmapMarkerDrag === 'function') {
        try {
          clusterMarkerDragListeners[currentId] = bindTmapMarkerDrag(currentMarker, map, function(lat, lng, phase) {
            if (currentGeneration !== clusterGeneration || !markerCluster) return;
            if (currentInstance && markerCluster !== currentInstance) return;
            if (window.onMarkerDragChangeCallback) {
              onMarkerDragChangeCallback.postMessage(JSON.stringify({
                markerId: currentId,
                latitude: lat,
                longitude: lng,
                dragType: phase
              }));
            }
          });
        } catch (e) {
          console.error("Cluster marker drag bind error:", e);
        }
      }
    })(marker, mId, pos, m.draggable);

    markerList.push(marker);
    markersMap[mId] = marker;
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

  if (icons !== null && icons !== undefined) clusterOptions.icons = icons;

  clusterOptions.onClusterClick = function(cluster) {
    if (currentGeneration !== clusterGeneration || !markerCluster) return;
    if (currentInstance && markerCluster !== currentInstance) return;
    if (window.onMarkerClustererTap && cluster) {
      var center = cluster.center || (cluster.getCenter ? cluster.getCenter() : null) || (cluster.getPosition ? cluster.getPosition() : null) || cluster.position;
      var cLat = center ? latitudeOf(center) : 0;
      var cLng = center ? longitudeOf(center) : 0;
      var z = (map && typeof map.getZoom === 'function') ? Math.round(map.getZoom()) : 16;
      var mIds = [];
      var rawMarkers = (cluster.markers && Array.isArray(cluster.markers)) ? cluster.markers : (typeof cluster.getMarkers === 'function' ? cluster.getMarkers() : null);
      if (rawMarkers && Array.isArray(rawMarkers)) {
        for (var j = 0; j < rawMarkers.length; j++) {
          var cm = rawMarkers[j];
          var cid = cm ? (cm._customMarkerId || cm.markerId || cm.id) : null;
          if (cid != null && typeof cid === 'string' && cid.length > 0 && mIds.indexOf(cid) < 0) {
            mIds.push(cid);
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

  try {
    markerCluster = new Tmapv3.extension.MarkerCluster(clusterOptions);
    currentInstance = markerCluster;
    if (typeof tmapBridge !== 'undefined' && typeof tmapBridge.bindClusterZoomWatcher === 'function') {
      clusterZoomBinding = tmapBridge.bindClusterZoomWatcher({
        map: map,
        cluster: function() { return markerCluster; },
        maxClusterZoom: clusterOptions.maxClusterZoom,
        isAlive: function() {
          return currentGeneration === clusterGeneration &&
                 Boolean(markerCluster) &&
                 (!currentInstance || markerCluster === currentInstance);
        }
      });
    }
  } catch (e) {
    clusterGeneration++;
    markerCluster = null;
    currentInstance = null;
    if (clusterZoomBinding) {
      try { clusterZoomBinding.dispose(); } catch (_) {}
      clusterZoomBinding = null;
    }
    console.error("MarkerCluster creation error:", e);
  }
}

function clearMarkerClusterer() {
  clusterGeneration++;

  if (clusterZoomBinding) {
    try { clusterZoomBinding.dispose(); } catch (_) {}
    clusterZoomBinding = null;
  }

  if (clusterMarkerDragListeners) {
    for (var id in clusterMarkerDragListeners) {
      if (Object.prototype.hasOwnProperty.call(clusterMarkerDragListeners, id)) {
        try { clusterMarkerDragListeners[id].dispose(); } catch (_) {}
      }
    }
    clusterMarkerDragListeners = {};
  }

  if (markerCluster) {
    try {
      if (markerCluster.clearMarkers) markerCluster.clearMarkers();
      if (markerCluster.destroy) markerCluster.destroy();
    } catch (e) {
      console.error("clearMarkerClusterer error:", e);
    }
    markerCluster = null;
  }

  if (clusterMarkersList && clusterMarkersList.length > 0) {
    for (var i = 0; i < clusterMarkersList.length; i++) {
      try { clusterMarkersList[i].setMap(null); } catch (_) {}
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

  var options = {
    path: path,
    strokeColor: strokeColor || "#0066FF",
    strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
    strokeWeight: strokeWidth || 5,
    direction: direction || false,
    map: map
  };
  if (zIndex !== undefined) options.zIndex = zIndex;
  var polyline = new Tmapv3.Polyline(options);

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

  var options = {
    paths: paths,
    fillColor: fillColor || "#0066FF",
    fillOpacity: fillOpacity !== undefined ? fillOpacity : 0.4,
    strokeColor: strokeColor || "#0066FF",
    strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
    strokeWeight: strokeWidth || 2,
    map: map
  };
  if (zIndex !== undefined) options.zIndex = zIndex;
  var polygon = new Tmapv3.Polygon(options);

  polygons[polygonId] = polygon;
}

function addCircle(circleId, lat, lng, radius, fillColor, fillOpacity, strokeColor, strokeOpacity, strokeWidth, zIndex) {
  if (!map) return;

  if (circles[circleId]) {
    circles[circleId].setMap(null);
    delete circles[circleId];
  }

  var center = new Tmapv3.LatLng(lat, lng);
  var options = {
    center: center,
    radius: radius,
    fillColor: fillColor || "#FF0000",
    fillOpacity: fillOpacity !== undefined ? fillOpacity : 0.3,
    strokeColor: strokeColor || "#FF0000",
    strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
    strokeWeight: strokeWidth || 2,
    map: map
  };
  if (zIndex !== undefined) options.zIndex = zIndex;
  var circle = new Tmapv3.Circle(options);

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

  var options = {
    bounds: bounds,
    fillColor: fillColor || "#00AA00",
    fillOpacity: fillOpacity !== undefined ? fillOpacity : 0.3,
    strokeColor: strokeColor || "#00AA00",
    strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
    strokeWeight: strokeWidth || 2,
    map: map
  };
  if (zIndex !== undefined) options.zIndex = zIndex;
  var rectangle = new Tmapv3.Rectangle(options);

  rectangles[rectangleId] = rectangle;
}

function addCustomOverlay(customOverlayId, lat, lng, content, offsetX, offsetY, zIndex) {
  if (!map) return;

  if (customOverlayListeners[customOverlayId]) {
    try {
      if (customOverlayListeners[customOverlayId].element && customOverlayListeners[customOverlayId].handler) {
        customOverlayListeners[customOverlayId].element.removeEventListener("click", customOverlayListeners[customOverlayId].handler);
      }
    } catch (_) {}
    delete customOverlayListeners[customOverlayId];
  }

  if (customOverlays[customOverlayId]) {
    if (typeof customOverlays[customOverlayId].setMap === 'function') {
      customOverlays[customOverlayId].setMap(null);
    }
    delete customOverlays[customOverlayId];
  }

  var pos = new Tmapv3.LatLng(lat, lng);
  var options = {
    position: pos,
    content: content,
    type: 2,
    map: map,
    zIndex: zIndex !== undefined ? zIndex : 0
  };

  if (offsetX !== undefined && offsetY !== undefined && offsetX !== null && offsetY !== null) {
    options.offset = new Tmapv3.Point(offsetX, offsetY);
  }

  var overlay = null;
  try {
    if (typeof Tmapv3 !== 'undefined' && Tmapv3.CustomOverlay) {
      overlay = new Tmapv3.CustomOverlay(options);
    } else {
      overlay = new Tmapv3.InfoWindow(options);
    }
  } catch (_) {
    try {
      overlay = new Tmapv3.InfoWindow(options);
    } catch (_) {}
  }

  var el = null;
  if (overlay && overlay._iw_data) {
    el = overlay._iw_data.contentDiv || (overlay._iw_data.htmlElement && typeof overlay._iw_data.htmlElement.getElement === 'function' ? overlay._iw_data.htmlElement.getElement() : null) || overlay._iw_data.containerElement;
  }
  if (!el && overlay && typeof overlay.getElement === 'function') {
    try { el = overlay.getElement(); } catch (_) {}
  }
  if (el && typeof el.addEventListener === 'function') {
    var handler = function(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (window.onCustomOverlayTap) {
        var p = (overlay && typeof overlay.getPosition === 'function') ? overlay.getPosition() : pos;
        var curLat = latitudeOf(p);
        var curLng = longitudeOf(p);
        onCustomOverlayTap.postMessage(JSON.stringify({
          customOverlayId: customOverlayId,
          id: customOverlayId,
          latitude: Number(curLat),
          longitude: Number(curLng)
        }));
      }
    };
    el.addEventListener("click", handler);
    el.onpointerdown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
    el.onmousedown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
    el.ontouchstart = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
    customOverlayListeners[customOverlayId] = { element: el, handler: handler };
  }

  if (overlay) customOverlays[customOverlayId] = overlay;
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
  if (customOverlayListeners[id]) {
    try {
      if (customOverlayListeners[id].element && customOverlayListeners[id].handler) {
        customOverlayListeners[id].element.removeEventListener("click", customOverlayListeners[id].handler);
      }
    } catch (_) {}
    delete customOverlayListeners[id];
  }
  if (customOverlays && Object.prototype.hasOwnProperty.call(customOverlays, id)) {
    if (customOverlays[id] && typeof customOverlays[id].setMap === 'function') {
      customOverlays[id].setMap(null);
    }
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
  for (var id in customOverlayListeners) {
    if (Object.prototype.hasOwnProperty.call(customOverlayListeners, id)) {
      try {
        if (customOverlayListeners[id].element && customOverlayListeners[id].handler) {
          customOverlayListeners[id].element.removeEventListener("click", customOverlayListeners[id].handler);
        }
      } catch (_) {}
    }
  }
  customOverlayListeners = {};

  for (var id in customOverlays) {
    if (Object.prototype.hasOwnProperty.call(customOverlays, id)) {
      if (customOverlays[id] && typeof customOverlays[id].setMap === 'function') {
        customOverlays[id].setMap(null);
      }
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
