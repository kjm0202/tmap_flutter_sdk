const String shapePairInstall = r'''
(function() {
  if (!window.__shapePair) {
    window.__shapePair = {
      create: function(type) {
        if (!map) throw new Error("Map not found");
        var Tmapv3 = window.Tmapv3;
        if (type === 'polyline') {
          return new Tmapv3.Polyline({
            map: map,
            path: [new Tmapv3.LatLng(37.5665, 126.978), new Tmapv3.LatLng(37.5675, 126.979)]
          });
        } else if (type === 'polygon') {
          return new Tmapv3.Polygon({
            map: map,
            paths: [new Tmapv3.LatLng(37.5600, 126.9700), new Tmapv3.LatLng(37.5600, 126.9800), new Tmapv3.LatLng(37.5700, 126.9700)]
          });
        } else if (type === 'circle') {
          return new Tmapv3.Circle({
            map: map,
            center: new Tmapv3.LatLng(37.5665, 126.978),
            radius: 250
          });
        } else if (type === 'rectangle') {
          var bounds = new Tmapv3.LatLngBounds();
          bounds.extend(new Tmapv3.LatLng(37.5500, 126.9600));
          bounds.extend(new Tmapv3.LatLng(37.5600, 126.9700));
          return new Tmapv3.Rectangle({
            map: map,
            bounds: bounds
          });
        }
        throw new Error("Unknown type: " + type);
      },
      read: function(shape, type, savedId) {
        if (!shape) throw new Error("Shape is null");
        var id = savedId || (shape._shape_data ? shape._shape_data.layerId : null);
        var result = {
          layerId: id,
          rendered: map.vsmMap() ? map.vsmMap().hasLayer(id) : false,
          sameMap: shape.getMap() === map
        };
        if (type === 'polyline' || type === 'polygon') {
          var path = shape.getPath().path;
          result.geometry = path.map(function(pt) { return [pt.lat(), pt.lng()]; });
        } else if (type === 'circle') {
          result.geometry = [shape.getCenter().lat(), shape.getCenter().lng(), shape.getRadius()];
        } else if (type === 'rectangle') {
          var bounds = shape.getBounds();
          result.geometry = [[bounds.getSouthWest().lat(), bounds.getSouthWest().lng()], [bounds.getNorthEast().lat(), bounds.getNorthEast().lng()]];
        }
        return result;
      },
      fromRegistry: function(type) {
        var reg = window.tmap_instances ? Object.values(window.tmap_instances)[0] : window;
        var shapes = reg[type + 's'];
        if (!shapes) throw new Error("Registry not found for " + type);
        return shapes['pair-shape'];
      },
      raw: function(type) {
        var stage = "create";
        var orig = this.create(type);
        var handle = orig;
        try {
          stage = "read-before";
          var before = this.read(orig, type);
          stage = "setMap-null";
          orig.setMap(null);
          stage = "read-detached";
          var detached = this.read(orig, type, before.layerId);
          stage = "setMap-map";
          orig.setMap(map);
          stage = "read-after";
          var after = this.read(orig, type);
          return {before: before, detached: detached, after: after, sameIdentity: handle === orig};
        } catch (e) {
          throw new Error(type + ":" + stage + ":" + e.message);
        } finally {
          if (orig) orig.setMap(null);
        }
      },
      old: null,
      oldId: null,
      dartBefore: function(type) {
        var s = this.fromRegistry(type);
        this.old = s;
        this.oldId = s._shape_data ? s._shape_data.layerId : null;
        return this.read(s, type, this.oldId);
      },
      dartDetached: function(type) {
        return this.read(this.old, type, this.oldId);
      },
      dartAfter: function(type) {
        var next = this.fromRegistry(type);
        return {after: this.read(next, type), sameIdentity: next === this.old};
      }
    };
  }
  return true;
})()
''';
