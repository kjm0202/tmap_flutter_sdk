(function() {
  window.tmap_instances = window.tmap_instances || {};

  const pendingStarts = new Map();

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
          height: "100%"
        };

        if (options.minZoom != null) mapOptions.minZoom = options.minZoom;
        if (options.maxZoom != null) mapOptions.maxZoom = options.maxZoom;
        if (options.bearing !== undefined) mapOptions.bearing = options.bearing;
        if (options.pitch !== undefined) mapOptions.pitch = options.pitch;

        if (typeof Tmapv3 !== 'undefined' && Tmapv3.Map && Tmapv3.Map.MapType) {
          if (options.mapType === 'HYBRID') mapOptions.mapType = Tmapv3.Map.MapType.HYBRID;
          else if (options.mapType === 'PUBLIC') mapOptions.mapType = Tmapv3.Map.MapType.PUBLIC;
          else if (options.mapType === 'NIGHT') mapOptions.mapType = Tmapv3.Map.MapType.NIGHT;
          else mapOptions.mapType = Tmapv3.Map.MapType.ROAD;
        }

        console.log("[tmap_web_bridge] Creating Tmapv3.Map on container:", containerId);
        var map = new Tmapv3.Map(containerId, mapOptions);

        var state = {
          map: map,
          markers: Object.create(null),
          infoWindows: {},
          polylines: {},
          polygons: {},
          circles: {},
          rectangles: {},
          clusterer: null,
          callbacks: callbacks || {}
        };

        window.tmap_instances[viewId] = state;

        if (map && map.on) {
          let ready = false;
          map.on("ConfigLoad", function() {
            if (ready || !state.callbacks.onMapCreated) return;
            ready = true;
            state.callbacks.onMapCreated(viewId);
          });

          map.on("Click", function(e) {
            const position = e?.data?.lngLat ?? e?.latLng;
            if (state.callbacks.onMapTap && position) {
              state.callbacks.onMapTap(latitudeOf(position), longitudeOf(position));
            }
          });

          map.on("Idle", function() {
            if (state.callbacks.onCameraIdle) {
              var c = map.getCenter();
              state.callbacks.onCameraIdle(latitudeOf(c), longitudeOf(c), map.getZoom(), map.getBearing(), map.getPitch());
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
      var mapType = Tmapv3.Map.MapType.ROAD;
      if (typeStr === 'HYBRID') mapType = Tmapv3.Map.MapType.HYBRID;
      else if (typeStr === 'PUBLIC') mapType = Tmapv3.Map.MapType.PUBLIC;
      else if (typeStr === 'NIGHT') mapType = Tmapv3.Map.MapType.NIGHT;
      state.map.setMapType(mapType);
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

    tmapBridge.addMarker(state.map, state.markers, m, {
      click: state.callbacks.onMarkerTap
    });
  };

  window.tmap_clearMarker = function(viewId, id) {
    const state = window.tmap_instances[viewId];
    if (state) tmapBridge.clearMarker(state.markers, id);
  };

  window.tmap_clearAllMarkers = function(viewId) {
    const state = window.tmap_instances[viewId];
    if (state) tmapBridge.clearAllMarkers(state.markers);
  };

  // 클러스터러
  window.tmap_addClusterer = function(viewId, clusterData) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    if (state.clusterer) {
      state.clusterer.destroy();
      state.clusterer = null;
    }

    var markers = (clusterData.markers || []).map(function(m) {
      return new Tmapv3.Marker({
        position: new Tmapv3.LatLng(m.lat, m.lng),
        title: m.title || undefined
      });
    });

    state.clusterer = new Tmapv3.extension.MarkerCluster({
      markers: markers,
      map: state.map,
      maxZoom: clusterData.maxZoom || 17,
      minClusterSize: clusterData.minClusterSize || 2,
      gridSize: clusterData.gridSize || 60
    });
  };

  window.tmap_clearClusterer = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state && state.clusterer) {
      state.clusterer.destroy();
      state.clusterer = null;
    }
  };

  // 인포윈도우
  window.tmap_addInfoWindow = function(viewId, iw) {
    var state = window.tmap_instances[viewId];
    if (!state || !state.map) return;

    if (state.infoWindows[iw.id]) {
      state.infoWindows[iw.id].setMap(null);
    }

    var pos = new Tmapv3.LatLng(iw.lat, iw.lng);
    var offset = (iw.offsetX !== undefined && iw.offsetY !== undefined) ? new Tmapv3.Point(iw.offsetX, iw.offsetY) : new Tmapv3.Point(0, -40);

    var infoWindow = new Tmapv3.InfoWindow({
      position: pos,
      content: iw.content,
      type: iw.type !== undefined ? iw.type : 1,
      offset: offset,
      map: state.map,
      visible: iw.visible !== false
    });

    state.infoWindows[iw.id] = infoWindow;
  };

  window.tmap_clearInfoWindow = function(viewId, infoId) {
    var state = window.tmap_instances[viewId];
    if (state && state.infoWindows[infoId]) {
      state.infoWindows[infoId].setMap(null);
      delete state.infoWindows[infoId];
    }
  };

  window.tmap_clearAllInfoWindows = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      for (var id in state.infoWindows) {
        state.infoWindows[id].setMap(null);
      }
      state.infoWindows = {};
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
      tmapBridge.clearAllMarkers(state.markers);
      for (var iid in state.infoWindows) state.infoWindows[iid].setMap(null);
      for (var pid in state.polylines) state.polylines[pid].setMap(null);
      for (var pgid in state.polygons) state.polygons[pgid].setMap(null);
      for (var cid in state.circles) state.circles[cid].setMap(null);
      for (var rid in state.rectangles) state.rectangles[rid].setMap(null);
      if (state.clusterer) { state.clusterer.destroy(); state.clusterer = null; }
      state.infoWindows = {};
      state.polylines = {};
      state.polygons = {};
      state.circles = {};
      state.rectangles = {};
    }
  };

  window.tmap_dispose = function(viewId) {
    clearTimeout(pendingStarts.get(viewId));
    pendingStarts.delete(viewId);
    const state = window.tmap_instances[viewId];
    if (!state) return;
    state.callbacks = {};
    try {
      window.tmap_clearAll(viewId);
    } finally {
      delete window.tmap_instances[viewId];
      state.map.destroy();
    }
  };

  window.tmap_toggleTraffic = function(viewId, isVisible) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      if (isVisible) state.map.autoTraffic();
      else state.map.trafficAutoClean();
    }
  };
})();
