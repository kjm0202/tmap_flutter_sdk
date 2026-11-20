import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

class LatLng {
  constructor(lat, lng) { this.lat = () => lat; this.lng = () => lng; }
}

function build(platform) {
  const active = new Set();
  const host = { window: null, addEventListener() {}, clearTimeout,
    Tmapv3: { LatLng, extension: {} } };
  host.window = host;
  for (const type of ['DotMap', 'SquareMap', 'HeatMap']) {
    host.Tmapv3.extension[type] = class {
      constructor(options) { this.options = options; active.add(this); }
      destroy() { this.destroyCount = (this.destroyCount || 0) + 1; active.delete(this); }
    };
  }
  vm.createContext(host);
  for (const file of ['shared.js', platform === 'web' ? 'web.js' : 'mobile_overlays.js']) {
    vm.runInContext(readFileSync(new URL('../assets/bridge/' + file, import.meta.url), 'utf8'), host);
  }
  const map = { id: 'native-map' };
  const visualizations = {};
  if (platform === 'web') {
    host.tmap_instances.view = { map, visualizations, disposed: false };
  } else {
    host.map = map;
    host.visualizations = visualizations;
  }
  const add = (type, payload) => platform === 'web'
    ? host.tmap_addVisualization('view', type, payload)
    : host.addVisualization(type, payload);
  const remove = (type, id) => platform === 'web'
    ? host.tmap_removeVisualization('view', type, id)
    : host.removeVisualization(type, id);
  const clear = () => host.clearTmapVisualizations(visualizations);
  return { map, visualizations, active, add, remove, clear };
}

const point = { lat: 37.5665, lng: 126.978, value: 7 };
const data = { data: [point] };

for (const platform of ['web', 'mobile']) {
  test(`${platform} DotMap constructor options and data attached`, () => {
    const { map, active, visualizations, add, remove, clear } = build(platform);
    add('dot', { id: 'same', radius: [4, 20], range: [0, 10],
      strokeColor: '#ffffff', strokeOpacity: 0.8, fillColor: '#ff0000',
      fillOpacity: 0.5, data });
    const original = visualizations.dot.same;
    assert.ok(active.has(original));
    assert.equal(original.options.map, map);
    assert.deepEqual(Array.from(original.options.radius), [4, 20]);
    assert.deepEqual(Array.from(original.options.range), [0, 10]);
    assert.equal(original.options.strokeColor, '#ffffff');
    assert.equal(original.options.strokeOpacity, 0.8);
    assert.equal(original.options.fillColor, '#ff0000');
    assert.equal(original.options.fillOpacity, 0.5);
    assert.equal(original.options.data.data[0].value, 7);

    add('dot', { id: 'same', radius: [1, 9], range: [0, 20],
      strokeColor: '#000000', strokeOpacity: 0.2, fillColor: '#00ff00',
      fillOpacity: 0, data: {data: [{ ...point, value: 12 }] } });
    assert.equal(original.destroyCount, 1);
    assert.ok(!active.has(original));
    assert.equal(visualizations.dot.same.options.fillOpacity, 0);
    assert.equal(visualizations.dot.same.options.data.data[0].value, 12);
    remove('dot', 'same');
    assert.equal(visualizations.dot.same, undefined);
    assert.equal(active.size, 0);
    clear();
  });

  test(`${platform} SquareMap constructor options and data attached`, () => {
    const { map, active, visualizations, add, remove } = build(platform);
    add('square', { id: 'grid', origin: { latitude: 37.5, longitude: 126.9 },
      size: 250, values: [10, 20], colors: ['#ff0000', '#0000ff'],
      strokeOpacity: 0.4, fillOpacity: 0.6, data });
    const layer = visualizations.square.grid;
    assert.ok(active.has(layer));
    assert.equal(layer.options.map, map);
    assert.equal(layer.options.origin.lat(), 37.5);
    assert.equal(layer.options.origin.lng(), 126.9);
    assert.equal(layer.options.size, 250);
    assert.deepEqual(Array.from(layer.options.values), [10, 20]);
    assert.deepEqual(Array.from(layer.options.colors), ['#ff0000', '#0000ff']);
    assert.equal(layer.options.strokeOpacity, 0.4);
    assert.equal(layer.options.fillOpacity, 0.6);
    assert.equal(layer.options.data.data[0].lng, 126.978);
    remove('square', 'grid');
    assert.equal(layer.destroyCount, 1);
    assert.equal(active.size, 0);
  });

  test(`${platform} HeatMap constructor options and data attached`, () => {
    const { map, active, visualizations, add, remove, clear } = build(platform);
    add('heat', { id: 'heat', radius: 16, data: { data: [point], max: 40 } });
    const layer = visualizations.heat.heat;
    assert.ok(active.has(layer));
    assert.equal(layer.options.map, map);
    assert.equal(layer.options.radius, 16);
    assert.equal(layer.options.data.max, 40);
    assert.equal(layer.options.data.data[0].lat, 37.5665);
    add('dot', { id: 'heat', radius: [3, 12], range: [0, 10], data });
    remove('heat', 'heat');
    assert.equal(layer.destroyCount, 1);
    assert.ok(visualizations.dot.heat, 'identical IDs across types are independent');
    clear();
    assert.equal(active.size, 0);
    assert.equal(visualizations.dot.heat, undefined);
  });
}
