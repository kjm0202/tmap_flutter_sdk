# tmap_flutter_sdk

[![pub package](https://img.shields.io/pub/v/tmap_flutter_sdk.svg)](https://pub.dev/packages/tmap_flutter_sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Flutter Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-green.svg)](https://flutter.dev)

🌐 [한국어](README_ko.md) · 📝 [Changelog](CHANGELOG.md)

A Flutter map plugin that allows you to easily use **TMAP Vector Map v3** and **TMAP OpenAPI** in Flutter applications.

Implemented using `webview_flutter` and the JavaScript SDK. Compatible with Flutter SDK 3.27 or above.

Note that **Web platform implementation is currently experimental and may be unstable.**

## ✨ Features

- **3D Vector Map & Camera Control**
  Rotation (`bearing`, 0–360°), Pitch/Tilt (`pitch`, 0–60°), Zoom (`zoom`, 0–19), center coordinates, and animated camera movements.
- **Multiple Map Styles**
  `ROAD` (Standard road), `HYBRID` (Satellite map), `PUBLIC` (Public transit), `NIGHT` (Night dark theme)
- **Overlays & Graphics**:
  - `Marker`: Custom icons, text labels, HTML-style markers, drag support
  - `InfoWindow`: Speech bubble popup overlay that docks on top of marker pins
  - `Clusterer`: High-performance clustering that automatically groups dense markers based on zoom level
  - `Polyline`, `Polygon`, `Circle`, `Rectangle`: Polylines, polygon areas, circular radius, and rectangular overlays
  - `GroundOverlay`: Image overlays placed over a map area
  - Interactive drawing: let users draw shapes with `startDrawingCircle`, `startDrawingPolygon` and more
  - `DotMap`, `SquareMap`, `HeatMap`: Visualize weighted data as dots, grid squares or a heat map
- **Map State & Coordinate Conversion**:
  - Read the current map state with `getCenter`, `getBounds`, `getZoom` and more
  - Convert between screen and map coordinates with `realToScreen`, `screenToReal` and `Projection`
- **TData & OpenAPI Integration**:
  - 🚘 **Driving Route Navigation (`getRoutePlan`)**: Route coordinates, total distance, travel time, toll/taxi fare estimates
  - 🚶 **Pedestrian Route Navigation (`getRoutePlanPedestrian`)**: Optimal walking route calculation
  - 🔍 **POI Place Search (`searchPoi`, `searchPoiAround`)**: Keyword search and nearby places/restaurants within a given radius
  - 📍 **Geocoding & Reverse Geocoding (`getGeoFromAddress`, `getAddressFromGeo`)**: Address ↔ Latitude/Longitude conversion
  - 💡 **Search Auto-complete (`getAutoCompleteSearch`, `getAutoCompleteSearchV2`)**: Real-time and location-aware keyword recommendations
  - 🏢 **POI Detail & Coordinate Conversion (`getPoiById`, `transformJson`)**: Place details and coordinate system conversion
  - 🚦 **Real-time Traffic Info (`toggleTrafficInfo`)**: Toggle real-time traffic flow overlay on/off

## 🚀 Getting Started

### 1. Issue TMAP AppKey
1. Sign up/Log in to the [SK OpenAPI Portal (openapi.sk.com)](https://openapi.sk.com).
2. Create a new application and request subscription for the **TMAP Vector Map** product.
3. Copy the issued **AppKey**.

### 2. Platform Permission Configuration

#### Android (`android/app/src/main/AndroidManifest.xml`)
Add Internet permission:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application
        android:usesCleartextTraffic="true"
        android:label="your_app_name"
        android:icon="@mipmap/ic_launcher">
        ...
    </application>
</manifest>
```

#### iOS (`ios/Runner/Info.plist`)
Add network communication settings:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### 3. Initialize AppKey

Initialize the TMAP AppKey in the `main()` function when the app launches:

```dart
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Register TMAP AppKey
  AuthRepository.initialize(
    appKey: 'YOUR_TMAP_APP_KEY',
  );

  runApp(const MyApp());
}
```

## 📖 Usage Examples

### 1. Basic Map Screen Rendering

<details>
<summary>View Code</summary>

```dart
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  TMapController? _controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('TMAP Map')),
      body: TMap(
        center: const LatLng(37.5665, 126.9780), // Seoul City Hall
        zoom: 16,
        pitch: 30,  // 3D tilt (0~60 deg)
        bearing: 0, // rotation (0~360 deg)
        mapType: TMapType.road,
        onMapCreated: (controller) {
          _controller = controller;
        },
        onMapTap: (latLng) {
          debugPrint('Map tapped: $latLng');
        },
      ),
    );
  }
}
```

</details>

---

### 2. Adding Markers and InfoWindows

<details>
<summary>View Code</summary>

```dart
final markers = <Marker>[
  const Marker(
    markerId: 'seoul_city_hall',
    position: LatLng(37.5665, 126.9780),
    label: 'Seoul City Hall',
    labelBackgroundColor: Color(0xFF0064FF),
    labelTextColor: Colors.white,
  ),
];

