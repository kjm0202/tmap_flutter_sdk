// Canonical reviewed coverage; changing prose in review data cannot widen proof.
export const pointSetterScope = "Source-bound, sampled numeric coordinate update adaptation on ordinary writable Point data properties. Ten numeric fixtures include signed zero, non-finite and finite extremes; samples are not exhaustive execution of every double. Excludes missing/non-numeric arguments, custom descriptors, frozen receivers and inherited Point event/identity behavior; related parameter/class/event contracts remain open. Also excludes monkeypatches, proxies, subclass dispatch and concurrent/external mutation. Only ordinary direct calls to the reviewed methods are covered.";
export const pointSetterDimensions = Object.freeze({
  "inputs-defaults": "Dart requires one/two typed double arguments; the native JS setter does not enforce these types and the pinned bodies perform direct coordinate writes with no defaults. Ten encoded numeric values and asymmetric receiver fixtures are sampled. Missing and nonnumeric JS arguments are outside this adaptation.",
  "returns-types": "Pinned native bodies return undefined; Dart with* returns a newly allocated Point. This is an intentional interface difference, not equivalent return behavior.",
  "mutation-identity": "Native before/after coordinates change by direct assignment. Dart final receiver fields remain unchanged, returned coordinates match native after state, and repeated results are distinct. Receiver-reference flags alone are not evidence.",
  "errors": "For ordinary writable numeric fields the reviewed bodies have no validation or explicit throw. All exact sample IDs must execute without setup/call/repeat exceptions. JS exotic receivers and Dart nonnumeric/type errors remain out of scope.",
  "lifecycle-events": "Only the setter bodies are covered: direct data writes contain no explicit event or lifecycle call. SDK Point Base.Object listener storage and Dart new-object inherited state are not equivalent or verified; their contracts stay open.",
  "dispatch": "Exact SDK method bodies and aliases are pinned; the reviewed helper invokes exact Dart with* declarations in separate Web/Android/iOS runs with fresh source, fixture and log hashes. Only ordinary direct calls are covered; monkeypatches, proxies, subclass dispatch and external mutation are excluded."
});

export const pointSetterBindings = Object.freeze({
  "fixture": {
    "file": "example/integration_test/point_size_setter_contracts.dart",
    "sha256": "0d24eb94cb06efabf37c697b802a25587c45cde1e008a5d16e38f3cfa871905e"
  },
  "probe": {
    "file": "tool/sdk_audit/point_size_setter_probe.mjs",
    "sha256": "31b546c0829b456697a8f9e97009a1f225942c56c640bfb23c43693aabcceba5"
  },
  "inputs": {
    "file": "tool/sdk_audit/getter_inputs.json",
    "sha256": "a37a06e7c0d7b2a51efc0853f73751f9b9c5aa2b1b128bfe5ce4a3f9603304ba"
  }
});
