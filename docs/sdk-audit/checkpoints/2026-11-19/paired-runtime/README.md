# 같은 입력으로 실행한 공식 SDK와 Flutter 비교

웹·Android·iOS에서 같은 Flutter 소스(`b010793e…`)를 실행해 아래 11가지 사례를 플랫폼별로 관찰했다. 좌표 모델은 각 플랫폼에 실제로 로드된 운영 SDK(`5290e0fd…`)와 Dart 디버거에서 각각 호출했다. 역지오코딩은 독립된 브라우저에서 호출한 공식 SDK와 각 앱의 공개 `TMapController.getAddressFromGeo` 결과를 비교했다. [입력·소스 지문·원본 위치·플랫폼별 관찰값](comparisons.json)

| 같은 입력으로 확인한 동작 | 공식 JS SDK | Flutter 웹·Android·iOS |
| --- | --- | --- |
| Point의 x와 y, LatLng의 위도와 경도 읽기 | 각각 `1.25`, `-2.5`, `37.5665`, `126.978` | 네 값 모두 일치 |
| Point를 문자열로 변환 | `1.25,-2.50` | `Point(1.25, -2.5)` |
| LatLng를 문자열로 변환 | `37.5665,126.978` | `LatLng(37.5665, 126.978)` |
| Point(1.25, -2.5)에 setX(3) | 같은 객체가 (3, -2.5)로 바뀜. 반환값은 undefined | 같은 이름의 메서드가 없어 동적 호출 시 NoSuchMethodError |
| 같은 초기 Point에 offset(3, 4) | 같은 객체가 (4.25, 1.5)로 바뀜. 반환값은 undefined | 같은 이름의 메서드가 없어 동적 호출 시 NoSuchMethodError |
| 같은 초기 Point를 clone() | 같은 좌표의 새 객체 반환 | 같은 이름의 메서드가 없어 동적 호출 시 NoSuchMethodError |
| 역지오코딩, 위도 37.29062·경도 127.051755, A04 | HTTP 200 후 onComplete로 전체 주소 전달 | Future가 AddressInfo로 완료. 세 플랫폼에서 fullAddress의 UTF-8 해시가 원본과 일치 |
| 역지오코딩, 위도 91·같은 경도, A04 | HTTP 204 후 onError 호출 | 세 플랫폼 모두 Future가 null로 완료. 웹·iOS에서는 HTTP 204도 관찰. Android에서는 Future 결과만 확인 |

**Point.offset은 공식 문서와 공식 배포본 사이에도 차이가 있다.** 문서는 좌표 속성값 자체가 바뀌지 않는다고 설명한다. 배포된 메서드는 기존 객체의 x와 y에 인수를 더했고, 실행 후 같은 객체에서 읽은 좌표도 바뀌었다. 이 차이는 Flutter에서 같은 이름의 메서드를 제공하는지와 독립적으로 기록했다. [공식 문서](https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html#Point_offset) · [배포본의 AST 위치와 실행값](comparisons.json)

비교에 사용한 Point·LatLng Dart 소스는 줄바꿈을 정규화하면 0.1.1 공개 패키지와 일치한다. 역지오코딩은 정상 응답의 주소 한 필드와 HTTP 204 처리까지 확인했다. 입력값과 에러 조건을 확장한 결과는 미검증이다. 이 소스에서 감사와 재검사를 다시 실행한 결과는 둘 다 종료 코드 1이었다.

각 플랫폼의 원본 관찰 기록은 gzip JSON으로 보관했다. 기준 역지오코딩 실행에는 공식 예제 호스트에서 제공하는 jQuery를 함께 로드했다. [웹](web-observations.json.gz) · [Android](android-observations.json.gz) · [iOS](ios-observations.json.gz) · [역지오코딩 공식 SDK 관찰](tdata-reference.json)

## 기본 마커를 제거했다가 같은 자리에 다시 표시하기

같은 b010 소스의 실제 지도에서 기본 마커 하나를 (37.5665, 126.978)에 표시하고 제거한 뒤 다시 표시했다. 웹·Android·iOS 모두 SDK 마커의 `getMap()`이 같은 지도 → null → 같은 지도 순서로 바뀌었다. 실제 핀 DOM도 세 플랫폼 모두 연결 → 분리 → 연결 순서로 바뀌었고 마커 좌표는 유지됐다. Android에서 핀 주변 2,173픽셀을 비교한 결과, 공식 SDK와 Flutter의 표시 화면은 일치했고 핀을 지웠을 때는 1,063픽셀이 바뀌었다.

공식 SDK의 `setMap(map)`은 기존 Marker를 다시 연결했다. Flutter의 `clearMarker(id)` 후 같은 ID로 `addMarker`를 호출하면 새 SDK Marker가 생성됐다. 핀의 DOM 노드는 양쪽 모두 새로 생성됐다. 이 표본으로 기본 핀의 표시와 제거를 확인했다. 사용자 지정 아이콘과 이벤트 리스너의 수명은 별도 검증 대상이다. [계약별 원본 위치와 실행 결과](marker-lifecycle.json) · [웹](marker-web.json.gz) · [Android](marker-android.json.gz) · [iOS](marker-ios.json.gz)

## 경로 검색 결과를 지도에 그리고 지우기

0.1.1 README의 서울시청 → 강남역 좌표로 자동차 경로를 조회하고, 각 앱에서 반환받은 `route.path`를 그대로 `drawPolyline`에 넘겼다. 공식 SDK와 Flutter 세 플랫폼 모두 거리는 10,698m, 안내 지점은 15개였다. 260개 좌표를 경도·위도 순서로 소수점 일곱 자리까지 정규화했을 때 네 경로와 네 SDK 선의 해시가 모두 일치했다. 표시된 선을 지운 뒤에는 네 실행 모두 지도 연결과 렌더러 레이어가 해제됐다.

| 실측값 | 공식 SDK | 웹 | Android | iOS |
| --- | ---: | ---: | ---: | ---: |
| 소요 시간(초) | 1,164 | 2,127 | 2,127 | 1,152 |
| 통행료(원) | 0 | 0 | 0 | 0 |
| 예상 택시비(원) | 12,400 | 15,300 | 15,300 | 12,400 |

독립 실행 간 요청 시각이 달랐다. 시간과 요금은 각 응답의 관찰값으로 남겼으며, 차이의 원인은 이 실험으로 판별할 수 없다. Flutter 세 플랫폼에서는 선 색상 `#0064ff`, 두께 6, 불투명도 1도 확인했다. 공식 SDK 단독 실행에서는 색과 두께를 지정했지만 렌더러에서 두 값을 다시 읽지 못했다. [공식·웹·Android·iOS 호출 및 결과](driving-route.json.gz)
