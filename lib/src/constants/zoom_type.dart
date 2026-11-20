/// Phases of a map zoom change.
enum ZoomType {
  /// A zoom change has started (SDK `ZoomStart`).
  start,

  /// A zoom change has ended (SDK `ZoomEnd`, or a standalone `Zoom`).
  end,
}
