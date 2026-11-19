import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:path/path.dart' as p;

// Syntax inventory, not a claim of type-resolved behavioral equivalence.
void main(List<String> args) {
  final root = p.normalize(p.absolute(args.first));
  final rows = <Map<String, dynamic>>[], issues = <Map<String, dynamic>>[];
  final seen = <String>{},
      queue = <String>[p.join(root, 'lib/tmap_flutter_sdk.dart')];
  final exported = <String>{};
  final parents = <String, List<String>>{};
  while (queue.isNotEmpty) {
    final file = queue.removeAt(0);
    if (!seen.add(file)) continue;
    if (!File(file).existsSync()) {
      issues.add({
        'code': 'dart-source-missing',
        'file': p.relative(file, from: root),
      });
      continue;
    }
    exported.add(file);
    final result = parseString(
      content: File(file).readAsStringSync(),
      path: file,
      throwIfDiagnostics: false,
    );
    for (final error in result.errors)
      issues.add({
        'code': 'dart-parse-diagnostic',
        'file': p.relative(file, from: root),
        'message': error.toString(),
      });
    for (final directive in result.unit.directives) {
      if (directive is ExportDirective || directive is PartDirective) {
        final d = directive as UriBasedDirective;
        final uri = d.uri.stringValue;
        if (uri != null &&
            !uri.startsWith('dart:') &&
            !uri.startsWith('package:'))
          queue.add(p.normalize(p.join(p.dirname(file), uri)));
        if (directive is ExportDirective &&
            (directive.configurations.isNotEmpty ||
                directive.combinators.isNotEmpty))
          issues.add({
            'code': 'dart-export-filter-needs-review',
            'file': p.relative(file, from: root),
            'directive': directive.toSource(),
          });
      }
    }
    result.unit.accept(
      Inventory(
        rows,
        p.relative(file, from: root),
        result.lineInfo.getLocation,
        parents,
      ),
    );
  }
  final direct = List<Map<String, dynamic>>.from(rows);
  for (final cls in parents.keys.where((s) => !s.startsWith('_'))) {
    final visited = <String>{};
    void inherit(String base) {
      if (!visited.add(base)) return;
      for (final r in direct.where(
        (r) => r['owner'] == base && r['kind'] != 'constructor',
      )) {
        if (!rows.any((v) => v['owner'] == cls && v['name'] == r['name']))
          rows.add({
            ...r,
            'id': '$cls.${r['name']}',
            'owner': cls,
            'inheritedFrom': base,
          });
      }
      for (final b in parents[base] ?? <String>[]) inherit(b);
    }

    for (final base in (parents[cls] ?? <String>[]).reversed) inherit(base);
  }
  rows.removeWhere((r) => (r['owner'] as String?)?.startsWith('_') ?? false);
  stdout.write(
    jsonEncode({
      'rows': rows,
      'issues': issues,
      'exportedFiles': exported.map((e) => p.relative(e, from: root)).toList(),
      'sdkVersion': Platform.version,
      'mode':
          'AST syntax declarations reachable from library exports and parts; mappings remain candidates until verified.',
    }),
  );
}

class Inventory extends RecursiveAstVisitor<void> {
  final List<Map<String, dynamic>> rows;
  final String file;
  final dynamic Function(int) location;
  String? owner;
  final Map<String, List<String>> parents;
  bool isOwnerInternal = false;
  bool classHasConstructor = false;
  Inventory(this.rows, this.file, this.location, this.parents);
  void add(
    String name,
    String kind,
    AstNode n, {
    String? signature,
    String? doc,
  }) {
    if (name.startsWith('_')) return;

    // Check for @internal
    bool isInternal = isOwnerInternal;
    if (n is AnnotatedNode) {
      isInternal =
          isInternal || n.metadata.any((m) => m.name.name == 'internal');
    }

    final row = {
      'id': owner == null ? name : '$owner.$name',
      'owner': owner,
      'name': name,
      'kind': kind,
      'file': file,
      'line': location(n.offset).lineNumber,
      'start': n.offset,
      'end': n.end,
      'signature': signature,
      'documentation': doc,
    };
    if (isInternal) {
      row['isInternal'] = true;
    }
    rows.add(row);
  }

