import 'package:flutter/services.dart';

/// Loads named bridge scripts from the package asset bundle.
///
/// Joins the scripts in [names] order with newline separators.
Future<String> loadBridgeAssets(List<String> names) async {
  const directory = 'packages/tmap_flutter_sdk/assets/bridge';
  final sources = await Future.wait(
    names.map((name) => rootBundle.loadString('$directory/$name')),
  );
  return sources.join('\n');
}
