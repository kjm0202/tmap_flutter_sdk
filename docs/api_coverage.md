# TMAP API coverage

Generated from tool/api_manifest/api_manifest.yaml.

| Class | Done | Todo | Excluded | Total | Done / non-excluded |
| --- | ---: | ---: | ---: | ---: | ---: |
| REST | 12 | 0 | 0 | 12 | 100.0% |
| Tmapv3.Bounds | 21 | 0 | 0 | 21 | 100.0% |
| Tmapv3.Circle | 12 | 0 | 0 | 12 | 100.0% |
| Tmapv3.GroundOverlay | 7 | 0 | 0 | 7 | 100.0% |
| Tmapv3.InfoWindow | 15 | 0 | 0 | 15 | 100.0% |
| Tmapv3.Label | 11 | 0 | 0 | 11 | 100.0% |
| Tmapv3.LatLng | 14 | 0 | 0 | 14 | 100.0% |
| Tmapv3.LatLngBounds | 16 | 0 | 0 | 16 | 100.0% |
| Tmapv3.Map | 46 | 0 | 3 | 49 | 100.0% |
| Tmapv3.Marker | 38 | 0 | 0 | 38 | 100.0% |
| Tmapv3.Point | 14 | 0 | 0 | 14 | 100.0% |
| Tmapv3.Polygon | 13 | 0 | 0 | 13 | 100.0% |
| Tmapv3.Polyline | 10 | 0 | 0 | 10 | 100.0% |
| Tmapv3.Projection | 9 | 0 | 0 | 9 | 100.0% |
| Tmapv3.Rectangle | 12 | 0 | 0 | 12 | 100.0% |
| Tmapv3.Size | 7 | 0 | 0 | 7 | 100.0% |
| Tmapv3.TData | 13 | 0 | 6 | 19 | 100.0% |
| Tmapv3.extension.DotMap | 14 | 0 | 0 | 14 | 100.0% |
| Tmapv3.extension.Drawing | 13 | 0 | 0 | 13 | 100.0% |
| Tmapv3.extension.HeatMap | 10 | 0 | 0 | 10 | 100.0% |
| Tmapv3.extension.MarkerCluster | 22 | 0 | 0 | 22 | 100.0% |
| Tmapv3.extension.SquareMap | 14 | 0 | 0 | 14 | 100.0% |

## Todo

| ID | Kind | Decision | Dart | Reason |
| --- | --- | --- | --- | --- |

## Excluded

| ID | Kind | Reason |
| --- | --- | --- |
| Tmapv3.Map#getDiv | method | Raw browser DOM elements are owned by HtmlElementView/WebView, not a Flutter map API. |
| Tmapv3.Map.options.height | option | Map dimensions are supplied by Flutter widget constraints. |
| Tmapv3.Map.options.width | option | Map dimensions are supplied by Flutter widget constraints. |
| Tmapv3.TData#EVENT_TYPE | property | JavaScript callback names are replaced by Dart Future completion and failure semantics. |
| Tmapv3.TData#constructor | constructor | The Flutter REST service uses static Future methods and needs no JavaScript TData instance. |
| Tmapv3.TData#events | property | Request-specific results are returned as typed Futures, without a JavaScript event registry. |
| Tmapv3.TData@onComplete | event | A Dart Future completes with the typed result; a separate JavaScript completion event is redundant. |
| Tmapv3.TData@onError | event | REST failures return null or empty results through Future APIs instead of JavaScript callbacks. |
| Tmapv3.TData@onProgress | event | The Dart REST calls return completed parsed values, with no JavaScript request-progress callback. |
