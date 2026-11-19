import 'dart:convert';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';

Future<dynamic> runJs(TMapController controller, String expression) async {
  final result = await controller.webViewController
      .runJavaScriptReturningResult('JSON.stringify($expression)');
  return jsonDecode(result.toString());
}

Future<bool> checkJs(TMapController controller, String expression) async {
  final result = await controller.webViewController
      .runJavaScriptReturningResult('Boolean($expression)');
  return result == true || result == 1 || result == 'true';
}

