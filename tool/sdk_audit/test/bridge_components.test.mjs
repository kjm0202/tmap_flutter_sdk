import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {probeBridges} from '../bridge_probe.mjs';
import {probeExtensions} from '../extension_probe.mjs';
import {probeDrawingPointers} from '../drawing_pointer_probe.mjs';

const asset = name => readFileSync(new URL('../../../assets/bridge/'+name+'.js',import.meta.url),'utf8');

test('shipped web and mobile asset orders expose shared dependencies in their real scopes', () => {
  class LatLng { constructor(lat,lng){this.lat=()=>lat;this.lng=()=>lng;} }
  class Marker {constructor(options){this.options=options;} on(){} getPosition(){return this.options.position;} getMap(){return this.options.map;} setMap(m){this.options.map=m;} }
  const host={Tmapv3:{LatLng,Marker},addEventListener(){},clearTimeout,console}; host.window=host;
  const context=vm.createContext(host);
  vm.runInContext('(function(){\n'+asset('shared')+'\n'+asset('web')+'\n})();',context);
  vm.runInContext('const config={hasMarkerTapCallback:false,hasMarkerDragCallback:false};\n'+['shared','mobile','mobile_overlays','mobile_tdata'].map(asset).join('\n'),context);
  const map={setCenter(p){this.center=p;},setZoom(z){this.zoom=z;}};
  host.tmap_instances.test={map,markers:Object.create(null),callbacks:{}};
  host.tmap_setCenter('test',1,2); assert.equal(map.center.lat(),1);
  host.map=map; host.setZoom(7); assert.equal(map.zoom,7);
  host.addMarker({markerId:'m',position:{latitude:1,longitude:2}});
  const marker=host.markers.m; assert.equal(marker.getPosition().lng(),2);
  host.clearMarker('m'); assert.equal(marker.getMap(),null);
  assert.equal(typeof host.tmap_getZoom,'undefined');
  assert.equal(typeof host.getZoomData,'undefined');
  assert.equal(typeof host.createTmapMarkerEventManager,'undefined');
});

test('bridge operations independently distinguish unavailable wrappers, exceptions and differences and clean up', async () => {
  const map={getZoom:()=>14,getMinZoom:()=>0,getMaxZoom:()=>19,getPitch:()=>0,getBearing:()=>0,
    getCenter:()=>({lat:()=>37.5665,lng:()=>126.978}),realToScreen:()=>({getX:()=>1,getY:()=>2}),
    screenSize:()=>({getWidth:()=>640,getHeight:()=>480}),_data:{vsmOptions:{}}};
  let disposed=false, removed=false;
  const host={__auditMap:map,tmap_instances:{},markers:{},setTimeout,clearTimeout,
    document:{createElement(){return {style:{},appendChild(){},remove(){removed=true;}};},body:{appendChild(){}}},
    Tmapv3:{LatLng:class {},extension:{MarkerCluster:class {}}}}; host.window=host;
  host.tmap_init=(id,container,opts,callbacks)=>{host.tmap_instances[id]={map,markers:{}};callbacks.onMapCreated();};
  host.tmap_toggleTraffic=id=>{host.tmap_instances[id].map.__tmapTrafficEnabled=false;};
  host.tmap_addClusterer=id=>{host.tmap_instances[id].clusterer=new host.Tmapv3.extension.MarkerCluster();};
  host.tmap_clearClusterer=id=>{host.tmap_instances[id].clusterer=null;};
  host.tmap_getMinZoom=()=>{throw Error('real failure');};
  host.tmap_getMaxZoom=()=>123;
  host.tmap_dispose=id=>{disposed=true;delete host.tmap_instances[id];};
  host.realToScreen=()=>'{"x":1,"y":2}';
  const context=vm.createContext(host);
  const rows=await vm.runInContext('('+probeBridges.toString()+')()',context);
  const row=id=>rows.find(x=>x.id===id);
  assert.equal(row('web.getZoom').status,'unresolved-unavailable-wrapper');
  assert.equal(row('web.getZoom').expected,14);
  assert.equal(row('web.getMinZoom').status,'unresolved-exception');
  assert.equal(row('web.getMinZoom').error,'real failure');
  assert.equal(row('web.getMaxZoom').status,'difference');
  assert.equal(row('mobile-helper.getZoom').status,'unresolved-unavailable-wrapper');
  assert.equal(row('mobile-helper.realToScreen').status,'sample-match');
  for (const id of ['web.traffic.disable','web.cluster.create','web.cluster.clear']) assert.equal(row(id).status,'sample-match',id);
  assert.equal(row('web.destroy').status,'sample-match');
  assert.equal(disposed,true); assert.equal(removed,true);
  assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
  assert.ok(rows.every(x=>x.contract && x.environment));
});

