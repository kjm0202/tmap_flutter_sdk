var map;
var markers = Object.create(null);
var infoWindows = {};
var labels = {};
var polylines = {};
var polygons = {};
var circles = {};
var rectangles = {};
var groundOverlays = {};
var drawingSession = null;
var customOverlays = {};
var markerCluster = null;
var tdata = null;
var defaultCenter;
var mapListeners = [];

window.tmap_dispose_mobile = function() {
  if (drawingSession) {
    drawingSession.dispose();
    drawingSession = null;
  }
  if (window.__tmapIosScrollGuardDispose) window.__tmapIosScrollGuardDispose();
  if (map && typeof tmapBridge !== 'undefined' && tmapBridge.disposeControls) {
    tmapBridge.disposeControls(map);
  }
  if (map && typeof tmapBridge !== 'undefined' && tmapBridge.traffic) {
    tmapBridge.traffic.dispose(map);
  }
  if (tdata && typeof tdata.destroy === 'function') {
      try { tdata.destroy(); } catch (_) {}
  }
  detachMapListeners();
  if (map && typeof map.destroy === 'function') {
      try { map.destroy(); } catch (_) {}
  }
};

window.addEventListener('pagehide', function() {
  window.tmap_dispose_mobile();
});

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
    minPitch: config.minPitch,
    maxPitch: config.maxPitch,
    mapType: config.mapType,
    naviControl: false,
    scaleBar: false,
    width: "100%",
    height: "100%"
  };
  function createLatLngBounds(data) {
    var sw = data.southWest;
    var ne = data.northEast;
    return new Tmapv3.LatLngBounds(
      new Tmapv3.LatLng(sw.latitude, sw.longitude),
      new Tmapv3.LatLng(ne.latitude, ne.longitude));
  }
  if (config.bounds) options.bounds = createLatLngBounds(config.bounds);
  if (config.maxBounds) options.maxBounds = createLatLngBounds(config.maxBounds);

  if (config.iosScrollableGuard) installIosScrollableGuard(document.getElementById("map_div"));
  map = new Tmapv3.Map("map_div", options);
  installAndroidTouchZoomRecovery(map, document.getElementById("map_div"), config.maxZoom);
  tmapBridge.applyNaviControl(map, config.naviControl ?? false);
  tmapBridge.applyScaleBar(map, config.scaleBar ?? false);

  map.__tmapTrafficLines = [];

  if (config.hasOnMapLongTap) {
    if (typeof map.vsmMap === 'function' && map.vsmMap() && typeof map.vsmMap().getInteractive === 'function') {
      map.setInteractive(Object.assign(map.vsmMap().getInteractive(), {longTap: true}));
    } else {
      map.setInteractive({longTap: true});
    }
  }

  if (typeof config !== 'undefined' && config.appKey) {
    map.__tmapAppKey = config.appKey;
  }
  if (config.minZoom != null || config.maxZoom != null) {
    if (typeof map.setZoomLimit === 'function') {
      map.setZoomLimit(config.minZoom ?? 0, config.maxZoom ?? 19);
    }
  }

  try {
    tdata = new Tmapv3.extension.TData();
  } catch(e) {
    try {
      tdata = new Tmapv3.TData();
    } catch(e2) {}
  }

  mapListeners = [];
  function bindMapEvent(eventName, handler) {
    if (!map || typeof map.on !== 'function') return;
    map.on(eventName, handler);
    mapListeners.push({ name: eventName, fn: handler });
  }

  var configLoaded = false;
  bindMapEvent("ConfigLoad", function() {
    if (configLoaded) return;
    configLoaded = true;
    if (config.bounds && typeof map.fitBounds === 'function') {
      map.fitBounds(createLatLngBounds(config.bounds));
    }
    if (window.onMapCreated) {
      onMapCreated.postMessage("ready");
    }
  });

  bindMapEvent("StyleLoad", function() {
    if (!map || !map.__tmapRestorePending) return;
    map.__tmapRestorePending = false;
    var collections = [polylines, polygons, circles, rectangles];
    collections.forEach(function(coll) {
      if (coll) {
        Object.keys(coll).forEach(function(id) {
          var item = coll[id];
          if (item && typeof item.getMap === 'function' && item.getMap() === map) {
            item.setMap(null);
            item.setMap(map);
          }
        });
      }
    });
    if (map.__tmapTrafficEnabled && typeof tmapBridge !== 'undefined' && tmapBridge.traffic) {
      tmapBridge.traffic.restoreTraffic(map);
    }
  });

  var lastLongTapTime = 0;
  var lastDoubleTapTime = 0;

  var hasOnMapTap = (typeof config !== 'undefined' && config.hasOnMapTap) || typeof onMapTap !== 'undefined';
  if (hasOnMapTap) {
    bindMapEvent("Click", function(evt) {
      if (!window.onMapTap) return;
      var now = Date.now();
      if (now - lastLongTapTime < 500) return;
      var coords = extractEventLatLng(evt);
      if (coords) {
        onMapTap.postMessage(JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          zoom: map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16)
        }));
      }
    });
  }

  var hasOnMapDoubleTap = (typeof config !== 'undefined' && (config.hasOnMapDoubleTap || config.hasMapDoubleTap)) || typeof onMapDoubleTap !== 'undefined';
  if (hasOnMapDoubleTap) {
    var handleDoubleTap = function(evt) {
      if (!window.onMapDoubleTap) return;
      var now = Date.now();
      if (now - lastDoubleTapTime < 400) return;
      lastDoubleTapTime = now;
      var coords = extractEventLatLng(evt);
      if (coords) {
        onMapDoubleTap.postMessage(JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          zoom: map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16)
        }));
      }
    };
    bindMapEvent("DoubleClick", handleDoubleTap);
    bindMapEvent("dblclick", handleDoubleTap);
  }

  var hasOnMapLongTap = (typeof config !== 'undefined' && config.hasOnMapLongTap) || typeof onMapLongTap !== 'undefined';
  if (hasOnMapLongTap) {
    var handleLongTap = function(evt) {
      if (!window.onMapLongTap) return;
      var now = Date.now();
      if (now - lastLongTapTime < 500) return;
      lastLongTapTime = now;
      var coords = extractEventLatLng(evt);
      if (coords) {
        onMapLongTap.postMessage(JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          zoom: map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16)
        }));
      }
    };
    bindMapEvent("ContextMenu", handleLongTap);
    bindMapEvent("LongTap", handleLongTap);
  }

  if (config.hasOnTouchStart) {
    bindMapEvent('TouchStart', function(event) {
      var coordinate = extractEventLatLng(event);
      if (coordinate && window.onTouchStart) {
        onTouchStart.postMessage(JSON.stringify({
          latitude: coordinate.lat, longitude: coordinate.lng
        }));
      }
    });
  }
  if (config.hasOnTouchEnd) {
    bindMapEvent('TouchEnd', function(event) {
      var coordinate = extractEventLatLng(event);
      if (coordinate && window.onTouchEnd) {
        onTouchEnd.postMessage(JSON.stringify({
          latitude: coordinate.lat, longitude: coordinate.lng
        }));
      }
    });
  }

  var hasDrag = (typeof config !== 'undefined' && config.hasOnDragChangeCallback) || typeof dragStart !== 'undefined' || typeof dragMove !== 'undefined' || typeof dragEnd !== 'undefined';
  if (hasDrag) {
    bindMapEvent("DragStart", function(evt) {
      if (window.dragStart && map) {
        var c = map.getCenter ? map.getCenter() : null;
        if (c) {
          dragStart.postMessage(JSON.stringify({
            latitude: latitudeOf(c),
            longitude: longitudeOf(c),
            zoom: map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16),
            phase: 'start'
          }));
        }
      }
    });

    bindMapEvent("Drag", function(evt) {
      if (window.dragMove && map) {
        var c = map.getCenter ? map.getCenter() : null;
        if (c) {
          dragMove.postMessage(JSON.stringify({
            latitude: latitudeOf(c),
            longitude: longitudeOf(c),
            zoom: map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16),
            phase: 'move'
          }));
        }
      }
    });

    bindMapEvent("DragEnd", function(evt) {
      if (window.dragEnd && map) {
        var c = map.getCenter ? map.getCenter() : null;
        if (c) {
          dragEnd.postMessage(JSON.stringify({
            latitude: latitudeOf(c),
            longitude: longitudeOf(c),
            zoom: map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16),
            phase: 'end'
          }));
        }
      }
      _notifyCenterAndBounds();
    });
  }

  var hasZoom = (typeof config !== 'undefined' && config.hasOnZoomChangeCallback) || typeof zoomChanged !== 'undefined';
  if (hasZoom) {
    var inZoom = false;
    bindMapEvent("ZoomStart", function(evt) {
      inZoom = true;
      if (window.zoomChanged && map) {
        var z = map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16);
        zoomChanged.postMessage(JSON.stringify({ zoomLevel: z, zoomType: 'start' }));
      }
    });

    bindMapEvent("Zoom", function(evt) {
      if (window.zoomChanged && map) {
        var z = map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16);
        if (!inZoom) {
          zoomChanged.postMessage(JSON.stringify({ zoomLevel: z, zoomType: 'end' }));
        }
      }
    });

    bindMapEvent("ZoomEnd", function(evt) {
      inZoom = false;
      if (window.zoomChanged && map) {
        var z = map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16);
        zoomChanged.postMessage(JSON.stringify({ zoomLevel: z, zoomType: 'end' }));
      }
      _notifyCenterAndBounds();
    });
  }

  var hasBearing = (typeof config !== 'undefined' && config.hasOnBearingChangeCallback) || typeof bearingChanged !== 'undefined';
  if (hasBearing) {
    bindMapEvent("Rotate", function() {
      _notifyBearing();
    });
  }

  var hasPitch = (typeof config !== 'undefined' && config.hasOnPitchChangeCallback) || typeof pitchChanged !== 'undefined';
  if (hasPitch) {
    bindMapEvent("Pitch", function() {
      _notifyPitch();
    });
  }

  bindMapEvent("MoveEnd", function() {
    _notifyCenterAndBounds();
  });

  bindMapEvent("Idle", function() {
    _notifyCenterAndBounds();
    _notifyCameraIdle();
  });
}

