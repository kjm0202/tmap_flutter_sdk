# Changelog

## 0.1.1

* Fix platform support detection for pub.dev by explicitly declaring `platforms` (`android`, `ios`, `web`) in `pubspec.yaml`.
* Fix Markdown strikethrough formatting issue in `README.md`.

## 0.1.0

* Initial release of `tmap_flutter_sdk`.
* Supports TMAP Vector Map (v3) JavaScript SDK via WebView.
* Features:
  * 3D camera controls: Pitch (0-60°), Bearing (0-360°), Zoom (0-19), Pan, Center.
  * Map types: `ROAD`, `HYBRID`, `PUBLIC`, `NIGHT`.
  * Overlays: `Marker`, `InfoWindow`, `Label`, `Polyline`, `Polygon`, `Circle`, `Rectangle`, `CustomOverlay`.
  * Marker Clustering with `MarkerCluster`.
  * Built-in `TData` OpenAPI integration: Route planning (Car / Pedestrian), POI Search, Geocoding / Reverse Geocoding, Auto-complete, Real-time Traffic info.
