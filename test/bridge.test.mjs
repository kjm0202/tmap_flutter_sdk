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
  const window = {Tmapv3: {LatLng, Marker}, clearTimeout};
  window.window = window;
  const context = vm.createContext(window);
  for (const name of ['shared', ...files]) {
    const source = readFileSync(new URL('../assets/bridge/' + name + '.js', import.meta.url), 'utf8');
    vm.runInContext(source, context, {filename: name + '.js'});
  }
  return window;
}

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
