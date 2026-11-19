import 'dart:convert';
import 'dart:ui' show Color;

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'live_scenario.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const _cluster =
    '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null))';
const _icon =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="32"%3E%3Crect width="24" height="32" fill="red"/%3E%3C/svg%3E';

/// The same public controller input is replayed on all three platforms.
Future<void> testClusterMembers() async {
  final dragEvents = <DragType>[];
  final controller = await mountLiveMap(
    (created) => TMap(
      onMapCreated: created,
      onMarkerDragChangeCallback: (id, position, phase) {
        if (id == 'member-isolated') dragEvents.add(phase);
      },
    ),
  );
  Future<void> stage(String name, Future<void> Function() body) async {
    try {
      await body();
    } catch (_) {
      Object? observation;
      try {
        observation = await runJs(controller, _observation);
      } catch (_) {
        observation = null;
      }
      throw StateError(
        'stage=$name observation=${jsonEncode(observation)} '
        'dragPhases=${dragEvents.map((e) => e.name).toList()}',
      );
    }
  }

  try {
    await stage('camera', () async {
      await controller.setCenter(const LatLng(37.5665, 126.987));
      await controller.setZoom(12);
      await expectLive(
        'cluster member camera',
        () => checkJs(
          controller,
          'Math.round(map.getZoom()) === 12 && Math.abs(map.getCenter().lat()-37.5665)<0.001 && Math.abs(map.getCenter().lng()-126.987)<0.001',
        ),
      );
    });
    await stage('create', () async {
      await controller.addMarkerClusterer(
        const Clusterer(
          maxClusterZoom: 14,
          gridSize: 30,
          markers: [
            Marker(
              markerId: 'member-revealed',
              position: LatLng(37.5665, 126.978),
              icon: MarkerIcon(
                iconUrl: _icon,
                size: Size(24, 32),
                offset: Point(0, -4),
              ),
              color: Color(0xff123456),
              title: 'Member title',
              label: 'Member label',
              labelBackgroundColor: Color(0xffabcdef),
              labelTextColor: Color(0xff123456),
              opacity: 0.4,
              zIndex: 321,
              anchor: 'center',
            ),
            Marker(
              markerId: 'member-default',
              position: LatLng(37.56655, 126.97805),
            ),
            Marker(
              markerId: 'member-isolated',
              position: LatLng(37.5665, 126.996),
              icon: MarkerIcon(
                iconUrl: _icon,
                size: Size(24, 32),
                offset: Point(0, -4),
              ),
              color: Color(0xff123456),
              title: 'Member title',
              label: 'Member label',
              labelBackgroundColor: Color(0xffabcdef),
              labelTextColor: Color(0xff123456),
              opacity: 0.4,
              zIndex: 321,
              anchor: 'center',
              draggable: true,
            ),
            Marker(
              markerId: 'member-zero',
              position: LatLng(37.5745, 126.987),
              opacity: 0,
              visible: false,
              zIndex: 0,
            ),
          ],
        ),
      );
    });

    // Original SDK stores color/anchor/offset in vsmMarkerOption, not options.
    // Build independent official Marker controls; SDK truthiness for zero is
    // deliberately compared as-is rather than imposing invented semantics.
    await stage(
      'constructor comparisons',
      () => expectLive(
        'member options match independent SDK constructors',
        () => checkJs(controller, '''(function() {
      var cl = $_cluster;
      if (!cl || !cl._cluster_data || cl._cluster_data.markers.length !== 4) return false;
      var members = cl._cluster_data.markers;
      function member(id) { return members.find(function(m) { return m._customMarkerId === id; }); }
      function snapshot(m) {
        var d = m._marker_data, o = d.options, v = d.vsmMarkerOption;
        return JSON.stringify({position:[o.position.lat(),o.position.lng()], color:v.color || null,
          anchor:v.anchor, offset:v.offset, icon:o.icon, iconHTML:o.iconHTML,
          size:o.iconSize ? [o.iconSize.width(),o.iconSize.height()] : null,
          label:o.label, labelOption:o.labelOption, title:o.title,
          opacity:o.opacity, visible:o.visible, zIndex:o.zIndex, draggable:o.draggable});
      }
      function styled(lat, lng) { return {position:new Tmapv3.LatLng(lat,lng),
        icon:$_iconJs, iconSize:new Tmapv3.Size(24,32), offset:new Tmapv3.Point(0,-4),
        color:'#123456', title:'Member title', label:'Member label',
        labelOption:{backgroundColor:'#abcdef',color:'#123456',fontSize:'13px',padding:'4px 8px',borderRadius:'4px'},
        opacity:0.4, visible:true, zIndex:321, anchor:'center', draggable:false}; }
      var controls = {
        'member-revealed': styled(37.5665,126.978),
        'member-isolated': styled(37.5665,126.996),
        'member-default': {position:new Tmapv3.LatLng(37.56655,126.97805), anchor:'bottom',opacity:1,visible:true,zIndex:100,draggable:false},
        'member-zero': {position:new Tmapv3.LatLng(37.5745,126.987),anchor:'bottom',opacity:0,visible:false,zIndex:0,draggable:false}
      };
      var checks=window.__clusterMemberComparisons={};
      return Object.keys(controls).map(function(id) {
        var actual=member(id), reference=null;
        try {
          reference=new Tmapv3.Marker(controls[id]);
          return checks[id]=!!actual && snapshot(actual) === snapshot(reference);
        } catch (_) { return checks[id]=false; }
        finally { if (reference) try { reference.setMap(null); } catch (_) {} }
      }).every(function(ok) { return ok; });
    })()'''),
      ),
    );

    // Midpoint camera and explicit grid keep both inputs visible and separate.
    await stage(
      'viewport and grid separation',
      () => expectLive(
        'inputs inside viewport and outside grid',
        () => checkJs(controller, _viewportCheck),
      ),
    );
    await stage(
      'membership and visibility',
      () => expectLive(
        'isolated member and two-member group rendered',
        () => checkJs(controller, _membershipCheck),
      ),
    );

    // Synthetic input exercises the adapter; it does not prove trusted drag.
    await stage('drag dispatch and callbacks', () async {
      final dispatched = await checkJs(controller, '''(function() {
      var m=$_cluster._cluster_data.markers.find(function(m){return m._customMarkerId==='member-isolated';});
      var el=m._marker_data.vsmMarker.getElement(), r=el.getBoundingClientRect();
      var x=r.left+10, y=r.top+10;
      function ev(type,dx,buttons){
        if (typeof PointerEvent !== 'undefined') return new PointerEvent(type,{pointerId:51,clientX:x+dx,clientY:y+dx,button:0,buttons:buttons,bubbles:true,cancelable:true});
        var e=document.createEvent('Event'); e.initEvent(type,true,true);
        e.pointerId=51; e.clientX=x+dx; e.clientY=y+dx; e.button=0; e.buttons=buttons; return e;
      }
      el.dispatchEvent(ev('pointerdown',0,1));
      document.dispatchEvent(ev('pointermove',20,1));
      document.dispatchEvent(ev('pointerup',20,0));
      return true;
    })()''');
      if (!dispatched) throw StateError('drag dispatch failed');
      await expectLive(
        'cluster member drag callbacks',
        () async =>
            dragEvents.contains(DragType.start) &&
            dragEvents.contains(DragType.move) &&
            dragEvents.contains(DragType.end),
      );
    });

    await stage('zoom and revealed member', () async {
      await controller.setCenter(const LatLng(37.5665, 126.978));
      await controller.setZoom(16);
      await expectLive(
        'cluster-revealed member rendered',
        () => checkJs(controller, '''(function() {
      var o=$_observation, m=o.members[0];
      return Math.round(o.zoom)===16 && m.present && m.attached===true &&
        m.inBounds && m.inViewport && m.connected && m.displayed && m.label && m.image;
    })()'''),
      );
    });
  } finally {
    try {
      await checkJs(controller, 'delete window.__clusterMemberComparisons');
    } catch (_) {}
    await controller.clearMarkerClusterer();
    await unmountLiveMap();
  }
}

