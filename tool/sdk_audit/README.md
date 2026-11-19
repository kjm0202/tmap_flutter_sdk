# Audit source revision

New `run.json` receipts record `sourceRevision` at the start of collection:

- `{ "available": true, "commit": "<full Git HEAD>", "trackedClean": true }` (or `false` when tracked files are dirty).
- `{ "available": false }` when Git is unavailable or the source root is not itself a Git worktree, including a source archive inside another repository.

The collector rejects a change in HEAD or tracked worktree/index content before it writes the receipt. Untracked files are excluded from `trackedClean`; the existing source, tool, and dependency fingerprints still apply. A dirty receipt describes the checkout but does not establish that its contents equal the commit. This metadata is a local collection-time statement, not a signature.

For a publisher that requires a source commit, run `check --integrity-only --source-commit <full-sha>` in the clean source checkout. This requires the receipt and current checkout to agree with that commit and both to be clean. Do not substitute a later publication commit even if its source fingerprints match. Without `--source-commit`, checks accept older receipts lacking `sourceRevision` and unavailable revisions, subject to the existing fingerprint and artifact checks. Older receipts still have to match the tool fingerprint that produced them.
