import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual as same} from 'node:util';
import {ROOT,sha} from './common.mjs';
import {capturePlatformInputs,validatePlatformRunManifest} from './platform_run_binding.mjs';
import {decodePlatformLogLine,parsePlatformTextResults} from './platform_log_markers.mjs';

const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const BASE='82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const HELPER='example/integration_test/sdk_xml_kml_contracts.dart',HELPER_SHA='f13720c1b3313c6698da5d50635d4fb69041af4888f7266f2723b240ddf2f651';
const REVIEW='docs/sdk-audit/reviews/sdk-xml-kml-native-source-review.json',REVIEW_SHA='f33821b258e5fe4913d18377492392b54c8bc4d5f80a90f0e53890118409d95d';
const SDK_FILE=`tool/sdk_audit/.cache/sources/${SDK}`;
const xmlText='<r xmlns="urn:r" xmlns:x="urn:x" x:id="7"><x:item>A &amp; B</x:item></r>';
const empty='<kml xmlns="http://www.opengis.net/kml/2.2"/>';
const point='<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark id="p"><name>A</name><Point><coordinates>127,37</coordinates></Point></Placemark></kml>';
const line='<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><LineString><coordinates>127,37 128,38</coordinates></LineString></Placemark></kml>';
const href='data:text/xml,%3Ckml%2F%3E',link='<kml xmlns="http://www.opengis.net/kml/2.2"><NetworkLink><Link><href>data:text/xml,%3Ckml%2F%3E</href></Link></NetworkLink></kml>';
const cases=[['xml-read-namespace',{xml:xmlText}],['xml-dom-mutation',{namespace:'urn:test',text:'A & B'}],['xml-read-malformed',{xml:'<r>'}],['xml-read-node-error',{xml:'<r xmlns="urn:r"/>'}],['kml-empty',{kml:empty}],['kml-point',{kml:point}],['kml-point-write',{kml:point}],['kml-line',{kml:line}],['kml-default-link-depth',{kml:link,href}],['xml-child-filter',{xml:'<r xmlns="urn:r"><a/><b/></r>'}]];
export function sdkXmlKmlCases(){return structuredClone(cases.map(([id,input])=>({id:`sdk-xml-kml:${id}`,input})));}
const xml=['read','write','destroy','setNamespace','createElementNS','createTextNode','getElementsByTagNameNS','getAttributeNS','setAttributeNS','getChildValue','readNode','getXMLDoc','getChildEl','getThisOrNextEl','lookupNamespaceURI'];
const kml=['read','parseData','parseLinks','fetchLink','parseFeature','write','buildGeometryNode'];
const callableIds=['Tmapv3.extension.XML#constructor','Tmapv3.extension.KML#constructor',...xml.map(x=>'Tmapv3.extension.XML#'+x),...kml.map(x=>'Tmapv3.extension.KML#'+x)];
function references(root){
 const read=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(sha(b)!==digest)throw Error(`reference digest: ${file}`);return b;};
 read(HELPER,HELPER_SHA);const review=JSON.parse(read(REVIEW,REVIEW_SHA)),sdk=read(SDK_FILE,SDK).toString('utf8');
 if(review.status!=='OPEN'||review.baselineId!==BASE||review.sdkSha256!==SDK||review.offsetUnit!=='UTF-16'||!Array.isArray(review.sources)||!same(review.sources.map(x=>x.id).sort(),[...callableIds].sort()))throw Error('source review metadata');
 const files=['lib/src/models/sdk_xml_native.dart','lib/src/models/sdk_kml_native.dart','lib/src/controller/sdk_xml_kml_commands.dart','test/sdk_xml_kml_native_test.dart',HELPER,'tool/sdk_audit/xml_kml_source_probe.mjs','tool/sdk_audit/test/xml_kml_source_probe.test.mjs'];
 if(!Array.isArray(review.files)||review.files.length!==files.length||files.some(f=>review.files.filter(x=>x.file===f).length!==1)||!review.files.some(x=>x.file===HELPER&&x.sha256===HELPER_SHA))throw Error('review file set');
 for(const f of review.files)read(f.file,f.sha256);
 const methods={};for(const x of review.sources){if(x.file!==SDK_FILE||x.sha256!==SDK||!Number.isInteger(x.start)||!Number.isInteger(x.end)||x.start<0||x.end<=x.start||sdk.slice(x.start,x.end)!==x.excerpt||sha(x.excerpt)!==x.sourceTextSha256)throw Error(`source span: ${x.id}`);methods[x.id]=x.excerpt;}
 return methods;
}
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
/** Fixed same-runtime cases; no verification-status promotion. */
export function compareSdkXmlKmlNative({source,rows},{root=ROOT}={}){
 let methods;try{methods=references(root);}catch(e){return {status:'MISMATCH',issues:[`reference: ${e.message}`]};}
 const issues=[];if(source?.id!=='sdk-xml-kml:callable-sources'||source.expectedSdkSha256!==SDK||source.sdkDigestMeasurement!=='not measured by this helper'||!same(source.observation,{status:'observed',inherits:true,methods}))issues.push('callable sources');
 const expected=sdkXmlKmlCases();if(!Array.isArray(rows)||rows.length!==expected.length)return {status:'MISMATCH',issues:[...issues,'case count']};
 for(let i=0;i<expected.length;i++){
  const row=rows[i],e=expected[i],allowThrow=i===3||i===6;
  if(row?.id!==e.id||!same(row.input,e.input)){issues.push(`identity/input: ${e.id}`);continue;}
  const n=row.native;if(!obj(n)||!same(n,row.controller)||!['observed',...(allowThrow?['threw']:[])].includes(n.status)){issues.push(`native/controller: ${e.id}`);continue;}
  if(n.status==='threw'){if(typeof n.name!=='string'||typeof n.message!=='string')issues.push(`error shape: ${e.id}`);continue;}
  const v=n.value;
  if(i===0&&(!obj(v)||v.root!=='r'||v.namespace!=='urn:r'||v.id!=='7'||v.text!=='A & B'||typeof v.serialized!=='string'||!v.serialized))issues.push('XML namespace values');
  if(i===1&&(!obj(v)||v.same!==true||v.namespace!=='urn:test'||typeof v.serialized!=='string'||!v.serialized.includes('A &amp; B')))issues.push('XML DOM mutation');
  if(i===2&&(!obj(v)||typeof v.root!=='string'||!(v.namespace===null||typeof v.namespace==='string')))issues.push('malformed XML result');
  if(i===3&&v!=='returned')issues.push('readNode return');
  if(i===4&&!same(v,{length:0,depth:0,same:true}))issues.push('empty KML');
  if(i===5&&!same(v,{length:1,id:'p',x:'127',y:'37',name:'A'}))issues.push('KML point values');
  if(i===6&&typeof v!=='string')issues.push('KML writer return');
  if(i===7&&!same(v,{length:2,x0:'127',y0:'37',x1:'128',y1:'38'}))issues.push('KML line values');
  if(i===8&&!same(v,{length:0,depth:0,fetched:false}))issues.push('KML default link depth');
  if(i===9&&!same(v,{wrongName:true,wrongNamespace:true,same:true,defaultNamespace:'urn:r'}))issues.push('XML child namespace filters');
 }
 return {status:issues.length?'MISMATCH':'BOUNDED_MATCH',count:rows.length,issues,scope:'Ten fixed same-runtime DOM and KML observations; no full contract promotion.'};
}
const bindings={
 'Tmapv3.extension.XML#read':['xml-read-namespace','xml-read-malformed','xml-read-node-error'],
 'Tmapv3.extension.XML#write':['xml-read-namespace','xml-dom-mutation'],
 'Tmapv3.extension.XML#getElementsByTagNameNS':['xml-read-namespace'],
 'Tmapv3.extension.XML#getAttributeNS':['xml-read-namespace'],
 'Tmapv3.extension.XML#getChildValue':['xml-read-namespace'],
 'Tmapv3.extension.XML#readNode':['xml-read-node-error'],
 'Tmapv3.extension.XML#getChildEl':['xml-child-filter'],
 'Tmapv3.extension.XML#lookupNamespaceURI':['xml-child-filter'],
 'Tmapv3.extension.KML#read':['kml-empty','kml-point','kml-point-write','kml-line','kml-default-link-depth'],
 'Tmapv3.extension.KML#write':['kml-point-write']
};
export function collectSdkXmlKmlNativeObservations({runtime,manifest,libFingerprint,root=ROOT}){
 try{
  const fail=x=>{throw Error(x);},ev=runtime?.platformEvidence;
  if(manifest?.id!==BASE||!manifest.sources?.some(x=>x.kind==='sdk'&&x.sha256===SDK))fail('baseline or SDK mismatch');
  if(!ev||!same(ev.libFingerprint,libFingerprint))fail('library fingerprint');const current=capturePlatformInputs(root);
  if(!same(current,{libFingerprint,inputs:ev.inputs}))fail('current source inputs');references(root);
  const records=Array.isArray(ev.records)?ev.records.filter(x=>x.kind==='integration'):[],platforms=['android','ios','web'];
  if(records.length!==3||platforms.some(p=>records.filter(x=>x.platform===p).length!==1))fail('integration record set');
  const out=Object.fromEntries(Object.keys(bindings).map(id=>[id,{status:'observed-not-verified',baselineId:BASE,expectedSdkSha256:SDK,sdkDigestMeasurement:'not measured by this helper',libFingerprintSha256:libFingerprint.sha256,fixture:{file:HELPER,sha256:HELPER_SHA},sourceReview:{file:REVIEW,sha256:REVIEW_SHA},limitations:['Live handles require an initialized map and do not represent detached immutable snapshots.','The native SDK can throw for selected read/write paths; errors are observed without repair.','No remote link fetch is exercised. Default depth zero does not constrain arbitrary raw handle mutation.','Callable text does not establish whole-device SDK bytes or closure identity; finite cases do not establish complete parity.'],platforms:{}}]));
  for(const rec of records){const expected=`docs/sdk-audit/platform-logs/${rec.platform==='web'?'web-final.log':rec.platform+'-complete.log'}`;
   if(rec.passed!==true||rec.file!==expected||rec.run?.file!==rec.file+'.run.json')fail('invalid integration record');
   const load=(file,digest)=>{const b=fs.readFileSync(path.join(root,file));if(!/^[a-f0-9]{64}$/.test(digest||'')||sha(b)!==digest)fail('log/run digest');return b.toString('utf8');};
   const log=load(rec.file,rec.sha256),lines=log.split('\n'),run=JSON.parse(load(rec.run.file,rec.run.sha256));
   if(run.sanitizedLogSha256!==rec.sha256||run.exitCode!==0||run.signal!==null)fail('successful run binding');
   const {sanitizedLogSha256,...raw}=run;validatePlatformRunManifest(raw,{platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:raw.rawLogSha256});
   const completion=parsePlatformTextResults(lines);if(rec.platform==='web'?!completion.webPassed:!completion.mobilePassed)fail('completion marker');
   const parse=field=>lines.flatMap((line,index)=>{const row=decodePlatformLogLine(line);return row?.kind==='json'&&row.field===field?[{data:JSON.parse(row.payload),line:index+1}]:[];});
   const sources=parse('sdkXmlKmlSources'),rows=parse('sdkXmlKmlResults');
   if(sources.length!==1||rows.length!==cases.length||sources[0].line>=rows[0].line||!same(sources.map(x=>x.data),rec.sdkXmlKmlSources)||!same(rows.map(x=>x.data),rec.sdkXmlKmlResults))fail('log observations');
   const comparison=compareSdkXmlKmlNative({source:sources[0].data,rows:rows.map(x=>x.data)},{root});if(comparison.status!=='BOUNDED_MATCH')fail(`comparison: ${JSON.stringify(comparison)}`);
   const ref=x=>({file:rec.file,sha256:rec.sha256,line:x.line,logLineSha256:sha(lines[x.line-1]),observationSha256:sha(JSON.stringify(x.data))});
   for(const [id,names] of Object.entries(bindings)){const selected=rows.filter(x=>names.some(n=>x.data.id===`sdk-xml-kml:${n}`));out[id].platforms[rec.platform]={log:{file:rec.file,sha256:rec.sha256},run:rec.run,source:{observation:sources[0].data,ref:ref(sources[0])},cases:selected.map(x=>({observation:x.data,ref:ref(x)}))};}
  }
  return {byContract:out,issues:[]};
 }catch(error){return {byContract:{},issues:[{code:'sdk-xml-kml-native-observations-rejected',reason:String(error.message)}]};}
}
