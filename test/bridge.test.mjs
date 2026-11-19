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

class Marker {
  constructor(options) {
    this.options = options;
    this.events = {};
  }
  setMap(map) { this.options.map = map; }
  getPosition() { return this.options.position; }
  on(event, callback) { this.events[event] = callback; }
}

function load(...files) {
  const window = {
    Tmapv3: {LatLng, Marker},
    clearTimeout,
    addEventListener: () => {}
  };
  window.window = window;
  const context = vm.createContext(window);
  for (const name of ['shared', ...files]) {
    const source = readFileSync(new URL('../assets/bridge/' + name + '.js', import.meta.url), 'utf8');
    vm.runInContext(source, context, {filename: name + '.js'});
  }
  return window;
}

test('polyline width forwards explicit zero and preserves each bridge default', () => {
  for (const platform of ['mobile', 'web']) {
    const host = load(platform === 'mobile' ? 'mobile_overlays' : 'web');
    host.Tmapv3.Polyline = class {
      constructor(options) { this.options = options; }
      setMap(map) { this.options.map = map; }
    };
    const polylines = {};
    if (platform === 'mobile') {
      host.map = {};
      host.polylines = polylines;
    } else {
      host.tmap_instances.first = {map: {}, polylines};
    }
    const add = width => platform === 'mobile'
      ? host.addPolyline('p', [], '#000', 1, width, false)
      : host.tmap_addPolyline('first', {id: 'p', points: [], ...width});
    const fallback = platform === 'mobile' ? 5 : 6;
    if (platform === 'mobile') host.addPolyline('p', [], '#000', 1);
    else host.tmap_addPolyline('first', {id: 'p', points: []});
    assert.equal(polylines.p.options.strokeWeight, fallback, `${platform}: omitted`);
    for (const [input, expected] of [[0, 0], [7, 7], [undefined, fallback], [null, fallback], [false, fallback], ['', fallback]]) {
      add(platform === 'mobile' ? input : input === undefined ? {} : {strokeWidth: input});
      assert.equal(polylines.p.options.strokeWeight, expected, `${platform}: ${input}`);
    }
  }
});

test('polygon zIndex is forwarded, including zero, and mobile omission stays omitted', () => {
  class Polygon {
    constructor(options) { this.options = options; }
    setMap(map) { this.options.map = map; }
  }
  for (const platform of ['mobile', 'web']) {
    const host = load(platform === 'mobile' ? 'mobile_overlays' : 'web');
    host.Tmapv3.Polygon = Polygon;
    const map = {};
    const polygons = {};
    if (platform === 'mobile') {
      host.map = map;
      host.polygons = polygons;
    } else {
      host.tmap_instances.first = {map, polygons};
    }
    const add = z => platform === 'mobile'
      ? host.addPolygon('p', [], '#fff', 0.4, '#000', 1, 2, z)
      : host.tmap_addPolygon('first', {id: 'p', points: [], zIndex: z});
    for (const z of [0, 5, 10, 50]) {
      const previous = polygons.p;
      add(z);
      assert.equal(polygons.p.options.zIndex, z);
      if (previous) assert.equal(previous.options.map, null);
    }
    if (platform === 'mobile') {
      host.addPolygon('p', [], '#fff', 0.4, '#000', 1, 2);
      assert.equal(Object.hasOwn(polygons.p.options, 'zIndex'), false);
    }
  }
});

test('mobile shape constructors receive zero but omit an absent zIndex', () => {
  const host = load('mobile_overlays');
  class Shape {
    constructor(options) { this.options = options; }
    setMap(map) { this.options.map = map; }
  }
  host.Tmapv3.LatLngBounds = class { extend() {} };
  host.map = {};
  for (const [name, collection, args] of [
    ['Polyline', 'polylines', ['p', [], '#000', 1, 2, false]],
    ['Circle', 'circles', ['p', 1, 2, 100, '#fff', 0.4, '#000', 1, 2]],
    ['Rectangle', 'rectangles', ['p', 1, 2, 3, 4, '#fff', 0.4, '#000', 1, 2]],
  ]) {
    host.Tmapv3[name] = Shape;
    host[collection] = {};
    host['add' + name](...args);
    assert.equal(Object.hasOwn(host[collection].p.options, 'zIndex'), false, name);
    host['add' + name](...args, 0);
    assert.equal(Object.hasOwn(host[collection].p.options, 'zIndex'), true, name);
    assert.equal(host[collection].p.options.zIndex, 0, name);
  }
});

