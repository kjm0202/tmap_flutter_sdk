import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as acorn from 'acorn';
import { extractExampleFields } from '../example_fields.mjs';

describe('Local Receiver Extraction', () => {
  it('classifies direct array .push calls for local arrays using source slices', () => {
    const code = 'const a = []; a.push(1);';
    const tree = acorn.parse(code, { ecmaVersion: 2020 });
    const { localArrayCalls } = extractExampleFields(tree, code);
    assert.strictEqual(localArrayCalls.length, 1);
    const call = localArrayCalls[0];
    assert.strictEqual(code.slice(call.start, call.end), 'a.push(1)');
    assert.strictEqual(code.slice(call.declaration.start, call.declaration.end), 'a = []');
  });

  it('ignores nested closure uses outer var prior to initialization', () => {
    const code = 'function f() { const b = a.push(1); const a = []; }';
    const tree = acorn.parse(code, { ecmaVersion: 2020 });
    const { localArrayCalls } = extractExampleFields(tree, code);
    assert.strictEqual(localArrayCalls.length, 0);
  });

  it('ignores unbraced if with var use outside', () => {
    const code = 'if (cond) var a = []; a.push(1);';
    const tree = acorn.parse(code, { ecmaVersion: 2020 });
    const { localArrayCalls } = extractExampleFields(tree, code);
    assert.strictEqual(localArrayCalls.length, 0);
  });

  it('ignores UpdateExpression a++ (invalidates array)', () => {
    const code = 'const a = []; a.push(1); a++; a.push(2);';
    const tree = acorn.parse(code, { ecmaVersion: 2020 });
    const { localArrayCalls } = extractExampleFields(tree, code);
    assert.strictEqual(localArrayCalls.length, 0);
  });

  it('ignores unknown param shadows outer', () => {
    const code = 'const a = []; function f(a) { a.push(1); }';
    const tree = acorn.parse(code, { ecmaVersion: 2020 });
    const { localArrayCalls } = extractExampleFields(tree, code);
    assert.strictEqual(localArrayCalls.length, 0);
  });

  it('ignores computed push calls', () => {
    const code = 'const a = []; a["push"](1);';
    const tree = acorn.parse(code, { ecmaVersion: 2020 });
    const { localArrayCalls } = extractExampleFields(tree, code);
    assert.strictEqual(localArrayCalls.length, 0);
  });
});
