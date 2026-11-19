// Pure numeric value contracts. Constructor setup is isolated from the receiver
// state; clone behavior itself includes its reviewed constructor dependencies.
export function probeNumericGetters(inputs) {
 const decode=v=>typeof v==='object'?({'-0':-0,NaN:NaN,Infinity:Infinity,'-Infinity':-Infinity})[v.special]:v;
 const encode=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
 const methods={Point:['getX','getY','clone'],Size:['getWidth','getHeight','width','height'],LatLng:['lat','lng','latitude','longitude','clone']};
 const rows=[];
 for(const type of Object.keys(methods))for(const method of methods[type])for(let a=0;a<inputs.length;a++)for(let b=0;b<inputs.length;b++) {
  const contract=`Tmapv3.base.${type}#${method}`,id=`numeric-getter:${type}.${method}:${a}:${b}`;
  const object=new Tmapv3[type](0,0),receiver=object;
  if(type==='Point')object.setValue(decode(inputs[a]),decode(inputs[b]));else if(type==='Size')object.setSize(decode(inputs[a]),decode(inputs[b]));else {object.setLatitude(decode(inputs[a]));object.setLongitude(decode(inputs[b]));}
  const state=(o=object)=>type==='Point'?[encode(o.x),encode(o.y)]:type==='Size'?[encode(o._width),encode(o._height)]:[encode(o._lat),encode(o._lng)];
  const before=state();
  try {
   const value=object[method](),repeat=object[method](),clone=method==='clone';
   rows.push({id,contract,status:'observed',value:clone?{type,values:state(value)}:encode(value),before,after:state(),repeat:clone?{type,values:state(repeat)}:encode(repeat),receiverRetained:receiver===object,numeric:typeof value==='number',...(clone?{resultKind:value instanceof Tmapv3[type]?type:'wrong-type',returnedSameReceiver:value===object,repeatIdentity:value===repeat}:{})});
  } catch(e){rows.push({id,contract,status:'threw',error:String(e)});}
 }
 for(const method of ['getLeft','getTop','getWidth','getHeight','getRight','getBottom','clone','getPosition','getSize'])for(const mode of ['sdk','corners'])for(let a=0;a<inputs.length;a++)for(let b=0;b<inputs.length;b++) {
  const x=decode(inputs[a]),y=decode(inputs[b]),object=new Tmapv3.Bounds();
  object.setLeft(x);object.setTop(x);object.setWidth(mode==='sdk'?y:y-x);object.setHeight(mode==='sdk'?y:x-y);
  const state=()=>[encode(object._left),encode(object._top),encode(object._width),encode(object._height)],before=state();
  const value=object[method](),repeat=object[method]();
  const resultKind=method==='clone'?'Bounds':method==='getPosition'?'Point':method==='getSize'?'Size':null;
  const result=v=>resultKind?{type:resultKind,values:(resultKind==='Bounds'?[v._left,v._top,v._width,v._height]:resultKind==='Point'?[v.x,v.y]:[v._width,v._height]).map(encode)}:encode(v);
  rows.push({id:`numeric-getter:Bounds.${method}:${mode}:${a}:${b}`,contract:`Tmapv3.base.Bounds#${method}`,status:'observed',value:result(value),before,after:state(),repeat:result(repeat),receiverRetained:true,numeric:typeof value==='number',...(resultKind?{resultKind:value instanceof Tmapv3[resultKind]?resultKind:'wrong-type',returnedSameReceiver:value===object,repeatIdentity:value===repeat}:{})});
 }
 for (const method of ['setLeft','setTop','setWidth','setHeight']) for(let a=0;a<inputs.length;a++)for(let b=0;b<inputs.length;b++) {
  const object=new Tmapv3.Bounds(),x=decode(inputs[a]),input=decode(inputs[b]);
  object.setLeft(x);object.setTop(x);object.setWidth(x);object.setHeight(x);
  const state=()=>[object._left,object._top,object._width,object._height].map(encode),before=state();
  const value=object[method](input);
  rows.push({id:`numeric-adaptation:Bounds.${method}:${a}:${b}`,contract:`Tmapv3.base.Bounds#${method}`,status:'observed',input:encode(input),before,after:state(),returnType:typeof value});
 }
 return rows;
}
