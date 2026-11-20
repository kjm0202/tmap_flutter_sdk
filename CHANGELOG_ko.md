# 변경 내역

영문 변경 내역은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.

## 0.2.0

TMAP Vector JS SDK(Tmapv3) 공식 문서에 나오는 공개 API를 Flutter에서 쓸 수 있도록 넓혔습니다. `tool/api_manifest/`가 문서의 공개 멤버를 하나당 한 줄로 관리합니다(구현 343개, 의도적 제외 9개). CI가 이 목록을 공식 문서와 비교해 검사합니다.

### 호환성이 깨지는 변경

* `LatLng.toString()`이 `LatLng(lat, lng)` 대신 SDK 형식인 `lat,lng`를 반환합니다.
* `Point.toString()`이 `Point(x, y)` 대신 소수점 둘째 자리까지의 `x,y`를 반환합니다(예: `3.00,4.00`).
* `LatLngBounds.toString()`이 정규화한 모서리로 `southWest:northEast`를 반환합니다. 빈 영역이면 `null:null`을 반환합니다.
* `TDataService`가 더 이상 `debugPrint`로 요청을 출력하지 않습니다. 그래서 콘솔에 앱 키가 찍히지 않습니다. 오류는 `dart:developer`의 `log`로 남깁니다.

### 추가

* **지도 상태:** `TMapController.getCenter`, `getBounds`, `getZoom`, `getMinZoom`, `getMaxZoom`, `getBearing`, `getPitch`, `screenSize`, `setZoomLimit`, `updateMapOptions`.
* **화면·좌표 변환:** `realToScreen`, `screenToReal`, `convertProjection`, 그리고 7가지 좌표계 변환을 담은 `Projection` 유틸리티.
* **`TMap` 옵션:** `bounds`, `maxBounds`, `minPitch`, `maxPitch`, `onTouchStart`, `onTouchEnd`. 지도를 만든 뒤 `bounds`를 바꾸면 새 영역에 맞춰 지도를 이동합니다. `maxBounds`와 기울기 제한은 지도를 만들 때만 적용됩니다.
* **값 타입:** 새 `Bounds` 클래스. `LatLngBounds.empty`, `extend`, `union`, `intersects`, 모서리·크기 getter. `LatLng`와 `Point`의 복제·거리 계산 등 추가 연산.
* **마커·클러스터:** 타입이 지정된 `onMarkerEvent` / `offMarkerEvent`, `onClusterEvent` / `offClusterEvent`. 마커 컨텍스트 메뉴와 제목 스타일, `copyWith`, 클러스터 마커 추가·삭제, `clearClusterMarkers`.
* **도형:** `GroundOverlay`(`addGroundOverlay`, `clearGroundOverlay`, `clearAllGroundOverlays`). 손으로 그리는 도형(`startDrawingCircle`, `startDrawingRectangle`, `startDrawingPolyline`, `startDrawingPolygon`, `clearDrawings`). `polygonContains`, `getPolygonArea`, `clearCustomOverlay`.
* **시각화 레이어:** `DotMap`, `SquareMap`, `HeatMap`과 각각의 추가·갱신·삭제 메서드.
* **TData REST:** `getRealTimeTraffic`, `getPoiById`, `getGeoFromAddressLegacy`, `transformJson`(좌표 변환), 위치 기반 자동완성 `getAutoCompleteSearchV2`.

### 수정

* 웹과 모바일이 같은 공용 JavaScript 브리지를 불러오므로 두 플랫폼의 동작이 같아졌습니다.
* 위젯을 다시 빌드해도 오버레이, 제스처 콜백, 컨트롤이 어긋나지 않습니다. 웹에서 도형 삭제와 카메라 이동이 올바른 지도에 적용됩니다.
* 클러스터 표시 여부, 클러스터 안 마커의 스타일, 원 반지름, 도형 겹침 순서, 명시적으로 지정한 0 선 너비가 유지됩니다.
* 웹과 iOS에서 스크롤 화면 안의 지도를 드래그해도 스크롤과 충돌하지 않습니다. Android에서 중간에 끊긴 더블탭 줌도 지도의 줌 범위 안에서 끝까지 진행됩니다.
* 경로 좌표와 안내 지점을 위경도 좌표로 변환합니다.
* TData가 실패 응답, 자동완성·지오코딩 응답 형식, POI 주소의 건물 번호, 불완전한 좌표 쌍을 올바르게 처리합니다.
* 지도가 준비되기 전에 지정한 영역을 `onMapCreated` 호출 전에 적용합니다. 지도 이벤트 리스너 하나에서 예외가 나도 다른 리스너는 계속 실행됩니다.

### 문서

* `README.md`는 이제 영어로만 작성합니다. 한국어 안내는 `README_ko.md`로 옮겼고, 두 문서가 서로 링크합니다.
* 한국어 변경 내역은 `CHANGELOG_ko.md`에 있습니다.

## 0.1.1

* `pubspec.yaml`에 `platforms`(`android`, `ios`, `web`)를 명시해 pub.dev의 플랫폼 지원 표시를 바로잡았습니다.
* `README.md`의 Markdown 취소선 표시 오류를 고쳤습니다.

## 0.1.0

* `tmap_flutter_sdk` 첫 릴리스입니다.
* WebView를 통해 TMAP Vector Map(v3) JavaScript SDK를 지원합니다.
* 기능:
  * 3D 카메라 제어: 기울기(0-60°), 회전(0-360°), 줌(0-19), 이동, 중심 좌표.
  * 지도 종류: `ROAD`, `HYBRID`, `PUBLIC`, `NIGHT`.
  * 오버레이: `Marker`, `InfoWindow`, `Label`, `Polyline`, `Polygon`, `Circle`, `Rectangle`, `CustomOverlay`.
  * `MarkerCluster`를 이용한 마커 클러스터링.
  * `TData` OpenAPI 내장 연동: 경로 탐색(자동차·보행자), POI 검색, 지오코딩·역지오코딩, 자동완성, 실시간 교통정보.
