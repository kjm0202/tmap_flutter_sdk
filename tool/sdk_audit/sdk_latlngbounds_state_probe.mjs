// Run after loading and independently verifying the pinned SDK. This records
// native state/return observations and does not promote any API contract.
export function probeSdkLatLngBoundsState() {
 const first=(()=>{
 const ll=(lat,lng)=>new Tmapv3.LatLng(lat,lng),bounds=(...args)=>new Tmapv3.LatLngBounds(...args);
 const enc=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
 const point=p=>p===undefined?{kind:'undefined'}:p===null?{kind:'null'}:{kind:'LatLng',lat:enc(p._lat),lng:enc(p._lng)};
 const state=b=>({sw:point(b._sw),ne:point(b._ne),empty:b.isEmpty()});
 const rows=[];
 const observe=(id,make,call)=>{const [receiver,other]=make(),before=state(receiver),otherBefore=other instanceof Tmapv3.LatLngBounds?state(other):undefined,row={id,before};if(otherBefore)row.otherBefore=otherBefore;
  try{const result=call(receiver,other);row.status='observed';row.returnKind=result===undefined?'undefined':typeof result==='boolean'?'boolean':result instanceof Tmapv3.LatLngBounds?'LatLngBounds':result instanceof Tmapv3.LatLng?'LatLng':typeof result;
   if(typeof result==='boolean')row.value=result;if(result instanceof Tmapv3.LatLngBounds){row.returnSameReceiver=result===receiver;row.returnState=state(result);row.returnCornersDistinct=result._sw!=null&&result._ne!=null?result._sw!==result._ne:null;}
   if(result instanceof Tmapv3.LatLng){row.returnPoint=point(result);row.returnDistinctFromCorners=result!==receiver._sw&&result!==receiver._ne;}
  }catch(e){row.status='threw';row.errorType=e.name;}
  row.after=state(receiver);if(otherBefore)row.otherAfter=state(other);rows.push(row);};
 observe('omitted-empty',()=>[bounds()],b=>b.isEmpty());
 observe('null-empty',()=>[bounds(null,null)],b=>b.isEmpty());
 observe('only-sw',()=>[bounds(ll(10,10))],b=>b.isEmpty());
 observe('only-ne',()=>[bounds(undefined,ll(5,5))],b=>b.isEmpty());
 observe('extend-empty',()=>[bounds()],b=>b.extend(ll(37,127)));
 observe('extend-only-sw',()=>[bounds(ll(10,10))],b=>b.extend(ll(5,5)));
 observe('extend-only-ne',()=>[bounds(undefined,ll(5,5))],b=>b.extend(ll(10,10)));
 observe('clone-empty',()=>[bounds()],b=>b.clone());
 observe('empty-equals-empty',()=>[bounds(),bounds()],(b,o)=>b.equals(o));
 observe('valid-equals-empty',()=>[bounds(ll(1,1),ll(2,2)),bounds()],(b,o)=>b.equals(o));
 observe('empty-contains-null',()=>[bounds()],b=>b.contains(null));
 observe('valid-contains-null',()=>[bounds(ll(1,1),ll(2,2))],b=>b.contains(null));
 observe('empty-get-center',()=>[bounds()],b=>b.getCenter());
 observe('empty-get-northeast',()=>[bounds()],b=>b.getNorthEast());
 observe('empty-get-southwest',()=>[bounds()],b=>b.getSouthWest());
 observe('empty-get-northwest',()=>[bounds()],b=>b.getNorthWest());
 observe('empty-get-southeast',()=>[bounds()],b=>b.getSouthEast());
 observe('valid-get-southwest',()=>[bounds(ll(1,1),ll(2,2))],b=>b.getSouthWest());
 observe('valid-get-northeast',()=>[bounds(ll(1,1),ll(2,2))],b=>b.getNorthEast());
 observe('valid-get-northwest',()=>[bounds(ll(1,1),ll(2,2))],b=>b.getNorthWest());
 observe('valid-get-southeast',()=>[bounds(ll(1,1),ll(2,2))],b=>b.getSouthEast());
 observe('valid-get-center',()=>[bounds(ll(1,1),ll(2,2))],b=>b.getCenter());
 observe('partial-equals-sw-mismatch',()=>[bounds(ll(0,0)),bounds(ll(1,1))],(b,o)=>b.equals(o));
 observe('partial-equals-sw-match',()=>[bounds(ll(0,0)),bounds(ll(0,0))],(b,o)=>b.equals(o));
 observe('empty-contains-point',()=>[bounds()],b=>b.contains(ll(1,1)));
 observe('valid-contains-point',()=>[bounds(ll(0,0),ll(2,2))],b=>b.contains(ll(1,1)));
 observe('extend-empty-nonfinite',()=>[bounds()],b=>{const p=ll(0,0);p.setLatitude(NaN);p.setLongitude(-0);return b.extend(p)});
 observe('empty-intersects-valid',()=>[bounds(),bounds(ll(1,1),ll(2,2))],(b,o)=>b.intersects(o));
 observe('union-empty-valid',()=>[bounds(),bounds(ll(1,1),ll(2,2))],(b,o)=>b.union(o));
 observe('union-valid-only-sw',()=>[bounds(ll(1,1),ll(2,2)),bounds(ll(0,0))],(b,o)=>b.union(o));
 observe('union-valid-empty',()=>[bounds(ll(1,1),ll(2,2)),bounds()],(b,o)=>b.union(o));
 observe('isEmpty-reversed-raw',()=>{const b=bounds(ll(0,0),ll(1,1));b._sw.setLatitude(10);b._sw.setLongitude(10);b._ne.setLatitude(-10);b._ne.setLongitude(-10);return[b]},b=>b.isEmpty());
 return rows;
 })();
 const second=(()=>{
 const point=(a,b)=>new Tmapv3.LatLng(a,b),box=(a,b,c,d)=>new Tmapv3.LatLngBounds(point(a,b),point(c,d)),empty=()=>new Tmapv3.LatLngBounds();
 const coord=p=>p===undefined?{kind:'undefined'}:p===null?{kind:'null'}:{kind:'LatLng',lat:p._lat,lng:p._lng};
 const state=b=>({sw:coord(b._sw),ne:coord(b._ne),empty:b.isEmpty()});
 const data=[
  ['empty-contains-null',()=>[empty()],b=>b.contains(null)],['valid-contains-null',()=>[box(1,1,2,2)],b=>b.contains(null)],
  ['empty-contains-undefined',()=>[empty()],b=>b.contains(undefined)],['valid-contains-undefined',()=>[box(0,0,2,2)],b=>b.contains(undefined)],
  ['empty-intersects-valid',()=>[empty(),box(1,1,2,2)],(b,o)=>b.intersects(o)],['valid-intersects-empty',()=>[box(0,0,2,2),empty()],(b,o)=>b.intersects(o)],
  ['disjoint',()=>[box(0,0,1,1),box(2,2,3,3)],(b,o)=>b.intersects(o)],['overlap',()=>[box(0,0,2,2),box(1,1,3,3)],(b,o)=>b.intersects(o)],
  ['containment',()=>[box(0,0,4,4),box(1,1,2,2)],(b,o)=>b.intersects(o)],['touching-corner',()=>[box(0,0,1,1),box(1,1,2,2)],(b,o)=>b.intersects(o)],
  ['crossing-no-corner',()=>[box(-10,-1,10,1),box(-1,-10,1,10)],(b,o)=>b.intersects(o)],
  ['partial-other-sw-inside',()=>[box(0,0,2,2),new Tmapv3.LatLngBounds(point(1,1))],(b,o)=>b.intersects(o)],
  ['partial-other-sw-outside',()=>[box(0,0,2,2),new Tmapv3.LatLngBounds(point(5,5))],(b,o)=>b.intersects(o)],
 ];return data.map(([id,make,call])=>{const [receiver,other]=make(),row={id,before:state(receiver)};if(other)row.otherBefore=state(other);try{const result=call(receiver,other);row.status='observed';row.returnKind=typeof result;if(typeof result==='boolean')row.value=result}catch(e){row.status='threw';row.errorType=e.name}row.after=state(receiver);if(other)row.otherAfter=state(other);return row});
 })();
 const third=(()=>{
 const ll=(a,b)=>new Tmapv3.LatLng(a,b),box=(...args)=>new Tmapv3.LatLngBounds(...args);
 const enc=v=>Number.isNaN(v)?{special:'NaN'}:v===Infinity?{special:'Infinity'}:v===-Infinity?{special:'-Infinity'}:Object.is(v,-0)?{special:'-0'}:v;
 const point=p=>p===undefined?{kind:'undefined'}:p===null?{kind:'null'}:{kind:'LatLng',lat:enc(p._lat),lng:enc(p._lng)};
 const state=b=>({sw:point(b._sw),ne:point(b._ne),empty:b.isEmpty()});
 const cases=[
  ['isEmpty-null-undefined',()=>[box(null)],b=>b.isEmpty()],
  ['isEmpty-undefined-null',()=>[box(undefined,null)],b=>b.isEmpty()],
  ['isEmpty-value-null',()=>[box(ll(1,1),null)],b=>b.isEmpty()],
  ['isEmpty-null-value',()=>[box(null,ll(1,1))],b=>b.isEmpty()],
  ['extend-valid-contained',()=>[box(ll(1,1),ll(3,3))],b=>b.extend(ll(2,2))],
  ['extend-valid-sw-expand',()=>[box(ll(1,1),ll(2,2))],b=>b.extend(ll(0,0))],
  ['extend-valid-ne-expand',()=>[box(ll(1,1),ll(2,2))],b=>b.extend(ll(3,3))],
  ['valid-contains-outside',()=>[box(ll(0,0),ll(2,2))],b=>b.contains(ll(3,3))],
  ['valid-contains-boundary',()=>[box(ll(0,0),ll(2,2))],b=>b.contains(ll(0,2))],
  ['union-valid-valid',()=>[box(ll(1,1),ll(2,2)),box(ll(0,0),ll(3,3))],(b,o)=>b.union(o)],
  ['union-self',()=>{const b=box(ll(1,1),ll(2,2));return[b,b]},(b,o)=>b.union(o)],
 ];return cases.map(([id,make,call])=>{const [b,o]=make(),row={id,before:state(b)};if(o)row.otherBefore=state(o);try{const result=call(b,o);row.status='observed';row.returnKind=result===undefined?'undefined':typeof result==='boolean'?'boolean':result instanceof Tmapv3.LatLngBounds?'LatLngBounds':typeof result;if(typeof result==='boolean')row.value=result;if(result instanceof Tmapv3.LatLngBounds){row.returnSameReceiver=result===b;row.returnState=state(result);row.returnCornersDistinct=result._sw!=null&&result._ne!=null?result._sw!==result._ne:null;}}catch(e){row.status='threw';row.errorType=e.name;}row.after=state(b);if(o)row.otherAfter=state(o);return row});
 })();
 const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
 const byId=new Map(first.map(row=>[row.id,row]));
 for(const row of [...second,...third]){const previous=byId.get(row.id);if(previous&&JSON.stringify(stable(previous))!==JSON.stringify(stable(row)))throw Error('conflicting native fixture '+row.id);if(!previous)byId.set(row.id,row);}
 if(first.length!==32||second.length!==13||third.length!==11||byId.size!==53)throw Error('incomplete native fixture');
 return [...byId.values()];
}
