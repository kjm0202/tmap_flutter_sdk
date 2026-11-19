import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../example/test_driver/bridge/cluster_members_scenario.dart', import.meta.url), 'utf8');
function literal(name) {
  const match = source.match(new RegExp(`const ${name} =\\s*'''([\\s\\S]*?)''';`));
  assert.ok(match, `missing ${name}`);
  return match[1].replaceAll('\\\\', '\\').replaceAll('\\$', '$');
}
const cluster = '(window.tmap_instances ? Object.values(window.tmap_instances)[0]?.clusterer : (typeof markerCluster !== "undefined" ? markerCluster : null))';
const observation = literal('_observation').replaceAll('$_cluster', cluster);
const expr = name => literal(name).replaceAll('$_observation', observation);
const pos = (lat, lng) => ({lat: () => lat, lng: () => lng});
function fixture(width = 320, height = 600, worldScale = 512) {
  const pixelsPerDegree = worldScale * 4096 / 360;
  const map = {
    getZoom: () => 12,
    getBounds: () => ({getSouthWest: () => pos(37, 126), getNorthEast: () => pos(38, 128)}),
    screenSize: () => ({getWidth: () => width, getHeight: () => height}),
    realToScreen: p => ({getX: () => width / 2 + (p.lng() - 126.987) * pixelsPerDegree, getY: () => height / 2 - (p.lat() - 37.5665) * pixelsPerDegree / Math.cos(37.5665 * Math.PI / 180)}),
  };
  function marker(id, lng, attached, label = false, lat = 37.5665) {
    const el = {isConnected: true, textContent: label ? 'Member label' : '', querySelector: () => label ? {} : null,
      getBoundingClientRect: () => ({width:24,height:32,left:100,top:100,right:124,bottom:132})};
    return {_customMarkerId:id, getPosition: () => pos(lat,lng), getMap: () => attached ? map : null,
      _marker_data:{vsmMarker:{getElement: () => el}}, el};
  }
  const members = [marker('member-revealed',126.978,false,true), marker('member-default',126.97805,false),
    marker('member-isolated',126.996,true,true), marker('member-zero',126.987,false,false,37.5745)];
  const group = marker('group',126.978,true);
  group.el.textContent = '2';
  const state = {clusterer:{_cluster_data:{markers:members,clusterMarkers:[group]}}, clusterDragListeners:{'member-isolated':{}}};
  const context = {window:{tmap_instances:{one:state}}, map, innerWidth:width,innerHeight:height,
    getComputedStyle: node => node.css ?? ({display:'block',visibility:'visible',opacity:'0.4'})};
  const run = code => vm.runInNewContext(code, context);
  return {run, members, group, map, state};
}

test('finite observation and separate viewport and membership checks', () => {
  const f = fixture();
  assert.equal(f.run(expr('_viewportCheck')), true);
  assert.equal(f.run(expr('_membershipCheck')), true);
  const o = JSON.parse(JSON.stringify(f.run(observation)));
  assert.deepEqual(o.members.map(m => m.id), ['member-revealed','member-default','member-isolated','member-zero']);
  assert.equal(o.members[2].dragBinding, true);
  assert.equal(o.groups[0].count, 2);
  assert.doesNotMatch(JSON.stringify(o), /<|https?:|data:|Member label/);
  assert.ok(JSON.stringify(o).length < 1600);
  f.members[2].el.parentElement = {css:{display:'block',visibility:'visible',opacity:'0'}};
  assert.equal(f.run(expr('_membershipCheck')), false);
  f.members[2].el.parentElement = null;
  f.members[2].el.isConnected = false;
  assert.equal(f.run(expr('_membershipCheck')), false);
  assert.equal(f.run(expr('_viewportCheck')), true);
});

test('hidden member joining, offscreen marker, and unprojectable data fail', () => {
  const f = fixture();
  f.group.el.textContent = '3';
  assert.equal(f.run(expr('_membershipCheck')), false);
  f.map.realToScreen = p => ({getX: () => p.lng() === 126.996 ? 330 : 160, getY: () => 300});
  assert.equal(f.run(expr('_viewportCheck')), false);
  f.map.realToScreen = () => ({getX: () => Infinity, getY: () => NaN});
  assert.equal(f.run(expr('_viewportCheck')), false);
  assert.deepEqual(JSON.parse(JSON.stringify(f.run(observation))).members[2].xy, [null,null]);
});

// Actual live sizes are checked at runtime. These representative viewports
// cover portrait and desktop plus both common world scales without devices.
test('shared inputs fit representative viewports and clear the 30px grid', () => {
  for (const [width, height] of [[320,568], [393,852], [1280,720]]) {
    for (const scale of [256,512]) {
      assert.equal(fixture(width, height, scale).run(expr('_viewportCheck')), true, `${width}x${height}, scale ${scale}`);
    }
  }
});

test('missing cluster and failed projection remain bounded and inspectable', () => {
  const f = fixture();
  f.state.clusterer = null;
  f.map.getBounds = () => { throw new Error('sensitive error'); };
  const o = JSON.parse(JSON.stringify(f.run(observation)));
  assert.equal(o.bounds, null);
  assert.equal(o.memberCount, 0);
  assert.equal(o.members[2].present, false);
  assert.equal(f.run(expr('_membershipCheck')), false);
  assert.doesNotMatch(JSON.stringify(o), /sensitive/);
});
