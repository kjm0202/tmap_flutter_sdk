# API manifest

`api_manifest.yaml` is the single source of truth for which parts of the official
TMAP Vector JS SDK (Tmapv3) this Flutter package exposes, and how each is verified.

## Scope

Only the **officially documented public API** is in scope:
https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html (classes, constructors,
constructor options, methods, properties, events).

- Members that exist only in the minified core (`tmapjs3.min.js`) and are not documented
  are out of scope. They are not listed unless a real need appears; then add one row.
- Per-parameter or per-dimension checks (signature/return/error/mutation/...) are not rows.
  One row = one documented member.
- REST (webservice) endpoints are listed once per endpoint, not per response field.

## File shape

```yaml
sdk:
  docs_url: https://tmapapi.tmapmobility.com/webv3VSM/docs/WebDocs.html
  core_url: https://topopentile1.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206
  core_sha256: 5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e
entries:
  - id: Tmapv3.Map#setCenter          # <Class>#<member>, <Class>#constructor, <Class>@<event>, <Class>.options.<name>, rest:<endpoint>
    kind: method                      # class | constructor | option | method | property | event | rest
    decision: expose                  # expose | adapt | exclude
    status: done                      # done | todo   (exclude rows are always done)
    dart: TmapController.setCenter    # required when decision != exclude and status == done
    tests:                            # required when decision != exclude and status == done
      - example/test_driver/bridge/camera_scenarios.dart::setCenter moves the camera
    platforms: [web, android, ios]    # optional, default all three
    reason: ...                       # required for adapt and exclude; one line
```

## Decisions

- `expose`: a Dart API with the same meaning (name may follow Dart conventions).
- `adapt`: offered in a different shape (merged, renamed, typed differently). `reason` says how.
- `exclude`: deliberately not offered. `reason` says why. This is a finished state.

## Definition of done (status: done)

| kind | done when |
|---|---|
| method / property | Dart symbol exists, and one test calls it and checks an observable effect (getter or JS readback) |
| option / constructor | value passed at creation is read back in a test (one test may cover several options of a class) |
| event | test triggers it and checks the payload's typed fields |
| class | all its rows are done or excluded |
| rest | Dart call exists and a test (unit with recorded response, or live) parses its result |

Tests run on web by default; add Android/iOS only where the bridge code path differs
(`assets/bridge/mobile*.js` vs `assets/bridge/web.js`).

## Test references

`<path>::<name>` where `<name>` is a literal string that appears in that file
(test/scenario description). The checker verifies the file exists and contains the string.
