import 'dart:io';

import 'package:yaml/yaml.dart';

const supportedKinds = {
  'class',
  'constructor',
  'option',
  'method',
  'property',
  'event',
  'rest',
};
const supportedDecisions = {'expose', 'adapt', 'exclude'};
const supportedStatuses = {'done', 'todo'};
const supportedPlatforms = {'web', 'android', 'ios'};

class ApiEntry {
  const ApiEntry({
    required this.id,
    required this.kind,
    required this.decision,
    required this.status,
    this.dartSymbol,
    this.reason,
    this.source,
  });

  final String id;
  final String kind;
  final String decision;
  final String status;
  final String? dartSymbol;
  final String? reason;
  final String? source;

  bool get excluded => decision == 'exclude';
  bool get done => !excluded && status == 'done';
  bool get todo => !excluded && status == 'todo';

  String get owner {
    if (id.startsWith('rest:')) return 'REST';
    final option = id.indexOf('.options.');
    if (option >= 0) return id.substring(0, option);
    final hash = id.indexOf('#');
    if (hash >= 0) return id.substring(0, hash);
    final event = id.indexOf('@');
    if (event >= 0) return id.substring(0, event);
    return id;
  }
}

class ValidationResult {
  const ValidationResult(this.entries, this.errors);

  final List<ApiEntry> entries;
  final List<String> errors;

  bool get isValid => errors.isEmpty;
}

String? _nonEmpty(dynamic value) =>
    value is String && value.trim().isNotEmpty ? value.trim() : null;

bool _validId(String id, String kind) {
  const classPart = r'[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+';
  const memberPart = r'[A-Za-z_$][\w$]*';
  final pattern = switch (kind) {
    'class' => '^$classPart\$',
    'constructor' => '^$classPart#constructor\$',
    'option' => '^$classPart\\.options\\.$memberPart\$',
    'method' || 'property' => '^$classPart#$memberPart\$',
    'event' => '^$classPart@$memberPart\$',
    'rest' => r'^rest:[^\s]+$',
    _ => r'(?!)',
  };
  return RegExp(pattern).hasMatch(id);
}

