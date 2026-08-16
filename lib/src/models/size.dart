/// 2D 크기(너비, 높이)를 나타내는 클래스입니다.
class Size {
  final double width;
  final double height;

  const Size(this.width, this.height);

  factory Size.fromJson(Map<String, dynamic> json) {
    return Size(
      (json['width'] as num? ?? json['w'] as num? ?? 0.0).toDouble(),
      (json['height'] as num? ?? json['h'] as num? ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {'width': width, 'height': height};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Size &&
          runtimeType == other.runtimeType &&
          width == other.width &&
          height == other.height;

  @override
  int get hashCode => width.hashCode ^ height.hashCode;

  @override
  String toString() => 'Size($width, $height)';
}
