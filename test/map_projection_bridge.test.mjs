import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class LatLng {
  constructor(latitude, longitude) {
    this.lat = () => latitude;
    this.lng = () => longitude;
  }
}

class Point {
  constructor(x, y) {
    this.getX = () => x;
    this.getY = () => y;
  }
}

class Projection {
  static convertBesselGEOToWGS84GEO(value) { return new LatLng(value.lat() + 0.1, value.lng() - 0.2); }
  static convertBesselTMToWGS84GEO(value) { return new LatLng(value.getX() / 1e4, value.getY() / 1e4); }
  static convertWGS84GEOToBesselGEO(value) { return new LatLng(value.lat() - 0.1, value.lng() + 0.2); }
  static convertWGS84GEOToBesselTM(value) { return new Point(value.lat() * 100, value.lng() * 100); }
  static convertWGS84GEOToKatec(value) { return new Point(value.lat() * 200, value.lng() * 200); }
}

function setup(platform) {
  const host = {Tmapv3: {LatLng, Point, Projection}, addEventListener() {}};
  host.window = host;
  const context = vm.createContext(host);
  for (const name of ['shared', platform]) {
    const script = readFileSync(new URL('../assets/bridge/' + name + '.js', import.meta.url), 'utf8');
    vm.runInContext(script, context, {filename: name + '.js'});
  }
  const map = {
    getCenter: () => new LatLng(37.5665, 126.978),
    getBounds: () => ({getSouthWest: () => new LatLng(37.55, 126.96),
      getNorthEast: () => new LatLng(37.58, 127.01)}),
    getZoom: () => 14.5,
    getMinZoom: () => map.minZoom ?? 3,
    getMaxZoom: () => map.maxZoom ?? 18,
    getBearing: () => 23,
    getPitch: () => 34,
    screenSize: () => ({_width: 850, _height: 480}),
    realToScreen: c => new Point(c.lat() * 2, c.lng() * 3),
    screenToReal: p => new LatLng(p.getX() / 2, p.getY() / 3),
    setZoomLimit(min, max) { this.minZoom = min; this.maxZoom = max; },
  };
  if (platform === 'web') host.tmap_instances.first = {map};
  else host.map = map;
  const read = (name, args = {}) => JSON.parse(platform === 'web'
    ? host.tmap_readMapData('first', name, args)
    : host.readMapData(name, args));
  const setZoomLimit = (min, max) => platform === 'web'
    ? host.tmap_setZoomLimit('first', min, max) : host.setZoomLimit(min, max);
  const project = (name, args) => JSON.parse(platform === 'web'
    ? host.tmap_convertProjection('first', name, args)
    : host.convertProjection(name, args));
  return {read, setZoomLimit, project, map};
}

for (const platform of ['web', 'mobile']) {
  test(`${platform} map readback preserves coordinates, sizes and limits`, () => {
    const bridge = setup(platform);
    assert.deepEqual(bridge.read('getCenter'), {latitude: 37.5665, longitude: 126.978});
    assert.deepEqual(bridge.read('getBounds'), {
      southWest: {latitude: 37.55, longitude: 126.96},
      northEast: {latitude: 37.58, longitude: 127.01},
    });
    assert.equal(bridge.read('getZoom').value, 14.5);
    assert.equal(bridge.read('getBearing').value, 23);
    assert.equal(bridge.read('getPitch').value, 34);
    assert.deepEqual(bridge.read('screenSize'), {width: 850, height: 480});
    assert.deepEqual(bridge.read('realToScreen', {latitude: 10, longitude: 20}), {x: 20, y: 60});
    assert.deepEqual(bridge.read('screenToReal', {x: 20, y: 60}), {latitude: 10, longitude: 20});
    bridge.setZoomLimit(8, 15);
    assert.equal(bridge.read('getMinZoom').value, 8);
    assert.equal(bridge.read('getMaxZoom').value, 15);
    assert.throws(() => bridge.read('destroy'), /Unsupported Map read/);
  });

  test(`${platform} Bessel and KATEC projection pass correct SDK coordinate types`, () => {
    const bridge = setup(platform);
    const wgs = {latitude: 37.5665, longitude: 126.978};
    const katec = bridge.project('convertWGS84GEOToKatec', wgs);
    assert.ok(Math.abs(katec.x - 7513.3) < 1e-10);
    assert.ok(Math.abs(katec.y - 25395.6) < 1e-10);
    const tm = bridge.project('convertWGS84GEOToBesselTM', wgs);
    assert.ok(Math.abs(tm.x - 3756.65) < 1e-10);
    assert.ok(Math.abs(tm.y - 12697.8) < 1e-10);
    const bessel = bridge.project('convertBesselGEOToWGS84GEO', wgs);
    assert.ok(Math.abs(bessel.latitude - 37.6665) < 1e-10);
    assert.ok(Math.abs(bessel.longitude - 126.778) < 1e-10);
    assert.deepEqual(bridge.project('convertBesselTMToWGS84GEO', {x: 200000, y: 500000}),
      {latitude: 20, longitude: 50});
    assert.throws(() => bridge.project('unknown', wgs), /Unsupported projection conversion/);
  });
}

