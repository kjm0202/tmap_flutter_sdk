import '../models/point.dart';
import '../models/size.dart';

/// 마커 아이콘 설정 클래스
class MarkerIcon {
  /// 아이콘 이미지 URL 또는 로컬 웹 경로
  final String? iconUrl;

  /// 아이콘 크기 (너비, 높이)
  final Size? size;

  /// 아이콘 앵커 포인트 오프셋
  final Point? offset;

  /// HTML 기반 마커 렌더링을 위한 HTML 문자열 (iconUrl 대신 사용 가능)
  final String? iconHtml;

  const MarkerIcon({
    this.iconUrl,
    this.size,
    this.offset,
    this.iconHtml,
  });

  Map<String, dynamic> toJson() {
    return {
      if (iconUrl != null) 'iconUrl': iconUrl,
      if (size != null) 'size': size?.toJson(),
      if (offset != null) 'offset': offset?.toJson(),
      if (iconHtml != null) 'iconHtml': iconHtml,
    };
  }
}
