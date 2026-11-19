import 'dart:js_interop';
import 'dart:convert';

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

@JS('eval')
external JSString _evaluate(JSString source);

@JS('eval')
external JSBoolean _evaluateBool(JSString source);

Future<dynamic> runJs(TMapController controller, String expression) async {
  final result = _evaluate('JSON.stringify((function() {'
              'const map = Object.values(window.tmap_instances)[0]?.map;'
              'return ($expression); })())'
          .toJS)
      .toDart;
  return jsonDecode(result);
}

Future<bool> checkJs(TMapController controller, String expression) async {
  return _evaluateBool('Boolean((function() {'
              'const map = Object.values(window.tmap_instances)[0]?.map;'
              'return ($expression); })())'
          .toJS)
      .toDart;
}

