// Optional historical generic-adapter comparisons and independent official SDK readouts.
export async function probeExtensions() {
  const map = window.__auditMap, invoke = window.__auditExtension;
  const rows = [];
  const namespace = kind => ['Circle','Rectangle','Polyline','Polygon','GroundOverlay'].includes(kind)
    ? 'Tmapv3.shape.'+kind : ['Marker','InfoWindow','Label'].includes(kind)
    ? 'Tmapv3.mapobject.'+kind : kind==='Map' ? 'Tmapv3.Map' : 'Tmapv3.extension.'+kind;
  const contractFor = id => {
    const [kind, operation] = id.split('.');
    const mapped = {detach:'setMap',reattach:'setMap',position:'setPosition',pathSnapshot:kind==='Circle'?'getCenter':'getBounds',
      mutation:kind==='Circle'?'setCenter':null,visible:'setVisible',styleOptions:'setOpacity',eventSnapshot:'on',
      callback:'setContent',documentedV3:'getAutoCompleteSearchv3Json',runtimeV2:'getAutoCompleteSearchV2Json',
      autoTraffic:'autoTraffic',upstreamOffsetGetter:'getOffset',upstreamOpacityDefect:'setOpacity'};
    const known = new Set(['screenSize','setOptions','on','off','getContextMenu','setContent','setAnchor','setOffset',
      'setBackground','setVisible','setCenter','setRadius','setPath','getArea','setBounds','setColorOptions',
      'addMarker','removeMarker','clearMarkers','drawCircle','drawRectangle','drawPolyline','drawPolygon',
      'getShapes','getCircles','getRectangles','getPolylines','getPolygons','clear','destroy']);
    const method=Object.hasOwn(mapped,operation)?mapped[operation]:known.has(operation)?operation:null;
    return namespace(kind) + (method ? '#'+method : '');
  };
  const check = (id, actual, expected, official=false) => rows.push({id, contract:contractFor(id),
    environment:official?'chrome-official-sdk-readout':'chrome-extension-bridge',
    comparison:official?'official-sdk-vs-expected-literal':(id==='Map.screenSize' || /\.nativeParity$/.test(id) || /\.(?:flatParity|balloonParity|zeroSemantics)$/.test(id) || /^(?:DotMap|SquareMap)\.options$/.test(id) ? 'direct-sdk-reference' : 'expected-literal'),
    status:JSON.stringify(actual)===JSON.stringify(expected)?(official?'official-match':'sample-match'):(official?'official-difference':'difference'),actual,expected});
  const fail = (id, e) => rows.push({id,contract:contractFor(id),environment:'chrome-official-sdk-readout',status:'unresolved-exception',error:String(e?.message ?? e)});
  try {
    const dataInstance=new Tmapv3.extension.TData();
    check('TData.documentedV3.absent',typeof dataInstance.getAutoCompleteSearchv3Json,'undefined',true);
    check('TData.runtimeV2.available',typeof dataInstance.getAutoCompleteSearchV2Json,'function',true);
    check('TData.poiHeadingTypos.absent',[typeof dataInstance.getPOIDataFromIdson,typeof dataInstance.getPOIDataFromLonLatson],['undefined','undefined'],true);
    check('TData.poiJsonMethods.available',[typeof dataInstance.getPOIDataFromIdJson,typeof dataInstance.getPOIDataFromLonLatJson],['function','function'],true);
    check('TData.autoTraffic.absent',typeof Tmapv3.extension.TData.prototype.autoTraffic,'undefined',true);
  } catch(e) { fail('TData.readout',e); }
  let officialInfo;
  try {
    officialInfo=new Tmapv3.InfoWindow({map,position:new Tmapv3.LatLng(37.5665,126.978),content:'test',type:2});
    let error=null; try {officialInfo.setVisible(false);} catch(e) {error=e.message;}
    check('InfoWindow.setVisible.upstreamDefect',error,'this.getElement is not a function',true);
  } catch(e) {fail('InfoWindow.readout',e);}
  finally {try {officialInfo?.setMap(null);} catch(e) {fail('InfoWindow.readout.cleanup',e);}}
  let officialMarker, officialCluster, active, nearby=[];
  try {
    officialMarker=new Tmapv3.Marker({map,position:new Tmapv3.LatLng(37.5665,126.978),offset:new Tmapv3.Point(-2,3),iconSize:new Tmapv3.Size(20,30)});
    check('Marker.upstreamOffsetGetter',officialMarker.getOffset(),null,true);
    check('Marker.renderedOffset',officialMarker._marker_data.vsmMarkerOption.offset,{x:-2,y:3},true);
  } catch(e) { fail('Marker.readout',e); }
  finally { try {officialMarker?.setMap(null);} catch(e) {fail('Marker.readout.cleanup',e);} }
  try {
    officialCluster=new Tmapv3.extension.MarkerCluster({map,markers:[]});
    check('MarkerCluster.documented-style-methods',[typeof officialCluster.setOpacity,typeof officialCluster.setZIndex],['function','function'],true);
  } catch(e) { fail('MarkerCluster.readout',e); }
  finally { try {officialCluster?.destroy();} catch(e) {fail('MarkerCluster.readout.cleanup',e);} }
  try {
    nearby=[0,0.00001].map(d=>new Tmapv3.Marker({position:new Tmapv3.LatLng(map.getCenter().lat()+d,map.getCenter().lng())}));
    active=new Tmapv3.extension.MarkerCluster({map,markers:nearby,minClusterCount:2,maxClusterZoom:22});
    await new Promise(resolve=>setTimeout(resolve,250));
    check('MarkerCluster.activeCluster',active._cluster_data.clusterMarkers.length,1,true);
    let upstreamError=null;
    try {active.setOpacity(0.35);} catch(e) {upstreamError=e.message;}
    check('MarkerCluster.upstreamOpacityDefect',upstreamError,'t.setOpacity is not a function',true);
  } catch(e) {fail('MarkerCluster.activeReadout',e);}
  finally {
    try {active?.destroy();} catch(e) {fail('MarkerCluster.activeReadout.cleanup',e);}
    for (const marker of nearby) try {marker.setMap(null);} catch(e) {fail('MarkerCluster.markerReadout.cleanup',e);}
  }
  if (typeof invoke !== 'function') {
    // This reports the adapter lane only, not absence of any Flutter public API.
    for (const kind of ['Map','DotMap','SquareMap','InfoWindow','Label','Polyline','Polygon','Circle','Rectangle','GroundOverlay','Marker','MarkerCluster','Drawing'])
      rows.push({id:kind+'.generic-adapter',contract:namespace(kind),environment:'chrome-extension-bridge',
        status:'unresolved-unavailable-wrapper',wrapper:'generic extension dispatch',
        scope:'Historical generic-adapter comparisons for '+kind+' were not run. The current bridges.dart emitter does not provide an extension handler; the conditional path only supports an externally supplied historical handler; direct public bridge paths are evaluated independently.'});
    for (const row of rows) row.comparison ??= 'unmeasured';
    return rows;
  }
  const call = (kind, op, opts={}) => JSON.parse(invoke(map,kind,op,opts));
  try {
    const actual=call('Map','toggleTraffic',{visible:true});
    rows.push({id:'Map.toggleTraffic.generic-adapter',contract:'Tmapv3.Map',environment:'chrome-extension-bridge',actual,
      status:actual?.supported===false?'unresolved-unavailable-wrapper':'unresolved-observation',
      scope:'Generic dispatch response only; direct traffic paths are evaluated independently.'});
  }
  catch(e) {rows.push({id:'Map.toggleTraffic.generic-adapter',contract:'Tmapv3.Map',environment:'chrome-extension-bridge',status:'unresolved-exception',error:String(e?.message ?? e)});}
  try {check('Map.screenSize',call('Map','screenSize'),{width:map.screenSize().getWidth(),height:map.screenSize().getHeight()});}
  catch(e) {rows.push({id:'Map.screenSize',contract:'Tmapv3.Map#screenSize',environment:'chrome-extension-bridge',status:'unresolved-exception',error:String(e?.message ?? e)});}
  for (const kind of ['DotMap','SquareMap']) {
    try {
      const opts = kind==='DotMap' ? {radius:[3,12],range:[0,10],fillColor:'#00ff00',strokeOpacity:0.4,fillOpacity:0.6}
        : {size:150,values:[1,10],colors:['#00ff00','#ff0000'],strokeOpacity:0.4,fillOpacity:0.6};
      opts.data={data:[{lat:37.5665,lng:126.978,value:5}]};
      const direct = new Tmapv3.extension[kind]({...opts,map});
      call(kind,'create',structuredClone(opts));
      const wrapped = map.__flutterExtensions[kind];
      const fields = kind==='DotMap'?['_radiusMin','_radiusMax','_valueMin','_valueMax','_color','data']
        :['_size','_values','_colors','_strokeOpacity','_fillOpacity','data'];
      check(kind+'.options',fields.map(k=>wrapped[k]),fields.map(k=>direct[k]));
      check(kind+'.layer-created',wrapped.layerId !== -1 && wrapped.stackId !== -1,true);
      call(kind,'destroy');
      check(kind+'.destroy',Object.hasOwn(map.__flutterExtensions,kind),false);
      direct.destroy();
      call(kind,'create',structuredClone(opts)); call(kind,'destroy');
      check(kind+'.recreate',Object.hasOwn(map.__flutterExtensions,kind),false);
    } catch(e) { rows.push({id:kind,contract:namespace(kind),environment:'chrome-extension-bridge',status:'unresolved-exception',error:String(e?.message ?? e)}); }
  }
  try {
    const a=new Tmapv3.LatLng(37.5665,126.978),b=new Tmapv3.LatLng(37.567,126.979),c=new Tmapv3.LatLng(37.566,126.980);
    const bounds=new Tmapv3.LatLngBounds(a,b);
    const specs=[['InfoWindow','infoWindows',{position:a,content:'test',type:2}],['Label','labels',{position:a,content:'test'}],['Polyline','polylines',{path:[a,b]}],['Polygon','polygons',{paths:[a,b,c]}],['Circle','circles',{center:a,radius:200}],['Rectangle','rectangles',{bounds}],['GroundOverlay','groundOverlays',{bounds,url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='}]];
    const run=async(kind,operation,options,context)=>JSON.parse(invoke(map,kind,operation,options,context));
    for(const [kind,collection,options] of specs) {
      if(kind==='GroundOverlay'){const image=new Image();image.src=options.url;await image.decode();check('GroundOverlay.fixtureDecoded',[image.naturalWidth,image.naturalHeight],[1,1],true);}

      let instance,context;
      if(kind==='GroundOverlay') {
        context={map,groundOverlays:{}};window.tmap_instances['audit-extensions']=context;
        window.tmap_addGroundOverlay('audit-extensions',{id:'test',swLat:a.lat(),swLng:a.lng(),neLat:b.lat(),neLng:b.lng(),imageUrl:options.url});
        instance=context.groundOverlays.test;
      } else {instance=new Tmapv3[kind]({...options,map});context={[collection]:{test:instance}};}

      let taps=0;
      if(kind==='InfoWindow') {
        const element=instance._iw_data.contentDiv || instance._iw_data.htmlElement.getElement(),handler=()=>taps++;
        element.addEventListener('click',handler);context.infoWindowListeners={test:{element,handler}};
      }
      let reference;
      try {
        for(let cycle=0;cycle<2;cycle++) {
          await run(kind,'setMap',{id:'test',attached:false},context);
          check(kind+'.detach.'+cycle,instance.getMap(),null);
          await run(kind,'setMap',{id:'test',attached:true},context);
          check(kind+'.reattach.'+cycle,instance.getMap()===map,true);
          if(kind==='InfoWindow') {(instance._iw_data.contentDiv || instance._iw_data.htmlElement.getElement()).click();check('InfoWindow.callback.'+cycle,taps,cycle+1);}

        }
        if(kind==='Circle') check('Circle.pathSnapshot',JSON.parse(invoke(map,kind,'getPath',{id:'test'},context)).value,{center:{latitude:a.lat(),longitude:a.lng()},radius:200});
        if(kind==='Rectangle') check('Rectangle.pathSnapshot',JSON.parse(invoke(map,kind,'getPath',{id:'test'},context)).value,{southWest:{latitude:a.lat(),longitude:a.lng()},northEast:{latitude:b.lat(),longitude:b.lng()}});
        if(kind==='InfoWindow') {
          invoke(map,kind,'setPosition',{id:'test',latitude:b.lat(),longitude:b.lng()},context);
          check('InfoWindow.position',[instance.getPosition().lat(),instance.getPosition().lng()],[b.lat(),b.lng()]);
        }
        if(['Circle','Polyline','Polygon','Rectangle','InfoWindow'].includes(kind)) {
          reference=new Tmapv3[kind]({...options,map});
          const before=instance, coords=p=>[p.lat(),p.lng()];
          if(kind==='Circle') {
            reference.setCenter(c); reference.setRadius(135);
            await run(kind,'setCenter',{id:'test',latitude:c.lat(),longitude:c.lng()},context);
            await run(kind,'setRadius',{id:'test',radius:135},context);
            check('Circle.mutation.nativeParity',[coords(instance.getCenter()),instance.getRadius()],[coords(reference.getCenter()),reference.getRadius()]);
          }
          if(kind==='Polyline' || kind==='Polygon') {
            const direct=[a,b,c], encoded=direct.map(p=>({latitude:p.lat(),longitude:p.lng()}));
            const hole=[a,c,b], holeEncoded=hole.map(p=>({latitude:p.lat(),longitude:p.lng()}));
            reference.setPath(kind==='Polygon'?[direct,hole]:direct);
            await run(kind,'setPath',{id:'test',path:encoded,holes:kind==='Polygon'?[holeEncoded]:[]},context);
            const snapshot=x=>{const p=x.getPath();return {path:p.path.map(coords),outerPath:p.outerPath?.map(r=>r.map(coords))??null};};
            check(kind+'.setPath.nativeParity',snapshot(instance),snapshot(reference));
            if(kind==='Polygon') check('Polygon.getArea.nativeParity',(await run(kind,'getArea',{id:'test'},context)).value,reference.getArea());
          }
          if(kind==='Rectangle') {
            reference.setBounds(new Tmapv3.LatLngBounds(b,c));
            await run(kind,'setBounds',{id:'test',bounds:{southWest:{latitude:b.lat(),longitude:b.lng()},northEast:{latitude:c.lat(),longitude:c.lng()}}},context);
            const snapshot=x=>{const p=x.getBounds();return [coords(p.getSouthWest()),coords(p.getNorthEast())];};
            check('Rectangle.setBounds.nativeParity',snapshot(instance),snapshot(reference));
          }
          if(kind==='InfoWindow') {
            reference.setContent('<b>updated</b>');
            await run(kind,'setContent',{id:'test',content:'<b>updated</b>'},context);
            check('InfoWindow.setContent.nativeParity',instance.getContent(),reference.getContent());
            const element=instance._iw_data.contentDiv || instance._iw_data.htmlElement.getElement();
            const beforeTaps=taps;element.click();check('InfoWindow.setContent.callback',taps,beforeTaps+1);
            reference.setAnchor('top');await run(kind,'setAnchor',{id:'test',anchor:'top'},context);
            check('InfoWindow.setAnchor.nativeParity',instance.getAnchor(),reference.getAnchor());
            reference.setOffset(new Tmapv3.Point(0,-2));
            await run(kind,'setOffset',{id:'test',offset:{x:0,y:-2}},context);
            check('InfoWindow.setOffset.nativeParity',[instance.getOffset().getX(),instance.getOffset().getY()],[reference.getOffset().getX(),reference.getOffset().getY()]);
            reference.setBackground(false);await run(kind,'setBackground',{id:'test',background:false},context);
            check('InfoWindow.setBackground.flatParity',instance._iw_data.options.background,reference._iw_data.options.background);
            reference.setMap(null);await run(kind,'setMap',{id:'test',attached:false},context);
            reference.setOptions({position:c,offset:new Tmapv3.Point(1,2),content:'via options',anchor:'bottom',map});
            await run(kind,'setOptions',{id:'test',options:{position:{latitude:c.lat(),longitude:c.lng()},offset:{x:1,y:2},content:'via options',anchor:'bottom',map:true}},context);
            const optionsSnapshot=x=>({position:coords(x.getPosition()),content:x.getContent(),anchor:x.getAnchor(),offset:x._iw_data.vsmMarkerOption.offset,attached:x.getMap()===map});
            check('InfoWindow.setOptions.nativeParity',optionsSnapshot(instance),optionsSnapshot(reference));
            const rebound=instance._iw_data.contentDiv || instance._iw_data.htmlElement.getElement(),tapsBeforeRebound=taps;
            rebound.click();check('InfoWindow.setOptions.callback',taps,tapsBeforeRebound+1);
            const balloon=new Tmapv3.InfoWindow({map,position:a,content:'balloon',type:1});
            const balloonReference=new Tmapv3.InfoWindow({map,position:a,content:'balloon',type:1});
            try {
              balloonReference.setBackground('#12ab34');
              await run(kind,'setBackground',{id:'balloon',background:'#12ab34'},{infoWindows:{balloon}});
              check('InfoWindow.setBackground.balloonParity',balloon._iw_data.contentDiv.style.background,balloonReference._iw_data.contentDiv.style.background);
            } finally {balloon.setMap(null);balloonReference.setMap(null);}
            let nativeError=null,bridgeError=null;
            try {reference.setVisible(false);} catch(e) {nativeError=e.message;}
            try {await run(kind,'setVisible',{id:'test',visible:false},context);} catch(e) {bridgeError=e.message;}
            check('InfoWindow.setVisible.nativeParity',bridgeError,nativeError);
          } else {
            reference.setVisible(false);await run(kind,'setVisible',{id:'test',visible:false},context);
            check(kind+'.setVisible.nativeParity',instance._shape_status.isVisible,reference._shape_status.isVisible);
            const style={strokeColor:'#007700',strokeOpacity:0,strokeWeight:3};
            reference.setColorOptions(style);await run(kind,'setColorOptions',{id:'test',options:style},context);
            check(kind+'.setColorOptions.nativeParity',instance._shape_data.vsmStyle,reference._shape_data.vsmStyle);
          }
          check(kind+'.mutation.identity',context[collection].test===before,true);
        }
      } finally {if(reference) reference.setMap(null);await run(kind,'setMap',{id:'test',attached:false},context);if(kind==='GroundOverlay') delete window.tmap_instances['audit-extensions'];}
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }
  } catch(e) {rows.push({id:'Overlay.lifecycle',contract:'Tmapv3.mapobject.MapObject',environment:'chrome-extension-bridge',status:'unresolved-exception',error:String(e?.message ?? e)});}
  let marker, markerReference, markerManager, cluster;
  try {
    marker=new Tmapv3.Marker({map,position:new Tmapv3.LatLng(37.5665,126.978),offset:new Tmapv3.Point(-2,3),iconSize:new Tmapv3.Size(20,30)});
    // Adopt this direct SDK fixture through the same production manager that
    // addMarker uses. Managed on/off intentionally reject unmanaged markers.
    if (typeof window.__auditCreateMarkerManager === 'function' && typeof window.__auditGetMarkerManager === 'function') {
      markerManager=window.__auditCreateMarkerManager(map,'test',marker);
      check('Marker.managedEventManager.registration',window.__auditGetMarkerManager(map,'test')===markerManager,true);
    } else rows.push({id:'Marker.managedEventManager.registration',contract:'Tmapv3.mapobject.Marker#on',environment:'chrome-extension-bridge',status:'unresolved-unavailable-wrapper',wrapper:'marker event manager'});
    const reference=markerReference=new Tmapv3.Marker({map,position:new Tmapv3.LatLng(37.5665,126.978),offset:new Tmapv3.Point(-2,3),iconSize:new Tmapv3.Size(20,30)});
    const optionsContext={markers:{test:marker}};
    const snapshot=m=>({position:[m.getPosition().lat(),m.getPosition().lng()],size:[m.getIconSize().getWidth(),m.getIconSize().getHeight()],offset:m._marker_data.vsmMarkerOption.offset,title:m._marker_data.options.title,opacity:m._marker_data.options.opacity,visible:m._marker_data.options.visible,zIndex:m.getZIndex()});
    const nativeOptions={position:new Tmapv3.LatLng(37.5665,126.978),iconSize:new Tmapv3.Size(20,30),offset:new Tmapv3.Point(-2,3),title:'updated',opacity:0.4,visible:false,zIndex:321};
    reference.setOptions(nativeOptions);
    const elementBefore=marker._marker_data.vsmMarker.getElement();
    invoke(map,'Marker','setOptions',{markerId:'test',options:{position:{latitude:37.5665,longitude:126.978},iconSize:{width:20,height:30},offset:{x:-2,y:3},title:'updated',opacity:0.4,visible:false,zIndex:321}},optionsContext);
    check('Marker.setOptions.nativeParity',snapshot(marker),snapshot(reference));
    check('Marker.setOptions.identity',marker._marker_data.vsmMarker.getElement()===elementBefore,true);
    reference.setOptions({opacity:0,zIndex:0,visible:true});
    invoke(map,'Marker','setOptions',{markerId:'test',options:{opacity:0,zIndex:0,visible:true}},optionsContext);
    check('Marker.setOptions.zeroSemantics',snapshot(marker),snapshot(reference));
    let invalidMap=false;
    try {invoke(map,'Marker','setOptions',{markerId:'test',options:{map:'other'}},optionsContext);}catch(e){invalidMap=/boolean/.test(e.message);}
    check('Marker.setOptions.invalidMap',invalidMap,true);
    reference.setMap(null);
    cluster=new Tmapv3.extension.MarkerCluster({map,markers:[]});
    const context={clusterer:cluster,markers:{test:marker}};
    check('Marker.iconSizeSnapshot',JSON.parse(invoke(map,'Marker','getIconSize',{markerId:'test'},context)).value,{width:20,height:30});
    check('Marker.offsetSnapshot',JSON.parse(invoke(map,'Marker','getOffset',{markerId:'test'},context)).value,null);
    const menuEvents=[];context.callbacks={onMarkerContextMenu:(...args)=>menuEvents.push(args)};
    invoke(map,'Marker','setContextMenu',{markerId:'test',items:[{actionId:'inspect',label:'정보'}]},context);
    marker._marker_data.vsmMarker.getElement().dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:100,clientY:100}));
    await new Promise(resolve=>setTimeout(resolve,150));
    document.querySelector('.tmap-marker-context-menu-item').click();
    check('Marker.contextMenu.callback',menuEvents,[['test','inspect',37.5665,126.978]]);
    check('Marker.getContextMenu',JSON.parse(invoke(map,'Marker','getContextMenu',{markerId:'test'},context)).value,[{label:'정보',actionId:'inspect'}]);
    const nativeEvents=[];
    context.callbacks.onMarkerEvent=(id,name,payload)=>nativeEvents.push({id,name,payload:JSON.parse(payload)});
    for(const name of ['click','mouseenter','mouseleave','contextmenu']) {
      const start=nativeEvents.length;
      invoke(map,'Marker','on',{markerId:'test',eventName:name.toUpperCase()},context);
      marker._marker_data.vsmMarker.getElement().dispatchEvent(new MouseEvent(name,{bubbles:true,clientX:21,clientY:34}));
      check('Marker.on.'+name,nativeEvents.length,start+1);
      check('Marker.eventSnapshot.'+name,[nativeEvents.at(-1)?.id,nativeEvents.at(-1)?.name,nativeEvents.at(-1)?.payload.latitude],['test',name,37.5665]);
      invoke(map,'Marker','off',{markerId:'test',eventName:name},context);
      marker._marker_data.vsmMarker.getElement().dispatchEvent(new MouseEvent(name,{bubbles:true}));
      check('Marker.off.'+name,nativeEvents.length,start+1);
    }
    const cc=(op,opts={})=>JSON.parse(invoke(map,'MarkerCluster',op,opts,context));
    cc('stopClustering'); cc('addMarker',{markerId:'test'});
    check('MarkerCluster.addMarker',cluster._cluster_data.markers[0]===marker,true);
    cc('setVisible',{visible:false});check('MarkerCluster.visible',cluster._cluster_data.options.visible,false);
    cc('setOpacity',{opacity:0.4});cc('setZIndex',{zIndex:123});
    cc('setOptions',{gridSize:90,minClusterCount:3,maxClusterZoom:18});
    check('MarkerCluster.styleOptions',[cluster._cluster_data.options.opacity,cluster._cluster_data.options.zIndex],[0.4,123]);
    check('MarkerCluster.setOptions',[cluster._cluster_data.options.gridSize,cluster._cluster_data.options.minClusterCount,cluster._cluster_data.options.maxClusterZoom],[90,3,18]);
    cc('removeMarker',{markerId:'test'});check('MarkerCluster.removeMarker',cluster._cluster_data.markers.length,0);
    cc('resumeClustering');cc('recluster');cc('clearMarkers');
    check('MarkerCluster.clearMarkers',cluster._cluster_data.markers.length,0);
    cluster.destroy();cluster=null;marker.setMap(null);
    const nearby=[0,0.00001].map(d=>new Tmapv3.Marker({position:new Tmapv3.LatLng(map.getCenter().lat()+d,map.getCenter().lng())}));
    const active=new Tmapv3.extension.MarkerCluster({map,markers:nearby,minClusterCount:2,maxClusterZoom:22});
    await new Promise(resolve=>setTimeout(resolve,250));
    try {
      let upstreamError=null;
      try { active.setOpacity(0.35); } catch(e) { upstreamError=e.message; }
      invoke(map,'MarkerCluster','setOpacity',{opacity:0.35},{clusterer:active});
      invoke(map,'MarkerCluster','setZIndex',{zIndex:321},{clusterer:active});
      const cm=active._cluster_data.clusterMarkers[0];
      check('MarkerCluster.activeStyle',[cm._marker_data.options.opacity,cm.getZIndex(),cm._marker_data.vsmMarker.getElement().style.opacity],[0.35,321,'0.35']);
    } finally { active.destroy();nearby.forEach(m=>m.setMap(null)); }

  } catch(e) {rows.push({id:'MarkerCluster',contract:'Tmapv3.extension.MarkerCluster',environment:'chrome-extension-bridge',status:'unresolved-exception',error:String(e?.message ?? e)});}
  finally {
    for(const [id,cleanup] of [
      ['Marker.manager',()=>markerManager?.dispose()],
      ['MarkerCluster',()=>cluster?.destroy()],
      ['Marker.reference',()=>markerReference?.setMap(null)],
      ['Marker.fixture',()=>marker?.setMap(null)],
    ]) try {cleanup();} catch(e) {rows.push({id:id+'.cleanup',contract:id==='MarkerCluster'?'Tmapv3.extension.MarkerCluster':'Tmapv3.mapobject.Marker',environment:'chrome-extension-bridge',status:'unresolved-exception',error:String(e?.message ?? e)});}
  }
  try {
    call('Drawing' ,'create',{strokeColor:'#123456',strokeWeight:4});
    const drawing = map.__flutterExtensions.Drawing;
    check('Drawing.options',[drawing._status.drawOptions.strokeColor,drawing._status.drawOptions.strokeWeight],['#123456',4]);
    for(const [op,type] of [['drawCircle',1],['drawRectangle',2],['drawPolyline',3],['drawPolygon',4]]){
      call('Drawing',op);
      check('Drawing.'+op,[drawing._status.drawType,call('Drawing','isFinish').value,map.isDrawing],[type,false,true]);
      call('Drawing','cancel');
      check('Drawing.'+op+'.cancel',[call('Drawing','isFinish').value,map.isDrawing],[true,false]);
    }
    for(const method of ['getShapes','getCircles','getRectangles','getPolylines','getPolygons'])
      check('Drawing.'+method,call('Drawing',method).value,[]);
    call('Drawing','clear');
    check('Drawing.clear',call('Drawing','getShapes').value,[]);
  } catch(e) { rows.push({id:'Drawing',contract:'Tmapv3.extension.Drawing',environment:'chrome-extension-bridge',status:'unresolved-exception',error:String(e?.message ?? e)}); }
  for (const row of rows) row.comparison ??= 'unmeasured';
  return rows;
}
