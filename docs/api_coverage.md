# TMAP API coverage

Generated from tool/api_manifest/api_manifest.yaml.

| Class | Done | Todo | Excluded | Total | Done / non-excluded |
| --- | ---: | ---: | ---: | ---: | ---: |
| REST | 7 | 3 | 0 | 10 | 70.0% |
| Tmapv3.Bounds | 2 | 19 | 0 | 21 | 9.5% |
| Tmapv3.Circle | 10 | 2 | 0 | 12 | 83.3% |
| Tmapv3.GroundOverlay | 0 | 7 | 0 | 7 | 0.0% |
| Tmapv3.InfoWindow | 10 | 5 | 0 | 15 | 66.7% |
| Tmapv3.Label | 6 | 5 | 0 | 11 | 54.5% |
| Tmapv3.LatLng | 6 | 8 | 0 | 14 | 42.9% |
| Tmapv3.LatLngBounds | 4 | 12 | 0 | 16 | 25.0% |
| Tmapv3.Map | 22 | 24 | 3 | 49 | 47.8% |
| Tmapv3.Marker | 27 | 11 | 0 | 38 | 71.1% |
| Tmapv3.Point | 5 | 9 | 0 | 14 | 35.7% |
| Tmapv3.Polygon | 10 | 3 | 0 | 13 | 76.9% |
| Tmapv3.Polyline | 8 | 2 | 0 | 10 | 80.0% |
| Tmapv3.Projection | 0 | 9 | 0 | 9 | 0.0% |
| Tmapv3.Rectangle | 8 | 4 | 0 | 12 | 66.7% |
| Tmapv3.Size | 5 | 2 | 0 | 7 | 71.4% |
| Tmapv3.TData | 8 | 11 | 0 | 19 | 42.1% |
| Tmapv3.extension.DotMap | 0 | 14 | 0 | 14 | 0.0% |
| Tmapv3.extension.Drawing | 0 | 13 | 0 | 13 | 0.0% |
| Tmapv3.extension.HeatMap | 0 | 10 | 0 | 10 | 0.0% |
| Tmapv3.extension.MarkerCluster | 6 | 16 | 0 | 22 | 27.3% |
| Tmapv3.extension.SquareMap | 0 | 14 | 0 | 14 | 0.0% |

## Todo

