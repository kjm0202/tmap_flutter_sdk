# TMAP Flutter SDK 0.1.1 계약 감사

**기존 미해결 진단 197건 중 82건이 남았다.** 동일 공식 SDK 기준본의 `a977bf1` 인증 감사에서 직전 87건 중 5건을 해소했다(좌표 변환·행정구역 REST 문서 3건, 이전 지도 이벤트 스냅샷 검사 1건, POI 좌표 검사 1건). 누적 해소 115건, 신규 0건이다. 입력 무결성 검사는 통과했고 후보 4,046개와 브리지 관찰 61개가 유지됐다. 실제 지도 생성 옵션 차이 4건은 열려 있으며 엄격 검사는 종료 코드 1을 반환했다. [최초 진단과 이번 실행 대조](../checkpoints/2026-11-19/fixed-197-eleventh-reduction.json.gz) · [세 플랫폼 카메라·지도 표시 재실행](../checkpoints/2026-11-19/fixed-177-camera-platform-replay.json.gz) · [검사 상태](status.json)

앞선 `407358e`→`a96d2ff` 실행에서는 미해결 진단이 165건에서 197건으로 늘었다. 생성자 전달 경로 20곳이 새로 기록됐고, 브리지 진단이 16건에서 31건으로 늘었다. 공식 문서의 메서드 표제 2건과 메뉴 링크 1건은 원본 불일치로 판정했다. 당시 브리지 진단 31건 중 27건은 검사 대상 래퍼를 찾지 못한 경우이고 4건은 지도 초기 옵션값 차이다. [두 실행의 유형별 증감과 브리지 진단 ID](../checkpoints/2026-11-19/diagnostic-delta-165-to-197.json.gz)

SDK 기준본을 고정하고 그 원문의 URL·수집 시각·SHA-256을 기록했다. [검사 상태](status.json) · [공식 입력 158개](../../../tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json)

