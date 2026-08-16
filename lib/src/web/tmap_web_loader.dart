import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'package:flutter/foundation.dart';
import 'package:web/web.dart' as web;

/// TMAP JavaScript SDK를 웹 브라우저의 `head`에 동적으로 로드하는 로더
class TMapWebLoader {
  static Completer<void>? _loadCompleter;

  /// TMAP Vector Map v3 JS SDK 로드
  static Future<void> loadScript(String appKey) async {
    final jsWindow = web.window as JSObject;

    // 이미 Tmapv3.Map이 로드되어 있는지 확인
    if (jsWindow.hasProperty('Tmapv3'.toJS).toDart) {
      final tmapObj = jsWindow.getProperty('Tmapv3'.toJS);
      if (tmapObj != null &&
          tmapObj is JSObject &&
          tmapObj.hasProperty('Map'.toJS).toDart) {
        debugPrint('[TMapWebLoader] Tmapv3.Map already loaded and ready.');
        return;
      }
    }

    if (_loadCompleter != null && !_loadCompleter!.isCompleted) {
      return _loadCompleter!.future;
    }

    _loadCompleter = Completer<void>();

    debugPrint('[TMapWebLoader] Loading TMAP SDK for appKey: $appKey');

    // 1. Tmapvector 전역 객체 설정 (SK TMAP SDK 요구사항)
    final domain = 'https://toptmaptile1.tmap.co.kr/scriptSDKV3/';
    final tmapVectorObj = JSObject();
    tmapVectorObj.setProperty('_getScriptLocation'.toJS, (() => domain.toJS).toJS);
    tmapVectorObj.setProperty('VERSION_NUMBER'.toJS, 1.0.toJS);
    jsWindow.setProperty('Tmapvector'.toJS, tmapVectorObj);

    // 2. vsm.css 스타일시트 추가
    if (web.document.querySelector('link[href*="vsm.css"]') == null) {
      final link = web.document.createElement('link') as web.HTMLLinkElement;
      link.rel = 'stylesheet';
      link.href = '${domain}vsm.css';
      web.document.head?.append(link);
    }

    // 3. vectorjs 인증 스크립트 로드
    final authScript =
        web.document.createElement('script') as web.HTMLScriptElement;
    authScript.type = 'text/javascript';
    authScript.src =
        'https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=$appKey';
    web.document.head?.append(authScript);

    // 4. tmapjs3.min.js 코어 엔진 스크립트 직접 로드 (document.write 차단 문제 해결)
    if (web.document.querySelector('script[src*="tmapjs3"]') == null) {
      final coreScript =
          web.document.createElement('script') as web.HTMLScriptElement;
      coreScript.type = 'text/javascript';
      coreScript.src = '${domain}tmapjs3.min.js?version=20231206';

      coreScript.onLoad.listen((_) {
        debugPrint('[TMapWebLoader] Core tmapjs3.min.js loaded successfully');
        _waitForTmap();
      });

      coreScript.onError.listen((e) {
        debugPrint('[TMapWebLoader] Core script load error: $e');
        _waitForTmap();
      });

      web.document.head?.append(coreScript);
    }

    _waitForTmap();

    return _loadCompleter!.future;
  }

  static void _waitForTmap() {
    debugPrint('[TMapWebLoader] _waitForTmap polling started...');
    var attempts = 0;
    Timer.periodic(const Duration(milliseconds: 100), (timer) {
      attempts++;
      final jsWindow = web.window as JSObject;
      final hasTmap = jsWindow.hasProperty('Tmapv3'.toJS).toDart;
      if (hasTmap) {
        final tmapObj = jsWindow.getProperty('Tmapv3'.toJS);
        if (tmapObj != null &&
            tmapObj is JSObject &&
            tmapObj.hasProperty('Map'.toJS).toDart) {
          timer.cancel();
          debugPrint(
              '[TMapWebLoader] Tmapv3.Map found and ready! (after $attempts polls)');
          if (_loadCompleter != null && !_loadCompleter!.isCompleted) {
            _loadCompleter!.complete();
          }
          return;
        }
      }

      if (attempts > 100) {
        timer.cancel();
        debugPrint('[TMapWebLoader] Timeout waiting for Tmapv3.Map after 10s');
        if (_loadCompleter != null && !_loadCompleter!.isCompleted) {
          _loadCompleter!.completeError('Timeout loading Tmapv3');
        }
      }
    });
  }
}
