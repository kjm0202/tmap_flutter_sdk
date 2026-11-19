// Bounded, source-agnostic comparison of the specific 3,600-case numeric
// fixture. This module neither validates source provenance nor upgrades any
// contract, platform, verification dimension or adaptation status.
const SPECIALS=new Set(['-0','NaN','Infinity','-Infinity']);
export const pointSizeSetterInputs=Object.freeze([
  0,Object.freeze({special:'-0'}),1,-1,0.125,Number.MAX_VALUE,Number.MIN_VALUE,
  Object.freeze({special:'NaN'}),Object.freeze({special:'Infinity'}),Object.freeze({special:'-Infinity'}),
]);
const METHODS={Point:['setX','setY','setValue'],Size:['setWidth','setHeight','setSize']};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function validNumber(x){
 if(typeof x==='number')return Number.isFinite(x)&&!Object.is(x,-0);
 return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===1&&Object.hasOwn(x,'special')&&SPECIALS.has(x.special);
}
function validState(v){return Array.isArray(v)&&v.length===2&&v.every(validNumber);}
function normalizedSize(x){return typeof x==='number'&&x===0||x?.special==='-0'||x?.special==='NaN'?0:x;}

/** Return the exact expected fixture IDs and encoded inputs, in stable order. */
export function pointSizeSetterExpectedCases(inputs=pointSizeSetterInputs){
 if(!Array.isArray(inputs)||inputs.length!==pointSizeSetterInputs.length||!inputs.every(validNumber)||!same(inputs,pointSizeSetterInputs))throw new Error('unexpected point/size input fixture');
 const rows=[];
 for(const type of ['Point','Size'])for(const method of METHODS[type]){
  const paired=method==='setValue'||method==='setSize',modes=type==='Point'?['raw']:['raw','sdk-constructor'];
  for(const mode of modes)for(let a=0;a<inputs.length;a++)for(let b=0;b<inputs.length;b++)for(let c=0;c<(paired?inputs.length:1);c++){
   const setupInput=[inputs[a],inputs[(a+3)%inputs.length]],input=paired?[inputs[b],inputs[c]]:[inputs[b]];
   rows.push({id:`numeric-adaptation:${type}.${method}:${mode}:${a}:${b}${paired?`:${c}`:''}`,
    contract:`Tmapv3.base.${type}#${method}`,type,method,setupMode:mode,setupInput,input});
  }
 }
 return rows;
}
function expectedBefore(fixture){return fixture.type==='Size'&&fixture.setupMode==='sdk-constructor'?fixture.setupInput.map(normalizedSize):fixture.setupInput;}
function expectedAfter(fixture,before){
 switch(fixture.method){
  case 'setX': case 'setWidth':return [fixture.input[0],before[1]];
  case 'setY': case 'setHeight':return [before[0],fixture.input[0]];
  case 'setValue': case 'setSize':return [fixture.input[0],fixture.input[1]];
  default:throw new Error('unexpected setter');
 }
}
function shape(row,fixture,side){
 const errors=[];
 if(!row||typeof row!=='object'||Array.isArray(row))return [`${side}:missing-row`];
 if(row.id!==fixture.id||row.contract!==fixture.contract||row.setupMode!==fixture.setupMode)errors.push(`${side}:identity`);
 if(row.status!=='observed')errors.push(`${side}:not-observed`);
 if(Object.hasOwn(row,'error')||Object.hasOwn(row,'errorType')||Object.hasOwn(row,'phase'))errors.push(`${side}:exception-metadata`);
 if(!validState(row.setupInput)||!same(row.setupInput,fixture.setupInput))errors.push(`${side}:setup-input`);
 if(!Array.isArray(row.input)||row.input.length!==fixture.input.length||!row.input.every(validNumber)||!same(row.input,fixture.input))errors.push(`${side}:input`);
 for(const field of side==='native'?['before','after','repeatAfter']:['before','after','resultState','repeatState'])if(!validState(row[field]))errors.push(`${side}:${field}-invalid`);
 return errors;
}

/**
 * Compare actual native and Dart records by ID, independently of record order.
 * Successful results are only bounded fixture agreement; no source binding,
 * runtime provenance or complete API-contract verification is established.
 */
export function comparePointSizeSetterCases(nativeRows,dartRows,inputs=pointSizeSetterInputs){
 let fixtures;try{fixtures=pointSizeSetterExpectedCases(inputs);}catch(error){return {status:'incomplete',expectedCases:3600,comparedCases:0,cases:[],issues:[String(error.message)]};}
 const result={status:'bounded-match',expectedCases:fixtures.length,comparedCases:0,cases:[],issues:[],scope:'fixture-only; no source, platform or contract verification'};
 if(!Array.isArray(nativeRows)||!Array.isArray(dartRows)){result.status='incomplete';result.issues.push('both observation lists are required');return result;}
 const index=(rows,side)=>{
  const map=new Map();for(const row of rows){if(!row||typeof row.id!=='string'){result.issues.push(`${side}:invalid-id`);continue;}if(map.has(row.id)){result.issues.push(`${side}:duplicate-id:${row.id}`);continue;}map.set(row.id,row);}return map;
 };
 const native=index(nativeRows,'native'),dart=index(dartRows,'dart'),expected=new Set(fixtures.map(x=>x.id));
 if(nativeRows.length!==fixtures.length||dartRows.length!==fixtures.length)result.issues.push('incorrect observation count');
 for(const id of native.keys())if(!expected.has(id))result.issues.push('native:unexpected-id:'+id);
 for(const id of dart.keys())if(!expected.has(id))result.issues.push('dart:unexpected-id:'+id);
 for(const f of fixtures){
  const n=native.get(f.id),d=dart.get(f.id),issues=[...shape(n,f,'native'),...shape(d,f,'dart')];
  if(n&&d){
   if(!same(n.setupInput,d.setupInput))issues.push('cross:setup-input');
   if(!same(n.input,d.input))issues.push('cross:input');
   if(!same(n.before,d.before))issues.push('cross:before');
   const before=expectedBefore(f),after=expectedAfter(f,before);
   if(!same(n.before,before))issues.push('native:unexpected-setup-state');
   if(!same(n.after,after))issues.push('native:unexpected-first-state');
   if(!same(n.repeatAfter,after))issues.push('native:unexpected-repeat-state');
   if(!same(n.after,d.resultState))issues.push('cross:first-result-state');
   if(!same(n.repeatAfter,d.repeatState))issues.push('cross:repeat-result-state');
   if(!same(d.after,d.before))issues.push('dart:receiver-mutated');
   if(n.returnType!=='undefined'||n.repeatReturnType!=='undefined')issues.push('native:return-type');
   if(d.returnType!==f.type||d.repeatReturnType!==f.type)issues.push('dart:return-type');
   if(n.receiverRetained!==true||d.receiverRetained!==true)issues.push('receiver:identity');
   if(d.returnedSameReceiver!==false||d.repeatReturnedSameReceiver!==false||d.repeatIdentity!==false)issues.push('dart:result-identity');
   result.comparedCases++;
  }
  const incomplete=!n||!d||issues.some(x=>x.endsWith(':not-observed')||x.endsWith(':exception-metadata'));
  result.cases.push({id:f.id,contract:f.contract,status:incomplete?'incomplete':issues.length?'different':'bounded-match',issues});
 }
 if(result.issues.length||result.comparedCases!==fixtures.length)result.status='incomplete';
 else if(result.cases.some(x=>x.status==='incomplete'))result.status='incomplete';
 else if(result.cases.some(x=>x.issues.length))result.status='different';
 return result;
}