| 확인 항목 | 결과 |
| --- | --- |
| TData 오류 응답 | 실패한 응답 본문에 정상처럼 보이는 POI·자동완성·경로 데이터가 함께 오면 Dart의 typed 변환이 빈 목록 또는 null을 반환하고 원문은 보존한다. 웹·Android·iOS에서 같은 33개 조건 중 11개가 수정 전 실패했고, 수정 후 모두 통과했다. 두 공식 JS 코어는 객체형 오류에 완료 콜백, 문자열 `error`에 오류 콜백을 호출했다. [오류 응답과 원문 대조](../checkpoints/2026-11-19/typed-response-failure-three-platform.json.gz) · [수정 후 실제 경로·POI 재실행](../checkpoints/2026-11-19/typed-response-positive-coordinate-replay.json.gz) |
| TData 차량·보행 경로 | EPSG3857 요청에서 경로·안내 334개의 미터값을 도 단위로 변환하도록 수정했다. 같은 시나리오가 수정 전 웹·Android·iOS 모두에서 실패했고, 수정 후 세 플랫폼 모두 공식 WGS84 응답과 0.00001도 이내로 일치했다. [공식 응답과 구현의 전후 대조](../checkpoints/2026-11-19/tdata-coordinate-three-platform-final.json.gz) |
| 웹 지도 초기 옵션 | 공식 SDK는 명시한 최소·최대 기울기 10°·50°와 초기·최대 경계를 반영했다. 웹 브리지에 같은 값을 입력하면 기본 기울기 0°·60°와 기본 경계를 사용했다. 0.1.1의 공개 지도 생성자에는 이 네 인수가 없으며, SDK 전달 차이 4건은 열려 있다. [독립 지도 네 개에서 측정한 결과](../checkpoints/2026-11-19/original-and-web-initial-map-options.json.gz) |
| Android 더블탭 | 172ms 간격의 터치에서 SDK가 시작한 확대가 중단되면 줌 17까지 복구했다. 최대 줌 16 및 확대 비활성 조건은 16을 유지했다. 웹·iOS 공통 시나리오는 통과했다. Android 공통 시나리오는 첫 실행에서 공개 콜백 시간 초과, 이후 관찰 실행과 무관찰 재실행에서 통과했다. 4배 CPU 제한의 후속 실행에서 줌 17에 도달한 횟수는 공식 SDK 5/6회, 0.1.1 5/5회, 수정본 5/5회였다. 이전에 수정본에서 확대가 시작되지 않고 16을 유지한 1회는 재현되지 않았다. [CPU 제한 실측](../checkpoints/2026-11-19/android-fourfold-checkpoint.json.gz) [공식 SDK·출시본·수정본 실측과 재실행 기록](../checkpoints/2026-11-19/android-double-recovery-qa.json.gz) |
| 기준본 복원 | URL·역할 158개, 고유 본문 148개의 길이와 SHA-256을 검증했다. |
| 추출·대응 | 합집합 4,046개 중 공식 문서에 있는 항목은 749개, 예제에서만 확인된 항목은 26개다. Dart 선언 후보가 연결된 항목은 213개다. 나머지 3,833개 중 3,820개는 미대응, 13개는 실행 중 예외로 분류됐다. 이번에 생성자 헬퍼 경로를 추적해 후보 ID 30개를 추가했고 기존 후보 47개를 보강했다. 생성자 전달 경로를 확정하지 못한 진단 20건을 기록했다. [고정 코어와 추출기 대조](../checkpoints/2026-11-19/constructor-option-flow-real-and-controls.json.gz) |
| 기존 검증 기록의 적용 범위 | 이전 `407358e` 실행의 미해결 165건 중 기존 관찰 기록을 거부한 77건을 해당 검사기 74개와 대조했다. 모두 예전 기준본 ID와 현행과 동일한 JS 코어 SHA를 참조한다. 50건의 검사기 소스에 백업 브랜치에만 있고 출시 패키지·검증 소스에 없는 제품 경로가 등장한다. 세 검사기를 이전 기준본으로 다시 실행해도 지문이나 플랫폼 근거·파일 누락을 이유로 모두 거부됐다. [이슈별 검사기·배포 파일·독립 재실행](../checkpoints/2026-11-19/rejected-receipt-source-bindings.json.gz) |
| 예제 필드 수신자 | 같은 추출기로 과거·현재 공식 기준본을 별도로 읽고 현재 미해결 필드 812곳을 실제 원문에 모두 연결했다. 이전에는 59곳을 DOM·정규식 결과, 78곳을 REST 응답, 12곳을 SDK 필드로 분류했다. 나머지 663곳은 당시에도 미해결이었고 그중 193곳에 조건부 근거가 있었다. [812개 표현식의 원문 위치와 두 실행의 분류](../checkpoints/2026-11-19/example-field-baseline-comparison.json.gz) |
| 경로 예제 필드 272곳 | 일반 경로와 경유지 최적화의 실제 성공 콜백 경로에 54곳을 연결했다. 166곳은 선언만 있고 호출되지 않는 보조 함수 안에 있다. 일반 경로 문서의 간소 응답에는 geometry가 없었고, 최적화 문서의 두 예제에는 루트 properties에 총계가 있었다. [272곳별 할당·호출·응답 형식](../checkpoints/2026-11-19/route-examples-field-provenance.tar.gz) |
| JSON 표본 해석 | 엄격한 JSON 파싱에 실패한 문서 표본 9개 중 4개는 문자열 바깥의 줄맞춤용 비분리 공백만 바꾸면 읽힌다. 나머지 5개에는 문자 엔티티 조각, 여분의 닫는 중괄호 또는 생략 기호가 있었다. 원문 오류와 진단용 변형을 구분했다. [표본별 실패 지점](../checkpoints/2026-11-19/rest-json-example-parse-diagnostics.json.gz) |
| 예제 메서드 호출 95곳 | 현재 원문에서 호출 대상이 미확정인 95곳 중 SDK 멤버 11개에 31곳을 연결했다. 22곳은 직접 호출이고 9곳은 특정 할당 또는 콜백 경로에서만 해당한다. 호스트·외부 응답 처리 40곳, 내부 지도 엔진 12곳, 여전히 미확정인 호출 12곳도 별도 기록했다. 배포 코어에서 공식 우클릭 메뉴 예제를 수정 없이 실행해 실제 마커 객체가 전달되고 드래그 설정이 켜졌다 꺼지며 그 마커로 지도가 이동하는 것을 확인했다. [95곳별 원문과 실행 근거](../checkpoints/2026-11-19/example-call-receiver-audit.tar.gz) · [우클릭 예제 재생](../checkpoints/2026-11-19/official-marker-context-menu-callback.json.gz) |
| 로컬 CI 재현 | 독립 체크아웃에서 입력 무결성 검사는 통과했고, 계약 차이와 근거 부족을 포함한 다섯 가지 사유로 최종 게이트가 실패했다. [실행 결과와 대조 실험](../checkpoints/2026-11-19/strict-ci-proof.json.gz) |
| 카메라 브리지 구성요소 | Chrome에서 공식 지도와 포트 지도를 따로 생성하고 중심·줌·기울기·방향을 변경했다. 웹 JS와 모바일용 JS에서 각각 4/4가 일치했고, 포트 호출을 생략한 대조군은 0/4였다. 새 브라우저에서 반복해 같은 값을 얻었다. 모바일 기기 판정은 별도다. [입력·변경 전후 값](../checkpoints/2026-11-19/release-camera-component-comparisons.json.gz) |
| REST 문서 범위 | 메뉴로 연결된 24개 문서의 표 187개가 기존에 검토한 원문과 일치했다. 배포 코어와 문서 예제 코어 각각에서 TData 메서드 28개의 요청 경로를 다시 추출했다. 해당 24개 문서의 경로는 두 코어의 문자열·템플릿 리터럴에서 발견되지 않았다. REST 동작 및 표의 필드 검증은 열어 두었다. [두 코어의 메서드와 표별 지문](../checkpoints/2026-11-19/release-navigation-source-comparison.json.gz) |
| 카메라·지도 표시 재실행 | 같은 Flutter 입력으로 웹·Android·iOS에서 각각 2/2가 통과했다. 지도 표시 시나리오의 카메라 입력을 별도 공식 지도에 재생해 7개 상태 조건도 확인했다. [플랫폼 로그 근거와 공식 지도 관찰값](../checkpoints/2026-11-19/release-camera-three-platform-replay.json.gz) |
| 지도 생성 옵션 | 공식 지도는 `minPitch=10`, `maxPitch=50`, `bounds`, `maxBounds` 네 값을 모두 적용했다. 같은 입력을 준 웹 브리지는 기본값을 유지하거나 값을 저장하지 않았다. 0.1.1 배포본의 `TMap` 생성자에도 네 이름이 없다. [공식 문서 위치·배포 선언·관측값](../checkpoints/2026-11-19/web-release-constructor-options.json.gz) |
| 웹 지도 크기 변경 | 호스트 너비·높이만 바꾸면 양쪽 지도 모두 800×600을 유지했다. 공식 지도에서 `resize()`, 웹 포트에서 `relayout()`을 호출하면 양쪽 모두 640×480으로 바뀌었다. [호스트와 지도 크기 실측](../checkpoints/2026-11-19/web-release-resize-comparison.json.gz) |
| 나머지 REST 문서 13개 | 표 107개와 TData 요청식을 대조했다. 9개 문서(64표)는 경로와 HTTP 메서드가 같고, 운전·보행 2개 문서(30표)는 문서와 Dart가 POST, 공식 JS가 GET을 사용한다. 2개 문서(13표)의 경로는 28개 TData 메서드에 없다. 앞서 검토한 187표와 합해 294개 표 전체에 원본 위치가 연결됐다. [107표와 요청식](../checkpoints/2026-11-19/rest-table-endpoints.json.gz) · [검증 대조군](../checkpoints/2026-11-19/rest-table-endpoint-controls.json.gz) · [Dart 요청 경로](../checkpoints/2026-11-19/released-rest-adapter-endpoints.json.gz) |
| 공개 API의 시나리오 참조 | 공개 선언 331개 중 직접 호출·생성·읽기 98개, 생성자 인자로만 전달 81개, 타입으로만 사용 20개, 명시적 참조 없음 132개다. 시나리오에서 값을 전달하는 경우에도 렌더러의 결과를 별도로 검사할 수 있어, 각 행에 실제 결과 확인 여부를 구분했다. [331개 대조표와 다음 시나리오](../checkpoints/2026-11-19/public-331-real-scenarios.json.gz) |
| TData 실사용 재실행 | 동일한 소스와 입력으로 장소 검색, 자동차 경로·주소, 보행 경로를 다시 실행했다. 웹·Android·iOS 각각 3/3 통과했다. [플랫폼별 실행 결과](../checkpoints/2026-11-19/tdata-three-platform-rerun.json.gz) |
| TData 인자 타입 | 경고 12곳 모두 공식 문서에 인자 이름과 예시 값만 있다. REST 필드 타입은 Number 6개, String 6개며 8개는 JS 인자와 필드 이름도 다르다. JS 입력 타입은 미확정이다. [인자별 문서 원문·SDK·REST 대조](../checkpoints/2026-11-19/official-unspecified-parameter-types.json.gz) |
| 주소로 좌표 찾기 | 현재 수정 후보에서 서울시청 도로명·덕수궁 지번은 세 플랫폼 모두 공식 SDK와 같은 좌표를 반환했다. 실제 시·구에 가상 도로명과 번지 99999를 입력하자 공식 SDK는 HTTP 400, Flutter는 HTTP 200 응답에서 좌표 한 개를 반환했다. 두 API는 사용하는 검색 엔드포인트와 입력 형식이 다르다. [주소별 요청·콜백·반환값과 코드 버전](../checkpoints/2026-11-19/forward-geocoding-endpoints.json.gz) |
| 자동완성에서 선택한 장소 찾기 | 세 플랫폼에서 실제 추천 ‘서울역ktx’를 POI 검색에 그대로 전달했다. 공식 SDK와 Flutter가 반환한 추천 20개와 장소 20개의 순서·관측 필드가 일치했다. 서울역[KTX정차역]의 ID와 좌표도 일치했다. 비실재 검색어에는 빈 추천을 반환해 후속 요청을 보내지 않았다. 디버거에서 공개 API를 호출해 얻은 결과다. [호출 순서·입력·선택값](../checkpoints/2026-11-19/autocomplete-to-selected-poi.json.gz) |
| 출시 버전의 주소 파서 | 같은 실제 HTTP 응답을 출시 0.1.1과 수정 후보의 서비스에 재생했다. HTTP 200 세 건에서 출시 코드는 모두 null, 후보는 중첩 배열의 좌표를 반환했다. 주소 없음(400)은 양쪽 모두 null이었다. 요청에서 주소 구분을 생략하거나 F00을 지정할 때 응답 바이트도 네 건 모두 같았다. [안정 Dart에서 재생한 원문·응답 지문](../checkpoints/2026-11-19/published-vs-candidate-forward-parser.json.gz) |
| REST 필드 계층 | 37개 문서의 294개 표 중 필드 표 125개에서 2,341개 행을 원본 위치에 연결했다. 9개 표에서 표시 경로가 반복되는 행이 57개였다. 예를 들어 Matrix 표의 두 경도는 예제 JSON에서 출발지와 도착지 배열에 따로 속한다. JSON 표본 50개 중 41개를 두 파서로 읽었고 9개는 두 파서 모두 실패했다. [원본 바이트 범위·필드 경로·예제별 결과](../checkpoints/2026-11-19/rest-field-table-layout.json.gz) |
| 장소 검색 응답의 중첩 필드 | 공식 표에서 88개 경로를 추출했다. 문서 예제 두 장소와 실제 서울역 검색 여덟 장소에서 같은 55개 경로를 확인했다. 이번 REST 재실행의 응답 SHA-256은 앞선 공식 SDK와 Flutter의 두 응답과 모두 같았다. 표에 Number로 적힌 경로 15개가 실제 JSON에서는 문자열이었다. 나머지 33개 경로는 이 표본에 없었다. [원문 행과 JSON 타입](../checkpoints/2026-11-19/poi-search-response-schema.json.gz) |
| 경로 안내점 선택 | 세 플랫폼 각각 자동차 8개·보행 16개 안내점의 이름·설명·위도·경도와 순서가 해당 HTTP 응답과 일치했다. 각 경로의 중간 안내점을 공개 컨트롤러로 선택하니 실제 지도 중심이 그 좌표로 이동했다. 세 플랫폼의 동일 소스 지문으로 재실행했고 모바일 VM에서 로드된 관련 Dart 소스 7개도 대조했다. 디버거를 통한 선택이며, 목록을 손으로 탭하는 UI는 별도다. [웹](../checkpoints/2026-11-19/web-route-guide-selection.json.gz) · [동일 소스로 실행한 Android·iOS](../checkpoints/2026-11-19/native-route-poi-same-source.tar.gz) |
| 공식 경로 SDK와 Flutter 비교 | 세 플랫폼에서 자동차·보행 18쌍을 측정했다. 정상 12쌍은 거리·경로·안내점이 일치했고, 범위 밖의 위도 6쌍에서는 양쪽 모두 204, 공식 SDK는 오류 콜백, Flutter는 null로 완료했다. 정상 호출의 숫자 0 검색 옵션은 GET 쿼리에서 생략되고 Flutter POST 본문에는 남는다. 인증키는 측정 시 HTTPS 헤더로 전달했다. 소요 시간·택시비는 측정 시점에 따라 달랐다. [인증 처리와 판정 범위](../checkpoints/2026-11-19/route-method-comparison-scope.json) · [입력·플랫폼별 호출 및 모델 비교](../checkpoints/2026-11-19/route-method-comparison.json.gz) |
| POI 도로명주소 | 서울역 주변 검색 결과 8개 전부에서 Flutter의 `roadAddress`가 원본의 전체 도로명주소와 달랐다(웹·Android·iOS 각각 0/8 일치). 서울역은 원본 **한강대로 405**, Flutter는 **한강대로**였다. 원본에는 `firstBuildNo`와 중첩된 `bldNo1`이 있고, 변환기는 상위 `buildingNo1`을 조회한다. 같은 8개에서 ID·이름·전화·좌표·거리는 일치했다. [웹과 공식 SDK 대조](../checkpoints/2026-11-19/web-poi-detail-address-comparison.json.gz) · [동일 소스 모바일 측정](../checkpoints/2026-11-19/native-route-poi-same-source.tar.gz) |
| 공통 시나리오 14종 | `688bd5c`의 웹·Android·iOS 최종 전체 실행이 각각 14/14와 종료 코드 0을 기록했다. Android에는 더블탭 직후 줌 변경, iOS에는 드래그 후 중심 이동을 기다리다 시간 초과한 실행도 있었다. 두 간헐 실패의 원인은 미확정이다. [전체 실행·재실행·기기 입력 기록](../checkpoints/2026-11-19/three-platform-14-scenarios-688bd5c.json.gz) |
| 겹친 Polygon의 zIndex | `6f1c538`에서 모바일도 50·10과 Flutter 기본값 5를 원본 SDK 객체에 전달했다. 공식 JS에서 생략한 값은 0이다. 세 플랫폼 각각 32개 상태를 비교한 결과, 겹친 부분은 값의 크기와 관계없이 나중에 생성한 도형 색이었다. 기존 SDK 객체를 떼었다 붙이는 경우와 새 객체를 만드는 경우를 별개로 측정했다. [수정 전](../checkpoints/2026-11-19/pre-fix-polygon-zindex.tar.gz) · [수정 후 픽셀·SDK 상태](../checkpoints/2026-11-19/postfix-polygon-zindex.tar.gz) · [공통 시나리오](../checkpoints/2026-11-19/polygon-zindex-common-replay.json.gz) |
| 원·선·사각형을 겹쳐서 표시하고 다시 추가 | `e6d241c`에서 세 플랫폼 모두 Flutter 기본값(원·선·사각형 순서로 5·10·5), 명시적 0, 양수 두 조합을 SDK에 전달했다. 수정 전 모바일은 기본값과 양수도 0으로 전달했다. 공식 SDK와 Flutter의 겹침 화면 표본 54개가 일치했고, 이 입력에서는 나중에 생성한 도형이 위에 그려졌다. [수정 전 측정](../checkpoints/2026-11-19/shape-family-zindex-before.tar.gz) · [수정 후 측정](../checkpoints/2026-11-19/shape-family-zindex-after.tar.gz) · [공통 시나리오 두 개](../checkpoints/2026-11-19/shape-family-zindex-common-replay.json.gz) |
| 경로에 선 두께 0 지정 | `3526db1`에서 세 플랫폼 모두 SDK에 0을 전달했다. 공식 SDK가 선택한 폭은 2다. 웹에서 6→2픽셀, Android에서 12→5 물리 픽셀, iOS에서 15→6 물리 픽셀로 바뀌어 각 기기의 원본과 일치했다. 선·면 투명도 0과 기본 선 두께도 따로 비교했다. [수정 후 세 플랫폼 단면](../checkpoints/2026-11-19/shape-width-after-three-platforms.tar.gz) · [공통 테스트와 이전 Android 디코딩 실패](../checkpoints/2026-11-19/shape-style-common-batch.json.gz) |
| 클러스터에서 개별 장소 마커가 드러난 뒤 탭·드래그 | `b8adbf5`에서 세 플랫폼 모두 아이콘 크기와 위치, 투명도, URL 아이콘의 라벨 색, 숨긴 멤버의 입력 제외를 실측했다. 수정 전 웹은 HTML 마커를 기본 핀으로 그렸고 숨긴 장소도 입력을 받았다. 수정 후 세 플랫폼에서 A를 한 번 탭해 해당 ID를 받았고 드래그 시 시작·이동·종료 콜백과 좌표 변화를 관측했다. 원본 SDK의 기본 드래그와 Flutter 어댑터의 콜백은 구분해 기록했다. [원본과 Flutter의 수정 전후 SDK 값·화면·포인터 입력](../checkpoints/2026-11-19/cluster-members-before-after.tar.gz) · [세 플랫폼 공통 시나리오 4개와 이전 iOS 실패 기록](../checkpoints/2026-11-19/cluster-members-common-batch.json.gz) |
| 수정 후 클러스터와 원 | `a8cf96f`에서 원본과 Flutter의 배지 표시·탭을 6조건씩 세 플랫폼에서 비교했다. 숨김은 지도 탭으로 전달됐고, 투명도 0.35는 반투명 배지로 표시됐다. 투명도 0은 원본이 0을 저장하고 불투명 배지를 그렸으며 Flutter도 같았다. 공통 회귀 시나리오는 `688bd5c`에서 웹·Android·iOS 모두 통과했다. [픽셀·탭·원본 JS 위치](../checkpoints/2026-11-19/postfix-cluster-three-platforms.tar.gz) · [공통 시나리오 실행](../checkpoints/2026-11-19/postfix-overlay-scenario-replay.json.gz) |
| 수정 후 장소 주소와 원 반경 | 서울역 검색의 공식 응답 8건과 세 플랫폼의 Flutter 도로명주소가 모두 일치했다. 부번 없는 7건과 부번이 2인 1건이 포함된다. 같은 서울 지도에서 반경 0m는 양쪽 모두 표시 픽셀 0개, 100m는 양쪽 모두 화면에 나타났다. Android 첫 100m 캡처는 배경만 보였고 별도 실행에서 표시와 제거를 재확인했다. [웹 실측](../checkpoints/2026-11-19/postfix-web-circle-poi.json.gz) · [모바일 실측과 재실행](../checkpoints/2026-11-19/postfix-mobile-circle-poi.json.gz) |
| 클러스터 표시·장소 조회 | 같은 소스에서 원본·Flutter 배지를 각각 탭해 세 플랫폼 모두 3개 ID로 원래 마커 3개를 같은 순서로 찾았다. 웹에서는 숨김과 0.35 투명도를 줘도 기본 배지 그대로였고 Android·iOS에서는 원본처럼 각각 숨겨지고 반투명해졌다. 웹 객체 동일성은 세 객체 각각 다시 확인했다. [세 플랫폼의 클릭·동일성·36개 화면](../checkpoints/2026-11-19/cluster-three-platform-styles-and-selection.tar.gz) · [이전 웹 측정](../checkpoints/2026-11-19/web-cluster-style-and-place-lookup.tar.gz) |
| 경로 방향 화살표 | 실제 서울 도로 경로의 세 연속 좌표에서 세 플랫폼 모두 원본·Flutter의 화살표 픽셀 마스크가 일치했다. 방향을 생략하거나 끄면 실선이었고, 켠 뒤 좌표를 뒤집으면 화살표도 반전됐다. 선 제거 후 해당 색상의 픽셀은 0개였다. [48개 크롭·입력 좌표·단계별 엔진 상태](../checkpoints/2026-11-19/polyline-direction-three-platforms.tar.gz) |
| 마커 드래그 | Android·iPad에서 네이티브 터치로 드래그하면 원본은 지도가 움직이고 마커는 고정됐다. Flutter는 둘 다 움직였다. 웹 브라우저 마우스 입력에서는 양쪽 화면의 마커가 움직였으나 원본 위치 조회는 [0, 0]을 반환했다. Flutter의 종료 좌표는 세 플랫폼 모두 위치 조회와 같았다. 운영체제 하드웨어 마우스 전달 여부는 미확인이다. [입력 경로·양성/음성 대조·좌표](../checkpoints/2026-11-19/marker-trusted-drag-three-platforms.tar.gz) |
| 원형 반경과 기본 색상 | 서울·부산에서 줌 15·16과 반경 50·100·200m를 조합한 12쌍의 렌더 마스크는 각 플랫폼에서 원본과 일치했다. 서울 줌 16에서 반경 0은 원본과 모바일에서 아무것도 그리지 않았고, Flutter 웹에서 100m 원(216×215픽셀)이 그려졌다. 원본은 0 허용 범위를 문서화하지 않았다. 스타일 생략 시 세 플랫폼의 Flutter는 빨간 면 0.3, 원본은 녹색 면 0.5를 사용했다. [웹의 화면·투영·SDK 반경](../checkpoints/2026-11-19/web-circle-radius.tar.gz) · [모바일 측정](../checkpoints/2026-11-19/mobile-circle-geodesic-render.json.gz) · [모바일 마스크](../checkpoints/2026-11-19/mobile-circle-geodesic-masks.tar.gz) |
| 출시 0.1.1 웹 예제 | 배포 tar 원문 그대로 실행해 앱 설정 창에서 인증했다. 당시 웹에서도 반경 0 입력의 공개 SDK 조회값은 100이었다. 서울역 여덟 결과의 도로명주소가 모두 건물번호를 잃었고, 서울시청·덕수궁은 HTTP 200과 후보 좌표를 받았으나 출시 공개 API에서 null을 반환했다. [배포 파일 지문·실제 HTTP 응답과 모델 대조](../checkpoints/2026-11-19/published-011-authenticated-web.json.gz) |
| 사각형 면과 테두리 | 같은 옵션을 지정하면 세 플랫폼 모두 원본과 면·테두리 픽셀이 일치했다. 투명도 0은 면만 숨겼다. 옵션을 생략하면 원본은 녹색 면 0.5와 빨간 테두리 0.7, Flutter는 #00AA00 면 0.3과 같은 색 테두리 1을 사용했다. [옵션·세 플랫폼 화면 96개](../checkpoints/2026-11-19/rectangle-fill-three-platforms.tar.gz) |
| 주변 맛집 버튼에서 마커 선택 | 실제 예제의 버튼을 플랫폼마다 두 번 눌렀다. 여섯 HTTP 응답 각각의 10개 장소가 이름·좌표·ID를 보존했고, 재검색 후 지도에 연결된 식당 마커도 10개였다. 각 플랫폼에서 화면에 보이는 같은 식당 하나를 눌러 상태 텍스트와 팝업 이름을 확인했다. [버튼 입력·응답·마커 연결](../checkpoints/2026-11-19/example-restaurant-button-native.json.gz) · [검색·재검색·팝업 화면 9장](../checkpoints/2026-11-19/example-restaurant-button-screenshots.tar.gz) |
| 라벨 줌 경계 | 서울시청 중심에서 최소 14·최대 16으로 지정한 라벨은 세 플랫폼 모두 줌 14·15·16에서만 보였다. 모든 플랫폼에서 원본·Flutter의 라벨 색상 픽셀 수가 줌별로 같았다. 범위를 지정하지 않은 원본은 다섯 단계 모두 보였고 제거하면 픽셀이 0개였다. [웹 화면 20개](../checkpoints/2026-11-19/web-label-zoom-range.tar.gz) · [Android·iOS 화면 40개](../checkpoints/2026-11-19/native-label-zoom-range.tar.gz) |
| 사각 범위 조회 | 실제 서울 지도에서 선택한 두 모서리로 중심·경계·안팎을 검사해 세 플랫폼에서 51/51 일치했다. 서경의 정렬된 모서리도 12/12 일치했다. 두 모서리를 역순으로 주면 공식 SDK가 정렬하고 Dart는 입력 순서를 유지했다. 원문이 이런 입력을 보장하는지는 미확정이다. [입력 좌표·플랫폼별 결과](../checkpoints/2026-11-19/live-bounds-contains-center.json.gz) |
| 공개 Dart 선언 | 0.1.1 공개 문서 색인의 331개와 배포 아카이브의 선언을 모두 대응시켰다. 별도 열거형 값 21개도 찾았다. [선언 대조](../checkpoints/2026-11-19/current-dart-declarations.json) |
| 실사용 시나리오 | 동일 빌드 입력으로 웹·Android·iOS에서 각각 13/13이 통과했다. iOS에서 길게 누른 뒤 16ms 만에 입력한 드래그는 별도 제한으로 남았다. [실행 근거](../checkpoints/2026-11-19/physical-scenarios.json.gz) |
| 완료 조건 | 감사와 독립 재검사가 모두 종료 코드 1을 반환했다. 산출물 무결성 검사는 종료 코드 0이었다. 추출 이슈, 대응 및 플랫폼별 검증 누락, 관찰된 동작 차이, 이전 기준본과의 차이 검토가 남았다. |

