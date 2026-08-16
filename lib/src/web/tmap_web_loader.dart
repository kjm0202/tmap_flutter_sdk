import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'package:web/web.dart' as web;

/// TMAP JavaScript SDK를 웹 브라우저의 `head`에 동적으로 로드하는 로더
class TMapWebLoader {
  static Completer<void>? _loadCompleter;

  /// TMAP Vector Map v3 JS SDK 로드
  static Future<void> loadScript(String appKey) async {
    if (_loadCompleter != null) {
      return _loadCompleter!.future;
    }

    _loadCompleter = Completer<void>();

    // 이미 Tmapv3가 로드되어 있는지 확인
    final hasTmap = (web.window as JSObject).hasProperty('Tmapv3'.toJS).toDart;
    if (hasTmap) {
      _loadCompleter!.complete();
      return _loadCompleter!.future;
    }

    // 기존에 추가된 script 태그가 있는지 확인
    final existingScript =
        web.document.querySelector('script[src*="vectorjs"]');
    if (existingScript != null) {
      _waitForTmap();
      return _loadCompleter!.future;
    }

    // 새 script 엘리먼트 생성 및 추가
    final script =
        web.document.createElement('script') as web.HTMLScriptElement;
    script.type = 'text/javascript';
    script.src =
        'https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=$appKey';

    script.onLoad.listen((_) {
      _waitForTmap();
    });

    script.onError.listen((_) {
      if (!_loadCompleter!.isCompleted) {
        _loadCompleter!
            .completeError('Failed to load TMAP Vector Map JavaScript SDK.');
      }
    });

    web.document.head?.append(script);

    return _loadCompleter!.future;
  }

  static void _waitForTmap() {
    Timer.periodic(const Duration(milliseconds: 50), (timer) {
      final isReady =
          (web.window as JSObject).hasProperty('Tmapv3'.toJS).toDart;
      if (isReady) {
        timer.cancel();
        if (!_loadCompleter!.isCompleted) {
          _loadCompleter!.complete();
        }
      }
    });
  }
}
