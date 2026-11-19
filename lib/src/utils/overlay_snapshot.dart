import 'dart:convert';

/// Keeps serialized copies so in-place list edits and fresh equivalent models
/// can both be compared without replacing unchanged map objects.
class OverlaySnapshot {
  final Map<String, Map<String, String>> _groups = {};

  void clear() {
    _groups.clear();
  }

  void sync<T>(
    String group,
    Iterable<T>? items, {
    required String Function(T) idOf,
    required Object? Function(T) jsonOf,
    required void Function(T) add,
    required void Function(String) remove,
  }) {
    final previous = _groups[group] ?? const <String, String>{};
    final next = <String, String>{};
    final values = <String, T>{};
    for (final item in items ?? <T>[]) {
      final id = idOf(item);
      next[id] = jsonEncode(jsonOf(item));
      values[id] = item;
    }
    for (final id in previous.keys) {
      if (!next.containsKey(id)) remove(id);
    }
    for (final entry in values.entries) {
      if (previous[entry.key] != next[entry.key]) add(entry.value);
    }
    _groups[group] = next;
  }
}