[계약 후보 전체와 출처](inventory.json.gz)는 gzip 압축 JSON이다. 후보마다 원본 위치, Dart 선언 후보, 추출기가 제안한 검토 차원을 담았다. 플랫폼별 판정은 실제 공식 SDK와 Flutter의 관찰값을 해당 차원에 연결한 후에 갱신한다. [0.1.1 배포본, 실사용 시나리오와 개별 관찰 기록](../checkpoints/2026-11-19/README.md)

[계약별 플랫폼 실측 색인](contract-observations.json.gz)은 원본 후보 ID와 문서·소스 위치, 공개 Dart 선언, 플랫폼별 관찰 기록을 연결한다. 현재 66개 세부 동작의 플랫폼별 기록은 실측 190건, 미측정 8건이다. 여기에 카메라 중심·기울기·방향 변경과 줌 조작 6개를 세 플랫폼에서 같은 조건으로 확인한 18건이 포함된다. [카메라 입력과 통과 조건](../checkpoints/2026-11-19/released-camera-control-predicates.json.gz) 그중 15개는 수정 커밋 `a8cf96f`의 실측이며 이전 결함의 관찰 기록도 함께 보존했다. 각 기록에는 측정 자료의 SHA-256과 원문 값을 읽을 JSON 포인터가 있다. 표본의 일치·차이와 미측정 플랫폼을 구별하며, 현재 CI의 완료 판정에는 별도로 반영해야 한다.

