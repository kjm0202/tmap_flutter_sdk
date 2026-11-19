import { load } from 'cheerio';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { sha } from './common.mjs';

// AST witness for one official direct jQuery POST: exactly one executable
// `$.ajax` call in the page script and exactly one displayed copy in
// `pre > code`, both carrying the exact URL literal. Lines and offsets are
// recomputed from the physical text, never from parser-normalized content.
const OPEN = '<script>', CLOSE = '</script>';
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;
const byteAt = (text, offset) => Buffer.byteLength(text.slice(0, offset));
const isName = (n, name) => n?.type === 'Identifier' && n.name === name;
const member = (n, object, property) => n?.type === 'MemberExpression' && !n.computed && isName(n.object, object) && isName(n.property, property);

function ajaxCalls(code) {
  const calls = [];
  walk.simple(parse(code, { ecmaVersion: 2022, sourceType: 'script' }), {
    CallExpression(n) { if (member(n.callee, '$', 'ajax')) calls.push(n); }
  });
  return calls;
}

// Returns the request shape of one `$.ajax({...})` call, or null when any
// property is computed, spread, duplicated or differs from the direct POST.
function directPost(node, url) {
  const [options] = node.arguments;
  if (node.arguments.length !== 1 || options.type !== 'ObjectExpression') return null;
  const props = new Map();
  for (const p of options.properties) {
    if (p.type !== 'Property' || p.kind !== 'init' || p.computed || p.method || p.shorthand) return null;
    const key = p.key.type === 'Identifier' ? p.key.name : (p.key.type === 'Literal' && typeof p.key.value === 'string' ? p.key.value : null);
    if (key === null || props.has(key)) return null;
    props.set(key, p.value);
  }
  const literal = (key, value) => props.get(key)?.type === 'Literal' && props.get(key).value === value;
  const data = props.get('data');
  if (!literal('type', 'POST') || !literal('url', url) || !literal('contentType', 'application/json')) return null;
  if (data?.type !== 'CallExpression' || !member(data.callee, 'JSON', 'stringify') || data.arguments.length !== 1 || data.arguments[0].type !== 'ObjectExpression') return null;
  if (props.get('success')?.type !== 'FunctionExpression' || props.get('error')?.type !== 'FunctionExpression') return null;
  return { keys: [...props.keys()], urlLiteral: props.get('url') };
}

function occurrences(text, needle) {
  let n = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) n++;
  return n;
}

export function ajaxWitness(html, url) {
  try {
    if (typeof html !== 'string' || typeof url !== 'string' || !url.startsWith('https://')) return null;
    const $ = load(html, { sourceCodeLocationInfo: true });

    // Executable: the single inline script element of the page.
    const scripts = $('script').toArray();
    if (scripts.length !== 1 || scripts[0].attribs.src !== undefined || !['text/javascript', undefined].includes(scripts[0].attribs.type)) return null;
    const scriptText = scripts[0].children.length === 1 ? scripts[0].children[0] : null;
    const scriptStart = scriptText?.sourceCodeLocation?.startOffset;
    if (scriptText?.type !== 'text' || !Number.isInteger(scriptStart)) return null;
    const code = scriptText.data;
    if (html.slice(scriptStart, scriptStart + code.length) !== code) return null;
    const calls = ajaxCalls(code);
    const executable = calls.length === 1 ? directPost(calls[0], url) : null;
    if (!executable) return null;
    const urlOffset = scriptStart + executable.urlLiteral.start;
    if (html.slice(urlOffset, scriptStart + executable.urlLiteral.end) !== JSON.stringify(url)) return null;

    // Displayed: one `pre > code` block whose escaped <script> body is the same direct POST.
    const blocks = $('pre > code').toArray().filter(el => $(el).text().includes(url));
    if (blocks.length !== 1) return null;
    const loc = blocks[0].sourceCodeLocation;
    const shown = $(blocks[0]).text(), open = shown.indexOf(OPEN), close = shown.lastIndexOf(CLOSE);
    if (occurrences(shown, url) !== 1 || occurrences(shown, OPEN) !== 1 || occurrences(shown, CLOSE) !== 1 || open > close) return null;
    const shownCalls = ajaxCalls(shown.slice(open + OPEN.length, close));
    const displayed = shownCalls.length === 1 ? directPost(shownCalls[0], url) : null;
    if (!displayed || JSON.stringify(displayed.keys) !== JSON.stringify(executable.keys)) return null;
    const inner = [loc?.startTag?.endOffset, loc?.endTag?.startOffset];
    if (!inner.every(Number.isInteger) || occurrences(html.slice(...inner), url) !== 1) return null;
    const shownOffset = html.indexOf(url, inner[0]);

    // Exactly the two physical URL strings: the executable literal and the display.
    if (occurrences(html, url) !== 2 || shownOffset <= urlOffset) return null;
    const callStart = scriptStart + calls[0].start, callEnd = scriptStart + calls[0].end;
    return {
      url,
      verb: 'POST',
      contentType: 'application/json',
      payload: 'JSON.stringify(ObjectExpression)',
      receiver: '$.ajax',
      callbacks: ['success', 'error'],
      optionKeys: executable.keys,
      scriptCallRange: [calls[0].start, calls[0].end],
      executableLine: lineAt(html, urlOffset),
      displayedLine: lineAt(html, shownOffset),
      executable: {
        callUtf8: [byteAt(html, callStart), byteAt(html, callEnd)],
        callSha256: sha(html.slice(callStart, callEnd)),
        urlUtf8: byteAt(html, urlOffset + 1)
      },
      displayed: {
        codeUtf8: [byteAt(html, inner[0]), byteAt(html, inner[1])],
        codeSha256: sha(html.slice(...inner)),
        urlUtf8: byteAt(html, shownOffset)
      }
    };
  } catch {
    return null;
  }
}
