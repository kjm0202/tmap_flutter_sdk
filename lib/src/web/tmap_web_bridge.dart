import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'package:web/web.dart' as web;

import '../constants/map_type.dart';
import '../models/lat_lng.dart';
import '../models/lat_lng_bounds.dart';
import '../overlays/circle.dart';
import '../overlays/clusterer.dart';
import '../overlays/info_window.dart';
import '../overlays/marker.dart';
import '../overlays/polygon.dart';
import '../overlays/polyline.dart';
import '../overlays/rectangle.dart';
import '../utils/hex_color.dart';

@JS('eval')
external JSAny? _eval(JSString script);

/// TMAP Web Bridge - 브라우저 window 객체에 TMAP 헬퍼 스크립트를 관리하고 인스턴스를 제어
class TMapWebBridge {
  static bool _scriptsInjected = false;

  /// 브라우저에 TMAP 인스턴스 관리 헬퍼 JS 주입
  static void injectHelperScripts() {
    if (_scriptsInjected) return;
    _scriptsInjected = true;

    const jsCode = r'''
(function() {
  window.tmap_instances = window.tmap_instances || {};

  window.tmap_init = function(viewId, containerId, options, callbacks) {
    var maxAttempts = 30;
    var tryInit = function() {
      var container = document.getElementById(containerId);
      if (!container || (container.offsetWidth === 0 && container.offsetHeight === 0)) {
        if (maxAttempts-- > 0) {
          setTimeout(tryInit, 100);
        } else {
          console.warn("[tmap_web_bridge] Container element has 0 size, attempting map creation anyway:", containerId);
        }
        if (!container) return;
      }

      if (typeof Tmapv3 === 'undefined' || !Tmapv3.Map) {
        if (maxAttempts-- > 0) {
          setTimeout(tryInit, 100);
        } else {
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
          zoom: options.zoom || 16,
          width: "100%",
          height: "100%"
        };

        if (options.minZoom) mapOptions.minZoom = options.minZoom;
        if (options.maxZoom) mapOptions.maxZoom = options.maxZoom;
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
          markers: {},
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
          map.on("Click", function(e) {
            if (state.callbacks.onMapTap && e && e.latLng) {
              state.callbacks.onMapTap(e.latLng.lat(), e.latLng.lng());
            }
          });

          map.on("Idle", function() {
            if (state.callbacks.onCameraIdle) {
              var c = map.getCenter();
              state.callbacks.onCameraIdle(c.lat(), c.lng(), map.getZoom(), map.getBearing(), map.getPitch());
            }
          });
        }

        console.log("[tmap_web_bridge] Tmapv3.Map successfully created for viewId:", viewId);

        if (state.callbacks.onMapCreated) {
          state.callbacks.onMapCreated(viewId);
        }
      } catch (err) {
        var errText = "" + (err ? (err.stack || err.message || err.toString()) : "unknown error");
        console.error("[tmap_web_bridge] Failed to initialize Tmapv3.Map:", errText);
      }
    };
    tryInit();
  };

  window.tmap_setCenter = function(viewId, lat, lng) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      state.map.setCenter(new Tmapv3.LatLng(lat, lng));
    }
  };

  window.tmap_setZoom = function(viewId, zoom) {
    var state = window.tmap_instances[viewId];
    if (state && state.map) {
      state.map.setZoom(zoom);
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
      state.map.panTo(new Tmapv3.LatLng(lat, lng));
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

    if (state.markers[m.id]) {
      state.markers[m.id].setMap(null);
    }

    var pos = new Tmapv3.LatLng(m.lat, m.lng);
    var markerOptions = {
      position: pos,
      map: state.map,
      title: m.title || undefined,
      label: m.label ? (m.labelBg ? '<span style="background-color:' + m.labelBg + ';color:' + (m.labelColor || '#fff') + ';padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;">' + m.label + '</span>' : m.label) : undefined,
      visible: m.visible !== false,
      draggable: m.draggable || false,
      zIndex: m.zIndex || 0
    };

    if (m.iconUrl) {
      markerOptions.icon = m.iconUrl;
      if (m.iconW && m.iconH) {
        markerOptions.iconSize = new Tmapv3.Size(m.iconW, m.iconH);
      }
    } else if (m.iconHtml) {
      markerOptions.iconHTML = m.iconHtml;
    }

    var marker = new Tmapv3.Marker(markerOptions);

    marker.on("Click", function() {
      if (state.callbacks.onMarkerTap) {
        state.callbacks.onMarkerTap(m.id, m.lat, m.lng, state.map.getZoom());
      }
    });

    state.markers[m.id] = marker;
  };

  window.tmap_clearMarker = function(viewId, markerId) {
    var state = window.tmap_instances[viewId];
    if (state && state.markers[markerId]) {
      state.markers[markerId].setMap(null);
      delete state.markers[markerId];
    }
  };

  window.tmap_clearAllMarkers = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      for (var id in state.markers) {
        state.markers[id].setMap(null);
      }
      state.markers = {};
    }
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

  window.tmap_clearAll = function(viewId) {
    var state = window.tmap_instances[viewId];
    if (state) {
      for (var mid in state.markers) state.markers[mid].setMap(null);
      for (var iid in state.infoWindows) state.infoWindows[iid].setMap(null);
      for (var pid in state.polylines) state.polylines[pid].setMap(null);
      for (var pgid in state.polygons) state.polygons[pgid].setMap(null);
      for (var cid in state.circles) state.circles[cid].setMap(null);
      for (var rid in state.rectangles) state.rectangles[rid].setMap(null);
      if (state.clusterer) { state.clusterer.destroy(); state.clusterer = null; }
      state.markers = {};
      state.infoWindows = {};
      state.polylines = {};
      state.polygons = {};
      state.circles = {};
      state.rectangles = {};
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
''';

    _eval(jsCode.toJS);
  }

