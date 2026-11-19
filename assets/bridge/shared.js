// The SDK owns the map and markers. Each map adapter owns its marker registry.
function latitudeOf(pos) {
  if (!pos) return 0;
  if (typeof pos.lat === 'function') return pos.lat();
  if (typeof pos.getLat === 'function') return pos.getLat();
  return pos._lat ?? pos.lat;
}

function longitudeOf(pos) {
  if (!pos) return 0;
  if (typeof pos.lng === 'function') return pos.lng();
  if (typeof pos.getLng === 'function') return pos.getLng();
  return pos._lng ?? pos.lng;
}

function extractEventLatLng(evt) {
  if (!evt) return null;
  var raw = (evt.data && evt.data.lngLat) ? evt.data.lngLat : (evt.latLng || evt.lngLat || (evt.data && (evt.data.lat !== undefined || evt.data.latitude !== undefined) ? evt.data : null));
  if (!raw && (typeof evt.lat === 'function' || typeof evt.getLat === 'function' || evt._lat !== undefined)) {
    raw = evt;
  }
  if (!raw) return null;
  var lat = latitudeOf(raw);
  var lng = longitudeOf(raw);
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return null;
  return { lat: lat, lng: lng };
}

function extractMapBounds(map) {
  if (!map || typeof map.getBounds !== 'function') return null;
  try {
    var bnd = map.getBounds();
    if (!bnd) return null;
    var sw = bnd.getSouthWest ? bnd.getSouthWest() : bnd._sw;
    var ne = bnd.getNorthEast ? bnd.getNorthEast() : bnd._ne;
    if (!sw || !ne) return null;
    var swLat = latitudeOf(sw);
    var swLng = longitudeOf(sw);
    var neLat = latitudeOf(ne);
    var neLng = longitudeOf(ne);
    if (isNaN(swLat) || isNaN(swLng) || isNaN(neLat) || isNaN(neLng)) return null;
    return { swLat: swLat, swLng: swLng, neLat: neLat, neLng: neLng };
  } catch (_) {
    return null;
  }
}

