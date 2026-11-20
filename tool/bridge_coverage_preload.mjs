// The bridge tests load JavaScript with vm.runInContext(), so V8 normally sees
// synthetic script names. Associate only exact bridge asset sources with their
// repository paths, allowing Node's built-in LCOV reporter to measure them.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const bridgeDirectory = fileURLToPath(new URL('../assets/bridge/', import.meta.url));
const sourcePaths = new Map();
for (const name of readdirSync(bridgeDirectory)) {
  if (!name.endsWith('.js')) continue;
  const filename = join(bridgeDirectory, name);
  sourcePaths.set(readFileSync(filename, 'utf8'), filename);
}

const originalRunInContext = vm.runInContext;
vm.runInContext = function runBridgeInContext(source, context, options) {
  const filename = typeof source === 'string' ? sourcePaths.get(source) : undefined;
  if (!filename) return originalRunInContext(source, context, options);
  const originalOptions = typeof options === 'object' && options !== null ? options : {};
  return originalRunInContext(source, context, { ...originalOptions, filename });
};