원문 아카이브는 이 Mac의 `~/Library/Application Support/tmap_flutter_sdk/sdk-audit/baselines/` 아래 내용 식별자 디렉터리에 보관했다. 재검증할 아카이브의 이름은 `sources.archive.gz`이며 길이와 SHA-256은 검사 상태 파일에 기록했다.

지도 표시 한 그룹은 별도 실행에서 세 플랫폼 모두 같은 SDK 코어와 인증 스크립트를 읽고 통과했다. 웹·Android·iOS의 실행별 측정 범위는 [웹 기록](../checkpoints/2026-11-19/flutter-web-sdk-receipt.json)과 [모바일 기록](../checkpoints/2026-11-19/flutter-mobile-sdk-receipt.json)에 있다.

같은 b010 소스의 좌표 모델과 역지오코딩은 세 플랫폼에서 각각 11가지 입력·동작 조합을 직접 비교했다. 네 좌표값과 정상 주소는 일치했고 문자열 표현과 Point 메서드 지원에는 차이가 있었다. 좌표 범위를 벗어난 요청에는 공식 SDK가 오류 콜백을 호출했고 Flutter Future는 null로 완료됐다. [비교표와 원본 관찰값](../checkpoints/2026-11-19/paired-runtime/README.md)

모바일 실패 원인도 같은 빌드에서 좁혔다. iOS의 실제 750ms 누르기는 기본 설정에서 SDK와 Dart 콜백 모두 0회였다. 같은 지도에서 기존 설정을 유지하고 공개 `map.setInteractive`로 `longTap`만 켜자 같은 입력에서 두 콜백이 각각 1회 발생했다. 두 번 탭은 Flutter에서 두 접촉을 받았지만 WKWebView의 지도 캔버스에서는 한 접촉만 받았다. Android 보조 기기에서는 인라인 HTML을 불러온 직후 첫 JavaScript 조회가 75초 동안 반환하지 않은 실패를 두 번 재현했다. 같은 컨트롤러에서 독립적으로 다시 읽으면 113ms 안에 이미 표시된 요소를 찾았다. 원래 Android 통합 실행 로그에는 이 구간의 시각이 없어 동일 원인이라고 단정할 수 없다. [iOS 입력 전달](../checkpoints/2026-11-19/ios-gesture-delivery.json.gz) · [iOS 설정 대조 실험](../checkpoints/2026-11-19/ios-long-press-control.json.gz) · [Android 조회 재현](../checkpoints/2026-11-19/android-inline-navigation.json.gz)

