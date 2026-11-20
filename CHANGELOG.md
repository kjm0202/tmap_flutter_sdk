# Changelog

Korean release notes: [CHANGELOG_ko.md](CHANGELOG_ko.md).

## 0.2.0

Covers the officially documented public API of the TMAP Vector JS SDK (Tmapv3). `tool/api_manifest/` tracks one row per documented member (343 implemented, 9 deliberately excluded) and CI checks it against the official docs.

### Breaking changes

* `LatLng.toString()` now returns the SDK format `lat,lng` instead of `LatLng(lat, lng)`.
* `Point.toString()` now returns `x,y` with two decimals (for example `3.00,4.00`) instead of `Point(x, y)`.
* `LatLngBounds.toString()` now returns `southWest:northEast` using normalized corners, or `null:null` for empty bounds.
* `TDataService` no longer prints requests with `debugPrint`, so the app key no longer appears in the console. Errors are reported through `dart:developer` `log`.

### Added

* **Map state:** `TMapController.getCenter`, `getBounds`, `getZoom`, `getMinZoom`, `getMaxZoom`, `getBearing`, `getPitch`, `screenSize`, `setZoomLimit` and `updateMapOptions`.
* **Screen and coordinate conversion:** `realToScreen`, `screenToReal`, `convertProjection` and the `Projection` utility with 7 projection conversions.
* **`TMap` options:** `bounds`, `maxBounds`, `minPitch`, `maxPitch`, `onTouchStart` and `onTouchEnd`. Changing `bounds` after creation fits the map to the new bounds; `maxBounds` and pitch limits apply at creation only.
* **Value types:** new `Bounds`; `LatLngBounds.empty`, `extend`, `union`, `intersects`, corner and size getters; more `LatLng` and `Point` operations.
* **Markers and clusters:** typed `onMarkerEvent` / `offMarkerEvent` and `onClusterEvent` / `offClusterEvent`, marker context menu and title style, `copyWith`, adding and removing cluster markers, `clearClusterMarkers`.
* **Shapes:** `GroundOverlay` (`addGroundOverlay`, `clearGroundOverlay`, `clearAllGroundOverlays`), interactive drawing (`startDrawingCircle`, `startDrawingRectangle`, `startDrawingPolyline`, `startDrawingPolygon`, `clearDrawings`), `polygonContains` and `getPolygonArea`, `clearCustomOverlay`.
* **Visualization layers:** `DotMap`, `SquareMap` and `HeatMap` with add, update and remove methods.
* **TData REST:** `getRealTimeTraffic`, `getPoiById`, `getGeoFromAddressLegacy`, `transformJson` (coordinate conversion) and location-aware autocomplete `getAutoCompleteSearchV2`.

### Fixed

* Web and mobile now load the same shared JavaScript bridge, so behaviour matches across platforms.
* Overlays, gesture callbacks and controls stay in sync across widget rebuilds, and shape removal and camera panning target the correct web map.
* Cluster visibility, member marker styles, circle radius, shape stacking and explicit zero-width strokes are preserved.
* Map drags inside scrolling web and iOS screens no longer fight with the scroll view; interrupted Android double-tap zoom completes within the map's zoom limits.
* Route paths and guidance points are converted to geographic coordinates.
* TData handles failed responses, autocomplete and geocoding response shapes, building numbers in POI addresses and incomplete coordinate pairs.
* Bounds set before the map is ready are applied before `onMapCreated` runs, and an exception in one map listener no longer stops the others.

### Documentation

* `README.md` is now English only. The Korean guide moved to `README_ko.md`, and the two link to each other.
* Korean release notes are in `CHANGELOG_ko.md`.

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
