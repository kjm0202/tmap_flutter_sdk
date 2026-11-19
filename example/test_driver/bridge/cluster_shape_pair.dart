import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:tmap_flutter_sdk/tmap_flutter_sdk.dart';
import 'cluster_click_pair.dart';
import 'shape_lifecycle_pair.dart';

void printJsonChunked(String stage, dynamic data) {
  final jsonString = jsonEncode(data);
  const chunkSize = 350;
  final totalChunks = (jsonString.length / chunkSize).ceil();

  if (jsonString.isEmpty) {
    debugPrintSynchronously('CLUSTER_SHAPE_CHUNK $stage 0/1 {}');
    return;
  }

  for (int i = 0; i < jsonString.length; i += chunkSize) {
    final chunkIndex = (i / chunkSize).toInt();
    final end =
        (i + chunkSize < jsonString.length) ? i + chunkSize : jsonString.length;
    final chunk = jsonString.substring(i, end);
    debugPrintSynchronously(
        'CLUSTER_SHAPE_CHUNK $stage $chunkIndex/$totalChunks $chunk');
  }
}

String sanitizeError(dynamic e, String appKey) {
  String msg = e.toString();
  msg = msg.replaceAll(appKey, '[key]');
  msg = msg.replaceAll(RegExp(r'https?://[^\s]+'), '[URL_REMOVED]');
  return 'Error: $msg';
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final key = const String.fromEnvironment('TMAP_APP_KEY');
  final filter = const String.fromEnvironment('PAIR_FILTER');

  if (key.isEmpty) {
    debugPrint('CLUSTER_SHAPE_FAIL: Missing TMAP_APP_KEY');
    return;
  }
  AuthRepository.initialize(appKey: key);

  try {
    if (filter != 'shapes') {
      final cluster = await runClusterPair();
      printJsonChunked('cluster', cluster);
    }

    if (filter != 'cluster') {
      final shapes = await runShapePair();
      printJsonChunked('shapes', shapes);
    }

    debugPrintSynchronously('CLUSTER_SHAPE_PASS');
  } catch (e) {
    debugPrintSynchronously('CLUSTER_SHAPE_FAIL: ${sanitizeError(e, key)}');
  }
}
