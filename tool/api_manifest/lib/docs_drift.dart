/// Extracts the explicitly listed API surface from WebDocs.html. The official
/// page is an HTML fragment: h2 names classes, h3 names sections, h4[id] names
/// members, and constructor Parameters lists name options.
Set<String> extractDocumentedIds(String html) {
  final content = html.replaceAll(RegExp(r'<!--[\s\S]*?-->'), '');
  final headings = RegExp(
    r'<h([234])\b([^>]*)>([\s\S]*?)</h\1>',
    caseSensitive: false,
  ).allMatches(content).toList();
  final ids = <String>{};
  String? owner;
  String? section;
  for (var i = 0; i < headings.length; i++) {
    final heading = headings[i];
    final level = heading.group(1);
    final name = _plain(heading.group(3)!);
    final following = i + 1 < headings.length
        ? content.substring(heading.end, headings[i + 1].start)
        : content.substring(heading.end);
    if (level == '2') {
      owner = RegExp(r'^Tmapv3(?:\.[A-Za-z_$][\w$]*)+$').hasMatch(name)
          ? _canonicalOwner(name)
          : null;
      section = null;
      if (owner != null) ids.add(owner);
    } else if (level == '3') {
      section = name;
      if (owner == null) continue;
      if (name == 'Constructor') ids.add('$owner#constructor');
      if (name == 'Properties') {
        for (final field in _listFields(following)) {
          ids.add('$owner#$field');
        }
        // Tdata lists events and EVENT_TYPE in a table.
        for (final row in RegExp(
          r'<tr\b[^>]*>([\s\S]*?)</tr>',
          caseSensitive: false,
        ).allMatches(following)) {
          final cells = RegExp(
            r'<td\b[^>]*>([\s\S]*?)</td>',
            caseSensitive: false,
          ).allMatches(row.group(1)!).toList();
          if (cells.isEmpty) continue;
          final property = _plain(cells.first.group(1)!);
          if (RegExp(r'^[a-zA-Z_$][\w$]*$').hasMatch(property)) {
            ids.add('$owner#$property');
          }
          for (final event in RegExp(r"""["']([A-Za-z_][\w]*)["']""")
              .allMatches(row.group(1)!)) {
            ids.add('$owner@${event.group(1)}');
          }
        }
      }
      if (name == 'Events' || name == 'Event') {
        for (final event in _listFields(following)) {
          ids.add('$owner@$event');
        }
      }
    } else if (level == '4' && owner != null) {
      final attributes = heading.group(2)!;
      final anchored = RegExp(r"""(?:^|\s)id\s*=\s*["']([^"']+)["']""")
          .firstMatch(attributes);
      if (anchored != null &&
          (section == 'Methods' || section == 'Properties') &&
          RegExp(r'^[A-Za-z_$][\w$]*$').hasMatch(name)) {
        ids.add('$owner#$name');
      }
      if (section == 'Constructor' && name == 'Parameters') {
        for (final option in _listFields(following)) {
          ids.add('$owner.options.$option');
        }
      }
    }
  }

  // On the published page Marker.on documents the event names in its
  // eventName parameter instead of an Events heading.
  final classHeadings = headings.where((m) => m.group(1) == '2').toList();
  for (var i = 0; i < classHeadings.length; i++) {
    final heading = classHeadings[i];
    final className = _canonicalOwner(_plain(heading.group(3)!));
    if (!RegExp(r'^Tmapv3(?:\.[A-Za-z_$][\w$]*)+$').hasMatch(className))
      continue;
    final end = i + 1 == classHeadings.length
        ? content.length
        : classHeadings[i + 1].start;
    final block = content.substring(heading.end, end);
    final items = RegExp(r'<li\b[^>]*>([\s\S]*?)</li>', caseSensitive: false);
    for (final item in items.allMatches(block)) {
      final description = _plain(item.group(1)!);
      if (!RegExp(r'\beventName\b').hasMatch(description)) continue;
      for (final event in RegExp(r"""["']([a-zA-Z_][\w:-]*)["']""")
          .allMatches(description)) {
        ids.add('$className@${event.group(1)}');
      }
    }
  }

  // A #webservice/docs/... link is a documentation route, not a REST
  // endpoint. Do not invent rest:<endpoint> IDs from navigation links.
  return ids;
}

Iterable<String> _listFields(String html) sync* {
  final items = RegExp(r'<li\b[^>]*>([\s\S]*?)</li>', caseSensitive: false);
  final firstField = RegExp(r'^[-–]?\s*([a-zA-Z_$][\w$]*)\s*(?:\{|:|\s+\{)');
  for (final item in items.allMatches(html)) {
    final text = _plain(item.group(1)!);
    final match = firstField.firstMatch(text);
    if (match != null) yield match.group(1)!;
  }
}

String _plain(String html) => html
    .replaceAll(RegExp(r'<[^>]*>'), ' ')
    .replaceAll(RegExp(r'&nbsp;?', caseSensitive: false), ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

String _canonicalOwner(String name) {
  // The heading says Tmapv3.Tdata, but its constructor/example calls and
  // public JS class are Tmapv3.TData.
  return name == 'Tmapv3.Tdata' ? 'Tmapv3.TData' : name;
}

class DriftResult {
  DriftResult(Set<String> documented, Set<String> manifest)
      : documented = documented,
        manifest = manifest,
        missingFromManifest =
            (documented.difference(manifest).toList()..sort()),
        absentFromDocs = (manifest.difference(documented).toList()..sort());

  final Set<String> documented;
  final Set<String> manifest;
  final List<String> missingFromManifest;
  final List<String> absentFromDocs;

  /// Manifest-only rows may be documented on a separate, per-row source URL.
  bool get hasDrift => missingFromManifest.isNotEmpty;
}
