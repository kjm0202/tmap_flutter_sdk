import 'dart:ui' show Color;
import 'package:flutter_test/flutter_test.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  test(
      'cluster serialization retains complete published member values and order',
      () {
    const cluster = Clusterer(markers: [
      Marker(
        markerId: 'styled',
        position: LatLng(1, 2),
        icon: MarkerIcon(
            iconUrl: 'icon.png', size: Size(24, 32), offset: Point(0, -4)),
        color: Color(0xff123456),
        title: 'Title',
        label: 'Label',
        labelBackgroundColor: Color(0xffabcdef),
        labelTextColor: Color(0xff123456),
        zIndex: 0,
        opacity: 0,
        visible: false,
        draggable: true,
        anchor: 'center',
      ),
      Marker(markerId: 'defaults', position: LatLng(3, 4)),
    ]);
    final json = cluster.toJson();
    expect(json['markers'], [
      {
        'markerId': 'styled',
        'position': {'latitude': 1, 'longitude': 2},
        'icon': {
          'iconUrl': 'icon.png',
          'size': {'width': 24, 'height': 32},
          'offset': {'x': 0, 'y': -4}
        },
        'color': '#123456',
        'title': 'Title',
        'label': 'Label',
        'labelBackgroundColor': '#abcdef',
        'labelTextColor': '#123456',
        'zIndex': 0,
        'opacity': 0,
        'visible': false,
        'draggable': true,
        'anchor': 'center',
      },
      {
        'markerId': 'defaults',
        'position': {'latitude': 3, 'longitude': 4},
        'zIndex': 100,
        'opacity': 1,
        'visible': true,
        'draggable': false,
        'anchor': 'bottom',
      },
    ]);
    expect([
      json['maxClusterZoom'],
      json['minClusterCount'],
      json['gridSize'],
      json['visible'],
      json['opacity']
    ], [
      19,
      2,
      80,
      true,
      1
    ]);
  });
}