test('missing extension dispatcher remains unresolved and direct SDK readouts survive', async () => {
  class TData {getAutoCompleteSearchV2Json(){} getPOIDataFromIdJson(){} getPOIDataFromLonLatJson(){}}
  let destroyed=false;
  class MarkerCluster {setOpacity(){} setZIndex(){} destroy(){destroyed=true;}}
  const host={Tmapv3:{extension:{TData,MarkerCluster}},__auditMap:{}};host.window=host;
  const rows=await vm.runInContext('('+probeExtensions.toString()+')()',vm.createContext(host));
  assert.equal(rows.find(x=>x.id==='MarkerCluster.documented-style-methods').status,'official-match');
  const absent=rows.find(x=>x.id==='MarkerCluster.generic-adapter');
  assert.equal(absent.status,'unresolved-unavailable-wrapper');
  assert.equal(absent.contract,'Tmapv3.extension.MarkerCluster');
  assert.equal(rows.find(x=>x.id==='Circle.generic-adapter').contract,'Tmapv3.shape.Circle');
  assert.match(absent.scope,/direct public bridge paths/);
  assert.equal(destroyed,true);
});


test('generic handler availability restores historical drawing and map comparisons', async () => {
  const calls=[];
  const map={screenSize:()=>({getWidth:()=>800,getHeight:()=>600}),__flutterExtensions:{}};
  const host={__auditMap:map, Tmapv3:{extension:{}}, structuredClone, setTimeout, clearTimeout};
  host.window=host;
  host.__auditExtension=(map,kind,op,opts)=>{
    calls.push([kind,op]);
    if(kind==='Map') return JSON.stringify(op==='screenSize'?{width:800,height:600}:{supported:false});
    if(kind==='Drawing') {
      if(op==='create') map.__flutterExtensions.Drawing={_status:{drawOptions:opts,drawType:0}};
      const drawing=map.__flutterExtensions.Drawing;
      const types={drawCircle:1,drawRectangle:2,drawPolyline:3,drawPolygon:4};
      if(types[op]) {drawing._status.drawType=types[op]; map.isDrawing=true;}
      if(op==='cancel') map.isDrawing=false;
      return JSON.stringify({value:op==='isFinish'?!map.isDrawing:[]});
    }
    return '{}';
  };
  const rows=await vm.runInContext('('+probeExtensions.toString()+')()',vm.createContext(host));
  assert.ok(calls.some(([k,o])=>k==='Drawing'&&o==='drawPolygon'));
  assert.equal(rows.find(x=>x.id==='Map.screenSize').status,'sample-match');
  assert.equal(rows.find(x=>x.id==='Drawing.drawCircle').status,'sample-match');
  assert.equal(rows.find(x=>x.id==='Drawing.drawPolygon.cancel').status,'sample-match');
  assert.equal(rows.find(x=>x.id==='Drawing.clear').status,'sample-match');
  assert.equal(rows.some(x=>x.id==='Drawing.generic-adapter'),false);
});

test('direct traffic and cluster paths are assessed separately on each lane', async () => {
  const map={__tmapTrafficEnabled:true};
  class MarkerCluster {}
  const host={__auditMap:map,markerCluster:null,markers:{},setTimeout,clearTimeout,
    Tmapv3:{extension:{MarkerCluster}}, toggleTraffic:()=>{map.__tmapTrafficEnabled=false;},
    addMarkerClusterer:()=>{host.markerCluster=new MarkerCluster();},clearMarkerClusterer:()=>{host.markerCluster=null;}};
  host.window=host;
  const rows=await vm.runInContext('('+probeBridges.toString()+')({lane:"mobile"})',vm.createContext(host));
  for(const id of ['mobile-helper.traffic.disable','mobile-helper.cluster.create','mobile-helper.cluster.clear'])
    assert.equal(rows.find(x=>x.id===id).status,'sample-match',id);
  assert.equal(rows.some(x=>x.id.startsWith('web.')),false);
  delete host.toggleTraffic; host.addMarkerClusterer=()=>{};
  const absent=await vm.runInContext('('+probeBridges.toString()+')({lane:"mobile"})',vm.createContext(host));
  assert.equal(absent.find(x=>x.id==='mobile-helper.traffic.disable').status,'unresolved-unavailable-wrapper');
  assert.equal(absent.find(x=>x.id==='mobile-helper.cluster.create').status,'difference');
});

