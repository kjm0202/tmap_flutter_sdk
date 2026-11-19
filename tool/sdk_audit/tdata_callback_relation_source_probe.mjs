import fs from 'node:fs';import path from 'node:path';import {parseExpressionAt} from 'acorn';import {ROOT,sha} from './common.mjs';
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
export const TDATA_METHODS=Object.freeze([
 ['getGeoFromAddress',6],['getGeoFromAddressJson',6],['getAddressFromGeo',4],['getAddressFromGeoJson',4],
 ['getRoutePlan',4],['getRoutePlanJson',4],['getRoutePlanForPeople',6],['getRoutePlanForPeopleJson',6],
 ['getRealTimeTraffic',7],['getRealTimeTrafficJson',7],['getAutoTraffic',2],['getPOIDataFromSearch',3],
 ['getPOIDataFromSearchJson',3],['getPOICategory',2],['getPOICategoryJson',2],['getPOIDataFromLonLat',5],
 ['getPOIDataFromLonLatJson',5],['getPOIDataFromId',3],['getPOIDataFromIdJson',3],['transform',6],
 ['transformJson',6],['getGeofencingFromSearch',6],['getGeofencingFromSearchJson',6],['getGeofencingFromId',3],
 ['getGeofencingFromIdJson',3],['getAutoCompleteSearch',3],['getAutoCompleteSearchJson',3],['getAutoCompleteSearchV2Json',3],
]);
/** Pin every original method body and direct callback-field assignment. */
export function observeTDataCallbackRelations(root=ROOT){
 const bytes=fs.readFileSync(path.join(root,'tool/sdk_audit/.cache/sources',SDK));if(sha(bytes)!==SDK)throw Error('SDK digest mismatch');
 const text=bytes.toString('utf8'),start=text.indexOf('Tmapv3.createNamespace("Tmapv3.extension.TData"'),end=text.indexOf('Tmapv3.createNamespace(',start+50);if(start<0||end<0)throw Error('TData namespace missing');
 const re=/A\.prototype\.([\w$]+)=function\(/g,body=text.slice(start,end),found=[];let m;
 while((m=re.exec(body))){const methodStart=start+m.index,fnStart=text.indexOf('function',methodStart),parsed=parseExpressionAt(text,fnStart,{ecmaVersion:'latest'}),fn=parsed.type==='SequenceExpression'?parsed.expressions[0]:parsed;if(fn.type!=='FunctionExpression')throw Error('not a function');
  const cb=fn.params.at(-1);if(!cb||cb.type!=='Identifier')throw Error('missing final callback parameter');
  const fields=[];for(const statement of fn.body.body){const e=statement.type==='ExpressionStatement'?statement.expression:null;if(e?.type!=='AssignmentExpression'||e.operator!=='=')continue;const l=e.left,r=e.right;
   if(l?.type==='MemberExpression'&&!l.computed&&l.object.type==='ThisExpression'&&['onComplete','onProgress','onError'].includes(l.property.name)){
    if(r?.type!=='MemberExpression'||r.computed||r.object.type!=='Identifier'||r.object.name!==cb.name||r.property.name!==l.property.name)throw Error('callback assignment mismatch');fields.push(l.property.name);
   }}
  if(JSON.stringify(fields)!==JSON.stringify(['onComplete','onProgress','onError']))throw Error('missing callback fields');
  found.push({name:m[1],arity:fn.params.length,callbackIndex:fn.params.length-1,start:methodStart,end:fn.end,sha256:sha(text.slice(methodStart,fn.end)),callbackFields:fields});
 }
 if(JSON.stringify(found.map(x=>[x.name,x.arity]))!==JSON.stringify(TDATA_METHODS))throw Error('method set or arity mismatch');
 return {sdkSha256:SDK,namespace:{start,end,sha256:sha(text.slice(start,end))},methods:found};
}