ValidationResult validateManifest(String yamlText, Directory repoRoot) {
  final errors = <String>[];
  final entries = <ApiEntry>[];
  dynamic document;
  try {
    document = loadYaml(yamlText);
  } catch (error) {
    return ValidationResult(entries, ['<manifest>: invalid YAML: $error']);
  }
  if (document is! Map) {
    return const ValidationResult([], ['<manifest>: expected a YAML map']);
  }

  final sdk = document['sdk'];
  if (sdk is! Map) {
    errors.add('<manifest>: sdk must be a map');
  } else {
    for (final field in ['docs_url', 'core_url', 'core_sha256']) {
      if (_nonEmpty(sdk[field]) == null) {
        errors.add('<manifest>: sdk.$field is required');
      }
    }
    final hash = _nonEmpty(sdk['core_sha256']);
    if (hash != null && !RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(hash)) {
      errors.add('<manifest>: sdk.core_sha256 must be a SHA-256 hex digest');
    }
  }

  final rows = document['entries'];
  if (rows is! List) {
    errors.add('<manifest>: entries must be a list');
    return ValidationResult(entries, errors);
  }
  final seen = <String>{};
  final symbols = DartSymbols.fromDirectory(Directory('${repoRoot.path}/lib'));
  for (var index = 0; index < rows.length; index++) {
    final raw = rows[index];
    final label = raw is Map
        ? (_nonEmpty(raw['id']) ?? '<entry $index>')
        : '<entry $index>';
    void error(String message) => errors.add('$label: $message');
    if (raw is! Map) {
      error('entry must be a map');
      continue;
    }
    final id = _nonEmpty(raw['id']);
    final kind = _nonEmpty(raw['kind']);
    final decision = _nonEmpty(raw['decision']);
    final status = _nonEmpty(raw['status']);
    final dartSymbol = _nonEmpty(raw['dart']);
    final reason = _nonEmpty(raw['reason']);
    final source = _nonEmpty(raw['source']);
    for (final field in ['id', 'kind', 'decision', 'status']) {
      if (_nonEmpty(raw[field]) == null) error('$field is required');
    }
    if (id != null && !seen.add(id)) error('duplicate id');
    if (kind != null && !supportedKinds.contains(kind)) {
      error('invalid kind "$kind"');
    }
    if (decision != null && !supportedDecisions.contains(decision)) {
      error('invalid decision "$decision"');
    }
    if (status != null && !supportedStatuses.contains(status)) {
      error('invalid status "$status"');
    }
    if (id != null && kind != null && !_validId(id, kind)) {
      error('id does not match kind "$kind"');
    }
    if ((decision == 'adapt' || decision == 'exclude') &&
        (reason == null || reason.contains('\n') || reason.contains('\r'))) {
      error('one-line reason required for $decision');
    }
    if (decision == 'exclude' && status != 'done') {
      error('excluded entries must have status done');
    }
    if (raw.containsKey('source')) {
      final uri = source == null ? null : Uri.tryParse(source);
      if (uri == null ||
          (uri.scheme != 'https' && uri.scheme != 'http') ||
          uri.host.isEmpty ||
          source!.contains(RegExp(r'\s'))) {
        error('source must be an absolute HTTP(S) URL with a host');
      }
    }

    final platforms = raw['platforms'];
    if (platforms != null) {
      if (platforms is! List ||
          platforms.isEmpty ||
          platforms
              .any((p) => p is! String || !supportedPlatforms.contains(p)) ||
          platforms.toSet().length != platforms.length) {
        error('platforms must be unique values from web, android, ios');
      }
    }

    final tests = raw['tests'];
    final needsEvidence =
        decision != null && decision != 'exclude' && status == 'done';
    if (needsEvidence && dartSymbol == null) error('dart is required for done');
    if (needsEvidence && (tests is! List || tests.isEmpty)) {
      error('tests must be a non-empty list for done');
    }
    if (dartSymbol != null && needsEvidence && !symbols.contains(dartSymbol)) {
      error('Dart symbol "$dartSymbol" is not declared in lib/');
    }
    if (tests != null) {
      if (tests is! List) {
        error('tests must be a list');
      } else {
        for (final ref in tests) {
          if (ref is! String) {
            error('test reference must be a string');
            continue;
          }
          final separator = ref.indexOf('::');
          if (separator <= 0 ||
              separator != ref.lastIndexOf('::') ||
              separator + 2 >= ref.length) {
            error('invalid test reference "$ref" (expected path::name)');
            continue;
          }
          final path = ref.substring(0, separator);
          final name = ref.substring(separator + 2);
          if (path.startsWith('/') ||
              path.contains('\\') ||
              path.split('/').any((p) => p == '.' || p == '..' || p.isEmpty)) {
            error('test reference "$ref" must use a repo-relative path');
            continue;
          }
          final file = File('${repoRoot.path}/$path');
          if (!file.existsSync()) {
            error('test file "$path" does not exist');
          } else {
            try {
              if (!file.readAsStringSync().contains(name)) {
                error('test file "$path" does not contain "$name"');
              }
            } on FileSystemException catch (failure) {
              error('cannot read test file "$path": $failure');
            }
          }
        }
      }
    }
    if (id != null && kind != null && decision != null && status != null) {
      entries.add(ApiEntry(
        id: id,
        kind: kind,
        decision: decision,
        status: status,
        dartSymbol: dartSymbol,
        reason: reason,
        source: source,
      ));
    }
  }
  return ValidationResult(entries, errors);
}

/// Lightweight, declaration-scoped check. Comments, strings and method bodies
/// are masked, so a symbol mentioned by another class does not count.
class DartSymbols {
  DartSymbols(this.types, this.classBodies, this.parents);