var lastNotifiedBearing = null;
function _notifyBearing() {
  if (!map || typeof map.getBearing !== 'function' || !window.bearingChanged) return;
  var b = map.getBearing();
  if (typeof b !== 'number' || isNaN(b) || b === lastNotifiedBearing) return;
  lastNotifiedBearing = b;
  bearingChanged.postMessage(JSON.stringify({ bearing: b }));
}

var lastNotifiedPitch = null;
function _notifyPitch() {
  if (!map || typeof map.getPitch !== 'function' || !window.pitchChanged) return;
  var p = map.getPitch();
  if (typeof p !== 'number' || isNaN(p) || p === lastNotifiedPitch) return;
  lastNotifiedPitch = p;
  pitchChanged.postMessage(JSON.stringify({ pitch: p }));
}

var lastNotifiedCenter = null;
var lastNotifiedBounds = null;
function _notifyCenterAndBounds() {
  if (!map) return;
  var c = map.getCenter ? map.getCenter() : null;
  if (c && window.centerChanged) {
    var lat = latitudeOf(c);
    var lng = longitudeOf(c);
    var z = map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16);
    if (!lastNotifiedCenter || lastNotifiedCenter.lat !== lat || lastNotifiedCenter.lng !== lng || lastNotifiedCenter.zoom !== z) {
      lastNotifiedCenter = { lat: lat, lng: lng, zoom: z };
      centerChanged.postMessage(JSON.stringify({
        latitude: lat,
        longitude: lng,
        zoom: z
      }));
    }
  }

  if (window.boundsChanged && map.getBounds) {
    var bnd = extractMapBounds(map);
    if (bnd) {
      if (!lastNotifiedBounds || lastNotifiedBounds.swLat !== bnd.swLat || lastNotifiedBounds.swLng !== bnd.swLng || lastNotifiedBounds.neLat !== bnd.neLat || lastNotifiedBounds.neLng !== bnd.neLng) {
        lastNotifiedBounds = bnd;
        boundsChanged.postMessage(JSON.stringify({
          southWest: { latitude: bnd.swLat, longitude: bnd.swLng },
          northEast: { latitude: bnd.neLat, longitude: bnd.neLng }
        }));
      }
    }
  }
}

