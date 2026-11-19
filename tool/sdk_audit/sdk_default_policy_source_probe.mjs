import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {ROOT,sha} from './common.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const SPANS={MouseDown:[528677,528987,'1fc4d7d6b6ad5e36c4b20e8a236d8fde7bf45198a9e4241d93a90ded06804c98'],Wheel:[529500,529614,'9569cf1ad4d934c17681d92db286b830b96fb911f8c050a25c089c374f19759d'],TouchStart:[529614,529904,'3d1b8bcacd2b9a3a0bedad1aad3a8263d316ca59dcaa1018ec0b983bcf1c1ddc']};

/** Run exact pinned SDK input-handler code against synthetic DOM/event/emitter
 * objects. This is a host source probe, not a browser or trusted input run. */
export function runSdkDefaultPolicySourceProbe({root=ROOT}={}) {
  const sdk=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK),'utf8');
  if(sha(sdk)!==SDK)throw Error('Pinned SDK digest mismatch');
  const bridgeFile='lib/src/js/js_native_events.dart';
  const dart=fs.readFileSync(path.join(root,bridgeFile),'utf8');
  const match=dart.match(/r'''([\s\S]*?)''';/);
  if(!match)throw Error('Native event bridge script missing');
  const observations={};
  for(const [name,[start,end,digest]] of Object.entries(SPANS)) {
    const handlerSource=sdk.slice(start,end);
    if(sha(handlerSource)!==digest)throw Error('SDK handler span mismatch: '+name);
    const context={i:{},Gs:{os:{name:'iOS'}},p:{MouseDown:'MouseDown',Wheel:'Wheel',TouchStart:'TouchStart'}};
    vm.runInNewContext(match[1]+'\nfunction sourceHandler(){return ['+handlerSource+'][0]}',context,{timeout:1000});
    const listeners=new Map(),seenBefore=[],seenAfter=[];
    const engine={on(n,fn){const list=listeners.get(n)||[];list.push(fn);listeners.set(n,list);},
      off(n,fn){listeners.set(n,(listeners.get(n)||[]).filter(x=>x!==fn));},
      emit(event){for(const fn of [...(listeners.get(event.name)||[])])fn(event);}};
    const bridge=context.createTmapNativeEventBridge({vsmMap:()=>engine},()=>{});
    let actions=0;
    const sdkEmit=(n,dom)=>{const event={name:n,data:{domEvent:dom},defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true;}};engine.emit(event);return event;};
    const gesture={Er:sdkEmit,pr:sdkEmit,lr:{onWheel(){actions++;}},
      dr:{onMouseDown(){actions++;},onTouchStart(){actions++;},isActive(){return false;}},
      Ar:{onTouchStart(){}},isEnabled(){return false;}};
    const handler=context.sourceHandler.call(gesture).handler;
    const config=name==='MouseDown'?{field:'button',value:0,miss:{button:1},hit:{button:0}}:
      name==='Wheel'?{field:'ctrlKey',value:true,miss:{ctrlKey:false},hit:{ctrlKey:true}}:
        {field:'touchCount',value:1,miss:{touches:[]},hit:{touches:[{}]}};
    engine.on(name,e=>seenBefore.push(e.defaultPrevented));
    const value={kind:typeof config.value,value:config.value};
    const registered=bridge.command({operation:'policyRegister',policy:'one',name,conditions:[{field:config.field,value}],once:false});
    if(!registered.ok)throw Error('Policy registration failed: '+name);
    engine.on(name,e=>seenAfter.push(e.defaultPrevented));
    handler(config.miss);const afterNonmatch=actions;
    handler(config.hit);const afterMatch=actions;
    const cancelled=bridge.command({operation:'policyCancel',policy:'one'});
    if(!cancelled.ok)throw Error('Policy cancellation failed: '+name);
    handler(config.hit);const afterCancel=actions;
    const stats=bridge.command({operation:'policyStats',policy:'one'});
    if(afterNonmatch!==1||afterMatch!==1||afterCancel!==2||
       JSON.stringify(seenBefore)!=='[false,false,false]'||JSON.stringify(seenAfter)!=='[false,true,false]'||
       !stats.ok||stats.matches!==1||stats.errors!==0||stats.active!==false) {
      throw Error('Pinned SDK handler gate mismatch: '+name);
    }
    bridge.dispose();
    observations[name]={source:{start,end,sha256:digest},actions:[afterNonmatch,afterMatch,afterCancel],
      before:seenBefore,after:seenAfter,matches:stats.matches,errors:stats.errors};
  }
  return {schemaVersion:1,mechanism:'pinned SDK handler source with synthetic DOM events, SDK event objects and engine emitter',
    sdkSha256:SDK,bridge:{file:bridgeFile,sha256:sha(dart)},observations,
    limitations:['No real browser input, live SDK runtime, native gesture, SDK bundle on device, or synchronous Dart decision is observed.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(runSdkDefaultPolicySourceProbe()));
}
