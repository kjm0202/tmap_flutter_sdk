import fs from 'node:fs';
import path from 'node:path';
import {ROOT, sha} from './common.mjs';

const sdkSha = '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const engine = 'Vsm.Map.EventNames';
const sdk = 'Tmapv3.event.EventNames';
const names = Object.freeze([
  'Click','ConfigLoad','ContextLost','ContextMenu','Data','Destroy','DoubleClick',
  'Drag','DragEnd','DragStart','Error','FirstPaint','Idle','LimitOptionsChanged',
  'LongTap','MouseDown','MouseMove','MouseOut','MouseOver','MouseUp','Move',
  'MoveEnd','MoveStart','Pitch','PitchEnd','PitchStart','Render','RenderComplete',
  'Resize','Rotate','RotateEnd','RotateStart','SourceLoad','SourceUpdate','StyleLoad',
  'TouchCancel','TouchEnd','TouchMove','TouchStart','Wheel','Zoom','ZoomEnd','ZoomStart',
]);
const sourceSpans = [
  [479049,480048,'7793ab7cb00c5953b9b36fd3aaded255bebfb1b40a9f4ec2b0acfb468b943211'],
  [846530,846559,'1031cde260e8ab5eac8446568a1b7d7a56ca41ad98bccca92a3b0ddf9945a3f6'],
];

/// Capture after the pinned SDK is loaded. This function is serializable for
/// browser page evaluation. Reading descriptors avoids invoking accessors.
export function captureEventNamesAlias() {
  const a = globalThis.Vsm?.Map?.EventNames;
  const b = globalThis.Tmapv3?.event?.EventNames;
  const output={phase:'loaded',sdkSha256:'5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e',sameObject:a===b};
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return {...output,sameObject:false,tmap:null,engine:null};
  }
  function snapshot(value) {
    const own=Reflect.ownKeys(value);
    if (own.some(key=>typeof key!=='string')) return {keys:[],entries:{},hasSymbol:true};
    const keys=own.sort(), entries={};
    for(const key of keys) {
      const d=Object.getOwnPropertyDescriptor(value,key);
      entries[key]={value:d.value,valueType:typeof d.value,writable:d.writable,
        enumerable:d.enumerable,configurable:d.configurable};
    }
    return {keys,entries};
  }
  return {...output,tmap:snapshot(b),engine:snapshot(a)};
}

// Returns the exact admissible ID mapping; no global prefix alias is emitted.
// A source or runtime discrepancy means no rows are deduplicated. This never
// certifies event payloads, support, dispatch or mutable Dart equivalence.
export function reviewedEventNamesAliases(manifest, ast, runtime, read=fs.readFileSync) {
  try {
    if (!manifest?.sources?.some(s => s.kind==='sdk' && s.sha256===sdkSha)) return {};
    const bytes=read(path.join(ROOT,'tool/sdk_audit/.cache/sources',sdkSha));
    if (sha(bytes)!==sdkSha) return {};
    const body=bytes.toString('utf8');
    if (sourceSpans.some(([start,end,digest]) => sha(body.slice(start,end))!==digest) ||
      body.slice(716741,716755)!=='k.EventNames=p' || body.slice(716874,716884)!=='const pc=k' ||
      body.slice(727916,727929)!=='return{Map:pc') return {};
    if (!runtime?.networkScripts?.some(s=>s.pinned===true && s.status===200 && s.sha256===sdkSha)) return {};
    const proof=runtime.eventNamesAliasEvidence;
    if (proof?.sameObject!==true || proof.phase!=='loaded' || proof.sdkSha256!==sdkSha) return {};
    const exactSnapshot=s=>s && !s.hasSymbol && JSON.stringify(s.keys)===JSON.stringify(names) &&
      Object.keys(s.entries||{}).length===names.length && names.every(name=>{
        const d=s.entries[name];return d && d.value===name && d.valueType==='string' &&
          d.enumerable===true && d.writable===true && d.configurable===true;
      });
    if (!exactSnapshot(proof.tmap) || !exactSnapshot(proof.engine)) return {};
    const native=(runtime.engine?.rows||[]).filter(r=>r.id===engine || r.id.startsWith(engine+'.'));
    const wrapped=(runtime.rows||[]).filter(r=>r.phase==='loaded' && (r.id===sdk || r.id.startsWith(sdk+'.')));
    const expected=['',...names.map(x=>'.'+x)];
    const descriptorsMatch=(rows,prefix)=>rows.length===expected.length && expected.every(suffix=>{
      const entries=rows.filter(r=>r.id===prefix+suffix);
      return entries.length===1 && entries[0].kind===(suffix?'property':'object') &&
        entries[0].valueType===(suffix?'string':'object') && entries[0].writable===true;
    });
    if (!descriptorsMatch(native,engine) || !descriptorsMatch(wrapped,sdk)) return {};
    return Object.fromEntries(expected.map(suffix=>[engine+suffix,sdk+suffix]));
  } catch { return {}; }
}

// Exact match only: an unreviewed sibling or future field stays distinct.
export function canonicalEventNameId(id, aliases) {
  return Object.hasOwn(aliases || {},id) ? aliases[id] : id;
}
