import '../models/lat_lng.dart';
import '../models/point.dart';

/// TMAP HTML 기반 커스텀 오버레이 클래스입니다.
class CustomOverlay {
  /// 오버레이 고유 ID
  final String customOverlayId;

  /// 표출 위경도 좌표
  final LatLng position;

  /// HTML 컨텐츠 문자열
  final String content;

  /// 오프셋 좌표
  final Point? offset;

  /// z-index 순서
  final int zIndex;

  const CustomOverlay({
    required this.customOverlayId,
    required this.position,
    required this.content,
    this.offset,
    this.zIndex = 100,
  });

  Map<String, dynamic> toJson() {
    return {
      'customOverlayId': customOverlayId,
      'position': position.toJson(),
      'content': content,
      if (offset != null) 'offset': offset?.toJson(),
      'zIndex': zIndex,
    };
  }
}
