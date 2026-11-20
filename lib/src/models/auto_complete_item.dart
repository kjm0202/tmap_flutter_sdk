/// A keyword suggestion from TMAP autocomplete search.
class AutoCompleteItem {
  /// Suggested keyword.
  final String keyword;

  /// Creates a keyword suggestion with [keyword].
  const AutoCompleteItem({required this.keyword});

  /// Parses a TMAP autocomplete suggestion string or keyword/name map.
  ///
  /// Returns an item with an empty [keyword] for unsupported input.
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