function bindTmapMarkerDrag(marker, map, callback) {
  var active = null;
  var started = false;
  var suppressClick = false;
  var origin = null, anchor = null, initial = null;
  var currentEl = null;
  var touchAction = '';
  var cursor = '';
  var disposed = false;

  function cancelDrag() {
    if (active !== null) {
      if (currentEl && currentEl.releasePointerCapture) {
        try { currentEl.releasePointerCapture(active); } catch (_) {}
      }
      var dragged = started;
      active = null;
      started = false;
      suppressClick = false;
      if (dragged) {
        emit('end', marker.getPosition ? marker.getPosition() : null);
      }
    }
  }

  function emit(phase, pos) {
    if (!callback || !pos) return;
    if (phase !== 'start' && phase !== 'move' && phase !== 'end') return;
    var lat = latitudeOf(pos);
    var lng = longitudeOf(pos);
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      callback(lat, lng, phase);
    }
  }

  function down(e) {
    if (!currentEl || active !== null || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    active = e.pointerId;
    started = false;
    suppressClick = false;
    initial = marker.getPosition ? marker.getPosition() : null;
    if (disposed || active !== e.pointerId || !currentEl || !map || typeof map.realToScreen !== 'function' || !initial) return;
    anchor = map.realToScreen(initial);
    if (disposed || active !== e.pointerId || !currentEl) return;
    origin = {x: e.clientX, y: e.clientY};
    if (currentEl && currentEl.setPointerCapture) {
      try { currentEl.setPointerCapture(active); } catch (_) {}
    }
  }

  function move(e) {
    if (e.pointerId !== active || !currentEl || !map || typeof map.screenToReal !== 'function' || !origin || !anchor) return;
    e.preventDefault();
    e.stopPropagation();
    var dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    if (!started && Math.hypot(dx, dy) < 3) return;
    if (!started) {
      started = true;
      emit('start', initial);
      if (disposed || active !== e.pointerId || !currentEl) return;
    }
    var ax = (anchor && anchor.getX ? anchor.getX() : (anchor && anchor.x !== undefined ? anchor.x : 0));
    var ay = (anchor && anchor.getY ? anchor.getY() : (anchor && anchor.y !== undefined ? anchor.y : 0));
    var pt = (typeof Tmapv3 !== 'undefined' && Tmapv3.Point) ? new Tmapv3.Point(ax + dx, ay + dy) : {x: ax + dx, y: ay + dy};
    var next = map.screenToReal(pt);
    if (disposed || active !== e.pointerId || !currentEl || !next) return;
    if (typeof marker.setPosition === 'function') marker.setPosition(next);
    if (disposed || active !== e.pointerId || !currentEl) return;
    var position = (marker.getPosition ? marker.getPosition() : next);
    if (disposed || active !== e.pointerId || !currentEl) return;
    emit('move', position);
  }

  function up(e) {
    if (e.pointerId !== active || !currentEl) return;
    e.stopPropagation();
    var dragged = started;
    active = null;
    started = false;
    suppressClick = dragged;
    if (dragged) {
      var pos = marker.getPosition ? marker.getPosition() : null;
      emit('end', pos);
    }
  }

  function click(e) {
    if (suppressClick) {
      e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      suppressClick = false;
    }
  }

  function resolveElement() {
    try {
      if (marker && marker.getElement && typeof marker.getElement === 'function') {
        var el = marker.getElement();
        if (el) return el;
      }
    } catch (_) {}
    try {
      if (marker && marker._marker_data && marker._marker_data.vsmMarker && typeof marker._marker_data.vsmMarker.getElement === 'function') {
        return marker._marker_data.vsmMarker.getElement();
      }
    } catch (_) {}
    return null;
  }

  function detachEl() {
    cancelDrag();
    var old = currentEl, oldTouchAction = touchAction, oldCursor = cursor;
    currentEl = null;
    if (old && typeof old.removeEventListener === 'function') {
      try { old.removeEventListener('pointerdown', down); } catch (_) {}
      try { old.removeEventListener('click', click, true); } catch (_) {}
      if (old.style) {
        try { old.style.touchAction = oldTouchAction; } catch (_) {}
        try { old.style.cursor = oldCursor; } catch (_) {}
      }
    }
  }

  function attachEl(el) {
    if (disposed || !el || currentEl === el) return;
    detachEl();
    currentEl = el;
    touchAction = (currentEl.style && currentEl.style.touchAction) ? currentEl.style.touchAction : '';
    cursor = (currentEl.style && currentEl.style.cursor) ? currentEl.style.cursor : '';
    if (currentEl.style) {
      try { currentEl.style.touchAction = 'none'; } catch (_) {}
      try { currentEl.style.cursor = 'move'; } catch (_) {}
    }
    if (typeof currentEl.addEventListener === 'function') {
      currentEl.addEventListener('pointerdown', down);
      currentEl.addEventListener('click', click, true);
    }
  }

  var origSetMap = (marker && typeof marker.setMap === 'function') ? marker.setMap : null;
  var wrappedSetMap = null;
  if (origSetMap) {
    wrappedSetMap = function(m) {
      if (!m) cancelDrag();
      var res = origSetMap.apply(this, arguments);
      if (!disposed) {
        if (m) attachEl(resolveElement());
        else detachEl();
      }
      return res;
    };
    marker.setMap = wrappedSetMap;
  }

  var initialEl = resolveElement();
  if (initialEl) attachEl(initialEl);

  var doc = typeof document !== 'undefined' ? document : (typeof window !== 'undefined' && window.document ? window.document : null);
  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('pointermove', move, {passive: false});
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', up);
  }

  return {
    dispose: function() {
      if (!disposed) {
        disposed = true;
        detachEl();
        if (doc && typeof doc.removeEventListener === 'function') {
          try { doc.removeEventListener('pointermove', move); } catch (_) {}
          try { doc.removeEventListener('pointerup', up); } catch (_) {}
          try { doc.removeEventListener('pointercancel', up); } catch (_) {}
        }
        if (marker && origSetMap && marker.setMap === wrappedSetMap) {
          marker.setMap = origSetMap;
        }
      }
    }
  };
}

