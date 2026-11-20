import 'dart:convert';
import 'dart:io';

import 'package:tmap_api_manifest/docs_drift.dart';
import 'package:tmap_api_manifest/manifest_checker.dart';

Future<void> main(List<String> arguments) async {
  var compareCoverage = false;
  String? docs;
  for (var i = 0; i < arguments.length; i++) {
    switch (arguments[i]) {
      case '--check-coverage-file':
        compareCoverage = true;
      case '--docs':
        if (i + 1 == arguments.length) {
          stderr.writeln('<args>: --docs requires a path or URL');
          exitCode = 1;
          return;
        }
        docs = arguments[++i];
      default:
        stderr.writeln('<args>: unknown argument "${arguments[i]}"');
        exitCode = 1;
        return;
    }
  }

  Set<String>? documented;
  if (docs != null) {
    try {
      documented = extractDocumentedIds(await _readDocs(docs));
      if (documented.isEmpty) {
        throw const FormatException('no documented classes found');
      }
      stdout.writeln('Docs parsed: ${documented.length} IDs from $docs');
    } catch (error) {
      stderr.writeln('<docs>: could not read/parse "$docs": $error');
      exitCode = 1;
      return;
    }
  }

  final repo = Directory.fromUri(Platform.script.resolve('../../../'));
  final manifestFile = File('${repo.path}/tool/api_manifest/api_manifest.yaml');
  if (!manifestFile.existsSync()) {
    stderr.writeln('<manifest>: missing ${manifestFile.path}');
    exitCode = 1;
    return;
  }
  final result = validateManifest(manifestFile.readAsStringSync(), repo);
  for (final error in result.errors) {
    stderr.writeln(error.replaceAll('\n', ' '));
  }
  if (!result.isValid) {
    stderr.writeln(
        'Manifest validation: FAILED (${result.errors.length} errors)');
    exitCode = 1;
    return;
  }

  final done = result.entries.where((e) => e.done).length;
  final todo = result.entries.where((e) => e.todo).length;
  final excluded = result.entries.where((e) => e.excluded).length;
  stdout.writeln('Manifest validation: PASS '
      '(${result.entries.length} entries, $done done, $todo todo, $excluded excluded)');

  if (documented != null) {
    final drift = DriftResult(
      documented,
      result.entries.map((e) => e.id).toSet(),
    );
    stdout.writeln('Docs drift: ${drift.hasDrift ? 'FAIL' : 'PASS'} '
        '(${drift.documented.length} documented, '
        '${drift.manifest.length} manifest, '
        '${drift.missingFromManifest.length} missing from manifest, '
        '${drift.absentFromDocs.length} manifest-only/info)');
    for (final id in drift.missingFromManifest) {
      stdout.writeln('docs-only: $id');
    }
    for (final id in drift.absentFromDocs) {
      stdout.writeln('manifest-only (info): $id');
    }
    if (drift.hasDrift) exitCode = 1;
    return;
  }

  final coverage = File('${repo.path}/docs/api_coverage.md');
  final rendered = renderCoverage(result.entries);
  if (compareCoverage) {
    if (!coverage.existsSync() || coverage.readAsStringSync() != rendered) {
      stderr.writeln('<coverage>: docs/api_coverage.md is out of date; '
          'run dart run bin/check.dart');
      exitCode = 1;
    } else {
      stdout.writeln('Coverage file: PASS (docs/api_coverage.md matches)');
    }
  } else {
    coverage.parent.createSync(recursive: true);
    coverage.writeAsStringSync(rendered);
    stdout.writeln('Coverage file: generated docs/api_coverage.md');
  }
}

Future<String> _readDocs(String pathOrUrl) async {
  final uri = Uri.tryParse(pathOrUrl);
  if (uri != null && (uri.scheme == 'http' || uri.scheme == 'https')) {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 15);
    try {
      final request =
          await client.getUrl(uri).timeout(const Duration(seconds: 25));
      final response =
          await request.close().timeout(const Duration(seconds: 25));
      if (response.statusCode != HttpStatus.ok) {
        throw HttpException('HTTP ${response.statusCode}', uri: uri);
      }
      return await response
          .transform(utf8.decoder)
          .join()
          .timeout(const Duration(seconds: 25));
    } finally {
      client.close(force: true);
    }
  }
  return File(uri?.scheme == 'file' ? uri!.toFilePath() : pathOrUrl)
      .readAsString();
}
