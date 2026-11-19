import { sha } from "./common.mjs";
import { positionalConstructorLexicalEvidence } from "./positional_constructor_lexical.mjs";
import { positionalConstructorRuntimeEvidence } from "./positional_constructor_runtime.mjs";

const EXPECTED_MANIFEST_ID =
  "7d936078411af8606d98ce1f06d8bb60a40c21855a2a29f3af0607003dc3f0b5";
const EXPECTED_SDK_SHA =
  "5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e";
const EXPECTED_URI =
  "https://toptmaptile1.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206";
const EXPECTED_BYTE_LENGTH = 1281499;

const WHITELISTED_FINGERPRINTS = new Set([
  "3d78171b46794f38d56406645c85af7f7b118b1ded0b7eaf6ea1c6b0c2490ff3",
  "419c85cca62bb17d139bf8f38dec9b1307783d01dbbe40a8f7663f2f15d02de6",
  "325b45a3be6805a9ede0b5a6ed76ac3fd20292a84d3845afd9a482b7e0983c62",
  "bab8690b749e0b76d1ae7749547422611a4bb733b5298217d3f9fa65dd1d53a4",
  "40201a06c09eebdf2ce43ff261baa27802a8b773a222122707ddd308a77e79fe",
]);

function getIssueFingerprint(issue) {
  return sha(JSON.stringify(issue));
}

export function requiresPositionalConstructorEvidence(manifest, i) {
  if (!manifest || manifest.id !== EXPECTED_MANIFEST_ID) return false;
  return WHITELISTED_FINGERPRINTS.has(getIssueFingerprint(i));
}

export function positionalConstructorDispositions({
  manifest,
  sources,
  ast,
  runtime,
  issues,
}) {
  const result = { open: [...issues], resolved: [] };

  if (
    !Array.isArray(sources) ||
    !ast?.issues ||
    !ast?.scripts ||
    !manifest?.sources
  ) {
    return result;
  }

  if (manifest.id !== EXPECTED_MANIFEST_ID) {
    return result;
  }

  const sdkPin = manifest.sources.filter(
    (s) => s.kind === "sdk" && s.url === EXPECTED_URI,
  );
  if (sdkPin.length !== 1) return result;

  const sdkSource = sources.filter(
    (s) => s.kind === "sdk" && s.url === EXPECTED_URI,
  );
  if (sdkSource.length !== 1) return result;

  const astScript = ast.scripts.filter((s) => s.url === EXPECTED_URI);
  if (astScript.length !== 1) return result;

  const pin = sdkPin[0];
  const src = sdkSource[0];
  const script = astScript[0];

  if (
    pin.sha256 !== EXPECTED_SDK_SHA ||
    src.sha256 !== EXPECTED_SDK_SHA ||
    script.sha256 !== EXPECTED_SDK_SHA ||
    script.kind !== "sdk" ||
    pin.bytes !== EXPECTED_BYTE_LENGTH ||
    src.bytes !== EXPECTED_BYTE_LENGTH ||
    script.bytes !== EXPECTED_BYTE_LENGTH ||
    typeof src.text !== "string" ||
    sha(src.text) !== EXPECTED_SDK_SHA ||
    Buffer.byteLength(src.text) !== EXPECTED_BYTE_LENGTH
  ) {
    return result;
  }

  const keep = (original, disposition) => {
    result.open = result.open.filter((i) => i !== original);
    result.resolved.push({ ...disposition, original });
  };

  for (const i of issues) {
    // Only resolve issues that are actually in the whitelist
    const iFingerprint = getIssueFingerprint(i);
    if (!WHITELISTED_FINGERPRINTS.has(iFingerprint)) {
      continue;
    }

    const issuesMatch = issues.filter(
      (x) =>
        x.code === i.code &&
        x.owner === i.owner &&
        x.reason === i.reason &&
        x.evidence?.start === i.evidence?.start &&
        x.evidence?.end === i.evidence?.end,
    );

    const astMatches = ast.issues.filter(
      (a) =>
        a.code === i.code &&
        a.owner === i.owner &&
        a.reason === i.reason &&
        a.evidence?.start === i.evidence?.start &&
        a.evidence?.end === i.evidence?.end,
    );

    if (
      issuesMatch.length !== 1 ||
      astMatches.length !== 1 ||
      getIssueFingerprint(astMatches[0]) !== iFingerprint
    ) {
      continue;
    }

    const lexicalEvidence = positionalConstructorLexicalEvidence(
      src.text,
      i.owner,
      i.evidence?.start,
      i.evidence?.end,
    );
    if (!lexicalEvidence) continue;

    const runtimeEvidence = positionalConstructorRuntimeEvidence(
      runtime,
      i.owner,
      EXPECTED_SDK_SHA,
      manifest,
    );
    if (!runtimeEvidence) continue;

    const rationale =
      i.owner === "Tmapv3.base.Point"
        ? "The constructor stores both positional arguments in x and y. The forwarded base constructor does not inspect its arguments."
        : "The returned constructor applies " +
          src.text.slice(i.evidence.start, i.evidence.end) +
          " to a positional coordinate.";

    keep(i, {
      status: "SOURCE_POSITIONAL_CONSTRUCTOR_FLOW",
      scope: "Positional constructor argument handling at this source range",
      rationale: rationale,
      evidence: {
        ...i.evidence,
        lexical: lexicalEvidence,
        runtime: runtimeEvidence,
      },
    });
  }

  return result;
}