  @override
  void visitClassDeclaration(ClassDeclaration n) {
    final old = owner;
    final oldIsInternal = isOwnerInternal;
    final oldHasConstructor = classHasConstructor;
    isOwnerInternal = n.metadata.any((m) => m.name.name == 'internal');
    classHasConstructor = false;
    owner = null;
    add(n.name.lexeme, 'class', n);
    owner = n.name.lexeme;
    parents[owner!] = [
      if (n.extendsClause != null) n.extendsClause!.superclass.name.lexeme,
      ...?n.withClause?.mixinTypes.map((t) => t.name.lexeme),
    ];
    super.visitClassDeclaration(n);
    if (!classHasConstructor && n.abstractKeyword == null) {
      add('new', 'constructor', n, signature: '()');
    }
    owner = old;
    isOwnerInternal = oldIsInternal;
    classHasConstructor = oldHasConstructor;
  }

  @override
  void visitMixinDeclaration(MixinDeclaration n) {
    final old = owner;
    final oldIsInternal = isOwnerInternal;
    isOwnerInternal = n.metadata.any((m) => m.name.name == 'internal');
    owner = n.name.lexeme;
    super.visitMixinDeclaration(n);
    owner = old;
    isOwnerInternal = oldIsInternal;
  }

  @override
  void visitEnumDeclaration(EnumDeclaration n) {
    final old = owner;
    final oldIsInternal = isOwnerInternal;
    isOwnerInternal = n.metadata.any((m) => m.name.name == 'internal');
    owner = null;
    add(n.name.lexeme, 'enum', n);
    owner = n.name.lexeme;

    // Add constants and values getter
    for (final constant in n.constants) {
      add(constant.name.lexeme, 'enum-constant', constant);
    }
    add('values', 'getter', n);

    super.visitEnumDeclaration(n);
    owner = old;
    isOwnerInternal = oldIsInternal;
  }

  @override
  void visitExtensionDeclaration(ExtensionDeclaration n) {
    final old = owner;
    final oldIsInternal = isOwnerInternal;
    isOwnerInternal = n.metadata.any((m) => m.name.name == 'internal');
    final name = n.name?.lexeme;
    if (name != null) {
      add(name, 'extension', n);
    }
    owner = name ?? 'unnamed-extension';
    super.visitExtensionDeclaration(n);
    owner = old;
    isOwnerInternal = oldIsInternal;
  }

  @override
  void visitMethodDeclaration(MethodDeclaration n) {
    add(
      n.name.lexeme,
      n.isGetter
          ? 'getter'
          : n.isSetter
              ? 'setter'
              : 'method',
      n,
      signature: '${n.returnType ?? ''} ${n.name}${n.parameters ?? ''}',
      doc: n.documentationComment?.toSource(),
    );
  }

  @override
  void visitConstructorDeclaration(ConstructorDeclaration n) {
    classHasConstructor = true;
    if ((n.name?.lexeme ?? '').startsWith('_')) return;
    add(
      n.name?.lexeme ?? 'new',
      'constructor',
      n,
      signature: n.parameters.toSource(),
      doc: n.documentationComment?.toSource(),
    );
  }

  @override
  void visitFieldDeclaration(FieldDeclaration n) {
    for (final v in n.fields.variables)
      add(
        v.name.lexeme,
        'field',
        v,
        signature: '${n.fields.type ?? ''} ${v.name}',
        doc: n.documentationComment?.toSource(),
      );
  }

  @override
  void visitFunctionDeclaration(FunctionDeclaration n) {
    add(
      n.name.lexeme,
      'function',
      n,
      signature: n.functionExpression.parameters?.toSource(),
      doc: n.documentationComment?.toSource(),
    );
  }

  @override
  void visitGenericTypeAlias(GenericTypeAlias n) {
    add(n.name.lexeme, 'typedef', n, signature: n.type.toSource());
  }
}
