# 0.1.1 제스처와 위젯 생명주기 검증 근거

실행 입력 SHA-256 `b010793ead2384bac90ae8d6e37e695d4991d38625c077b7ec0d709528ee3a95`. Flutter 3.50.0 stable. 두 시나리오 파일 및 통합·단독 실행 로그 5개의 해시를 저장된 체크포인트와 대조했다. 행 번호는 이 입력에 고정했다.

| b010 실행 | Web | Android | iOS |
|---|---|---|---|
| 통합 제스처 | 통과 | 통과 | 두 번 탭 콜백 시간 초과. 확대 단언 통과, 롱 탭·드래그 미실행 |
| 통합 생명주기 | 통과 | 75초 전체 제한 초과, 개별 실패 지점 기록 없음 | 인라인 HTML 새로고침 결합 조건 실패 |
| 단독 생명주기 | 기록 없음 | 통과 | 동일 새로고침 조건 실패 |

## map_gestures

| 시험 행 | 단언 | 분류 · 근거 강도 | 근거와 한계 |
|---|---|---|---|
| 83–94 | 지도 준비·양수인 캔버스 크기 | Flutter 고유 계약 · 부분 | 생성 콜백은 명시. 내부 캔버스 선택자와 크기는 준비 확인 방법. F1; D58–61 |
| 96–104 | 초기 중심과 줌 16 | 공식 동등성 · 명시 | center·zoom 옵션과 읽기 결과를 대조. ±0.005°는 테스트 허용치. F2; D58–65 |
| 107–121 | 탭 콜백과 탭 위치 | Flutter 고유 계약 · 명시 | 공식 Click 위치를 전달하는 Dart 콜백. 중심에서만 ±0.01°로 검사하여 중심 상수 반환도 통과 가능. F1; E45–47 |
| 123–133 | 두 번 탭하면 정확히 1레벨 확대 | 기대 근거 부족 · 보장 미확인 | Dart 타입/설명에는 확대 부수효과가 없다. 초기+1만 비교하며 Callback 전달과 독립. b010 iOS에선 이 단언을 통과했지만 이전 별도 실행에서 실패. F1; B528628 |
| 66–70, 135–146 | 두 번 탭 시 Dart 콜백에 위치 전달 | Flutter 고유 계약 · 명시 | DoubleClick은 SDK의 DOM dblclick 경로에 존재. iOS에서 터치 두 번을 해당 이벤트로 해석하는 조건은 문서에 없다. b010은 콜백을 받지 못해 위치 검사에 미도달. 중복 위치는 테스트가 버린다. F1; B528628 |
| 71–75, 149–162, 345–413 | 롱 탭/컨텍스트 메뉴 콜백과 위치 | Flutter 고유 계약 · 부분 | 0.1.1은 롱 탭(ContextMenu)로 명시하고 모바일 JS에서 ContextMenu에만 연결했다. 공식 예제는 우클릭을 시연. SDK의 LongTap은 입력 설정과 타이머 조건부. Web/Android는 동기 touch·우클릭 조합, iOS만 실제 hold. b010 iOS 미실행. 중복도 측정 불가. F1; F4; E69–82; B521126 |
| 167–180 | 드래그 후 최종 중심 이동 | 공식 동등성 · 관찰 | 지도 이동은 공식 기능. 0.0001°·동쪽으로 일정량 이동은 이 시나리오의 입력에 대한 판정이며 프레임별 보장이 아니다. E51–58; F4 |
| 182–188 | 드래그가 추가 탭 콜백을 만들지 않음 | Flutter 고유 계약 · 추론 | 독립된 클릭·드래그 이벤트의 사용자 의미. 300ms는 검사 창. SDK판 클릭 처리에 이동량 조건이 있다. F1; E45–58; B528628 |
| 190–216 | 시작/종료 순서와 사이의 이동 이벤트 | Flutter 고유 계약 · 부분 | 공식 DragStart/DragEnd와 DragType 공개. 이동 이벤트가 하나도 없어도 이 코드는 통과하며 모든 시작/종료가 정확히 하나임도 보이지 않는다. 0.1.1 모바일은 start/end만 중계. F1; F4; E51–58; B479450 |
| 218–234 | 드래그 시작 위치 근접, 시작/종료 줌 15–19 | 공식 동등성 · 부분 | 각 이벤트 시점 중심·줌이 의미 있는 비교 대상. 고정 범위와 원래 중심 ±0.01° 검사는 실제 SDK 이벤트별 값 일치를 입증하지 않는다. F4; E51–64 |
| 236–241 | 시작과 종료 중심 차이 ≥0.00001° | 기대 근거 부족 · 보장 미확인 | 공식 예제는 각 핸들러 시점 중심을 별개로 읽는다. 차이·최소량·카메라 갱신 시점은 명시하지 않는다. a3cb 실패와 b010 Android PASS를 구분. 이벤트별 SDK 값과 Dart payload, 별도로 안정화된 카메라 이동을 검증할 수 있다. E51–58; F4 |

