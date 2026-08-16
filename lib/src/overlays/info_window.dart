import '../models/lat_lng.dart';
import '../models/point.dart';

/// TMAP 지도 위에 표시되는 HTML 정보창(InfoWindow) 클래스입니다.
class InfoWindow {
  /// 정보창 고유 ID
  final String infoWindowId;

  /// 정보창 표출 좌표
  final LatLng position;

  /// 정보창 내용 (HTML 문자열)
  final String content;

  /// 정보창 모양 타입 (1: 말풍선형, 2: 사각형)
  final int type;

  /// 테두리 CSS 스타일 (type이 2일 때 적용, 예: '1px solid #ff0000')
  final String? border;

  /// 오프셋 좌표
  final Point? offset;

  /// 앵커 위치 ('top', 'bottom', 'left', 'right', 'auto-top' 등)
  final String anchor;

  /// 표시 여부
  final bool visible;

  const InfoWindow({
    required this.infoWindowId,
    required this.position,
    required this.content,
    this.type = 2,
    this.border,
    this.offset,
    this.anchor = 'bottom',
    this.visible = true,
  });

  Map<String, dynamic> toJson() {
    return {
      'infoWindowId': infoWindowId,
      'position': position.toJson(),
      'content': content,
      'type': type,
      if (border != null) 'border': border,
      if (offset != null) 'offset': offset?.toJson(),
      'anchor': anchor,
      'visible': visible,
    };
  }
}
