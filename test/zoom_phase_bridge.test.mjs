import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class LatLng {
  constructor(lat, lng) {
    this.lat = () => lat;
    this.lng = () => lng;
  }
}

function makeZoomBridge(platform) {
  const events = [];

  class SDKMap {
    constructor(_containerId, options) {
      this.zoom = options.zoom ?? 16;
      this.listeners = {};
      SDKMap.created = this;
    }
    on(name, callback) { (this.listeners[name] ??= []).push(callback); }
    emit(name) { for (const callback of this.listeners[name] ?? []) callback(); }
    getZoom() { return this.zoom; }
  }

  const host = {
    Tmapv3: {Map: SDKMap, LatLng, extension: {TData: class {}}},
    config: {centerLat: 37.5, centerLng: 127, zoom: 16, hasOnZoomChangeCallback: true},
    navigator: {userAgent: 'iPhone'},
    document: {getElementById: () => ({offsetWidth: 400, offsetHeight: 300})},
    addEventListener() {},
    setTimeout, clearTimeout,
    console: {log() {}, warn() {}, error() {}},
  };
  host.window = host;
  vm.createContext(host);
  for (const filename of ['shared', platform]) {
    const source = readFileSync(
      new URL(`../assets/bridge/${filename}.js`, import.meta.url), 'utf8',
    );
    vm.runInContext(source, host, {filename: `${filename}.js`});
  }
  if (platform === 'mobile') {
    host.zoomChanged = {
      postMessage(message) { events.push(JSON.parse(message)); },
    };
    host.initTmap();
  } else {
    host.tmap_init('view', 'map_div', {zoom: 16}, {
      onZoomChange(zoomLevel, phase) { events.push({zoomLevel, phase}); },
    });
  }
  return {map: SDKMap.created, events};
}

for (const platform of ['mobile', 'web']) {
  test(`${platform} reports zoom start and end without gesture intermediates`, () => {
    const {map, events} = makeZoomBridge(platform);
    map.emit('ZoomStart');
    assert.deepEqual(events, [{zoomLevel: 16, phase: 'start'}]);

    map.zoom = 16.4;
    map.emit('Zoom');
    map.zoom = 16.8;
    map.emit('Zoom');
    assert.deepEqual(events, [{zoomLevel: 16, phase: 'start'}]);

    map.zoom = 17;
    map.emit('ZoomEnd');
    assert.deepEqual(events, [
      {zoomLevel: 16, phase: 'start'},
      {zoomLevel: 17, phase: 'end'},
    ]);

    map.zoom = 18.2;
    map.emit('Zoom');
    assert.deepEqual(events, [
      {zoomLevel: 16, phase: 'start'},
      {zoomLevel: 17, phase: 'end'},
      {zoomLevel: 18, phase: 'end'},
    ]);
    assert.ok(events.every(({phase}) => phase === 'start' || phase === 'end'));
    assert.ok(events.every(event => !Object.hasOwn(event, 'zoomType')));
  });
}
