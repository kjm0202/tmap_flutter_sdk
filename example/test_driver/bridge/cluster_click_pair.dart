import 'dart:async';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'live_scenario.dart';
import 'cluster_shape_pair_io.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

Future<Map<String, dynamic>> runClusterPair() async {
  final results = <String, dynamic>{};

  final controller = await mountLiveMap((created) => TMap(
        onMapCreated: created,
        center: const LatLng(37.5665, 126.978),
        zoom: 12,
      ));

  try {
    await checkJs(controller, '''
      (function() {
        if (window.__rawCluster) { window.__rawCluster.clearMarkers(); window.__rawCluster.destroy(); }
        window.__rawClusterEvents = [];
      })()
    ''');

    await checkJs(controller, '''
      (function() {
        if (map.getZoom() !== 12) throw 'Expected zoom 12';
        var center = map.getCenter();
        if (Math.abs(center.lat() - 37.5665) > 1e-6 || Math.abs(center.lng() - 126.978) > 1e-6) throw 'Expected center 37.5665/126.978';

        var m1 = new Tmapv3.Marker({position: new Tmapv3.LatLng(37.5665, 126.9780), map: map});
        var m2 = new Tmapv3.Marker({position: new Tmapv3.LatLng(37.5670, 126.9790), map: map});
        var m3 = new Tmapv3.Marker({position: new Tmapv3.LatLng(37.5650, 126.9770), map: map});
        
        var markers = [m1, m2, m3];
        
        window.__rawCluster = new Tmapv3.extension.MarkerCluster({
          map: map,
          markers: markers,
          maxClusterZoom: 17,
          minClusterCount: 2,
          gridSize: 80,
          onClusterClick: function(group) {
            var snapshot = {
              center: {lat: group.center.lat(), lng: group.center.lng()},
              zoom: map.getZoom(),
              members: group.markers.map(function(m) { 
                return {
                  id: ['m1','m2','m3'][markers.indexOf(m)],
                  lat: m.getPosition().lat(),
                  lng: m.getPosition().lng()
                };
              }),
              fields: Object.keys(group).sort(),
              centerIsSdkLatLng: group.center instanceof Tmapv3.LatLng,
              membersAreSdkMarkers: group.markers.every(function(m) { return m instanceof Tmapv3.Marker; }),
              isArrayMarkers: Array.isArray(group.markers)
            };
            window.__rawClusterEvents.push(snapshot);
          }
        });
      })()
    ''');

    await expectLive('raw cluster badge', () => checkJs(controller, '''
      (function() {
        var cl = window.__rawCluster;
        if (!cl || !cl._cluster_data || !cl._cluster_data.clusterMarkers || cl._cluster_data.clusterMarkers.length === 0) return false;
        var badge = cl._cluster_data.clusterMarkers[0]._marker_data.vsmMarker.getElement();
        if (!badge) return false;
        
        var target = badge;
        if (target.getBoundingClientRect().width === 0) {
           var all = target.querySelectorAll('*');
           for(var i=0; i<all.length; i++) {
               if(all[i].getBoundingClientRect().width > 0) {
                   target = all[i];
                   break;
               }
           }
        }
        
        var rect = target.getBoundingClientRect();
        var x = rect.left + rect.width/2;
        var y = rect.top + rect.height/2;
        var el = document.elementFromPoint(x, y);
        if (el !== target && !target.contains(el)) return false;

        window.__rawBadge = target;
        window.__rawHitX = x;
        window.__rawHitY = y;
        return true;
      })()
    '''));

    final rawResultRect = await pairRead(controller, '''
      (function() {
        return {x: window.__rawHitX, y: window.__rawHitY};
      })()
    ''');

    await tapPair(controller, rawResultRect['x'], rawResultRect['y']);

    await expectLive('raw callback result',
        () => checkJs(controller, 'window.__rawClusterEvents.length === 1'));

    results['raw'] = await pairRead(controller, 'window.__rawClusterEvents[0]');
    results['rawCount'] =
        await pairRead(controller, 'window.__rawClusterEvents.length');
    results['raw_tap_coords'] = rawResultRect;

    await checkJs(controller, '''
      (function() {
        if (window.__rawCluster) { window.__rawCluster.clearMarkers(); window.__rawCluster.destroy(); }
      })()
    ''');

    List<Map<String, dynamic>> dartClusterEvents = [];
    int memberTapCount = 0;

    final controller2 = await mountLiveMap((created) => TMap(
        onMapCreated: created,
        center: const LatLng(37.5665, 126.978),
        zoom: 12,
        onMarkerTap: (id, position, zoom) {
          memberTapCount++;
        },
        onMarkerClustererTap: (c, z, ids) {
          dartClusterEvents.add({
            'center': {
              'lat': c.latitude,
              'lng': c.longitude,
              'type': c.runtimeType.toString()
            },
            'zoom': z,
            'markerIds': ids
          });
        }));

    await controller2.addMarkerClusterer(const Clusterer(
      markers: [
        Marker(markerId: 'm1', position: LatLng(37.5665, 126.9780)),
        Marker(markerId: 'm2', position: LatLng(37.5670, 126.9790)),
        Marker(markerId: 'm3', position: LatLng(37.5650, 126.9770)),
      ],
      maxClusterZoom: 17,
      minClusterCount: 2,
      gridSize: 80,
    ));

    await expectLive('dart cluster badge', () => checkJs(controller2, '''
      (function() {
        var cl = window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null);
        if (!cl || !cl._cluster_data || !cl._cluster_data.clusterMarkers || cl._cluster_data.clusterMarkers.length === 0) return false;
        var badge = cl._cluster_data.clusterMarkers[0]._marker_data.vsmMarker.getElement();
        if (!badge) return false;
        
        var target = badge;
        if (target.getBoundingClientRect().width === 0) {
           var all = target.querySelectorAll('*');
           for(var i=0; i<all.length; i++) {
               if(all[i].getBoundingClientRect().width > 0) {
                   target = all[i];
                   break;
               }
           }
        }

        var rect = target.getBoundingClientRect();
        var x = rect.left + rect.width/2;
        var y = rect.top + rect.height/2;
        var el = document.elementFromPoint(x, y);
        if (el !== target && !target.contains(el)) return false;

        window.__dartBadge = target;
        window.__dartHitX = x;
        window.__dartHitY = y;
        return true;
      })()
    '''));

    final dartResultRect = await pairRead(controller2, '''
      (function() {
        return {x: window.__dartHitX, y: window.__dartHitY};
      })()
    ''');

    await tapPair(controller2, dartResultRect['x'], dartResultRect['y']);

    await expectLive(
        'dart callback', () async => dartClusterEvents.length == 1);

    results['dart'] = dartClusterEvents[0];
    results['dartCount'] = dartClusterEvents.length;
    results['dart_tap_coords'] = dartResultRect;
    results['member_tap_count'] = memberTapCount;

    final raw = results['raw'];
    final dart = results['dart'];

    if (results['rawCount'] != 1) {
      throw StateError('Assertion failed: rawCount != 1');
    }
    if (results['dartCount'] != 1) {
      throw StateError('Assertion failed: dartCount != 1');
    }

    if (raw['centerIsSdkLatLng'] != true) {
      throw StateError('Assertion failed: raw centerIsSdkLatLng != true');
    }
    if (raw['membersAreSdkMarkers'] != true) {
      throw StateError('Assertion failed: raw membersAreSdkMarkers != true');
    }
    if (raw['isArrayMarkers'] != true) {
      throw StateError('Assertion failed: raw isArrayMarkers != true');
    }

    final expectedIds = {'m1', 'm2', 'm3'};
    final rawMembersList = (raw['members'] as List);
    final dartMarkerIdsList = (dart['markerIds'] as List);

    if (rawMembersList.length != 3) {
      throw StateError('Assertion failed: raw members length != 3');
    }
    if (dartMarkerIdsList.length != 3) {
      throw StateError('Assertion failed: dart markerIds length != 3');
    }

    final rawIds = rawMembersList.map((m) => m['id'] as String).toSet();
    final dartIds = dartMarkerIdsList.cast<String>().toSet();

    if (rawIds.length != expectedIds.length ||
        !rawIds.containsAll(expectedIds)) {
      throw StateError('Assertion failed: raw membership mismatch');
    }
    if (dartIds.length != expectedIds.length ||
        !dartIds.containsAll(expectedIds)) {
      throw StateError('Assertion failed: dart membership mismatch');
    }

    if (raw['zoom'] != 12 || dart['zoom'] != 12) {
      throw StateError('Assertion failed: expected zoom 12');
    }

    if ((raw['center']['lat'] - dart['center']['lat']).abs() > 1e-7 ||
        (raw['center']['lng'] - dart['center']['lng']).abs() > 1e-7) {
      throw StateError('Assertion failed: center mismatch');
    }

    if (!raw['center']['lat'].isFinite ||
        !raw['center']['lng'].isFinite ||
        !dart['center']['lat'].isFinite ||
        !dart['center']['lng'].isFinite) {
      throw StateError('Assertion failed: center values not finite');
    }

    final expectedPositions = {
      'm1': [37.5665, 126.978],
      'm2': [37.567, 126.979],
      'm3': [37.565, 126.977]
    };

    for (var m in raw['members']) {
      var id = m['id'];
      var expected = expectedPositions[id];
      if (expected == null) throw StateError('Unknown ID: $id');
      if ((m['lat'] - expected[0]).abs() > 1e-7 ||
          (m['lng'] - expected[1]).abs() > 1e-7) {
        throw StateError(
            'Assertion failed: raw member position mismatch for ID $id');
      }
    }

    if (memberTapCount != 0) {
      throw StateError(
          'Assertion failed: expected 0 member taps, got $memberTapCount');
    }
  } finally {
    await unmountLiveMap();
  }

  return results;
}