공식 문서 전체에서 확인한 클래스 21개와 멤버 앵커 146개는 감사 행에 연결됐다. TData 메서드 12개의 객체 인수 20개는 자식 표기 89건이 개별 행으로 남았지만 부모 관계가 빠졌다. 역지오코딩 문서 표와 공식 JSON 예제 양쪽에서 확인한 응답 경로 34개도 독립 계약으로 연결되지 않았다. [앵커·원문 행·누락 항목 대조](../checkpoints/2026-11-19/public-doc-crosscheck.json.gz)

## 현재 검증 브랜치에서 재실행

저장소 루트에서 `python3 tool/sdk_audit/validate_observations.py`를 실행하면 체크인된 관찰 인덱스와 후보·공개 선언·근거 파일의 연결을 읽기 전용으로 검사한다. CI도 인증이나 SDK 설정 전에 이 명령과 검사기 회귀 테스트를 실행한다. 해시, 후보 원문 위치, 선언 ID, 아카이브 멤버와 JSON 포인터를 확인하며, `testedProductCommit`이 있는 관찰은 각 측정 플랫폼의 연결된 `/commit`, `/testedCommit` 또는 `/candidate/revision` 영수증과 비교한다. 이전 관찰에는 새 커밋을 소급 적용하지 않는다. 이 검사는 근거의 연결과 최소 요건을 확인할 뿐 관찰의 의미를 판정하거나 상위 후보를 완료 처리하지 않는다. 새 측정 상태나 다른 영수증 리비전 경로를 추가할 때는 검사기도 함께 갱신해야 한다.

