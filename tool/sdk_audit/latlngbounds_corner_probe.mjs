// Run only after independently verifying the pinned SDK bytes.
// This collects observations and never promotes a contract.
export function probeLatLngBoundsCorners(inputs) {
  const decode=v=>typeof v==='number'?v:({'-0':-0,NaN:NaN,Infinity:Infinity,'-Infinity':-Infinity})[v.special];
  const enc=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
  const values=inputs.map(decode),out=[];
  for(const method of ['getNorthWest','getSouthEast'])for(const mode of ['raw','sdk-constructor'])for(let a=0;a<10;a++)for(let b=0;b<10;b++){
   const sw=[values[a],values[(a+3)%10]],ne=[values[b],values[(b+7)%10]],row={id:`latlngbounds-corner:${method}:${mode}:${a}:${b}`,contract:`Tmapv3.base.LatLngBounds#${method}`,mode,setupInput:[...sw,...ne].map(enc)};let phase='setup';
   try{
    const bounds=mode==='raw'?new Tmapv3.LatLngBounds(new Tmapv3.LatLng(0,0),new Tmapv3.LatLng(0,0)):new Tmapv3.LatLngBounds(new Tmapv3.LatLng(...sw),new Tmapv3.LatLng(...ne));
    if(mode==='raw'){bounds._sw.setLatitude(sw[0]);bounds._sw.setLongitude(sw[1]);bounds._ne.setLatitude(ne[0]);bounds._ne.setLongitude(ne[1]);}
    const state=()=>[bounds._sw._lat,bounds._sw._lng,bounds._ne._lat,bounds._ne._lng].map(enc),coords=x=>[x._lat,x._lng].map(enc),distinct=x=>x!==bounds._sw&&x!==bounds._ne;
    row.before=state();phase='first-call';const first=bounds[method]();row.after=state();phase='repeat-call';const repeat=bounds[method]();
    Object.assign(row,{status:'observed',repeatAfter:state(),result:coords(first),repeat:coords(repeat),resultKind:first instanceof Tmapv3.LatLng&&repeat instanceof Tmapv3.LatLng?'LatLng':'other',returnDistinctFromReceiver:first!==bounds,repeatResultDistinct:first!==repeat,resultDistinctFromCorners:distinct(first),repeatDistinctFromCorners:distinct(repeat)});
   }catch(error){Object.assign(row,{status:'threw',phase,errorType:error?.name||'Error',error:String(error)});}
   out.push(row);
  }return out;

}
