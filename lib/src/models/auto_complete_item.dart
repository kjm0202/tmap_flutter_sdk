/// TMAP 키워드 자동완성 검색 결과 항목 모델입니다.
class AutoCompleteItem {
  /// 키워드 이름
  final String keyword;

  const AutoCompleteItem({required this.keyword});

  factory AutoCompleteItem.fromJson(dynamic json) {
    if (json is String) {
      return AutoCompleteItem(keyword: json);
    } else if (json is Map<String, dynamic>) {
      return AutoCompleteItem(
        keyword: json['keyword'] as String? ?? json['name'] as String? ?? '',
      );
    }
    return const AutoCompleteItem(keyword: '');
  }
}