function _notifyCameraIdle() {
  if (!map || !window.cameraIdle) return;
  var c = map.getCenter ? map.getCenter() : null;
  if (!c) return;
  var lat = latitudeOf(c);
  var lng = longitudeOf(c);
  var z = map.getZoom ? Math.round(map.getZoom()) : (config ? config.zoom : 16);
  var b = map.getBearing ? map.getBearing() : 0;
  var p = map.getPitch ? map.getPitch() : 0;

  cameraIdle.postMessage(JSON.stringify({
    latitude: lat,
    longitude: lng,
    zoom: z,
    bearing: b,
    pitch: p
  }));
}

function _notifyCameraState() {
  _notifyCenterAndBounds();
  _notifyBearing();
  _notifyPitch();
  _notifyCameraIdle();
}

function detachMapListeners() {
  if (map && typeof map.off === 'function') {
    for (var i = 0; i < mapListeners.length; i++) {
      try {
        map.off(mapListeners[i].name, mapListeners[i].fn);
      } catch (_) {}
    }
  }
  mapListeners = [];
}

function setCenter(lat, lng) {
  if (map) tmapBridge.setCenter(map, lat, lng);
}

function setZoom(level) {
  if (map) tmapBridge.setZoom(map, level);
}

function readMapData(name, args) {
  return tmapBridge.readMapData(map, name, args);
}

