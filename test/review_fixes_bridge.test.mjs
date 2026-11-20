import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class LatLng {
  constructor(latitude, longitude) {
    this.latitude = latitude;
    this.longitude = longitude;
  }
  lat() { return this.latitude; }
  lng() { return this.longitude; }
}

class LatLngBounds {
  constructor(sw, ne) {
    this.southWest = sw;
    this.northEast = ne;
  }
  extend(value) {
    if (!this.southWest) this.southWest = value;
    else this.northEast = value;
  }
}

class Polygon {
  constructor(options) { this.options = options; this.map = options.map; }
  setMap(next) { this.map = next; }
  contains(point) { return point.lat() === 1 && point.lng() === 2; }
  getArea() { return {area: 123}; }
}

class GroundOverlay {
  constructor(options) { this.options = options; this.map = options.map; }
  setMap(next) { this.map = next; }
}

function makeHost(platform) {
  const host = {
    Tmapv3: {LatLng, LatLngBounds, Polygon, GroundOverlay},
    addEventListener() {},
    setTimeout, clearTimeout,
    console: {log() {}, warn() {}, error() {}},
  };
  const documentListeners = {};
  const doc = {
    listeners: documentListeners,
    addEventListener(name, cb) { (documentListeners[name] ??= []).push(cb); },
    removeEventListener(name, cb) {
      documentListeners[name] = (documentListeners[name] ?? []).filter(item => item !== cb);
    },
    getElementById() { return {offsetWidth: 400, offsetHeight: 300}; },
  };
  host.window = host;
  host.document = doc;
  class SDKMap {
    constructor(_id, options) {
      this.options = options;
      this.zoom = options.zoom ?? 16;
      this.listeners = {};
      SDKMap.created = this;
    }
    on(name, cb) { (this.listeners[name] ??= []).push(cb); }
    emit(name, event) { for (const cb of this.listeners[name] ?? []) cb(event); }
    getZoom() { return this.zoom; }
    setZoomLimit(min, max) { this.minZoom = min; this.maxZoom = max; }
    fitBounds(bounds) { this.fittedBounds = bounds; }
    realToScreen() { return {x: 10, y: 20}; }
    screenToReal(point) { return new LatLng(point.x, point.y); }
  }
  host.Tmapv3.Map = SDKMap;
  host.Tmapv3.Point = class { constructor(x, y) { this.x = x; this.y = y; } };
  host.Tmapv3.Marker = class {
    constructor(options) {
      this.options = options;
      this.position = options.position;
      const handlers = {};
      this.element = {
        handlers,
        style: {},
        addEventListener(name, cb) { handlers[name] = cb; },
        removeEventListener(name) { delete handlers[name]; },
      };
    }
    on() {}
    getPosition() { return this.position; }
    setPosition(value) { this.position = value; }
    getElement() { return this.element; }
    setMap(map) { this.options.map = map; }
  };
  vm.createContext(host);
  const filenames = platform === 'web'
    ? ['shared', 'web']
    : ['shared', 'mobile', 'mobile_overlays'];
  for (const filename of filenames) {
    vm.runInContext(
      readFileSync(new URL('../assets/bridge/' + filename + '.js', import.meta.url), 'utf8'),
      host,
      {filename: filename + '.js'},
    );
  }
  if (platform === 'web') {
    host.tmap_init('view', 'map_div', {}, {});
  } else {
    host.map = new SDKMap('map_div', {});
    host.config = {zoom: 16, hasMarkerDragCallback: true};
  }
  return {host, map: SDKMap.created, doc};
}

for (const platform of ['web', 'mobile']) {
  test(platform + ' polygon and ground overlay registries handle prototype names', () => {
    const {host, map} = makeHost(platform);
    const state = platform === 'web' ? host.tmap_instances.view : host;
    assert.equal(Object.getPrototypeOf(state.polygons), null);
    assert.equal(Object.getPrototypeOf(state.groundOverlays), null);

    const contains = id => platform === 'web'
      ? host.tmap_polygonContains('view', id, 1, 2)
      : host.polygonContains(id, 1, 2);
    const area = id => platform === 'web'
      ? host.tmap_polygonAreaJson('view', id)
      : host.polygonAreaJson(id);
    const addPolygon = id => platform === 'web'
      ? host.tmap_addPolygon('view', {id, points: [{lat: 1, lng: 2}]})
      : host.addPolygon(id, [{latitude: 1, longitude: 2}]);
    const clearPolygon = id => platform === 'web'
      ? host.tmap_clearPolygon('view', id) : host.clearPolygon(id);
    const addGround = id => platform === 'web'
      ? host.tmap_addGroundOverlay('view', {
          id, url: 'test.png', opacity: 0.5,
          bounds: {southWest: {latitude: 1, longitude: 2},
            northEast: {latitude: 3, longitude: 4}},
        })
      : host.addGroundOverlay(id, 'test.png', 1, 2, 3, 4, 0.5);
    const clearGround = id => platform === 'web'
      ? host.tmap_clearGroundOverlay('view', id) : host.clearGroundOverlay(id);

    for (const id of ['constructor', 'toString', '__proto__']) {
      assert.equal(contains(id), false);
      assert.equal(area(id), 'null');
      assert.doesNotThrow(() => clearPolygon(id));
      assert.doesNotThrow(() => clearGround(id));
      addPolygon(id);
      assert.equal(state.polygons[id].map, map);
      assert.equal(contains(id), true);
      assert.deepEqual(JSON.parse(area(id)), {area: 123});
      const polygon = state.polygons[id];
      clearPolygon(id);
      assert.equal(polygon.map, null);
      assert.equal(contains(id), false);
      assert.equal(area(id), 'null');

      addGround(id);
      const ground = state.groundOverlays[id];
      assert.equal(ground.map, map);
      clearGround(id);
      assert.equal(ground.map, null);
      assert.equal(Object.hasOwn(state.groundOverlays, id), false);
    }
  });

  test(platform + ' draggable markers report the live rounded SDK zoom', () => {
    const {host, map, doc} = makeHost(platform);
    const events = [];
    if (platform === 'web') {
      host.tmap_instances.view.callbacks.onMarkerDrag = (...args) => {
        events.push({phase: args[3], zoom: args[4]});
      };
      host.tmap_addMarker('view', {
        markerId: 'm', position: {latitude: 1, longitude: 2}, draggable: true,
      });
    } else {
      host.onMarkerDragChangeCallback = {
        postMessage(payload) { events.push(JSON.parse(payload)); },
      };
      host.addMarker({
        markerId: 'm', position: {latitude: 1, longitude: 2}, draggable: true,
      });
    }
    const marker = (platform === 'web' ? host.tmap_instances.view : host).markers.m;
    const pointer = (clientX, clientY) => ({
      pointerId: 1, clientX, clientY, button: 0,
      preventDefault() {}, stopPropagation() {},
    });
    marker.element.handlers.pointerdown(pointer(0, 0));
    map.zoom = 17.6;
    doc.listeners.pointermove[0](pointer(8, 4));
    doc.listeners.pointerup[0](pointer(8, 4));
    assert.deepEqual(events.map(e => e.phase ?? e.dragType), ['start', 'move', 'end']);
    assert.deepEqual(events.map(e => e.zoom), [18, 18, 18]);
  });
}

