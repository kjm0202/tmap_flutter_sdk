import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {ROOT,sha} from './common.mjs';

export const trustedGestureIds=Object.freeze([
  'map-pan-before-cancel','map-pan-after-cancel','marker-drag',
  'policy-blocked','policy-after-cancel','policy-once-first',
  'policy-once-second','policy-mismatch','policy-after-dispose','managed-marker-click','map-longtap-hold',
]);

export async function unusedLocalPort() {
  const server=net.createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}

export function validateGestureRequest(request,platform) {
  if(request?.schemaVersion!==1 || !trustedGestureIds.includes(request.id) ||
      request.action!==(request.id==='managed-marker-click'?'tap':request.id==='map-longtap-hold'?'hold':'drag') || request.coordinateSpace!==({web:'browser-css',android:'device-pixels',ios:'screen-points'}[platform]))
    throw Error('Invalid trusted gesture request');
  for(const point of [request.from,request.to])
    if(!point || !['x','y'].every(key=>typeof point[key]==='number'&&Number.isFinite(point[key])&&point[key]>=0&&point[key]<=10000))
      throw Error('Invalid gesture coordinates');
  if(request.id==='managed-marker-click') {
    if(request.durationMs!==0||request.from.x!==request.to.x||request.from.y!==request.to.y)throw Error('Invalid tap geometry');
  } else if(request.durationMs!==700)throw Error('Unexpected gesture duration');
  if(request.action==='hold'&&(request.from.x!==request.to.x||request.from.y!==request.to.y))throw Error('Invalid hold geometry');
  return request;
}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Real Playwright input with an injectable clock for isolated tests. */
export async function dispatchTrustedWebInput(page,request,{pause=delay}={}) {
  validateGestureRequest(request,'web');
  if(request.action==='hold'){
    const session=await page.context().newCDPSession(page);let attempted=false,primary=null,cleanup=null;
    try{attempted=true;await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:request.from.x,y:request.from.y}]});
      await pause(request.durationMs);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});attempted=false;
    }catch(e){primary=e;}finally{
      if(attempted)try{await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});}catch(e){cleanup=e;}
      try{await session.detach();}catch(e){cleanup??=e;}
    }
    if(primary&&cleanup)throw new AggregateError([primary,cleanup],'Touch hold and cleanup failed');
    if(primary)throw primary;if(cleanup)throw cleanup;return;
  }
  await page.mouse.move(request.from.x,request.from.y);
  await page.mouse.down();
  if(request.action==='drag') for(let index=1;index<=14;index++) {
    await pause(request.durationMs/14);
    await page.mouse.move(request.from.x+(request.to.x-request.from.x)*index/14,request.from.y+(request.to.y-request.from.y)*index/14);
  }
  await page.mouse.up();
}

export function requireAndroidDragAndDrop(help) {
  if(typeof help!=='string'||!/\bdraganddrop\s+<x1>/i.test(help))throw Error('Android input draganddrop is unsupported');
}

/** Android input arguments, with coordinate rounding performed once. */
export function trustedAndroidInputArguments(request,deviceId) {
  validateGestureRequest(request,'android');
  const action=request.action==='tap'?'tap':request.action==='hold'?'draganddrop':'swipe';
  const values=request.action==='tap'?[request.from.x,request.from.y]:[request.from.x,request.from.y,request.to.x,request.to.y,request.durationMs];
  return ['-s',deviceId,'shell','input','touchscreen',action,...values.map(value=>String(Math.round(value)))];
}
const withTimeout=async(promise,ms,message)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}
  finally{clearTimeout(timer);}
};
const run=(file,args)=>new Promise((resolve,reject)=>{
  const child=spawn(file,args,{stdio:['ignore','pipe','pipe']});let errorText='',outputText='';
  child.stderr.on('data',bytes=>{errorText=(errorText+bytes.toString()).slice(0,16384);});
  child.stdout.on('data',bytes=>{outputText=(outputText+bytes.toString()).slice(0,16384);});
  child.on('error',reject);
  child.on('close',(code,signal)=>code===0?resolve(outputText+'\n'+errorText):reject(Error(`Input process failed: exit=${code}, signal=${signal}; ${errorText.slice(0,300)}`)));
});