현재 브랜치의 CI는 이전 수집본에서 고정한 의미 서명을 감사와 재검사에 모두 전달한다. 의존성과 원문 캐시를 준비한 뒤 아래 세 명령을 실행할 수 있다.

문서의 TData 표제 두 건과 자동완성 V2 메뉴 앵커는 원문과 SDK 근거가 모두 일치하는 실행에서만 보고서의 `CONFIRMED_UPSTREAM_INCONSISTENCY`로 구분한다. 표제의 원래 철자와 진단은 보존하며 메뉴의 실제 목적지는 미확정이다. 이 판정은 Flutter 구현이나 동등성의 증명이 아니다. 누락·변경된 문서, SDK 또는 인증 런타임은 판정을 막는다. 최초 원문 위치는 [문서 오류 근거](../checkpoints/2026-11-19/official-doc-errors-source-spans.json.gz)에 보관한다.

```sh
snapshot=tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json
prior=tool/sdk_audit/baselines/previous-surface.json.gz
out_dir="$(mktemp -d)"
node tool/sdk_audit/cli.mjs audit --snapshot "$snapshot" --against "$prior" --key-file "$HOME/.config/tmap_flutter_sdk/test-app-key.json" --out "$out_dir"
node tool/sdk_audit/cli.mjs check --integrity-only --snapshot "$snapshot" --against "$prior" --out "$out_dir"
node tool/sdk_audit/cli.mjs check --snapshot "$snapshot" --against "$prior" --out "$out_dir"
```

