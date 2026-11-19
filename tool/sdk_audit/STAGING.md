# Compact SDK ledger staging

From this checkout, run the stdlib helper against an existing **raw** audit output and the exact committed source checkout that produced it:

```sh
python3 -B tool/sdk_audit/stage_compact_ledger.py \
  --source /path/to/audit-checkout --commit <audit-source-commit> \
  --baseline /path/to/baseline.json --against /path/to/pinned-prior.json.gz \
  --out /path/to/raw-audit-output --stage /path/to/new-stage
```

The raw `run.json` must explicitly capture `sourceRevision` with `available: true`, `trackedClean: true`, and the full actual commit SHA. That captured SHA, the explicit full `--commit` SHA, and the source checkout's HEAD must be identical. A run without this captured revision may still be inspected, but cannot be freshly staged by guessing its commit, even if its fingerprints match. The source checkout must have no tracked changes, have the audit CLI's Node dependencies and already-restored source cache, and match the run's tool, dependency, library and bridge fingerprints. Use a separate checkout when staging a run made before this helper was added: the helper itself changes the audit tool fingerprint. The stage must not exist and must be outside both checkouts and the raw output. No restore, network access, credentials, audit, or tracked file writes are performed by this command.

Prepare audit inputs in a disposable checkout, never by changing the original checkout. In particular, `flutter pub get` can generate `.dart_tool/package_config.json` while also changing tracked `pubspec.yaml` or `pubspec.lock` (as happened for the ad885be raw run). Prefer `flutter pub get --enforce-lockfile` and `dart pub get --directory tool/sdk_audit/dart --enforce-lockfile` with the latest locally available stable Flutter/Dart. If generating package configuration changes tracked inputs, pin those files to the intended source commit **in the disposable checkout before running the audit**, then verify `git status --porcelain --untracked-files=no` is empty. Ensure the generated package configuration still matches those pinned dependencies; regenerate with the enforced lockfile or discard that checkout if it does not. Generate the raw output only after pinning: staging refuses dirty tracked inputs and cannot repair an already captured run. The integrity check must also match the run's fingerprints. Do not restore or overwrite tracked files in the original checkout as part of this workflow.

The helper runs the source checkout's integrity-only and strict checks, verifies their gate against drift, rechecks the run's artifact hashes, and checks the published baseline, observations, historical receipts and model leaves. It writes candidate current files, referenced receipts and `staging-review.json` into the new directory. The review records the captured clean source revision and the SHA-256 of the raw run manifest. New observation locations, added/removed candidate IDs, and removed or changed previously published supplemental AST claims (identified by ID, canonical JSON SHA-256 and count) are listed for review. Supplemental AST claims are recomputed from the current AST rows and reconciled source names; all claim evidence must occur in the current raw candidate evidence. Full AST claim evidence and raw candidate AST evidence retain duplicates and nested source-flow spans. Shared locations alone never join claims. The release scenarios and existing platform observation scope remain historical; the audit exit code is null because this command did not run the audit. New option claims retain matching raw AST claim/evidence objects with their source-flow spans.

Exit 0 means a stage was created and the strict gate passed; exit 1 means a stage was created **with the strict gate still open**; exit 2 means staging failed. A removed or replaced observation location, missing historical record or changed historical leaf fails closed. There is no automatic approval override: review an intended change separately and update the published inputs through the normal review process. New platform evidence also requires a reviewed summary before it can be staged. A successful staging run is not a release or a claim that historical observations validate the new revision.

Run the targeted regressions with:

```sh
python3 -B -m unittest discover -s tool/sdk_audit/test -p 'test_stage_compact_ledger.py' -v
python3 -B -m unittest discover -s tool/sdk_audit/test -p 'test_observation_integrity.py' -v
```