for (const platform of ['web', 'mobile']) {
  test(platform + ' forwards camera commands and delivers taps only from the current marker', () => {
    const host = load(platform);
    const map = {
      setCenter(value) { this.center = value; },
      setZoom(value) { this.zoom = value; },
      getZoom() { return this.zoom; },
    };
    const taps = [];
    const markers = Object.create(null);
    if (platform === 'web') {
      host.tmap_instances.first = {
        map, markers, callbacks: {onMarkerTap: (...args) => taps.push(args)},
      };
      host.tmap_instances.other = {map: {}, markers: Object.create(null)};
    } else {
      host.map = map;
      host.markers = markers;
      host.config = {hasMarkerTapCallback: true};
      host.onMarkerTap = {postMessage(message) {
        const {markerId, latitude, longitude, zoom} = JSON.parse(message);
        taps.push([markerId, latitude, longitude, zoom]);
      }};
    }
    const call = (name, ...args) => platform === 'web'
      ? host['tmap_' + name]('first', ...args) : host[name](...args);

    call('setCenter', 0, 128);
    call('setZoom', 0);
    assert.equal(map.center.lat(), 0);
    assert.equal(map.center.lng(), 128);
    assert.equal(map.zoom, 0);

    const id = '__proto__';
    const marker = {markerId: id, position: {latitude: 0, longitude: 128}, zIndex: 0};
    call('addMarker', marker);
    const first = markers[id];
    first.events.click();
    call('addMarker', marker);
    assert.equal(first.options.map, null);
    first.events.click();
    const second = markers[id];
    second.events.click();
    call('clearMarker', id);
    second.events.click();
    assert.equal(second.options.map, null);
    assert.deepEqual(Object.keys(markers), []);
    assert.deepEqual(taps, [[id, 0, 128, 0], [id, 0, 128, 0]]);
    if (platform === 'web') assert.equal(host.tmap_instances.other.map.zoom, undefined);
  });
}

test('disposing a web map cancels initialization while its container is missing', () => {
  const host = load('web');
  const timers = new Set();
  host.document = {getElementById: () => null};
  host.setTimeout = callback => { timers.add(callback); return callback; };
  host.clearTimeout = callback => timers.delete(callback);
  host.tmap_init('first', 'missing', {}, {});
  assert.equal(timers.size, 1);
  host.tmap_dispose('first');
  assert.equal(timers.size, 0);
});

test('web cluster options preserve visibility and opacity and retain tap identities', () => {
  const host = load('web');
  host.Tmapv3.extension = {MarkerCluster: class {
    constructor(options) { this.options = options; }
    clearMarkers() {}
  }};
  const taps = [];
  const map = {getZoom: () => 10};
  const state = host.tmap_instances.first = {
    map, callbacks: {onMarkerClustererTap: (...args) => taps.push(args)},
  };
  const markers = [{id: 'a', lat: 1, lng: 2}, {id: 'b', lat: 1.1, lng: 2.1}];
  for (const [visible, opacity] of [[true, 1], [false, 1], [true, 0.35], [true, 0]]) {
    host.tmap_addClusterer('first', {markers, visible, opacity});
    const options = state.clusterer.options;
    assert.equal(options.visible, visible);
    assert.equal(options.opacity, opacity);
    options.onClusterClick({center: new LatLng(1, 2), markers: options.markers});
    assert.deepEqual(Array.from(taps.at(-1)[3]), ['a', 'b']);
    const count = taps.length;
    host.tmap_clearClusterer('first');
    options.onClusterClick({center: new LatLng(1, 2), markers: options.markers});
    assert.equal(taps.length, count);
  }
  host.tmap_addClusterer('first', {markers});
  assert.equal(state.clusterer.options.visible, true);
  assert.equal(state.clusterer.options.opacity, 1);
});

test('web circle retains zero and positive radii and the omitted default', () => {
  const host = load('web');
  host.Tmapv3.Circle = class {
    constructor(options) { this.options = options; }
    setMap(map) { this.options.map = map; }
  };
  const state = host.tmap_instances.first = {map: {}, circles: {}};
  for (const [input, expected] of [[0, 0], [250, 250], [undefined, 100], [null, 100]]) {
    host.tmap_addCircle('first', {id: 'c', lat: 1, lng: 2, radius: input});
    assert.equal(state.circles.c.options.radius, expected);
  }
});

