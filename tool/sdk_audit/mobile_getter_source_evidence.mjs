import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { ROOT, sha } from "./common.mjs";

const EXPECTED_HASHES = {
  "assets/bridge/mobile.js": [
    "c92efa323c6a0bb23a7d7d81772b3d0fa685bc0d9847a3401586efb319b8a9d3",
    "2515469fc9636d81f0701d9256f5100952af5084d7d1e0fda81267e719ef40f0"
  ],
  "assets/bridge/mobile_overlays.js": "2447b2e2c8c57d4eeaef387d14fa39d2f2bc39065b79ac63a35dec2ca53e8f67",
  "assets/bridge/mobile_tdata.js": "7cb0fa61b6a34bc5ec005bd7e9ad39f5609f8b49c0fe27d4f467b9455eba207b",
  "assets/bridge/shared.js": "e1c85c2c1a5abecac241d1b9c174cc7cbdbb1bce028758a295910da02e1917aa",
  "lib/src/tmap.dart": "c25d3bc828e0fcb52fe4c9c2bf168e9bb14daf41c60533e4507b7995447be845",
};

const MOBILE_EMITTED_MAPPING = {
  "c92efa323c6a0bb23a7d7d81772b3d0fa685bc0d9847a3401586efb319b8a9d3": "ed2dc863ed8c39c2b7938b25d1bf3b3531f326969c763d43b08895c970a00e7d",
  "2515469fc9636d81f0701d9256f5100952af5084d7d1e0fda81267e719ef40f0": "5c9d2d7bc47b39b82b4ff9dac000f11c1784f79324a00dfd6453187730702f1c"
};

const FORBIDDEN_FUNCTIONS = [
  "getZoomData",
  "getMinZoomData",
  "getMaxZoomData",
  "getPitchData",
  "getBearingData",
  "getCenterData",
  "__auditExtension",
  "runExtension",
];

function checkForbiddenFunctions(code) {
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: "script" });
  } catch (e) {
    return true;
  }
  let found = false;
  walk.full(ast, (node) => {
    if (found) return;
    if (node.type === 'FunctionDeclaration' && node.id && FORBIDDEN_FUNCTIONS.includes(node.id.name)) found = true;
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && FORBIDDEN_FUNCTIONS.includes(node.id.name)) found = true;
    if (node.type === 'Property' && !node.computed && node.key.type === 'Identifier' && FORBIDDEN_FUNCTIONS.includes(node.key.name)) found = true;
    if (node.type === 'Identifier' && FORBIDDEN_FUNCTIONS.includes(node.name)) found = true;
    if (node.type === 'Literal' && typeof node.value === "string" && FORBIDDEN_FUNCTIONS.includes(node.value)) found = true;
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier' && FORBIDDEN_FUNCTIONS.includes(node.property.name)) found = true;
  });
  return found;
}

/**
 * Validates mobile helper source evidence.
 *
 * @param {Object} params
 * @param {Object} params.runtime - The runtime environment.
 * @param {Object} params.libFingerprint - Fingerprint for lib/ files.
 * @param {Object} params.bridgeFingerprint - Fingerprint for assets/ files.
 * @param {string} [params.root=ROOT] - The root directory of the repository.
 * @returns {Promise<Object|null>} - Returns evidence or null on failure.
 */
export function mobileGetterSourceEvidence({ runtime, libFingerprint, bridgeFingerprint, root = ROOT }) {
  const mobileSourceFileHashes = {};
  const fileContents = {};

  for (const [relativePath, expectedHashOrArray] of Object.entries(EXPECTED_HASHES)) {
    const fullPath = path.join(root, relativePath);
    try {
      const buffer = fs.readFileSync(fullPath);
      const actualHash = sha(buffer);
      const expectedHashes = Array.isArray(expectedHashOrArray) ? expectedHashOrArray : [expectedHashOrArray];

      if (!expectedHashes.includes(actualHash)) {
        return null;
      }

      // Verify leaf digest against fingerprint
      if (relativePath.startsWith("lib/")) {
         if (libFingerprint?.files?.[relativePath] !== actualHash) return null;
      } else if (relativePath.startsWith("assets/")) {
         if (bridgeFingerprint?.files?.[relativePath] !== actualHash) return null;
      } else {
        return null; // Should not happen for fixed paths
      }

      mobileSourceFileHashes[relativePath] = actualHash;
      fileContents[relativePath] = buffer.toString();
    } catch (e) {
      return null; // Fail closed on any error (file not found, etc.)
    }
  }

  // Parse four actual emitted asset sources with acorn
  for (const path of ["assets/bridge/shared.js", "assets/bridge/mobile.js", "assets/bridge/mobile_overlays.js", "assets/bridge/mobile_tdata.js"]) {
      if (checkForbiddenFunctions(fileContents[path])) {
          return null;
      }
  }

  // Count exactly one top-level realToScreen function definition in mobile.js
  const mobileCode = fileContents["assets/bridge/mobile.js"];
  let realToScreenNode;
  try {
      const ast = acorn.parse(mobileCode, { ecmaVersion: 'latest', sourceType: "script" });
      const topLevelFunctions = ast.body.filter(n => n.type === 'FunctionDeclaration' && n.id?.name === 'realToScreen');
      if (topLevelFunctions.length !== 1) return null;
      realToScreenNode = topLevelFunctions[0];
  } catch (e) {
      return null;
  }

  // SHA original span must dda3667b69759ce8c3281889180262051ea9287b75f37a98b5ef328c20ce9729
  const realToScreenSpan = mobileCode.substring(realToScreenNode.start, realToScreenNode.end);
  if (sha(realToScreenSpan) !== "dda3667b69759ce8c3281889180262051ea9287b75f37a98b5ef328c20ce9729") return null;

  // Verify dart/bin/bridges.dart hash d601e2ceb33c5006c76a538d6f1e44cf0de61c53eff59108df2d3d8c8d50a32b
  const bridgesDartPath = path.join(root, "tool/sdk_audit/dart/bin/bridges.dart");
  try {
      const bridgesDartBuffer = fs.readFileSync(bridgesDartPath);
      if (sha(bridgesDartBuffer) !== "d601e2ceb33c5006c76a538d6f1e44cf0de61c53eff59108df2d3d8c8d50a32b") return null;
  } catch (e) {
      return null;
  }

  // Recompute SHA-256 bytes [shared,mobile,mobile_overlays,mobile_tdata].join('\n')
  const orderedContent = [
      fileContents["assets/bridge/shared.js"],
      fileContents["assets/bridge/mobile.js"],
      fileContents["assets/bridge/mobile_overlays.js"],
      fileContents["assets/bridge/mobile_tdata.js"],
  ].join('\n');

  const emittedMobileHelperSha256 = sha(orderedContent);

  if (emittedMobileHelperSha256 !== runtime?.bridgeSourceHashes?.mobileHelpers) {
    return null;
  }

  const mobileHash = mobileSourceFileHashes["assets/bridge/mobile.js"];
  const expectedEmittedHash = MOBILE_EMITTED_MAPPING[mobileHash];
  if (emittedMobileHelperSha256 !== expectedEmittedHash) return null;

  return {
    mobileSourceFileHashes,
    emittedMobileHelperSha256,
    mobileRealToScreenSourceSha256: sha(realToScreenSpan),
    emitterSha256: "d601e2ceb33c5006c76a538d6f1e44cf0de61c53eff59108df2d3d8c8d50a32b"
  };
}