// Cluster members use the same published marker options as standalone markers,
// but their pointer adapter owns dragging instead of the SDK's native handler.
function tmapMarkerOptions(data, nativeDraggable) {
  const position = data.position ?? (data.lat !== undefined && data.lng !== undefined ? {latitude: data.lat, longitude: data.lng} : null);
  const options = {
    position: new Tmapv3.LatLng(position.latitude, position.longitude),
    anchor: data.anchor || 'bottom',
    opacity: data.opacity !== undefined ? data.opacity : 1.0,
    visible: data.visible !== false,
    draggable: nativeDraggable && !!data.draggable,
    zIndex: data.zIndex !== undefined ? data.zIndex : 100
  };
  if (data.color) options.color = data.color;
  if (data.title) options.title = data.title;
  if (data.titleOption) options.titleOption = data.titleOption;
  if (data.contextMenu) options.contextMenu = data.contextMenu;
  if (data.label) {
    options.label = data.label;
    if (data.labelBackgroundColor || data.labelTextColor) {
      options.labelOption = {
        backgroundColor: data.labelBackgroundColor || '#ffffff',
        color: data.labelTextColor || '#000000',
        fontSize: '13px',
        padding: '4px 8px',
        borderRadius: '4px'
      };
    }
  }
  const icon = data.icon;
  if (icon) {
    if (icon.iconUrl) options.icon = icon.iconUrl;
    else if (icon.iconHtml) options.iconHTML = icon.iconHtml;
    if (icon.size) options.iconSize = new Tmapv3.Size(icon.size.width, icon.size.height);
    if (icon.offset) options.offset = new Tmapv3.Point(icon.offset.x, icon.offset.y);
  } else {
    if (data.iconUrl) options.icon = data.iconUrl;
    else if (data.iconHtml) options.iconHTML = data.iconHtml;
    if (data.iconW != null && data.iconH != null) options.iconSize = new Tmapv3.Size(data.iconW, data.iconH);
    if (data.offsetX !== undefined && data.offsetY !== undefined && data.offsetX !== null && data.offsetY !== null) {
      options.offset = new Tmapv3.Point(data.offsetX, data.offsetY);
    }
  }

  return options;
}

// Cluster callbacks may receive a group marker or a cluster descriptor.
// Normalize both into an event payload with stable member IDs.
function tmapClusterEventPayload(cluster, map) {
  if (!cluster) return null;
  var center = cluster.center ||
      (typeof cluster.getCenter === 'function' ? cluster.getCenter() : null) ||
      (typeof cluster.getPosition === 'function' ? cluster.getPosition() : null) ||
      cluster.position;
  if (!center) return null;
  var members = Array.isArray(cluster.markers) ? cluster.markers :
      (typeof cluster.getMarkers === 'function' ? cluster.getMarkers() : []);
  var ids = [];
  if (Array.isArray(members)) {
    for (var member of members) {
      var id = member && (member._customMarkerId || member.markerId || member.id);
      if (typeof id === 'string' && id && !ids.includes(id)) ids.push(id);
    }
  }
  return {lat: latitudeOf(center), lng: longitudeOf(center),
    zoom: map && typeof map.getZoom === 'function' ? Math.round(map.getZoom()) : 16,
    markerIds: ids};
}

