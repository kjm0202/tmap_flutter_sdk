import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'web_view.dart' if (dart.library.js_interop) 'browser.dart';
import 'native_input_stub.dart' if (dart.library.io) 'native_input.dart';

Future<dynamic> pairRead(TMapController c, String expr) async {
  final result = await runJs(c, expr);
  if (result is String) {
    try {
      return jsonDecode(result);
    } catch (_) {
      return result;
    }
  }
  return result;
}

Future<void> tapPair(TMapController c, double x, double y) async {
  if (useNativeInput) {
    final view = ui.PlatformDispatcher.instance.implicitView ??
        ui.PlatformDispatcher.instance.views.first;
    final devicePixelRatio = view.devicePixelRatio;

    final double scale = (defaultTargetPlatform == TargetPlatform.android)
        ? devicePixelRatio
        : 1.0;
    final centerX = x * scale;
    final centerY = y * scale;

    await driveNativeInput('tap', centerX, centerY);
  } else if (kIsWeb) {
    final gestureId = DateTime.now().microsecondsSinceEpoch;
    final jsCode = '''(function() {
        window.__tmapTrustedGesture = {
          id: $gestureId,
          action: 'tap',
          x: $x,
          y: $y,
          done: false
        };
        return true;
      })()''';
    if (!await checkJs(c, jsCode)) {
      throw StateError('Web tap setup failed');
    }

    const maxAttempts = 50;
    const pollInterval = Duration(milliseconds: 150);
    bool done = false;
    for (var i = 0; i < maxAttempts; i++) {
      if (await checkJs(c,
          'window.__tmapTrustedGesture && window.__tmapTrustedGesture.id === $gestureId && window.__tmapTrustedGesture.done === true')) {
        done = true;
        break;
      }
      await Future<void>.delayed(pollInterval);
    }

    if (!done) {
      throw StateError('Timed out waiting for web tap completion');
    }

    if (await checkJs(c,
        'window.__tmapTrustedGesture.id === $gestureId && window.__tmapTrustedGesture.error')) {
      throw StateError("Web input host reported a gesture error: tap");
    }
  } else {
    throw StateError("Unsupported platform");
  }
}