  final Set<String> types;
  final Map<String, List<String>> classBodies;
  final Map<String, Set<String>> parents;

  factory DartSymbols.fromDirectory(Directory lib) {
    final types = <String>{};
    final bodies = <String, List<String>>{};
    final parents = <String, Set<String>>{};
    if (!lib.existsSync()) return DartSymbols(types, bodies, parents);
    final files = lib
        .listSync(recursive: true, followLinks: false)
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'))
        .toList()
      ..sort((a, b) => a.path.compareTo(b.path));
    final declaration = RegExp(
      r'\b(?:class|mixin|enum|typedef|extension\s+type)\s+([A-Za-z_$][\w$]*)\b',
    );
    for (final file in files) {
      final code = _maskDart(file.readAsStringSync());
      for (final match in declaration.allMatches(code)) {
        final name = match.group(1)!;
        types.add(name);
        final open = code.indexOf('{', match.end);
        final semicolon = code.indexOf(';', match.end);
        if (open < 0 || (semicolon >= 0 && semicolon < open)) continue;
        final header = code.substring(match.end, open);
        final parent =
            RegExp(r'\bextends\s+([A-Za-z_]\w*)').firstMatch(header)?.group(1);
        if (parent != null) {
          parents.putIfAbsent(name, () => {}).add(parent);
        }
        var depth = 1;
        var inExpressionBody = false;
        var parentheses = 0;
        var brackets = 0;
        final body = StringBuffer();
        for (var pos = open + 1; pos < code.length && depth > 0; pos++) {
          final char = code[pos];
          if (char == '{') {
            // Keep the opening brace of a block getter declaration.
            body.write(depth == 1 && !inExpressionBody ? '{' : ' ');
            depth++;
          } else if (char == '}') {
            depth--;
            body.write(' ');
          } else if (depth == 1 &&
              !inExpressionBody &&
              code.startsWith('=>', pos)) {
            body.write('=>');
            inExpressionBody = true;
            parentheses = 0;
            brackets = 0;
            pos++; // Both arrow characters belong to the declaration.
          } else if (depth == 1 && inExpressionBody) {
            // A call on a new line after => is still an expression, not a
            // declaration. Preserve its final semicolon for the next member.
            if (char == '(') parentheses++;
            if (char == ')' && parentheses > 0) parentheses--;
            if (char == '[') brackets++;
            if (char == ']' && brackets > 0) brackets--;
            if (char == ';' && parentheses == 0 && brackets == 0) {
              inExpressionBody = false;
              body.write(';');
            } else {
              body.write(char == '\n' ? '\n' : ' ');
            }
          } else if (depth == 1) {
            body.write(char);
          } else {
            body.write(char == '\n' ? '\n' : ' ');
          }
        }
        bodies.putIfAbsent(name, () => []).add(body.toString());
      }
    }
    return DartSymbols(types, bodies, parents);
  }

  bool contains(String symbol) {
    final parts = symbol.split('.');
    if (parts.length == 1) return types.contains(parts.single);
    if (parts.length != 2 || !types.contains(parts.first)) return false;
    return _declares(parts.first, parts.last, <String>{});
  }

  bool _declares(String type, String name, Set<String> visited) {
    if (!visited.add(type)) return false;
    if (name == 'new') {
      final constructor = RegExp(
        '^[ \\t]*(?:(?:const|factory)\\s+)?${RegExp.escape(type)}\\s*\\(',
        multiLine: true,
      );
      return classBodies[type]?.any((body) => constructor.hasMatch(body)) ??
          false;
    }
    final member = RegExp.escape(name);
    final declaration = RegExp(
      '^[ \\t]*(?:(?:external|static|late|final|const|covariant|abstract)\\s+)*'
      '(?:[A-Za-z_][\\w<>?,. ]*\\s+)?'
      '(?:get\\s+$member\\s*\\{|'
      '(?:(?:get|set|operator)\\s+)?$member\\s*(?:\\(|=>|[=;,]))',
      multiLine: true,
    );
    if (classBodies[type]?.any((body) => declaration.hasMatch(body)) == true) {
      return true;
    }
    return parents[type]?.any((parent) => _declares(parent, name, visited)) ??
        false;
  }
}