const tmapBridge = {
  setCenter(map, lat, lng) {
    map.setCenter(new Tmapv3.LatLng(lat, lng));
  },

  panTo(map, lat, lng) {
    map.panTo(new Tmapv3.LatLng(lat, lng));
  },

  setZoom(map, zoom) {
    map.setZoom(zoom);
  },

  addMarker(map, markers, data, callbacks, dragListeners) {
    const id = data.markerId ?? data.id;
    tmapBridge.clearMarker(markers, id, dragListeners);
    const options = tmapMarkerOptions(data, true);
    options.map = map;
    const marker = new Tmapv3.Marker(options);
    marker._customMarkerId = id;
    markers[id] = marker;

    if (callbacks) {
      for (const [event, callback] of Object.entries(callbacks)) {
        if (!callback || event === 'drag' || event === 'dragstart' || event === 'dragend') continue;
        if (typeof marker.on === 'function') {
          marker.on(event, () => {
            if (markers[id] !== marker) return;
            const pos = marker.getPosition ? marker.getPosition() : options.position;
            const zoom = (map && typeof map.getZoom === 'function') ? Math.round(map.getZoom()) : 16;
            callback(id, latitudeOf(pos), longitudeOf(pos), zoom);
          });
        }
      }
    }

    if (data.draggable && callbacks && (callbacks.drag || callbacks.onMarkerDrag)) {
      const dragCb = callbacks.drag || callbacks.onMarkerDrag;
      const binding = bindTmapMarkerDrag(marker, map, (lat, lng, phase) => {
        if (markers[id] !== marker) return;
        dragCb(id, lat, lng, phase);
      });
      if (dragListeners) {
        dragListeners[id] = binding;
      }
    }
  },

  clearMarker(markers, id, dragListeners) {
    if (dragListeners && dragListeners[id]) {
      try { dragListeners[id].dispose(); } catch (_) {}
      delete dragListeners[id];
    }
    const marker = markers[id];
    if (marker) {
      marker.setMap(null);
      delete markers[id];
    }
  },

  clearAllMarkers(markers, dragListeners) {
    if (dragListeners) {
      for (const id of Object.keys(dragListeners)) {
        try { dragListeners[id].dispose(); } catch (_) {}
        delete dragListeners[id];
      }
    }
    for (const id of Object.keys(markers)) tmapBridge.clearMarker(markers, id);
  },

  zoomToMaxExtent(map) {
    if (!map) return;
    if (typeof map.zoomToMaxExtent === 'function') {
      map.zoomToMaxExtent();
    } else if (typeof map.setZoom === 'function') {
      var min = typeof map.getMinZoom === 'function' ? map.getMinZoom() : 0;
      map.setZoom(min);
    }
  },

  relayout(map) {
    if (!map) return;
    if (typeof map.resize === 'function') {
      map.resize();
    } else if (typeof map.relayout === 'function') {
      map.relayout();
    }
  },

  setMapType(map, typeStr) {
    if (!map) return;
    var valid = ['ROAD', 'HYBRID', 'PUBLIC', 'NIGHT'];
    var target = (typeStr || 'ROAD').toUpperCase();
    if (!valid.includes(target)) target = 'ROAD';
    if (typeof map.setMapType === 'function') {
      map.__tmapRestorePending = true;
      map.setMapType(target);
    }
  },

  applyNaviControl(map, enabled) {
    if (!map) return;
    if (typeof Vsm !== 'undefined' && Vsm.MapControls) {
      var vsm = typeof map.vsmMap === 'function' ? map.vsmMap() : (map._data ? map._data.vsmMap : null);
      if (!vsm) return;
      if (enabled) {
        if (map.__tmapNaviControl) return;
        if (Vsm.MapControls.NavigationControl) {
          var dock = (Vsm.Map && Vsm.Map.ControlDockNames && Vsm.Map.ControlDockNames.TopRight) || 'top-right';
          var nav = new Vsm.MapControls.NavigationControl();
          var ctrl = nav;
          if (Vsm.MapControls.LayoutControl) {
            ctrl = new Vsm.MapControls.LayoutControl({
              className: 'top-right-group',
              control: nav
            });
          }
          map.__tmapNaviControl = ctrl;
          if (typeof vsm.addControl === 'function') {
            vsm.addControl(ctrl, dock);
          }
        }
      } else {
        if (!map.__tmapNaviControl) return;
        var ctrl = map.__tmapNaviControl;
        map.__tmapNaviControl = null;
        if (typeof vsm.removeControl === 'function') {
          vsm.removeControl(ctrl);
        }
      }
    }
  },

  disposeControls(map) {
    if (!map) return;
    tmapBridge.applyNaviControl(map, false);
    tmapBridge.applyScaleBar(map, false);
  },

  applyScaleBar(map, enabled) {
    if (!map) return;
    if (typeof Vsm !== 'undefined' && Vsm.MapControls) {
      var vsm = typeof map.vsmMap === 'function' ? map.vsmMap() : (map._data ? map._data.vsmMap : null);
      if (!vsm) return;
      if (enabled) {
        if (map.__tmapScaleBarControl) return;
        if (Vsm.MapControls.ScaleBarControl) {
          var dock = (Vsm.Map && Vsm.Map.ControlDockNames && Vsm.Map.ControlDockNames.BottomLeft) || 'bottom-left';
          var scale = new Vsm.MapControls.ScaleBarControl();
          var ctrl = scale;
          if (Vsm.MapControls.LayoutControl) {
            ctrl = new Vsm.MapControls.LayoutControl({
              className: 'bottom-left-group',
              control: scale
            });
          }
          map.__tmapScaleBarControl = ctrl;
          if (typeof vsm.addControl === 'function') {
            vsm.addControl(ctrl, dock);
          }
        }
      } else {
        if (!map.__tmapScaleBarControl) return;
        var ctrl = map.__tmapScaleBarControl;
        map.__tmapScaleBarControl = null;
        if (typeof vsm.removeControl === 'function') {
          vsm.removeControl(ctrl);
        }
      }
    }
  },

  updateMapOptions(map, opts) {
    if (!map || !opts) return;
    var options = typeof opts === 'string' ? JSON.parse(opts) : opts;
    if (options.minZoom !== undefined || options.maxZoom !== undefined) {
      var min = options.minZoom !== undefined ? options.minZoom : (typeof map.getMinZoom === 'function' ? map.getMinZoom() : 0);
      var max = options.maxZoom !== undefined ? options.maxZoom : (typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : 19);
      if (typeof map.setZoomLimit === 'function') {
        map.setZoomLimit(min, max);
      }
    }
    if (options.naviControl !== undefined) {
      if (map._data && map._data.options) {
        map._data.options.naviControl = !!options.naviControl;
      }
      tmapBridge.applyNaviControl(map, !!options.naviControl);
    }
    if (options.scaleBar !== undefined) {
      if (map._data && map._data.options) {
        map._data.options.scaleBar = !!options.scaleBar;
      }
      tmapBridge.applyScaleBar(map, !!options.scaleBar);
    }
    if (options.mapType !== undefined) {
      tmapBridge.setMapType(map, options.mapType);
    }
  },

  bindClusterZoomWatcher(mapOrOptions, clusterArg, maxZoomArg, isAliveArg) {
    var opts = (mapOrOptions && !mapOrOptions.vsmMap && !mapOrOptions._data && mapOrOptions.map)
      ? mapOrOptions
      : {
          map: mapOrOptions,
          cluster: clusterArg,
          maxClusterZoom: maxZoomArg,
          isAlive: isAliveArg
        };

    var map = opts.map;
    var cluster = opts.cluster;
    var getCluster = typeof cluster === 'function' ? cluster : function() { return cluster; };
    var rawMax = opts.maxClusterZoom !== undefined ? opts.maxClusterZoom : 19;
    var maxClusterZoom = typeof rawMax === 'number' ? rawMax : Number(rawMax);
    if (isNaN(maxClusterZoom)) maxClusterZoom = 19;
    var isAlive = typeof opts.isAlive === 'function' ? opts.isAlive : function() { return true; };

    var lastZoom = (map && typeof map.getZoom === 'function') ? map.getZoom() : null;
    if (typeof lastZoom !== 'number' || isNaN(lastZoom)) lastZoom = null;

    var disposed = false;
    var boundTargets = [];

    function handleZoomEnd() {
      if (disposed) return;
      if (!isAlive()) {
        dispose();
        return;
      }
      var currentZoom = (map && typeof map.getZoom === 'function') ? map.getZoom() : null;
      if (typeof currentZoom !== 'number' || isNaN(currentZoom)) return;

      var prevZoom = lastZoom;
      lastZoom = currentZoom;

      if (prevZoom !== null && typeof prevZoom === 'number' && !isNaN(prevZoom)) {
        if (prevZoom > maxClusterZoom && currentZoom <= maxClusterZoom) {
          var activeInstance = getCluster();
          if (activeInstance && typeof activeInstance.recluster === 'function') {
            try {
              activeInstance.recluster();
            } catch (err) {
              console.error("[tmapBridge] MarkerCluster recluster error:", err);
            }
          }
        }
      }
    }

    var vsm = null;
    try {
      if (map) {
        if (typeof map.vsmMap === 'function') {
          vsm = map.vsmMap();
        } else if (map._data && map._data.vsmMap) {
          vsm = map._data.vsmMap;
        } else if (map.vsm) {
          vsm = map.vsm;
        } else if (map._vsm) {
          vsm = map._vsm;
        }
      }
    } catch (_) {}

    if (vsm && typeof vsm.on === 'function') {
      try {
        vsm.on("zoomend", handleZoomEnd);
        boundTargets.push({ target: vsm, event: "zoomend" });
      } catch (_) {}
    }

    if (map && typeof map.on === 'function') {
      try {
        map.on("ZoomEnd", handleZoomEnd);
        boundTargets.push({ target: map, event: "ZoomEnd" });
      } catch (_) {}
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      for (var i = 0; i < boundTargets.length; i++) {
        var b = boundTargets[i];
        try {
          if (b.target && typeof b.target.off === 'function') {
            b.target.off(b.event, handleZoomEnd);
          }
        } catch (_) {}
      }
      boundTargets = [];
    }

    return {
      dispose: dispose,
      check: handleZoomEnd
    };
  },

  bindClusterRecluster(mapOrOptions, clusterArg, maxZoomArg, isAliveArg) {
    return tmapBridge.bindClusterZoomWatcher(mapOrOptions, clusterArg, maxZoomArg, isAliveArg);
  },

  traffic: {
    toggleTraffic(map, isVisible, appKey) {
      if (!map) return;
      if (appKey) map.__tmapAppKey = appKey;
      if (!isVisible) {
        map.__tmapTrafficEnabled = false;
        map.__tmapTrafficEpoch = (map.__tmapTrafficEpoch || 0) + 1;
        if (map.__tmapTrafficAbort) {
          try { map.__tmapTrafficAbort.abort(); } catch(_) {}
          map.__tmapTrafficAbort = null;
        }
        if (map.__tmapTrafficTimer) {
          clearTimeout(map.__tmapTrafficTimer);
          map.__tmapTrafficTimer = null;
        }
        tmapBridge.traffic.clearLines(map);
        return;
      }

      map.__tmapTrafficEnabled = true;
      if (!map.__tmapTrafficLines) map.__tmapTrafficLines = [];

      if (!map.__tmapTrafficListeners && typeof map.on === 'function') {
        map.__tmapTrafficListeners = true;
        var onViewportSettled = function() {
          if (!map.__tmapTrafficEnabled) return;
          if (map.__tmapTrafficTimer) {
            clearTimeout(map.__tmapTrafficTimer);
          }
          map.__tmapTrafficTimer = setTimeout(function() {
            map.__tmapTrafficTimer = null;
            if (map.__tmapTrafficEnabled) {
              tmapBridge.traffic.fetchTraffic(map);
            }
          }, 400);
        };
        map.on("DragEnd", onViewportSettled);
        map.on("Zoom", onViewportSettled);
        map.__tmapTrafficViewportHandler = onViewportSettled;
      }

      tmapBridge.traffic.fetchTraffic(map);
    },

    clearLines(map) {
      if (!map) return;
      if (Array.isArray(map.__tmapTrafficLines)) {
        for (var i = 0; i < map.__tmapTrafficLines.length; i++) {
          var line = map.__tmapTrafficLines[i];
          if (line && typeof line.setMap === 'function') {
            line.setMap(null);
          }
        }
        map.__tmapTrafficLines.length = 0;
      } else {
        map.__tmapTrafficLines = [];
      }
    },

    fetchTraffic(map) {
      if (!map || !map.__tmapTrafficEnabled) return;
      if (typeof map.getBounds !== 'function') return;
      var bnd = map.getBounds();
      if (!bnd) return;
      var sw = bnd.getSouthWest ? bnd.getSouthWest() : bnd._sw;
      var ne = bnd.getNorthEast ? bnd.getNorthEast() : bnd._ne;
      if (!sw || !ne) return;

      var swLat = latitudeOf(sw);
      var swLng = longitudeOf(sw);
      var neLat = latitudeOf(ne);
      var neLng = longitudeOf(ne);
      if (!Number.isFinite(swLat) || !Number.isFinite(swLng) ||
          !Number.isFinite(neLat) || !Number.isFinite(neLng)) return;

      var minLat = Math.min(swLat, neLat);
      var maxLat = Math.max(swLat, neLat);
      var minLon = Math.min(swLng, neLng);
      var maxLon = Math.max(swLng, neLng);
      var zoom = typeof map.getZoom === 'function' ? Math.round(map.getZoom()) : 16;

      var epoch = ((map.__tmapTrafficEpoch || 0) + 1);
      map.__tmapTrafficEpoch = epoch;

      if (map.__tmapTrafficAbort) {
        try { map.__tmapTrafficAbort.abort(); } catch(_) {}
      }
      var abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      map.__tmapTrafficAbort = abortCtrl;

      var appKey = map.__tmapAppKey || (typeof config !== 'undefined' && config.appKey) || "";
      var url = "https://apis.openapi.sk.com/tmap/traffic?format=json&version=1&minLat=" + minLat +
                "&minLon=" + minLon + "&maxLat=" + maxLat + "&maxLon=" + maxLon +
                "&zoomLevel=" + zoom + "&reqCoordType=WGS84GEO&resCoordType=WGS84GEO";

      var headers = { "Accept": "application/json" };
      if (appKey) headers["appKey"] = appKey;

      if (typeof fetch === 'function') {
        var opts = { method: 'GET', headers: headers };
        if (abortCtrl) opts.signal = abortCtrl.signal;

        fetch(url, opts)
          .then(function(res) {
            if (!res.ok) return null;
            return res.json();
          })
          .then(function(data) {
            if (epoch !== map.__tmapTrafficEpoch || !map.__tmapTrafficEnabled) {
              return;
            }
            tmapBridge.traffic.renderLines(map, data);
          })
          .catch(function(err) {
            // Ignore aborts and errors silently, never log credentials
          });
      }
    },

    renderLines(map, data) {
      if (!map || !map.__tmapTrafficEnabled) return;
      tmapBridge.traffic.clearLines(map);
      if (!data || !Array.isArray(data.features)) return;

      var features = data.features;
      for (var i = 0; i < features.length; i++) {
        var f = features[i];
        if (!f || !f.geometry || f.geometry.type !== 'LineString' || !Array.isArray(f.geometry.coordinates)) {
          continue;
        }
        var coords = f.geometry.coordinates;
        if (coords.length < 2) continue;

        var path = [];
        for (var c = 0; c < coords.length; c++) {
          var pt = coords[c];
          path.push(new Tmapv3.LatLng(pt[1], pt[0]));
        }

        var congestion = f.properties ? f.properties.congestion : 0;
        var strokeColor = "#06050D";
        switch (parseInt(congestion, 10)) {
          case 1: strokeColor = "#61AB25"; break;
          case 2: strokeColor = "#FFFF00"; break;
          case 3: strokeColor = "#E87506"; break;
          case 4: strokeColor = "#D61125"; break;
        }

        if (typeof Tmapv3 !== 'undefined' && typeof Tmapv3.Polyline === 'function') {
          var polyline = new Tmapv3.Polyline({
            path: path,
            strokeColor: strokeColor,
            strokeWeight: 5,
            strokeOpacity: 0.9,
            map: map,
            zIndex: 10
          });
          map.__tmapTrafficLines.push(polyline);
        }
      }
    },

    restoreTraffic(map) {
      if (!map || !map.__tmapTrafficEnabled) return;
      if (Array.isArray(map.__tmapTrafficLines)) {
        for (var i = 0; i < map.__tmapTrafficLines.length; i++) {
          var line = map.__tmapTrafficLines[i];
          if (line && typeof line.setMap === 'function') {
            line.setMap(null);
            line.setMap(map);
          }
        }
      }
      tmapBridge.traffic.fetchTraffic(map);
    },

    dispose(map) {
      if (!map) return;
      map.__tmapTrafficEnabled = false;
      map.__tmapTrafficEpoch = (map.__tmapTrafficEpoch || 0) + 1;
      if (map.__tmapTrafficAbort) {
        try { map.__tmapTrafficAbort.abort(); } catch(_) {}
        map.__tmapTrafficAbort = null;
      }
      if (map.__tmapTrafficTimer) {
        clearTimeout(map.__tmapTrafficTimer);
        map.__tmapTrafficTimer = null;
      }
      tmapBridge.traffic.clearLines(map);
      map.__tmapTrafficListeners = false;
    }
  }
};

