/// A singleton repository for TMAP API authentication settings.
class AuthRepository {
  static final AuthRepository _instance = AuthRepository._internal();

  /// Issued TMAP JavaScript AppKey.
  late String appKey;

  /// Custom API base URL (default: https://apis.openapi.sk.com).
  String baseUrl = 'https://apis.openapi.sk.com';

  AuthRepository._internal();

  /// Shared singleton instance.
  static AuthRepository get instance => _instance;

  /// Initializes the singleton with TMAP authentication settings.
  ///
  /// [appKey] is required; [baseUrl] is optional and leaves the previous
  /// base URL unchanged when omitted.
  factory AuthRepository.initialize({
    required String appKey,
    String? baseUrl,
  }) {
    _instance.appKey = appKey;
    if (baseUrl != null) {
      _instance.baseUrl = baseUrl;
    }
    return _instance;
  }
}