// JSON string literal for the independently constructed SDK reference.
const _iconJs = "'$_icon'";

// Only fixed IDs, finite numbers, booleans and null cross the bridge. Never
// serialize SDK objects, URLs, arbitrary text, HTML, exception messages or keys.
const _observation =
    '''(function() {
  function safe(f) { try { var v=f(); return v === undefined ? null : v; } catch (_) { return null; } }
  function num(v) { return typeof v === 'number' && Number.isFinite(v) ? Math.round(v*100000)/100000 : null; }
  function point(p) { return p ? [num(typeof p.getX==='function' ? p.getX() : p.x), num(typeof p.getY==='function' ? p.getY() : p.y)] : null; }
  function coords(p) { return p ? [num(p.lat()),num(p.lng())] : null; }
  function element(m) { return m && m._marker_data && m._marker_data.vsmMarker && m._marker_data.vsmMarker.getElement(); }
  function shown(el) {
    if (!el || !el.isConnected) return false;
    var r=el.getBoundingClientRect();
    if (!(r.width>0 && r.height>0 && r.right>0 && r.bottom>0 && r.left<innerWidth && r.top<innerHeight)) return false;
    for (var n=el; n; n=n.parentElement || (n.getRootNode && n.getRootNode().host)) {
      var css=getComputedStyle(n);
      if (css.display==='none' || css.visibility==='hidden' || Number(css.opacity)===0) return false;
    }
    return true;
  }
  var cl=safe(function(){return $_cluster;}), data=cl && cl._cluster_data;
  var ms=data && Array.isArray(data.markers) ? data.markers : [];
  var gs=data && Array.isArray(data.clusterMarkers) ? data.clusterMarkers : [];
  var sz=safe(function(){return map.screenSize();});
  var size=safe(function(){return sz ? [num(sz.getWidth()),num(sz.getHeight())] : null;});
  var bounds=safe(function(){var b=map.getBounds(); return [coords(b.getSouthWest()),coords(b.getNorthEast())];});
  var ids=['member-revealed','member-default','member-isolated','member-zero'];
  var state=window.tmap_instances ? Object.values(window.tmap_instances)[0] : null;
  var bindings=state ? state.clusterDragListeners : (typeof clusterMarkerDragListeners !== 'undefined' ? clusterMarkerDragListeners : null);
  var comparisons=window.__clusterMemberComparisons || {};
  var members=ids.map(function(id) {
    var m=ms.find(function(x){return x && x._customMarkerId===id;});
    var pos=safe(function(){return m.getPosition();});
    var el=safe(function(){return element(m);});
    var xy=safe(function(){return point(map.realToScreen(pos));});
    var ll=safe(function(){return coords(pos);});
    return {id:id, present:!!m, coord:ll,
      attached:safe(function(){return m.getMap()===map;}),
      inBounds:bounds && ll && bounds[0] && bounds[1] && bounds[0].every(function(x){return x!==null;}) && bounds[1].every(function(x){return x!==null;}) && ll[0]!==null && ll[1]!==null ?
        ll[0]>=bounds[0][0] && ll[0]<=bounds[1][0] && ll[1]>=bounds[0][1] && ll[1]<=bounds[1][1] : null,
      xy:xy, inViewport:size && xy && xy[0]!==null && xy[1]!==null && size[0]!==null && size[1]!==null ?
        xy[0]>=0 && xy[0]<size[0] && xy[1]>=0 && xy[1]<size[1] : null,
      connected:!!(el && el.isConnected),
      displayed:!!safe(function(){return shown(el);}),
      label:!!(el && el.textContent.includes('Member label')), image:!!(el && el.querySelector('img')),
      dragBinding:!!(bindings && bindings[id]), constructor:typeof comparisons[id]==='boolean' ? comparisons[id] : null};
  });
  var groups=gs.slice(0,4).map(function(g){var el=safe(function(){return element(g);});
    var text=el ? el.textContent.trim() : '';
    return {attached:!!safe(function(){return g.getMap()===map;}), connected:!!(el && el.isConnected),
      count:/^\\d{1,3}\$/.test(text) ? Number(text) : null};});
  return {zoom:safe(function(){return num(map.getZoom());}), size:size, bounds:bounds,
    memberCount:ms.length, members:members, groups:groups.slice(0,4)};
})()''';

const _viewportCheck =
    '''(function(){
  var o=$_observation, a=o.members[0], b=o.members[2], h=o.members[3];
  if (!o.size || !a.inBounds || !b.inBounds || !h.inBounds || !a.inViewport || !b.inViewport || !h.inViewport || !a.xy || !b.xy || !h.xy) return false;
  function distance(p,q){return Math.hypot(p[0]-q[0],p[1]-q[1]);}
  return distance(a.xy,b.xy)>30 && distance(a.xy,h.xy)>30 && distance(b.xy,h.xy)>30;
})()''';

const _membershipCheck =
    '''(function(){
  var o=$_observation, a=o.members[0], d=o.members[1], b=o.members[2];
  return o.memberCount===4 && a.present && d.present && b.present && o.members[3].present &&
    a.attached===false && d.attached===false && b.attached===true && b.connected && b.displayed && b.label && b.image &&
    o.groups.length===1 && o.groups[0].attached && o.groups[0].connected && o.groups[0].count===2;
})()''';