String _maskDart(String source) {
  final chars = source.split('');
  void hide(int index) {
    if (chars[index] != '\n' && chars[index] != '\r') chars[index] = ' ';
  }

  for (var i = 0; i < source.length;) {
    if (source.startsWith('//', i)) {
      while (i < source.length && source[i] != '\n') hide(i++);
    } else if (source.startsWith('/*', i)) {
      var depth = 0;
      while (i < source.length) {
        if (source.startsWith('/*', i)) {
          depth++;
          hide(i++);
          hide(i++);
        } else if (source.startsWith('*/', i)) {
          depth--;
          hide(i++);
          hide(i++);
          if (depth == 0) break;
        } else {
          hide(i++);
        }
      }
    } else if (source[i] == "'" || source[i] == '"') {
      final quote = source[i];
      final isRaw = i > 0 &&
          source[i - 1] == 'r' &&
          (i == 1 || !RegExp(r'[A-Za-z0-9_$]').hasMatch(source[i - 2]));
      final triple = source.startsWith(quote * 3, i);
      final delimiter = triple ? quote * 3 : quote;
      for (var j = 0; j < delimiter.length; j++) hide(i++);
      while (i < source.length) {
        if (!isRaw && source[i] == '\\' && i + 1 < source.length) {
          hide(i++);
          hide(i++);
        } else if (source.startsWith(delimiter, i)) {
          for (var j = 0; j < delimiter.length; j++) hide(i++);
          break;
        } else {
          hide(i++);
        }
      }
    } else {
      i++;
    }
  }
  return chars.join();
}

String renderCoverage(Iterable<ApiEntry> source) {
  final entries = source.toList()..sort((a, b) => a.id.compareTo(b.id));
  final byOwner = <String, List<ApiEntry>>{};
  for (final entry in entries) {
    byOwner.putIfAbsent(entry.owner, () => []).add(entry);
  }
  final owners = byOwner.keys.toList()..sort();
  final output = StringBuffer()
    ..writeln('# TMAP API coverage')
    ..writeln()
    ..writeln('Generated from tool/api_manifest/api_manifest.yaml.')
    ..writeln()
    ..writeln(
        '| Class | Done | Todo | Excluded | Total | Done / non-excluded |')
    ..writeln('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (final owner in owners) {
    final rows = byOwner[owner]!;
    final done = rows.where((e) => e.done).length;
    final todo = rows.where((e) => e.todo).length;
    final excluded = rows.where((e) => e.excluded).length;
    final percentage = done + todo == 0
        ? 'N/A'
        : '${(100 * done / (done + todo)).toStringAsFixed(1)}%';
    output.writeln(
        '| $owner | $done | $todo | $excluded | ${rows.length} | $percentage |');
  }
  output
    ..writeln()
    ..writeln('## Todo')
    ..writeln()
    ..writeln('| ID | Kind | Decision | Dart | Reason |')
    ..writeln('| --- | --- | --- | --- | --- |');
  for (final entry in entries.where((e) => e.todo)) {
    output.writeln('| ${entry.id} | ${entry.kind} | ${entry.decision} | '
        '${_cell(entry.dartSymbol)} | ${_cell(entry.reason)} |');
  }
  output
    ..writeln()
    ..writeln('## Excluded')
    ..writeln()
    ..writeln('| ID | Kind | Reason |')
    ..writeln('| --- | --- | --- |');
  for (final entry in entries.where((e) => e.excluded)) {
    output.writeln('| ${entry.id} | ${entry.kind} | ${_cell(entry.reason)} |');
  }
  return output.toString();
}

String _cell(String? value) =>
    (value ?? '—').replaceAll('|', r'\|').replaceAll('\n', ' ');
