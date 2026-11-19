var map;
var markers = Object.create(null);
var infoWindows = {};
var labels = {};
var polylines = {};
var polygons = {};
var circles = {};
var rectangles = {};
var customOverlays = {};
var markerCluster = null;
var tdata = null;
var defaultCenter;

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
  defaultCenter = new Tmapv3.LatLng(config.centerLat, config.centerLng);

  var options = {
    center: defaultCenter,
    zoom: config.zoom,
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    bearing: config.bearing,
    pitch: config.pitch,
    mapType: config.mapType,
    naviControl: config.naviControl,
    scaleBar: config.scaleBar,
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

  if (config.hasOnMapTap) {
    map.on("Click", function(evt) {
      if (window.onMapTap && evt && evt.data && evt.data.lngLat) {
        var lat = latitudeOf(evt.data.lngLat);
        var lng = longitudeOf(evt.data.lngLat);
        onMapTap.postMessage(JSON.stringify({
          latitude: lat,
          longitude: lng,
          zoom: map.getZoom ? map.getZoom() : config.zoom
        }));
      }
    });
  }

  if (config.hasOnMapLongTap) {
    map.on("ContextMenu", function(evt) {
      if (window.onMapLongTap && evt && evt.data && evt.data.lngLat) {
        var lat = latitudeOf(evt.data.lngLat);
        var lng = longitudeOf(evt.data.lngLat);
        onMapLongTap.postMessage(JSON.stringify({
          latitude: lat,
          longitude: lng,
          zoom: map.getZoom ? map.getZoom() : config.zoom
        }));
      }
    });
  }

  if (config.hasOnDragChangeCallback) {
    map.on("DragStart", function(evt) {
      if (window.dragStart) {
        var c = map.getCenter();
        var lat = latitudeOf(c);
        var lng = longitudeOf(c);
        dragStart.postMessage(JSON.stringify({
          latitude: lat,
          longitude: lng,
          zoom: map.getZoom ? map.getZoom() : config.zoom
        }));
      }
    });

    map.on("DragEnd", function(evt) {
      if (window.dragEnd) {
        var c = map.getCenter();
        var lat = latitudeOf(c);
        var lng = longitudeOf(c);
        dragEnd.postMessage(JSON.stringify({
          latitude: lat,
          longitude: lng,
          zoom: map.getZoom ? map.getZoom() : config.zoom
        }));
      }
    });
  }

  if (config.hasOnZoomChangeCallback) {
    map.on("Zoom", function(evt) {
      if (window.zoomChanged) {
        var z = map.getZoom ? map.getZoom() : config.zoom;
        zoomChanged.postMessage(JSON.stringify({ zoomLevel: Math.round(z) }));
      }
    });
  }

  if (config.hasOnCameraIdle || config.hasOnCenterChangeCallback || config.hasOnBoundsChangeCallback || config.hasOnBearingChangeCallback || config.hasOnPitchChangeCallback) {
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
  var lat = latitudeOf(c);
  var lng = longitudeOf(c);
  var z = map.getZoom ? Math.round(map.getZoom()) : config.zoom;
  var b = map.getBearing ? map.getBearing() : 0;
  var p = map.getPitch ? map.getPitch() : 0;

  if (config.hasOnCameraIdle && window.cameraIdle) {
    cameraIdle.postMessage(JSON.stringify({
      latitude: lat,
      longitude: lng,
      zoom: z,
      bearing: b,
      pitch: p
    }));
  }

  if (config.hasOnCenterChangeCallback && window.centerChanged) {
    centerChanged.postMessage(JSON.stringify({
      latitude: lat,
      longitude: lng,
      zoom: z
    }));
  }

  if (config.hasOnBearingChangeCallback && window.bearingChanged) {
    bearingChanged.postMessage(JSON.stringify({ bearing: b }));
  }

  if (config.hasOnPitchChangeCallback && window.pitchChanged) {
    pitchChanged.postMessage(JSON.stringify({ pitch: p }));
  }

  if (config.hasOnBoundsChangeCallback && window.boundsChanged) {
    var bnd = map.getBounds ? map.getBounds() : null;
    if (bnd) {
      var sw = bnd.getSouthWest ? bnd.getSouthWest() : (bnd._sw || null);
      var ne = bnd.getNorthEast ? bnd.getNorthEast() : (bnd._ne || null);
      if (sw && ne) {
        var swLat = latitudeOf(sw);
        var swLng = longitudeOf(sw);
        var neLat = latitudeOf(ne);
        var neLng = longitudeOf(ne);

        boundsChanged.postMessage(JSON.stringify({
          southWest: { latitude: swLat, longitude: swLng },
          northEast: { latitude: neLat, longitude: neLng }
        }));
      }
    }
  }
}

function setCenter(lat, lng) {
  if (map) tmapBridge.setCenter(map, lat, lng);
}

function setZoom(level) {
  if (map) tmapBridge.setZoom(map, level);
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
  if (map) tmapBridge.panTo(map, lat, lng);
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

function screenToReal(x, y) {
  if (map && map.screenToReal) {
    var pt = new Tmapv3.Point(x, y);
    var latLng = map.screenToReal(pt);
    return JSON.stringify({
      latitude: latitudeOf(latLng),
      longitude: longitudeOf(latLng)
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
        latitude: latitudeOf(sw),
        longitude: longitudeOf(sw)
      },
      northEast: {
        latitude: latitudeOf(ne),
        longitude: longitudeOf(ne)
      }
    });
  }
  return null;
}

function addMarker(data) {
  if (!map) return;
  const callbacks = {};
  if (config.hasMarkerTapCallback) {
    callbacks.click = (markerId, latitude, longitude, zoom) =>
      onMarkerTap.postMessage(JSON.stringify({markerId, latitude, longitude, zoom}));
  }
  if (config.hasMarkerDragCallback && data.draggable) {
    for (const dragType of ['start', 'end']) {
      callbacks['drag' + dragType] = (markerId, latitude, longitude) =>
        onMarkerDragChangeCallback.postMessage(JSON.stringify({markerId, latitude, longitude, dragType}));
    }
  }
  tmapBridge.addMarker(map, markers, data, callbacks);
}

function clearMarker(id) {
  tmapBridge.clearMarker(markers, id);
}

function clearAllMarkers() {
  tmapBridge.clearAllMarkers(markers);
}