/** Probe Android's actual help command before requesting a stationary hold. */
export async function dispatchTrustedAndroidInput(request,deviceId,{runCommand=run,adb=path.join(process.env.HOME,'Library/Android/sdk/platform-tools/adb')}={}) {
  validateGestureRequest(request,'android');
  if(request.action==='hold') {
    const help=await runCommand(adb,['-s',deviceId,'shell','input','help']);
    requireAndroidDragAndDrop(help);
  }
  await runCommand(adb,trustedAndroidInputArguments(request,deviceId));
}

/** Input is injected by the browser/OS testing service, never dispatchEvent().
 * This is automated trusted input, not a physical human gesture. */
export async function createTrustedGestureDriver({platform,deviceId,debugPort,webPort,logDir,iosXctestrun,writeLog}) {
  let browser=null,iosServer=null,iosChild=null,iosDone=null,iosOutput=null,stopped=false,chain=Promise.resolve();
  let nextCommand=null,ack=null,compiledDriver=null;
  const seen=new Set(),completed=new Set();
  const fingerprint=Object.fromEntries(['tool/sdk_audit/trusted_gesture_driver.mjs',
    'tool/sdk_audit/native_gesture_driver/TrustedInputTests.swift'].map(file=>[file,sha(fs.readFileSync(path.join(ROOT,file)))]));
  const emit=row=>writeLog('MAP TRUSTED INPUT DRIVER: '+JSON.stringify({schemaVersion:1,platform,compiledDriver,...row})+'\n');
  if(platform==='ios') {
    if(!iosXctestrun || !fs.existsSync(iosXctestrun))throw Error('Supply a built private --ios-gesture-xctestrun for trusted iOS input');
    const buildFile=iosXctestrun+'.source.json';
    const build=JSON.parse(fs.readFileSync(buildFile,'utf8'));
    if(build.buildExit!==0||build.sourceFile!=='tool/sdk_audit/native_gesture_driver/TrustedInputTests.swift'||
       build.sourceSha256!==fingerprint[build.sourceFile]||!/^[a-f0-9]{64}$/.test(build.buildLogSha256))
      throw Error('XCTest build is not bound to the current driver source');
    compiledDriver={sourceFile:build.sourceFile,sourceSha256:build.sourceSha256,buildExit:build.buildExit,
      buildLogSha256:build.buildLogSha256,buildManifestSha256:sha(fs.readFileSync(buildFile))};
    iosServer=http.createServer(async(request,response)=>{
      response.setHeader('Content-Type','application/json');
      response.setHeader('Cache-Control','no-store');
      if(request.method==='GET'&&request.url==='/next') {
        const command=stopped?{action:'stop'}:nextCommand??{action:'wait'};
        nextCommand=null;response.end(JSON.stringify(command));return;
      }
      if(request.method==='POST'&&request.url==='/done') {
        let body='';for await(const bytes of request){body+=bytes;if(body.length>4096){response.writeHead(413).end();return;}}
        let value;try{value=JSON.parse(body);}catch{response.writeHead(400).end();return;}
        if(!ack||value.id!==ack.id||value.status!=='dispatched'){response.writeHead(409).end();return;}
        ack.resolve();ack=null;response.end('{}');return;
      }
      response.writeHead(404).end('{}');
    });
    await new Promise(resolve=>iosServer.listen(0,'127.0.0.1',resolve));
    const address='http://127.0.0.1:'+iosServer.address().port;
    const generated=path.join(logDir,'trusted-input.xctestrun');
    execFileSync('python3',['-c',`import plistlib,sys,pathlib
source=pathlib.Path(sys.argv[1]);target=pathlib.Path(sys.argv[2]);obj=plistlib.loads(source.read_bytes())
def rewrite(value):
 if isinstance(value,str): return value.replace('__TESTROOT__',str(source.parent))
 if isinstance(value,list): return [rewrite(x) for x in value]
 if isinstance(value,dict): return {k:rewrite(v) for k,v in value.items()}
 return value
obj=rewrite(obj)
for value in obj.values():
 if isinstance(value,dict) and value.get('IsUITestBundle'): value.setdefault('EnvironmentVariables',{})['TMAP_GESTURE_SERVER']=sys.argv[3]
target.write_bytes(plistlib.dumps(obj))`,path.resolve(iosXctestrun),generated,address]);
    iosOutput=fs.openSync(path.join(logDir,'trusted-input-xctest.log'),'wx',0o600);
    iosChild=spawn('xcodebuild',['test-without-building','-xctestrun',generated,'-destination','platform=iOS Simulator,id='+deviceId,
      '-parallel-testing-enabled','NO','-resultBundlePath',path.join(logDir,'trusted-input.xcresult')],{stdio:['ignore',iosOutput,iosOutput]});
    iosDone=new Promise(resolve=>{
      iosChild.on('error',error=>resolve({exitCode:null,error:String(error)}));
      iosChild.on('close',(exitCode,signal)=>resolve({exitCode,signal}));
    });
  }

  async function dispatch(request) {
    validateGestureRequest(request,platform);
    if(seen.has(request.id))throw Error('Duplicate trusted gesture request');
    if(request.id!==trustedGestureIds[seen.size])throw Error('Trusted gesture request order mismatch');
    seen.add(request.id);
    const startedAt=new Date().toISOString();
    if(platform==='web') {
      browser??=await chromium.connectOverCDP('http://127.0.0.1:'+debugPort);
      const pages=browser.contexts().flatMap(context=>context.pages());
      const page=pages.find(candidate=>{try{return new URL(candidate.url()).port===String(webPort);}catch{return false;}});
      if(!page)throw Error('Private Flutter test page not found on reserved port');
      await dispatchTrustedWebInput(page,request);
    } else if(platform==='android') {
      await dispatchTrustedAndroidInput(request,deviceId);
    } else {
      await withTimeout(Promise.race([
        new Promise((resolve,reject)=>{ack={id:request.id,resolve,reject};nextCommand=request;}),
        iosDone.then(value=>{throw Error('XCTest input driver exited before acknowledgement: '+JSON.stringify(value));}),
      ]),90000,'XCTest input acknowledgement timed out');
    }
    const mechanism=platform==='web'?(request.action==='hold'?'Chrome DevTools touch hold':'Chrome DevTools mouse input'):platform==='android'?(request.action==='tap'?'adb touchscreen tap':request.action==='hold'?'adb touchscreen draganddrop hold':'adb touchscreen swipe'):(request.action==='tap'?'XCTest coordinate tap':request.action==='hold'?'XCTest coordinate hold':'XCTest coordinate drag');
    emit({id:request.id,status:'dispatched',mechanism,
      coordinateSpace:request.coordinateSpace,from:request.from,to:request.to,durationMs:request.durationMs,startedAt,finishedAt:new Date().toISOString(),sourceFiles:fingerprint});
    completed.add(request.id);
  }
  return {
    accept(request) {
      chain=chain.then(()=>dispatch(request)).catch(error=>{emit({id:request?.id??null,status:'failed',error:String(error),sourceFiles:fingerprint});throw error;});
      // The runner awaits this chain at shutdown; suppress an unhandled rejection
      // while the application independently observes its timeout/failure.
      chain.catch(()=>{});
    },
    async stop() {
      let failure=null;try{await chain;}catch(error){failure=error;}
      stopped=true;
      if(browser)await browser.close();
      if(iosChild) {
        const outcome=await withTimeout(iosDone,20000,'XCTest driver shutdown timed out').catch(()=>null);
        if(!outcome){
          iosChild.kill('SIGTERM');failure??=Error('XCTest driver did not stop after test completion');
          let terminated=await withTimeout(iosDone,5000,'SIGTERM did not stop XCTest').catch(()=>null);
          if(!terminated){iosChild.kill('SIGKILL');terminated=await withTimeout(iosDone,5000,'SIGKILL did not stop XCTest').catch(()=>null);}
          if(!terminated)throw Error('XCTest input process has not exited; inspect it before starting another run');
        }
        else if(outcome.exitCode!==0)failure??=Error('XCTest driver failed: '+JSON.stringify(outcome));
        fs.closeSync(iosOutput);
      }
      if(iosServer)await new Promise(resolve=>iosServer.close(resolve));
      if(seen.size!==trustedGestureIds.length||completed.size!==trustedGestureIds.length)failure??=Error('Expected '+trustedGestureIds.length+' completed trusted gestures, received '+completed.size+' of '+seen.size+' requests');
      emit({id:'driver-lifecycle',status:failure?'failed':'completed',gestures:completed.size,requests:seen.size,
        error:failure?String(failure):null,sourceFiles:fingerprint});
      if(failure)throw failure;
    },
  };
}
