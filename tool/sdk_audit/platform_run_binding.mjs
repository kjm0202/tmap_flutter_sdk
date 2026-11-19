import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const sortNames = (a, b) => a.localeCompare(b);
const fixedFiles = ['pubspec.yaml', 'pubspec.lock', 'analysis_options.yaml',
  'example/pubspec.yaml', 'example/pubspec.lock', 'example/analysis_options.yaml'];
const requiredTrees = ['lib', 'example/integration_test', 'example/lib', 'example/web'];
const optionalTrees = ['android', 'ios', 'example/android', 'example/ios'];
const excludedDirs = new Set(['.git', '.dart_tool', '.cache', 'node_modules', 'build',
  '.gradle', '.kotlin', 'Pods', '.symlinks', 'ephemeral', 'DerivedData', 'xcuserdata',
  '.generated', 'flutter_assets', 'App.framework', 'Flutter.framework', 'captures']);

// These are local/generated files or potential credentials, not portable source
// inputs. In particular, never open key material while collecting a snapshot.
function excludedFile(name) {
  return name.startsWith('.') || /^(local\.properties|key\.properties|Generated\.xcconfig|flutter_export_environment\.sh|Flutter\.podspec|gradlew(?:\.bat)?|gradle-wrapper\.jar|GeneratedPluginRegistrant\..*|ServiceDefinitions\.json|GoogleService-Info\.plist|google-services\.json)$/i.test(name) ||
    /\.(?:keystore|jks|p12|pfx|pem|key|mobileprovision|cer|crt|der|env)$/i.test(name) ||
    /^(?:app\.flx|app\.zip)$/i.test(name);
}
function walk(root, relative, required) {
  const folder = path.join(root, relative);
  if (!fs.existsSync(folder)) {
    if (required) throw Error(`missing input directory: ${relative}`);
    return [];
  }
  if (!fs.lstatSync(folder).isDirectory()) throw Error(`not an input directory: ${relative}`);
  const out = [];
  const visit = rel => {
    for (const entry of fs.readdirSync(path.join(root, rel), {withFileTypes:true}).sort((a,b) => sortNames(a.name,b.name))) {
      if (excludedDirs.has(entry.name)) continue;
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) visit(next);
      else if (entry.isSymbolicLink()) throw Error(`symlink in input tree: ${next}`);
      else if (entry.isFile() && !excludedFile(entry.name)) out.push(next);
    }
  };
  visit(relative);
  return out;
}

/** Capture portable project inputs without opening generated or secret files.
 * File names are always relative to root; changes to the selected file set
 * itself change the capture. This does not identify SDK/toolchain versions,
 * external services, runtime assets, credentials, or environment variables. */
export function capturePlatformInputs(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw Error('root must be absolute');
  const lib = walk(root, 'lib', true);
  const other = [...fixedFiles];
  for (const tree of requiredTrees.slice(1)) other.push(...walk(root, tree, true));
  for (const tree of optionalTrees) other.push(...walk(root, tree, false));
  // The private web runner copies integration sources into example/lib so
  // Flutter can import them. Verify each alias before omitting its duplicate.
  const portable = other.filter(file => {
    const match = /^example\/lib\/([^/]+)$/.exec(file);
    if (!match) return true;
    const name = match[1];
    const canonical = name === 'live_map_probe.dart' ? 'web_live_probe.dart' :
      (name.endsWith('_contracts.dart') || name === 'marker_getter_observations.dart' ||
       name === 'getter_contract_inputs.dart' ||
       name === 'sdk_projection_facet_fixture.dart' ||
       name === 'sdk_native_environment_relation_fixture.dart') ? name : null;
    if (!canonical) return true;
    const source = path.join(root, 'example/integration_test', canonical);
    if (!fs.existsSync(source) || !fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(source)))
      throw Error(`web alias differs from integration source: ${file}`);
    return false;
  });
  const files = {};
  for (const rel of lib) files[rel] = hash(fs.readFileSync(path.join(root, rel)));
  const bridge = fs.existsSync(path.join(root, 'assets/bridge')) ? walk(root, 'assets/bridge', false) : [];
  const bridgeFiles = {};
  for (const rel of bridge) bridgeFiles[rel] = hash(fs.readFileSync(path.join(root, rel)));
  const bridgeFingerprint = { sha256: hash(JSON.stringify(bridgeFiles)), files: bridgeFiles };
  const inputs = portable.sort(sortNames).map(file => {
    const full = path.join(root, file);
    if (!fs.lstatSync(full).isFile()) throw Error(`not an input file: ${file}`);
    return {file, sha256:hash(fs.readFileSync(full))};
  });
  return {libFingerprint:{sha256:hash(JSON.stringify(files)), files}, bridgeFingerprint, inputs};
}