// Map readback is shared by Web (synchronous window entry point) and mobile
// (runJavaScriptReturningResult). Returning JSON keeps numeric and coordinate
// data identical across the two Dart runtimes.
tmapBridge.readMapData = function(map, name, args) {
  if (!map) throw new Error('Map is not initialized');
  args = args || {};
  var value;
  switch (name) {
    case 'getBearing':
    case 'getPitch':
    case 'getZoom':
    case 'getMinZoom':
    case 'getMaxZoom':
      if (typeof map[name] !== 'function') throw new Error('Unsupported Map method: ' + name);
      value = {value: map[name]()};
      break;
    case 'getCenter':
      var center = map.getCenter();
      value = {latitude: latitudeOf(center), longitude: longitudeOf(center)};
      break;
    case 'getBounds':
      var bounds = extractMapBounds(map);
      if (!bounds) throw new Error('Map bounds unavailable');
      value = {
        southWest: {latitude: bounds.swLat, longitude: bounds.swLng},
        northEast: {latitude: bounds.neLat, longitude: bounds.neLng}
      };
      break;
    case 'realToScreen':
      var pixel = map.realToScreen(new Tmapv3.LatLng(args.latitude, args.longitude));
      value = {x: typeof pixel.getX === 'function' ? pixel.getX() : (pixel.x ?? pixel._x),
        y: typeof pixel.getY === 'function' ? pixel.getY() : (pixel.y ?? pixel._y)};
      break;
    case 'screenToReal':
      var coordinate = map.screenToReal(new Tmapv3.Point(args.x, args.y));
      value = {latitude: latitudeOf(coordinate), longitude: longitudeOf(coordinate)};
      break;
    case 'screenSize':
      var size = map.screenSize();
      value = {
        width: typeof size.getWidth === 'function' ? size.getWidth() : (size.width ?? size._width),
        height: typeof size.getHeight === 'function' ? size.getHeight() : (size.height ?? size._height)
      };
      break;
    default:
      throw new Error('Unsupported Map read: ' + name);
  }
  return JSON.stringify(value);
};

