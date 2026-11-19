(function() {
  window.tmap_instances = window.tmap_instances || {};

  const pendingStarts = new Map();

  function setLongTap(map, enabled) {
    if (map && typeof map.vsmMap === 'function' && typeof map.setInteractive === 'function') {
      var vsm = map.vsmMap();
      if (vsm && typeof vsm.getInteractive === 'function') {
        var interactive = vsm.getInteractive() || {};
        var newInteractive = Object.assign({}, interactive, { longTap: !!enabled });
        map.setInteractive(newInteractive);
      }
    }
  }

  window.tmap_init = function(viewId, containerId, options, callbacks) {
    var maxAttempts = 30;
    function retry() {
      pendingStarts.set(viewId, setTimeout(tryInit, 100));
    }
    var tryInit = function() {
      pendingStarts.delete(viewId);
      var container = document.getElementById(containerId);
      if (!container || (container.offsetWidth === 0 && container.offsetHeight === 0)) {
        if (maxAttempts-- > 0) {
          retry();
          return;
        } else {
          console.warn("[tmap_web_bridge] Container element has 0 size, attempting map creation anyway:", containerId);
        }
        if (!container) {
          callbacks.onInitError();
          return;
        }
      }

      if (typeof Tmapv3 === 'undefined' || !Tmapv3.Map) {
        if (maxAttempts-- > 0) {
          retry();
        } else {
          callbacks.onInitError();
          console.error("[tmap_web_bridge] Tmapv3 SDK not loaded!");
        }
        return;
      }

      try {
        var center = (options.center && options.center.length >= 2)
            ? new Tmapv3.LatLng(options.center[0], options.center[1])
            : new Tmapv3.LatLng(37.5665, 126.9780);

        var mapOptions = {
          center: center,
          zoom: options.zoom ?? 16,
          width: "100%",
          height: "100%",
          naviControl: false,
          scaleBar: false
        };

        if (options.minZoom != null) mapOptions.minZoom = options.minZoom;
        if (options.maxZoom != null) mapOptions.maxZoom = options.maxZoom;
        if (options.bearing !== undefined) mapOptions.bearing = options.bearing;
        if (options.pitch !== undefined) mapOptions.pitch = options.pitch;

        var typeStr = (options.mapType || 'ROAD').toUpperCase();
        mapOptions.mapType = typeStr;

        console.log("[tmap_web_bridge] Creating Tmapv3.Map on container:", containerId);
        var map = new Tmapv3.Map(containerId, mapOptions);
        
        tmapBridge.applyNaviControl(map, options.naviControl ?? false);
        tmapBridge.applyScaleBar(map, options.scaleBar ?? false);
        if (options.hasOnMapLongTap === true) setLongTap(map, true);

        map.__tmapTrafficLines = [];
        if (options.appKey) map.__tmapAppKey = options.appKey;
        if (options.minZoom != null || options.maxZoom != null) {
          if (typeof map.setZoomLimit === 'function') {
            map.setZoomLimit(options.minZoom ?? 0, options.maxZoom ?? 19);
          }
        }

        var state = {
          map: map,
          markers: Object.create(null),
          markerDragListeners: {},
          clusterDragListeners: {},
          infoWindows: {},
          infoWindowListeners: {},
          labels: {},
          customOverlays: {},
          customOverlayListeners: {},
          polylines: {},
          polygons: {},
          circles: {},
          rectangles: {},
          clusterer: null,
          clusterGeneration: 0,
          clusterMarkersList: [],
          clusterZoomBinding: null,
          callbacks: callbacks || {}
        };

        window.tmap_instances[viewId] = state;

        state.listeners = [];
        state.disposed = false;
        function addListener(name, fn) {
          if (!map || typeof map.on !== 'function') return;
          map.on(name, fn);
          state.listeners.push({ name: name, fn: fn });
        }

        function getCb(name, altName) {
          if (!state.callbacks) return null;
          return state.callbacks[name] || (altName ? state.callbacks[altName] : null);
        }

        if (map && typeof map.on === 'function') {
          let ready = false;
          addListener("ConfigLoad", function() {
            if (state.disposed || ready) return;
            var cb = getCb("onMapCreated");
            if (cb) {
              ready = true;
              cb(viewId);
            }
          });

          addListener("StyleLoad", function() {
            if (!map || !map.__tmapRestorePending) return;
            map.__tmapRestorePending = false;
            var collections = [
              state.polylines,
              state.polygons,
              state.circles,
              state.rectangles
            ];
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

          // Single Tap: onMapTap(lat, lng)
          addListener("Click", function(e) {
            if (state.disposed) return;
            var now = Date.now();
            if (now - lastLongTapTime < 500) return; // Dedupe long tap release click
            var cb = getCb("onMapTap");
            if (!cb) return;
            var coords = extractEventLatLng(e);
            if (coords) {
              cb(coords.lat, coords.lng);
            }
          });

          // Double Tap: onMapDoubleTap(lat, lng)
          var handleDoubleTap = function(e) {
            if (state.disposed) return;
            var now = Date.now();
            if (now - lastDoubleTapTime < 400) return;
            lastDoubleTapTime = now;
            var cb = getCb("onMapDoubleTap");
            if (!cb) return;
            var coords = extractEventLatLng(e);
            if (coords) {
              cb(coords.lat, coords.lng);
            }
          };
          addListener("DoubleClick", handleDoubleTap);
          addListener("dblclick", handleDoubleTap);

          // Long Tap: onMapLongTap(lat, lng)
          var handleLongTap = function(e) {
            if (state.disposed) return;
            var now = Date.now();
            if (now - lastLongTapTime < 500) return;
            lastLongTapTime = now;
            var cb = getCb("onMapLongTap");
            if (!cb) return;
            var coords = extractEventLatLng(e);
            if (coords) {
              cb(coords.lat, coords.lng);
            }
          };
          addListener("ContextMenu", handleLongTap);
          addListener("LongTap", handleLongTap);

          // Drag: onDragChange(lat, lng, zoom, phase)
          function notifyDrag(phase) {
            if (state.disposed || !map) return;
            var cb = getCb("onDragChange", "onDragChangeCallback");
            if (!cb) return;
            var c = map.getCenter ? map.getCenter() : null;
            if (c) {
              var z = map.getZoom ? Math.round(map.getZoom()) : (options.zoom ?? 16);
              cb(latitudeOf(c), longitudeOf(c), z, phase);
            }
          }
          addListener("DragStart", function() { notifyDrag("start"); });
          addListener("Drag", function() { notifyDrag("move"); });
          addListener("DragEnd", function() {
            notifyDrag("end");
            notifyCenterAndBounds();
          });

          // Zoom: onZoomChange(zoom, phase)
          var inZoom = false;
          addListener("ZoomStart", function() {
            inZoom = true;
            if (state.disposed || !map) return;
            var cb = getCb("onZoomChange", "onZoomChangeCallback");
            if (cb) {
              var z = map.getZoom ? Math.round(map.getZoom()) : (options.zoom ?? 16);
              cb(z, "start");
            }
          });
          addListener("Zoom", function() {
            if (state.disposed || !map) return;
            var cb = getCb("onZoomChange", "onZoomChangeCallback");
            if (cb) {
              var z = map.getZoom ? Math.round(map.getZoom()) : (options.zoom ?? 16);
              cb(z, inZoom ? "move" : "end");
            }
          });
          addListener("ZoomEnd", function() {
            inZoom = false;
            if (state.disposed || !map) return;
            var cb = getCb("onZoomChange", "onZoomChangeCallback");
            if (cb) {
              var z = map.getZoom ? Math.round(map.getZoom()) : (options.zoom ?? 16);
              cb(z, "end");
            }
            notifyCenterAndBounds();
          });

          // Bearing: onBearingChange(value)
          var lastBearing = null;
          function notifyBearing() {
            if (state.disposed || !map || typeof map.getBearing !== 'function') return;
            var cb = getCb("onBearingChange", "onBearingChangeCallback");
            if (!cb) return;
            var b = map.getBearing();
            if (typeof b !== 'number' || isNaN(b) || b === lastBearing) return;
            lastBearing = b;
            cb(b);
          }
          addListener("Rotate", notifyBearing);

          // Pitch: onPitchChange(value)
          var lastPitch = null;
          function notifyPitch() {
            if (state.disposed || !map || typeof map.getPitch !== 'function') return;
            var cb = getCb("onPitchChange", "onPitchChangeCallback");
            if (!cb) return;
            var p = map.getPitch();
            if (typeof p !== 'number' || isNaN(p) || p === lastPitch) return;
            lastPitch = p;
            cb(p);
          }
          addListener("Pitch", notifyPitch);

          // Center & Bounds deduplication & notification
          var lastCenter = null;
          var lastBounds = null;
          function notifyCenterAndBounds() {
            if (state.disposed || !map) return;
            var centerCb = getCb("onCenterChange", "onCenterChangeCallback");
            if (centerCb && map.getCenter) {
              var c = map.getCenter();
              if (c) {
                var lat = latitudeOf(c);
                var lng = longitudeOf(c);
                var z = map.getZoom ? Math.round(map.getZoom()) : (options.zoom ?? 16);
                if (!lastCenter || lastCenter.lat !== lat || lastCenter.lng !== lng || lastCenter.zoom !== z) {
                  lastCenter = { lat: lat, lng: lng, zoom: z };
                  centerCb(lat, lng, z);
                }
              }
            }

            var boundsCb = getCb("onBoundsChange", "onBoundsChangeCallback");
            if (boundsCb && map.getBounds) {
              var bnd = extractMapBounds(map);
              if (bnd) {
                if (!lastBounds || lastBounds.swLat !== bnd.swLat || lastBounds.swLng !== bnd.swLng || lastBounds.neLat !== bnd.neLat || lastBounds.neLng !== bnd.neLng) {
                  lastBounds = bnd;
                  boundsCb(bnd.swLat, bnd.swLng, bnd.neLat, bnd.neLng);
                }
              }
            }
          }

          addListener("MoveEnd", function() {
            notifyCenterAndBounds();
          });

          // Camera Idle: onCameraIdle(lat, lng, zoom, bearing, pitch)
          addListener("Idle", function() {
            if (state.disposed || !map) return;
            notifyCenterAndBounds();
            var idleCb = getCb("onCameraIdle");
            if (idleCb && map.getCenter) {
              var c = map.getCenter();
              if (c) {
                var z = map.getZoom ? Math.round(map.getZoom()) : (options.zoom ?? 16);
                var b = map.getBearing ? map.getBearing() : 0;
                var p = map.getPitch ? map.getPitch() : 0;
                idleCb(latitudeOf(c), longitudeOf(c), z, b, p);
              }
            }
          });
        }

        console.log("[tmap_web_bridge] Tmapv3.Map successfully created for viewId:", viewId);

      } catch (err) {
        var errText = "" + (err ? (err.stack || err.message || err.toString()) : "unknown error");
        callbacks.onInitError();
        console.error("[tmap_web_bridge] Failed to initialize Tmapv3.Map:", errText);
      }
    };
    tryInit();
  };

  window.tmap_setCenter = function(viewId, lat, lng) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      tmapBridge.setCenter(state.map, lat, lng);
    }
  };

  window.tmap_setZoom = function(viewId, zoom) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      tmapBridge.setZoom(state.map, zoom);
    }
  };

  window.tmap_zoomIn = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      state.map.setZoom(state.map.getZoom() + 1);
    }
  };

  window.tmap_zoomOut = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      state.map.setZoom(state.map.getZoom() - 1);
    }
  };

  window.tmap_panTo = function(viewId, lat, lng) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      tmapBridge.panTo(state.map, lat, lng);
    }
  };

  window.tmap_panBy = function(viewId, x, y) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      state.map.panBy(x, y);
    }
  };

  window.tmap_setBearing = function(viewId, bearing) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      state.map.setBearing(bearing);
    }
  };

  window.tmap_setPitch = function(viewId, pitch) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      state.map.setPitch(pitch);
    }
  };

  window.tmap_setMapType = function(viewId, typeStr) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      tmapBridge.setMapType(state.map, typeStr);
    }
  };

  window.tmap_zoomToMaxExtent = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      tmapBridge.zoomToMaxExtent(state.map);
    }
  };

  window.tmap_relayout = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      tmapBridge.relayout(state.map);
    }
  };

  window.tmap_updateMapOptions = function(viewId, opts) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      if (Object.prototype.hasOwnProperty.call(opts, "longTap")) {
        setLongTap(state.map, opts.longTap);

      }
      tmapBridge.updateMapOptions(state.map, opts);
    }
  };

  window.tmap_fitBounds = function(viewId, swLat, swLng, neLat, neLng, padding) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      var sw = new Tmapv3.LatLng(swLat, swLng);
      var ne = new Tmapv3.LatLng(neLat, neLng);
      var bounds = new Tmapv3.LatLngBounds(sw, ne);
      state.map.fitBounds(bounds, padding || 0);
    }
  };

  // 마커 추가
  window.tmap_addMarker = function(viewId, m) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    state.markerDragListeners = state.markerDragListeners || {};
    tmapBridge.addMarker(state.map, state.markers, m, {
      click: state.callbacks.onMarkerTap,
      drag: state.callbacks.onMarkerDrag || state.callbacks.onMarkerDragChangeCallback
    }, state.markerDragListeners);
  };

  window.tmap_clearMarker = function(viewId, id) {
    const state = window.tmap_instances[viewId];
    if (state) tmapBridge.clearMarker(state.markers, id, state.markerDragListeners);
  };

  window.tmap_clearAllMarkers = function(viewId) {
    const state = window.tmap_instances[viewId];
    if (state) tmapBridge.clearAllMarkers(state.markers, state.markerDragListeners);
  };

  function _clearWebClusterDragListeners(state) {
    if (state && state.clusterDragListeners) {
      for (var id in state.clusterDragListeners) {
        if (Object.prototype.hasOwnProperty.call(state.clusterDragListeners, id)) {
          try { state.clusterDragListeners[id].dispose(); } catch (_) {}
        }
      }
      state.clusterDragListeners = {};
    }
  }

  // 클러스터러
  window.tmap_addClusterer = function(viewId, clusterData) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    state.clusterGeneration = (state.clusterGeneration || 0) + 1;
    window.tmap_clearClusterer(viewId);
    state.clusterDragListeners = state.clusterDragListeners || {};

    var currentGeneration = ++state.clusterGeneration;
    var currentClusterer = null;

    var markers = (clusterData.markers || []).map(function(m) {
      var id = m.markerId || m.id;
      var pos = new Tmapv3.LatLng(m.position ? m.position.latitude : m.lat, m.position ? m.position.longitude : m.lng);
      var mOptions = {
        position: pos,
        anchor: m.anchor || "bottom",
        opacity: m.opacity !== undefined ? m.opacity : 1.0,
        visible: m.visible !== false,
        draggable: false,
        zIndex: m.zIndex !== undefined ? m.zIndex : 100
      };
      if (m.title) mOptions.title = m.title;
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
      marker._customMarkerId = id;

      if (typeof marker.on === 'function') {
        marker.on("click", function() {
          if (state.disposed || !state.clusterer || currentGeneration !== state.clusterGeneration) return;
          if (currentClusterer && state.clusterer !== currentClusterer) return;
          if (state.callbacks && state.callbacks.onMarkerTap) {
            var curPos = marker.getPosition ? marker.getPosition() : pos;
            var lat = latitudeOf(curPos);
            var lng = longitudeOf(curPos);
            var zoom = (state.map && typeof state.map.getZoom === 'function') ? Math.round(state.map.getZoom()) : 16;
            state.callbacks.onMarkerTap(id, lat, lng, zoom);
          }
        });
      }

      if (m.draggable && typeof bindTmapMarkerDrag === 'function') {
        try {
          state.clusterDragListeners[id] = bindTmapMarkerDrag(marker, state.map, function(lat, lng, phase) {
            if (state.disposed || !state.clusterer || currentGeneration !== state.clusterGeneration) return;
            if (currentClusterer && state.clusterer !== currentClusterer) return;
            var dragCb = state.callbacks.onMarkerDrag || state.callbacks.onMarkerDragChangeCallback;
            if (dragCb) dragCb(id, lat, lng, phase);
          });
        } catch (_) {}
      }

      return marker;
    });

    state.clusterMarkersList = markers;

    var clusterOptions = {
      markers: markers,
      map: state.map,
      maxClusterZoom: clusterData.maxClusterZoom || clusterData.maxZoom || 17,
      minClusterCount: clusterData.minClusterCount || clusterData.minClusterSize || 2,
      gridSize: clusterData.gridSize || 60,
      visible: clusterData.visible !== false,
      opacity: clusterData.opacity !== undefined ? clusterData.opacity : 1.0
    };

    if (clusterData.icons) clusterOptions.icons = clusterData.icons;

    clusterOptions.onClusterClick = function(cluster) {
      if (state.disposed || !cluster || !state.callbacks || !state.clusterer || currentGeneration !== state.clusterGeneration) return;
      if (currentClusterer && state.clusterer !== currentClusterer) return;
      var center = cluster.center || (cluster.getCenter ? cluster.getCenter() : null) || (cluster.getPosition ? cluster.getPosition() : null) || cluster.position;
      var cLat = center ? latitudeOf(center) : 0;
      var cLng = center ? longitudeOf(center) : 0;
      var zoom = (state.map && typeof state.map.getZoom === 'function') ? Math.round(state.map.getZoom()) : 16;
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
      var cb = state.callbacks.onMarkerClustererTap || (state.callbacks.onClusterClick ? state.callbacks.onClusterClick : null);
      if (cb) {
        cb(cLat, cLng, zoom, mIds);
      }
    };

    try {
      if (typeof Tmapv3 !== 'undefined' && Tmapv3.extension && Tmapv3.extension.MarkerCluster) {
        state.clusterer = new Tmapv3.extension.MarkerCluster(clusterOptions);
        currentClusterer = state.clusterer;
        if (typeof tmapBridge !== 'undefined' && typeof tmapBridge.bindClusterZoomWatcher === 'function') {
          state.clusterZoomBinding = tmapBridge.bindClusterZoomWatcher({
            map: state.map,
            cluster: function() { return state.clusterer; },
            maxClusterZoom: clusterOptions.maxClusterZoom,
            isAlive: function() {
              return !state.disposed &&
                     Boolean(state.clusterer) &&
                     state.clusterGeneration === currentGeneration &&
                     (!currentClusterer || state.clusterer === currentClusterer);
            }
          });
        }
      }
    } catch (e) {
      state.clusterGeneration = (state.clusterGeneration || 0) + 1;
      state.clusterer = null;
      currentClusterer = null;
      if (state.clusterZoomBinding) {
        try { state.clusterZoomBinding.dispose(); } catch (_) {}
        state.clusterZoomBinding = null;
      }
      console.error("[tmap_web_bridge] MarkerCluster creation error:", e);
    }
  };

  window.tmap_clearClusterer = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      state.clusterGeneration = (state.clusterGeneration || 0) + 1;
      if (state.clusterZoomBinding) {
        try { state.clusterZoomBinding.dispose(); } catch (_) {}
        state.clusterZoomBinding = null;
      }
      _clearWebClusterDragListeners(state);
      if (state.clusterer) {
        try {
          if (typeof state.clusterer.clearMarkers === 'function') state.clusterer.clearMarkers();
          if (typeof state.clusterer.destroy === 'function') state.clusterer.destroy();
        } catch (_) {}
        state.clusterer = null;
      }
      if (state.clusterMarkersList && state.clusterMarkersList.length > 0) {
        for (var i = 0; i < state.clusterMarkersList.length; i++) {
          try { state.clusterMarkersList[i].setMap(null); } catch (_) {}
        }
        state.clusterMarkersList = [];
      }
    }
  };

  function _removeWebInfoWindowClick(state, id) {
    if (state && state.infoWindowListeners && Object.prototype.hasOwnProperty.call(state.infoWindowListeners, id)) {
      var listener = state.infoWindowListeners[id];
      if (listener && listener.el && listener.handler && typeof listener.el.removeEventListener === 'function') {
        try { listener.el.removeEventListener("click", listener.handler); } catch (_) {}
      }
      delete state.infoWindowListeners[id];
    }
  }

  // 인포윈도우
  window.tmap_addInfoWindow = function(viewId, iw) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    var data = (typeof iw === 'object' && iw !== null) ? iw : {
      id: arguments[1],
      lat: arguments[2],
      lng: arguments[3],
      content: arguments[4],
      type: arguments[5],
      border: arguments[6],
      offsetX: arguments[7],
      offsetY: arguments[8],
      anchor: arguments[9],
      visible: arguments[10]
    };

    _removeWebInfoWindowClick(state, data.id);

    if (state.infoWindows && Object.prototype.hasOwnProperty.call(state.infoWindows, data.id)) {
      if (state.infoWindows[data.id] && typeof state.infoWindows[data.id].setMap === 'function') {
        state.infoWindows[data.id].setMap(null);
      }
      delete state.infoWindows[data.id];
    }

    var pos = new Tmapv3.LatLng(data.lat, data.lng);
    var options = {
      position: pos,
      content: data.content,
      type: data.type !== undefined ? data.type : 1,
      map: state.map,
      visible: data.visible !== false
    };

    if (data.border) {
      options.border = data.border;
    }

    if (data.anchor) {
      options.anchor = data.anchor;
    }

    if (data.offsetX !== undefined && data.offsetY !== undefined && data.offsetX !== null && data.offsetY !== null) {
      options.offset = new Tmapv3.Point(data.offsetX, data.offsetY);
    }

    var infoWindow = null;
    try {
      if (typeof Tmapv3 !== 'undefined' && Tmapv3.InfoWindow) {
        infoWindow = new Tmapv3.InfoWindow(options);
      }
    } catch (_) {}

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
        if (state.callbacks && state.callbacks.onInfoWindowTap) {
          var p = (infoWindow && typeof infoWindow.getPosition === 'function') ? infoWindow.getPosition() : pos;
          state.callbacks.onInfoWindowTap(data.id, latitudeOf(p), longitudeOf(p));
        }
      };
      el.addEventListener("click", handler);
      el.onpointerdown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
      el.onmousedown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
      el.ontouchstart = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
      state.infoWindowListeners = state.infoWindowListeners || {};
      state.infoWindowListeners[data.id] = { el: el, handler: handler };
    }

    if (infoWindow) state.infoWindows[data.id] = infoWindow;
  };

  window.tmap_clearInfoWindow = function(viewId, infoId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      _removeWebInfoWindowClick(state, infoId);
      removeOverlay(state.infoWindows, infoId);
    }
  };

  window.tmap_clearAllInfoWindows = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      if (state.infoWindowListeners) {
        for (var id in state.infoWindowListeners) {
          _removeWebInfoWindowClick(state, id);
        }
        state.infoWindowListeners = {};
      }
      removeAllOverlays(state.infoWindows);
    }
  };

  // 라벨 (Label)
  window.tmap_addLabel = function(viewId, l) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    var data = (typeof l === 'object' && l !== null) ? l : {
      id: arguments[1],
      lat: arguments[2],
      lng: arguments[3],
      content: arguments[4],
      fontSize: arguments[5],
      fontColor: arguments[6],
      minLevel: arguments[7],
      maxLevel: arguments[8]
    };

    if (state.labels && Object.prototype.hasOwnProperty.call(state.labels, data.id)) {
      if (state.labels[data.id] && typeof state.labels[data.id].setMap === 'function') {
        state.labels[data.id].setMap(null);
      }
      delete state.labels[data.id];
    }

    var pos = new Tmapv3.LatLng(data.lat, data.lng);
    var labelOptions = {
      position: pos,
      content: data.content || '',
      map: state.map
    };

    if (data.fontSize) labelOptions.fontSize = data.fontSize;
    if (data.fontColor) labelOptions.fontColor = data.fontColor;
    if (data.minLevel !== undefined && data.minLevel !== null) labelOptions.minLevel = data.minLevel;
    if (data.maxLevel !== undefined && data.maxLevel !== null) labelOptions.maxLevel = data.maxLevel;

    var label = null;
    try {
      if (typeof Tmapv3 !== 'undefined' && Tmapv3.Label) {
        label = new Tmapv3.Label(labelOptions);
      } else {
        label = new Tmapv3.InfoWindow({
          position: pos,
          content: '<div style="font-size:' + (data.fontSize || '14px') + ';color:' + (data.fontColor || '#000000') + ';">' + (data.content || '') + '</div>',
          type: 2,
          map: state.map
        });
      }
    } catch (_) {
      try {
        label = new Tmapv3.InfoWindow({
          position: pos,
          content: '<div style="font-size:' + (data.fontSize || '14px') + ';color:' + (data.fontColor || '#000000') + ';">' + (data.content || '') + '</div>',
          type: 2,
          map: state.map
        });
      } catch (_) {}
    }

    if (label) {
      state.labels = state.labels || {};
      state.labels[data.id] = label;
    }
  };

  window.tmap_clearLabel = function(viewId, labelId) {
    var state = window.tmap_instances[viewId];
    if (state) removeOverlay(state.labels, labelId);
  };

  window.tmap_clearAllLabels = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) removeAllOverlays(state.labels);
  };

  function _removeWebCustomOverlayClick(state, id) {
    if (state && state.customOverlayListeners && Object.prototype.hasOwnProperty.call(state.customOverlayListeners, id)) {
      var listener = state.customOverlayListeners[id];
      if (listener && listener.el && listener.handler && typeof listener.el.removeEventListener === 'function') {
        try { listener.el.removeEventListener("click", listener.handler); } catch (_) {}
      }
      delete state.customOverlayListeners[id];
    }
  }

  // 커스텀 오버레이 (CustomOverlay)
  window.tmap_addCustomOverlay = function(viewId, co) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    var data = (typeof co === 'object' && co !== null) ? co : {
      id: arguments[1],
      lat: arguments[2],
      lng: arguments[3],
      content: arguments[4],
      offsetX: arguments[5],
      offsetY: arguments[6],
      zIndex: arguments[7]
    };

    _removeWebCustomOverlayClick(state, data.id);

    if (state.customOverlays && Object.prototype.hasOwnProperty.call(state.customOverlays, data.id)) {
      if (state.customOverlays[data.id] && typeof state.customOverlays[data.id].setMap === 'function') {
        state.customOverlays[data.id].setMap(null);
      }
      delete state.customOverlays[data.id];
    }

    var pos = new Tmapv3.LatLng(data.lat, data.lng);
    var overlayOptions = {
      position: pos,
      content: data.content,
      type: 2,
      map: state.map
    };

    if (data.offsetX !== undefined && data.offsetY !== undefined && data.offsetX !== null && data.offsetY !== null) {
      overlayOptions.offset = new Tmapv3.Point(data.offsetX, data.offsetY);
    }
    if (data.zIndex !== undefined && data.zIndex !== null) {
      overlayOptions.zIndex = data.zIndex;
    }

    var overlay = null;
    try {
      if (typeof Tmapv3 !== 'undefined' && Tmapv3.CustomOverlay) {
        overlay = new Tmapv3.CustomOverlay(overlayOptions);
      } else {
        overlay = new Tmapv3.InfoWindow(overlayOptions);
      }
    } catch (_) {
      try {
        overlay = new Tmapv3.InfoWindow(overlayOptions);
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
        if (state.callbacks && state.callbacks.onCustomOverlayTap) {
          var p = (overlay && typeof overlay.getPosition === 'function') ? overlay.getPosition() : pos;
          state.callbacks.onCustomOverlayTap(data.id, latitudeOf(p), longitudeOf(p));
        }
      };
      el.addEventListener("click", handler);
      el.onpointerdown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
      el.onmousedown = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
      el.ontouchstart = function(e) { if (e && e.stopPropagation) e.stopPropagation(); };
      state.customOverlayListeners = state.customOverlayListeners || {};
      state.customOverlayListeners[data.id] = { el: el, handler: handler };
    }

    if (overlay) {
      state.customOverlays = state.customOverlays || {};
      state.customOverlays[data.id] = overlay;
    }
  };

  window.tmap_clearCustomOverlay = function(viewId, customOverlayId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      _removeWebCustomOverlayClick(state, customOverlayId);
      removeOverlay(state.customOverlays, customOverlayId);
    }
  };

  window.tmap_clearAllCustomOverlays = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      if (state.customOverlayListeners) {
        for (var id in state.customOverlayListeners) {
          _removeWebCustomOverlayClick(state, id);
        }
        state.customOverlayListeners = {};
      }
      removeAllOverlays(state.customOverlays);
    }
  };

  // 폴리라인
  window.tmap_addPolyline = function(viewId, p) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    if (state.polylines[p.id]) {
      state.polylines[p.id].setMap(null);
    }

    var path = (p.points || []).map(function(pt) {
      return new Tmapv3.LatLng(pt.lat, pt.lng);
    });

    var polyline = new Tmapv3.Polyline({
      path: path,
      strokeColor: p.strokeColor || "#0066FF",
      strokeOpacity: p.strokeOpacity !== undefined ? p.strokeOpacity : 1.0,
      strokeWeight: p.strokeWidth || 6,
      direction: p.direction || false,
      map: state.map,
      zIndex: p.zIndex || 0
    });

    state.polylines[p.id] = polyline;
  };

  window.tmap_clearPolyline = function(viewId, polylineId) {
    var state = window.tmap_instances[viewId];
    if (state && state.polylines[polylineId]) {
      state.polylines[polylineId].setMap(null);
      delete state.polylines[polylineId];
    }
  };

  window.tmap_clearAllPolylines = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      for (var id in state.polylines) {
        state.polylines[id].setMap(null);
      }
      state.polylines = {};
    }
  };

  // 도형: Circle, Polygon, Rectangle
  window.tmap_addCircle = function(viewId, c) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    if (state.circles[c.id]) state.circles[c.id].setMap(null);

    var circle = new Tmapv3.Circle({
      center: new Tmapv3.LatLng(c.lat, c.lng),
      radius: c.radius || 100,
      fillColor: c.fillColor || "#FF0000",
      fillOpacity: c.fillOpacity !== undefined ? c.fillOpacity : 0.3,
      strokeColor: c.strokeColor || "#FF0000",
      strokeOpacity: c.strokeOpacity !== undefined ? c.strokeOpacity : 1.0,
      strokeWeight: c.strokeWidth || 2,
      map: state.map,
      zIndex: c.zIndex || 0
    });

    state.circles[c.id] = circle;
  };

  window.tmap_addPolygon = function(viewId, p) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    if (state.polygons[p.id]) state.polygons[p.id].setMap(null);

    var paths = (p.points || []).map(function(pt) {
      return new Tmapv3.LatLng(pt.lat, pt.lng);
    });

    var polygon = new Tmapv3.Polygon({
      paths: paths,
      fillColor: p.fillColor || "#0066FF",
      fillOpacity: p.fillOpacity !== undefined ? p.fillOpacity : 0.3,
      strokeColor: p.strokeColor || "#0066FF",
      strokeOpacity: p.strokeOpacity !== undefined ? p.strokeOpacity : 1.0,
      strokeWeight: p.strokeWidth || 2,
      map: state.map,
      zIndex: p.zIndex || 0
    });

    state.polygons[p.id] = polygon;
  };

  window.tmap_addRectangle = function(viewId, r) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    if (state.rectangles[r.id]) state.rectangles[r.id].setMap(null);

    var bounds = new Tmapv3.LatLngBounds(
      new Tmapv3.LatLng(r.swLat, r.swLng),
      new Tmapv3.LatLng(r.neLat, r.neLng)
    );

    var rectangle = new Tmapv3.Rectangle({
      bounds: bounds,
      fillColor: r.fillColor || "#0066FF",
      fillOpacity: r.fillOpacity !== undefined ? r.fillOpacity : 0.3,
      strokeColor: r.strokeColor || "#0066FF",
      strokeOpacity: r.strokeOpacity !== undefined ? r.strokeOpacity : 1.0,
      strokeWeight: r.strokeWidth || 2,
      map: state.map,
      zIndex: r.zIndex || 0
    });

    state.rectangles[r.id] = rectangle;
  };

  function removeOverlay(collection, id) {
    if (collection && Object.prototype.hasOwnProperty.call(collection, id)) {
      var item = collection[id];
      if (item && typeof item.setMap === 'function') {
        item.setMap(null);
      }
      delete collection[id];
    }
  }

  function removeAllOverlays(collection) {
    if (collection) {
      var keys = Object.keys(collection);
      for (var i = 0; i < keys.length; i++) {
        removeOverlay(collection, keys[i]);
      }
    }
  }

  window.tmap_clearPolygon = function(viewId, polygonId) {
    var state = window.tmap_instances[viewId];
    if (state) removeOverlay(state.polygons, polygonId);
  };

  window.tmap_clearAllPolygons = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) removeAllOverlays(state.polygons);
  };

  window.tmap_clearCircle = function(viewId, circleId) {
    var state = window.tmap_instances[viewId];
    if (state) removeOverlay(state.circles, circleId);
  };

  window.tmap_clearAllCircles = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) removeAllOverlays(state.circles);
  };

  window.tmap_clearRectangle = function(viewId, rectangleId) {
    var state = window.tmap_instances[viewId];
    if (state) removeOverlay(state.rectangles, rectangleId);
  };

  window.tmap_clearAllRectangles = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) removeAllOverlays(state.rectangles);
  };

  window.tmap_clearAll = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      window.tmap_clearAllMarkers(viewId);
      window.tmap_clearAllInfoWindows(viewId);
      window.tmap_clearAllLabels(viewId);
      window.tmap_clearAllCustomOverlays(viewId);
      window.tmap_clearClusterer(viewId);
      removeAllOverlays(state.polylines);
      removeAllOverlays(state.polygons);
      removeAllOverlays(state.circles);
      removeAllOverlays(state.rectangles);
    }
  };

  window.tmap_dispose = function(viewId) {
    clearTimeout(pendingStarts.get(viewId));
    pendingStarts.delete(viewId);
    const state = window.tmap_instances[viewId];
    if (!state) return;
    state.disposed = true;
    if (state.listeners && state.map && typeof state.map.off === 'function') {
      for (var i = 0; i < state.listeners.length; i++) {
        try {
          state.map.off(state.listeners[i].name, state.listeners[i].fn);
        } catch (_) {}
      }
      state.listeners = [];
    }
    state.callbacks = {};
    try {
      if (state.map && typeof tmapBridge !== 'undefined' && tmapBridge.traffic) {
        tmapBridge.traffic.dispose(state.map);
      }
      if (state.map && typeof tmapBridge !== 'undefined' && tmapBridge.disposeControls) {
        tmapBridge.disposeControls(state.map);
      }
      window.tmap_clearAll(viewId);
    } finally {
      delete window.tmap_instances[viewId];
      if (state.map && typeof state.map.destroy === 'function') {
        state.map.destroy();
      }
    }
  };

  window.tmap_toggleTraffic = function(viewId, isVisible) {
    var state = window.tmap_instances[viewId];
    if (state && state.map && typeof tmapBridge !== 'undefined' && tmapBridge.traffic) {
      tmapBridge.traffic.toggleTraffic(state.map, isVisible);
    }
  };
})();
