import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{parse}=require('acorn');
const SDK='5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const names=['Tmapv3.mapobject.MapObject','Tmapv3.mapobject.Marker','Tmapv3.mapobject.Label','Tmapv3.mapobject.InfoWindow','Tmapv3.shape.Polyline','Tmapv3.shape.Polygon','Tmapv3.shape.Circle','Tmapv3.shape.Rectangle','Tmapv3.shape.GroundOverlay'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function visit(n,fn){if(!n||typeof n!=='object')return;if(typeof n.type==='string')fn(n);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(x=>visit(x,fn));else if(v&&typeof v==='object')visit(v,fn);}}
/** Extract exact original SDK constructor namespaces and prototype method spans.
 * UTF-16 offsets; source shape inspection only, never a platform result. */
export function inspectSdkOverlayNativeSource(bytes){
 if(sha(bytes)!==SDK)throw Error('SDK digest mismatch');
 const source=bytes.toString('utf8'),ast=parse(source,{ecmaVersion:'latest'}),result=[];
 for(const name of names){
  const hits=ast.body.filter(n=>n.type==='ExpressionStatement'&&source.slice(n.start,n.start+160).startsWith(`Tmapv3.createNamespace("${name}"`));
  if(hits.length!==1)throw Error('namespace missing or duplicate: '+name);
  const node=hits[0],methods=[];let constructor;
  visit(node,n=>{if(!constructor && n.type==='VariableDeclarator' && n.id?.type==='Identifier' && n.init?.type==='FunctionExpression'){constructor={name:n.id.name,start:n.init.start,end:n.init.end,params:n.init.params.map(p=>source.slice(p.start,p.end)),sha256:sha(source.slice(n.init.start,n.init.end))};}
  const l=n.left;if(n.type!=='AssignmentExpression'||l?.type!=='MemberExpression'||l.computed||l.object?.type!=='MemberExpression'||l.object.computed||l.object.property?.name!=='prototype'||n.right?.type!=='FunctionExpression')return;methods.push({name:l.property.name,start:n.start,end:n.end,params:n.right.params.map(p=>source.slice(p.start,p.end)),sha256:sha(source.slice(n.start,n.end))});});
  if(!constructor)throw Error('constructor missing: '+name);
  result.push({name,start:node.start,end:node.end,sha256:sha(source.slice(node.start,node.end)),constructor,methods});
 }
 return {sdkSha256:SDK,offsetUnit:'UTF-16',namespaces:result};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2]??`tool/sdk_audit/.cache/sources/${SDK}`;
 process.stdout.write(JSON.stringify(inspectSdkOverlayNativeSource(fs.readFileSync(file)),null,2)+'\n');
}
