# tmap_flutter_sdk

[![pub package](https://img.shields.io/pub/v/tmap_flutter_sdk.svg)](https://pub.dev/packages/tmap_flutter_sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Flutter Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-green.svg)](https://flutter.dev)

🌐 [English Docs](#english-documentation)

Flutter 환경에서 **TMAP Vector Map v3**와 **TMAP OpenAPI**를 손쉽게 사용할 수 있는 Flutter 지도 플러그인입니다.

`webview_flutter`와 JavaScript SDK를 이용하여 구현하였으며 **Web 플랫폼에서의 구현은 아직 실험 단계이기 때문에 다소 불안정할 수 있습니다.** Flutter SDK 3.27 이상에서 작동합니다.

## ✨ 주요 기능

- **3D 벡터 지도 & 카메라 제어**

  회전(`bearing`, 0~360°), 기울기(`pitch`, 0~60°), 줌(`zoom`, 0~19), 중심 좌표 및 카메라 애니메이션 이동 등
- **다양한 지도 스타일**
  
  `ROAD`(기본 도로명), `HYBRID`(위성 지도), `PUBLIC`(대중교통 강조), `NIGHT`(야간 다크 테마)

- **오버레이 & 그래픽**:
  - `Marker`: 커스텀 아이콘, 텍스트 라벨, HTML 스타일 마커, 드래그 지원
  - `InfoWindow`: 마커 핀 상단에 말풍선 꼬리 형태로 밀착되는 팝업 오버레이
  - `Clusterer`: 대량의 마커를 화면 줌 레벨에 맞춰 자동으로 묶어주는 고성능 클러스터링
  - `Polyline`, `Polygon`, `Circle`, `Rectangle`: 경로선, 구역 다각형, 반경 원형, 사각형 오버레이
- **TData & OpenAPI 연동**:
  - 🚘 **자동차 경로 탐색 (`getRoutePlan`)**: 경로 좌표 목록, 총 거리, 소요 시간, 통행료/택시비 계산
  - 🚶 **보행자 경로 탐색 (`getRoutePlanPedestrian`)**: 도보 최적 이동 경로 탐색
  - 🔍 **POI 장소 검색 (`searchPoi`, `searchPoiAround`)**: 키워드 검색 및 특정 좌표 반경 내 주변 장소/맛집 검색
  - 📍 **지오코딩 & 역지오코딩 (`getGeoFromAddress`, `getAddressFromGeo`)**: 주소 ↔ 위경도 상호 변환.
  - 💡 **키워드 자동완성 (`getAutoCompleteSearch`)**: 검색어 실시간 추천
  - 🚦 **실시간 교통정보 (`toggleTrafficInfo`)**: 지도 위 실시간 교통 흐름 레이어 On/Off

## 🚀 시작하기

### 1. TMAP AppKey 발급
1. [SK OpenAPI 포털(openapi.sk.com)](https://openapi.sk.com)에 가입/로그인합니다.
2. 새 애플리케이션을 생성하고 **TMAP Vector Map** 상품을 이용 신청합니다.
3. 발급받은 **AppKey**를 복사합니다.

### 2. 플랫폼 권한 설정

#### Android (`android/app/src/main/AndroidManifest.xml`)
인터넷 접근 권한을 추가합니다:

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
네트워크 통신 설정을 추가합니다:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### 3. AppKey 초기화

앱 시작 시 `main()` 함수에서 발급받은 TMAP AppKey를 초기화합니다:

```dart
import 'package:flutter/material.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // TMAP AppKey 등록
  AuthRepository.initialize(
    appKey: 'YOUR_TMAP_APP_KEY',
  );

  runApp(const MyApp());
}
```

## 📖 사용 예제

### 1. 기본 지도 화면 렌더링

<details>
<summary>코드 보기</summary>

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
      appBar: AppBar(title: const Text('TMAP 지도')),
      body: TMap(
        center: const LatLng(37.5665, 126.9780), // 서울시청
        zoom: 16,
        pitch: 30,  // 3D 기울기 (0~60도)
        bearing: 0, // 회전각 (0~360도)
        mapType: TMapType.road,
        onMapCreated: (controller) {
          _controller = controller;
        },
        onMapTap: (latLng) {
          debugPrint('지도 클릭: $latLng');
        },
      ),
    );
  }
}
```

</details>

---

### 2. 마커 및 말풍선 인포윈도우 추가

<details>
<summary>코드 보기</summary>

```dart
final markers = <Marker>[
  const Marker(
    markerId: 'seoul_city_hall',
    position: LatLng(37.5665, 126.9780),
    label: '서울특별시청',
    labelBackgroundColor: Color(0xFF0064FF),
    labelTextColor: Colors.white,
  ),
];

final infoWindows = <InfoWindow>[
  const InfoWindow(
    infoWindowId: 'city_hall_popup',
    position: LatLng(37.5665, 126.9780),
    content: '<div style="padding: 6px 12px; font-weight: bold; font-size: 13px;">🏢 서울특별시청</div>',
    type: 1, // 말풍선 꼬리 형태
    offset: Point(0, -42), // 마커 핀 상단에 위치
  ),
];

TMap(
  center: const LatLng(37.5665, 126.9780),
  markers: markers,
  infoWindows: infoWindows,
  onMarkerTap: (markerId, position, zoom) {
    debugPrint('마커 클릭: $markerId');
  },
)
```

</details>

---

### 3. 여러 개의 마커 클러스터링

<details>
<summary>코드 보기</summary>

```dart
final clusterer = Clusterer(
  markers: [
    Marker(markerId: 'm1', position: LatLng(37.5665, 126.9780)),
    Marker(markerId: 'm2', position: LatLng(37.5670, 126.9790)),
    Marker(markerId: 'm3', position: LatLng(37.5650, 126.9770)),
  ],
  maxZoom: 17,
  minClusterSize: 2,
);

TMap(
  center: const LatLng(37.5665, 126.9780),
  clusterer: clusterer,
  onMarkerClustererTap: (center, zoom, markerIds) {
    debugPrint('클러스터 클릭: 마커 ${markerIds.length}개 묶음');
  },
)
```

</details>

---

### 4. 자동차 경로 탐색 및 주행선(Polyline) 표시

<details>
<summary>코드 보기</summary>

```dart
Future<void> findRoute(TMapController controller) async {
  const start = LatLng(37.5665, 126.9780); // 서울시청
  const end = LatLng(37.4979, 127.0276);   // 강남역

  final route = await controller.getRoutePlan(start: start, end: end);

  if (route != null && route.path.isNotEmpty) {
    debugPrint('총 거리: ${(route.totalDistance / 1000).toStringAsFixed(1)}km');
    debugPrint('예상 시간: ${(route.totalTime / 60).round()}분');
    debugPrint('예상 택시비: ${route.taxiFare}원');

    // 지도 상에 경로선 그리기
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

### 5. 주변 POI 맛집/장소 검색

<details>
<summary>코드 보기</summary>

```dart
Future<void> searchNearbyPlaces(TMapController controller) async {
  final results = await controller.searchPoi(
    keyword: '맛집',
    center: const LatLng(37.5665, 126.9780),
    radius: 1, // 반경 1km
    count: 10,
  );

  for (final poi in results) {
    debugPrint('${poi.name} (${poi.roadAddress}) - 거리: ${poi.distance}km');
  }
}
```

</details>

## 🛠️ 주요 API 요약

| 클래스 / 메서드 | 설명 |
| :--- | :--- |
| `TMap` | TMAP 벡터 지도를 렌더링하는 핵심 위젯 |
| `TMapController` | 카메라 회전/기울기/줌, 오버레이 제어 및 TData API 호출 컨트롤러 |
| `Marker` | 지도 핀 마커 (커스텀 아이콘, 라벨, HTML 지원) |
| `InfoWindow` | 마커나 특정 좌표 위에 띄우는 말풍선 팝업 |
| `Clusterer` | 다수의 마커를 효율적으로 그룹화하는 클러스터러 엔진 |
| `Polyline` / `Polygon` | 경로선 및 구역 다각형 오버레이 |
| `Circle` / `Rectangle` | 반경 원형 및 사각형 오버레이 |
| `getRoutePlan` | 자동차 최적 주행 경로 및 요금 계산 |
| `getRoutePlanPedestrian` | 보행자 전용 도보 이동 경로 계산 |
| `searchPoi` / `searchPoiAround` | 키워드 및 반경 기준 장소 검색 |
| `getGeoFromAddress` / `getAddressFromGeo` | 주소 ↔ 좌표 지오코딩 및 역지오코딩 |

---

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE)에 따라 배포됩니다.

## ⚠️ 면책 조항 및 상표권 고지
* 본 플러그인(`tmap_flutter_sdk`)은 개인이 제작한 **비공식 Flutter 플러그인**이며, **SK텔레콤(SK Telecom Co., Ltd.) 및 티맵모빌리티(TMAP Mobility Co., Ltd.)와 어떠한 공식적인 제휴, 승인, 후원 관계도 없습니다.**
* **'SK', 'SK텔레콤', 'TMAP'** 및 관련 모든 상표, 상호, 로고의 지식재산권과 권리는 **SK텔레콤**과 **티맵모빌리티** 및 관련 권리자에게 귀속됩니다.
* 본 플러그인을 사용하여 서비스를 개발/배포할 때는 [SK OpenAPI 이용약관](https://openapi.sk.com/stplat/usage/indexView) 및 TMAP 개발자 운영 정책을 반드시 준수해야 합니다.

---

# English Documentation

🌐 [한국어](#tmap_flutter_sdk)

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
- **TData & OpenAPI Integration**:
  - 🚘 **Driving Route Navigation (`getRoutePlan`)**: Route coordinates, total distance, travel time, toll/taxi fare estimates
  - 🚶 **Pedestrian Route Navigation (`getRoutePlanPedestrian`)**: Optimal walking route calculation
  - 🔍 **POI Place Search (`searchPoi`, `searchPoiAround`)**: Keyword search and nearby places/restaurants within a given radius
  - 📍 **Geocoding & Reverse Geocoding (`getGeoFromAddress`, `getAddressFromGeo`)**: Address ↔ Latitude/Longitude conversion
  - 💡 **Search Auto-complete (`getAutoCompleteSearch`)**: Real-time keyword recommendations
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
  maxZoom: 17,
  minClusterSize: 2,
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

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## ⚠️ Disclaimer and Trademark Notice
* This plugin (`tmap_flutter_sdk`) is an **unofficial Flutter plugin** created by an individual and is **not affiliated with, endorsed by, or sponsored by SK Telecom Co., Ltd. or TMAP Mobility Co., Ltd.**
* **'SK', 'SK Telecom', 'TMAP'** and all related trademarks, trade names, and logos are the intellectual property and rights of **SK Telecom Co., Ltd.**, **TMAP Mobility Co., Ltd.**, and their respective owners.
* When developing and distributing services using this plugin, you must comply with the [SK OpenAPI Terms of Use](https://openapi.sk.com/stplat/usage/indexView) and TMAP developer operating policies.