test('camera helper checks the complete special-number transport packet', async () => {
  const host={__auditMap:{getZoom:()=>-0},getZoomData:()=>JSON.stringify({zoom:{special:'-0'},__tmapCameraNumberTag:true})};host.window=host;
  const rows=await vm.runInContext('('+probeBridges.toString()+')({lane:"mobile"})',vm.createContext(host));
  assert.equal(rows.find(x=>x.id==='mobile-helper.getZoom').status,'sample-match');
});


test('real-pointer driver runs every historical mode only with an adapter', async () => {
  const operations=[], mouse=[];
  const page={
    evaluate: async (fn,arg)=>{
      if(arg) {operations.push(arg); return arg.startsWith('draw')?undefined:{count:1,finished:true,shapes:[{}]};}
      operations.push('clear');
    },
    mouse:{move:async(...args)=>mouse.push(['move',...args]),down:async()=>mouse.push(['down']),
      up:async()=>mouse.push(['up']),click:async(...args)=>mouse.push(['click',...args])},
    waitForTimeout:async()=>{},
  };
  const missing=await probeDrawingPointers(page,false);
  assert.equal(missing[0].status,'unresolved-unavailable-wrapper');
  assert.equal(operations.length,0);
  let calls=0;
  page.evaluate=async(fn,arg)=>{
    if(!arg){operations.push('clear');return;}
    calls++; operations.push(arg);
    if(calls%2===0) return {count:1,finished:true,shapes:[{}]};
  };
  const rows=await probeDrawingPointers(page,true);
  assert.deepEqual(rows.map(x=>x.id),['Circle','Rectangle','Polyline','Polygon'].map(x=>'Drawing.pointer.'+x));
  assert.ok(rows.every(x=>x.status==='sample-match'));
  assert.equal(operations.filter(x=>x==='clear').length,4);
  assert.equal(mouse.filter(x=>x[0]==='down').length,2);
  assert.equal(mouse.filter(x=>x[0]==='click').length,8);
});

test('mobile classic scripts keep globals in an isolated realm', () => {
  const outer={window:null,addEventListener(){},console};outer.window=outer;
  const web=vm.createContext(outer);
  vm.runInContext('(function(){\n'+asset('shared')+'\n'+asset('web')+'\n})();',web);
  vm.runInContext('const config = {name:"existing"}; const tmapBridge = "untouched";',web);
  const inner={window:null,addEventListener(){},console};inner.window=inner;
  const mobile=vm.createContext(inner);
  vm.runInContext('const config={hasMarkerTapCallback:false,hasMarkerDragCallback:false};\n'+['shared','mobile','mobile_overlays','mobile_tdata'].map(asset).join('\n'),mobile);
  assert.equal(vm.runInContext('config.name+":"+tmapBridge',web),'existing:untouched');
  assert.equal(typeof outer.tmap_init,'function');
  assert.equal(typeof inner.toggleTraffic,'function');
  assert.equal(typeof inner.addMarkerClusterer,'function');
  assert.equal(typeof outer.toggleTraffic,'undefined');
});