  /// 지도 초기화 호출
  static void initMap({
    required String viewId,
    required String containerId,
    LatLng? center,
    int? zoom,
    int? minZoom,
    int? maxZoom,
    double? bearing,
    double? pitch,
    TMapType? mapType,
    required JSObject callbacks,
  }) {
    injectHelperScripts();

    final options = {
      if (center != null) 'center': [center.latitude, center.longitude],
      if (zoom != null) 'zoom': zoom,
      if (minZoom != null) 'minZoom': minZoom,
      if (maxZoom != null) 'maxZoom': maxZoom,
      if (bearing != null) 'bearing': bearing,
      if (pitch != null) 'pitch': pitch,
      if (mapType != null) 'mapType': mapType.name.toUpperCase(),
    };

    final jsonStr = jsonEncode(options);
    final script =
        'window.tmap_init("$viewId", "$containerId", $jsonStr, window._tmap_callbacks_$viewId);';
    (web.window as JSObject)
        .setProperty('_tmap_callbacks_$viewId'.toJS, callbacks);
    _eval(script.toJS);
  }

  static void setCenter(String viewId, LatLng center) {
    _eval(
        'window.tmap_setCenter("$viewId", ${center.latitude}, ${center.longitude});'
            .toJS);
  }

  static void setZoom(String viewId, int zoom) {
    _eval('window.tmap_setZoom("$viewId", $zoom);'.toJS);
  }

  static void zoomIn(String viewId) {
    _eval('window.tmap_zoomIn("$viewId");'.toJS);
  }

  static void zoomOut(String viewId) {
    _eval('window.tmap_zoomOut("$viewId");'.toJS);
  }

  static void panTo(String viewId, LatLng target) {
    _eval(
        'window.tmap_panTo("$viewId", ${target.latitude}, ${target.longitude});'
            .toJS);
  }

  static void setBearing(String viewId, double bearing) {
    _eval('window.tmap_setBearing("$viewId", $bearing);'.toJS);
  }

  static void setPitch(String viewId, double pitch) {
    _eval('window.tmap_setPitch("$viewId", $pitch);'.toJS);
  }

  static void setMapType(String viewId, TMapType mapType) {
    _eval('window.tmap_setMapType("$viewId", "${mapType.name.toUpperCase()}");'
        .toJS);
  }

  static void fitBounds(String viewId, LatLngBounds bounds, int? padding) {
    final padStr = padding != null ? ', $padding' : '';
    _eval(
        'window.tmap_fitBounds("$viewId", ${bounds.southWest.latitude}, ${bounds.southWest.longitude}, ${bounds.northEast.latitude}, ${bounds.northEast.longitude}$padStr);'
            .toJS);
  }

  static void addMarker(String viewId, Marker marker) {
    final data = {
      'id': marker.markerId,
      'lat': marker.position.latitude,
      'lng': marker.position.longitude,
      if (marker.title != null) 'title': marker.title,
      if (marker.label != null) 'label': marker.label,
      if (marker.labelBackgroundColor != null)
        'labelBg': marker.labelBackgroundColor?.toHexColor(),
      if (marker.labelTextColor != null)
        'labelColor': marker.labelTextColor?.toHexColor(),
      if (marker.icon?.iconUrl != null) 'iconUrl': marker.icon?.iconUrl,
      if (marker.icon?.iconHtml != null) 'iconHtml': marker.icon?.iconHtml,
      if (marker.icon?.size?.width != null) 'iconW': marker.icon?.size?.width,
      if (marker.icon?.size?.height != null) 'iconH': marker.icon?.size?.height,
      'visible': marker.visible,
      'draggable': marker.draggable,
      'zIndex': marker.zIndex,
    };
    final jsonStr = jsonEncode(data);
    _eval('window.tmap_addMarker("$viewId", $jsonStr);'.toJS);
  }

  static void clearMarker(String viewId, String markerId) {
    _eval('window.tmap_clearMarker("$viewId", "$markerId");'.toJS);
  }

  static void clearAllMarkers(String viewId) {
    _eval('window.tmap_clearAllMarkers("$viewId");'.toJS);
  }