test('mobile map constructor forwards bounds and pitch limits; SDK gestures reach channels', () => {
  class LatLngBounds {
    constructor(southWest, northEast) {
      this.southWest = southWest;
      this.northEast = northEast;
    }
  }
  class SDKMap {
    constructor(_containerId, options) {
      this.options = options;
      this.listeners = {};
      this.operations = [];
      SDKMap.created = this;
    }
    on(name, callback) { (this.listeners[name] ??= []).push(callback); }
    emit(name, data) { for (const callback of this.listeners[name] ?? []) callback(data); }
    setZoomLimit(min, max) { this.minZoom = min; this.maxZoom = max; }
    setInteractive(options) { this.interactive = options; }
    vsmMap() { return {getInteractive: () => ({touch: true})}; }
    fitBounds(bounds) { this.operations.push('fitBounds'); this.fittedBounds = bounds; }
    getZoom() { return this.options.zoom; }
  }

  const messages = {created: [], start: [], end: [], context: []};
  const postTo = key => ({postMessage(message) { messages[key].push(message); }});
  const host = {
    Tmapv3: {Map: SDKMap, LatLng, Point, Projection, LatLngBounds,
      extension: {TData: class {}}},
    config: {
      centerLat: 37.5665, centerLng: 126.978, zoom: 15,
      minZoom: 3, maxZoom: 18, minPitch: 5, maxPitch: 50,
      bounds: {southWest: {latitude: 37.55, longitude: 126.96},
        northEast: {latitude: 37.58, longitude: 126.99}},
      maxBounds: {southWest: {latitude: 37.4, longitude: 126.7},
        northEast: {latitude: 37.8, longitude: 127.3}},
      hasOnTouchStart: true, hasOnTouchEnd: true, hasOnMapLongTap: true,
    },
    navigator: {userAgent: 'iPhone'},
    document: {getElementById: () => ({})},
    onMapCreated: {postMessage(message) {
      SDKMap.created.operations.push('ready');
      messages.created.push(message);
    }},
    onTouchStart: postTo('start'),
    onTouchEnd: postTo('end'),
    onMapLongTap: postTo('context'),
    addEventListener() {},
  };
  host.window = host;
  const context = vm.createContext(host);
  for (const filename of ['shared', 'mobile']) {
    const script = readFileSync(new URL(`../assets/bridge/${filename}.js`, import.meta.url), 'utf8');
    vm.runInContext(script, context, {filename: `${filename}.js`});
  }
  host.initTmap();

  const map = SDKMap.created;
  assert.equal(map.options.minPitch, 5);
  assert.equal(map.options.maxPitch, 50);
  assert.ok(map.options.bounds instanceof LatLngBounds);
  assert.ok(map.options.maxBounds instanceof LatLngBounds);
  assert.equal(map.options.bounds.southWest.lat(), 37.55);
  assert.equal(map.options.maxBounds.northEast.lng(), 127.3);

  map.emit('ConfigLoad');
  assert.deepEqual(map.operations, ['fitBounds', 'ready']);
  assert.equal(messages.created.length, 1);
  assert.ok(map.fittedBounds instanceof LatLngBounds);
  assert.equal(map.fittedBounds.northEast.lng(), 126.99);

  const event = {data: {lngLat: new LatLng(37.57, 126.98)}};
  map.emit('TouchStart', event);
  map.emit('TouchEnd', event);
  map.emit('ContextMenu', event);
  for (const key of ['start', 'end', 'context']) {
    assert.equal(messages[key].length, 1);
    const coordinate = JSON.parse(messages[key][0]);
    assert.equal(coordinate.latitude, 37.57);
    assert.equal(coordinate.longitude, 126.98);
  }
});