## widget_lifecycle

| 시험 행 | 단언 | 분류 · 근거 강도 | 근거와 한계 |
|---|---|---|---|
| 157–171, 277–286 | 초기·재빌드 중심/줌 | 공식 동등성 · 명시/구현 | SDK 옵션/카메라와 Flutter didUpdateWidget 전달. 캔버스 준비는 시나리오 선행 조건. D58–65; F2; F3 |
| 172–204, 287–325 | 초기/교체/삭제된 마커·팝업·도형·라벨·커스텀 오버레이와 클러스터 | Flutter 고유 계약 · 부분 | 공개 목록과 0.1.1의 재동기화. 커스텀 DOM·라벨 레이어에는 실제 부착 증거가 있으나 모양 registry에 항목이 있다는 검사만으로 모든 도형의 표시나 제거를 증명하지 못한다. F2; D3480,4117 |
| 326–342 | 교체된 마커 클릭 1회, 이전 콜백 0회 | Flutter 고유 계약 · 추론/구현 | 공개 onMarkerTap에 탭을 전달할 때 현재 위젯의 콜백을 사용한다. 테스트는 그 시점 횟수를 읽으며 물리적 화면 히트 테스트는 수행하지 않는다. F1; F2 |
| 345–370 | Web unmount registry 해제와 재마운트된 지도 준비 | Flutter 고유 계약 · 부분 | 리소스 정리·새 위젯 생성. 전역 registry가 0이어야 하는 조건은 이 격리된 테스트 내부 구조에 의존한다. 다른 지도와 공존하는 경우까지 포괄하지 않는다. F1; F2 |
| 399–403, 453–457 | 초기 10–18, 재빌드 8–17 줌 제한 | 공식 동등성 · 명시/추론 | 공식 min/max·setZoomLimit는 명시. Flutter 위젯 재빌드 반영은 래퍼 기대. 0.1.1 모바일 didUpdateWidget은 해당 옵션을 갱신하지 않았다. D64–65,583–589; F2 |
| 404–412, 458–465 | 초기 UI 표시 및 재빌드 후 탐색/축척 컨트롤 숨김 | Flutter 고유 계약 · 부분 | 생성 옵션 표시 여부는 공식 명시. 재빌드 반영은 래퍼. 플래그 OR 일반 DOM 클래스, 제거 시 옵션/핸들만 보므로 b010 PASS가 시각적 제거를 증명하지 않는다. D70–71; F2 |
| 414–439, 468–493 | 범위 안 14와 양 경계(10/18, 8/17) 도달 | 공식 동등성 · 명시/배포본 | 문서상 setZoom과 제한 기능. 양 경계는 이 배포본의 setZoom 비교식에서 허용. D357–373,583–589; B1264095; F3 |
| 420–425, 439–443, 474–479, 493–497 | 범위 밖 5/22 요청을 무시하고 기존 줌 유지 | 공식 동등성 · 배포본/관찰 | 공식 배포 JS에서 범위 밖 요청 시 조기 반환. 공개 가이드는 제한을 설명하나 무시 정책은 이 배포본에서 확인. setZoomLimit이 기존 카메라를 새 한도로 조정하는 별도 동작과 구별. D583–589; B1264095,1264842 |
| 499–529 | 동일 위젯 컨테이너 크기 변경·relayout 후 캔버스 크기 변경 | 공식 동등성 · 명시/부분 | 공식 resize는 외부 div 변경용. 이 검사는 폭/높이 중 하나의 변화만 읽고, relayout 호출만이 변화 원인이라는 비교는 없다. D955–962; F3 |
| 531–550 | 변경된 뷰포트에서 fitBounds 후 대상 영역 포함 | 공식 동등성 · 명시 | 공식 표시 영역과 컨트롤러 fitBounds. 테스트 비교에는 경계별 0.0005° 여유가 있다. D194–200; F3 |
| 566–577, 594 | Web getter UnsupportedError, 모바일 WebViewController 반환 | Flutter 고유 계약 · 명시/구현 | 0.1.1 getter 소스에 모바일 전용과 예외가 명시됨. F3 |
| 579–591 | Web reloadHtml/reload 후 살아 있는 지도·DOM 유지 | Flutter 고유 계약 · 구현 | 0.1.1은 모바일 controller가 있을 때만 실행. 두 호출을 연속 검사하므로 개별 효과의 별도 측정은 없다. F3 |
| 596–610 | 모바일 reloadHtml 결과 새 HTML 표시, 임시 JS 상태 설정 확인 | Flutter 고유 계약 · 명시/선행조건 | reloadHtml은 입력 문자열 로드. 센티널과 임시 플래그는 다음 단계의 확인 수단. F3 |
| 612–621 | reload 후 동일 인라인 HTML 보존과 JS 전역 초기화 | 기대 근거 부족 · 실사용 기대/명세 미확인 | iOS에서 이 조합이 두 번 실패했다. 0.1.1은 WebView.reload를 위임. 플러그인은 현재 URL 재로드, WebKit은 현재 페이지 재로드를 문서화한다. 직전 HTML 문자열 재생성·baseUrl 재현은 명시하지 않는다. URL 기반 새로고침과 인라인 재로딩이라는 별도 요구를 구분한다. F3; W; A |

