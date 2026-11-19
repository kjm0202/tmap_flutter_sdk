import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _reg =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0] : window)';
const _cluster =
    '($_reg.clusterer || $_reg.markerCluster || (typeof markerCluster !== "undefined" ? markerCluster : null))';

/// Covers Marker get/set value adaptation, SDK options, and live pointer events.
Future<void> testMarkerContract() async {
  final events = <MarkerInteraction>[];
  final controller = await mountLiveMap((ready) => TMap(onMapCreated: ready));
  void handle(MarkerInteraction event) => events.add(event);
  const id = 'contract-marker';
  const initial = Marker(
    markerId: id,
    position: LatLng(37.5665, 126.978),
    title: 'Contract title',
    titleStyle: {'fontSize': '15px'},
    contextMenu: {
      'items': ['Inspect']
    },
    zIndex: 13,
  );
  try {
    await controller.setCenter(initial.position);
    await controller.setZoom(14);
    controller.onMarkerEvent(id, MarkerInteractionType.mouseenter, handle);
    controller.onMarkerEvent(id, MarkerInteractionType.mouseleave, handle);
    controller.onMarkerEvent(id, MarkerInteractionType.click, handle);
    await controller.addMarker(initial);
    try {
      await expectLive('marker constructor options and SDK getter readback',
          () => checkJs(controller, '''(function(){
      var m=$_reg.markers?.['$id'];
      if (!m || !m.getPosition || !m.getZIndex) return false;
      var p=m.getPosition(), o=m._marker_data?.options;
      if (Math.abs(p.lat()-37.5665)>0.00001 || Math.abs(p.lng()-126.978)>0.00001 || m.getZIndex()!==13) return false;
      return o?.titleOption?.fontSize==='15px' &&
        m.getContextMenu?.()?.items?.[0]==='Inspect';
    })()'''));
    } catch (_) {
      final diag = await runJs(controller, '''(function(){
        var m=$_reg.markers?.['$id'], o=m?._marker_data?.options;
        var v=m?._marker_data?.vsmMarkerOption;
        var menu=null;
        try { menu=m?.getContextMenu?.(); } catch(_) {}
        return {present:!!m, getPosition:typeof m?.getPosition,
          position:m?.getPosition?.() ? [m.getPosition().lat(),m.getPosition().lng()] : null,
          getZIndex:typeof m?.getZIndex, zIndex:m?.getZIndex?.(),
          optionKeys:Object.keys(o||{}), vsmKeys:Object.keys(v||{}),
          titleOption:o?.titleOption||null, menuOptionType:typeof o?.contextMenu,
          getContextMenu:typeof m?.getContextMenu, menuKeys:Object.keys(menu||{})};
      })()''');
      throw StateError('marker contract SDK readback: $diag');
    }

    // SDK receives synthetic DOM pointer input; the callback still traverses
    // SDK Marker#on -> JS bridge -> typed Dart listener.
    await expectLive('marker hover and click callbacks carry typed fields',
        () async {
      final triggered = await checkJs(controller, '''(function(){
        var m=$_reg.markers?.['$id'];
        var el=m?._marker_data?.vsmMarker?.getElement?.();
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
        el.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true}));
        el.click();
        return true;
      })()''');
      return triggered &&
          events.any((e) =>
              e.type == MarkerInteractionType.mouseenter &&
              e.markerId == id &&
              e.zoom == 14) &&
          events.any((e) =>
              e.type == MarkerInteractionType.mouseleave &&
              e.position.latitude > 37) &&
          events.any(
              (e) => e.type == MarkerInteractionType.click && e.markerId == id);
    });
    final before = events.length;
    controller.offMarkerEvent(id, MarkerInteractionType.mouseenter, handle);
    controller.offMarkerEvent(id, MarkerInteractionType.mouseleave, handle);
    controller.offMarkerEvent(id, MarkerInteractionType.click, handle);
    await expectLive('marker off stops hover and click callbacks', () async {
      final dispatched = await checkJs(controller, '''(function(){
      var el=$_reg.markers?.['$id']?._marker_data?.vsmMarker?.getElement?.();
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); el.click(); return true;
    })()''');
      return dispatched && events.length == before;
    });

    final moved = initial.copyWith(
        position: const LatLng(37.567, 126.979),
        zIndex: 42,
        titleStyle: {
          'fontSize': '18px'
        },
        contextMenu: {
          'items': ['Updated']
        });
    await controller.addMarker(moved);
    try {
      await expectLive('marker position zIndex menu and title updated in SDK',
          () => checkJs(controller, '''(function(){
      var m=$_reg.markers?.['$id'], p=m?.getPosition?.(), o=m?._marker_data?.options;
      return !!p && Math.abs(p.lat()-37.567)<0.00001 && Math.abs(p.lng()-126.979)<0.00001 &&
        m.getZIndex()===42 && o?.titleOption?.fontSize==='18px' && m.getContextMenu?.()?.items?.[0]==='Updated';
    })()'''));
    } catch (_) {
      final diag = await runJs(controller, '''(function(){
        var m=$_reg.markers?.['$id'], p=m?.getPosition?.(), o=m?._marker_data?.options;
        return {position:p?[p.lat(),p.lng()]:null, zIndex:m?.getZIndex?.(),
          rawZIndex:o?.zIndex, titleOption:o?.titleOption||null,
          contextItems:m?.getContextMenu?.()?.items||null};
      })()''');
      throw StateError('marker replacement SDK readback: $diag');
    }
  } finally {
    await controller.clearMarker(id);
    await unmountLiveMap();
  }
}