const keysEqual = (v, expected) => v && typeof v === 'object' && !Array.isArray(v) &&
  isDeepStrictEqual(Object.keys(v).sort(), [...expected].sort());
const isoTime = value => {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};
function validCapture(c) {
  const allowed = keysEqual(c, ['libFingerprint','inputs']) || keysEqual(c, ['libFingerprint','bridgeFingerprint','inputs']);
  if (!allowed || !keysEqual(c.libFingerprint, ['sha256','files']) ||
      !digest(c.libFingerprint.sha256) || !c.libFingerprint.files ||
      typeof c.libFingerprint.files !== 'object' || Array.isArray(c.libFingerprint.files) ||
      hash(JSON.stringify(c.libFingerprint.files)) !== c.libFingerprint.sha256 || !Array.isArray(c.inputs)) return false;
  const rel = p => typeof p === 'string' && p.length > 0 && !p.startsWith('/') &&
    !p.includes('\\') && p.split('/').every(x => x && x !== '.' && x !== '..');
  if (!Object.entries(c.libFingerprint.files).every(([file, value]) => rel(file) && file.startsWith('lib/') && digest(value))) return false;
  const names = new Set();
  for (const x of c.inputs) {
    if (!keysEqual(x, ['file','sha256']) || !rel(x.file) || !digest(x.sha256) || names.has(x.file) || x.file.startsWith('lib/')) return false;
    names.add(x.file);
  }
  return Object.keys(c.libFingerprint.files).length > 0 &&
    fixedFiles.every(file => names.has(file)) && requiredTrees.slice(1).every(tree =>
      [...names].some(file => file.startsWith(`${tree}/`)));
}

/** Validate a recorded process, not its success. The caller supplies a fresh
 * current capture and digest of the actual raw log, not copied manifest values.
 * Capture and log association are only as trustworthy as the runner producing
 * the manifest; this function does not attest the process or the clock. */
export function validatePlatformRunManifest(manifest, {platform, kind, inputs, rawLogSha256}) {
  const fields = ['schemaVersion','platform','kind','startedAt','finishedAt','deviceId',
    'exitCode','signal','inputsBefore','inputsAfter','rawLogSha256'];
  if (!keysEqual(manifest, fields) || manifest.schemaVersion !== 1) throw Error('invalid manifest schema');
  if (typeof platform !== 'string' || !platform.trim() || typeof kind !== 'string' || !kind.trim() ||
      manifest.platform !== platform || manifest.kind !== kind) throw Error('platform or kind mismatch');
  if (!isoTime(manifest.startedAt) || !isoTime(manifest.finishedAt) ||
      Date.parse(manifest.startedAt) > Date.parse(manifest.finishedAt) || Date.parse(manifest.finishedAt) > Date.now()) throw Error('invalid run times');
  if (typeof manifest.deviceId !== 'string' || !manifest.deviceId.trim()) throw Error('invalid device ID');
  const exit = manifest.exitCode, signal = manifest.signal;
  if (!((Number.isInteger(exit) && exit >= 0 && exit <= 255 && signal === null) ||
        (exit === null && typeof signal === 'string' && /^SIG[A-Z0-9]+$/.test(signal)))) throw Error('invalid exit status');
  if (!digest(rawLogSha256) || manifest.rawLogSha256 !== rawLogSha256) throw Error('raw log digest mismatch');
  if (!validCapture(inputs) || !validCapture(manifest.inputsBefore) || !validCapture(manifest.inputsAfter) ||
      !isDeepStrictEqual(inputs, manifest.inputsBefore) || !isDeepStrictEqual(inputs, manifest.inputsAfter)) throw Error('input snapshot mismatch');
  return true;
}
