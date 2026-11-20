/// 지도 줌 변경 이벤트 단계입니다.
enum ZoomType {
  /// SDK `ZoomStart` 이벤트가 발생한 단계입니다.
  start,

  /// SDK `ZoomEnd` 또는 단독 `Zoom` 이벤트가 발생한 단계입니다.
  end,
}
