import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  test('marker constructor and copyWith preserve ID while updating SDK options',
      () {
    const marker = Marker(
      markerId: 'm',
      position: LatLng(37.5, 127),
      contextMenu: {
        'items': ['open']
      },
      titleStyle: {'fontSize': '15px'},
      zIndex: 30,
    );
    expect(marker.toJson()['contextMenu'], {
      'items': ['open']
    });
    expect(marker.toJson()['titleOption'], {'fontSize': '15px'});
    final moved = marker.copyWith(
      position: const LatLng(37.6, 127.1),
      zIndex: 0,
      contextMenu: null,
      titleStyle: {'color': '#00ff00'},
      visible: false,
    );
    expect(moved.markerId, 'm');
    expect(moved.position.latitude, 37.6);
    expect(moved.toJson()['zIndex'], 0);
    expect(moved.toJson()['visible'], false);
    expect(moved.toJson().containsKey('contextMenu'), false);
    expect(moved.toJson()['titleOption'], {'color': '#00ff00'});
    expect(marker.position.latitude, 37.5);
    expect(marker.contextMenu, isNotNull);
  });

  test('cluster member updates and options copy retain immutable original', () {
    const a = Marker(markerId: 'a', position: LatLng(37, 127));
    const b = Marker(markerId: 'b', position: LatLng(37.1, 127.1));
    const clusterer = Clusterer(
      markers: [a],
      icons: [
        {'icon': 'data:image/png,abc', 'size': 40}
      ],
      zIndex: 0,
    );
    final updated = clusterer.addMarker(b).addMarker(
          a.copyWith(position: const LatLng(38, 128)),
        );
    expect(updated.markers, hasLength(2));
    expect(
        updated.markers.singleWhere((m) => m.markerId == 'a').position.latitude,
        38);
    expect(updated.removeMarker('b').markers.map((m) => m.markerId), ['a']);
    final configured = updated.copyWith(
      maxClusterZoom: 13,
      minClusterCount: 3,
      gridSize: 35,
      visible: false,
      opacity: 0,
      zIndex: 5,
    );
    expect(configured.toJson(), containsPair('icons', clusterer.icons));
    expect(configured.toJson()['zIndex'], 5);
    expect(configured.toJson()['opacity'], 0);
    expect(configured.toJson()['gridSize'], 35);
    expect(clusterer.markers, hasLength(1));
  });

  test('info window and label reposition through immutable copyWith', () {
    const iw = InfoWindow(
      infoWindowId: 'info',
      position: LatLng(37, 127),
      content: 'A',
      anchor: 'top',
      offset: Point(3, 4),
    );
    final moved =
        iw.copyWith(position: const LatLng(38, 128), border: '1px solid red');
    expect(moved.toJson()['position']['latitude'], 38);
    expect(moved.anchor, 'top');
    expect(moved.border, '1px solid red');
    expect(iw.position.latitude, 37);

    const label = Label(
      labelId: 'label',
      position: LatLng(37, 127),
      content: 'Text',
      fontColor: Colors.red,
      minLevel: 4,
      maxLevel: 18,
    );
    final shifted = label.copyWith(
      position: const LatLng(38, 128),
      minLevel: 5,
      maxLevel: 15,
    );
    expect(shifted.position.longitude, 128);
    expect(shifted.toJson()['minLevel'], 5);
    expect(shifted.toJson()['maxLevel'], 15);
    expect(label.position.latitude, 37);
  });

  test('on/off marker and cluster subscriptions dispatch typed payloads', () {
    final controller = TMapController.fromWeb('test');
    final events = <MarkerInteraction>[];
    final groups = <ClusterInteraction>[];
    void onMarker(MarkerInteraction event) => events.add(event);
    void onCluster(ClusterInteraction event) => groups.add(event);

    controller.onMarkerEvent('m', MarkerInteractionType.mouseenter, onMarker);
    controller.onMarkerEvent('m', MarkerInteractionType.mouseenter, onMarker);
    controller.onClusterEvent(ClusterInteractionType.mouseleave, onCluster);
    const enter = MarkerInteraction(
      markerId: 'm',
      type: MarkerInteractionType.mouseenter,
      position: LatLng(37, 127),
      zoom: 12,
    );
    const leave = ClusterInteraction(
      type: ClusterInteractionType.mouseleave,
      center: LatLng(37.1, 127.1),
      zoom: 11,
      markerIds: ['m', 'n'],
    );
    controller.dispatchMarkerInteraction(enter);
    controller.dispatchMarkerInteraction(const MarkerInteraction(
      markerId: 'other',
      type: MarkerInteractionType.mouseenter,
      position: LatLng(0, 0),
      zoom: 0,
    ));
    controller.dispatchClusterInteraction(leave);
    expect(events, hasLength(1));
    expect(events.single.position.latitude, 37);
    expect(events.single.zoom, 12);
    expect(groups.single.markerIds, ['m', 'n']);

    controller.offMarkerEvent('m', MarkerInteractionType.mouseenter, onMarker);
    controller.offClusterEvent(ClusterInteractionType.mouseleave, onCluster);
    controller.dispatchMarkerInteraction(enter);
    controller.dispatchClusterInteraction(leave);
    expect(events, hasLength(1));
    expect(groups, hasLength(1));
  });
}