test('official observations remain distinct and run with and without generic dispatch', async () => {
  class TData {getAutoCompleteSearchV2Json(){} getPOIDataFromIdJson(){} getPOIDataFromLonLatJson(){}}
  class LatLng {constructor(lat,lng){this.lat=()=>lat;this.lng=()=>lng;}}
  class Marker {
    constructor(){this._marker_data={vsmMarkerOption:{offset:{x:-2,y:3}}};}
    getOffset(){return null;} setMap(){}
  }
  class MarkerCluster {
    constructor({markers}){this._cluster_data={clusterMarkers:markers.length?[{}]:[]};}
    setOpacity(){throw Error('t.setOpacity is not a function');} setZIndex(){} destroy(){}
  }
  class InfoWindow {setVisible(){throw Error('this.getElement is not a function');} setMap(){}}
  const map={getCenter:()=>new LatLng(37,127),screenSize:()=>({getWidth:()=>800,getHeight:()=>600})};
  const host={__auditMap:map,Tmapv3:{extension:{TData,MarkerCluster},LatLng,Marker,InfoWindow,Point:class{},Size:class{}},
    setTimeout:fn=>fn(),structuredClone};host.window=host;
  const run=()=>vm.runInContext('('+probeExtensions.toString()+')()',vm.createContext(host));
  for(const present of [false,true]) {
    if(present) host.__auditExtension=(map,kind,op)=>JSON.stringify(kind==='Map'&&op==='screenSize'?{width:800,height:600}:{supported:false});
    const rows=await run();
    for(const id of ['TData.runtimeV2.available','Marker.upstreamOffsetGetter','MarkerCluster.activeCluster','MarkerCluster.upstreamOpacityDefect','InfoWindow.setVisible.upstreamDefect']) {
      const row=rows.find(x=>x.id===id);
      assert.equal(row?.environment,'chrome-official-sdk-readout',id);
      assert.equal(row.status,'official-match',id);
    }
    if(present) assert.equal(rows.find(x=>x.id==='Map.toggleTraffic.generic-adapter').status,'unresolved-unavailable-wrapper');
  }
});

test('legacy marker option parity remains reachable without the old event manager', async () => {
  class LatLng {constructor(lat,lng){this.lat=()=>lat;this.lng=()=>lng;}}
  class Point {constructor(x,y){this.x=x;this.y=y;}}
  class Size {constructor(w,h){this.getWidth=()=>w;this.getHeight=()=>h;}}
  class Marker {
    constructor(options){this.options={...options};this._marker_data={options:this.options,vsmMarkerOption:{offset:options.offset?{x:options.offset.x,y:options.offset.y}:null},vsmMarker:{getElement:()=>this.element}};this.element={};}
    setOptions(options){Object.assign(this.options,options);if(options.offset)this._marker_data.vsmMarkerOption.offset={x:options.offset.x,y:options.offset.y};}
    getPosition(){return this.options.position;} getIconSize(){return this.options.iconSize;} getZIndex(){return this.options.zIndex;}
    getOffset(){return null;} setMap(){}
  }
  const map={screenSize:()=>({getWidth:()=>800,getHeight:()=>600})};
  const host={__auditMap:map,Tmapv3:{LatLng,Point,Size,Marker,extension:{}},structuredClone,setTimeout:fn=>fn()};host.window=host;
  host.__auditExtension=(map,kind,op,opts,ctx)=>{
    if(kind==='Map') return JSON.stringify(op==='screenSize'?{width:800,height:600}:{supported:false});
    if(kind==='Marker' && op==='setOptions') {
      const options={...opts.options};
      if(options.map==='other') throw Error('map must be boolean');
      if(options.position) options.position=new LatLng(options.position.latitude,options.position.longitude);
      if(options.iconSize) options.iconSize=new Size(options.iconSize.width,options.iconSize.height);
      if(options.offset) options.offset=new Point(options.offset.x,options.offset.y);
      ctx.markers.test.setOptions(options);
    }
    return '{}';
  };
  const rows=await vm.runInContext('('+probeExtensions.toString()+')()',vm.createContext(host));
  for(const id of ['Marker.setOptions.nativeParity','Marker.setOptions.identity','Marker.setOptions.zeroSemantics','Marker.setOptions.invalidMap'])
    assert.equal(rows.find(x=>x.id===id)?.status,'sample-match',id);
  assert.equal(rows.find(x=>x.id==='Marker.managedEventManager.registration').status,'unresolved-unavailable-wrapper');
});

