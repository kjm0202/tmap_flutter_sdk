// The SDK owns the map and markers. Each map adapter owns its marker registry.
function latitudeOf(pos) {
  if (typeof pos.lat === 'function') return pos.lat();
  if (typeof pos.getLat === 'function') return pos.getLat();
  return pos._lat ?? pos.lat;
}

function longitudeOf(pos) {
  if (typeof pos.lng === 'function') return pos.lng();
  if (typeof pos.getLng === 'function') return pos.getLng();
  return pos._lng ?? pos.lng;
}

const tmapBridge = {
  setCenter(map, lat, lng) {
    map.setCenter(new Tmapv3.LatLng(lat, lng));
  },

  panTo(map, lat, lng) {
    map.panTo(new Tmapv3.LatLng(lat, lng));
  },

  setZoom(map, zoom) {
    map.setZoom(zoom);
  },

  addMarker(map, markers, data, callbacks) {
    const id = data.markerId;
    tmapBridge.clearMarker(markers, id);
    const position = data.position;
    const options = {
      map,
      position: new Tmapv3.LatLng(position.latitude, position.longitude),
      anchor: data.anchor,
      opacity: data.opacity,
      visible: data.visible,
      draggable: data.draggable,
      zIndex: data.zIndex
    };
    if (data.color) options.color = data.color;
    if (data.title) options.title = data.title;
    if (data.label) {
      options.label = data.label;
      if (data.labelBackgroundColor || data.labelTextColor) {
        options.labelOption = {
          backgroundColor: data.labelBackgroundColor || '#ffffff',
          color: data.labelTextColor || '#000000',
          fontSize: '13px',
          padding: '4px 8px',
          borderRadius: '4px'
        };
      }
    }
    const icon = data.icon;
    if (icon) {
      if (icon.iconUrl) options.icon = icon.iconUrl;
      else if (icon.iconHtml) options.iconHTML = icon.iconHtml;
      if (icon.size) options.iconSize = new Tmapv3.Size(icon.size.width, icon.size.height);
      if (icon.offset) options.offset = new Tmapv3.Point(icon.offset.x, icon.offset.y);
    }

    const marker = new Tmapv3.Marker(options);
    markers[id] = marker;
    for (const [event, callback] of Object.entries(callbacks)) {
      if (!callback) continue;
      marker.on(event, () => {
        if (markers[id] !== marker) return;
        const pos = marker.getPosition();
        callback(id, latitudeOf(pos), longitudeOf(pos), Math.round(map.getZoom()));
      });
    }
  },

  clearMarker(markers, id) {
    const marker = markers[id];
    if (marker) {
      marker.setMap(null);
      delete markers[id];
    }
  },

  clearAllMarkers(markers) {
    for (const id of Object.keys(markers)) tmapBridge.clearMarker(markers, id);
  }
};
