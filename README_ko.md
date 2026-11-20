# tmap_flutter_sdk

[![pub package](https://img.shields.io/pub/v/tmap_flutter_sdk.svg)](https://pub.dev/packages/tmap_flutter_sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Flutter Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-green.svg)](https://flutter.dev)

🌐 [English](README.md) · 📝 [변경 내역](CHANGELOG_ko.md)

Flutter 환경에서 **TMAP Vector Map v3**와 **TMAP OpenAPI**를 손쉽게 사용할 수 있는 Flutter 지도 플러그인입니다.

`webview_flutter`와 JavaScript SDK를 이용하여 구현하였으며 **Web 플랫폼에서의 구현은 아직 실험 단계이기 때문에 다소 불안정할 수 있습니다.** Flutter SDK 3.27 이상에서 작동합니다.

## ✨ 주요 기능

- **3D 벡터 지도 & 카메라 제어**

  회전(`bearing`, 0\~360°), 기울기(`pitch`, 0\~60°), 줌(`zoom`, 0\~19), 중심 좌표 및 카메라 애니메이션 이동 등
- **다양한 지도 스타일**
  
  `ROAD`(기본 도로명), `HYBRID`(위성 지도), `PUBLIC`(대중교통 강조), `NIGHT`(야간 다크 테마)

- **오버레이 & 그래픽**:
  - `Marker`: 커스텀 아이콘, 텍스트 라벨, HTML 스타일 마커, 드래그 지원
  - `InfoWindow`: 마커 핀 상단에 말풍선 꼬리 형태로 밀착되는 팝업 오버레이
  - `Clusterer`: 대량의 마커를 화면 줌 레벨에 맞춰 자동으로 묶어주는 고성능 클러스터링
  - `Polyline`, `Polygon`, `Circle`, `Rectangle`: 경로선, 구역 다각형, 반경 원형, 사각형 오버레이
  - `GroundOverlay`: 지도 위에 이미지를 겹쳐 표시하는 오버레이
  - 손으로 그리는 도형: `startDrawingCircle`, `startDrawingPolygon` 등으로 사용자가 지도에 직접 도형을 그림
  - `DotMap`, `SquareMap`, `HeatMap`: 가중치 데이터를 점·격자·히트맵으로 시각화
- **지도 상태 & 좌표 변환**:
  - `getCenter`, `getBounds`, `getZoom` 등으로 현재 지도 상태 조회
  - `realToScreen`, `screenToReal`, `Projection`으로 화면·좌표계 변환
- **TData & OpenAPI 연동**:
  - 🚘 **자동차 경로 탐색 (`getRoutePlan`)**: 경로 좌표 목록, 총 거리, 소요 시간, 통행료/택시비 계산
  - 🚶 **보행자 경로 탐색 (`getRoutePlanPedestrian`)**: 도보 최적 이동 경로 탐색
  - 🔍 **POI 장소 검색 (`searchPoi`, `searchPoiAround`)**: 키워드 검색 및 특정 좌표 반경 내 주변 장소/맛집 검색
  - 📍 **지오코딩 & 역지오코딩 (`getGeoFromAddress`, `getAddressFromGeo`)**: 주소 ↔ 위경도 상호 변환.
  - 💡 **키워드 자동완성 (`getAutoCompleteSearch`, `getAutoCompleteSearchV2`)**: 검색어 실시간 추천, 위치 기반 추천
  - 🏢 **POI 상세·좌표 변환 (`getPoiById`, `transformJson`)**: 장소 상세 정보 조회와 좌표계 변환
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
  maxClusterZoom: 17,
  minClusterCount: 2,
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
| `GroundOverlay` | 지도 영역 위에 이미지를 겹쳐 표시하는 오버레이 |
| `DotMap` / `SquareMap` / `HeatMap` | 가중치 데이터 시각화 레이어 |
| `startDrawingCircle` 등 | 사용자가 지도에 직접 도형을 그리는 그리기 모드 |
| `getCenter` / `getBounds` / `getZoom` | 현재 지도 상태 조회 |
| `realToScreen` / `screenToReal` / `Projection` | 화면 좌표와 지도 좌표, 좌표계 변환 |
| `getRealTimeTraffic` / `getPoiById` / `getAutoCompleteSearchV2` | 실시간 교통정보, POI 상세, 위치 기반 자동완성 |

---

## 🧪 브리지 개발 및 테스트

공식 TMAP Vector Map JS는 AppKey로 로드합니다. Flutter와 SDK를 연결하는 코드는 `assets/bridge/`에 있습니다. 지도 중심·줌 변경과 마커는 `shared.js`에서 처리하고, 웹 DOM과 모바일 WebView의 초기화 및 콜백 전달은 각 플랫폼 파일에서 처리합니다.

저장소 루트에서 `flutter test`와 `node --test test/*.mjs`를 실행하면 AppKey 없이 Dart 모델과 브리지를 검증할 수 있습니다. 실제 지도에서는 예제 디렉터리에서 아래 명령을 실행하세요. 키 파일은 `TMAP_APP_KEY`가 들어 있는 로컬 JSON 파일입니다.

```sh
cd example
flutter run -d chrome -t test_driver/bridge/main.dart --dart-define-from-file=/path/to/key.json
```

Android와 iOS에서는 `chrome`을 기기 ID로 바꿉니다. 지도 생성, 중심·줌 변경, 마커 클릭과 삭제를 확인하면 콘솔에 `BRIDGE_PROBE_PASS`가 표시됩니다.

Chrome에서 유스케이스 시나리오 전체를 실행하려면 예제 디렉터리에서 터미널 두 개를 사용합니다.

`shape_drawing`, `map_touch`, `map_context_menu` 시나리오는 실제 포인터 입력을 기다립니다. 이 입력은 `test_driver/bridge/web_input/driver.mjs`가 Chrome DevTools Protocol로 보냅니다. 각 시나리오는 약 7.5초만 기다리므로 드라이버를 먼저 실행하세요. 드라이버는 Chrome이 준비될 때까지 계속 재시도합니다. 드라이버에는 Node.js 22 이상이 필요합니다.

```sh
node test_driver/bridge/web_input/driver.mjs --port=8257
```

그다음 두 번째 터미널에서 같은 포트로 Chrome 디버그 포트를 열고 `scenarios.dart`를 실행합니다.

```sh
flutter run -d chrome --web-browser-debug-port=8257 -t test_driver/bridge/scenarios.dart --dart-define-from-file=/path/to/key.json
```

드라이버가 없거나 너무 늦게 연결되면 이 세 시나리오는 시간 초과로 실패하고 전체 결과는 `SCENARIOS_FAIL`이 됩니다. 드라이버 없이 실행하려면 `SCENARIO_FILTER`로 다른 시나리오만 선택하세요.

Android·iOS에서는 `-d chrome` 대신 기기 ID를 사용하고, 디버그 포트와 드라이버는 필요 없습니다. 모바일 실행에서는 Chrome 전용인 이 세 시나리오를 건너뛰므로, `SCENARIOS_PASS`가 나와도 세 시나리오는 실행되지 않은 것입니다. 이 시나리오들은 Chrome에서 실행하세요. 기기에서 `SCENARIO_FILTER`로 이 중 하나를 지정하면 `SCENARIO <이름> FAIL`로 표시됩니다.

Circle, Rectangle, Polyline의 `zIndex` 전달과 같은 ID 교체를 확인하려면 위 명령에 `--dart-define=SCENARIO_FILTER=shape_zindex`를 추가합니다. Polygon은 기존 `--dart-define=SCENARIO_FILTER=polygon_zindex`로 확인할 수 있습니다. 이 시나리오들은 SDK의 저장 값과 레이어 정리를 확인하며 화면상의 겹침 순서는 검증하지 않습니다.

네 도형의 기본·양수·0 선 너비와 0 투명도를 확인하려면 `--dart-define=SCENARIO_FILTER=shape_style`을 사용합니다. 실제 지도에 부착된 Dart 도형과 같은 옵션의 공식 SDK 도형의 저장 스타일을 비교하며, SDK의 너비 옵션 생략도 별도로 확인합니다. 화면 픽셀이나 모든 스타일의 일치를 검증하는 시나리오는 아닙니다.

각 시나리오가 완료될 때마다 콘솔에 `SCENARIO <이름> PASS` 또는 `SCENARIO <이름> FAIL` 형식의 줄이 출력되고, 마지막에 `SCENARIOS_PASS` 또는 `SCENARIOS_FAIL`로 전체 결과가 표시됩니다. AppKey가 필요 없는 픽스처 기반 테스트는 저장소 루트에서 `flutter test test/tdata_scenarios_test.dart`로 실행합니다.

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE)에 따라 배포됩니다.

## ⚠️ 면책 조항 및 상표권 고지
* 본 플러그인(`tmap_flutter_sdk`)은 개인이 제작한 **비공식 Flutter 플러그인**이며, **SK텔레콤(SK Telecom Co., Ltd.) 및 티맵모빌리티(TMAP Mobility Co., Ltd.)와 어떠한 공식적인 제휴, 승인, 후원 관계도 없습니다.**
* **'SK', 'SK텔레콤', 'TMAP'** 및 관련 모든 상표, 상호, 로고의 지식재산권과 권리는 **SK텔레콤**과 **티맵모빌리티** 및 관련 권리자에게 귀속됩니다.
* 본 플러그인을 사용하여 서비스를 개발/배포할 때는 [SK OpenAPI 이용약관](https://openapi.sk.com/stplat/usage/indexView) 및 TMAP 개발자 운영 정책을 반드시 준수해야 합니다.
