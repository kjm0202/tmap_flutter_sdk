import 'dart:io';

import 'package:test/test.dart';
import 'package:tmap_api_manifest/docs_drift.dart';
import 'package:tmap_api_manifest/manifest_checker.dart';

const sdkHeader = '''
sdk:
  docs_url: https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html
  core_url: https://example.test/tmapjs3.min.js
  core_sha256: 5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e
entries:
''';

void main() {
  late Directory root;
  setUp(() {
    root = Directory.systemTemp.createTempSync('tmap-manifest-test-');
    Directory('${root.path}/lib').createSync();
    Directory('${root.path}/test').createSync();
    File('${root.path}/lib/widget.dart').writeAsStringSync('''
class Widget {
  // void missing() {}
  final String text = "a { } string";
  String slash() => r'\';
  Future<void> foo() async {}
  int get size => 2;
}
class Other {
  void other() { Widget().foo(); }
}
class Parent { final int inherited = 1; }
class Child extends Parent { Child(); }
typedef WidgetHandler = void Function();
enum WidgetState { started, stopped }
''');
    File('${root.path}/test/widget_test.dart')
        .writeAsStringSync("test('foo works', () {});");
  });
  tearDown(() => root.deleteSync(recursive: true));

  test('accepts done, todo, adapt and excluded records', () {
    final result = validateManifest('''$sdkHeader
  - id: Tmapv3.Widget#foo
    kind: method
    decision: expose
    status: done
    dart: Widget.foo
    tests: [test/widget_test.dart::foo works]
    platforms: [web, ios]
  - id: Tmapv3.Widget#size
    kind: property
    decision: adapt
    status: done
    dart: Widget.size
    tests: [test/widget_test.dart::foo works]
    reason: read-only getter
  - id: Tmapv3.Widget#pending
    kind: method
    decision: expose
    status: todo
  - id: Tmapv3.Widget#legacy
    kind: method
    decision: exclude
    status: done
    reason: no platform equivalent
''', root);
    expect(result.errors, isEmpty);
    expect(result.entries.length, 4);
    expect(result.entries.where((e) => e.done).length, 2);
  });

  test('rejects malformed schema, duplicates, enum and reason errors', () {
    final result = validateManifest('''$sdkHeader
  - id: Tmapv3.Widget#foo
    kind: method
    decision: nope
    status: done
  - id: Tmapv3.Widget#foo
    kind: event
    decision: exclude
    status: todo
    platforms: [android, android]
''', root);
    expect(result.errors.join('\n'), contains('duplicate id'));
    expect(result.errors.join('\n'), contains('invalid decision'));
    expect(result.errors.join('\n'), contains('id does not match kind'));
    expect(result.errors.join('\n'), contains('reason required'));
    expect(result.errors.join('\n'), contains('excluded entries must'));
    expect(result.errors.join('\n'), contains('platforms must'));
  });

  test('symbol must be declared inside the specified class', () {
    final result = validateManifest('''$sdkHeader
  - id: Tmapv3.Widget#pending
    kind: method
    decision: expose
    status: done
    dart: Other.foo
    tests: [test/widget_test.dart::foo works]
  - id: Tmapv3.Widget#phantom
    kind: method
    decision: expose
    status: done
    dart: Widget.missing
    tests: [test/widget_test.dart::foo works]
''', root);
    expect(result.errors.where((s) => s.contains('is not declared')).length, 2);
    expect(
        DartSymbols.fromDirectory(Directory('${root.path}/lib'))
            .contains('WidgetHandler'),
        isTrue);
    expect(
        DartSymbols.fromDirectory(Directory('${root.path}/lib'))
            .contains('WidgetState'),
        isTrue);
    expect(
        DartSymbols.fromDirectory(Directory('${root.path}/lib'))
            .contains('Child.inherited'),
        isTrue);
  });

  test('recognizes declarations in the actual SDK library', () {
    final rootLib = Directory('../../lib');
    final symbols = DartSymbols.fromDirectory(rootLib);
    expect(symbols.types, contains('TMapController'));
    expect(symbols.classBodies['TMapController']!.first.contains('setCenter('),
        isTrue);
    expect(symbols.contains('TMapController.setCenter'), isTrue);
    expect(symbols.contains('TMapController.fitBounds'), isTrue);
    expect(symbols.contains('Circle.fillColor'), isTrue);
  });

  test('checks each test literal and rejects unsafe paths', () {
    final result = validateManifest('''$sdkHeader
  - id: Tmapv3.Widget#foo
    kind: method
    decision: expose
    status: done
    dart: Widget.foo
    tests:
      - test/widget_test.dart::not a test
      - ../elsewhere.dart::foo
      - test/missing_test.dart::anything
''', root);
    expect(result.errors.join('\n'), contains('does not contain'));
    expect(result.errors.join('\n'), contains('repo-relative'));
    expect(result.errors.join('\n'), contains('does not exist'));
  });

  test('coverage is sorted, excludes from denominator and is reproducible', () {
    const a = ApiEntry(
        id: 'Tmapv3.B#z',
        kind: 'method',
        decision: 'exclude',
        status: 'done',
        reason: 'not applicable');
    const b = ApiEntry(
        id: 'Tmapv3.A#a',
        kind: 'method',
        decision: 'expose',
        status: 'done',
        dartSymbol: 'Widget.foo');
    const c = ApiEntry(
        id: 'Tmapv3.A#b',
        kind: 'method',
        decision: 'adapt',
        status: 'todo',
        reason: 'merged');
    final report = renderCoverage([a, b, c]);
    expect(report, renderCoverage([c, a, b]));
    expect(report, contains('| Tmapv3.A | 1 | 1 | 0 | 2 | 50.0% |'));
    expect(report, contains('| Tmapv3.B | 0 | 0 | 1 | 1 | N/A |'));
    expect(
        report.indexOf('Tmapv3.A#b'), lessThan(report.indexOf('Tmapv3.B#z')));
  });

  test('parses documented HTML classes, methods, options and events', () {
    const page = '''
<!-- <h2>Tmapv3.Fake</h2> -->
<h2 id="widget">Tmapv3.Widget</h2>
<h3>Constructor</h3>
<h4>Parameters</h4>
<ul><li>- size {number}: initial size</li><li>- center {Point}</li></ul>
<h3>Methods</h3>
<ul><li><h4 id="widget_foo">foo</h4></li></ul>
<h5>Parameters</h5><ul><li>- irrelevant {number}</li></ul>
<ul><li>- {String} eventName: events ("click", "mouseenter")</li></ul>
<h2>Tmapv3.Other</h2><h3>Constructor</h3>
<a href="#webservice/docs/tmapPoiDetail">REST</a>
''';
    final ids = extractDocumentedIds(page);
    expect(
        ids,
        containsAll([
          'Tmapv3.Widget',
          'Tmapv3.Widget#constructor',
          'Tmapv3.Widget.options.size',
          'Tmapv3.Widget.options.center',
          'Tmapv3.Widget#foo',
          'Tmapv3.Widget@click',
          'Tmapv3.Widget@mouseenter',
        ]));
    expect(ids, isNot(contains('Tmapv3.Fake')));
    expect(ids, isNot(contains('Tmapv3.Widget.options.irrelevant')));
    expect(ids, isNot(contains('rest:tmapPoiDetail')));
  });

  test('reads documented properties and event names from a table', () {
    const page = '''
<h2>Tmapv3.Tdata</h2><h3>Properties</h3>
<table><tr><td>events</td><td>-</td></tr>
<tr><td rowspan="3">EVENT_TYPE</td><td>"onProgress"</td></tr>
<tr><td>"onComplete"</td></tr><tr><td>"onError"</td></tr></table>
<h3>Methods</h3>
''';
    final ids = extractDocumentedIds(page);
    expect(
        ids,
        containsAll([
          'Tmapv3.TData#events',
          'Tmapv3.TData#EVENT_TYPE',
          'Tmapv3.TData@onProgress',
          'Tmapv3.TData@onComplete',
          'Tmapv3.TData@onError',
        ]));
    expect(ids, isNot(contains('Tmapv3.Tdata#events')));
  });

  test('reads indented constructor fields with malformed nbsp entities', () {
    const page = '''
<h2>Tmapv3.extension.HeatMap</h2><h3>Constructor</h3>
<h4>Parameters</h4><ul><li>- data {Object}</li>
<li>&nbsp&nbsp&nbsplat {Float}: latitude</li>
<li>&nbsp&nbsp&nbsplng {Float}: longitude</li></ul>
''';
    final ids = extractDocumentedIds(page);
    expect(
        ids,
        containsAll([
          'Tmapv3.extension.HeatMap.options.data',
          'Tmapv3.extension.HeatMap.options.lat',
          'Tmapv3.extension.HeatMap.options.lng',
        ]));
  });

  test('drift comparison detects and sorts both directions', () {
    final drift = DriftResult({'a', 'b'}, {'b', 'c'});
    expect(drift.hasDrift, isTrue);
    expect(drift.missingFromManifest, ['a']);
    expect(drift.absentFromDocs, ['c']);
    expect(DriftResult({'a'}, {'a'}).hasDrift, isFalse);
  });
}
