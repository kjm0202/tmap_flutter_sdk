import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Install around the bridge entry point, before any TDataService call. The
/// SDK's static client is lazy and retains the first client it constructs.
Future<void> runWithPlaceCaptureClient(Future<void> Function() body) {
  final parentZone = Zone.current;
  return http.runWithClient(
    body,
    () => _CaptureClient(parentZone.run(http.Client.new)),
  );
}

Map<String, dynamic>? _captured;
bool _armed = false;

void armPlaceResponseCapture() {
  _captured = null;
  _armed = true;
}

Map<String, dynamic> takePlaceResponseCapture() {
  _armed = false;
  final response = _captured;
  _captured = null;
  if (response == null) {
    throw StateError(
      'POI response was not captured. Install '
      'runWithPlaceCaptureClient around the bridge entry point before any '
      'TDataService call.',
    );
  }
  return response;
}

void disarmPlaceResponseCapture() {
  _armed = false;
  _captured = null;
}

class _CaptureClient extends http.BaseClient {
  _CaptureClient(this._delegate);
  final http.Client _delegate;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await _delegate.send(request);
    if (!_armed ||
        request.url.host != 'apis.openapi.sk.com' ||
        request.url.path != '/tmap/pois') {
      return response;
    }
    _armed = false;
    final bytes = await response.stream.toBytes();
    _captured = {
      'status': response.statusCode,
      'query': {
        for (final key in const [
          'searchKeyword',
          'page',
          'count',
          'centerLat',
          'centerLon',
          'reqCoordType',
          'resCoordType'
        ])
          key: request.url.queryParameters[key],
      },
      'body': utf8.decode(bytes),
    };
    return http.StreamedResponse(
      Stream.value(bytes),
      response.statusCode,
      contentLength: bytes.length,
      request: response.request,
      headers: response.headers,
      isRedirect: response.isRedirect,
      persistentConnection: response.persistentConnection,
      reasonPhrase: response.reasonPhrase,
    );
  }

  @override
  void close() => _delegate.close();
}
