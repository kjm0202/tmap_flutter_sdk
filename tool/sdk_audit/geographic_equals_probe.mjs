// Exact numeric probe body extracted from the reviewed standalone pinned SDK capture.
export function probeGeographicEquals(inputs) {
  const decode=v=>typeof v==='number'?v:({'-0':-0,NaN:NaN,Infinity:Infinity,'-Infinity':-Infinity})[v.special];
  const enc=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
  const values=inputs.map(decode),rows=[];
  const state=(type,obj)=>type==='LatLng'?[obj._lat,obj._lng]:[obj._sw._lat,obj._sw._lng,obj._ne._lat,obj._ne._lng];
  const construct=(type,mode,v)=>{
   if(type==='LatLng') {const p=mode==='raw'?new Tmapv3.LatLng(0,0):new Tmapv3.LatLng(v[0],v[1]);if(mode==='raw'){p.setLatitude(v[0]);p.setLongitude(v[1]);}return p;}
   const b=mode==='raw'?new Tmapv3.LatLngBounds(new Tmapv3.LatLng(0,0),new Tmapv3.LatLng(0,0)):new Tmapv3.LatLngBounds(new Tmapv3.LatLng(v[0],v[1]),new Tmapv3.LatLng(v[2],v[3]));
   if(mode==='raw'){b._sw.setLatitude(v[0]);b._sw.setLongitude(v[1]);b._ne.setLatitude(v[2]);b._ne.setLongitude(v[3]);}return b;
  };
  const observe=(type,mode,id,a,b,sameReceiver)=>{
   const row={id:`geographic-equals:${type}:${mode}:${id}`,contract:`Tmapv3.base.${type}#equals`,mode,setupInput:[a.map(enc),b.map(enc)],sameReceiver};let phase='setup';
   try {const first=construct(type,mode,a),other=sameReceiver?first:construct(type,mode,b),before=state(type,first),otherBefore=state(type,other);
    const normalized=x=>Number.isFinite(x)&&x!==0?x:0,expected=before.every((v,i)=>v===(type==='LatLngBounds'?normalized(otherBefore[i]):otherBefore[i]));
    row.before=before.map(enc);row.otherBefore=otherBefore.map(enc);row.expected=expected;
    phase='first-call';row.result=first.equals(other);row.after=state(type,first).map(enc);row.otherAfter=state(type,other).map(enc);
    phase='repeat-call';row.repeat=first.equals(other);row.status='observed';row.returnType=typeof row.result;row.repeatAfter=state(type,first).map(enc);row.otherRepeatAfter=state(type,other).map(enc);
   }catch(error){row.status='threw';row.phase=phase;row.errorType=error?.name||'Error';row.error=String(error);}
   rows.push(row);
  };
  const fixture=(type,i)=>[values[i],values[(i+3)%10],...(type==='LatLngBounds'?[values[(i+5)%10],values[(i+7)%10]]:[])];
  for(const type of ['LatLng','LatLngBounds'])for(const mode of ['raw','sdk-constructor'])for(let a=0;a<10;a++){
   for(let b=0;b<10;b++)observe(type,mode,`distinct:${a}:${b}`,fixture(type,a),fixture(type,b),false);
   observe(type,mode,`identity:${a}`,fixture(type,a),fixture(type,a),true);
  }
  observe('LatLng','raw','signed-zero',[0,-0],[-0,0],false);
  const norm=[0,0,0,2],nonfinite=[NaN,-0,Infinity,2];
  observe('LatLngBounds','raw','asymmetry-forward',norm,nonfinite,false);
  observe('LatLngBounds','raw','asymmetry-reverse',nonfinite,norm,false);
  return rows;
 }