test('camera and resize probes reject no-op wrappers on both lanes and measure asynchronous SDK transitions', async () => {
  for (const lane of ['web','mobile']) for (const noOp of [false,true]) {
    class LatLng {constructor(lat,lng){this.lat=()=>lat;this.lng=()=>lng;}}
    const element=()=>({style:{width:'800px',height:'600px'},appendChild(){},remove(){},
      getBoundingClientRect(){return {width:parseInt(this.style.width),height:parseInt(this.style.height)};}});
    const mapHost=element(); let center=new LatLng(37.5665,126.978), zoom=14, size=[800,600];
    const map={getCenter:()=>center,getZoom:()=>zoom,
      setCenter:p=>queueMicrotask(()=>{center=p;}),setZoom:z=>queueMicrotask(()=>{zoom=z;}),
      screenSize:()=>({getWidth:()=>size[0],getHeight:()=>size[1]}),
      resize:()=>{const rect=mapHost.getBoundingClientRect(); queueMicrotask(()=>{size=[rect.width,rect.height];});},
      _data:{vsmOptions:{}}};
    const host={__auditMap:map,__auditMapHost:mapHost,tmap_instances:{},markers:{},
      Tmapv3:{LatLng,extension:{MarkerCluster:class{}}},
      setTimeout:(fn,ms)=>{if(ms<1000) queueMicrotask(fn);return 1;},clearTimeout(){},
      document:{createElement:()=>mapHost,body:{appendChild(){}}}}; host.window=host;
    host.tmap_init=(id,container,options,callbacks)=>{host.tmap_instances[id]={map,markers:{}};callbacks.onMapCreated();};
    host.tmap_dispose=id=>delete host.tmap_instances[id];
    host.tmap_setCenter=(id,lat,lng)=>{if(!noOp) map.setCenter(new LatLng(lat,lng));};
    host.tmap_setZoom=(id,z)=>{if(!noOp) map.setZoom(z);};
    host.tmap_relayout=()=>{if(!noOp) map.resize();};
    host.setCenter=(lat,lng)=>{if(!noOp) map.setCenter(new LatLng(lat,lng));};
    host.setZoom=z=>{if(!noOp) map.setZoom(z);};
    host.relayout=()=>{if(!noOp) map.resize();};
    const rows=await vm.runInContext('('+probeBridges.toString()+')({lane:'+JSON.stringify(lane)+'})',vm.createContext(host));
    const prefix=lane==='web'?'web':'mobile-helper';
    for(const suffix of ['setCenter','setZoom','layout.resize']) {
      const row=rows.find(x=>x.id===prefix+'.'+suffix);
      assert.equal(row.status,noOp?'difference':'sample-match',row.id);
      assert.equal(row.comparison,'direct-sdk-reference',row.id);
      assert.notDeepEqual(row.precondition,row.expected,row.id);
    }
  }
});

test('resize reports unmeasured when host or direct SDK calibration is unavailable', async () => {
  const host={__auditMap:{screenSize:()=>({getWidth:()=>800,getHeight:()=>600}),resize(){}},relayout(){}};host.window=host;
  const rows=await vm.runInContext('('+probeBridges.toString()+')({lane:"mobile"})',vm.createContext(host));
  const row=rows.find(x=>x.id==='mobile-helper.layout.resize');
  assert.equal(row.status,'unresolved-unmeasured');
  assert.match(row.error,/host/);
});

test('registry and wrapper-only observations describe their limited facets', async () => {
  const map={}; class MarkerCluster {}
  const host={__auditMap:map,markers:{},Tmapv3:{extension:{MarkerCluster}},
    toggleTraffic:()=>{map.__tmapTrafficEnabled=false;},
    addMarkerClusterer:()=>{host.markerCluster=new MarkerCluster();},clearMarkerClusterer:()=>{host.markerCluster=null;}};
  host.window=host;
  const rows=await vm.runInContext('('+probeBridges.toString()+')({lane:"mobile"})',vm.createContext(host));
  const traffic=rows.find(x=>x.id==='mobile-helper.traffic.disable');
  const clear=rows.find(x=>x.id==='mobile-helper.cluster.clear');
  assert.match(traffic.scope,/Wrapper-owned/);
  assert.match(clear.scope,/Registry reference removal only/);
  host.toggleTraffic=()=>{};
  const noOp=await vm.runInContext('('+probeBridges.toString()+')({lane:"mobile"})',vm.createContext(host));
  assert.equal(noOp.find(x=>x.id==='mobile-helper.traffic.disable').status,'difference');
  assert.doesNotMatch(clear.contract,/clearMarkers/);
  assert.ok(rows.every(x=>x.comparison));
});