tmapBridge.setZoomLimit = function(map, minZoom, maxZoom) {
  if (!map || typeof map.setZoomLimit !== 'function') {
    throw new Error('Map.setZoomLimit is unavailable');
  }
  map.setZoomLimit(minZoom, maxZoom);
};

// Bessel and KATEC conversions deliberately delegate to the vendor SDK: its
// datum shift and TM parameters must agree with the map's coordinate system.
tmapBridge.convertProjection = function(method, data) {
  var methods = {
    convertBesselGEOToWGS84GEO: 'geographic',
    convertBesselTMToWGS84GEO: 'projected',
    convertWGS84GEOToBesselGEO: 'geographic',
    convertWGS84GEOToBesselTM: 'geographic',
    convertWGS84GEOToKatec: 'geographic'
  };
  if (!Object.prototype.hasOwnProperty.call(methods, method)) {
    throw new Error('Unsupported projection conversion: ' + method);
  }
  var projection = new Tmapv3.Projection();
  var source = methods[method] === 'projected'
    ? new Tmapv3.Point(data.x, data.y)
    : new Tmapv3.LatLng(data.latitude, data.longitude);
  // The documented functions are exposed as static methods by the 20231206
  // SDK build; older builds may also provide instance methods.
  var fn = typeof projection[method] === 'function'
    ? projection[method] : Tmapv3.Projection[method];
  if (typeof fn !== 'function') throw new Error('Projection method unavailable: ' + method);
  var target = fn.call(projection, source);
  if (!target) throw new Error('Projection conversion returned no coordinate');
  var geographic = method.endsWith('ToWGS84GEO') || method.endsWith('ToBesselGEO');
  return JSON.stringify(geographic
    ? {latitude: latitudeOf(target), longitude: longitudeOf(target)}
    : {x: typeof target.getX === 'function' ? target.getX() : (target.x ?? target._x),
       y: typeof target.getY === 'function' ? target.getY() : (target.y ?? target._y)});
};

if (typeof window !== 'undefined') {
  window.tmapBridge = tmapBridge;
}
