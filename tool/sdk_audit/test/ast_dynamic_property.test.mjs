import { test } from 'node:test';
import assert from 'node:assert';
import { extractAST } from '../ast.mjs';

test('Dynamic property writes and reflective definitions', () => {
    const sourceText = `
        Tmapv3.createNamespace("MyNS", (function() {
            function MyNS() {
                this[bar] = 1;
                Object.defineProperty(this, "baz", { value: 2 });
            }
            return MyNS;
        })());
    `;
    const result = extractAST([{
        url: "test-source",
        text: sourceText,
        sha256: "test-sha",
        kind: "sdk-script"
    }]);

    const dynamicWrites = result.issues.filter(i => i.code === "dynamic-property-write");
    assert.strictEqual(dynamicWrites.length, 1, "Should find 1 dynamic-property-write issue");
    assert.strictEqual(dynamicWrites[0].keyExpression, "bar", "Key expression should be 'bar'");
    assert.ok(dynamicWrites[0].keyEvidence, "Key evidence should be present");

    const reflective = result.issues.filter(i => i.code === "reflective-property-definition");
    assert.strictEqual(reflective.length, 1, "Should find 1 reflective-property-definition issue");
    assert.strictEqual(reflective[0].keyExpression, "\"baz\"", "Key expression should be '\"baz\"'");
    assert.ok(reflective[0].keyEvidence, "Key evidence should be present");

    // Check for unintended static properties
    const staticRows = result.rows.filter(r => r.static === true);
    assert.strictEqual(staticRows.length, 0, "Should have 0 static properties in this simple case");
});

test('Static vs instance properties', () => {
    const sourceText = `
        Tmapv3.createNamespace("MyNS", (function() {
            function MyNS() {}
            MyNS.prototype.foo = 1;
            MyNS.bar = 2;
            return MyNS;
        })());
    `;
    const result = extractAST([{
        url: "test-source",
        text: sourceText,
        sha256: "test-sha",
        kind: "sdk-script"
    }]);
    
    const foo = result.rows.find(r => r.id === "MyNS#foo");
    assert.ok(foo, "Should find foo");
    assert.strictEqual(foo.static, false, "foo should not be static");
    
    const bar = result.rows.find(r => r.id === "MyNS.bar");
    assert.ok(bar, "Should find bar");
    assert.strictEqual(bar.static, true, "bar should be static");
});
