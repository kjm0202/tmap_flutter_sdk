import '../auth/auth_repository.dart';

/// TMAP Vector Map JS SDK를 포함하는 HTML 템플릿을 생성합니다.
String htmlWrapper(String script) {
  final appKey = AuthRepository.instance.appKey;
  return '''
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0" />
  <script type="text/javascript"
          src="https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=$appKey"></script>
  <style>
    * {
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
    }
    #map_div {
      width: 100vw;
      height: 100vh;
      position: absolute;
      top: 0;
      left: 0;
    }
    .custom-overlay-clickable {
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      touch-action: manipulation;
    }
  </style>
</head>
<body>
  <div id="map_div"></div>
  $script
</body>
</html>
''';
}