## 실행 해석

- 0.1.1 배포 당시 코드에 콜백 선언이 있어도 플랫폼별 전달 성공은 보장되지 않는다. 출시된 모바일 코드에서 double 플래그는 받아도 이를 등록하는 onMapDoubleTap 채널/리스너는 확인되지 않는다. b010은 이후 수정된 소스다.
- 같은 절차에서 iOS만 XCTest로 실제 입력을 보냈다. Web/Android는 SDK 캔버스에 DOM 이벤트를 dispatch했다. callback 도착은 확인해도 실제 터치 하드웨어/브라우저 제스처 인식과의 완전 동등성을 뜻하지 않는다.
- 별도 a2a342f0 진단에서 iOS double 동작은 Flutter down/up 두 쌍, WK DOM touch 시작/끝 한 쌍이었고 Dart double이 없었다. 750ms hold 때 WK 터치 시간은 약 625ms였고 Dart long 콜백이 없었다. 이 기록은 b010에서 long/drag를 실행했다는 근거가 아니다.
- 이전 a3cb1d46 Android의 시작/종료 좌표차 검사 실패, 0c8f9810 iOS의 확대(+1) 검사 실패가 각각 있었다. 별도 85f1bd46 Android 기록은 실제 드래그 시작/종료 중심과 settle 이후 중심이 서로 달라질 수 있음을 보여준다.
- b010의 iOS reload 실패는 결합 조건이 충족되지 않았음을 뜻한다. 이전 별도 iOS 즉시 관찰은 새로고침 직후 문서 센티널과 임시 JS 변수가 모두 존재했다. b010은 최종 DOM이나 JS 상태 각각을 독립 채집하지 않았다.
- 표에서 ‘명시’는 공개 선언이나 문서의 직접 설명, ‘구현/배포본’은 특정 소스의 동작, ‘추론/관찰’은 시나리오 수준의 기대 또는 측정, ‘보장 미확인’은 인용 자료에서 조건을 찾지 못했다는 뜻이다. 문서화된 동작도 개별 스모크 통과만으로 공식 SDK와의 쌍대 검증이 완료되지는 않는다.

## 원본

- P [pub.dev 0.1.1 원본](https://pub.dev/api/archives/tmap_flutter_sdk-0.1.1.tar.gz) · `dae54a154deb0b979e27c18d7d49d00faedd93bc8dfff8c732f11438a7fbb056`
- F1 [0.1.1 callbacks.dart L7–20, 43–48](https://github.com/kjm0202/tmap_flutter_sdk/blob/fec1b1cb867922d9cef943c835a0af31035085a3/lib/src/callbacks/callbacks.dart#L7)
- F2 [0.1.1 TMap L44–73, 93–145, 269–287, 345–440, 469–488](https://github.com/kjm0202/tmap_flutter_sdk/blob/fec1b1cb867922d9cef943c835a0af31035085a3/lib/src/tmap.dart#L44)
- F3 [0.1.1 컨트롤러 L35–41, 84–102, 178–212](https://github.com/kjm0202/tmap_flutter_sdk/blob/fec1b1cb867922d9cef943c835a0af31035085a3/lib/src/tmap_controller.dart#L178)
- F4 [0.1.1 모바일 이벤트 연결 L98–136](https://github.com/kjm0202/tmap_flutter_sdk/blob/fec1b1cb867922d9cef943c835a0af31035085a3/lib/src/js/js_map_init.dart#L98)
- E [공식 TMAP Vector JS 이벤트 예제 원본 HTML 행](https://tmapapi.tmapmobility.com/webv3VSM/sample/webSample03.html) · `6c5ce735ead64c0195e3875ed1fc4d00d25dc6aca75be596eb5b34fec0c7e121`
- D [공식 TMAP Vector JS 레퍼런스 원본 HTML 행](https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html) · `bae9de2c73bf9be412694e92f26f95007f6d46e81845bf271bd20b1e1481e214`
- B [실제 TMAP 배포 JS. 위치는 0부터 시작하는 바이트 오프셋](https://toptmaptile1.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206) · `5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e`
- W [b010의 webview_flutter 4.10.0, lib/src/webview_controller.dart L150–153, 214–216](https://pub.dev/api/archives/webview_flutter-4.10.0.tar.gz) · `889a0a678e7c793c308c68739996227c9661590605e70b1f6cf6b9a6634f7aec`
- A [Apple WKWebView.reload](https://developer.apple.com/documentation/webkit/wkwebview/reload%28%29)

각 행과 플랫폼별 도달 여부, 진단 원본의 별도 입력 해시, 로그 SHA-256은 [행별 검증 결과](gesture-lifecycle-assertions.json)에 있다.
