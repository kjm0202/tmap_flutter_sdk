/// TMAP API 인증 정보를 관리하는 싱글톤 저장소입니다.
class AuthRepository {
  static final AuthRepository _instance = AuthRepository._internal();

  /// 발급받은 TMAP JavaScript AppKey
  late String appKey;

  /// 커스텀 Base URL (기본값: https://apis.openapi.sk.com)
  String baseUrl = 'https://apis.openapi.sk.com';

  AuthRepository._internal();

  /// 싱글톤 인스턴스 반환
  static AuthRepository get instance => _instance;

  /// TMAP 인증 정보 초기화
  ///
  /// [appKey]는 필수입니다.
  /// [baseUrl]은 선택사항입니다.
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
