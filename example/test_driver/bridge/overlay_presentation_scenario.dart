import 'dart:async';
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const String _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';

const String _clustererExpr =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null))';

// 1x1 valid PNG data URI to avoid any external network request.
const String _localDataUriPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/// Executes visual overlay presentation regression scenarios:
/// - Marker visual presentation (local data-URI, custom size/offset, title, normalized label colors, visible/hidden update)
/// - InfoWindow visual presentation & replacement (visible false -> true, explicit type/border/offset, DOM verification)
/// - Cluster dynamic split and regroup across maxClusterZoom threshold, preserving standalone marker
/// - Shape drawing style checks (representative stroke and fill colors/widths from real runtime)
Future<void> testOverlayPresentation([TMapController? _]) async {
  final controller = await mountLiveMap(
    (created) => TMap(
      onMapCreated: created,
    ),
  );

  try {
    const centerPos = LatLng(37.5665, 126.9780);
    await controller.setCenter(centerPos);
    await controller.setZoom(12);

    await expectLive(
      'camera initialization at zoom 12',
      () => checkJs(
        controller,
        'Math.round(map.getZoom ? map.getZoom() : 0) === 12',
      ),
    );

    // ── Phase 1: Marker visual presentation & visible/hidden update ──────
    const markerId = 'pres_marker';
    await controller.addMarker(Marker(
      markerId: markerId,
      position: centerPos,
      icon: const MarkerIcon(
        iconUrl: _localDataUriPng,
        size: Size(32, 32),
        offset: Point(16, 32),
      ),
      title: 'PresMarkerTitle',
      label: 'PresLabel',
      labelBackgroundColor: const Color(0xFF00FF00),
      labelTextColor: const Color(0xFF0000FF),
      visible: true,
    ));

    await expectLive(
      'marker visual presentation with local data-URI, size, offset, title and normalized label colors',
      () => checkJs(
        controller,
        '''(function() {
          var reg = $_reg;
          var m = reg?.markers?.["$markerId"];
          if (!m || !m.getMap || m.getMap() == null) return false;

          var el = null;
          if (m._marker_data?.vsmMarker?.getElement) {
            try { el = m._marker_data.vsmMarker.getElement(); } catch(_) {}
          }
          if (!el && typeof m.getElement === "function") {
            try { el = m.getElement(); } catch(_) {}
          }

          var iconSrc = "";
          if (typeof m.getIcon === "function") iconSrc = m.getIcon() || "";
          if (!iconSrc && m._marker_data?.options?.icon) iconSrc = m._marker_data.options.icon;
          if (!iconSrc && el) {
            var img = el.querySelector("img");
            if (img) iconSrc = img.src || "";
          }
          if (!iconSrc || iconSrc.indexOf("data:image/png") === -1) return false;

          var sizeOk = false;
          if (typeof m.getIconSize === "function") {
            var sz = m.getIconSize();
            if (sz && (sz.width === 32 || sz._width === 32) && (sz.height === 32 || sz._height === 32)) sizeOk = true;
          }
          if (!sizeOk && m._marker_data?.options?.iconSize) {
            var isz = m._marker_data.options.iconSize;
            if (isz && (isz.width === 32 || isz._width === 32) && (isz.height === 32 || isz._height === 32)) sizeOk = true;
          }
          if (!sizeOk && el) {
            var img = el.querySelector("img");
            if (img) {
              var w = img.width || parseInt(img.style.width, 10);
              var h = img.height || parseInt(img.style.height, 10);
              if (w === 32 && h === 32) sizeOk = true;
            }
          }
          if (!sizeOk) return false;

          var off = null;
          if (m._marker_data?.vsmMarker?.getOffset) {
            try { off = m._marker_data.vsmMarker.getOffset(); } catch(_) {}
          }
          if (!off && m._marker_data?.options?.offset) {
            off = m._marker_data.options.offset;
          }
          if (!off && typeof m.getOffset === "function") {
            try { off = m.getOffset(); } catch(_) {}
          }
          if (!off || (off.x !== 16 && off._x !== 16) || (off.y !== 32 && off._y !== 32)) return false;

          var titleOk = false;
          if (typeof m.getTitle === "function" && m.getTitle() === "PresMarkerTitle") titleOk = true;
          if (!titleOk && m._marker_data?.options?.title === "PresMarkerTitle") titleOk = true;
          if (!titleOk && el && (el.title === "PresMarkerTitle" || el.getAttribute("title") === "PresMarkerTitle")) titleOk = true;
          if (!titleOk) return false;

          function norm(c) {
            if (!c) return "";
            c = String(c).trim().toLowerCase();
            if (c.startsWith("#")) {
              if (c.length === 4) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
              return c;
            }
            var match = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            if (match) {
              var r = ("0" + parseInt(match[1], 10).toString(16)).slice(-2);
              var g = ("0" + parseInt(match[2], 10).toString(16)).slice(-2);
              var b = ("0" + parseInt(match[3], 10).toString(16)).slice(-2);
              return "#" + r + g + b;
            }
            if (c === "red") return "#ff0000";
            return c;
          }

          var lOpt = m._marker_data?.options?.labelOption;
          var bgOk = false;
          var fgOk = false;
          if (lOpt) {
            if (norm(lOpt.backgroundColor) === "#00ff00") bgOk = true;
            if (norm(lOpt.color) === "#0000ff") fgOk = true;
          }
          if ((!bgOk || !fgOk) && el) {
            var all = el.querySelectorAll("*");
            for (var i = 0; i < all.length; i++) {
              var n = all[i];
              if ((n.textContent || "").indexOf("PresLabel") !== -1) {
                var comp = window.getComputedStyle ? window.getComputedStyle(n) : null;
                var b = norm(n.style.backgroundColor || (comp ? comp.backgroundColor : ""));
                var f = norm(n.style.color || (comp ? comp.color : ""));
                if (b === "#00ff00") bgOk = true;
                if (f === "#0000ff") fgOk = true;
              }
            }
          }
          if (!bgOk || !fgOk) return false;

          if (typeof m.getVisible === "function" && !m.getVisible()) return false;
          if (el && (el.style.display === "none" || el.style.visibility === "hidden")) return false;

          return true;
        })()''',
      ),
    );

    // Update marker to visible: false
    await controller.addMarker(Marker(
      markerId: markerId,
      position: centerPos,
      icon: const MarkerIcon(
        iconUrl: _localDataUriPng,
        size: Size(32, 32),
      ),
      visible: false,
    ));

    await expectLive(
      'marker updated to visible: false reflected in SDK/DOM',
      () => checkJs(
        controller,
        '''(function() {
          var reg = $_reg;
          var m = reg?.markers?.["$markerId"];
          if (!m) return true;
          if (typeof m.getMap === "function" && m.getMap() == null) return true;
          var el = null;
          if (m._marker_data?.vsmMarker?.getElement) {
            try { el = m._marker_data.vsmMarker.getElement(); } catch(_) {}
          }
          if (!el && typeof m.getElement === "function") {
            try { el = m.getElement(); } catch(_) {}
          }
          if (!el || !el.isConnected) return true;
          var curr = el;
          while (curr && curr !== document && curr.nodeType === 1) {
            if (curr.style.display === "none" || curr.style.visibility === "hidden") return true;
            if (window.getComputedStyle) {
              var comp = window.getComputedStyle(curr);
              if (comp && (comp.display === "none" || comp.visibility === "hidden")) return true;
            }
            curr = curr.parentElement;
          }
          return false;
        })()''',
      ),
    );

    await controller.clearMarker(markerId);

    // ── Phase 2: InfoWindow visible false to true replacement & style ────
    const infoWindowId = 'pres_iw';
    const hiddenDomId = 'pres-iw-hidden';
    const visibleDomId = 'pres-iw-visible';

    // Step 2A: Add InfoWindow with visible: false
    await controller.addInfoWindow(const InfoWindow(
      infoWindowId: infoWindowId,
      position: centerPos,
      content: '<div id="$hiddenDomId"><span>Hidden Content</span></div>',
      type: 2,
      border: '2px solid #ff0000',
      offset: Point(12, -28),
      visible: false,
    ));

    await expectLive(
      'infoWindow initially hidden (visible: false)',
      () => checkJs(
        controller,
        '''(function() {
          var el = document.getElementById("$hiddenDomId");
          if (!el) return true;
          if (!el.isConnected) return true;
          var curr = el;
          while (curr && curr !== document && curr.nodeType === 1) {
            if (curr.style.display === "none" || curr.style.visibility === "hidden") return true;
            if (window.getComputedStyle) {
              var comp = window.getComputedStyle(curr);
              if (comp && (comp.display === "none" || comp.visibility === "hidden")) return true;
            }
            curr = curr.parentElement;
          }
          return false;
        })()''',
      ),
    );

    // Step 2B: Replace same ID with visible: true, explicit popup type/border/offset
    await controller.addInfoWindow(const InfoWindow(
      infoWindowId: infoWindowId,
      position: centerPos,
      content: '<div id="$visibleDomId"><span>Visible Content</span></div>',
      type: 2,
      border: '2px solid #ff0000',
      offset: Point(12, -28),
      visible: true,
    ));

    await expectLive(
      'infoWindow replaced with visible: true, explicit type 2 and offset',
      () => checkJs(
        controller,
        '''(function() {
          var reg = $_reg;
          var iw = reg?.infoWindows?.["$infoWindowId"];
          if (!iw || (iw.getMap && iw.getMap() == null)) return false;

          var oldEl = document.getElementById("$hiddenDomId");
          if (oldEl && oldEl.isConnected && window.getComputedStyle && getComputedStyle(oldEl).display !== "none") return false;

          var el = document.getElementById("$visibleDomId");
          if (!el || !el.isConnected) return false;
          if ((el.textContent || "").indexOf("Visible Content") === -1) return false;
          if (window.getComputedStyle && getComputedStyle(el).display === "none") return false;

          if (typeof iw.getVisible === "function" && !iw.getVisible()) return false;
          if (iw._iw_data?.options?.visible === false) return false;

          var typeOk = false;
          if (iw._iw_data?.options?.type === 2) typeOk = true;
          if (!typeOk && typeof iw.getType === "function" && iw.getType() === 2) typeOk = true;
          if (!typeOk) return false;

          var off = null;
          if (iw._iw_data?.vsmMarker?.getOffset) {
            try { off = iw._iw_data.vsmMarker.getOffset(); } catch(_) {}
          }
          if (!off && iw._iw_data?.options?.offset) off = iw._iw_data.options.offset;
          if (!off && typeof iw.getOffset === "function") {
            try { off = iw.getOffset(); } catch(_) {}
          }
          if (!off || (off.x !== 12 && off._x !== 12) || (off.y !== -28 && off._y !== -28)) return false;

          function norm(c) {
            if (!c) return "";
            c = String(c).trim().toLowerCase();
            if (c.startsWith("#")) {
              if (c.length === 4) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
              return c;
            }
            var match = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            if (match) {
              var r = ("0" + parseInt(match[1], 10).toString(16)).slice(-2);
              var g = ("0" + parseInt(match[2], 10).toString(16)).slice(-2);
              var b = ("0" + parseInt(match[3], 10).toString(16)).slice(-2);
              return "#" + r + g + b;
            }
            if (c === "red") return "#ff0000";
            return c;
          }

          var markerContainer = el.closest ? el.closest(".vsm-marker") : null;
          if (!markerContainer) return false;
          var compStyle = window.getComputedStyle ? window.getComputedStyle(markerContainer) : null;
          if (!compStyle) return false;

          var bw = compStyle.borderTopWidth || compStyle.borderWidth;
          var bs = compStyle.borderTopStyle || compStyle.borderStyle;
          var bc = compStyle.borderTopColor || compStyle.borderColor;

          var widthOk = false;
          var declaredBw = markerContainer.style ? (markerContainer.style.borderTopWidth || markerContainer.style.borderWidth || "").trim() : "";
          if (declaredBw === "2px" || bw === "2px") {
            widthOk = true;
          } else {
            var ref = document.createElement("div");
            ref.style.border = "2px solid #ff0000";
            ref.style.position = "absolute";
            ref.style.visibility = "hidden";
            (markerContainer.parentElement || document.body || document.documentElement).appendChild(ref);
            var refComp = window.getComputedStyle ? window.getComputedStyle(ref) : null;
            var refBw = refComp ? (refComp.borderTopWidth || refComp.borderWidth || "").trim() : "";
            if (ref.parentNode) ref.parentNode.removeChild(ref);
            if (refBw && (bw === refBw || Math.abs(parseFloat(bw) - parseFloat(refBw)) < 0.05)) {
              widthOk = true;
            }
          }
          if (!widthOk) return false;
          if (bs !== "solid") return false;
          if (norm(bc) !== "#ff0000") return false;

          return true;
        })()''',
      ),
    );

    await controller.clearInfoWindow(infoWindowId);
    await expectLive(
      'infoWindow cleared from DOM',
      () => checkJs(
        controller,
        '''(function() {
          var el = document.getElementById("$visibleDomId");
          return !el || !el.isConnected;
        })()''',
      ),
    );

    // ── Phase 3: Cluster zoom split and regrouping across maxClusterZoom ──
    const standaloneId = 'pres_standalone';
    const standalonePos = LatLng(37.5800, 126.9800);
    await controller.addMarker(const Marker(
      markerId: standaloneId,
      position: standalonePos,
      title: 'PresStandalone',
    ));

    await expectLive(
      'standalone marker visible before clustering',
      () => checkJs(
        controller,
        'Boolean($_reg?.markers?.["$standaloneId"]?.getMap())',
      ),
    );

    // Max cluster zoom is set to 14. Zoom <= 14 groups, zoom > 14 splits.
    const clusterMaxZoom = 14;
    await controller.addMarkerClusterer(const Clusterer(
      markers: [
        Marker(markerId: 'c_m1', position: LatLng(37.5665, 126.9780)),
        Marker(markerId: 'c_m2', position: LatLng(37.5667, 126.9782)),
        Marker(markerId: 'c_m3', position: LatLng(37.5669, 126.9784)),
      ],
      maxClusterZoom: clusterMaxZoom,
      minClusterCount: 2,
      gridSize: 80,
    ));

    // Step 3A: At zoom 12 (<= 14), cluster is grouped into group symbol
    await expectLive(
      'cluster grouped at zoom 12 with individual symbols hidden and standalone marker preserved',
      () => checkJs(
        controller,
        '''(function() {
          var cl = $_clustererExpr;
          if (!cl || !cl._cluster_data) return false;
          var gm = cl._cluster_data.clusterMarkers;
          if (!Array.isArray(gm) || gm.length === 0) return false;
          var groupDisplayed = gm.some(function(g) { return g && g.getMap() != null; });
          if (!groupDisplayed) return false;
          var mem = cl._cluster_data.markers;
          if (!Array.isArray(mem) || mem.length !== 3) return false;
          if (!mem.every(function(m) { return m && m.getMap() == null; })) return false;
          var sm = $_reg?.markers?.["$standaloneId"];
          return Boolean(sm && sm.getMap() != null);
        })()''',
      ),
    );

    // Step 3B: Zoom to 16 (> 14), cluster dynamically splits into individual symbols
    await controller.setZoom(16);
    await expectLive(
      'cluster dynamically splits above maxClusterZoom (zoom 16) into individual symbols',
      () => checkJs(
        controller,
        '''(function() {
          if (Math.round(map.getZoom ? map.getZoom() : 0) !== 16) return false;
          var cl = $_clustererExpr;
          if (!cl || !cl._cluster_data) return false;
          var gm = cl._cluster_data.clusterMarkers;
          var noGroup = !Array.isArray(gm) || gm.length === 0 || gm.every(function(g) { return !g || g.getMap() == null; });
          if (!noGroup) return false;
          var mem = cl._cluster_data.markers;
          if (!Array.isArray(mem) || mem.length !== 3) return false;
          if (!mem.every(function(m) { return m && m.getMap() != null; })) return false;
          var sm = $_reg?.markers?.["$standaloneId"];
          return Boolean(sm && sm.getMap() != null);
        })()''',
      ),
    );

    // Step 3C: Zoom back to 12 (<= 14), cluster dynamically regroups
    await controller.setZoom(12);
    await expectLive(
      'cluster dynamically regroups below maxClusterZoom (zoom 12)',
      () => checkJs(
        controller,
        '''(function() {
          if (Math.round(map.getZoom ? map.getZoom() : 0) !== 12) return false;
          var cl = $_clustererExpr;
          if (!cl || !cl._cluster_data) return false;
          var gm = cl._cluster_data.clusterMarkers;
          if (!Array.isArray(gm) || gm.length === 0) return false;
          var groupDisplayed = gm.some(function(g) { return g && g.getMap() != null; });
          if (!groupDisplayed) return false;
          var mem = cl._cluster_data.markers;
          if (!Array.isArray(mem) || mem.length !== 3) return false;
          if (!mem.every(function(m) { return m && m.getMap() == null; })) return false;
          var sm = $_reg?.markers?.["$standaloneId"];
          return Boolean(sm && sm.getMap() != null);
        })()''',
      ),
    );

    await controller.clearMarkerClusterer();
    await controller.clearMarker(standaloneId);

    // ── Phase 4: Drawing style checks for representative stroke/fill ─────
    const lineId = 'style_pres_line';
    const polyId = 'style_pres_poly';
    const circleId = 'style_pres_circle';

    await controller.addPolyline(const Polyline(
      polylineId: lineId,
      points: [LatLng(37.5665, 126.9780), LatLng(37.5680, 126.9800)],
      strokeColor: Color(0xFF0066FF),
      strokeWidth: 5,
    ));

    await controller.addPolygon(const Polygon(
      polygonId: polyId,
      points: [
        LatLng(37.5665, 126.9780),
        LatLng(37.5680, 126.9780),
        LatLng(37.5680, 126.9800),
      ],
      fillColor: Color(0xFF00FF00),
      strokeColor: Color(0xFFFF0000),
      strokeWidth: 3,
    ));

    await controller.addCircle(const Circle(
      circleId: circleId,
      center: LatLng(37.5665, 126.9780),
      radius: 120,
      fillColor: Color(0xFFFF00FF),
      strokeColor: Color(0xFF00FFFF),
      strokeWidth: 4,
    ));

    await expectLive(
      'drawing styles applied with normalized stroke and fill from real runtime',
      () => checkJs(
        controller,
        '''(function() {
          var reg = $_reg;
          function norm(c) {
            if (!c) return "";
            c = String(c).trim().toLowerCase();
            if (c.startsWith("#")) {
              if (c.length === 4) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
              return c;
            }
            var match = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            if (match) {
              var r = ("0" + parseInt(match[1], 10).toString(16)).slice(-2);
              var g = ("0" + parseInt(match[2], 10).toString(16)).slice(-2);
              var b = ("0" + parseInt(match[3], 10).toString(16)).slice(-2);
              return "#" + r + g + b;
            }
            return c;
          }

          var line = reg?.polylines?.["$lineId"];
          var poly = reg?.polygons?.["$polyId"];
          var circle = reg?.circles?.["$circleId"];
          if (!line || !poly || !circle) return false;
          if (!line.getMap() || !poly.getMap() || !circle.getMap()) return false;

          var lineData = line._shape_data;
          var polyData = poly._shape_data;
          var circleData = circle._shape_data;
          if (!lineData || !polyData || !circleData) return false;

          var mapObj = (typeof map !== "undefined" && map) ? map : (reg && reg.map ? reg.map : line.getMap());
          if (!mapObj || typeof mapObj.vsmMap !== "function") return false;
          var vsm = mapObj.vsmMap();
          if (!vsm || typeof vsm.hasLayer !== "function") return false;

          if (!lineData.layerId || !vsm.hasLayer(lineData.layerId)) return false;
          if (!polyData.layerId || !vsm.hasLayer(polyData.layerId)) return false;
          if (!circleData.layerId || !vsm.hasLayer(circleData.layerId)) return false;

          var lineStyle = lineData.vsmStyle;
          var polyStyle = polyData.vsmStyle;
          var circleStyle = circleData.vsmStyle;
          if (!lineStyle || !polyStyle || !circleStyle) return false;

          if (norm(lineStyle.stroke || lineStyle.strokeColor) !== "#0066ff") return false;
          var lw = lineStyle["stroke-width"] != null ? Number(lineStyle["stroke-width"]) : Number(lineStyle.strokeWidth);
          if (lw !== 5) return false;

          if (norm(polyStyle.fill || polyStyle.fillColor) !== "#00ff00") return false;
          if (norm(polyStyle.stroke || polyStyle.strokeColor) !== "#ff0000") return false;
          var pw = polyStyle["stroke-width"] != null ? Number(polyStyle["stroke-width"]) : Number(polyStyle.strokeWidth);
          if (pw !== 3) return false;

          if (norm(circleStyle.fill || circleStyle.fillColor) !== "#ff00ff") return false;
          if (norm(circleStyle.stroke || circleStyle.strokeColor) !== "#00ffff") return false;
          var cw = circleStyle["stroke-width"] != null ? Number(circleStyle["stroke-width"]) : Number(circleStyle.strokeWidth);
          if (cw !== 4) return false;

          return true;
        })()''',
      ),
    );

    await controller.clearPolyline(lineId);
    await controller.clearPolygon(polyId);
    await controller.clearCircle(circleId);
  } finally {
    await unmountLiveMap();
  }
}
