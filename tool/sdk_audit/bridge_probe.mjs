// Chrome component observations of shipped JS, not native runtime evidence.
export async function probeBridges({lane = 'all'} = {}) {
  const rows = [];
  const coords = p => ({latitude: p.lat(), longitude: p.lng()});
  const observe = async (id, contract, environment, wrapper, action, expected, comparison = 'expected-literal', scope) => {
    const row = {id, contract, environment, wrapper, comparison};
    if (scope) row.scope = scope;
    try {
      // Preserve the official SDK readout even when the adaptation is absent.
      if (typeof window[wrapper] !== 'function') {
        row.status = 'unresolved-unavailable-wrapper';
        try { if (expected) row.expected = await expected(); }
        catch (e) { row.expectedError = String(e?.message ?? e); }
      } else {
        if (expected) row.expected = await expected();
        row.actual = await action(window[wrapper]);
        row.status = JSON.stringify(row.actual) === JSON.stringify(row.expected)
          ? 'sample-match' : 'difference';
      }
    } catch (e) {
      row.status = e?.unmeasured ? 'unresolved-unmeasured' : 'unresolved-exception';
      row.error = String(e?.message ?? e);
    }
    rows.push(row);
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 30));
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const unmeasured = message => { const e = new Error(message); e.unmeasured = true; throw e; };
  const waitUntil = async (read, predicate) => {
    let value;
    for (let i=0; i<40; i++) { value=read(); if (predicate(value)) return value; await pause(); }
    return value;
  };
  const requireStable = async (read, before, message) => {
    for (let i=0; i<7; i++) { await pause(); if (!same(read(),before)) unmeasured(message); }
  };
  const camera = async (id, contract, environment, wrapper, map, prefix, center) => {
    let m;
    const read=center ? () => coords(m.getCenter()) : () => m.getZoom();
    const target=center ? [37.568,126.979] : [14];
    const baseline=center ? [37.565,126.977] : [13];
    const set=input => center ? m.setCenter(new Tmapv3.LatLng(...input)) : m.setZoom(input[0]);
    const near=(value,input) => center
      ? Math.abs(value.latitude-input[0])<0.00001 && Math.abs(value.longitude-input[1])<0.00001
      : value===input[0];
    let reference, before;
    await observe(id,contract,environment,wrapper,async fn => {
      fn(...prefix,...target);
      return waitUntil(read, value => same(value,reference));
    },async () => {
      m=map();
      set(target);
      reference=await waitUntil(read, value => near(value,target));
      if (!near(reference,target)) unmeasured('Direct SDK target state was not observed');
      set(baseline);
      before=await waitUntil(read, value => near(value,baseline));
      if (!near(before,baseline) || same(before,reference)) unmeasured('Distinct SDK precondition was not observed');
      return reference;
    },'direct-sdk-reference','Direct SDK setter and readout on the same target, after a distinct observed precondition.');
    const row=rows[rows.length-1]; row.input=target; if (before !== undefined) row.precondition=before;
  };
  const resize = async (id, environment, wrapper, map, host, prefix) => {
    let before, reference;
    await observe(id,'Tmapv3.Map#resize',environment,wrapper,async fn => {
      const m=map(), element=host();
      const read=()=>{const size=m.screenSize();return [size.getWidth(),size.getHeight()];};
      const original={width:element.style.width,height:element.style.height};
      const setHost=(width,height)=>{element.style.width=width; element.style.height=height;};
      const target=[640,480];
      try {
        setHost('640px','480px');
        const rect=element.getBoundingClientRect();
        if (Math.abs(rect.width-target[0])>1 || Math.abs(rect.height-target[1])>1)
          unmeasured('Map host did not attain requested dimensions');
        await requireStable(read,before,'SDK viewport changed before direct resize');
        m.resize();
        reference=await waitUntil(read, value => same(value,target));
        if (!same(reference,target)) unmeasured('Direct SDK resize did not attain requested dimensions');
        setHost(original.width,original.height);
        m.resize();
        const restored=await waitUntil(read, value => same(value,before));
        if (!same(restored,before)) unmeasured('Distinct SDK viewport could not be restored');
        setHost('640px','480px');
        await requireStable(read,before,'SDK viewport changed before the wrapper call');
        fn(...prefix);
        return await waitUntil(read, value => same(value,reference));
      } finally {
        setHost(original.width,original.height);
        m.resize();
      }
    },()=>{
      const m=map(), element=host();
      if (!element?.getBoundingClientRect || !element.style || typeof m.resize!=='function')
        unmeasured('Actual map host or direct SDK resize is unavailable');
      const size=m.screenSize(); before=[size.getWidth(),size.getHeight()];
      if (same(before,[640,480])) unmeasured('Initial SDK viewport already equals resize target');
      return [640,480];
    },'direct-sdk-reference','Host and SDK screenSize calibration use direct resize on the same dimensions; wrapper result is compared with that reference.');
    const row=rows[rows.length-1];
    if (before) row.precondition=before;
    if (reference) row.expected=reference;
  };
  const web = 'chrome-web-bridge', mobile = 'chrome-mobile-js-helper';
  if (lane !== 'mobile') {
  const host = document.createElement('div');
  host.id = 'bridge-map';
  host.style.cssText = 'width:800px;height:600px';
  const parent = document.createElement('div');
  parent.style.cssText = 'width:800px;height:600px';
  parent.appendChild(host); document.body.appendChild(parent);
  let state, map;
  try {
    await observe('web.init', 'Tmapv3.Map#constructor', web, 'tmap_init', async fn => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Web bridge ConfigLoad timeout')), 25000);
        fn('audit-port', 'bridge-map', {center:[37.5665,126.978],zoom:14,minPitch:10,maxPitch:50,
          bounds:{southWest:{latitude:37.56,longitude:126.97},northEast:{latitude:37.57,longitude:126.99}},
          maxBounds:{southWest:{latitude:32,longitude:124},northEast:{latitude:40,longitude:132}}}, {
          onMapCreated: () => { clearTimeout(timer); resolve(); },
          onInitError: () => { clearTimeout(timer); reject(new Error('Web bridge initialization failed')); },
        });
      });
      state = window.tmap_instances['audit-port']; map = state.map;
      return !!map;
    }, () => true);
    const needWebMap = () => { if (!map) throw new Error('Web map initialization unavailable'); return map; };
    for (const [option, expected] of Object.entries({minPitch:10,maxPitch:50,bounds:[[126.97,37.57],[126.99,37.56]],maxBounds:[[124,40],[132,32]]})) {
      await observe('web.initial.'+option, 'Tmapv3.Map#constructor:'+option, web, 'tmap_init',
        () => needWebMap()._data.vsmOptions[option], () => expected);
    }
    for (const method of ['getZoom','getMinZoom','getMaxZoom','getPitch','getBearing','getCenter']) {
      await observe('web.'+method, 'Tmapv3.Map#'+method, web, 'tmap_'+method,
        fn => { const value=fn('audit-port'); return method==='getCenter' ? JSON.parse(value) : value; },
        () => {const value=needWebMap()[method](); return method==='getCenter' ? coords(value) : value;},'direct-sdk-reference');
    }
    await camera('web.setCenter','Tmapv3.Map#setCenter',web,'tmap_setCenter',needWebMap,['audit-port'],true);
    await camera('web.setZoom','Tmapv3.Map#setZoom',web,'tmap_setZoom',needWebMap,['audit-port'],false);
    await observe('web.realToScreen', 'Tmapv3.Map#realToScreen', web, 'tmap_realToScreen',
      fn => JSON.parse(fn('audit-port',37.567,126.979)), () => {
        const p=needWebMap().realToScreen(new Tmapv3.LatLng(37.567,126.979)); return {x:p.getX(),y:p.getY()};
      },'direct-sdk-reference');
    await resize('web.layout.resize',web,'tmap_relayout',needWebMap,()=>host,['audit-port']);
    await observe('web.marker.position', 'Tmapv3.mapobject.Marker#constructor:position', web, 'tmap_addMarker', fn => {
      needWebMap(); fn('audit-port',{markerId:'audit-marker',position:{latitude:37.5665,longitude:126.978},visible:true,zIndex:100});
      return coords(state.markers['audit-marker'].getPosition());
    }, () => ({latitude:37.5665,longitude:126.978}));
    await observe('web.marker.remove', 'Tmapv3.mapobject.Marker#setMap', web, 'tmap_clearMarker', fn => {
      needWebMap(); const marker=state.markers['audit-marker'];
      if (!marker) throw new Error('Marker fixture unavailable');
      fn('audit-port','audit-marker'); return {registered:Object.hasOwn(state.markers,'audit-marker'),map:marker.getMap()===null};
    }, () => ({registered:false,map:true}));
    await observe('web.traffic.disable','Tmapv3.Map',web,'tmap_toggleTraffic',fn=>{
      const m=needWebMap(); m.__tmapTrafficEnabled=true;
      fn('audit-port',false); return m.__tmapTrafficEnabled;
    },()=>false,'expected-literal','Wrapper-owned __tmapTrafficEnabled property after a seeded true precondition; no SDK traffic layer is measured.');
    await observe('web.cluster.create','Tmapv3.extension.MarkerCluster',web,'tmap_addClusterer',fn=>{
      needWebMap(); fn('audit-port',{markers:[]}); return state.clusterer instanceof Tmapv3.extension.MarkerCluster;
    },()=>true);
    await observe('web.cluster.clear','bridge cluster registry',web,'tmap_clearClusterer',fn=>{
      needWebMap(); if(!state.clusterer) throw new Error('Cluster fixture unavailable');
      fn('audit-port'); return state.clusterer == null;
    },()=>true,'expected-literal','Registry reference removal only; SDK cluster member or layer effects are not measured.');
  } finally {
    await observe('web.destroy', 'bridge map registry', web, 'tmap_dispose', fn => {
      if (!window.tmap_instances?.['audit-port']) throw new Error('Map registry fixture unavailable');
      fn('audit-port'); return !!window.tmap_instances?.['audit-port'];
    }, () => false,'expected-literal','Registry reference removal only; SDK destruction is not measured.');
    parent.remove();
  }
  }
  if (lane !== 'web') {
  const previousMap=window.map;
  window.map=window.__auditMap;
  try {
    const needMap=()=>{if(!window.map) throw new Error('Mobile helper map fixture unavailable'); return window.map;};
    for (const method of ['getZoom','getMinZoom','getMaxZoom','getPitch','getBearing','getCenter']) {
      const wrapper=method+'Data';
      await observe('mobile-helper.'+method, 'Tmapv3.Map#'+method, mobile, wrapper,
        fn=>JSON.parse(fn()), () => {
          const value=needMap()[method]();
          if(method==='getCenter') return coords(value);
          const key=method[3].toLowerCase()+method.slice(4);
          const special=typeof value!=='number'?null:Number.isNaN(value)?'NaN':value===Infinity?'Infinity':value===-Infinity?'-Infinity':Object.is(value,-0)?'-0':null;
          return special===null?{[key]:value}:{[key]:{special},__tmapCameraNumberTag:true};
        },'direct-sdk-reference');
    }
    await camera('mobile-helper.setCenter','Tmapv3.Map#setCenter',mobile,'setCenter',needMap,[],true);
    await camera('mobile-helper.setZoom','Tmapv3.Map#setZoom',mobile,'setZoom',needMap,[],false);
    await resize('mobile-helper.layout.resize',mobile,'relayout',needMap,()=>window.__auditMapHost,[]);
    await observe('mobile-helper.marker.position','Tmapv3.mapobject.Marker#constructor:position',mobile,'addMarker',fn=>{
      needMap(); fn({markerId:'audit-mobile-marker',position:{latitude:37.5665,longitude:126.978},visible:true,zIndex:100});
      return coords(window.markers['audit-mobile-marker'].getPosition());
    },()=>({latitude:37.5665,longitude:126.978}));
    await observe('mobile-helper.marker.remove','Tmapv3.mapobject.Marker#setMap',mobile,'clearMarker',fn=>{
      const marker=window.markers['audit-mobile-marker']; if(!marker) throw new Error('Marker fixture unavailable');
      fn('audit-mobile-marker'); return {registered:Object.hasOwn(window.markers,'audit-mobile-marker'),map:marker.getMap()===null};
    },()=>({registered:false,map:true}));
    await observe('mobile-helper.traffic.disable','Tmapv3.Map',mobile,'toggleTraffic',fn=>{
      const m=needMap(); m.__tmapTrafficEnabled=true;
      fn(false); return m.__tmapTrafficEnabled;
    },()=>false,'expected-literal','Wrapper-owned __tmapTrafficEnabled property after a seeded true precondition; no SDK traffic layer is measured.');
    await observe('mobile-helper.cluster.create','Tmapv3.extension.MarkerCluster',mobile,'addMarkerClusterer',fn=>{
      needMap(); fn([],18,2,60,1,true,[]); return window.markerCluster instanceof Tmapv3.extension.MarkerCluster;
    },()=>true);
    await observe('mobile-helper.cluster.clear','bridge cluster registry',mobile,'clearMarkerClusterer',fn=>{
      if(!window.markerCluster) throw new Error('Cluster fixture unavailable');
      fn(); return window.markerCluster == null;
    },()=>true,'expected-literal','Registry reference removal only; SDK cluster member or layer effects are not measured.');
    await observe('mobile-helper.realToScreen','Tmapv3.Map#realToScreen',mobile,'realToScreen',
      fn=>JSON.parse(fn(37.567,126.979)),()=>{const p=needMap().realToScreen(new Tmapv3.LatLng(37.567,126.979));return {x:p.getX(),y:p.getY()};},'direct-sdk-reference');
  } finally {
    if (window.markers?.['audit-mobile-marker'] && typeof window.clearMarker === 'function') {
      try { window.clearMarker('audit-mobile-marker'); } catch (e) { rows.push({id:'mobile-helper.marker.cleanup',contract:'Tmapv3.mapobject.Marker#setMap',environment:mobile,status:'unresolved-exception',error:String(e?.message ?? e)}); }
    }
    if (window.markerCluster && typeof window.clearMarkerClusterer === 'function') {
      try { window.clearMarkerClusterer(); } catch (e) { rows.push({id:'mobile-helper.cluster.cleanup',contract:'Tmapv3.extension.MarkerCluster',environment:mobile,status:'unresolved-exception',error:String(e?.message ?? e)}); }
    }
    window.map=previousMap;
  }
  }
  for (const row of rows) row.comparison ??= 'unmeasured';
  return rows;
}