test('mobile TouchStart and TouchEnd are registered before callbacks are provided', () => {
  const {host} = makeHost('mobile');
  host.config = {centerLat: 37.5, centerLng: 127, zoom: 15};
  host.Tmapv3.extension = {TData: class {}};
  host.initTmap();
  const events = [];
  host.onTouchStart = {postMessage: payload => events.push(['start', JSON.parse(payload)])};
  host.onTouchEnd = {postMessage: payload => events.push(['end', JSON.parse(payload)])};
  const point = {data: {lngLat: new LatLng(37.6, 127.1)}};
  host.map.emit('TouchStart', point);
  host.map.emit('TouchEnd', point);
  assert.deepEqual(events.map(e => e[0]), ['start', 'end']);
  assert.equal(events[0][1].latitude, 37.6);
  assert.equal(events[1][1].longitude, 127.1);
});

test('web and mobile bridges support fitBounds updates after map creation', () => {
  for (const platform of ['web', 'mobile']) {
    const {host, map} = makeHost(platform);
    if (platform === 'web') host.tmap_fitBounds('view', 1, 2, 3, 4);
    else host.fitBounds(1, 2, 3, 4);
    assert.equal(map.fittedBounds.southWest.lat(), 1);
    assert.equal(map.fittedBounds.northEast.lng(), 4);
  }
});

test('mobile clear-all preserves shared registry references and detaches owned overlays', () => {
  const {host} = makeHost('mobile');
  const registries = [
    ['infoWindows', 'clearAllInfoWindows'],
    ['labels', 'clearAllLabels'],
    ['polylines', 'clearAllPolylines'],
    ['polygons', 'clearAllPolygons'],
    ['circles', 'clearAllCircles'],
    ['rectangles', 'clearAllRectangles'],
    ['customOverlays', 'clearAllCustomOverlays'],
  ];

  for (const [name, clear] of registries) {
    const registry = host[name];
    let detachCount = 0;
    registry.constructor = {setMap(value) {
      assert.equal(value, null);
      detachCount++;
    }};
    registry.toString = {setMap(value) {
      assert.equal(value, null);
      detachCount++;
    }};

    host[clear]();

    assert.strictEqual(host[name], registry, name + ' retains its reference');
    assert.deepEqual(Object.keys(registry), [], name + ' removes owned keys');
    assert.equal(detachCount, 2, name + ' detaches every overlay');
  }
});

test('Android zoom recovery uses the changed SDK limit over the initial maximum', () => {
  const {host} = makeHost('mobile');
  const sdk = {}, dom = {}, frames = [], easing = [];
  let moving = true;
  const canvas = {
    getBoundingClientRect: () => ({left: 0, top: 0}),
  };
  const camera = {
    getZoom: () => 16,
    isMoving: () => moving,
    easeTo: data => easing.push(data),
  };
  const map = {
    on(name, cb) { (sdk[name] ??= []).push(cb); },
    getZoom: () => 16,
    vsmMap: () => ({
      getCanvas: () => canvas,
      getCamera: () => camera,
      getTransform: () => ({
        getMaxZoom: () => 19,
        screenPointToLngLat: point => point,
      }),
      getInteractive: () => ({zoom: true, touch: true, doubleClick: true}),
    }),
  };
  const container = {
    addEventListener(name, cb) { (dom[name] ??= []).push(cb); },
  };
  host.navigator = {userAgent: 'Android'};
  host.requestAnimationFrame = cb => frames.push(cb);
  host.installAndroidTouchZoomRecovery(map, container, 15);
  const event = {
    target: canvas, clientX: 5, clientY: 5,
    detail: 2, button: 0, isTrusted: true,
    sourceCapabilities: {firesTouchEvents: true},
  };
  sdk.ZoomStart[0]();
  dom.mousedown[0](event);
  moving = false;
  sdk.ZoomEnd[0]();
  dom.dblclick[0](event);
  sdk.DoubleClick[0]();
  frames[0]();
  assert.equal(easing.length, 1);
  assert.equal(easing[0].zoom, 17);
});