| ID | Kind | Decision | Dart | Reason |
| --- | --- | --- | --- | --- |
| Tmapv3.Bounds | class | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#clone | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#getHeight | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#getLeft | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#getPosition | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#getSize | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#getTop | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#getWidth | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#intersects | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#setHeight | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#setLeft | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#setTop | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#setWidth | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#toString | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds#union | method | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds.options.bottom | option | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds.options.left | option | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds.options.right | option | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Bounds.options.top | option | adapt | — | JS Bounds is represented by the Flutter LatLngBounds value type where geographic bounds apply. |
| Tmapv3.Circle | class | adapt | — | JS mutable shape controls are represented by immutable Dart shape values and controller operations. |
| Tmapv3.Circle#getPath | method | adapt | — | JS shape geometry getters are represented by Dart shape fields or planned typed accessors. |
| Tmapv3.GroundOverlay | class | expose | — | — |
| Tmapv3.GroundOverlay#constructor | constructor | expose | — | — |
| Tmapv3.GroundOverlay#setMap | method | expose | — | — |
| Tmapv3.GroundOverlay.options.bounds | option | expose | — | — |
| Tmapv3.GroundOverlay.options.map | option | expose | — | — |
| Tmapv3.GroundOverlay.options.opacity | option | expose | — | — |
| Tmapv3.GroundOverlay.options.url | option | expose | — | — |
| Tmapv3.InfoWindow | class | adapt | — | JS mutable overlay controls are represented by typed Dart overlay values managed by TMapController. |
| Tmapv3.InfoWindow#getPosition | method | adapt | — | JS getter values are exposed as immutable Dart overlay fields. |
| Tmapv3.InfoWindow#setPosition | method | adapt | — | Overlay attachment and replacement are managed by TMapController. |
| Tmapv3.InfoWindow.options.anchor | option | expose | — | — |
| Tmapv3.InfoWindow.options.position | option | expose | — | — |
| Tmapv3.Label | class | adapt | — | JS mutable overlay controls are represented by typed Dart overlay values managed by TMapController. |
| Tmapv3.Label#getPosition | method | adapt | — | JS getter values are exposed as immutable Dart overlay fields. |
| Tmapv3.Label.options.maxLevel | option | expose | — | — |
| Tmapv3.Label.options.minLevel | option | expose | — | — |
| Tmapv3.Label.options.position | option | expose | — | — |
| Tmapv3.LatLng | class | expose | — | — |
| Tmapv3.LatLng#clone | method | expose | — | — |
| Tmapv3.LatLng#distanceTo | method | expose | — | — |
| Tmapv3.LatLng#setLatitude | method | expose | — | — |
| Tmapv3.LatLng#setLongitude | method | expose | — | — |
| Tmapv3.LatLng#toBesselTm | method | expose | — | — |
| Tmapv3.LatLng#toEPSG3857 | method | expose | — | — |
| Tmapv3.LatLng#toString | method | expose | — | — |
| Tmapv3.LatLngBounds | class | expose | — | — |
| Tmapv3.LatLngBounds#extend | method | expose | — | — |
| Tmapv3.LatLngBounds#getHeight | method | expose | — | — |
| Tmapv3.LatLngBounds#getNorthEast | method | adapt | — | JS bounds getter methods are Dart value fields and the center property. |
| Tmapv3.LatLngBounds#getNorthWest | method | expose | — | — |
| Tmapv3.LatLngBounds#getSouthEast | method | expose | — | — |
| Tmapv3.LatLngBounds#getSouthWest | method | adapt | — | JS bounds getter methods are Dart value fields and the center property. |
| Tmapv3.LatLngBounds#getWidth | method | expose | — | — |
| Tmapv3.LatLngBounds#intersects | method | expose | — | — |
| Tmapv3.LatLngBounds#isEmpty | method | expose | — | — |
| Tmapv3.LatLngBounds#toString | method | expose | — | — |
| Tmapv3.LatLngBounds#union | method | expose | — | — |
| Tmapv3.Map | class | adapt | — | The JS DOM-bound map is created by the Flutter TMap widget and controlled through TMapController. |
| Tmapv3.Map#getBearing | method | expose | — | — |
| Tmapv3.Map#getBounds | method | expose | — | — |
| Tmapv3.Map#getCenter | method | expose | — | — |
| Tmapv3.Map#getMaxZoom | method | expose | — | — |
| Tmapv3.Map#getMinZoom | method | expose | — | — |
| Tmapv3.Map#getPitch | method | expose | — | — |
| Tmapv3.Map#getZoom | method | expose | — | — |
| Tmapv3.Map#realToScreen | method | expose | — | — |
| Tmapv3.Map#screenSize | method | expose | — | — |
| Tmapv3.Map#screenToReal | method | expose | — | — |
| Tmapv3.Map#setZoomLimit | method | expose | — | — |
| Tmapv3.Map.options.bounds | option | expose | — | — |
| Tmapv3.Map.options.maxBounds | option | expose | — | — |
| Tmapv3.Map.options.maxPitch | option | expose | — | — |
| Tmapv3.Map.options.maxZoom | option | expose | — | — |
| Tmapv3.Map.options.minPitch | option | expose | — | — |
| Tmapv3.Map.options.minZoom | option | expose | — | — |
| Tmapv3.Map.options.naviControl | option | expose | — | — |
| Tmapv3.Map.options.scaleBar | option | expose | — | — |
| Tmapv3.Map@ConfigLoad | event | adapt | — | Map readiness is represented by TMap.onMapCreated, but the ConfigLoad event payload is not independently verified. |
| Tmapv3.Map@ContextMenu | event | adapt | — | JS Map events are delivered through typed TMap callbacks instead of an event-name listener. |
| Tmapv3.Map@TouchEnd | event | adapt | — | JS Map events are delivered through typed TMap callbacks instead of an event-name listener. |
| Tmapv3.Map@TouchStart | event | adapt | — | JS Map events are delivered through typed TMap callbacks instead of an event-name listener. |
| Tmapv3.Marker | class | adapt | — | Mutable JS Marker controls are represented by Dart Marker values managed by TMapController. |
| Tmapv3.Marker#getContextMenu | method | adapt | — | JS mutable Marker operations map to immutable Marker values and controller lifecycle/callback methods. |
| Tmapv3.Marker#off | method | adapt | — | JS mutable Marker operations map to immutable Marker values and controller lifecycle/callback methods. |
| Tmapv3.Marker#on | method | adapt | — | JS mutable Marker operations map to immutable Marker values and controller lifecycle/callback methods. |
| Tmapv3.Marker#setContextMenu | method | adapt | — | JS mutable Marker operations map to immutable Marker values and controller lifecycle/callback methods. |
| Tmapv3.Marker#setPosition | method | adapt | — | JS mutable Marker operations map to immutable Marker values and controller lifecycle/callback methods. |
| Tmapv3.Marker#setZIndex | method | adapt | — | JS mutable Marker operations map to immutable Marker values and controller lifecycle/callback methods. |
| Tmapv3.Marker.options.contextMenu | option | expose | — | — |
| Tmapv3.Marker.options.titleOption | option | adapt | — | JS title styling would be expressed as typed Flutter marker presentation options. |
| Tmapv3.Marker@mouseenter | event | expose | — | — |
| Tmapv3.Marker@mouseleave | event | expose | — | — |
| Tmapv3.Point | class | expose | — | — |
| Tmapv3.Point#clone | method | expose | — | — |
| Tmapv3.Point#distanceTo | method | expose | — | — |
| Tmapv3.Point#equals | method | adapt | — | JS equals is Dart operator ==. |
| Tmapv3.Point#offset | method | expose | — | — |
| Tmapv3.Point#setValue | method | expose | — | — |
| Tmapv3.Point#setX | method | expose | — | — |
| Tmapv3.Point#setY | method | expose | — | — |
| Tmapv3.Point#toString | method | expose | — | — |
| Tmapv3.Polygon | class | adapt | — | JS mutable shape controls are represented by immutable Dart shape values and controller operations. |
| Tmapv3.Polygon#contains | method | expose | — | — |
| Tmapv3.Polygon#getArea | method | adapt | — | JS shape geometry getters are represented by Dart shape fields or planned typed accessors. |
| Tmapv3.Polyline | class | adapt | — | JS mutable shape controls are represented by immutable Dart shape values and controller operations. |
| Tmapv3.Polyline.options.direction | option | expose | — | — |
| Tmapv3.Projection | class | expose | — | — |
| Tmapv3.Projection#constructor | constructor | expose | — | — |
| Tmapv3.Projection#convertBesselGEOToWGS84GEO | method | expose | — | — |
| Tmapv3.Projection#convertBesselTMToWGS84GEO | method | expose | — | — |
| Tmapv3.Projection#convertEPSG3857ToWGS84GEO | method | expose | — | — |
| Tmapv3.Projection#convertWGS84GEOToBesselGEO | method | expose | — | — |
| Tmapv3.Projection#convertWGS84GEOToBesselTM | method | expose | — | — |
| Tmapv3.Projection#convertWGS84GEOToEPSG3857 | method | expose | — | — |
| Tmapv3.Projection#convertWGS84GEOToKatec | method | expose | — | — |
| Tmapv3.Rectangle | class | adapt | — | JS mutable shape controls are represented by immutable Dart shape values and controller operations. |
| Tmapv3.Rectangle#getPath | method | adapt | — | JS shape geometry getters are represented by Dart shape fields or planned typed accessors. |
| Tmapv3.Rectangle.options.fillColor | option | expose | — | — |
| Tmapv3.Rectangle.options.strokeColor | option | expose | — | — |
| Tmapv3.Size | class | expose | — | — |
| Tmapv3.Size#equals | method | adapt | — | JS equals is Dart operator ==. |
| Tmapv3.TData | class | adapt | — | Callback-based JS TData is offered as static asynchronous TDataService methods. |
| Tmapv3.TData#EVENT_TYPE | property | adapt | — | JS TData event state would be represented by typed asynchronous service progress and results. |
| Tmapv3.TData#constructor | constructor | adapt | — | Callback-based JS TData is offered as static asynchronous TDataService methods. |
| Tmapv3.TData#events | property | adapt | — | JS TData event state would be represented by typed asynchronous service progress and results. |
| Tmapv3.TData#getAutoCompleteSearchv3Json | method | adapt | — | JS callbacks and raw JSON are represented by typed Future results in TDataService. |
| Tmapv3.TData#getPOIDataFromIdson | method | adapt | — | JS callbacks and raw JSON are represented by typed Future results in TDataService. |
| Tmapv3.TData#getRealTimeTrafficJson | method | adapt | — | JS callbacks and raw JSON are represented by typed Future results in TDataService. |
| Tmapv3.TData#transformJson | method | adapt | — | JS callbacks and raw JSON are represented by typed Future results in TDataService. |
| Tmapv3.TData@onComplete | event | adapt | — | JS TData event state would be represented by typed asynchronous service progress and results. |
| Tmapv3.TData@onError | event | adapt | — | JS TData event state would be represented by typed asynchronous service progress and results. |
| Tmapv3.TData@onProgress | event | adapt | — | JS TData event state would be represented by typed asynchronous service progress and results. |
| Tmapv3.extension.DotMap | class | expose | — | — |
| Tmapv3.extension.DotMap#constructor | constructor | expose | — | — |
| Tmapv3.extension.DotMap#destroy | method | expose | — | — |
| Tmapv3.extension.DotMap.options.data | option | expose | — | — |
| Tmapv3.extension.DotMap.options.fillColor | option | expose | — | — |
| Tmapv3.extension.DotMap.options.fillOpacity | option | expose | — | — |
| Tmapv3.extension.DotMap.options.lat | option | expose | — | — |
| Tmapv3.extension.DotMap.options.lng | option | expose | — | — |
| Tmapv3.extension.DotMap.options.map | option | expose | — | — |
| Tmapv3.extension.DotMap.options.radius | option | expose | — | — |
| Tmapv3.extension.DotMap.options.range | option | expose | — | — |
| Tmapv3.extension.DotMap.options.strokeColor | option | expose | — | — |
| Tmapv3.extension.DotMap.options.strokeOpacity | option | expose | — | — |
| Tmapv3.extension.DotMap.options.value | option | expose | — | — |
| Tmapv3.extension.Drawing | class | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.Drawing#clear | method | adapt | — | JS Drawing starts an interactive drawing mode; the current Dart helpers create shapes from supplied coordinates. |
| Tmapv3.extension.Drawing#constructor | constructor | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.Drawing#drawCircle | method | adapt | — | JS Drawing starts an interactive drawing mode; the current Dart helpers create shapes from supplied coordinates. |
| Tmapv3.extension.Drawing#drawPolygon | method | adapt | — | JS Drawing starts an interactive drawing mode; the current Dart helpers create shapes from supplied coordinates. |
| Tmapv3.extension.Drawing#drawPolyline | method | adapt | — | JS Drawing starts an interactive drawing mode; the current Dart helpers create shapes from supplied coordinates. |
| Tmapv3.extension.Drawing#drawRectangle | method | adapt | — | JS Drawing starts an interactive drawing mode; the current Dart helpers create shapes from supplied coordinates. |
| Tmapv3.extension.Drawing.options.fillColor | option | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.Drawing.options.fillOpacity | option | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.Drawing.options.map | option | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.Drawing.options.strokeColor | option | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.Drawing.options.strokeOpacity | option | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.Drawing.options.strokeWeight | option | adapt | — | JS Drawing starts an interactive drawing mode; Flutter needs a dedicated drawing controller. |
| Tmapv3.extension.HeatMap | class | expose | — | — |
| Tmapv3.extension.HeatMap#constructor | constructor | expose | — | — |
| Tmapv3.extension.HeatMap#destroy | method | expose | — | — |
| Tmapv3.extension.HeatMap.options.data | option | expose | — | — |
| Tmapv3.extension.HeatMap.options.lat | option | expose | — | — |
| Tmapv3.extension.HeatMap.options.lng | option | expose | — | — |
| Tmapv3.extension.HeatMap.options.map | option | expose | — | — |
| Tmapv3.extension.HeatMap.options.max | option | expose | — | — |
| Tmapv3.extension.HeatMap.options.radius | option | expose | — | — |
| Tmapv3.extension.HeatMap.options.value | option | expose | — | — |
| Tmapv3.extension.MarkerCluster | class | adapt | — | JS MarkerCluster is represented by Clusterer configuration and a TMapController-owned instance. |
| Tmapv3.extension.MarkerCluster#addMarker | method | adapt | — | Cluster membership and lifecycle are controlled by TMapController. |
| Tmapv3.extension.MarkerCluster#clearMarkers | method | adapt | — | Clearing cluster members while retaining the clusterer needs a dedicated controller operation. |
| Tmapv3.extension.MarkerCluster#removeMarker | method | adapt | — | Cluster membership and lifecycle are controlled by TMapController. |
| Tmapv3.extension.MarkerCluster#setOpacity | method | adapt | — | Cluster membership and lifecycle are controlled by TMapController. |
| Tmapv3.extension.MarkerCluster#setVisible | method | adapt | — | Cluster membership and lifecycle are controlled by TMapController. |
| Tmapv3.extension.MarkerCluster#setZIndex | method | adapt | — | Cluster membership and lifecycle are controlled by TMapController. |
| Tmapv3.extension.MarkerCluster.options.gridSize | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.icons | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.maxClusterZoom | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.minClusterCount | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.onClusterMouseEnter | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.onClusterMouseLeave | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.opacity | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.visible | option | expose | — | — |
| Tmapv3.extension.MarkerCluster.options.zIndex | option | expose | — | — |
| Tmapv3.extension.SquareMap | class | expose | — | — |
| Tmapv3.extension.SquareMap#constructor | constructor | expose | — | — |
| Tmapv3.extension.SquareMap#destroy | method | expose | — | — |
| Tmapv3.extension.SquareMap.options.colors | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.data | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.fillOpacity | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.lat | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.lng | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.map | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.origin | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.size | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.strokeOpacity | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.value | option | expose | — | — |
| Tmapv3.extension.SquareMap.options.values | option | expose | — | — |
| rest:/tmap/geo/geocoding | rest | adapt | — | REST endpoint results are exposed, or planned to be exposed, as typed Dart Future values. |
| rest:/tmap/pois/{poiInfo} | rest | adapt | — | REST endpoint results are exposed, or planned to be exposed, as typed Dart Future values. |
| rest:/tmap/traffic | rest | adapt | — | REST endpoint results are exposed, or planned to be exposed, as typed Dart Future values. |

## Excluded

| ID | Kind | Reason |
| --- | --- | --- |
| Tmapv3.Map#getDiv | method | Raw browser DOM elements are owned by HtmlElementView/WebView, not a Flutter map API. |
| Tmapv3.Map.options.height | option | Map dimensions are supplied by Flutter widget constraints. |
| Tmapv3.Map.options.width | option | Map dimensions are supplied by Flutter widget constraints. |
