import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class LatLng {
  constructor(lat, lng) { this.latitude = lat; this.longitude = lng; }
  lat() { return this.latitude; }
  lng() { return this.longitude; }
}
class LatLngBounds {
  constructor(sw, ne) { this.sw = sw; this.ne = ne; }
  getSouthWest() { return this.sw; }
  getNorthEast() { return this.ne; }
}

function load(platform) {
  const host = {
    Tmapv3: { LatLng, LatLngBounds },
    clearTimeout, setTimeout, addEventListener() {},
  };
  host.window = host;
  vm.createContext(host);
  for (const file of ['shared.js', platform === 'web' ? 'web.js' : 'mobile_overlays.js']) {
    vm.runInContext(
      readFileSync(new URL('../assets/bridge/' + file, import.meta.url), 'utf8'),
      host,
      { filename: file },
    );
  }
  return host;
}

function setup(platform) {
  const host = load(platform);
  const handlers = new Map();
  const map = {
    on(name, callback) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(callback);
    },
    off(name, callback) {
      handlers.set(name, (handlers.get(name) || []).filter(fn => fn !== callback));
    },
    emit(name) { for (const callback of handlers.get(name) || []) callback({}); },
    vsmMap() { return { getInteractive: () => ({ drag: true, wheel: true }) }; },
    setInteractive(value) { this.interactive = value; },
  };
  const overlays = {};
  const completed = [];
  if (platform === 'web') {
    host.tmap_instances.view = {
      map, groundOverlays: overlays, polygons: {}, drawingSession: null,
      callbacks: { onDrawingComplete: value => completed.push(JSON.parse(value)) },
    };
  } else {
    host.map = map;
    host.groundOverlays = overlays;
    host.polygons = {};
    host.drawingSession = null;
    host.onDrawingComplete = { postMessage: value => completed.push(JSON.parse(value)) };
  }
  return { host, map, overlays, completed, handlers, web: platform === 'web' };
}