test('web overlay clearing operations handle single and bulk removal safely', () => {
  const host = load('web');

  const createOverlay = () => {
    let map = 'active_map';
    return {
      setMap(m) { map = m; },
      getMap() { return map; },
    };
  };

  const v1 = {
    polygons: {
      p1: createOverlay(),
      p2: createOverlay(),
    },
    circles: {
      c1: createOverlay(),
      c2: createOverlay(),
    },
    rectangles: {
      r1: createOverlay(),
      r2: createOverlay(),
    },
  };

  const v2 = {
    polygons: {
      p1: createOverlay(),
      p3: createOverlay(),
    },
    circles: {
      c1: createOverlay(),
      c3: createOverlay(),
    },
    rectangles: {
      r1: createOverlay(),
      r3: createOverlay(),
    },
  };

  host.tmap_instances.v1 = v1;
  host.tmap_instances.v2 = v2;

  // 1. Missing views should be harmless
  assert.doesNotThrow(() => host.tmap_clearPolygon('non_existent', 'p1'));
  assert.doesNotThrow(() => host.tmap_clearAllPolygons('non_existent'));
  assert.doesNotThrow(() => host.tmap_clearCircle('non_existent', 'c1'));
  assert.doesNotThrow(() => host.tmap_clearAllCircles('non_existent'));
  assert.doesNotThrow(() => host.tmap_clearRectangle('non_existent', 'r1'));
  assert.doesNotThrow(() => host.tmap_clearAllRectangles('non_existent'));

  // 2. Missing IDs and inherited properties (e.g. toString, valueOf, __proto__) should be harmless
  assert.doesNotThrow(() => host.tmap_clearPolygon('v1', 'missing_id'));
  assert.doesNotThrow(() => host.tmap_clearPolygon('v1', 'toString'));
  assert.doesNotThrow(() => host.tmap_clearCircle('v1', 'missing_id'));
  assert.doesNotThrow(() => host.tmap_clearCircle('v1', 'toString'));
  assert.doesNotThrow(() => host.tmap_clearRectangle('v1', 'missing_id'));
  assert.doesNotThrow(() => host.tmap_clearRectangle('v1', 'toString'));

  // 3. Single clears: clearPolygon, clearCircle, clearRectangle
  const p1_v1 = v1.polygons.p1;
  const c1_v1 = v1.circles.c1;
  const r1_v1 = v1.rectangles.r1;

  host.tmap_clearPolygon('v1', 'p1');
  host.tmap_clearCircle('v1', 'c1');
  host.tmap_clearRectangle('v1', 'r1');

  // Verify detach via setMap(null) and deletion
  assert.equal(p1_v1.getMap(), null);
  assert.equal(c1_v1.getMap(), null);
  assert.equal(r1_v1.getMap(), null);
  assert.equal('p1' in v1.polygons, false);
  assert.equal('c1' in v1.circles, false);
  assert.equal('r1' in v1.rectangles, false);

  // Check same-kind siblings are intact
  assert.equal('p2' in v1.polygons, true);
  assert.equal(v1.polygons.p2.getMap(), 'active_map');
  assert.equal('c2' in v1.circles, true);
  assert.equal(v1.circles.c2.getMap(), 'active_map');
  assert.equal('r2' in v1.rectangles, true);
  assert.equal(v1.rectangles.r2.getMap(), 'active_map');

  // Check other views are intact
  assert.equal('p1' in v2.polygons, true);
  assert.equal(v2.polygons.p1.getMap(), 'active_map');
  assert.equal('c1' in v2.circles, true);
  assert.equal(v2.circles.c1.getMap(), 'active_map');
  assert.equal('r1' in v2.rectangles, true);
  assert.equal(v2.rectangles.r1.getMap(), 'active_map');

  // 4. Repeated calls should be harmless
  assert.doesNotThrow(() => host.tmap_clearPolygon('v1', 'p1'));
  assert.doesNotThrow(() => host.tmap_clearCircle('v1', 'c1'));
  assert.doesNotThrow(() => host.tmap_clearRectangle('v1', 'r1'));

  // 5. Bulk clears: clearAllPolygons, clearAllCircles, clearAllRectangles
  const p2_v1 = v1.polygons.p2;
  host.tmap_clearAllPolygons('v1');
  assert.equal(p2_v1.getMap(), null);
  assert.deepEqual(Object.keys(v1.polygons), []);
  // Other types on v1 still intact
  assert.equal('c2' in v1.circles, true);
  assert.equal('r2' in v1.rectangles, true);
  // Other views still intact
  assert.equal('p1' in v2.polygons, true);
  assert.equal('p3' in v2.polygons, true);

  // Bulk clear circles and rectangles on v1
  const c2_v1 = v1.circles.c2;
  const r2_v1 = v1.rectangles.r2;
  host.tmap_clearAllCircles('v1');
  host.tmap_clearAllRectangles('v1');
  assert.equal(c2_v1.getMap(), null);
  assert.equal(r2_v1.getMap(), null);
  assert.deepEqual(Object.keys(v1.circles), []);
  assert.deepEqual(Object.keys(v1.rectangles), []);

  // Repeated bulk calls on empty collections are harmless
  assert.doesNotThrow(() => host.tmap_clearAllPolygons('v1'));
  assert.doesNotThrow(() => host.tmap_clearAllCircles('v1'));
  assert.doesNotThrow(() => host.tmap_clearAllRectangles('v1'));

  // Check v2 is untouched after all operations on v1
  assert.equal(v2.polygons.p1.getMap(), 'active_map');
  assert.equal(v2.polygons.p3.getMap(), 'active_map');
  assert.equal(v2.circles.c1.getMap(), 'active_map');
  assert.equal(v2.circles.c3.getMap(), 'active_map');
  assert.equal(v2.rectangles.r1.getMap(), 'active_map');
  assert.equal(v2.rectangles.r3.getMap(), 'active_map');
  assert.deepEqual(Object.keys(v2.polygons), ['p1', 'p3']);
  assert.deepEqual(Object.keys(v2.circles), ['c1', 'c3']);
  assert.deepEqual(Object.keys(v2.rectangles), ['r1', 'r3']);

  // Clear v2 bulk operations
  host.tmap_clearAllPolygons('v2');
  host.tmap_clearAllCircles('v2');
  host.tmap_clearAllRectangles('v2');
  assert.deepEqual(Object.keys(v2.polygons), []);
  assert.deepEqual(Object.keys(v2.circles), []);
  assert.deepEqual(Object.keys(v2.rectangles), []);
});

