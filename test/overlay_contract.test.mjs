import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class LatLng {
  constructor(lat, lng) { this.lat = () => lat; this.lng = () => lng; }
}
class Marker {
  constructor(options) { this.options = options; this.events = {}; }
  on(event, handler) { this.events[event] = handler; }
  setMap(map) { this.options.map = map; }
  getPosition() { return this.options.position; }
}
function load(platform, overlays = false) {
  const host = {window: null, Tmapv3: {LatLng, Marker}, addEventListener() {}, clearTimeout};
  host.window = host;
  const ctx = vm.createContext(host);
  for (const name of ['shared', overlays && platform === 'mobile' ? 'mobile_overlays' : platform]) {
    vm.runInContext(readFileSync(new URL(`../assets/bridge/${name}.js`, import.meta.url), 'utf8'), ctx);
  }
  host.Tmapv3.Size = class {constructor(width, height) {Object.assign(this, {width, height});}};
  host.Tmapv3.Point = class {constructor(x, y) {Object.assign(this, {x, y});}};
  return host;
}

for (const platform of ['web', 'mobile']) {
  test(`${platform} marker options and hover listener lifecycle`, () => {
    const host = load(platform);
    const map = {getZoom: () => 9};
    const hover = [];
    const markers = Object.create(null);
    if (platform === 'web') {
      host.tmap_instances.first = {map, markers, callbacks: {
        onMarkerInteraction: (...args) => hover.push(args),
      }};
    } else {
      host.map = map;
      host.markers = markers;
      host.config = {};
      host.onMarkerInteraction = {postMessage: str => {
        const o = JSON.parse(str);
        hover.push([o.markerId, o.latitude, o.longitude, o.zoom, o.event]);
      }};
    }
    const add = data => platform === 'web' ? host.tmap_addMarker('first', data) : host.addMarker(data);
    const clear = () => platform === 'web' ? host.tmap_clearMarker('first', 'm') : host.clearMarker('m');
    add({markerId: 'm', position: {latitude: 37.5, longitude: 127},
      title: 'Title', titleOption: {fontSize: '16px'},
      contextMenu: {items: ['one']}, zIndex: 0});
    const current = markers.m;
    assert.equal(current.options.titleOption.fontSize, '16px');
    assert.equal(current.options.contextMenu.items[0], 'one');
    assert.equal(current.options.zIndex, 0);
    current.events.mouseenter();
    current.events.mouseleave();
    assert.deepEqual(hover, [
      ['m', 37.5, 127, 9, 'mouseenter'],
      ['m', 37.5, 127, 9, 'mouseleave'],
    ]);
    clear();
    current.events.mouseenter();
    assert.equal(hover.length, 2, 'detached SDK marker must not emit');
  });

  test(`${platform} cluster options and events survive until cleared`, () => {
    const host = load(platform, true);
    const map = {getZoom: () => 11};
    const events = [];
    host.Tmapv3.extension = {MarkerCluster: class {
      constructor(options) {this.options = options; this.cleared = 0;}
      clearMarkers() {this.cleared++;}
      destroy() {this.destroyed = true;}
    }};
    let state;
    if (platform === 'web') {
      state = host.tmap_instances.first = {map, callbacks: {
        onClusterInteraction: (...args) => events.push(args),
      }};
    } else {
      host.map = map;
      host.markerCluster = null;
      host.onClusterInteraction = {postMessage: str => {
        const o = JSON.parse(str);
        events.push([o.latitude, o.longitude, o.zoom, o.markers, o.event]);
      }};
    }
    const members = [{markerId: 'a', position: {latitude: 37, longitude: 127}},
      {markerId: 'b', position: {latitude: 37.0001, longitude: 127.0001}}];
    const icons = [{icon: 'test.png', width: 40}];
    if (platform === 'web') {
      host.tmap_addClusterer('first', {markers: members, icons, zIndex: 0,
        gridSize: 42, minClusterCount: 2, maxClusterZoom: 15, opacity: 0.3, visible: false});
    } else {
      host.addMarkerClusterer(members, 15, 2, 42, 0.3, false, icons, 0);
    }
    const cluster = platform === 'web' ? state.clusterer : host.markerCluster;
    assert.equal(cluster.options.gridSize, 42);
    assert.equal(cluster.options.maxClusterZoom, 15);
    assert.equal(cluster.options.minClusterCount, 2);
    assert.equal(cluster.options.opacity, 0.3);
    assert.equal(cluster.options.visible, false);
    assert.equal(cluster.options.zIndex, 0);
    assert.equal(cluster.options.icons[0].width, 40);
    const group = {center: new LatLng(37, 127), markers: cluster.options.markers};
    cluster.options.onClusterMouseEnter(group);
    cluster.options.onClusterMouseLeave(group);
    assert.deepEqual(events.map(e => [e[0], e[1], e[2], Array.from(e[3]), e[4]]), [
      [37, 127, 11, ['a', 'b'], 'mouseenter'],
      [37, 127, 11, ['a', 'b'], 'mouseleave'],
    ]);
    if (platform === 'web') host.tmap_clearClusterMarkers('first');
    else host.clearClusterMarkers();
    assert.equal(cluster.cleared, 1);
    assert.equal(platform === 'web' ? state.clusterer : host.markerCluster, cluster,
      'clear members must retain clusterer');
    cluster.options.onClusterMouseEnter(group);
    assert.equal(events.length, 2, 'old cluster callback cannot emit after clearing members');
    assert.ok(group.markers.every(m => m.options.map === null));
  });

  test(`${platform} InfoWindow anchor and Label zoom range reach SDK constructors`, () => {
    const host = load(platform, true);
    class Overlay {
      constructor(options) {this.options = options;}
      setMap(map) {this.options.map = map;}
      getPosition() {return this.options.position;}
      getContent() {return this.options.content;}
    }
    host.Tmapv3.InfoWindow = Overlay;
    host.Tmapv3.Label = Overlay;
    let registry;
    if (platform === 'web') {
      registry = host.tmap_instances.first = {map: {}, infoWindows: {}, labels: {}, callbacks: {}};
    } else {
      host.map = {};
      registry = host;
      host.infoWindows = {};
      host.labels = {};
    }
    if (platform === 'web') {
      host.tmap_addInfoWindow('first', {id: 'i', lat: 37, lng: 127,
        content: 'hello', anchor: 'top', visible: true});
      host.tmap_addLabel('first', {id: 'l', lat: 38, lng: 128,
        content: 'text', fontSize: '15px', minLevel: 3, maxLevel: 12});
    } else {
      host.addInfoWindow('i', 37, 127, 'hello', 2, null, null, null, 'top', true);
      host.addLabel('l', 38, 128, 'text', '15px', '#123456', 3, 12);
    }
    assert.equal(registry.infoWindows.i.options.anchor, 'top');
    assert.equal(registry.infoWindows.i.getPosition().lat(), 37);
    assert.equal(registry.infoWindows.i.getContent(), 'hello');
    assert.equal(registry.labels.l.getPosition().lat(), 38);
    assert.equal(registry.labels.l.options.minLevel, 3);
    assert.equal(registry.labels.l.options.maxLevel, 12);
  });
}
