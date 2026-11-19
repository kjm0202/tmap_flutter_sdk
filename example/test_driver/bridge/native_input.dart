import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// True only on iOS or Android when TMAP_GESTURE_PORT environment variable is set > 0.
bool get useNativeInput =>
    (Platform.isAndroid || Platform.isIOS) &&
    const int.fromEnvironment('TMAP_GESTURE_PORT') > 0;

/// Drives a native touch input gesture on the iOS Simulator or Android Emulator via loopback HTTP.
///
/// Sends POST request to http://127.0.0.1:PORT/input with [action], [x], [y],
/// and optional [endX], [endY].
Future<void> driveNativeInput(
  String action,
  double x,
  double y, {
  double? endX,
  double? endY,
}) async {
  if (!useNativeInput) return;
  const port = int.fromEnvironment('TMAP_GESTURE_PORT');
  final client = HttpClient();
  client.connectionTimeout = const Duration(seconds: 10);
  try {
    final uri = Uri.parse('http://127.0.0.1:$port/input');
    final request = await client.postUrl(uri);
    request.headers.contentType = ContentType.json;

    final payload = <String, dynamic>{
      'action': action,
      'x': x,
      'y': y,
    };
    if (endX != null) payload['endX'] = endX;
    if (endY != null) payload['endY'] = endY;

    final bytes = utf8.encode(jsonEncode(payload));
    request.contentLength = bytes.length;
    request.add(bytes);

    final response = await request.close().timeout(
      const Duration(seconds: 30),
      onTimeout: () => throw TimeoutException(
        'Timed out waiting for native input driver response ($action)',
      ),
    );

    final body = await response.transform(utf8.decoder).join();
    if (response.statusCode != 200) {
      throw StateError(
        'Native touch input driver failed (HTTP ${response.statusCode}): $body',
      );
    }
  } finally {
    client.close();
  }
}

