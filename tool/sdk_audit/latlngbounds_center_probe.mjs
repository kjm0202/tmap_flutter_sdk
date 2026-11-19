// Run in a browser only after separately checking the pinned SDK bytes. This
// records bounded numeric cases, not all LatLngBounds inputs or JS behavior.
export function probeLatLngBoundsCenter(inputs) {
  const decode=v=>typeof v==='number'?v:({'-0':-0,NaN:NaN,Infinity:Infinity,'-Infinity':-Infinity})[v.special];
  const encode=v=>v===undefined?{special:'undefined'}:Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
  const values=inputs.map(decode),rows=[];
  for(const mode of ['raw','sdk-constructor'])for(let a=0;a<values.length;a++)for(let b=0;b<values.length;b++){
    const coords=[values[a],values[(a+3)%values.length],values[b],values[(b+7)%values.length]];
    const row={id:`latlngbounds-center:${mode}:${a}:${b}`,contract:'Tmapv3.base.LatLngBounds#getCenter',mode,setupInput:coords.map(encode)};
    let phase='setup';
    try {
      const point=(lat,lng)=>new Tmapv3.LatLng(lat,lng);
      const bounds=mode==='raw'?new Tmapv3.LatLngBounds(point(0,0),point(0,0)):new Tmapv3.LatLngBounds(point(coords[0],coords[1]),point(coords[2],coords[3]));
      if(mode==='raw'){
        bounds._sw.setLatitude(coords[0]);bounds._sw.setLongitude(coords[1]);
        bounds._ne.setLatitude(coords[2]);bounds._ne.setLongitude(coords[3]);
      }
      const corners=()=>[bounds._sw.lat(),bounds._sw.lng(),bounds._ne.lat(),bounds._ne.lng()].map(encode);
      const coord=p=>[p.lat(),p.lng()].map(encode);
      row.before=corners();phase='first-call';const result=bounds.getCenter();row.after=corners();
      phase='repeat-call';const repeat=bounds.getCenter();row.repeatAfter=corners();
      Object.assign(row,{status:'observed',result:coord(result),repeat:coord(repeat),resultKind:result instanceof Tmapv3.LatLng?'LatLng':typeof result,
        returnDistinctFromReceiver:result!==bounds,repeatResultDistinct:repeat!==result,
        resultDistinctFromCorners:result!==bounds._sw&&result!==bounds._ne,repeatDistinctFromCorners:repeat!==bounds._sw&&repeat!==bounds._ne});
    }catch(error){Object.assign(row,{status:'threw',phase,errorType:error?.name||'Error'});}
    rows.push(row);
  }
  return rows;
}