test('disposing a web map calls tmapBridge.disposeControls', () => {
  const host = load('web');
  const map = { destroy: () => {} };
  host.tmap_instances.first = { map, markers: {} };
  
  let disposeControlsCalled = false;
  host.tmapBridge.disposeControls = (m) => {
    if (m === map) disposeControlsCalled = true;
  };
  
  host.tmap_dispose('first');
  assert.equal(disposeControlsCalled, true);
});

for (const platform of ['web', 'mobile']) {
  test(`${platform} cluster members forward published marker options and bind drag`, () => {
    const host = load(platform === 'web' ? 'web' : 'mobile_overlays');
    host.Tmapv3.Size = class { constructor(width, height) { Object.assign(this, {width, height}); } };
    host.Tmapv3.Point = class { constructor(x, y) { Object.assign(this, {x, y}); } };
    host.Tmapv3.extension = {MarkerCluster: class {
      constructor(options) { this.options = options; }
      clearMarkers() {}
    }};
    const map = {getZoom: () => 12};
    let state;
    if (platform === 'web') state = host.tmap_instances.first = {map, callbacks: {}};
    else { host.map = map; host.markerCluster = null; }
    const members = [
      {markerId: 'styled', position: {latitude: 1, longitude: 2},
        icon: {iconUrl: 'icon.png', size: {width: 24, height: 32}, offset: {x: 0, y: -4}},
        color: '#123456', title: 'Title', label: 'Label', labelBackgroundColor: '#abcdef',
        labelTextColor: '#123456', opacity: 0, visible: false, draggable: true, zIndex: 0, anchor: 'center'},
      {markerId: 'default', position: {latitude: 3, longitude: 4}},
      {id: 'legacy', lat: 5, lng: 6, iconHtml: '<b>legacy</b>', iconW: 12, iconH: 13, offsetX: 0, offsetY: 0},
    ];
    if (platform === 'web') host.tmap_addClusterer('first', {markers: members});
    else host.addMarkerClusterer(members, 19, 2, 80, 1, true);
    const cluster = platform === 'web' ? state.clusterer : host.markerCluster;
    const [styled, defaults, legacy] = cluster.options.markers;
    const o = styled.options;
    assert.equal(styled._customMarkerId, 'styled');
    assert.deepEqual([o.position.lat(), o.position.lng(), o.anchor, o.opacity, o.visible, o.draggable, o.zIndex], [1, 2, 'center', 0, false, false, 0]);
    assert.deepEqual([o.icon, o.iconSize.width, o.iconSize.height, o.offset.x, o.offset.y], ['icon.png', 24, 32, 0, -4]);
    assert.deepEqual([o.color, o.title, o.label, o.labelOption.backgroundColor, o.labelOption.color], ['#123456', 'Title', 'Label', '#abcdef', '#123456']);
    assert.deepEqual([defaults.options.anchor, defaults.options.opacity, defaults.options.visible, defaults.options.draggable, defaults.options.zIndex], ['bottom', 1, true, false, 100]);
    assert.deepEqual([legacy.options.iconHTML, legacy.options.iconSize.width, legacy.options.offset.x, legacy.options.offset.y], ['<b>legacy</b>', 12, 0, 0]);
    const bindings = platform === 'web' ? state.clusterDragListeners : host.clusterMarkerDragListeners;
    assert.equal(typeof bindings.styled.dispose, 'function');
    assert.equal(bindings.default, undefined);
    if (platform === 'web') host.tmap_clearClusterer('first');
    else host.clearMarkerClusterer();
    assert.equal(Object.keys(platform === 'web' ? state.clusterDragListeners : host.clusterMarkerDragListeners).length, 0);
  });
}
