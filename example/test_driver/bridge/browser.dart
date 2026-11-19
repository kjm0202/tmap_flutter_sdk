import 'dart:js_interop';

import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

@JS('eval')
external JSBoolean _evaluate(JSString source);

Future<bool> checkJs(TMapController controller, String expression) async {
  return _evaluate('Boolean((function() {'
              'const map = Object.values(window.tmap_instances)[0]?.map;'
              'return ($expression); })())'
          .toJS)
      .toDart;
}
