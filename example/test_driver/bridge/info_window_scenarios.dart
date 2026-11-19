import 'dart:async';
import 'dart:convert';

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';

const LatLng _cityHall = LatLng(37.5665, 126.9780);
const LatLng _plazaPos = LatLng(37.5658, 126.9780);
const LatLng _deoksuPos = LatLng(37.5658, 126.9752);
const String _mId = 'm1', _mDom = 'm1-dom', _mText = "Seoul's City Hall 서울시청";

Future<void> _assertDom(
  TMapController c,
  String step, {
  Map<String, String> present = const {},
  List<String> absent = const [],
}) async {
  final script = '''(function() {
    var p = ${jsonEncode(present)}, a = ${jsonEncode(absent)};
    for (var k in p) {
      var el = document.getElementById(k);
      if (!el || !(el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;
      if ((el.textContent || '').indexOf(p[k]) === -1) return false;
    }
    for (var i = 0; i < a.length; i++) {
      var el = document.getElementById(a[i]);
      if (el && (el.isConnected !== undefined ? el.isConnected : document.contains(el))) return false;
    }
    return true;
  })()''';

  for (var i = 0; i < 50; i++) {
    if (await checkJs(c, script)) return;
    await Future<void>.delayed(const Duration(milliseconds: 150));
  }
  throw StateError('Timed out waiting for $step');
}

/// Real user flow scenario test for InfoWindow and Marker interactions.
Future<void> testInfoWindowScenarios(TMapController controller) async {
  Future<void> addPopup(String id, LatLng pos, String domId, String text) =>
      controller.addInfoWindow(InfoWindow(
        infoWindowId: id,
        position: pos,
        content: '<div id="$domId"><span>$text</span></div>',
      ));

  await controller.setCenter(_cityHall);
  await controller.setZoom(16);

  try {
    // 1. Marker rendered
    await controller.addMarker(const Marker(
      markerId: _mId,
      position: _cityHall,
      icon: MarkerIcon(iconHtml: '<div id="$_mDom"><span>$_mText</span></div>'),
    ));
    await _assertDom(controller, 'marker rendered', present: {_mDom: _mText});

    // 2. Both popups visible
    const p1 = 'p1', p1Dom1 = 'p1-v1', p1Txt1 = "Seoul's Plaza 서울광장";
    const p2 = 'p2', p2Dom = 'p2-dom', p2Txt = "Deoksu's Palace 덕수궁";
    await addPopup(p1, _plazaPos, p1Dom1, p1Txt1);
    await addPopup(p2, _deoksuPos, p2Dom, p2Txt);
    await _assertDom(controller, 'both popups visible',
        present: {_mDom: _mText, p1Dom1: p1Txt1, p2Dom: p2Txt});

    // 3. Replace same ID (old gone, new present, sibling & marker intact)
    const p1Dom2 = 'p1-v2', p1Txt2 = "Seoul's Event 서울광장 행사";
    await addPopup(p1, _plazaPos, p1Dom2, p1Txt2);
    await _assertDom(controller, 'replace same ID',
        present: {_mDom: _mText, p1Dom2: p1Txt2, p2Dom: p2Txt},
        absent: [p1Dom1]);

    // 4. Single removal (sibling & marker intact)
    await controller.clearInfoWindow(p1);
    await _assertDom(controller, 'single removal',
        present: {_mDom: _mText, p2Dom: p2Txt},
        absent: [p1Dom1, p1Dom2]);

    // 5. Re-add then clearAllInfoWindows (marker survives)
    const p1Dom3 = 'p1-v3', p1Txt3 = "Seoul's Night 서울광장 야경";
    await addPopup(p1, _plazaPos, p1Dom3, p1Txt3);
    await _assertDom(controller, 're-add popup',
        present: {_mDom: _mText, p1Dom3: p1Txt3, p2Dom: p2Txt});

    await controller.clearAllInfoWindows();
    await _assertDom(controller, 'clearAllInfoWindows marker survives',
        present: {_mDom: _mText},
        absent: [p1Dom1, p1Dom2, p1Dom3, p2Dom]);
  } finally {
    // 6. Remove owned IDs and marker
    await controller.clearInfoWindow('p1');
    await controller.clearInfoWindow('p2');
    await controller.clearMarker(_mId);
  }
}
