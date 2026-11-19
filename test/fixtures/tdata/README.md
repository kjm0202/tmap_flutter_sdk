# Recorded TMAP REST responses

These JSON fixtures were captured from successful HTTP 200 responses at
`https://apis.openapi.sk.com` on 2026-11-20 (KST) using the project's local
test key. The key was sent as an HTTP header, removed if present in a response,
and never saved with the fixtures.

Run `node tool/api_manifest/bin/capture_tdata_fixtures.mjs` from the package
root to refresh them. The script reads
`~/.config/tmap_flutter_sdk/test-app-key.json` locally.

The traffic fixture contains three real road features sampled from the
response, including a segment with nonzero congestion, to keep the fixture
small. All other fixtures preserve the complete returned JSON objects,
subject only to credential removal.