[현재 CI 구성](../../../.github/workflows/sdk-audit.yml) · [좌표 변환표 실측](../checkpoints/2026-11-19/projection-initialization.json.gz) · [TData 60개 문서 경로와 실제 반환](../checkpoints/2026-11-19/reverse-geocode-live-fields.json.gz) · [클러스터 클릭과 도형 재부착](../checkpoints/2026-11-19/cluster-shape-pair.json.gz)

## 이전 체크포인트 재실행

로컬 브랜치 `codex/sdk-audit-reproduction`에는 이 감사를 재현한 도구와 당시의 브리지 소스가 있다. 이 브랜치에 포함한 177개 도구·입력 파일로 독립 체크아웃에서 원래 구성과 같은 3,854개 후보와 204개 이슈를 얻었다. 이 시점 브리지에는 검증 중인 컨트롤 변경이 포함돼 있어 b010 플랫폼 실행과 소스 지문이 다르다. 현재 목표의 최종 구현과 검증은 `codex/sdk-verification`에서 이어간다.

재현 브랜치의 별도 체크아웃에서 Node 22 이상, stable Flutter의 Dart, Chrome을 사용해 다음과 같이 실행한다. 이 Mac에 저장한 원문 아카이브를 사용하며, 테스트용 TMAP 키는 인증된 런타임 감사에서 읽는다.