for (const platform of ['web', 'mobile']) {
  test(platform + ' GroundOverlay forwards bounds, url and opacity and detaches replacements', () => {
    const { host, map, overlays, web } = setup(platform);
    class GroundOverlay {
      constructor(options) { this.options = options; this.map = options.map; }
      setMap(next) { this.map = next; }
    }
    host.Tmapv3.GroundOverlay = GroundOverlay;
    const bounds = {
      southWest: { latitude: 37.5, longitude: 126.9 },
      northEast: { latitude: 37.6, longitude: 127 },
    };
    const add = (opacity, url) => web
      ? host.tmap_addGroundOverlay('view', { id: 'a', bounds, opacity, url })
      : host.addGroundOverlay('a', url, 37.5, 126.9, 37.6, 127, opacity);
    add(0, 'data:image/png;base64,first');
    assert.equal(overlays.a.options.map, map);
    assert.equal(overlays.a.options.opacity, 0);
    assert.equal(overlays.a.options.url, 'data:image/png;base64,first');
    assert.equal(overlays.a.options.bounds.getSouthWest().lat(), 37.5);
    assert.equal(overlays.a.options.bounds.getNorthEast().lng(), 127);
    const original = overlays.a;
    add(0.35, 'data:image/png;base64,second');
    assert.equal(original.map, null);
    assert.equal(overlays.a.options.opacity, 0.35);
    if (web) host.tmap_clearAllGroundOverlays('view');
    else host.clearAllGroundOverlays();
    assert.equal(overlays.a, undefined);
  });

  test(platform + ' Polygon contains and area are forwarded to native SDK objects', () => {
    const { host, web } = setup(platform);
    const shape = {
      contains(p) { return p.lat() === 37.56 && p.lng() === 126.98; },
      getArea() { return { pathArea: '12,345', outerPathArea: ['45'] }; },
    };
    if (web) host.tmap_instances.view.polygons.p = shape;
    else host.polygons.p = shape;
    const contains = (lat, lng) => web
      ? host.tmap_polygonContains('view', 'p', lat, lng)
      : host.polygonContains('p', lat, lng);
    const area = () => web ? host.tmap_polygonAreaJson('view', 'p') : host.polygonAreaJson('p');
    assert.equal(contains(37.56, 126.98), true);
    assert.equal(contains(37.55, 126.98), false);
    assert.deepEqual(JSON.parse(area()), { pathArea: '12,345', outerPathArea: ['45'] });
    assert.equal(web ? host.tmap_polygonAreaJson('view', 'absent') : host.polygonAreaJson('absent'), 'null');
  });

  test(platform + ' Polygon creation prepares projected vertices for the SDK contains method', () => {
    const { host, map, web } = setup(platform);
    class ProjectedLatLng extends LatLng {
      toEPSG3857() { return { x: this.longitude, y: this.latitude }; }
    }
    host.Tmapv3.LatLng = ProjectedLatLng;
    host.Tmapv3.Polygon = class {
      constructor(options) {
        this._shape_data = { path: options.paths };
        this.map = options.map;
      }
      setMap(next) { this.map = next; }
      contains(point) {
        return (this._shape_data.pathE7 || []).some(
          p => p.x === point.lng() && p.y === point.lat(),
        );
      }
    };
    const points = [
      { latitude: 37.5, longitude: 126.9 },
      { latitude: 37.6, longitude: 127.0 },
      { latitude: 37.7, longitude: 127.1 },
    ];
    if (web) host.tmap_addPolygon('view', {
      id: 'p',
      points: points.map(p => ({ lat: p.latitude, lng: p.longitude })),
    });
    else host.addPolygon('p', points, '#fff', 0.4, '#000', 1, 2);
    const polygon = web ? host.tmap_instances.view.polygons.p : host.polygons.p;
    assert.equal(polygon.map, map);
    assert.equal(polygon.contains(new ProjectedLatLng(37.6, 127)), true);
    assert.equal(polygon.contains(new ProjectedLatLng(37.8, 127)), false);
    assert.equal(polygon._shape_data.pathE7.length, 3);
  });

  test(platform + ' Drawing reuses one native listener set, reports typed geometry and clears', async () => {
    const { host, map, completed, handlers, web } = setup(platform);
    class NativeDrawing {
      constructor(options) {
        this._status = { isDrawing: false, drawOptions: { ...options } };
        this._data = { shapeArray: [] };
        for (const event of ['Click', 'MouseDown', 'MouseUp', 'MouseMove', 'ContextMenu']) {
          map.on(event, () => {});
        }
      }
      isFinish() { return !this._status.isDrawing; }
      getShapes() { return this._data.shapeArray; }
      drawCircle() { this._status.isDrawing = true; }
      drawRectangle() { this._status.isDrawing = true; }
      drawPolyline() { this._status.isDrawing = true; }
      drawPolygon() { this._status.isDrawing = true; }
      cancel() { this._status.isDrawing = false; }
      clear() { this._data.shapeArray = []; }
      finish(shape, event) {
        this._data.shapeArray.push(shape);
        this._status.isDrawing = false;
        map.emit(event);
      }
    }
    host.Tmapv3.extension = { Drawing: NativeDrawing };
    const start = (mode, style) => web
      ? host.tmap_startDrawing('view', mode, style)
      : host.startDrawing(mode, style);
    const native = () => (web ? host.tmap_instances.view.drawingSession : host.drawingSession).nativeDrawing();

    start('Circle', { fillColor: '#123456', fillOpacity: 0, strokeWeight: 0 });
    assert.equal((handlers.get('MouseUp') || []).length, 2);
    assert.equal(native()._status.drawOptions.fillOpacity, 0);
    native().finish({ getPath: () => ({ center: new LatLng(37.56, 126.98), radius: 250 }) }, 'MouseUp');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(completed.length, 1);
    assert.equal(completed[0].type, 'circle');
    assert.equal(completed[0].radius, 250);
    assert.deepEqual(completed[0].center, { latitude: 37.56, longitude: 126.98 });

    start('Rectangle', { fillColor: '#ff0000', strokeWeight: 4 });
    assert.equal((handlers.get('MouseUp') || []).length, 2);
    assert.equal(native()._status.drawOptions.strokeWeight, 4);
    native().finish({ getPath: () => ({
      _sw: new LatLng(37.5, 126.9), _ne: new LatLng(37.6, 127),
    }) }, 'MouseUp');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(completed[1].type, 'rectangle');
    assert.equal(completed[1].bounds.northEast.latitude, 37.6);

    for (const type of ['Polyline', 'Polygon']) {
      start(type, { strokeColor: '#ff00ff' });
      native().finish({
        getPath: () => ({ path: [
          new LatLng(37.5, 126.9), new LatLng(37.6, 127), new LatLng(37.7, 127.1),
        ] }),
      }, 'ContextMenu');
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(completed.at(-1).type, type.toLowerCase());
      assert.equal(completed.at(-1).points.length, 3);
    }
    assert.equal(completed.length, 4);
    if (web) host.tmap_clearDrawings('view');
    else host.clearDrawings();
    assert.equal(native().getShapes().length, 0);
    start('Circle', {});
    if (web) host.tmap_clearDrawings('view');
    else host.clearDrawings();
    native().finish({ getPath: () => ({ center: new LatLng(1, 2), radius: 3 }) }, 'MouseUp');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(completed.length, 4, 'cleared drawing must not emit a stale completion');
  });
}