/// Covers Clusterer config readback, membership updates and SDK group events.
Future<void> testClusterContract() async {
  final events = <ClusterInteraction>[];
  final controller = await mountLiveMap((ready) => TMap(onMapCreated: ready));
  void handle(ClusterInteraction event) => events.add(event);
  const cluster = Clusterer(
    markers: [
      Marker(markerId: 'ca', position: LatLng(37.5665, 126.978)),
      Marker(markerId: 'cb', position: LatLng(37.5666, 126.9781)),
    ],
    maxClusterZoom: 15,
    minClusterCount: 2,
    gridSize: 48,
    opacity: 0.6,
    visible: true,
    zIndex: 110,
    icons: [
      {'icon': 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'}
    ],
  );
  try {
    await controller.setCenter(const LatLng(37.5665, 126.978));
    await controller.setZoom(12);
    controller.onClusterEvent(ClusterInteractionType.mouseenter, handle);
    controller.onClusterEvent(ClusterInteractionType.mouseleave, handle);
    await controller.addMarkerClusterer(cluster);
    await expectLive('cluster constructor options and two member grouping',
        () => checkJs(controller, '''(function(){
      var cl=$_cluster, d=cl?._cluster_data;
      return !!d && d.markers?.length===2 && d.clusterMarkers?.length===1 &&
        d.clusterMarkers[0].getMap()!=null;
    })()'''));
    try {
      await expectLive(
          'cluster options grid zoom count icons opacity visible zIndex SDK readback',
          () => checkJs(controller, '''(function(){
        var d=$_cluster?._cluster_data, o=d?.options || d;
        return !!o && o.gridSize===48 && o.maxClusterZoom===15 &&
          o.minClusterCount===2 && o.opacity===0.6 && o.visible===true &&
          o.zIndex===110 && Array.isArray(o.icons) && o.icons.length===1;
      })()'''));
    } catch (_) {
      final diag = await runJs(controller, '''(function(){
        var d=$_cluster?._cluster_data, o=d?.options || d;
        return {dataKeys:Object.keys(d||{}), optionKeys:Object.keys(o||{}),
          gridSize:o?.gridSize||null, maxZoom:o?.maxClusterZoom||null,
          minCount:o?.minClusterCount||null, opacity:o?.opacity||null,
          visible:o?.visible, zIndex:o?.zIndex||null,
          iconsCount:Array.isArray(o?.icons)?o.icons.length:null};
      })()''');
      throw StateError('cluster SDK option readback: $diag');
    }
    // Invoke the real SDK-created cluster's configured callbacks; assert typed
    // center, zoom and IDs after traversal through the Flutter web bridge.
    await expectLive('cluster hover callbacks contain typed member ids',
        () async {
      final sent = await checkJs(controller, '''(function(){
        var cl=$_cluster, d=cl?._cluster_data, group=d?.clusterMarkers?.[0];
        if (!cl || !group) return false;
        var o=d.options || d;
        var enter=o.onClusterMouseEnter || cl.onClusterMouseEnter;
        var leave=o.onClusterMouseLeave || cl.onClusterMouseLeave;
        if (typeof enter!=='function' || typeof leave!=='function') return false;
        var original={center:group.getPosition(),markers:d.markers};
        enter(original); leave(original); return true;
      })()''');
      return sent &&
          events.any((e) =>
              e.type == ClusterInteractionType.mouseenter &&
              e.markerIds.contains('ca') &&
              e.zoom == 12) &&
          events.any((e) =>
              e.type == ClusterInteractionType.mouseleave &&
              e.markerIds.contains('cb'));
    });
    final before = events.length;
    controller.offClusterEvent(ClusterInteractionType.mouseenter, handle);
    controller.offClusterEvent(ClusterInteractionType.mouseleave, handle);
    await expectLive('cluster off stops hover callbacks', () async {
      final dispatched = await checkJs(controller, '''(function(){
      var d=$_cluster?._cluster_data, f=d?.options?.onClusterMouseEnter;
      if (typeof f==='function') f({center:d.clusterMarkers[0].getPosition(),markers:d.markers}); return true;
    })()''');
      return dispatched && events.length == before;
    });

    await controller.addMarkerClusterer(cluster.addMarker(
        const Marker(markerId: 'cc', position: LatLng(37.5667, 126.9782))));
    await expectLive(
        'cluster addMarker updates three SDK members',
        () => checkJs(
            controller, '$_cluster?._cluster_data?.markers?.length===3'));
    await controller.addMarkerClusterer(cluster
        .addMarker(
            const Marker(markerId: 'cc', position: LatLng(37.5667, 126.9782)))
        .removeMarker('cb'));
    await expectLive('cluster removeMarker updates SDK members',
        () => checkJs(controller, '''(function(){
      var ms=$_cluster?._cluster_data?.markers;
      return ms?.length===2 && ms.every(function(m){return m._customMarkerId!=='cb';});
    })()'''));
    await controller.addMarkerClusterer(
        cluster.copyWith(opacity: 0.3, visible: false, zIndex: 9));
    await expectLive(
        'cluster setOpacity setVisible setZIndex recreate with options',
        () => checkJs(controller, '''(function(){
      var d=$_cluster?._cluster_data, o=d?.options || d;
      return !!o && (o.opacity===0.3 || d.opacity===0.3) &&
        (o.visible===false || d.visible===false) && (o.zIndex===9 || d.zIndex===9);
    })()'''));
    await controller.clearClusterMarkers();
    await expectLive(
        'clearClusterMarkers keeps SDK clusterer and clears members',
        () => checkJs(controller, '''(function(){
      var cl=$_cluster;
      return !!cl && cl._cluster_data?.markers?.length===0;
    })()'''));
  } finally {
    await controller.clearMarkerClusterer();
    await unmountLiveMap();
  }
}

/// Covers InfoWindow anchor, getter equivalents and position updates.
Future<void> testInfoWindowContract() async {
  final controller = await mountLiveMap((ready) => TMap(onMapCreated: ready));
  const popup = InfoWindow(
    infoWindowId: 'contract-info',
    position: LatLng(37.5665, 126.978),
    content: '<div id="contract-info-content">First</div>',
    anchor: 'top',
  );
  try {
    await controller.setCenter(popup.position);
    await controller.addInfoWindow(popup);
    await expectLive('infoWindow anchor position and content SDK readback',
        () => checkJs(controller, '''(function(){
      var iw=$_reg.infoWindows?.['contract-info'];
      var p=iw?.getPosition?.(), o=iw?._iw_data?.options;
      return !!p && Math.abs(p.lat()-37.5665)<0.00001 &&
        (iw.getAnchor?.()==='top' || o?.anchor==='top') &&
        (iw.getContent?.().includes('First') || o?.content?.includes('First'));
    })()'''));
    final moved = popup.copyWith(
        position: const LatLng(37.567, 126.979),
        content: '<div id="contract-info-content">Second</div>');
    await controller.addInfoWindow(moved);
    await expectLive('infoWindow setPosition via immutable replacement',
        () => checkJs(controller, '''(function(){
      var iw=$_reg.infoWindows?.['contract-info'], p=iw?.getPosition?.();
      return !!p && Math.abs(p.lat()-37.567)<0.00001 &&
        Math.abs(p.lng()-126.979)<0.00001 && iw.getContent?.().includes('Second');
    })()'''));
  } finally {
    await controller.clearInfoWindow(popup.infoWindowId);
    await unmountLiveMap();
  }
}

/// Covers native Label position getters, zoom limits and immutable updates.
Future<void> testLabelContract() async {
  final controller = await mountLiveMap((ready) => TMap(onMapCreated: ready));
  const label = Label(
    labelId: 'contract-label',
    position: LatLng(37.5665, 126.978),
    content: 'Contract Label',
    minLevel: 5,
    maxLevel: 17,
  );
  try {
    await controller.setCenter(label.position);
    await controller.setZoom(12);
    await controller.addLabel(label);
    await expectLive('label zoom levels and position SDK readback',
        () => checkJs(controller, '''(function(){
      var l=$_reg.labels?.['contract-label'], p=l?.getPosition?.(), o=l?._label_data?.options;
      return !!l && !!p && Math.abs(p.lat()-37.5665)<0.00001 &&
        Math.abs(p.lng()-126.978)<0.00001 && o?.minLevel===5 && o?.maxLevel===17;
    })()'''));
    await controller.addLabel(label.copyWith(
        position: const LatLng(37.567, 126.979), minLevel: 8, maxLevel: 15));
    await expectLive('label position and zoom levels updated in SDK',
        () => checkJs(controller, '''(function(){
      var l=$_reg.labels?.['contract-label'], p=l?.getPosition?.(), o=l?._label_data?.options;
      return !!p && Math.abs(p.lat()-37.567)<0.00001 &&
        Math.abs(p.lng()-126.979)<0.00001 && o?.minLevel===8 && o?.maxLevel===15;
    })()'''));
  } finally {
    await controller.clearLabel(label.labelId);
    await unmountLiveMap();
  }
}