  static void addClusterer(String viewId, Clusterer clusterer) {
    final data = {
      'maxZoom': clusterer.maxClusterZoom,
      'minClusterSize': clusterer.minClusterCount,
      'gridSize': clusterer.gridSize,
      'markers': clusterer.markers
          .map((m) => {
                'id': m.markerId,
                'lat': m.position.latitude,
                'lng': m.position.longitude,
                if (m.title != null) 'title': m.title,
              })
          .toList(),
    };
    final jsonStr = jsonEncode(data);
    _eval('window.tmap_addClusterer("$viewId", $jsonStr);'.toJS);
  }

  static void clearClusterer(String viewId) {
    _eval('window.tmap_clearClusterer("$viewId");'.toJS);
  }

  static void addInfoWindow(String viewId, InfoWindow iw) {
    final data = {
      'id': iw.infoWindowId,
      'lat': iw.position.latitude,
      'lng': iw.position.longitude,
      'content': iw.content,
      'type': iw.type,
      if (iw.offset != null) 'offsetX': iw.offset?.x,
      if (iw.offset != null) 'offsetY': iw.offset?.y,
      'visible': iw.visible,
    };
    final jsonStr = jsonEncode(data);
    _eval('window.tmap_addInfoWindow("$viewId", $jsonStr);'.toJS);
  }

  static void clearInfoWindow(String viewId, String infoWindowId) {
    _eval('window.tmap_clearInfoWindow("$viewId", "$infoWindowId");'.toJS);
  }

  static void clearAllInfoWindows(String viewId) {
    _eval('window.tmap_clearAllInfoWindows("$viewId");'.toJS);
  }

  static void addPolyline(String viewId, Polyline polyline) {
    final data = {
      'id': polyline.polylineId,
      'points': polyline.points
          .map((p) => {'lat': p.latitude, 'lng': p.longitude})
          .toList(),
      'strokeColor': polyline.strokeColor?.toHexColor() ?? '#0066FF',
      'strokeOpacity': polyline.strokeOpacity,
      'strokeWidth': polyline.strokeWidth,
      'direction': polyline.direction,
      'zIndex': polyline.zIndex,
    };
    final jsonStr = jsonEncode(data);
    _eval('window.tmap_addPolyline("$viewId", $jsonStr);'.toJS);
  }

  static void clearPolyline(String viewId, String polylineId) {
    _eval('window.tmap_clearPolyline("$viewId", "$polylineId");'.toJS);
  }

  static void clearAllPolylines(String viewId) {
    _eval('window.tmap_clearAllPolylines("$viewId");'.toJS);
  }

  static void addCircle(String viewId, Circle circle) {
    final data = {
      'id': circle.circleId,
      'lat': circle.center.latitude,
      'lng': circle.center.longitude,
      'radius': circle.radius,
      'fillColor': circle.fillColor?.toHexColor() ?? '#FF0000',
      'fillOpacity': circle.fillOpacity,
      'strokeColor': circle.strokeColor?.toHexColor() ?? '#FF0000',
      'strokeOpacity': circle.strokeOpacity,
      'strokeWidth': circle.strokeWidth,
      'zIndex': circle.zIndex,
    };
    final jsonStr = jsonEncode(data);
    _eval('window.tmap_addCircle("$viewId", $jsonStr);'.toJS);
  }

  static void addPolygon(String viewId, Polygon polygon) {
    final data = {
      'id': polygon.polygonId,
      'points': polygon.points
          .map((p) => {'lat': p.latitude, 'lng': p.longitude})
          .toList(),
      'fillColor': polygon.fillColor?.toHexColor() ?? '#0066FF',
      'fillOpacity': polygon.fillOpacity,
      'strokeColor': polygon.strokeColor?.toHexColor() ?? '#0066FF',
      'strokeOpacity': polygon.strokeOpacity,
      'strokeWidth': polygon.strokeWidth,
      'zIndex': polygon.zIndex,
    };
    final jsonStr = jsonEncode(data);
    _eval('window.tmap_addPolygon("$viewId", $jsonStr);'.toJS);
  }

  static void addRectangle(String viewId, Rectangle rect) {
    final data = {
      'id': rect.rectangleId,
      'swLat': rect.bounds.southWest.latitude,
      'swLng': rect.bounds.southWest.longitude,
      'neLat': rect.bounds.northEast.latitude,
      'neLng': rect.bounds.northEast.longitude,
      'fillColor': rect.fillColor?.toHexColor() ?? '#0066FF',
      'fillOpacity': rect.fillOpacity,
      'strokeColor': rect.strokeColor?.toHexColor() ?? '#0066FF',
      'strokeOpacity': rect.strokeOpacity,
      'strokeWidth': rect.strokeWidth,
      'zIndex': rect.zIndex,
    };
    final jsonStr = jsonEncode(data);
    _eval('window.tmap_addRectangle("$viewId", $jsonStr);'.toJS);
  }

  static void clearAll(String viewId) {
    _eval('window.tmap_clearAll("$viewId");'.toJS);
  }

  static void toggleTraffic(String viewId, bool isVisible) {
    _eval('window.tmap_toggleTraffic("$viewId", $isVisible);'.toJS);
  }
}
