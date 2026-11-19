import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE=[496893,497022,'a4543c11a2b4a72d9d55f178763702b775f35eaf18f4d7bae83d1988e44d6c7c'];
const CHILD=[497022,497271,'ca029c64c9287b90c626dde3965d95963b4657b9497ef5a925dcec7413270cce'];
const fail=m=>{throw Error(m);};
/** Executes the pinned base/subclass definitions with synthetic values and a
 * mock map. This is not a live SDK, platform, gesture or universal proof. */
export function runSdkEventGettersSourceProbe({root=ROOT}={}) {
 const sdk=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK),'utf8');
 if(sha(sdk)!==SDK)fail('Pinned SDK digest mismatch');
 const text=range=>{const x=sdk.slice(range[0],range[1]);if(sha(x)!==range[2])fail('SDK class span mismatch');return x;};
 const baseSource=text(BASE),childSource=text(CHILD);
 if(!sdk.slice(727900,728050).includes('return{Map:pc,Event:ja,'))fail('SDK export binding mismatch');
 const bridgeFile='lib/src/js/js_native_events.dart',dart=fs.readFileSync(path.join(root,bridgeFile),'utf8'),match=dart.match(/r'''([\s\S]*?)''';/);
 if(!match)fail('Bridge script missing');
 const context={};vm.runInNewContext(baseSource+childSource+';var exportsForProbe={Base:ja,Child:b};\n'+match[1],context,{timeout:1000});
 const {Base,Child}=context.exportsForProbe;
 const engine={on(){},off(){}},map={vsmMap:()=>engine,Base},bridge=context.createTmapNativeEventBridge(map,()=>{}),
  command=r=>JSON.parse(JSON.stringify(bridge.command(JSON.parse(JSON.stringify(r)))));
 const get=(id,key)=>{const r=command({operation:'get',id,key});if(!r.ok)fail('get failed');return r.value;};
 const mapId=command({operation:'map'}).value.id,baseId=get(mapId,'Base').id;
 const direct=new Child('Zoom',engine,{});
 if(!(direct instanceof Base)||Object.getPrototypeOf(direct.constructor)!==Base||direct.target!==engine)fail('subclass identity mismatch');
 const descriptor={};for(const key of ['name','data']){
  const d=Object.getOwnPropertyDescriptor(Base.prototype,key);
  if(!d||typeof d.get!=='function'||d.set!==undefined||d.enumerable!==false||d.configurable!==true)fail('getter descriptor mismatch');
  descriptor[key]={getter:String(d.get),enumerable:d.enumerable,configurable:d.configurable,hasSetter:false};
 }
 const cycle={value:3};cycle.self=cycle;
 const values={undefined:undefined,null:null,false:false,true:true,emptyString:'',unicode:'한글 🗺',zero:0,negativeZero:-0,finite:1.25,
  nan:NaN,positiveInfinity:Infinity,negativeInfinity:-Infinity,bigint:123456789012345678901234567890n,symbol:Symbol('getter-test'),function:function(v){return v;},array:[1,2],cycle};
 const cases=[];
 for(const [id,value] of Object.entries(values)){
  map.current=value;const packed=get(mapId,'current');
  const created=command({operation:'construct',id:baseId,args:[packed,packed]});if(!created.ok)fail('constructor failed: '+id);
  const eventId=created.value.id;command({operation:'set',id:mapId,key:'candidate',value:{kind:'handle',id:eventId}});
  if(!Object.is(map.candidate.name,value)||!Object.is(map.candidate.data,value)||!same(get(eventId,'name'),packed)||!same(get(eventId,'data'),packed))fail('getter mismatch: '+id);
  for(const property of ['name','data']){
   const r=command({operation:'set',id:eventId,key:property,value:{kind:'string',value:'overwrite'}});
   if(!r.ok||r.value.value!==false)fail('readonly mismatch: '+id);
  }
  if(!Object.is(map.candidate.name,value)||!Object.is(map.candidate.data,value))fail('getter mutated: '+id);
  for(const [slot,replacement] of [['di','changed-name'],['fi','changed-data']]){
   if(command({operation:'set',id:eventId,key:slot,value:{kind:'string',value:replacement}}).value?.value!==true)fail('backing set failed: '+id);
  }
  if(get(eventId,'name').value!=='changed-name'||get(eventId,'data').value!=='changed-data')fail('backing getter mismatch: '+id);
  for(const slot of ['di','fi'])if(command({operation:'set',id:eventId,key:slot,value:packed}).value?.value!==true)fail('backing restore failed: '+id);
  const release=command({operation:'release',id:eventId});if(!release.ok||command({operation:'get',id:eventId,key:'name'}).ok)fail('release failed: '+id);
  const again=get(mapId,'candidate');if(again.id===eventId||!Object.is(map.candidate.data,value))fail('reacquire failed: '+id);
  command({operation:'release',id:again.id});
  if(packed.kind==='handle')command({operation:'release',id:packed.id});
  cases.push({id,name:true,data:true,readOnly:true,nativeIdentity:true,backingMutation:true,releaseAndReacquire:true});
 }
 const hostile={get name(){throw 1},get stack(){throw 2},toString(){throw 3}},originalError=new Error('native-getter-fault');
 const thrownValues={undefined:undefined,null:null,negativeZero:-0,nan:NaN,symbol:Symbol('throw'),object:{marker:'object'},error:originalError,hostile};
 const thrownCases=[];
 for(const [id,value] of Object.entries(thrownValues)){
  map.thrown=value;const expected=get(mapId,'thrown'),event=new Base('initial','initial');
  Object.defineProperty(event,'di',{get(){throw value},configurable:true});Object.defineProperty(event,'fi',{get(){throw value},configurable:true});
  map.throwEvent=event;const eventId=get(mapId,'throwEvent').id;
  for(const field of ['name','data']){
   const output=command({operation:'get',id:eventId,key:field});
   if(output.ok||!same(output.error?.thrown,expected))fail('thrown value mismatch: '+id);
   if(id==='error'&&output.error.stack!==originalError.stack)fail('error stack mismatch');
   if(id==='hostile'&&(output.error.name!=='Error'||output.error.message!=='[unprintable thrown value]'||output.error.stack!==null))fail('hostile description mismatch');
  }
  command({operation:'release',id:eventId});if(expected.kind==='handle')command({operation:'release',id:expected.id});
  thrownCases.push({id,name:true,data:true,valueIdentity:true,stackChecked:id==='error',safeDescriptionChecked:id==='hostile'});
 }
 bridge.dispose();if(command({operation:'map'}).ok)fail('dispose failed');
 return {schemaVersion:1,mechanism:'pinned SDK class source with synthetic values and mock bridge map',sdkSha256:SDK,
  bridge:{file:bridgeFile,sha256:sha(dart)},source:{base:{start:BASE[0],end:BASE[1],sha256:BASE[2]},subclass:{start:CHILD[0],end:CHILD[1],sha256:CHILD[2]},exportOffset:727930},
  descriptor,subclass:true,cases,thrownCases,limitations:['Source and finite sample checks are not an exhaustive proof for every JS value, runtime, platform, or map lifecycle.','HTMLDDA document.all is a browser host exotic and is not created by this Node source probe.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(runSdkEventGettersSourceProbe()));