final infoWindows = <InfoWindow>[
  const InfoWindow(
    infoWindowId: 'city_hall_popup',
    position: LatLng(37.5665, 126.9780),
    content: '<div style="padding: 6px 12px; font-weight: bold; font-size: 13px;">🏢 Seoul City Hall</div>',
    type: 1, // Speech bubble style
    offset: Point(0, -42), // Placed on top of the marker pin
  ),
];

TMap(
  center: const LatLng(37.5665, 126.9780),
  markers: markers,
  infoWindows: infoWindows,
  onMarkerTap: (markerId, position, zoom) {
    debugPrint('Marker tapped: $markerId');
  },
)
```

</details>

---

### 3. Clustering Large Numbers of Markers (Clusterer)

<details>
<summary>View Code</summary>

```dart
final clusterer = Clusterer(
  markers: [
    Marker(markerId: 'm1', position: LatLng(37.5665, 126.9780)),
    Marker(markerId: 'm2', position: LatLng(37.5670, 126.9790)),
    Marker(markerId: 'm3', position: LatLng(37.5650, 126.9770)),
  ],
  maxClusterZoom: 17,
  minClusterCount: 2,
);

TMap(
  center: const LatLng(37.5665, 126.9780),
  clusterer: clusterer,
  onMarkerClustererTap: (center, zoom, markerIds) {
    debugPrint('Cluster tapped: ${markerIds.length} markers grouped');
  },
)
```

</details>

---

### 4. Car Route Navigation and Polyline Display

<details>
<summary>View Code</summary>

```dart
Future<void> findRoute(TMapController controller) async {
  const start = LatLng(37.5665, 126.9780); // Seoul City Hall
  const end = LatLng(37.4979, 127.0276);   // Gangnam Station

  final route = await controller.getRoutePlan(start: start, end: end);

  if (route != null && route.path.isNotEmpty) {
    debugPrint('Total Distance: ${(route.totalDistance / 1000).toStringAsFixed(1)}km');
    debugPrint('Estimated Time: ${(route.totalTime / 60).round()} mins');
    debugPrint('Estimated Taxi Fare: ${route.taxiFare} KRW');

    // Draw route line on the map
    await controller.drawPolyline(
      points: route.path,
      strokeColor: const Color(0xFF0064FF),
      strokeWidth: 6,
    );
  }
}
```

</details>

---

### 5. Search Nearby POI Places / Restaurants

<details>
<summary>View Code</summary>

```dart
Future<void> searchNearbyPlaces(TMapController controller) async {
  final results = await controller.searchPoi(
    keyword: 'Restaurant',
    center: const LatLng(37.5665, 126.9780),
    radius: 1, // radius 1km
    count: 10,
  );

  for (final poi in results) {
    debugPrint('${poi.name} (${poi.roadAddress}) - Distance: ${poi.distance}km');
  }
}
```

</details>

## 🛠️ API Summary

| Class / Method | Description |
| :--- | :--- |
| `TMap` | Core widget for rendering the TMAP vector map |
| `TMapController` | Controller for camera control (rotation/tilt/zoom), overlays, and TData API calls |
| `Marker` | Map pin marker (custom icons, labels, HTML support) |
| `InfoWindow` | Speech bubble popup displayed over markers or coordinates |
| `Clusterer` | Clustering engine to efficiently group large sets of markers |
| `Polyline` / `Polygon` | Polyline paths and polygon area overlays |
| `Circle` / `Rectangle` | Circular radius and rectangular area overlays |
| `getRoutePlan` | Driving route calculation and estimated toll/fares |
| `getRoutePlanPedestrian` | Pedestrian-only walking route calculation |
| `searchPoi` / `searchPoiAround` | Place search by keyword and radius |
| `getGeoFromAddress` / `getAddressFromGeo` | Address ↔ Coordinates geocoding & reverse geocoding |
| `GroundOverlay` | Image overlay placed over a map area |
| `DotMap` / `SquareMap` / `HeatMap` | Weighted data visualization layers |
| `startDrawingCircle` and others | Drawing modes that let users draw shapes on the map |
| `getCenter` / `getBounds` / `getZoom` | Read the current map state |
| `realToScreen` / `screenToReal` / `Projection` | Convert between screen, map and projected coordinates |
| `getRealTimeTraffic` / `getPoiById` / `getAutoCompleteSearchV2` | Real-time traffic, POI details, location-aware autocomplete |

---

## 🧪 Bridge Development and Testing

The official TMAP Vector Map JS is loaded with your AppKey. The code that connects Flutter to the SDK lives in `assets/bridge/`. `shared.js` handles map center and zoom changes and markers, and each platform file handles web DOM or mobile WebView setup and callback delivery.

From the repository root, `flutter test` and `node --test test/*.mjs` verify the Dart models and the bridge without an AppKey. To try a real map, run the command below from the example directory. The key file is a local JSON file containing `TMAP_APP_KEY`.

```sh
cd example
flutter run -d chrome -t test_driver/bridge/main.dart --dart-define-from-file=/path/to/key.json
```

On Android and iOS, replace `chrome` with the device ID. Once map creation, center and zoom changes, and marker taps and removal are verified, the console prints `BRIDGE_PROBE_PASS`.

To run every use-case scenario, target `scenarios.dart` from the example directory and open a Chrome debug port:

```sh
flutter run -d chrome --web-browser-debug-port=8257 -t test_driver/bridge/scenarios.dart --dart-define-from-file=/path/to/key.json
```

The `shape_drawing`, `map_touch` and `map_context_menu` scenarios wait for trusted pointer input, which `test_driver/bridge/web_input/driver.mjs` sends through the Chrome DevTools Protocol. Once the app is running, start the driver from the example directory in a second terminal with the same port. The driver needs Node.js 22 or later. Without it, those three scenarios time out and the run ends with `SCENARIOS_FAIL`; to run without the driver, pick other scenarios with `SCENARIO_FILTER`.

```sh
node test_driver/bridge/web_input/driver.mjs --port=8257
```

On Android and iOS, use the device ID instead of `-d chrome` and leave out the debug port and the driver. Mobile runs skip those three Chrome-only scenarios, so `SCENARIOS_PASS` there does not cover them; run them in Chrome. Selecting one of them with `SCENARIO_FILTER` on a device reports `SCENARIO <name> FAIL`.

To check that `zIndex` is passed to Circle, Rectangle and Polyline and that a shape with the same ID is replaced, add `--dart-define=SCENARIO_FILTER=shape_zindex` to the command above. Polygon uses `--dart-define=SCENARIO_FILTER=polygon_zindex`. These scenarios check the values the SDK stores and layer cleanup; they do not verify the on-screen stacking order.

To check default, positive and zero stroke widths and zero opacity for the four shapes, use `--dart-define=SCENARIO_FILTER=shape_style`. It compares the stored style of Dart shapes attached to a real map with official SDK shapes created with the same options, and separately checks the SDK's handling of an omitted width. It does not verify screen pixels or that every style matches.

As each scenario finishes, the console prints `SCENARIO <name> PASS` or `SCENARIO <name> FAIL`, and the overall result is shown last as `SCENARIOS_PASS` or `SCENARIOS_FAIL`. Fixture-based tests that need no AppKey run from the repository root with `flutter test test/tdata_scenarios_test.dart`.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## ⚠️ Disclaimer and Trademark Notice
* This plugin (`tmap_flutter_sdk`) is an **unofficial Flutter plugin** created by an individual and is **not affiliated with, endorsed by, or sponsored by SK Telecom Co., Ltd. or TMAP Mobility Co., Ltd.**
* **'SK', 'SK Telecom', 'TMAP'** and all related trademarks, trade names, and logos are the intellectual property and rights of **SK Telecom Co., Ltd.**, **TMAP Mobility Co., Ltd.**, and their respective owners.
* When developing and distributing services using this plugin, you must comply with the [SK OpenAPI Terms of Use](https://openapi.sk.com/stplat/usage/indexView) and TMAP developer operating policies.