function setZoomLimit(minZoom, maxZoom) {
  tmapBridge.setZoomLimit(map, minZoom, maxZoom);
}

function convertProjection(method, args) {
  if (!map) throw new Error('Map is not initialized');
  return tmapBridge.convertProjection(method, args);
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
  if (map) tmapBridge.zoomToMaxExtent(map);
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
  if (map) tmapBridge.setMapType(map, type);
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
  if (map) tmapBridge.relayout(map);
}

function updateMapOptions(opts) {
  if (map) tmapBridge.updateMapOptions(map, opts);
}

function toggleTraffic(trafficOnOff) {
  if (map && typeof tmapBridge !== 'undefined' && tmapBridge.traffic) {
    tmapBridge.traffic.toggleTraffic(map, trafficOnOff, (typeof config !== 'undefined' && config.appKey) || "");
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

var markerDragListeners = {};

function addMarker(data) {
  if (!map) return;
  const callbacks = {};
  if (config.hasMarkerTapCallback || window.onMarkerTap) {
    callbacks.click = (markerId, latitude, longitude, zoom) => {
      if (window.onMarkerTap) {
        onMarkerTap.postMessage(JSON.stringify({markerId, latitude, longitude, zoom}));
      }
    };
  }
  for (const event of ['mouseenter', 'mouseleave']) {
    callbacks[event] = (markerId, latitude, longitude, zoom) => {
      if (window.onMarkerInteraction) {
        onMarkerInteraction.postMessage(JSON.stringify({markerId, latitude, longitude, zoom, event}));
      }
    };
  }
  if ((config.hasMarkerDragCallback || window.onMarkerDragChangeCallback) && data.draggable) {
    callbacks.drag = (markerId, latitude, longitude, dragType) => {
      if (window.onMarkerDragChangeCallback) {
        onMarkerDragChangeCallback.postMessage(JSON.stringify({markerId, latitude, longitude, dragType}));
      }
    };
  }
  tmapBridge.addMarker(map, markers, data, callbacks, markerDragListeners);
}

function clearMarker(id) {
  tmapBridge.clearMarker(markers, id, markerDragListeners);
}

function clearAllMarkers() {
  tmapBridge.clearAllMarkers(markers, markerDragListeners);
}

function installAndroidTouchZoomRecovery(map, container, maxZoom) {
  if (typeof navigator === 'undefined' || !navigator.userAgent.toLowerCase().includes('android')) return;
  if (typeof map.vsmMap !== 'function') return;
  var vsmMap = map.vsmMap();
  if (!container || !vsmMap) return;
  var canvas = vsmMap.getCanvas();
  var cam = vsmMap.getCamera();
  var ray = vsmMap.getTransform();
  var interactive = vsmMap.getInteractive();
  if (!interactive) return;

  var startingZoom = null;
  var pending = null;

  var clear = function() {
    startingZoom = null;
    pending = null;
  };

  map.on('ZoomStart', function() {
    pending = null;
    startingZoom = map.getZoom();
  });

  map.on('ZoomEnd', function() {
    if (pending && Math.abs(map.getZoom() - pending.start) < 0.001) {
      pending.ended = true;
    } else {
      pending = null;
    }
    startingZoom = null;
  });

  container.addEventListener('mousedown', function(e) {
    if (startingZoom !== null && cam.isMoving() && e.isTrusted && e.button === 0 && e.detail === 2 && e.target === canvas && e.sourceCapabilities?.firesTouchEvents === true) {
      var rect = canvas.getBoundingClientRect();
      pending = { start: startingZoom, x: e.clientX - rect.left, y: e.clientY - rect.top, ended: false, matched: false };
    } else {
      pending = null;
    }
  }, true);

  container.addEventListener('dblclick', function(e) {
    var rect = canvas.getBoundingClientRect();
    var curX = e.clientX - rect.left;
    var curY = e.clientY - rect.top;

    if (e.target === canvas && pending && pending.ended && Math.abs(curX - pending.x) < 5 && Math.abs(curY - pending.y) < 5 && e.sourceCapabilities?.firesTouchEvents === true) {
      pending.matched = true;
    } else {
      pending = null;
    }
  }, true);

  map.on('DoubleClick', function() {
    if (pending && pending.matched) {
      var scheduled = pending;
      requestAnimationFrame(function() {
        if (pending !== scheduled) return;
        pending = null;
        var interactive = vsmMap.getInteractive();
        if (!cam.isMoving() && Math.abs(map.getZoom() - scheduled.start) < 0.001 && interactive.zoom && interactive.touch && interactive.doubleClick) {
          var limit = Math.min(maxZoom, (typeof ray.getMaxZoom === 'function') ? ray.getMaxZoom() : maxZoom);
          if (limit > scheduled.start) {
            cam.easeTo({
              zoom: Math.min(scheduled.start + 1, limit),
              pivot: ray.screenPointToLngLat({ x: scheduled.x, y: scheduled.y })
            });
          }
        }
      });
    }
  });

  map.on('DragStart', clear);
  container.addEventListener('pointerdown', clear, true);
  container.addEventListener('wheel', clear, true);
  container.addEventListener('pointermove', clear, true);
  container.addEventListener('pointercancel', clear, true);
}

// Flutter's iOS platform view may deliver initial touch moves to WKWebView
// before the gesture arena rejects them. Only gate a single-finger canvas
// gesture while a scrollable ancestor can claim its axis.
function installIosScrollableGuard(container) {
  if (window.__tmapIosScrollGuardDispose) window.__tmapIosScrollGuardDispose();
  var pointers = new Set();
  var origin = null;
  var mode = null;
  var handlers = [];
  function listen(type, handler) {
    handlers.push([type, handler]);
    window.addEventListener(type, handler, true);
  }
  function canvasEvent(e) {
    return e.target && e.target.tagName === 'CANVAS' && container.contains(e.target);
  }
  function blockMove(e, x, y) {
    if (!e.isTrusted || !canvasEvent(e) || !origin || mode === 'multi' || mode === 'map') return;
    var axis = window.__tmapScrollGuardAxis;
    if (!axis) { mode = 'map'; return; }
    var dx = Math.abs(x - origin.x), dy = Math.abs(y - origin.y);
    if (mode === 'pending' && (dx > 0 || dy > 0)) {
      // Hold an ambiguous first movement until the direction is clear.
      if (Math.abs(dx - dy) < 1) { e.stopImmediatePropagation(); return; }
      var movementAxis = dy > dx ? 'vertical' : 'horizontal';
      mode = movementAxis === axis ? 'scroll' : 'map';
    }
    if (mode === 'scroll') e.stopImmediatePropagation();
  }
  listen('pointerdown', function(e) {
    if (!e.isTrusted || e.pointerType !== 'touch' || !canvasEvent(e)) return;
    if (e.isPrimary) {
      // A rejected WebKit sequence may never deliver pointerup/cancel.
      pointers.clear();
      origin = {x: e.clientX, y: e.clientY};
      mode = 'pending';
    } else {
      mode = 'multi';
    }
    pointers.add(e.pointerId);
    if (pointers.size > 1) mode = 'multi';
  });
  listen('pointermove', function(e) {
    if (e.pointerType === 'touch' && pointers.size === 1) blockMove(e, e.clientX, e.clientY);
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    // Keep multi-touch ownership until a new primary sequence begins.
    if (!pointers.size && mode !== 'multi') { origin = null; mode = null; }
  }
  listen('pointerup', endPointer);
  listen('pointercancel', endPointer);
  listen('touchstart', function(e) {
    if (!e.isTrusted || !canvasEvent(e)) return;
    if (e.touches.length > 1) mode = 'multi';
    else if (e.touches.length === 1 && !origin) {
      origin = {x: e.touches[0].clientX, y: e.touches[0].clientY};
      mode = 'pending';
    }
  });
  listen('touchmove', function(e) {
    if (e.touches.length === 1) blockMove(e, e.touches[0].clientX, e.touches[0].clientY);
  });
  listen('touchend', function(e) {
    if (!e.touches.length && mode !== 'multi') { origin = null; mode = null; }
  });
  listen('touchcancel', function(e) {
    if (!e.touches.length) { pointers.clear(); origin = null; mode = null; }
    else mode = 'multi';
  });
  window.__tmapIosScrollGuardDispose = function() {
    handlers.forEach(function(entry) { window.removeEventListener(entry[0], entry[1], true); });
    handlers = [];
    pointers.clear();
    origin = null;
    mode = null;
    window.__tmapIosScrollGuardDispose = null;
  };
}