```sh
npm ci --prefix tool/sdk_audit --ignore-scripts
dart pub get --directory tool/sdk_audit/dart --enforce-lockfile
snapshot=tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json
archive="$HOME/Library/Application Support/tmap_flutter_sdk/sdk-audit/baselines/46fa62a7bb271dd3887572278705a131a7fabf3d845728f306b4c539ac72811b/sources.archive.gz"
out_dir="$(mktemp -d)"
node tool/sdk_audit/cli.mjs restore --snapshot "$snapshot" --archive "$archive"
node tool/sdk_audit/cli.mjs audit --snapshot "$snapshot" --out "$out_dir" --dart "$(command -v dart)" --key-file "$HOME/.config/tmap_flutter_sdk/test-app-key.json"
node tool/sdk_audit/cli.mjs check --snapshot "$snapshot" --out "$out_dir" --dart "$(command -v dart)"
```

이 기준본에서 복원 검사는 성공하고 감사와 재검사는 각각 종료 코드 1을 반환했다. 최종 플랫폼별 계약 증거를 연결하기 전의 재현용 구성이다.

## CI 복원과 플랫폼 빌드 입력 검증

현재 통합 워크플로는 고정 기준본과 인증 파일을 명시한다. 같은 복원 코드로 빈 캐시의 온라인 복원이 성공했고, 새 macOS 체크아웃에서는 원문 archive 복원과 단위 테스트 35개가 통과했다. 기본 워크플로는 온라인 복원을 사용한다. 로컬 archive를 쓰려면 CLI의 `--archive` 인자가 필요하다. 이번에는 GitHub 호스팅 작업을 실행하지 않았다. [코드 지문·복원 입력별 결과·엄격 검사](../checkpoints/2026-11-19/clean-clone-ci-inputs-and-acquisition.json.gz)

초기 GitHub Actions 워크플로 후보의 복원 명령을 당시 독립 체크아웃에서 Node 22로 실행했다. 기본 명령은 성공했지만 이전 기준본 80건을 복원했다. 현재 기준본을 명시하고 빈 캐시에서 실행하면 인증 부트스트랩에서 HTTP 401이 발생했다. 원문 아카이브를 지정하면 현재 기준본 158건을 모두 검증했다. 자격 증명 파일을 명시해도 현 복원기는 부트스트랩을 복구하지 못했고, 공식 예제에서 생성되는 워커 하나만 캐시에서 제거해도 복원이 실패했다. [명령별 종료 코드·기준본 ID·워크플로 소스 지문](../checkpoints/2026-11-19/ci-restore-preflight.json)

기존 b010 소스 지문은 Dart·JS·시나리오와 설정 71개를 포함한다. 별도로 세 복사본에서 예제 앱 진입점·네이티브 프로젝트·입력 드라이버 파일 67개를 대조했다. iOS에서 5개 파일이 달랐고, Flutter 3.50.0 stable로 깨끗한 프로젝트의 iOS 빌드 설정을 준비하면 5개 모두 같은 바이트로 재현됐다. 두 번째 설정에서는 67개 모두 그대로였다. 이후 실행에는 공통 소스와 플랫폼별로 실제 빌드한 호스트 파일의 지문을 함께 남긴다. [대상 파일·지문·설정 재현 결과](../checkpoints/2026-11-19/native-build-inputs.json)

이전 기준본과의 차이를 검사하는 절차도 15가지 조건에서 확인했다. 문서에 있는 마커 옵션을 하나 뺀 비교에서는 변경 한 건이 출력됐지만 명령은 성공으로 종료했다. 반대로 출처가 나열된 순서만 바꿔도 변경 한 건으로 집계했다. 변경 보고서와 그 해시 목록 항목을 함께 제거한 경우에는 재검사가 누락을 검출하지 못했다. 실제 두 수집본에서 공통 입력 80개의 바이트는 전부 같았다. 수집 범위 차이로 나온 행 수만으로 공식 SDK의 동작 변경 여부를 판정할 수 없다. [실제 기준본 대조와 검사기 대조군](../checkpoints/2026-11-19/semantic-drift-matrix.json)
